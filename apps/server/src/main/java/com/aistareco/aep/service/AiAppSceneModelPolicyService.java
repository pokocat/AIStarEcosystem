package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiAppSceneModelPolicyDto;
import com.aistareco.aep.ipstudio.service.StudioImageModelRouting;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Only registered, consumed scenes can be saved; absent image/script policy preserves legacy bindings.
 * Studio video follows explicit model access, with the old group retained for default and legacy rows. */
@Service
public class AiAppSceneModelPolicyService {
    private static final String PREFIX="ai.scene-policy.";
    private static final String DIRECTOR_IMAGE_DEFAULT_KEY="ai.scene-default.studio.director-image";
    private static final String STUDIO_VIDEO_GROUP_KEY="ai.app-model-group.studio.video";
    public record VideoGroup(String defaultEndpointId,List<String> endpointIds) {}
    private final PlatformConfigService config;
    private final AiModelInvocationService models;
    private final AiModelAccessPolicyService access;
    private final ObjectMapper mapper;
    public AiAppSceneModelPolicyService(PlatformConfigService config,AiModelInvocationService models,AiModelAccessPolicyService access,ObjectMapper mapper) {
        this.config=config;this.models=models;this.access=access;this.mapper=mapper;
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
            requireEndpoint(purpose,c.endpointId(),appCode);
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
    /** 导演台没选模型时用哪个图片模型。没配就跟 Studio 图片的默认走；模型仍要在 Studio 图片的开放范围内，价格也从那里来。 */
    public Optional<String> directorImageDefault() {
        return config.findByKey(DIRECTOR_IMAGE_DEFAULT_KEY).map(c->c.value().path("endpointId").asText("")).filter(id->!id.isBlank());
    }
    @Transactional
    public String saveDirectorImageDefault(String endpointId,String updatedBy) {
        config.lockExisting(DIRECTOR_IMAGE_DEFAULT_KEY);
        var policy=get("studio","image").orElseThrow(()->bad("Studio 图片尚未配置开放范围"));
        if(endpointId==null||policy.candidates().stream().noneMatch(c->endpointId.equals(c.endpointId())))throw bad("模型不在 Studio 图片的开放范围内");
        requireEndpoint(AiModelPurpose.DAP_IMAGE,endpointId,"studio");
        config.upsert(DIRECTOR_IMAGE_DEFAULT_KEY,mapper.createObjectNode().put("endpointId",endpointId),"AI 导演台默认图片模型",updatedBy);
        return endpointId;
    }
    public void lockScene(String app,String scene){purpose(app,scene);config.lockExisting(PREFIX+app+"."+scene);}
    public AiModelPurpose registeredPurpose(String app,String scene){return purpose(app,scene);}
    public String billingUnit(String scene){return unit(scene);}
    public String mode(String appCode,String scene) {return get(appCode,scene).map(AiAppSceneModelPolicyDto::mode).orElse("selectable");}
    public record Selection(AiModelInvocationService.ResolvedEndpoint resolved, long creditCost, String billingUnit,
                            Map<String, Long> resolutionPrices) {
        public Selection(AiModelInvocationService.ResolvedEndpoint resolved, long creditCost, String billingUnit) {
            this(resolved, creditCost, billingUnit, Map.of());
        }

        public long creditCostForTier(String tier) {
            return tier == null ? creditCost : resolutionPrices.getOrDefault(tier, creditCost);
        }

        public long creditCostForSize(String size) {
            return creditCostForTier(StudioImageModelRouting.tierForSize(size));
        }
    }

    public Selection resolve(String appCode,String scene,String endpointId,long legacyCost) {
        var purpose=purpose(appCode,scene);var policy=get(appCode,scene);
        var tierPrices = imageResolutionPrices(scene);
        if(policy.isEmpty())return selection(requireEndpoint(purpose,endpointId,appCode),legacyCost,unit(scene),tierPrices);
        var p=policy.get();String selected=endpointId==null||endpointId.isBlank()?p.defaultEndpointId():endpointId.trim();
        if("fixed".equals(p.mode())&&!Objects.equals(selected,p.defaultEndpointId()))throw unavailable("ENDPOINT_NOT_ALLOWED","此场景使用固定模型");
        var candidate=p.candidates().stream().filter(c->Objects.equals(c.endpointId(),selected)).findFirst().orElseThrow(()->unavailable("ENDPOINT_NOT_ALLOWED","所选模型不在场景开放范围内"));
        if(candidate.creditCost()==null || candidate.creditCost()<0 || !unit(scene).equals(candidate.billingUnit()))throw unavailable("AI_SCENE_PRICE_NOT_CONFIGURED","场景积分售价尚未配置");
        return selection(requireEndpoint(purpose,selected,appCode),candidate.creditCost(),candidate.billingUnit(),tierPrices);
    }
    public List<Selection> available(String appCode,String scene,long legacyCost) {
        var purpose=purpose(appCode,scene);var policy=get(appCode,scene);
        var tierPrices = imageResolutionPrices(scene);
        if(policy.isEmpty())return models.listCandidates(purpose,appCode).stream().filter(this::availableEndpoint).map(r->selection(r,legacyCost,unit(scene),tierPrices)).toList();
        var p=policy.get();List<Selection> out=new ArrayList<>();
        for(var c:p.candidates()) {
            var r=models.resolveEndpoint(purpose,c.endpointId(),appCode);
            if(r.isEmpty()||!availableEndpoint(r.get())||c.creditCost()==null||c.creditCost()<0||!unit(scene).equals(c.billingUnit()))continue;
            out.add(selection(new AiModelInvocationService.ResolvedEndpoint(r.get().endpoint(),r.get().candidate(),Objects.equals(p.defaultEndpointId(),c.endpointId())),c.creditCost(),c.billingUnit(),tierPrices));
        }
        return out;
    }
    private Map<String, Map<String, Long>> imageResolutionPrices(String scene) {
        if (!"image".equals(scene)) return Map.of();
        return config.findByKey(StudioImageModelRouting.PRICING_CONFIG_KEY)
                .map(c -> StudioImageModelRouting.resolutionPrices(c.value())).orElse(Map.of());
    }
    private Selection selection(AiModelInvocationService.ResolvedEndpoint resolved, long creditCost,
                                String billingUnit, Map<String, Map<String, Long>> tierPrices) {
        var family = StudioImageModelRouting.familyForProviderModel(resolved.endpoint().getModel());
        return new Selection(resolved, creditCost, billingUnit,
                family == null ? Map.of() : tierPrices.getOrDefault(family.id(), Map.of()));
    }
    private AiModelInvocationService.ResolvedEndpoint requireEndpoint(AiModelPurpose purpose,String id,String appCode) {
        return models.resolveEndpoint(purpose,id,appCode).orElseThrow(()->unavailable("ENDPOINT_NOT_ALLOWED","模型已停用或未绑定到对应能力用途"));
    }
    private boolean availableEndpoint(AiModelInvocationService.ResolvedEndpoint r) {
        return r.endpoint().isEnabled() && r.candidate()!=null && r.candidate().isEnabled();
    }
    public Optional<VideoGroup> studioVideoGroup() {
        return config.findByKey(STUDIO_VIDEO_GROUP_KEY).map(saved -> {
            try {
                VideoGroup group=mapper.treeToValue(saved.value(),VideoGroup.class);
                if(group==null || group.endpointIds()==null || group.endpointIds().isEmpty()
                        || group.endpointIds().size()!=new HashSet<>(group.endpointIds()).size()
                        || !group.endpointIds().contains(group.defaultEndpointId()))throw new IllegalArgumentException();
                return group;
            } catch(Exception exception){throw unavailable("AI_SCENE_POLICY_INVALID","Studio 视频模型配置无效");}
        });
    }
    @Transactional
    public VideoGroup saveStudioVideoGroup(VideoGroup group,String actor) {
        if(group==null || group.endpointIds()==null || group.endpointIds().isEmpty()
                || group.endpointIds().size()>64 || group.endpointIds().size()!=new HashSet<>(group.endpointIds()).size()
                || !group.endpointIds().contains(group.defaultEndpointId()))throw bad("Studio 视频模型配置无效");
        for(String id:group.endpointIds())requireEndpoint(AiModelPurpose.VIDEO_GENERATION,id,"studio");
        config.lockExisting(STUDIO_VIDEO_GROUP_KEY);
        config.upsert(STUDIO_VIDEO_GROUP_KEY,mapper.valueToTree(group),"Studio 视频开放模型",actor);
        return group;
    }
    public List<AiModelInvocationService.ResolvedEndpoint> studioVideoCandidates() {
        var group=studioVideoGroup();
        var candidates=models.listCandidates(AiModelPurpose.VIDEO_GENERATION,"studio").stream()
                .filter(this::availableEndpoint)
                .filter(r->{String id=r.endpoint().getId();return access.hasExplicitPolicy(id)
                        ? access.explicitlyOpensStudioVideo(id)
                        : group.isPresent() && group.get().endpointIds().contains(id);})
                .toList();
        String preferred=group.map(VideoGroup::defaultEndpointId).orElse(null);
        String defaultId=candidates.stream().anyMatch(r -> Objects.equals(preferred,r.endpoint().getId()))
                ? preferred : candidates.isEmpty()?null:candidates.get(0).endpoint().getId();
        return candidates.stream().map(r->new AiModelInvocationService.ResolvedEndpoint(r.endpoint(),r.candidate(),Objects.equals(defaultId,r.endpoint().getId()))).toList();
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
