package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.dap.service.DapAssetService;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;

@Service
public class StudioWorkflowWorker {
    @org.springframework.beans.factory.annotation.Autowired private AiGenerationQueueService queue;
    private static final Logger log=LoggerFactory.getLogger(StudioWorkflowWorker.class);
    private final IpRunRepository runs;
    private final StudioFixtureProvider fixtures;
    private final FileStorageService storage;
    private final AiModelInvocationService models;
    private final DramaAssembleService assembly;
    private final CreditService credits;
    private final ObjectMapper mapper;
    private final TransactionTemplate transactions;
    private final DapAssetService assets;
    public StudioWorkflowWorker(IpRunRepository runs,StudioFixtureProvider fixtures,FileStorageService storage,
            AiModelInvocationService models,DramaAssembleService assembly,CreditService credits,ObjectMapper mapper,
            PlatformTransactionManager manager,DapAssetService assets) {
        this.runs=runs;this.fixtures=fixtures;this.storage=storage;this.models=models;this.assembly=assembly;
        this.credits=credits;this.mapper=mapper;this.transactions=new TransactionTemplate(manager);
        this.transactions.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.assets=assets;
    }
    @Async("ipRunExecutor") public void execute(String id) {runBlocking(id);}
    public void runBlocking(String id) {
        IpRun run=runs.findById(id).orElse(null);
        if(run==null||!IpRun.STATUS_RUNNING.equals(run.getStatus())) return;
        if(queue!=null && !"studio-assemble".equals(run.getKind())) {
            JsonNode input;
            try {input=mapper.readTree(run.getInputJson());}catch(Exception e){finish(id,null,e);return;}
            var admission=queue.acquire(AiGenerationQueueService.WORKFLOW,id,queue.endpointFor(AiModelPurpose.DAP_PERSONA,input.path("_exec").path("endpointId").asText(null)),false);
            if(admission==AiGenerationQueueService.Admission.WAITING){queued(id);return;}
            if(admission==AiGenerationQueueService.Admission.BUSY)return;
        }
        var context=queue==null?null:queue.bind(AiGenerationQueueService.WORKFLOW,id);
        try {
            if(!claim(id))return;
            if(!progress(id,10,"studio.prepare")) return;
            JsonNode input=mapper.readTree(run.getInputJson());
            boolean mock=input.path("mock").asBoolean();
            ObjectNode output=mapper.createObjectNode(); output.put("mock",mock);
            String operation=input.path("operation").asText();
            switch(operation) {
                case "script","storyboard","assistant" -> {
                    JsonNode script;
                    if(mock) script=fixtureScript(input);
                    else {
                        String system=input.path("_exec").path("systemPrompt").asText(),user=input.path("_exec").path("userPrompt").asText();
                        if(system.isBlank() || user.isBlank()) throw new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"PROMPT_NOT_CONFIGURED","剧本提示词未配置");
                        String endpointId=input.path("_exec").path("endpointId").asText(null);
                        var endpoint=models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,endpointId).orElseThrow(()->new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"ENDPOINT_NOT_ALLOWED","创作模型已停用"));
                        JsonNode visual=input.path("_exec").path("visualContext");
                        Object userContent=user;
                        if(visual.isArray()&&!visual.isEmpty()) {
                            if(!StudioVisualContext.supportsVision(endpoint.endpoint()))throw new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"STUDIO_VISION_UNAVAILABLE","创作模型的图片读取能力已停用");
                            userContent=new StudioVisualContext(storage).parts(user,visual);
                        }
                        String content=models.invokeChatOnEndpoint(endpoint.endpoint(),AiModelPurpose.DAP_PERSONA,List.of(Map.of("role","system","content",system),
                                Map.of("role","user","content",userContent)),Map.of("timeout_seconds",300,"response_format",Map.of("type","json_object"),"temperature",input.path("_exec").path("temperature").asDouble(0.7),"max_tokens",input.path("_exec").path("maxTokens").asInt(8192))).content();
                        script=mapper.readTree(content);
                    }
                    if("assistant".equals(operation)) {
                        if(input.hasNonNull("scriptEdit")) {
                            if(mock)script=mapper.createObjectNode().put("summary","测试响应：保留原稿，可预览并采纳。").put("markdown",input.path("scriptEdit").path("markdown").asText());
                            StudioScriptRevision.validateOutput(script);
                            output.set("scriptRevision",script);output.put("text",script.path("summary").asText());
                        } else {
                        if(mock) script=mapper.readTree("{\"summary\":\"先完善剧本，再制作分镜。\",\"steps\":[{\"id\":\"draft\",\"operation\":\"script\",\"title\":\"创作剧本\",\"prompt\":\"为所选 IP 创作一条短片剧本\",\"referenceNodeIds\":[]}],\"questions\":[]}");
                        StudioPlanValidator.isolateUnsupportedSteps(script);
                        StudioPlanValidator.isolateUnresolvedReferences(script,input.path("contextNodeIds"));
                        StudioPlanValidator.validate(script,input.path("contextNodeIds"));
                        output.set("plan",script);output.put("text",script.path("summary").asText());
                        }
                    } else {
                        StudioScriptValidator.validate(script,input.path("settings").path("episodeCount").asInt(0),input.path("episodeNo").asInt(0));
                        output.set("script",script);output.set("shots",script.path("shots"));
                        output.put("text",script.path("episodes").get(0).path("content").asText());
                    }
                }
                case "image" -> {
                    if(!mock) throw new IllegalStateException("Real images must use established image pipeline");
                    var candidates=output.putArray("candidates");
                    for(int i=0;i<input.path("count").asInt(1);i++) {
                        var file=storage.store(fixtures.image(input.path("prompt").asText()+i),IpProjectService.CATEGORY_GEN,run.getOwnerUserId(),"jpg","image/jpeg");
                        candidates.addObject().put("key",file.key());
                    }
                }
                case "video" -> {
                    if(!mock) throw new IllegalStateException("Real videos must use established video pipeline");
                    var file=storage.store(fixtures.video(),IpProjectService.CATEGORY_GEN,run.getOwnerUserId(),"mp4","video/mp4");
                    output.put("storageKey",file.key());output.put("durationSec",fixtures.videoDuration());
                }
                case "assemble" -> {
                    if(!progress(id,30,"studio.assemble")) return;
                    List<String> keys=new ArrayList<>();input.path("references").forEach(r->keys.add(r.path("storageKey").asText()));
                    var file=assembly.assembleStudioKeys(run.getOwnerUserId(),run.getProjectId(),keys,input.path("aspectRatio").asText("9:16"),input.hasNonNull("packaging")?mapper.treeToValue(input.path("packaging"),com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.Packaging.class):null);
                    output.put("storageKey",file.key());output.put("durationSec",file.durationSec());
                }
                default -> throw new IllegalArgumentException("Unknown Studio operation");
            }
            finish(id,output,null);
        } catch(Exception e) {log.warn("[studio] run failed id={}",id,e);finish(id,null,e);}
        finally {if(context!=null)context.close();if(queue!=null)queue.finish(AiGenerationQueueService.WORKFLOW,id);}
    }
    private void queued(String id) {
        transactions.executeWithoutResult(tx->{var run=runs.lockById(id).orElseThrow();
            if(IpRun.STATUS_RUNNING.equals(run.getStatus())&&run.getStartedAt()==null) {
                run.setStage("endpoint.queued");run.setPct(0);run.setHeartbeatAt(Instant.now());runs.save(run);
            }});
    }
    private JsonNode fixtureScript(JsonNode input) {
        JsonNode base=fixtures.script();
        int count=input.path("settings").path("episodeCount").asInt(1),only=input.path("episodeNo").asInt(0);
        if(count<=1 && only<=0)return base;
        ObjectNode result=base.deepCopy();var episodes=result.putArray("episodes");var shots=result.putArray("shots");
        for(int i=0;i<(only>0?1:count);i++) {
            int no=only>0?only:i+1;
            ObjectNode episode=base.path("episodes").get(0).deepCopy();episode.put("no",no).put("title","样例第 "+no+" 集");episodes.add(episode);
            for(var original:base.path("shots")) {ObjectNode shot=original.deepCopy();shot.put("id","ep"+no+"-"+shot.path("id").asText()).put("episodeNo",no);shots.add(shot);}
        }
        return result;
    }
    public void reject(String id,Exception error) {log.warn("[studio] dispatch rejected id={}",id,error);finish(id,null,error);}
    private boolean claim(String id) {
        return Boolean.TRUE.equals(transactions.execute(tx->{
            IpRun run=runs.lockById(id).orElse(null);
            if(run==null || !IpRun.STATUS_RUNNING.equals(run.getStatus()) || run.getStartedAt()!=null)return false;
            if(run.isCancelRequested()){terminal(run,null,new IllegalStateException("cancelled"));return false;}
            run.setStartedAt(Instant.now());run.setHeartbeatAt(Instant.now());runs.save(run);return true;
        }));
    }
    public boolean expire(String id,Instant cutoff) {
        return Boolean.TRUE.equals(transactions.execute(tx->{
            IpRun run=runs.lockById(id).orElse(null);
            if(run==null || !IpRun.STATUS_RUNNING.equals(run.getStatus()) || run.getHeartbeatAt()==null || !run.getHeartbeatAt().isBefore(cutoff)) return false;
            terminal(run,null,new BusinessException(org.springframework.http.HttpStatus.REQUEST_TIMEOUT,"IP_RUN_TIMEOUT","创作超时，冻结积分已释放，可重新生成"));
            return true;
        }));
    }
    private boolean progress(String id,int pct,String stage) {
        return Boolean.TRUE.equals(transactions.execute(tx->{
            IpRun run=runs.lockById(id).orElse(null);
            if(run==null||!IpRun.STATUS_RUNNING.equals(run.getStatus())) return false;
            if(run.isCancelRequested()) {terminal(run,null,new IllegalStateException("cancelled"));return false;}
            run.setStartedAt(run.getStartedAt()==null?Instant.now():run.getStartedAt());run.setPct(pct);run.setStage(stage);run.setHeartbeatAt(Instant.now());runs.save(run);return true;
        }));
    }
    private void finish(String id,ObjectNode output,Exception error) {
        transactions.executeWithoutResult(tx->{
            IpRun run=runs.lockById(id).orElse(null);
            if(run==null||!IpRun.STATUS_RUNNING.equals(run.getStatus())) return;
            terminal(run,output,error);
        });
    }
    private void terminal(IpRun run,ObjectNode output,Exception error) {
        boolean cancelled=run.isCancelRequested();
        long cost=run.getCost();
        if(error==null&&!cancelled) {
            if(cost>0) credits.commitHold(IpRunService.REF_TYPE,run.getId(),cost,"Studio 剧本创作");
            try {run.setOutputJson(mapper.writeValueAsString(output));}catch(Exception e){throw new IllegalStateException(e);}
            if("studio-assemble".equals(run.getKind())) {
                try {
                    Set<String> ipIds=new HashSet<>();
                    for(var ref:mapper.readTree(run.getInputJson()).path("references")) {
                        String ipId=ref.path("ipId").asText(null);
                        if(ipId!=null && ipIds.add(ipId)) assets.recordUsage(run.getOwnerUserId(),"ip",ipId,"studio-project",run.getProjectId(),"Studio 视频作品","成片 · "+run.getId(),null);
                    }
                } catch(com.fasterxml.jackson.core.JsonProcessingException e) {throw new IllegalStateException(e);}
            }
            run.setStatus(IpRun.STATUS_DONE);run.setStage("done");run.setPct(100);
        } else {
            credits.releaseHold(IpRunService.REF_TYPE,run.getId(),"Studio 失败或取消 · 释放冻结");
            run.setCost(0);run.setStatus(IpRun.STATUS_FAILED);run.setStage("failed");
            run.setErrorCode(cancelled?"IP_RUN_CANCELLED":error instanceof BusinessException b?b.getCode():"STUDIO_RUN_FAILED");
            run.setErrorMessage(cancelled?"已停止创作":error instanceof BusinessException?error.getMessage():"这次创作没有完成，请重试。追查号："+run.getId());
        }
        run.setFinishedAt(Instant.now());run.setHeartbeatAt(Instant.now());runs.save(run);
    }
}
