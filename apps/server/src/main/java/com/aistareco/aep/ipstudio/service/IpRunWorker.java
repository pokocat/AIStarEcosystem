package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.AiModelUsageContext;
import com.aistareco.aep.dap.service.DapImageInput;
import com.aistareco.aep.dap.service.DapMultimodalClient;
import com.aistareco.aep.dap.service.DapMultimodalClient.DapModelException;
import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 异步执行一次运行。
 *
 * <p>计费纪律（{@code DramaReferenceAssetService.generateReferenceSheet} 范式）：
 * <ol>
 *   <li>hold 已由 {@link IpRunService} 在派发前整批冻结；</li>
 *   <li>每张图 **先 {@code commitHold(单价)}、再把候选写进 output** —— 顺序反了就会出现
 *       「commitHold 抛错（内部已释放）但图已入库」的白送；</li>
 *   <li>首张失败即停，剩余额度 {@code releaseHold}；零成功 → failed + 原始 errorCode；</li>
 *   <li>{@code catch (RuntimeException)} 而不是只抓 BusinessException ——
 *       {@code commitHold} 抛的是 {@code ResponseStatusException}，只抓 BusinessException
 *       会跳过释放，把冻结额挂到 CreditHoldSweeper（默认 180 分钟）才回来。</li>
 * </ol>
 *
 * <p>绝不产假产物：拿不到图 / 引擎不支持看图 一律 failed + errorCode（§8.0）。
 */
@Service
public class IpRunWorker {
    @org.springframework.beans.factory.annotation.Autowired
    private com.aistareco.aep.enterprise.service.EnterpriseBillingService enterpriseBilling;

    @org.springframework.beans.factory.annotation.Autowired private StudioRunErrorLog errorLog;

    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.service.AiGenerationQueueService queue;

    @org.springframework.beans.factory.annotation.Autowired private JusuanImageClient jusuanImages;

    private org.springframework.transaction.support.TransactionTemplate billingTransactions;
    @org.springframework.beans.factory.annotation.Autowired
    public void billingTransactions(org.springframework.transaction.PlatformTransactionManager manager) {
        billingTransactions=new org.springframework.transaction.support.TransactionTemplate(manager);
    }
    private void atomic(Runnable action) {
        if(billingTransactions==null)action.run();else billingTransactions.executeWithoutResult(tx->action.run());
    }

    private static final Logger log = LoggerFactory.getLogger(IpRunWorker.class);

    private final IpRunRepository runRepo;
    private final IpProjectService projects;
    private final DapMultimodalClient multimodal;
    private final DapImageInput imageInput;
    private final DapPricingService pricing;
    private final FileStorageService storage;
    private final CreditService credits;
    private final ObjectMapper om;

    public IpRunWorker(IpRunRepository runRepo,
                       IpProjectService projects,
                       DapMultimodalClient multimodal,
                       DapImageInput imageInput,
                       DapPricingService pricing,
                       FileStorageService storage,
                       CreditService credits,
                       ObjectMapper om) {
        this.runRepo = runRepo;
        this.projects = projects;
        this.multimodal = multimodal;
        this.imageInput = imageInput;
        this.pricing = pricing;
        this.storage = storage;
        this.credits = credits;
        this.om = om;
    }

    @Async("ipRunExecutor")
    public void execute(String runId) {
        runBlocking(runId);
    }

    /** 同步入口（测试与 reaper 补跑用；@Async 只是它的包装）。 */
    public void runBlocking(String runId) {runBlocking(runId,false);}

    @Async("ipRunExecutor")
    public void recoverNative(String runId) {
        final boolean[] claimed={false};
        atomic(()->{
            if(enterpriseBilling!=null)enterpriseBilling.lockForSettlement(IpRunService.REF_TYPE,runId);
            var run=runRepo.lockById(runId).orElse(null);
            if(run==null||!canResumeNative(run))return;
            ObjectNode input=(ObjectNode)projects.parseOrEmptyObject(run.getInputJson());
            ObjectNode exec=(ObjectNode)input.path("_exec");
            if(exec.path("nativeLeaseUntil").asLong()>System.currentTimeMillis())return;
            exec.put("nativeLeaseUntil",System.currentTimeMillis()+180_000);
            run.setInputJson(write(input));run.setHeartbeatAt(Instant.now());runRepo.save(run);claimed[0]=true;
        });
        if(claimed[0])runBlocking(runId,true);
    }
    public static boolean hasNativeSubmission(IpRun run) {
        if(run==null||!IpRun.STATUS_RUNNING.equals(run.getStatus()))return false;
        try {
            for(var checkpoint:new ObjectMapper().readTree(run.getInputJson()).path("_exec").path("imageJobs"))
                if(checkpoint.path("submitAttempted").asBoolean())return true;
        }catch(Exception ignored){}
        return false;
    }
    public boolean canResumeNative(IpRun run) {
        if(!hasNativeSubmission(run))return false;
        var input=projects.parseOrEmptyObject(run.getInputJson());
        int completed=projects.parseOrEmptyObject(run.getOutputJson()).path("candidates").size();
        var checkpoint=input.path("_exec").path("imageJobs").path(completed);
        return !checkpoint.path("submitAttempted").asBoolean() || checkpoint.hasNonNull("jobId") || checkpoint.hasNonNull("storageKey");
    }
    private void runBlocking(String runId,boolean recovery) {
        IpRun run = runRepo.findById(runId).orElse(null);
        if (run == null) {
            log.warn("[ipstudio] worker 找不到运行 run={}", runId);
            return;
        }
        if (!IpRun.STATUS_RUNNING.equals(run.getStatus())) return;
        if(queue != null) {
            JsonNode exec=projects.parseOrEmptyObject(run.getInputJson()).path("_exec");
            var purpose=IpRun.KIND_IDENTITY.equals(run.getKind())?com.aistareco.aep.model.AiModelPurpose.DAP_PERSONA:com.aistareco.aep.model.AiModelPurpose.DAP_IMAGE;
            var admission=queue.acquire(com.aistareco.aep.service.AiGenerationQueueService.IMAGE,runId,queue.endpointFor(purpose,exec.path("endpointId").asText(null)),recovery);
            if(admission==com.aistareco.aep.service.AiGenerationQueueService.Admission.WAITING){progress(run,0,"endpoint.queued");return;}
            if(admission==com.aistareco.aep.service.AiGenerationQueueService.Admission.BUSY)return;
            if(!recovery && runRepo.claimUnstarted(runId,Instant.now())!=1) {
                queue.finish(com.aistareco.aep.service.AiGenerationQueueService.IMAGE,runId);return;
            }
        }
        if(run.getStartedAt()==null)run.setStartedAt(Instant.now());
        var context=queue==null?null:queue.bind(com.aistareco.aep.service.AiGenerationQueueService.IMAGE,runId);
        try (var attribution = AiModelUsageContext.bind(run.getOwnerUserId(), "aiavatar", runId)) {
            if(enterpriseBilling!=null && IpRun.KIND_IDENTITY.equals(run.getKind()))enterpriseBilling.requireDispatchAllowed(IpRunService.REF_TYPE,runId,
                    projects.parseOrEmptyObject(run.getInputJson()).path("_exec").path("endpointId").asText(null));
            progress(run, 8, "prompt.compile");
            if (IpRun.KIND_IDENTITY.equals(run.getKind())) {
                runIdentity(run);
            } else {
                runGenerate(run);
            }
        } catch (RuntimeException e) {
            // 兜底：任何漏网异常都要让冻结回去，不能让用户的钱卡在 pending 桶里
            // 带上异常本身（不是 toString）—— 用户报回来的追查号就是 runId，
            // 运维要能顺着它在日志里看到栈，否则「可追查」只是个说法
            log.warn("[ipstudio] 运行异常 run={}", runId, e);
            if(hasNativeSubmission(run)) {
                // A transient checkpoint/settlement failure cannot turn an accepted request into a refund.
                int completed=projects.parseOrEmptyObject(run.getOutputJson()).path("candidates").size();
                boolean known=projects.parseOrEmptyObject(run.getInputJson()).path("_exec").path("imageJobs").path(completed).hasNonNull("jobId");
                try{pending(run,new JusuanImageClient.Pending(known,e));}
                catch(RuntimeException checkpointFailure){log.warn("[ipstudio] 原图片任务状态写入失败，保留原冻结 run={}",runId,checkpointFailure);}
            } else failWithoutSpend(run, codeOf(e), friendly(e, run.getId()), e);
        } finally {
            if(context!=null)context.close();
            if(queue!=null && runRepo.findById(runId).filter(r->IpRun.STATUS_RUNNING.equals(r.getStatus())).isEmpty())
                queue.finish(com.aistareco.aep.service.AiGenerationQueueService.IMAGE,runId);
        }
    }

    // ── identity：带图 chat 抽取人物特征卡 ────────────────────

    private void runIdentity(IpRun run) {
        JsonNode inputs = projects.parseOrEmptyObject(run.getInputJson());
        JsonNode exec = inputs.path("_exec");
        String sourceKey = exec.path("sourceKey").asText(null);
        long unit = unitCostOf(exec, pricing.ipIdentity());

        if (isCancelRequested(run)) {

            failWithoutSpend(run, "IP_RUN_CANCELLED", "已取消");
            return;
        }

        progress(run, 20, "identity.extract");
        String image = sourceKey == null ? null : imageInput.of(sourceKey);
        if (image == null) {

            failWithoutSpend(run, "IP_NODE_INPUT_MISSING", "读取不到照片，请重新上传后再抽取");
            return;
        }

        JsonNode parsed;
        try {
            parsed = multimodal.chatJsonWithImages(
                    exec.path("system").asText(""), exec.path("user").asText(""), List.of(image));
        } catch (RuntimeException e) {

            failWithoutSpend(run, "IP_IDENTITY_EXTRACT_FAILED",
                    "看图抽取特征卡失败：当前形象引擎可能不支持图片输入。"
                            + "请在后台给「数字人 · 人设」用途绑定支持看图的模型，或手动填写特征卡", e);
            return;
        }

        String text = textOf(parsed, "text");
        String promptEn = textOf(parsed, "promptEn");
        if (text == null && promptEn == null) {

            failWithoutSpend(run, "IP_IDENTITY_EXTRACT_FAILED", "抽取结果为空，请重试或手动填写特征卡");
            return;
        }

        // 模型已经算完了才发现用户点了取消：这时候还没扣款，就别扣了，整笔退回
        if (isCancelRequested(run)) {

            failWithoutSpend(run, "IP_RUN_CANCELLED", "已取消");
            return;
        }

        // 先扣款，再落产物（顺序见类注释）；单价只认 hold 时的快照
        atomic(()->{
            if(enterpriseBilling!=null)enterpriseBilling.lockForSettlement(IpRunService.REF_TYPE,run.getId());
            if (unit > 0) credits.commitHold(IpRunService.REF_TYPE,run.getId(),unit,"IP 人物特征卡抽取", null);
            ObjectNode out=om.createObjectNode();
            if(text!=null)out.put("text",text);if(promptEn!=null)out.put("promptEn",promptEn);
            run.setOutputJson(write(out));run.setCost(unit);finishAtomically(run);
        });
    }

    // ── generate：逐张出图 ───────────────────────────────────

    private void runGenerate(IpRun run) {
        JsonNode inputs = projects.parseOrEmptyObject(run.getInputJson());
        JsonNode exec = inputs.path("_exec");
        String prompt = inputs.path("prompt").asText("");
        String size = inputs.path("size").asText("768x1024");
        int count = Math.max(1, inputs.path("count").asInt(1));
        long unit = unitCostOf(exec, pricing.ipImage());

        // 参考图必须在第一次出图**之前**全部物化。
        // 以前是边循环边 of(key)、读不到就静默丢掉：主图 / 原照片读不到时，
        // inputs.refs 里已经写着 applied=true，用户界面显示「身份已锁定」，
        // 实际却按纯文生图出了一张不像自己的脸，还照价扣满。
        JsonNode priorCandidates=projects.parseOrEmptyObject(run.getOutputJson()).path("candidates");
        ArrayNode candidates=priorCandidates.isArray()?priorCandidates.deepCopy():om.createArrayNode();
        int committed=candidates.size();
        boolean acceptedCurrent=exec.path("imageJobs").path(committed).path("submitAttempted").asBoolean();
        List<String> refs;
        try {
            refs = acceptedCurrent?List.of():materializeRefs(run, inputs, exec);
        } catch (UnreadableIdentityRefException e) {

            run.setCost(unit*committed);
            fail(run,"IP_REF_UNREADABLE",e.getMessage(),e);
            return;
        }


        RuntimeException lastErr = null;
        boolean cancelled = false;

        for (int i=committed;i<count;i++) {
            JsonNode checkpoint=projects.parseOrEmptyObject(run.getInputJson()).path("_exec").path("imageJobs").path(i);
            if(isCancelRequested(run) && !checkpoint.path("submitAttempted").asBoolean()) {cancelled=true;break;}
            progress(run, 10 + (int) Math.round(80.0 * i / count), "image.generate." + (i + 1));
            String previousOutput=run.getOutputJson();
            long previousCost=unit*committed;
            try {
                // 用户在画布上选的模型 —— 不传下去就等于「选了没用」：
                // 界面按那个模型标价、也按它扣了钱，实际却跑的默认端点。
                String endpointId=IpDocs.text(exec,"endpointId");
                final int current=i;
                byte[] bytes;
                boolean nativeImage=checkpoint.path("submitAttempted").asBoolean() || jusuanImages!=null && jusuanImages.supportsEndpoint(endpointId);
                if(checkpoint.hasNonNull("storageKey")) {
                    try{bytes=java.nio.file.Files.readAllBytes(storage.openForRead(checkpoint.path("storageKey").asText()));}
                    catch(java.io.IOException error){
                        ObjectNode missing=checkpoint.deepCopy();missing.remove("storageKey");nativeCheckpoint(run,i,missing);
                        throw new JusuanImageClient.Pending(true,error);
                    }
                } else if(nativeImage) {
                    List<String> keys=new ArrayList<>();
                    for(JsonNode ref:exec.path("refKeys")) {
                        int index=ref.path("refIndex").asInt(-1);
                        if(index>=0 && !inputs.path("refs").path(index).path("applied").asBoolean(true))continue;
                        String key=ref.isTextual()?ref.asText():ref.path("key").asText(null);
                        if(key!=null)keys.add(key);
                    }
                    var imageSpec=exec.hasNonNull("imageRequestSpec")
                            ? com.aistareco.aep.model.AiImageRequestSpec.read(exec.path("imageRequestSpec").toString()):null;
                    bytes=jusuanImages.generate(endpointId,inputs.path("userPrompt").asText(prompt),size,keys,run.getId()+"-image-"+i,run.getOwnerUserId(),stage->progress(run,10+(int)Math.round(80.0*current/count),stage),imageSpec,
                            exec.path("providerModel").asText(null),
                            checkpoint,state->nativeCheckpoint(run,current,state));
                } else {
                    if(enterpriseBilling!=null)enterpriseBilling.requireDispatchAllowed(IpRunService.REF_TYPE,run.getId(),endpointId);
                    credits.markModelDispatched(IpRunService.REF_TYPE,run.getId());
                    bytes=multimodal.generateImage(prompt,size,refs.isEmpty()?null:refs,endpointId,"studio");
                }
                requireDecodableImage(bytes);
                progress(run, 10 + (int) Math.round(80.0 * (i + 1) / count), "storage.persist");
                String storedKey;
                if(checkpoint.hasNonNull("storageKey"))storedKey=checkpoint.path("storageKey").asText();
                else {
                    storedKey=storage.store(bytes,IpProjectService.CATEGORY_GEN,run.getOwnerUserId(),"png","image/png").key();
                    if(nativeImage) {
                        JsonNode existing=projects.parseOrEmptyObject(run.getInputJson()).path("_exec").path("imageJobs").path(i);
                        ObjectNode mirrored=existing.isObject()?existing.deepCopy():om.createObjectNode();
                        mirrored.put("storageKey",storedKey);nativeCheckpoint(run,i,mirrored);
                    }
                }
                final String candidateKey=storedKey;
                final int candidateNo=i+1;
                atomic(()->{
                if(enterpriseBilling!=null)enterpriseBilling.lockForSettlement(IpRunService.REF_TYPE,run.getId());
                if(unit>0)credits.commitHold(IpRunService.REF_TYPE,run.getId(),unit,"IP 形象出图 · 第 "+candidateNo+" 张",
                        new com.aistareco.aep.billing.service.ModelBillingMath.Usage(java.math.BigDecimal.valueOf(candidateNo),null));
                // commit 成功之后才承认这张图。
                // 带上宽高：画布拿它算节点尺寸 —— 不给的话只能按上限铺成正方形，
                // 竖图会被撑成方框（「框很大图很小」）。文件头里就有，不用整图解码。
                var cand = candidates.addObject().put("key",candidateKey);
                int[] wh = IpProjectService.readDimensions(bytes);
                if (wh != null) cand.put("width", wh[0]).put("height", wh[1]);
                ObjectNode partial = om.createObjectNode();
                partial.set("candidates", candidates.deepCopy());
                run.setOutputJson(write(partial));
                run.setCost(unit*candidateNo);
                runRepo.save(run);
                // The last spend can close the hold/auth; persist the job terminal in that same transaction.
                if(candidateNo==count)finishAtomically(run);
                });
                committed++;
            } catch(JusuanImageClient.Pending pending) {pending(run,pending);return;}
            catch (RuntimeException e) {
                JsonNode accepted=projects.parseOrEmptyObject(run.getInputJson()).path("_exec").path("imageJobs").path(i);
                if(accepted.path("submitAttempted").asBoolean() && !(e instanceof JusuanImageClient.ProviderRejected)) {
                    while(candidates.size()>committed)candidates.remove(candidates.size()-1);
                    run.setOutputJson(previousOutput);run.setCost(previousCost);
                    pending(run,new JusuanImageClient.Pending(accepted.hasNonNull("jobId"),e));return;
                }
                while(candidates.size()>committed)candidates.remove(candidates.size()-1);
                run.setOutputJson(previousOutput);run.setCost(previousCost);
                lastErr = e;
                break;
            }
        }

        if(committed==count) {if(IpRun.STATUS_RUNNING.equals(run.getStatus()))finish(run);return;}

        // Terminal settlement atomically releases the unspent portion of this reservation.
        run.setCost(unit * committed);
        if (committed == 0) {
            if (cancelled) {
                fail(run, "IP_RUN_CANCELLED", "已取消");
            } else {
                log.warn("[ipstudio] 出图全部失败 run={}", run.getId(), lastErr);
                fail(run, codeOf(lastErr), friendly(lastErr, run.getId()), lastErr);
            }
            return;
        }
        ObjectNode out = om.createObjectNode();
        out.set("candidates", candidates);
        run.setOutputJson(write(out));
        if (cancelled) {
            // 已出的图归用户，但这次运行不是完整的 —— 如实标成失败态并说明原因
            fail(run, "IP_RUN_CANCELLED", "已取消（已生成的 " + committed + " 张仍可使用）");
        } else if (lastErr != null) {
            fail(run, codeOf(lastErr), friendly(lastErr, run.getId()) + "（已生成 " + committed + " 张）", lastErr);
        } else {
            finish(run);
        }
    }

    private void nativeCheckpoint(IpRun run,int index,ObjectNode state) {
        atomic(()->{
            if(enterpriseBilling!=null) {
                enterpriseBilling.lockForSettlement(IpRunService.REF_TYPE,run.getId());
                var before=projects.parseOrEmptyObject(run.getInputJson()).path("_exec");
                if(state.path("submitAttempted").asBoolean()&&!before.path("imageJobs").path(index).path("submitAttempted").asBoolean())
                    enterpriseBilling.requireDispatchAllowed(IpRunService.REF_TYPE,run.getId(),before.path("endpointId").asText(null));
            }
            // Acquire wallet/hold before the job row, matching settlement and enterprise cancellation.
            if(state.path("submitAttempted").asBoolean())credits.markModelDispatched(IpRunService.REF_TYPE,run.getId());
            var fresh=runRepo.lockById(run.getId()).orElseThrow();
            if(!IpRun.STATUS_RUNNING.equals(fresh.getStatus()))throw new IllegalStateException("Image run is terminal");
            if(fresh.isCancelRequested()&&!hasNativeSubmission(fresh))throw com.aistareco.common.BusinessException.badRequest("IP_RUN_CANCELLED","已停止生成");
            ObjectNode input=(ObjectNode)projects.parseOrEmptyObject(fresh.getInputJson());
            ObjectNode exec=(ObjectNode)input.path("_exec");ArrayNode jobs=exec.withArray("imageJobs");
            while(jobs.size()<=index)jobs.addNull();jobs.set(index,state.deepCopy());
            exec.put("nativeLeaseUntil",System.currentTimeMillis()+180_000);
            fresh.setInputJson(write(input));fresh.setHeartbeatAt(Instant.now());runRepo.save(fresh);
            run.setInputJson(fresh.getInputJson());
        });
    }
    /** Close missing receipts, including a crash before pending() could persist its error code. */
    public void failUnconfirmedSubmission(String runId) {
        atomic(() -> {
            if(enterpriseBilling!=null)enterpriseBilling.lockForSettlement(IpRunService.REF_TYPE,runId);
            var run=runRepo.lockById(runId).orElse(null);
            if(run==null || !IpRun.KIND_GENERATE.equals(run.getKind()) || !IpRun.STATUS_RUNNING.equals(run.getStatus()))return;
            var exec=projects.parseOrEmptyObject(run.getInputJson()).path("_exec");
            int completed=projects.parseOrEmptyObject(run.getOutputJson()).path("candidates").size();
            var item=exec.path("imageJobs").path(completed);
            if(exec.path("nativeLeaseUntil").asLong()>System.currentTimeMillis() || !item.path("jobId").asText().isBlank() || !item.path("storageKey").asText().isBlank())return;
            if(!"STUDIO_IMAGE_SUBMISSION_UNKNOWN".equals(run.getErrorCode())) {
                if(!item.path("submitAttempted").asBoolean())return;
                // The old checkpoint lease is only 3 minutes; synchronous images can wait much longer.
                // A missing error code does not prove the original HTTP worker has stopped. Respect its
                // saved request timeout plus a minute for response processing before closing an orphan.
                long timeoutMillis;
                try {
                    var spec=om.readTree(item.path("imageRequestSpec").asText("{}"));
                    timeoutMillis=spec.path("wire").path("requestTimeoutMillis").asLong(900_000L);
                } catch(Exception invalidSnapshot) {return;}
                var lastProgress=run.getHeartbeatAt()!=null?run.getHeartbeatAt():run.getStartedAt()!=null?run.getStartedAt():run.getCreatedAt();
                if(lastProgress==null || !lastProgress.plusMillis(Math.max(180_000L,timeoutMillis+60_000L)).isBefore(Instant.now()))return;
            }
            run.setCost(unitCostOf(exec,pricing.ipImage())*completed);
            failAtomically(run,"STUDIO_IMAGE_SUBMISSION_UNKNOWN",com.aistareco.aep.service.GenerationSubmissionFailure.MESSAGE,
                    com.aistareco.aep.service.GenerationSubmissionFailure.settled(!"STUDIO_IMAGE_SUBMISSION_UNKNOWN".equals(run.getErrorCode())
                            ?"图片请求已发出，但等结果的过程被中断（通常是服务重启），没有拿到图片或任务号"
                            :"图片请求没有拿到受理结果",run.getErrorMessage(),null));
        });
    }
    private void pending(IpRun run,JusuanImageClient.Pending pending) {
        if("STUDIO_IMAGE_SUBMISSION_UNKNOWN".equals(pending.code())) {
            var exec=projects.parseOrEmptyObject(run.getInputJson()).path("_exec");
            int completed=projects.parseOrEmptyObject(run.getOutputJson()).path("candidates").size();
            run.setCost(unitCostOf(exec,pricing.ipImage())*completed);
            // The alert describes this failed-and-refunded task, not the in-flight Pending wording.
            fail(run,pending.code(),com.aistareco.aep.service.GenerationSubmissionFailure.message(pending.getCause()),
                    com.aistareco.aep.service.GenerationSubmissionFailure.settled("图片请求没有拿到受理结果",null,pending.getCause()));
            return;
        }
        atomic(()->{
            if(enterpriseBilling!=null)enterpriseBilling.lockForSettlement(IpRunService.REF_TYPE,run.getId());
            var fresh=runRepo.lockById(run.getId()).orElseThrow();if(!IpRun.STATUS_RUNNING.equals(fresh.getStatus()))return;
            ObjectNode input=(ObjectNode)projects.parseOrEmptyObject(fresh.getInputJson());
            ((ObjectNode)input.path("_exec")).put("nativeLeaseUntil",0);
            fresh.setInputJson(write(input));fresh.setStage("image.provider.recovering");fresh.setErrorCode(pending.code());fresh.setErrorMessage(pending.getMessage());
            fresh.setHeartbeatAt(Instant.now());runRepo.save(fresh);run.setInputJson(fresh.getInputJson());
        });
    }

    // ── 参考图物化 ────────────────────────────────────────────

    /** 身份锚（主形象图 / 原照片）读不到 —— 这一单必须失败退款，不许降级成文生图。 */
    private static final class UnreadableIdentityRefException extends RuntimeException {
        UnreadableIdentityRefException(String message) { super(message); }
    }

    /**
     * 把 {@code _exec.refKeys} 变成模型可消费的图片输入。
     *
     * <ul>
     *   <li>{@code master} / {@code source} 读不到 → 抛 {@link UnreadableIdentityRefException}，
     *       调用方退款并以 {@code IP_REF_UNREADABLE} 失败（少一张身份锚出来的就不是同一个人）；</li>
     *   <li>可选的 {@code reference} 读不到 → 把库里那一条改成 {@code applied=false, reason=unreadable}
     *       后继续 —— 界面必须看得见「这张局部参考没生效」，不能嘴上 applied=true 手上没带。</li>
     * </ul>
     */
    private List<String> materializeRefs(IpRun run, JsonNode inputs, JsonNode exec) {
        List<String> out = new ArrayList<>();
        JsonNode refKeys = exec.path("refKeys");
        if (!refKeys.isArray()) return out;
        boolean changed = false;
        for (JsonNode entry : refKeys) {
            // 老结构（纯字符串数组）按可选参考处理：没有 role 就不该拿它当身份锚硬失败
            String key = entry.isTextual() ? entry.asText(null) : entry.path("key").asText(null);
            String role = entry.isTextual() ? "reference" : entry.path("role").asText("reference");
            int refIndex = entry.isTextual() ? -1 : entry.path("refIndex").asInt(-1);
            String in = key == null ? null : imageInput.of(key);
            if (in != null) {
                out.add(in);
                continue;
            }
            if ("master".equals(role) || "source".equals(role)) {
                throw new UnreadableIdentityRefException("master".equals(role)
                        ? "读取不到主形象图，无法锁定同一个人的样貌；已退回冻结积分，请重新生成主形象并选图"
                        : "读取不到原照片，无法锁定同一个人的样貌；已退回冻结积分，请重新上传照片");
            }
            changed |= markRefUnapplied(inputs, refIndex, role);
        }
        if (changed) {
            run.setInputJson(write(inputs));
            runRepo.save(run);
        }
        return out;
    }

    /** 把 inputs.refs[refIndex] 标成未生效；refIndex 缺失时退化为按 role 找第一条 applied=true 的。 */
    private boolean markRefUnapplied(JsonNode inputs, int refIndex, String role) {
        JsonNode arr = inputs.path("refs");
        if (!arr.isArray()) return false;
        ObjectNode target = null;
        if (refIndex >= 0 && refIndex < arr.size() && arr.get(refIndex).isObject()) {
            target = (ObjectNode) arr.get(refIndex);
        } else {
            for (JsonNode n : arr) {
                if (n.isObject() && role.equals(n.path("role").asText(null))
                        && n.path("applied").asBoolean(false)) {
                    target = (ObjectNode) n;
                    break;
                }
            }
        }
        if (target == null) return false;
        target.put("applied", false);
        target.put("reason", "unreadable");
        return true;
    }

    // ── 产物校验 ──────────────────────────────────────────────

    /**
     * 上游回的字节必须真是一张能解码的图。
     *
     * <p>不校验的话，一段错误 JSON / HTML / 空响应体也会被 {@code store} 原样落进 OSS 并照价扣款，
     * 用户拿到的是一个点不开的「候选图」。WebP 单独按魔术字放行（JDK ImageIO 不带 WebP 解码器）。
     */
    static void requireDecodableImage(byte[] bytes) {
        if (!looksLikeImage(bytes)) {
            throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "上游返回的内容不是可用图片");
        }
    }

    static boolean looksLikeImage(byte[] b) {
        if (b == null || b.length < 12) return false;
        // 与上传同一套「只读文件头」判定（IpProjectService.readDimensions）：既确认是真图片，
        // 又不为了校验去整图解码一遍（上游同样可能回一张声明 50000×50000 的 PNG）
        if (IpProjectService.readDimensions(b) != null) return true;
        // RIFF....WEBP —— JDK 没有 WebP 读取器，按魔术字放行（我们自己不生产 WebP，纯兜底）
        return b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
    }

    /** hold 时写进 _exec 的单价快照；老行（无快照）回落当前后台单价。 */
    private static long unitCostOf(JsonNode exec, long fallback) {
        JsonNode v = exec.path("unitCost");
        return v.isNumber() && v.asLong() >= 0 ? v.asLong() : fallback;
    }

    // ── 状态写入 ──────────────────────────────────────────────

    /**
     * 派发失败（线程池排满）的收尾：置 failed + 释放冻结。
     *
     * <p>{@code REQUIRES_NEW}：调用方在 {@code afterCommit} 里，那时原事务已经提交、
     * 当前线程没有可用事务，不新开一个就写不进去。
     */
    @org.springframework.transaction.annotation.Transactional(
            propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void abandon(String runId, String code, String message) {
        IpRun run = runRepo.findById(runId).orElse(null);
        if (run == null || !IpRun.STATUS_RUNNING.equals(run.getStatus())) return;

        failWithoutSpend(run, code, message);
    }

    /** Reaper uses the same locked terminal transaction as normal completion. */
    public boolean expire(String runId,Instant cutoff) {
        final boolean[] expired={false};
        atomic(()->{
            if(enterpriseBilling!=null)enterpriseBilling.lockForSettlement(IpRunService.REF_TYPE,runId);
            var run=runRepo.lockById(runId).orElse(null);
            if(run==null || hasNativeSubmission(run) || !IpRun.STATUS_RUNNING.equals(run.getStatus()) || run.getHeartbeatAt()==null || !run.getHeartbeatAt().isBefore(cutoff))return;
            var input=projects.parseOrEmptyObject(run.getInputJson()).path("_exec");
            run.setCost(projects.parseOrEmptyObject(run.getOutputJson()).path("candidates").size()*input.path("unitCost").asLong());
            failAtomically(run,"IP_RUN_TIMEOUT","生成超时，未产生结果，已退回冻结积分，请重试",null);
            expired[0]=true;
        });
        return expired[0];
    }

    private boolean isCancelRequested(IpRun run) {
        IpRun fresh = runRepo.findById(run.getId()).orElse(null);
        return fresh != null && fresh.isCancelRequested();
    }

    private void progress(IpRun run, int pct, String stage) {
        run.setPct(Math.min(99, Math.max(0, pct)));
        run.setStage(stage);
        run.setHeartbeatAt(Instant.now());
        // Queue cancellation owns status/cancelRequested; progress must never overwrite those fields.
        runRepo.updateProgressIfRunning(run.getId(),run.getPct(),stage,run.getHeartbeatAt(),run.getStartedAt());
        if(hasNativeSubmission(run))atomic(()->{
            if(enterpriseBilling!=null)enterpriseBilling.lockForSettlement(IpRunService.REF_TYPE,run.getId());
            var fresh=runRepo.lockById(run.getId()).orElseThrow();if(!IpRun.STATUS_RUNNING.equals(fresh.getStatus()))return;
            ObjectNode input=(ObjectNode)projects.parseOrEmptyObject(fresh.getInputJson());
            ((ObjectNode)input.path("_exec")).put("nativeLeaseUntil",System.currentTimeMillis()+180_000);
            fresh.setInputJson(write(input));runRepo.save(fresh);run.setInputJson(fresh.getInputJson());
        });
        if(queue!=null)queue.touch(com.aistareco.aep.service.AiGenerationQueueService.IMAGE,run.getId());
    }

    private void finish(IpRun run) {atomic(()->finishAtomically(run));}
    private void finishAtomically(IpRun run) {
        if(enterpriseBilling!=null)enterpriseBilling.lockForSettlement(IpRunService.REF_TYPE,run.getId());
        if(billingTransactions!=null && runRepo.lockById(run.getId()).filter(r->IpRun.STATUS_RUNNING.equals(r.getStatus())).isEmpty())return;
        releaseRemainder(run,"IP 运行完成 · 释放剩余冻结");
        run.setStatus(IpRun.STATUS_DONE);
        run.setStage("done");
        run.setPct(100);
        run.setErrorCode(null);
        run.setErrorMessage(null);
        run.setHeartbeatAt(Instant.now());
        run.setFinishedAt(Instant.now());
        runRepo.save(run);
        if(enterpriseBilling!=null)enterpriseBilling.complete(IpRunService.REF_TYPE,run.getId());
        log.info("[ipstudio] 运行完成 run={} kind={} cost={}", run.getId(), run.getKind(), run.getCost());
    }

    /** 一次都没 commit 就失败：{@code cost} 必须归零 —— 建行时写的是冻结额，失败后留着就是虚报花费。 */
    private void failWithoutSpend(IpRun run, String code, String message, Throwable cause) {
        run.setCost(0);
        fail(run, code, message, cause);
    }

    private void failWithoutSpend(IpRun run, String code, String message) {
        run.setCost(0);
        fail(run, code, message);
    }

    private void fail(IpRun run, String code, String message) { fail(run, code, message, null); }

    private void fail(IpRun run, String code, String message, Throwable cause) {atomic(()->failAtomically(run,code,message,cause));}
    private void failAtomically(IpRun run,String code,String message,Throwable cause) {
        if(enterpriseBilling!=null)enterpriseBilling.lockForSettlement(IpRunService.REF_TYPE,run.getId());
        if(billingTransactions!=null && runRepo.lockById(run.getId()).filter(r->IpRun.STATUS_RUNNING.equals(r.getStatus())).isEmpty())return;
        releaseRemainder(run,"IP 运行失败或取消 · 释放剩余冻结");
        run.setStatus(IpRun.STATUS_FAILED);
        run.setStage("failed");
        run.setErrorCode(code);
        run.setErrorMessage(message);
        if (errorLog != null) errorLog.attach(run, cause);
        run.setHeartbeatAt(Instant.now());
        run.setFinishedAt(Instant.now());
        runRepo.save(run);
        if(enterpriseBilling!=null)enterpriseBilling.complete(IpRunService.REF_TYPE,run.getId());
        log.warn("[ipstudio] 运行失败 run={} kind={} code={} msg={}", run.getId(), run.getKind(), code, message);
    }

    private void releaseRemainder(IpRun run,String reason) {
        var exec=projects.parseOrEmptyObject(run.getInputJson()).path("_exec");
        long held=exec.path("holdTotal").asLong(run.getCost());
        if(!exec.has("holdTotal")||held>run.getCost())credits.releaseHold(IpRunService.REF_TYPE,run.getId(),reason);
    }

    private static String codeOf(RuntimeException e) {
        if (e instanceof DapModelException dme) return dme.getCode();
        if (e instanceof com.aistareco.common.BusinessException be) return be.getCode();
        return "IP_IMAGE_FAILED";
    }

    /**
     * 给用户看的失败原因。
     *
     * <p>v0.162 之前：只要异常不是 {@code DapModelException} / {@code BusinessException}，
     * 一律显示「生成失败，请稍后重试」。厂商超时、网络中断、HTTP 5xx、镜像失败全被抹成这一句 ——
     * 用户看不出该重试、该换模型、还是该找运维，我们自己也无从判断（用户复述不出任何信息）。
     *
     * <p>友好信息与追查号分开：结构化 output.logId 指向真实 ErrorLog，runId 只作为任务号。
     * 未知异常不向客户端直出内部响应体；原异常和供应商细节由 StudioRunErrorLog 保留。
     */
    private static String friendly(RuntimeException e, String runId) {
        if (e == null) return "生成失败，请稍后重试";
        if (e instanceof DapModelException || e instanceof com.aistareco.common.BusinessException) {
            String m = e.getMessage();
            if (m != null && !m.isBlank()) return m;
        }
        return "生成失败（" + e.getClass().getSimpleName() + "），请稍后重试";
    }

    private static String textOf(JsonNode n, String field) {
        if (n == null) return null;
        JsonNode v = n.path(field);
        if (!v.isTextual()) return null;
        String s = v.asText().trim();
        return s.isEmpty() ? null : s;
    }

    private String write(JsonNode n) {
        try {
            return om.writeValueAsString(n);
        } catch (Exception e) {
            return "{}";
        }
    }
}
