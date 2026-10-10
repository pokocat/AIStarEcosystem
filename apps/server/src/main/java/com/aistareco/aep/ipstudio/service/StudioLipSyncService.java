package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioLipSyncDtos.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service
public class StudioLipSyncService {
    @org.springframework.beans.factory.annotation.Autowired private StudioLipSyncResult results;
    @org.springframework.beans.factory.annotation.Autowired private StudioPointPricing pricing;
    private final IpProjectService projects;private final IpRunRepository runs;private final AiModelInvocationService models;
    private final StudioLipSyncMedia media;private final FileStorageService storage;private final StudioSpeechWorker worker;
    private final CreditService credits;private final ObjectMapper mapper;
    public StudioLipSyncService(IpProjectService projects,IpRunRepository runs,AiModelInvocationService models,StudioLipSyncMedia media,
            FileStorageService storage,StudioSpeechWorker worker,CreditService credits,ObjectMapper mapper) {
        this.projects=projects;this.runs=runs;this.models=models;this.media=media;this.storage=storage;this.worker=worker;this.credits=credits;this.mapper=mapper;
    }
    public LipSyncCatalog catalog() {
        return new LipSyncCatalog(models.listCandidates(AiModelPurpose.DAP_LIP_SYNC).stream()
                .filter(r->r.endpoint().isEnabled()&&r.candidate().isEnabled()&&JusuanLipSyncClient.supports(r.endpoint()))
                .map(r->new LipSyncModel(r.endpoint().getId(),r.endpoint().getName(),r.isDefault(),catalogRate(r.endpoint().getId(),r.candidate().getCreditCostOverride()))).toList(),60);
    }
    private java.math.BigDecimal catalogRate(String endpointId,Long legacy) {
        var rate=pricing==null?null:pricing.find(endpointId);
        return rate!=null?rate.platformPointsPerSecond():pricing!=null&&pricing.enabled()?null:legacy==null?null:java.math.BigDecimal.valueOf(legacy);
    }
    private record Preflight(java.math.BigDecimal rate, StudioPointPricing.Rate snapshot,StudioLipSyncMedia.Inputs inputs) {}
    private Preflight preflight(String user,LipSyncInput input) {
        if(input==null)throw bad("请选择人物视频和驱动配音");
        required(input.model(),128);required(input.videoStorageKey(),1000);required(input.audioStorageKey(),1000);
        String video=projects.requireOwnedAssetKey(user,input.videoStorageKey()),audio=projects.requireOwnedAssetKey(user,input.audioStorageKey());
        var r=models.resolveEndpoint(AiModelPurpose.DAP_LIP_SYNC,input.model()).orElseThrow(()->bad("所选口型模型不可用"));
        if(!JusuanLipSyncClient.supports(r.endpoint()))throw bad("所选模型不支持口型同步");
        var snapshot=pricing==null?null:pricing.find(r.endpoint().getId());
        var rate=catalogRate(r.endpoint().getId(),r.candidate().getCreditCostOverride());
        if(rate==null||rate.signum()<0||r.endpoint().getBillingMode()!=AiModelBillingMode.PER_SECOND)
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"STUDIO_LIP_SYNC_PRICE_NOT_CONFIGURED","口型同步的每秒积分尚未配置");
        try{return new Preflight(rate,snapshot,media.inspect(storage.openForRead(video),storage.openForRead(audio)));}
        catch(java.io.IOException e){throw bad("人物视频或配音无法读取，请重新选择");}
    }
    public LipSyncQuote quote(String user,String projectId,LipSyncInput input) {
        projects.required(user,projectId);var p=preflight(user,input);return quote(p);
    }
    private static LipSyncQuote quote(Preflight p) {
        long seconds=(long)Math.ceil(p.inputs().audioDurationSec());
        return new LipSyncQuote(p.rate().multiply(java.math.BigDecimal.valueOf(seconds)).setScale(0,java.math.RoundingMode.CEILING).longValueExact(),seconds,p.inputs().audioDurationSec(),p.inputs().videoDurationSec());
    }
    @Transactional
    public IpRunDto submit(String user,String projectId,LipSyncRequest request) {
        projects.requiredForUpdate(user,projectId);
        if(request==null)throw bad("请选择人物视频和驱动配音");
        required(request.clientRequestId(),64);required(request.nodeId(),64);
        if(request.maxCost()==null||request.maxCost()<0)throw bad("请先确认口型同步费用");
        String fingerprint=hash(write(request));
        var prior=runs.findByProjectIdAndClientRequestId(projectId,request.clientRequestId()).orElse(null);
        if(prior!=null) {
            if(!"studio-lip-sync".equals(prior.getKind())||!fingerprint.equals(prior.getInputFingerprint()))
                throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_REQUEST_CHANGED","同一口型请求的素材已改变，请重新提交");
            return projects.toRunDto(prior);
        }
        var p=preflight(user,new LipSyncInput(request.model(),request.videoStorageKey(),request.audioStorageKey()));var price=quote(p);
        IpRunService.requireApprovedCost(request.maxCost(),price.cost());
        var endpoint=models.resolveEndpoint(AiModelPurpose.DAP_LIP_SYNC,request.model()).orElseThrow().endpoint();
        String id="IPR-"+UUID.randomUUID().toString().replace("-","").substring(0,20);ObjectNode input=mapper.valueToTree(request);
        input.putObject("_exec").put("endpointId",endpoint.getId()).put("baseUrl",endpoint.getBaseUrl().replaceAll("/$",""))
                .put("holdTotal",price.cost()).put("billableSeconds",price.billableSeconds()).put("audioDurationSec",price.audioDurationSec()).put("creditCostPerSecond",p.rate());
        if(p.snapshot()!=null)((ObjectNode)input.path("_exec")).set("pointPricing",mapper.valueToTree(p.snapshot()));
        if(price.cost()>0)credits.hold(user,price.cost(),IpRunService.REF_TYPE,id,"Studio 口型同步");
        var run=IpRun.builder().id(id).projectId(projectId).ownerUserId(user).nodeId(request.nodeId()).kind("studio-lip-sync")
                .clientRequestId(request.clientRequestId()).inputFingerprint(fingerprint).status(IpRun.STATUS_RUNNING).stage("queued").cost(price.cost()).pct(0)
                .inputJson(write(input)).outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build();runs.save(run);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){try{worker.execute(id);}catch(RuntimeException e){/* Scheduler resumes the durable run. */}}});
        return projects.toRunDto(run);
    }
    /** Idempotent local extraction of an already paid result; provider inputs and settlement stay intact. */
    @Transactional
    public IpRunDto extract(String user,String projectId,String runId) throws Exception {
        projects.required(user,projectId);
        var run=runs.lockById(runId).orElseThrow(()->bad("口型任务不存在"));
        if(!user.equals(run.getOwnerUserId())||!projectId.equals(run.getProjectId()))throw bad("口型任务不属于当前项目");
        if(!"studio-lip-sync".equals(run.getKind())||!IpRun.STATUS_DONE.equals(run.getStatus()))throw bad("请等待口型任务完成");
        ObjectNode output=(ObjectNode)mapper.readTree(run.getOutputJson());
        if(output.path("lipSyncNormalized").asBoolean())return projects.toRunDto(run);
        String original=output.path("storageKey").asText(),source=mapper.readTree(run.getInputJson()).path("videoStorageKey").asText();
        projects.requireOwnedAssetKey(user,original);projects.requireOwnedAssetKey(user,source);
        var result=results.extract(storage.openForRead(source),storage.openForRead(original));
        if(result.comparison()) {
            var stored=storage.store(result.bytes(),IpProjectService.CATEGORY_GEN,user,"mp4","video/mp4");
            output.put("comparisonStorageKey",original).put("storageKey",stored.key());
        }
        output.put("lipSyncNormalized",true).put("width",result.width()).put("height",result.height()).put("durationSec",result.durationSec());
        run.setOutputJson(write(output));runs.save(run);return projects.toRunDto(run);
    }
    private static void required(String text,int max){if(text==null||text.isBlank()||text.length()>max)throw bad("口型参数为空或超过长度限制");}
    private static BusinessException bad(String message){return BusinessException.badRequest("STUDIO_LIP_SYNC_INPUT_INVALID",message);}
    private String write(Object o){try{return mapper.writeValueAsString(o);}catch(Exception e){throw new IllegalStateException(e);}}
    private static String hash(String text){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
