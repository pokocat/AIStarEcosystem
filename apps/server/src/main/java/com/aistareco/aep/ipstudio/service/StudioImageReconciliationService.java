package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.enterprise.service.EnterpriseBillingService;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.service.AuditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;

/** Operator evidence can attach only the original supplier task; generation and pricing are immutable. */
@Service
public class StudioImageReconciliationService {
    public record RecoveryRequest(Integer imageIndex,String externalTaskId,String evidence) {}
    public record UnknownReleaseRequest(Integer imageIndex,String evidence,Boolean confirmedNoUpstreamTask) {}
    private final IpRunRepository runs;
    private final IpProjectService projects;
    private final EnterpriseBillingService billing;
    private final AuditService audits;
    private final IpRunWorker worker;
    private final ObjectMapper mapper;
    private final com.aistareco.aep.repository.CreditHoldRepository holds;
    private final com.aistareco.aep.enterprise.repository.EnterpriseBillingAuthorizationRepository authorizations;
    private final com.aistareco.aep.service.CreditService credits;
    private final com.aistareco.aep.service.AiGenerationQueueService queue;
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;
    public StudioImageReconciliationService(IpRunRepository runs,IpProjectService projects,EnterpriseBillingService billing,
            AuditService audits,IpRunWorker worker,ObjectMapper mapper,com.aistareco.aep.repository.CreditHoldRepository holds,
            com.aistareco.aep.enterprise.repository.EnterpriseBillingAuthorizationRepository authorizations,
            com.aistareco.aep.service.CreditService credits,com.aistareco.aep.service.AiGenerationQueueService queue) {
        this.runs=runs;this.projects=projects;this.billing=billing;this.audits=audits;this.worker=worker;this.mapper=mapper;this.holds=holds;this.authorizations=authorizations;this.credits=credits;this.queue=queue;
    }
    @Transactional(readOnly=true)
    public JsonNode read(String id) {return view(required(id));}
    @Transactional
    public JsonNode recover(String id,RecoveryRequest request,String actor) {
        if(actor==null||actor.isBlank())throw new BusinessException(HttpStatus.FORBIDDEN,"STUDIO_IMAGE_RECOVERY_ACTOR_REQUIRED","需要平台运营人员处理");
        int index=request==null||request.imageIndex()==null?0:request.imageIndex();
        String external=request==null||request.externalTaskId()==null?null:request.externalTaskId().trim();
        String evidence=request==null||request.evidence()==null?null:request.evidence().trim();
        if(index<0||external==null||!external.matches("[a-zA-Z0-9_-]{1,128}")||evidence==null||evidence.length()<8||evidence.length()>2000)
            throw BusinessException.badRequest("STUDIO_IMAGE_RECOVERY_INVALID","请提供原图片任务号、图片序号与 8 至 2000 字的核对凭据");
        billing.lockForSettlement(IpRunService.REF_TYPE,id);
        var run=runs.lockById(id).orElseThrow(()->BusinessException.notFound("IP_RUN_NOT_FOUND","运行记录不存在"));
        if(entityManager!=null)entityManager.refresh(run,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if(!IpRun.KIND_GENERATE.equals(run.getKind()))throw invalid("请选择原生图片生成任务");
        var original=projects.parseOrEmptyObject(run.getInputJson());
        if(!original.isObject()||!original.path("_exec").isObject())throw invalid("任务缺少原始提交凭据，不能猜测生成或查询");
        ObjectNode input=(ObjectNode)original;var exec=(ObjectNode)input.path("_exec");
        var checkpoint=exec.path("imageJobs").path(index);
        if(!checkpoint.isObject()||!checkpoint.path("submitAttempted").asBoolean()||checkpoint.path("requestBody").asText().isBlank()
                ||checkpoint.path("baseUrl").asText().isBlank()||exec.path("endpointId").asText().isBlank())
            throw invalid("任务没有原始提交凭据，不能补录或创建新的生成请求");
        String existing=checkpoint.path("jobId").asText();
        if(!existing.isBlank()&&!external.equals(existing))throw invalid("原供应商任务号已固定，不能替换");
        if(!IpRun.STATUS_RUNNING.equals(run.getStatus())) {
            if(external.equals(existing))return view(run);
            throw invalid("已结算任务不能重新开启或更改供应商任务号");
        }
        requireOriginalReservation(run,exec);
        if(exec.path("nativeLeaseUntil").asLong()>System.currentTimeMillis())throw invalid("原任务正在查询，请等待当前查询完成");
        if(index!=projects.parseOrEmptyObject(run.getOutputJson()).path("candidates").size())throw invalid("只能核对当前尚未结算的图片");
        ObjectNode state=(ObjectNode)checkpoint;
        if(existing.isBlank()) {
            if(!"STUDIO_IMAGE_SUBMISSION_UNKNOWN".equals(run.getErrorCode()))throw invalid("任务当前不需要人工补录受理凭据");
            state.put("jobId",external).put("recoveredBy",actor).put("recoveryEvidence",evidence).put("recoveredAt",Instant.now().toString());
            var detail=mapper.createObjectNode().put("imageIndex",index).put("externalTaskId",external).put("endpointId",exec.path("endpointId").asText()).put("evidence",evidence);
            audits.record(actor,null,"studio.image.bind_original_task","ip-run",id,null,null,AuditLog.AuditResult.SUCCESS,detail.toString());
        }
        exec.put("nativeLeaseUntil",0);run.setInputJson(input.toString());run.setStage("image.provider.recovering");run.setErrorCode("STUDIO_IMAGE_RECOVERING");
        run.setErrorMessage("正在查询已核实的原图片任务，无需重新生成");run.setHeartbeatAt(Instant.now());runs.save(run);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
            @Override public void afterCommit(){try{worker.recoverNative(id);}catch(RuntimeException ignored){/* Durable queue resumes the same task. */}}
        });
        return view(run);
    }
    /** Only a supplier-confirmed absence permits an unknown request to give up its original reservation. */
    @Transactional
    public JsonNode releaseUnknown(String id,UnknownReleaseRequest request,String actor) {
        if(actor==null||actor.isBlank())throw new BusinessException(HttpStatus.FORBIDDEN,"STUDIO_IMAGE_RECOVERY_ACTOR_REQUIRED","需要平台运营人员处理");
        int index=request==null||request.imageIndex()==null?0:request.imageIndex();
        String evidence=request==null||request.evidence()==null?null:request.evidence().trim();
        if(index<0||request==null||!Boolean.TRUE.equals(request.confirmedNoUpstreamTask())||evidence==null||evidence.length()<8||evidence.length()>2000)
            throw BusinessException.badRequest("STUDIO_IMAGE_RECOVERY_INVALID","请明确确认供应商未受理且不存在上游任务，并提供 8 至 2000 字的原请求核对依据");
        billing.lockForSettlement(IpRunService.REF_TYPE,id);
        var run=runs.lockById(id).orElseThrow(()->BusinessException.notFound("IP_RUN_NOT_FOUND","运行记录不存在"));
        if(entityManager!=null)entityManager.refresh(run,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        var original=projects.parseOrEmptyObject(run.getInputJson());
        if(!IpRun.KIND_GENERATE.equals(run.getKind())||!original.isObject()||!original.path("_exec").isObject())throw invalid("任务缺少原生图片提交凭据");
        ObjectNode input=(ObjectNode)original;ObjectNode exec=(ObjectNode)input.path("_exec");var checkpoint=exec.path("imageJobs").path(index);
        if(!checkpoint.isObject()||!checkpoint.path("submitAttempted").asBoolean()||!checkpoint.path("jobId").asText().isBlank()
                ||checkpoint.hasNonNull("storageKey")||checkpoint.path("requestBody").asText().isBlank()
                ||checkpoint.path("baseUrl").asText().isBlank()||exec.path("endpointId").asText().isBlank())
            throw invalid("只有无供应商任务号、无产物且受理未知的原请求可核实释放；已知任务必须查询原任务");
        if(!IpRun.STATUS_RUNNING.equals(run.getStatus())) {
            if("STUDIO_IMAGE_CONFIRMED_NOT_ACCEPTED".equals(run.getErrorCode())&&checkpoint.path("confirmedNoUpstreamTask").asBoolean()
                    &&actor.equals(checkpoint.path("releasedBy").asText())&&evidence.equals(checkpoint.path("releaseEvidence").asText()))return view(run);
            throw invalid("原任务已结束，不能更改核对结论或再次释放");
        }
        if(!"STUDIO_IMAGE_SUBMISSION_UNKNOWN".equals(run.getErrorCode())||exec.path("nativeLeaseUntil").asLong()>System.currentTimeMillis())throw invalid("原任务仍在查询或并非无任务号受理未知状态");
        int completed=projects.parseOrEmptyObject(run.getOutputJson()).path("candidates").size();
        if(index!=completed)throw invalid("只能核对当前尚未结算的图片");
        requireOriginalReservation(run,exec);
        long unit=exec.path("unitCost").asLong(-1);if(unit<0)throw invalid("原任务计费单价缺失，请核对原付款凭据");
        long spent=Math.multiplyExact(unit,completed);
        if(spent>exec.path("holdTotal").asLong())throw invalid("原任务已结算图片与冻结快照不一致，请先对账");
        if(exec.path("holdTotal").asLong()>0&&holds.findByReferenceTypeAndReferenceId(IpRunService.REF_TYPE,id).orElseThrow().getRemainingAmount()!=exec.path("holdTotal").asLong()-spent)
            throw invalid("原任务剩余冻结与已结算图片不一致，请先对账");
        var detail=mapper.createObjectNode().put("imageIndex",index).put("confirmedNoUpstreamTask",true)
                .put("requestFingerprint",hash(checkpoint.path("requestBody").asText())).put("endpointId",exec.path("endpointId").asText()).put("evidence",evidence);
        audits.record(actor,null,"studio.image.release_confirmed_unknown","ip-run",id,null,null,AuditLog.AuditResult.SUCCESS,detail.toString());
        ((ObjectNode)checkpoint).put("confirmedNoUpstreamTask",true).put("releasedBy",actor).put("releaseEvidence",evidence).put("releasedAt",Instant.now().toString());
        exec.put("nativeLeaseUntil",0);run.setInputJson(input.toString());run.setCost(spent);run.setCancelRequested(true);
        run.setStatus(IpRun.STATUS_FAILED);run.setStage("failed");run.setPct(100);run.setErrorCode("STUDIO_IMAGE_CONFIRMED_NOT_ACCEPTED");
        run.setErrorMessage("供应商已确认原请求未受理，已退回未用积分"+(completed>0?"；已生成的 "+completed+" 张图片仍可使用":""));
        run.setHeartbeatAt(Instant.now());run.setFinishedAt(Instant.now());runs.saveAndFlush(run);
        credits.releaseHold(IpRunService.REF_TYPE,id,"运营核实供应商未受理原图片请求，退回未用积分");
        billing.complete(IpRunService.REF_TYPE,id);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){queue.finish(com.aistareco.aep.service.AiGenerationQueueService.IMAGE,id);}});
        return view(run);
    }
    private void requireOriginalReservation(IpRun run,JsonNode exec) {
        long amount=exec.path("holdTotal").asLong(-1);
        if(amount<0)throw invalid("原任务计费快照缺失，请先核对原付款凭据");
        var authorization=authorizations.findByReferenceTypeAndReferenceId(IpRunService.REF_TYPE,run.getId()).orElse(null);
        if(authorization!=null&&entityManager!=null)entityManager.refresh(authorization,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if(authorization!=null&&!java.util.Objects.equals(run.getBillingAuthorizationId(),authorization.getId()))throw holdUnavailable();
        if(run.getBillingAuthorizationId()!=null && (authorization==null || !run.getBillingAuthorizationId().equals(authorization.getId())
                || authorization.getTerminalAt()!=null || authorization.getAmount()!=amount
                || !java.util.Objects.equals(authorization.getActorUserId(),run.getOwnerUserId())
                || !java.util.Objects.equals(authorization.getWalletId(),run.getBillingWalletId())
                || !java.util.Objects.equals(authorization.getMembershipId(),run.getMembershipId())
                || !java.util.Objects.equals(authorization.getEnterpriseId(),run.getEnterpriseId())
                || !java.util.Objects.equals(authorization.getEndpointId(),exec.path("endpointId").asText(null))))
            throw holdUnavailable();
        if(run.getEnterpriseId()!=null && run.getBillingAuthorizationId()==null)throw holdUnavailable();
        if(amount==0)return;
        var hold=holds.findByReferenceTypeAndReferenceId(IpRunService.REF_TYPE,run.getId()).orElse(null);
        if(hold!=null&&entityManager!=null)entityManager.refresh(hold,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if(hold==null || hold.getStatus()!=com.aistareco.aep.model.CreditHold.Status.ACTIVE || hold.getRemainingAmount()<=0 || hold.getAmount()!=amount
                || run.getBillingWalletId()!=null&&!run.getBillingWalletId().equals(hold.getWalletId())
                || !java.util.Objects.equals(run.getMembershipId(),hold.getMembershipId())
                || !java.util.Objects.equals(run.getEnterpriseId(),hold.getEnterpriseId())
                || !java.util.Objects.equals(run.getBillingAuthorizationId(),hold.getBillingAuthorizationId())
                || run.getBillingWalletId()==null&&!run.getOwnerUserId().equals(hold.getUserId()))throw holdUnavailable();
    }
    private static BusinessException holdUnavailable(){return new BusinessException(HttpStatus.CONFLICT,"STUDIO_IMAGE_ORIGINAL_HOLD_RELEASED","原任务冻结或付款授权已结束或不一致，请先核对原付款账户，不能重新冻结或重提");}

    private IpRun required(String id){return runs.findById(id).orElseThrow(()->BusinessException.notFound("IP_RUN_NOT_FOUND","运行记录不存在"));}
    private JsonNode view(IpRun run) {
        var exec=projects.parseOrEmptyObject(run.getInputJson()).path("_exec");
        ObjectNode out=mapper.createObjectNode().put("id",run.getId()).put("ownerUserId",run.getOwnerUserId()).put("projectId",run.getProjectId())
                .put("status",run.getStatus()).put("stage",run.getStage()).put("cost",run.getCost()).put("holdTotal",exec.path("holdTotal").asLong())
                .put("endpointId",exec.path("endpointId").asText()).put("errorCode",run.getErrorCode()).put("errorMessage",run.getErrorMessage());
        var images=out.putArray("images");int i=0;
        for(var state:exec.path("imageJobs")) {
            var row=images.addObject().put("imageIndex",i++).put("submitAttempted",state.path("submitAttempted").asBoolean())
                    .put("externalTaskId",state.path("jobId").asText()).put("mirrored",state.hasNonNull("storageKey"));
            if(state.hasNonNull("requestBody"))row.put("requestFingerprint",hash(state.path("requestBody").asText()));
        }
        return out;
    }
    private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private static BusinessException invalid(String message){return new BusinessException(HttpStatus.CONFLICT,"STUDIO_IMAGE_RECOVERY_INVALID",message);}
}
