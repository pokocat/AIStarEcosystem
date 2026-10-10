package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioSpeechDtos.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.*;
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
public class StudioSpeechService {
    @org.springframework.beans.factory.annotation.Autowired private StudioVoiceService profiles;
    @org.springframework.beans.factory.annotation.Autowired private StudioPointPricing pricing;
    private final IpProjectService projects; private final IpRunRepository runs;
    private final AiModelInvocationService models; private final JusuanSpeechClient client;
    private final StudioSpeechWorker worker; private final CreditService credits; private final ObjectMapper mapper;
    public StudioSpeechService(IpProjectService projects,IpRunRepository runs,AiModelInvocationService models,
            JusuanSpeechClient client,StudioSpeechWorker worker,CreditService credits,ObjectMapper mapper) {
        this.projects=projects;this.runs=runs;this.models=models;this.client=client;this.worker=worker;this.credits=credits;this.mapper=mapper;
    }
    public SpeechCatalog catalog() {
        var available=models.listCandidates(AiModelPurpose.DAP_AUDIO).stream()
                .filter(r->r.endpoint().isEnabled()&&r.candidate().isEnabled()&&JusuanSpeechClient.supports(r.endpoint())).toList();
        return new SpeechCatalog(available.stream().map(r->catalogModel(r)).toList(),
                available.isEmpty()?List.of():client.voices(available.get(0).endpoint()),600,160);
    }
    private SpeechModel catalogModel(AiModelInvocationService.ResolvedEndpoint r) {
        var rate=pricing==null?null:pricing.find(r.endpoint().getId());
        return new SpeechModel(r.endpoint().getId(),r.endpoint().getName(),r.isDefault(),
                pricing!=null&&pricing.enabled()?null:r.candidate().getCreditCostOverride(),rate==null?null:rate.platformPointsPerSecond());
    }
    @Transactional
    public IpRunDto submit(String user,String projectId,SpeechRequest request) {
        projects.requiredForUpdate(user,projectId);
        if(request==null)throw bad("STUDIO_SPEECH_INPUT_INVALID","请填写配音内容");
        required(request.clientRequestId(),64);required(request.nodeId(),64);required(request.model(),128);
        required(request.text(),600);required(request.speaker(),80);
        if(request.maxCost()==null || request.maxCost()<0)throw bad("STUDIO_SPEECH_INPUT_INVALID","请先确认配音费用");
        if(request.instruct()!=null && request.instruct().length()>160)throw bad("STUDIO_SPEECH_INPUT_INVALID","风格指令最多 160 字");
        ObjectNode canonical=mapper.valueToTree(request);
        // Keep old accepted requests byte-compatible when the new optional bindings are absent.
        if(request.avatarId()==null)canonical.remove("avatarId");
        if(request.voiceId()==null)canonical.remove("voiceId");
        String fingerprint=hash(write(canonical));
        var prior=runs.findByProjectIdAndClientRequestId(projectId,request.clientRequestId()).orElse(null);
        if(prior!=null) {
            if(!"studio-audio".equals(prior.getKind()) || !fingerprint.equals(prior.getInputFingerprint()))
                throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_REQUEST_CHANGED","同一配音请求的内容已改变，请重新提交");
            return projects.toRunDto(prior);
        }
        com.aistareco.aep.dap.model.DapVoice profile=null;
        if(request.voiceId()!=null) {
            profile=profiles.requiredProfile(user,request.avatarId(),request.voiceId());
            if(!Objects.equals(profile.getEngineRef(),request.speaker())||!Objects.equals(profile.getStylePrompt(),StudioVoiceService.style(request.instruct())))
                throw bad("STUDIO_VOICE_REQUEST_CHANGED","音色或风格与声音版本不一致，请重新选择");
        } else if(request.avatarId()!=null)profiles.requiredAvatar(user,request.avatarId(),false);
        var resolved=models.resolveEndpoint(AiModelPurpose.DAP_AUDIO,request.model()).orElseThrow(()->bad("ENDPOINT_NOT_ALLOWED","所选配音模型不可用"));
        if(!JusuanSpeechClient.supports(resolved.endpoint()))throw bad("STUDIO_SPEECH_MODEL_UNSUPPORTED","所选模型不支持此配音方式");
        var rate=pricing==null?null:pricing.find(resolved.endpoint().getId());
        Long price=rate!=null?Long.valueOf(rate.cost(StudioPointPricing.speechReservationSeconds(request.text().trim()))):
                pricing!=null&&pricing.enabled()?null:resolved.candidate().getCreditCostOverride();
        if(price==null || price<0)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"STUDIO_SPEECH_PRICE_NOT_CONFIGURED","配音费用尚未配置");
        IpRunService.requireApprovedCost(request.maxCost(),price);
        if(client.voices(resolved.endpoint()).stream().noneMatch(v->v.speaker().equals(request.speaker())))throw bad("STUDIO_SPEECH_VOICE_INVALID","请选择当前开放的音色");
        String id="IPR-"+UUID.randomUUID().toString().replace("-","").substring(0,20);
        ObjectNode input=mapper.valueToTree(request);
        if(profile!=null)input.putObject("appliedVoice").put("voiceId",profile.getId()).put("avatarId",profile.getAvatarId())
                .put("version",profile.getProfileVersion()).put("name",profile.getName()).put("speaker",profile.getEngineRef()).put("instruct",profile.getStylePrompt());
        ObjectNode body=mapper.createObjectNode().put("model","qwen3-tts").put("text",request.text()).put("speaker",request.speaker());
        if(request.instruct()!=null&&!request.instruct().isBlank())body.put("instruct",request.instruct());
        input.putObject("_exec").put("endpointId",resolved.endpoint().getId()).put("baseUrl",resolved.endpoint().getBaseUrl().replaceAll("/$",""))
                .put("requestBody",write(body)).put("holdTotal",price);
        if(rate!=null)((ObjectNode)input.path("_exec")).set("pointPricing",mapper.valueToTree(rate));
        if(price>0)credits.hold(user,price,IpRunService.REF_TYPE,id,"Studio 配音");
        var run=IpRun.builder().id(id).projectId(projectId).ownerUserId(user).nodeId(request.nodeId()).kind("studio-audio")
                .clientRequestId(request.clientRequestId()).inputFingerprint(fingerprint).status(IpRun.STATUS_RUNNING).stage("queued")
                .cost(price).pct(0).inputJson(write(input)).outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
        runs.save(run);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
            @Override public void afterCommit(){try{worker.execute(id);}catch(RuntimeException e){/* Durable scheduler resumes this same request. */}}
        });
        return projects.toRunDto(run);
    }
    private static void required(String text,int max){if(text==null||text.isBlank()||text.length()>max)throw bad("STUDIO_SPEECH_INPUT_INVALID","配音参数为空或超出长度限制");}
    private static BusinessException bad(String code,String message){return BusinessException.badRequest(code,message);}
    private String write(Object o){try{return mapper.writeValueAsString(o);}catch(Exception e){throw new IllegalStateException(e);}}
    private static String hash(String text){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
