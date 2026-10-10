package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiAppSceneModelPolicyDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.AiModelEndpoint;
import java.net.URI;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Only registered, consumed scenes can be saved; absent policy preserves legacy bindings. */
@Service
public class AiAppSceneModelPolicyService {
    private static final String PREFIX="ai.scene-policy.";
    public static final String STUDIO_PROVIDER_KEY="ipstudio.model-provider";
    private final PlatformConfigService config;
    private final AiModelInvocationService models;
    private final ObjectMapper mapper;
    public AiAppSceneModelPolicyService(PlatformConfigService config,AiModelInvocationService models,ObjectMapper mapper) {
        this.config=config;this.models=models;this.mapper=mapper;
    }
    public List<AiAppSceneModelPolicyDto> list() {
        return List.of("script","image").stream().flatMap(scene->get("studio",scene).stream()).toList();
    }
    public Optional<AiAppSceneModelPolicyDto> get(String appCode,String scene) {
        purpose(appCode,scene);
        return config.findByKey(PREFIX+appCode+"."+scene).map(c->{
            try{return mapper.treeToValue(c.value(),AiAppSceneModelPolicyDto.class);}
            catch(Exception e){throw unavailable("AI_SCENE_POLICY_INVALID","场景模型配置无效");}
        });
    }
    @Transactional
    public AiAppSceneModelPolicyDto save(String appCode,String scene,AiAppSceneModelPolicyDto body,String updatedBy) {
        var purpose=purpose(appCode,scene);
        config.lockExisting(PREFIX+appCode+"."+scene);
        if(body==null || !appCode.equals(body.appCode()) || !scene.equals(body.scene()) || !Set.of("fixed","selectable").contains(body.mode()==null?"":body.mode())
                || body.candidates()==null || body.candidates().isEmpty() || body.candidates().size()>64)
            throw bad("场景模型配置不完整");
        if("fixed".equals(body.mode())&&body.candidates().size()!=1)throw bad("固定模式只能配置一个模型");
        Set<String> ids=new HashSet<>();
        for(var c:body.candidates()) {
            if(c==null || c.endpointId()==null || c.endpointId().isBlank() || !ids.add(c.endpointId()) || c.creditCost()==null || c.creditCost()<0 || !unit(scene).equals(c.billingUnit()))throw bad("候选模型、积分售价或计量单位无效");
            requireEndpoint(purpose,c.endpointId());
        }
        if(!ids.contains(body.defaultEndpointId()))throw bad("默认模型必须在可用候选内");
        config.upsert(PREFIX+appCode+"."+scene,mapper.valueToTree(body),"应用场景模型开放与积分售价",updatedBy);
        return body;
    }
    @Transactional
    public AiAppSceneModelPolicyDto savePrices(String app,String scene,List<AiAppSceneModelPolicyDto.Candidate> prices,String actor) {
        purpose(app,scene);
        config.lockExisting(PREFIX+app+"."+scene);
        var old=get(app,scene).orElseThrow(()->bad("场景尚未配置"));
        if(prices==null || prices.isEmpty() || prices.size()>64)throw bad("售价不能为空");
        Map<String,AiAppSceneModelPolicyDto.Candidate> updates=new HashMap<>();
        Set<String> allowed=new HashSet<>();old.candidates().forEach(c->allowed.add(c.endpointId()));
        for(var c:prices)if(c==null || !allowed.contains(c.endpointId()) || c.creditCost()==null || c.creditCost()<0 || !unit(scene).equals(c.billingUnit()) || updates.put(c.endpointId(),c)!=null)throw bad("仅能修改已配置模型的有效售价");
        var value=new AiAppSceneModelPolicyDto(old.appCode(),old.scene(),old.mode(),old.defaultEndpointId(),old.candidates().stream().map(c->updates.getOrDefault(c.endpointId(),c)).toList());
        config.upsert(PREFIX+app+"."+scene,mapper.valueToTree(value),"应用场景积分售价",actor);return value;
    }
    public void lockScene(String app,String scene){purpose(app,scene);config.lockExisting(PREFIX+app+"."+scene);}
    public AiModelPurpose registeredPurpose(String app,String scene){return purpose(app,scene);}
    public String billingUnit(String scene){return unit(scene);}
    public String mode(String appCode,String scene) {return get(appCode,scene).map(AiAppSceneModelPolicyDto::mode).orElse("selectable");}
    public record Selection(AiModelInvocationService.ResolvedEndpoint resolved,long creditCost,String billingUnit) {}
    public Selection resolve(String appCode,String scene,String endpointId,long legacyCost) {
        var purpose=purpose(appCode,scene);var policy=get(appCode,scene);
        if(policy.isEmpty())return new Selection(requireEndpoint(purpose,endpointId),legacyCost,unit(scene));
        var p=policy.get();String selected=endpointId==null||endpointId.isBlank()?p.defaultEndpointId():endpointId.trim();
        if("fixed".equals(p.mode())&&!Objects.equals(selected,p.defaultEndpointId()))throw unavailable("ENDPOINT_NOT_ALLOWED","此场景使用固定模型");
        var candidate=p.candidates().stream().filter(c->Objects.equals(c.endpointId(),selected)).findFirst().orElseThrow(()->unavailable("ENDPOINT_NOT_ALLOWED","所选模型不在场景开放范围内"));
        if(candidate.creditCost()==null || candidate.creditCost()<0 || !unit(scene).equals(candidate.billingUnit()))throw unavailable("AI_SCENE_PRICE_NOT_CONFIGURED","场景积分售价尚未配置");
        return new Selection(requireEndpoint(purpose,selected),candidate.creditCost(),candidate.billingUnit());
    }
    public List<Selection> available(String appCode,String scene,long legacyCost) {
        var purpose=purpose(appCode,scene);var policy=get(appCode,scene);
        if(policy.isEmpty())return models.listCandidates(purpose).stream().filter(this::availableEndpoint).map(r->new Selection(r,legacyCost,unit(scene))).toList();
        var p=policy.get();List<Selection> out=new ArrayList<>();
        for(var c:p.candidates()) {
            var r=models.resolveEndpoint(purpose,c.endpointId());
            if(r.isEmpty()||!availableEndpoint(r.get())||c.creditCost()==null||c.creditCost()<0||!unit(scene).equals(c.billingUnit()))continue;
            out.add(new Selection(new AiModelInvocationService.ResolvedEndpoint(r.get().endpoint(),r.get().candidate(),Objects.equals(p.defaultEndpointId(),c.endpointId())),c.creditCost(),c.billingUnit()));
        }
        return out;
    }
    private AiModelInvocationService.ResolvedEndpoint requireEndpoint(AiModelPurpose purpose,String id) {
        return models.resolveEndpoint(purpose,id).filter(r->allowsStudioProvider(r.endpoint())).orElseThrow(()->unavailable("ENDPOINT_NOT_ALLOWED","模型已停用或未绑定到对应能力用途"));
    }
    /** Studio has its own supplier scope; shared drama/commerce candidate bindings stay intact. */
    public boolean allowsStudioProvider(AiModelEndpoint endpoint) {
        var restriction=config.findByKey(STUDIO_PROVIDER_KEY);
        if(restriction.isEmpty())return true;
        if(!restriction.get().value().isTextual() || !"jusuan".equals(restriction.get().value().asText()))
            throw unavailable("AI_SCENE_POLICY_INVALID","Studio 供应商配置无效");
        try {
            URI uri=URI.create(endpoint.getBaseUrl());
            return "https".equalsIgnoreCase(uri.getScheme()) && "api.jusuanhub.com".equalsIgnoreCase(uri.getHost())
                    && uri.getUserInfo()==null && uri.getQuery()==null && uri.getFragment()==null;
        } catch(RuntimeException e){return false;}
    }
    private boolean availableEndpoint(AiModelInvocationService.ResolvedEndpoint r) {
        return r.endpoint().isEnabled() && r.candidate()!=null && r.candidate().isEnabled() && allowsStudioProvider(r.endpoint());
    }
    public List<AiModelInvocationService.ResolvedEndpoint> studioVideoCandidates() {
        var candidates=models.listCandidates(AiModelPurpose.VIDEO_GENERATION).stream().filter(this::availableEndpoint).toList();
        String selected=candidates.stream().filter(AiModelInvocationService.ResolvedEndpoint::isDefault).findFirst()
                .or(()->candidates.stream().findFirst()).map(r->r.endpoint().getId()).orElse(null);
        return candidates.stream().map(r->new AiModelInvocationService.ResolvedEndpoint(r.endpoint(),r.candidate(),Objects.equals(selected,r.endpoint().getId()))).toList();
    }
    public AiModelInvocationService.ResolvedEndpoint resolveStudioVideo(String endpointId) {
        var candidates=studioVideoCandidates();
        return candidates.stream().filter(r->endpointId==null || endpointId.isBlank()?r.isDefault():endpointId.trim().equals(r.endpoint().getId()))
                .findFirst().orElseThrow(()->unavailable("ENDPOINT_NOT_ALLOWED","请选择 Studio 开放的视频模型"));
    }
    private AiModelPurpose purpose(String app,String scene) {
        if(!"studio".equals(app)||!Set.of("script","image").contains(scene==null?"":scene))throw bad("当前仅支持 Studio 剧本和图片场景");
        return "image".equals(scene)?AiModelPurpose.DAP_IMAGE:AiModelPurpose.DAP_PERSONA;
    }
    private String unit(String scene){return "image".equals(scene)?"per_image":"per_call";}
    private BusinessException bad(String text){return BusinessException.badRequest("AI_SCENE_POLICY_INVALID",text);}
    private BusinessException unavailable(String code,String text){return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,code,text);}
}
