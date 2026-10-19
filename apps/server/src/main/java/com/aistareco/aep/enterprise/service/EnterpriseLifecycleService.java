package com.aistareco.aep.enterprise.service;

import com.aistareco.aep.enterprise.dto.EnterpriseLifecycleDtos.*;
import com.aistareco.aep.enterprise.model.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;

/** Previewed lifecycle changes revoke new work before collecting available funds. Accepted work keeps its payer. */
@Service
public class EnterpriseLifecycleService {
    private final EnterpriseRepository enterprises;
    private final EnterpriseMemberRepository members;
    private final EnterpriseCurrentMembershipRepository current;
    private final EnterpriseBillingAuthorizationRepository authorizations;
    private final EnterpriseLifecycleOperationRepository operations;
    private final EnterpriseAuditRepository audits;
    private final EnterpriseAccessService access;
    private final EnterpriseFundRecoveryService recovery;
    private final EnterpriseBillingService billing;
    private final CreditService credits;
    private final CreditHoldRepository holds;
    private final IpRunRepository runs;
    private final MaterialVideoJobService videos;
    private final AiGenerationQueueService queue;
    private final EntityManager em;
    private final ObjectMapper mapper;
    public EnterpriseLifecycleService(EnterpriseRepository enterprises,EnterpriseMemberRepository members,
            EnterpriseCurrentMembershipRepository current,EnterpriseBillingAuthorizationRepository authorizations,
            EnterpriseLifecycleOperationRepository operations,EnterpriseAuditRepository audits,EnterpriseAccessService access,
            EnterpriseFundRecoveryService recovery,EnterpriseBillingService billing,CreditService credits,CreditHoldRepository holds,
            IpRunRepository runs,MaterialVideoJobService videos,AiGenerationQueueService queue,EntityManager em,ObjectMapper mapper) {
        this.enterprises=enterprises;this.members=members;this.current=current;this.authorizations=authorizations;this.operations=operations;
        this.audits=audits;this.access=access;this.recovery=recovery;this.billing=billing;this.credits=credits;this.holds=holds;
        this.runs=runs;this.videos=videos;this.queue=queue;this.em=em;this.mapper=mapper;
    }
    @Transactional
    public Preview preview(String actor,String enterpriseId,PreviewRequest request) {
        if(request==null)throw bad("请选择操作");return state(actor,enterpriseId,request.action(),request.memberId()).preview();
    }
    @Transactional
    public Result apply(String actor,String enterpriseId,Request request) {
        if(request==null)throw bad("请选择操作");
        String key=text(request.clientRequestId(),64),confirmation=text(request.confirmationFingerprint(),64);
        lockEnterprise(enterpriseId);
        String requestFingerprint=hash(List.of(actor,Objects.toString(request.action(),""),Objects.toString(request.memberId(),""),confirmation));
        var prior=operations.findByEnterpriseIdAndClientRequestId(enterpriseId,key);
        if(prior.isPresent()) {
            if(!actor.equals(prior.get().getActorUserId())||!requestFingerprint.equals(prior.get().getFingerprint()))throw conflict("ENTERPRISE_REQUEST_CONFLICT","同一请求不能更改成员操作");
            try{return mapper.readValue(prior.get().getResultJson(),Result.class);}catch(Exception e){throw new IllegalStateException(e);}
        }
        var state=state(actor,enterpriseId,request.action(),request.memberId());
        if(!confirmation.equals(state.preview().confirmationFingerprint()))throw conflict("ENTERPRISE_LIFECYCLE_PREVIEW_STALE","成员、余额或在途任务已变化，请重新预览确认");
        if(!state.preview().canProceed())throw conflict("ENTERPRISE_LIFECYCLE_BLOCKED",String.join("；",state.preview().blockers()));
        long reclaimed=0;int cancelled=0;String status;
        long rootBefore=rootBalance(enterpriseId);
        String targetId=state.member()==null?null:state.member().getId();
        if("resume".equals(request.action())) {
            var target=state.member();target.setStatus("active");members.saveAndFlush(target);status="active";
        } else if("close".equals(request.action())) {
            // Close only after all funding, active work and cash applications have been reconciled.
            var all=em.createQuery("select m from EnterpriseMember m where m.enterpriseId=:id and m.status<>'removed'",EnterpriseMember.class).setParameter("id",enterpriseId).getResultList();
            for(var member:all){member.setStatus("removed");members.save(member);current.findCurrentForUpdate(member.getUserId()).filter(c->member.getId().equals(c.getMemberId())).ifPresent(current::delete);}
            var enterprise=lockEnterprise(enterpriseId);enterprise.setStatus("closed");enterprise.setUpdatedAt(Instant.now());enterprises.saveAndFlush(enterprise);status="closed";
        } else {
            var target=state.member();boolean removed="leave".equals(request.action())||"remove".equals(request.action());
            target.setStatus(removed?"removed":"suspended");members.saveAndFlush(target);
            // Revoke every old authorization, including already submitted jobs. Later refunds stay at the old enterprise,
            // even if this user resumes or joins the same enterprise with a new membership before the job returns.
            for(var authorization:state.active()) {authorization.setRevokedAt(Instant.now());authorization.setUpdatedAt(Instant.now());authorizations.save(authorization);}
            authorizations.flush();
            for(var authorization:state.active())if("reserved".equals(authorization.getStatus())) {
                if(cancelReserved(authorization.getReferenceType(),authorization.getReferenceId()))cancelled++;
            }
            // A child cancellation can clear the persistence context; reload before further writes.
            target=members.findById(targetId).orElseThrow();em.refresh(target,LockModeType.PESSIMISTIC_WRITE);
            reclaimed=recovery.collectAvailable(enterpriseId,target,actor,"system:lifecycle:"+UUID.randomUUID(),"成员"+(removed?"退出":"停用")+"，回收可用企业积分");
            if(removed)current.findCurrentForUpdate(target.getUserId()).filter(c->targetId.equals(c.getMemberId())).ifPresent(current::delete);
            reclaimed=Math.subtractExact(rootBalance(enterpriseId),rootBefore);
            status=target.getStatus();
        }
        var result=new Result(request.action(),enterpriseId,targetId,reclaimed,cancelled,status);
        var receipt=new EnterpriseLifecycleOperation();receipt.setId(UUID.randomUUID().toString());receipt.setEnterpriseId(enterpriseId);receipt.setActorUserId(actor);
        receipt.setClientRequestId(key);receipt.setFingerprint(requestFingerprint);receipt.setCreatedAt(Instant.now());
        try{receipt.setResultJson(mapper.writeValueAsString(result));}catch(Exception e){throw new IllegalStateException(e);}operations.saveAndFlush(receipt);
        var audit=new EnterpriseAudit();audit.setId(UUID.randomUUID().toString());audit.setEnterpriseId(enterpriseId);audit.setActorUserId(actor);
        audit.setAction("lifecycle."+request.action());audit.setTargetId(targetId==null?enterpriseId:targetId);audit.setSummary("回收可用积分 "+reclaimed+"；取消未提交任务 "+cancelled);audit.setCreatedAt(Instant.now());audits.save(audit);
        return result;
    }
    private State state(String actor,String enterpriseId,String action,String memberId) {
        if(action==null||!Set.of("suspend","resume","remove","leave","close").contains(action))throw bad("成员操作无效");
        var enterprise=lockEnterprise(enterpriseId);EnterpriseMember target=null;
        if("close".equals(action)){access.require(actor,enterpriseId,"ownership.transfer");}
        else if("leave".equals(action)) {
            target=access.readMember(actor,enterpriseId);
            if(actor.equals(enterprise.getOwnerUserId()))throw denied("主账号须先移交或关闭企业后才能退出");
        } else {
            access.require(actor,enterpriseId,"member.manage");
            target=access.requireOrdinaryTarget(actor,enterpriseId,text(memberId,64));
        }
        // Lock all enterprise wallets before authorizations/holds/job rows; the same order is used by workers.
        var wallets=em.createQuery("select w from Wallet w where w.enterpriseId=:id order by w.id",Wallet.class).setParameter("id",enterpriseId)
                .setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();wallets.forEach(w->em.refresh(w,LockModeType.PESSIMISTIC_WRITE));
        var active=authorizations.activeInEnterprise(enterpriseId);active.forEach(a->em.refresh(a,LockModeType.PESSIMISTIC_WRITE));
        if(target!=null){String targetUser=target.getUserId();active=active.stream().filter(a->targetUser.equals(a.getActorUserId())).toList();}
        long available=0,pending=0;var facts=new ArrayList<Object>();
        for(var wallet:wallets)if(target==null||target.getUserId().equals(wallet.getMemberUserId())) {
            available=Math.addExact(available,wallet.getTotalBalance());pending=Math.addExact(pending,wallet.getPendingBalance());
            facts.add(List.of(wallet.getId(),wallet.getTotalBalance(),wallet.getPendingBalance(),wallet.getGiftBalance(),wallet.getLicenseBalance(),wallet.getRechargeBalance()));
        }
        int cancellable=0;for(var authorization:active){if("reserved".equals(authorization.getStatus()))cancellable++;facts.add(List.of(authorization.getId(),authorization.getStatus(),Objects.toString(authorization.getRevokedAt(),"")));}
        List<String> blockers=new ArrayList<>();
        if("resume".equals(action)&&!"suspended".equals(target.getStatus()))blockers.add("此成员并未停用");
        if("suspend".equals(action)&&!"active".equals(target.getStatus()))blockers.add("此成员已停用");
        if("close".equals(action)) {
            if(!active.isEmpty()||pending>0)blockers.add("仍有在途任务或冻结积分，请先完成结算");
            if(available>0)blockers.add("企业仍有可用积分，请先回收并联系平台财务处理余额");
            long orders=em.createQuery("select count(o) from RechargeOrder o where o.enterpriseId=:id and o.status=:state",Long.class).setParameter("id",enterpriseId).setParameter("state",RechargeOrder.Status.PENDING).getSingleResult();
            if(orders>0)blockers.add("仍有待核准充值申请，请联系平台财务核对或驳回");
            facts.add(orders);
        }
        var fingerprint=hash(List.of(actor,enterpriseId,action,enterprise.getOwnerUserId(),enterprise.getVersion(),target==null?"":List.of(target.getId(),target.getStatus(),target.getVersion()),facts));
        return new State(enterprise,target,active,new Preview(action,target==null?null:target.getId(),available,pending,active.size(),cancellable,active.size()-cancellable,blockers.isEmpty(),blockers,fingerprint));
    }
    private boolean cancelReserved(String type,String ref) {
        billing.lockForSettlement(type,ref);
        var authorization=authorizations.lockByReference(type,ref).orElseThrow();em.refresh(authorization,LockModeType.PESSIMISTIC_WRITE);
        if(authorization.getTerminalAt()!=null||!"reserved".equals(authorization.getStatus()))return false;
        boolean cancelled;
        if("material_video_job".equals(type))cancelled=videos.cancelBeforeDispatch(ref);
        else {
            var run=runs.lockById(ref).orElse(null);if(run!=null)em.refresh(run,LockModeType.PESSIMISTIC_WRITE);
            if(run!=null&&"running".equals(run.getStatus())) {
                run.setCancelRequested(true);run.setStatus("failed");run.setStage("cancelled");run.setErrorCode("ENTERPRISE_BILLING_REVOKED");
                run.setErrorMessage("成员已停用或退出，未提交的企业任务已取消");run.setPct(100);run.setFinishedAt(Instant.now());run.setHeartbeatAt(Instant.now());runs.saveAndFlush(run);
            }
            credits.releaseHold(type,ref,"成员关系变更，取消未提交任务");
            billing.complete(type,ref);cancelled=true;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){queue.finish(AiGenerationQueueService.IMAGE,ref);queue.finish(AiGenerationQueueService.WORKFLOW,ref);}});
        }
        if(cancelled) {
            authorization=authorizations.lockByReference(type,ref).orElseThrow();em.refresh(authorization,LockModeType.PESSIMISTIC_WRITE);
            authorization.setStatus("cancelled");authorization.setTerminalAt(Instant.now());authorization.setUpdatedAt(Instant.now());authorizations.saveAndFlush(authorization);
        }
        return cancelled;
    }
    private long rootBalance(String id){return em.createQuery("select w from Wallet w where w.accountKey=:key",Wallet.class).setParameter("key","enterprise:"+id).getSingleResult().getTotalBalance();}
    private Enterprise lockEnterprise(String id){var e=enterprises.lockById(id).orElseThrow(()->BusinessException.notFound("ENTERPRISE_NOT_FOUND","企业不存在"));em.refresh(e,LockModeType.PESSIMISTIC_WRITE);return e;}
    private String hash(Object value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(value)));}catch(Exception e){throw new IllegalStateException(e);}}
    private static String text(String value,int max){if(value==null||value.isBlank()||value.length()>max)throw bad("请填写有效请求或成员信息");return value.trim();}
    private static BusinessException bad(String message){return BusinessException.badRequest("ENTERPRISE_LIFECYCLE_INVALID",message);}
    private static BusinessException conflict(String code,String message){return new BusinessException(HttpStatus.CONFLICT,code,message);}
    private static BusinessException denied(String message){return new BusinessException(HttpStatus.FORBIDDEN,"ENTERPRISE_PERMISSION_DENIED",message);}
    private record State(Enterprise enterprise,EnterpriseMember member,List<EnterpriseBillingAuthorization> active,Preview preview) {}
}
