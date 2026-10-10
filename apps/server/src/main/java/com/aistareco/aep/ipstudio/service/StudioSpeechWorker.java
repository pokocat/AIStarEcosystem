package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.*;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;

/** Audio and lip-sync share one leased IpRun lifecycle. Accepted jobs only poll after restart. */
@Service
public class StudioSpeechWorker {
    @org.springframework.beans.factory.annotation.Autowired private AiGenerationQueueService queue;
    private static final Logger log=LoggerFactory.getLogger(StudioSpeechWorker.class);
    private final IpRunRepository runs; private final AiModelEndpointRepository endpoints;
    @org.springframework.beans.factory.annotation.Autowired private JusuanLipSyncClient lips;
    @org.springframework.beans.factory.annotation.Autowired private com.aistareco.aep.dap.service.DapAssetService assets;
    private final JusuanSpeechClient client; private final FileStorageService storage; private final CreditService credits;
    private final AiModelUsageService usage; private final ObjectMapper mapper; private final TransactionTemplate tx;
    public StudioSpeechWorker(IpRunRepository runs,AiModelEndpointRepository endpoints,JusuanSpeechClient client,
            FileStorageService storage,CreditService credits,AiModelUsageService usage,ObjectMapper mapper,PlatformTransactionManager manager) {
        this.runs=runs;this.endpoints=endpoints;this.client=client;this.storage=storage;this.credits=credits;this.usage=usage;this.mapper=mapper;
        tx=new TransactionTemplate(manager);tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    @Async public void execute(String id){step(id);}
    @Scheduled(fixedDelay=15_000,initialDelay=15_000)
    public void resume(){for(String kind:java.util.List.of("studio-audio","studio-lip-sync"))for(var run:runs.findByKindAndStatus(kind,IpRun.STATUS_RUNNING))step(run.getId());}
    public static boolean manages(String kind){return "studio-audio".equals(kind)||"studio-lip-sync".equals(kind);}
    public void step(String id) {
        IpRun run=tx.execute(status->{
            var r=runs.lockById(id).orElse(null);
            if(r==null||!manages(r.getKind())||!IpRun.STATUS_RUNNING.equals(r.getStatus()))return null;
            ObjectNode input=read(r.getInputJson());var exec=(ObjectNode)input.path("_exec");
            if(exec.path("leaseUntil").asLong()>System.currentTimeMillis())return null;
            if(r.isCancelRequested()&&exec.path("submitAttempts").asInt()==0){terminal(r,null,"IP_RUN_CANCELLED","已停止生成");return null;}
            exec.put("leaseUntil",System.currentTimeMillis()+150_000);r.setInputJson(write(input));
            if(r.getStartedAt()==null)r.setStartedAt(Instant.now());r.setHeartbeatAt(Instant.now());runs.save(r);return r;
        });
        if(run==null)return;
        boolean lip="studio-lip-sync".equals(run.getKind());String prefix=lip?"lip-sync":"audio",label=lip?"口型":"配音";
        AiGenerationQueueService.Scope admissionScope=null;
        try {
            ObjectNode input=read(run.getInputJson());var exec=(ObjectNode)input.path("_exec");
            var endpoint=endpoints.findById(exec.path("endpointId").asText()).orElseThrow();
            if(queue!=null) {
                var admission=queue.acquire(AiGenerationQueueService.SPEECH,id,endpoint.getId(),true);
                if(admission!=AiGenerationQueueService.Admission.READY){update(id,e->e.put("leaseUntil",0),"endpoint.queued",0,null,null);return;}
                // Nested provider HTTP uses this already-owned slot instead of acquiring another.
                admissionScope=queue.bind(AiGenerationQueueService.SPEECH,id);
            }
            String base=exec.path("baseUrl").asText();
            if(!read(run.getOutputJson()).path("storageKey").asText().isBlank()){finish(id,read(run.getOutputJson()),null,null);return;}
            // Each upload is separately checkpointed. A restart never changes accepted generation bytes.
            if(lip&&exec.path("jobId").asText().isBlank()&&exec.path("submitAttempts").asInt()==0) {
                if(exec.path("videoAssetId").asText().isBlank()) {
                    String asset=lips.upload(endpoint,base,storage.openForRead(input.path("videoStorageKey").asText()),"video",id,run.getOwnerUserId());
                    update(id,e->e.put("videoAssetId",asset).put("leaseUntil",0),"lip-sync.uploading",5,null,null);return;
                }
                if(exec.path("audioAssetId").asText().isBlank()) {
                    String asset=lips.upload(endpoint,base,storage.openForRead(input.path("audioStorageKey").asText()),"audio",id,run.getOwnerUserId());
                    update(id,e->e.put("audioAssetId",asset).put("leaseUntil",0),"lip-sync.uploading",8,null,null);return;
                }
                if(exec.path("requestBody").asText().isBlank()) {
                    String body=write(mapper.createObjectNode().put("model","x-dub").put("input_video_asset_id",exec.path("videoAssetId").asText()).put("input_audio_asset_id",exec.path("audioAssetId").asText()));
                    update(id,e->e.put("requestBody",body).put("leaseUntil",0),"lip-sync.prepared",10,null,null);return;
                }
            }
            if(exec.path("jobId").asText().isBlank()) {
                int attempts=exec.path("submitAttempts").asInt();long first=exec.path("firstSubmitAt").asLong(System.currentTimeMillis());
                // The live service declares Idempotency-Key. Bound retries retain identical bytes and key;
                // after this short recovery window require reconciliation, never create a fresh request.
                if(attempts>=3 || attempts>0&&System.currentTimeMillis()-first>120_000) {
                    update(id,e->e.put("leaseUntil",0),prefix+".submission_unknown",5,lip?"STUDIO_LIP_SYNC_SUBMISSION_UNKNOWN":"STUDIO_SPEECH_SUBMISSION_UNKNOWN",label+"受理结果尚未确认，请联系运营核对原请求；请勿重新生成");return;
                }
                exec.put("submitAttempts",attempts+1).put("firstSubmitAt",first);
                update(id,e->{e.put("submitAttempts",attempts+1).put("firstSubmitAt",first);},prefix+".submitting",10,null,null);
                var job=lip?lips.submit(endpoint,base,exec.path("requestBody").asText(),id,run.getOwnerUserId()):client.submit(endpoint,base,exec.path("requestBody").asText(),id,run.getOwnerUserId());
                update(id,e->e.put("jobId",job.jobId()).put("jobUrl",job.jobUrl()).put("leaseUntil",0),prefix+".queued",15,null,null);return;
            }
            JsonNode result=lip?lips.poll(endpoint,base,exec.path("jobUrl").asText(),id,run.getOwnerUserId()):client.poll(endpoint,base,exec.path("jobUrl").asText(),id,run.getOwnerUserId());
            String state=result.path("status").asText();
            if("failed".equals(state)||"canceled".equals(state)) {
                finish(id,null,lip?"STUDIO_LIP_SYNC_PROVIDER_FAILED":"STUDIO_SPEECH_PROVIDER_FAILED",label+"引擎未完成本次生成，冻结积分已释放");return;
            }
            if(!"succeeded".equals(state)){update(id,e->e.put("leaseUntil",0),prefix+"."+("running".equals(state)?"running":"queued"),"running".equals(state)?45:15,null,null);return;}
            String contentUrl=result.path("outputs").path(0).path("contentUrl").asText();
            if(contentUrl.isBlank())throw new IllegalStateException("Missing media contentUrl");
            update(id,e->{},prefix+".saving",80,null,null);
            ObjectNode output;double duration;
            if(lip) {
                var video=lips.download(endpoint,base,contentUrl,id);duration=video.durationSec();
                if(Math.abs(duration-exec.path("audioDurationSec").asDouble())>0.4)throw new IllegalStateException("Lip-sync duration mismatch");
                var stored=storage.store(video.bytes(),IpProjectService.CATEGORY_GEN,run.getOwnerUserId(),"mp4","video/mp4");
                output=mapper.createObjectNode().put("storageKey",stored.key()).put("mimeType","video/mp4").put("durationSec",duration)
                        .put("width",video.width()).put("height",video.height()).put("lipSync",true);
            } else {
                var audio=client.download(endpoint,base,contentUrl,id,run.getOwnerUserId());duration=audio.durationSec();
                var stored=storage.store(audio.bytes(),IpProjectService.CATEGORY_GEN,run.getOwnerUserId(),audio.extension(),audio.mimeType());
                output=mapper.createObjectNode().put("storageKey",stored.key()).put("mimeType",audio.mimeType()).put("durationSec",duration)
                        .put("speaker",input.path("speaker").asText()).put("text",input.path("text").asText());
            }
            // Checkpoint the mirrored artifact before settling; a settlement retry reuses the same file.
            tx.executeWithoutResult(s->{var r=runs.lockById(id).orElseThrow();r.setOutputJson(write(output));runs.save(r);});
            if(finish(id,output,null,null)) {
                try {long seconds=lip?exec.path("billableSeconds").asLong():(long)Math.ceil(duration);usage.recordMeteredObservedWithAttribution(endpoint.getId(),endpoint.getName(),lip?"x-dub":"qwen3-tts",lip?"DAP_LIP_SYNC":"DAP_AUDIO",null,null,null,
                        AiModelBillingMode.PER_SECOND,seconds,seconds,true,run.getOwnerUserId(),null,"aiavatar",id,exec.path("jobId").asText(),null,null,null,exec.path("requestBody").asText(),null,null);}
                catch(Exception error){log.warn("[speech] usage recording failed run={}",id,error);}
            }
        } catch(JusuanSpeechClient.Rejected error) {finish(id,null,error.getCode(),error.getMessage());}
        catch(Exception error) {
            log.warn("[speech] awaiting original task run={} reason={}",id,error.getClass().getSimpleName());
            update(id,e->e.put("leaseUntil",0),prefix+".recovering",run.getPct(),lip?"STUDIO_LIP_SYNC_RECOVERING":"STUDIO_SPEECH_RECOVERING","正在恢复原"+label+"任务，无需重新生成");
        } finally {
            if(admissionScope!=null)admissionScope.close();
        }
    }
    private void update(String id,java.util.function.Consumer<ObjectNode> update,String stage,int pct,String code,String message) {
        tx.executeWithoutResult(s->{var r=runs.lockById(id).orElseThrow();if(!IpRun.STATUS_RUNNING.equals(r.getStatus()))return;
            ObjectNode input=read(r.getInputJson());update.accept((ObjectNode)input.path("_exec"));r.setInputJson(write(input));
            r.setStage(stage);r.setPct(pct);r.setErrorCode(code);r.setErrorMessage(message);r.setHeartbeatAt(Instant.now());runs.save(r);});
    }
    private boolean finish(String id,ObjectNode output,String code,String message) {
        return Boolean.TRUE.equals(tx.execute(s->{var r=runs.lockById(id).orElseThrow();if(!IpRun.STATUS_RUNNING.equals(r.getStatus()))return false;terminal(r,output,code,message);return true;}));
    }
    private void terminal(IpRun run,ObjectNode output,String code,String message) {
        if(output!=null) {
            var exec=read(run.getInputJson()).path("_exec");
            if(exec.has("pointPricing")) {
                long seconds="studio-lip-sync".equals(run.getKind())?exec.path("billableSeconds").asLong():(long)Math.ceil(output.path("durationSec").asDouble());
                long actual=StudioPointPricing.Rate.fromSnapshot(exec.path("pointPricing")).cost(seconds);
                if(actual>exec.path("holdTotal").asLong()) {
                    run.setOutputJson("{}");
                    terminal(run,null,"STUDIO_SPEECH_COST_LIMIT_EXCEEDED","配音实际时长超过本次积分上限，未扣费；请缩短文案或减少停顿后再试");
                    return;
                }
                run.setCost(actual);
            }
            var voice=read(run.getInputJson()).path("appliedVoice");
            if("studio-audio".equals(run.getKind())&&!voice.path("voiceId").asText().isBlank())
                assets.recordUsage(run.getOwnerUserId(),"voice",voice.path("voiceId").asText(),"studio-project",run.getProjectId(),
                        "Studio 配音",voice.path("name").asText()+" · v"+voice.path("version").asInt(),null);
            if(run.getCost()>0)credits.commitHold(IpRunService.REF_TYPE,run.getId(),run.getCost(),"studio-lip-sync".equals(run.getKind())?"Studio 口型同步":"Studio 配音");
            if(exec.has("pointPricing"))credits.releaseHold(IpRunService.REF_TYPE,run.getId(),"Studio 按实际时长结算 · 退回剩余冻结");
            run.setOutputJson(write(output));run.setStatus(IpRun.STATUS_DONE);run.setStage("done");run.setPct(100);run.setErrorCode(null);run.setErrorMessage(null);
        } else {
            credits.releaseHold(IpRunService.REF_TYPE,run.getId(),"Studio 生成失败或取消 · 释放冻结");run.setCost(0);
            run.setStatus(IpRun.STATUS_FAILED);run.setStage("failed");run.setErrorCode(code);run.setErrorMessage(message);
        }
        run.setFinishedAt(Instant.now());run.setHeartbeatAt(Instant.now());runs.save(run);
        if(queue!=null)org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
            new org.springframework.transaction.support.TransactionSynchronization(){
                @Override public void afterCommit(){queue.finish(AiGenerationQueueService.SPEECH,run.getId());}
            }); // Release only after media state and credit settlement are committed.
    }
    private ObjectNode read(String text){try{return (ObjectNode)mapper.readTree(text);}catch(Exception e){throw new IllegalStateException(e);}}
    private String write(Object object){try{return mapper.writeValueAsString(object);}catch(Exception e){throw new IllegalStateException(e);}}
}
