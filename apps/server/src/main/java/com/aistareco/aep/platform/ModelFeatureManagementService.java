package com.aistareco.aep.platform;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.videostudio.service.VideoStudioPricingService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Thin access to original configuration records; no second routing or pricing store. */
@Service
@Transactional
public class ModelFeatureManagementService {
    private final AiAppBindingService bindings;
    private final CelebrityActionPricingService prices;
    private final PlatformConfigService config;
    private final VideoStudioPricingService videoPrices;
    private final ObjectMapper mapper;
    private final com.aistareco.aep.config.MusicGenProperties music;
    private final CelebrityZoneService zone;
    private final com.aistareco.aep.ipstudio.service.StudioPlatformPricing platform;
    private final com.aistareco.aep.dap.service.DapPricingService dap;
    private final com.aistareco.aep.ipstudio.service.StudioPointPricing point;
    private final AiModelEndpointAdminService endpoints;
    private final AiAppSceneModelPolicyService scenePolicies;
    private final long defaultUploadCost;

    public ModelFeatureManagementService(AiAppBindingService bindings,CelebrityActionPricingService prices,PlatformConfigService config,VideoStudioPricingService videoPrices,ObjectMapper mapper,com.aistareco.aep.config.MusicGenProperties music,CelebrityZoneService zone,com.aistareco.aep.ipstudio.service.StudioPlatformPricing platform,com.aistareco.aep.dap.service.DapPricingService dap,com.aistareco.aep.ipstudio.service.StudioPointPricing point,AiModelEndpointAdminService endpoints,AiAppSceneModelPolicyService scenePolicies,@org.springframework.beans.factory.annotation.Value("${sau.default-upload-cost:20}") long defaultUploadCost) {
        this.bindings=bindings;this.prices=prices;this.config=config;this.videoPrices=videoPrices;this.mapper=mapper;this.music=music;this.zone=zone;this.platform=platform;this.dap=dap;this.point=point;this.endpoints=endpoints;this.scenePolicies=scenePolicies;this.defaultUploadCost=defaultUploadCost;
    }
    public List<Object> catalog() {
        var allBindings=bindings.list();var rows=new ArrayList<Object>();
        for(var f:ModelFeatureRegistry.FEATURES) {
            var row=mapper.<com.fasterxml.jackson.databind.node.ObjectNode>valueToTree(f);
            row.put("pricingKind",pricingKind(f));row.put("priceSemantics","runtime_snapshot".equals(pricingKind(f))?"runtime_release":f.priceSemantics());row.set("priceAffectedFeatures",mapper.valueToTree(priceAffected(f)));
            row.put("purpose",f.purpose()==null?null:f.purpose().name());if(f.purpose()==com.aistareco.aep.model.AiModelPurpose.DAP_REAL_AVATAR)row.put("modelProtocol","modelink");
            row.set("secondaryPurposes",mapper.valueToTree(ModelFeatureRegistry.secondary(f).stream().map(Enum::name).toList()));
            row.set("affectedFeatures",mapper.valueToTree(ModelFeatureRegistry.affected(f)));
            var binding=f.purpose()==null?null:allBindings.stream().filter(b->b.purpose().equals(f.purpose().wire())).findFirst().orElse(null);
            var candidates=f.purpose()==null?List.<AiAppEndpointCandidateDto>of():bindings.listCandidates(f.purpose());
            row.set("binding",mapper.valueToTree(binding));row.set("candidates",mapper.valueToTree(candidates));
            String status=f.purpose()==null?("none".equals(f.routingKind())?"not_required":"external"):
                binding==null || binding.endpointId()==null?"unconfigured":Boolean.TRUE.equals(binding.endpointEnabled())?"configured":"unavailable";
            if("scene_policy".equals(f.routingKind())) {
                String scene="script".equals(f.feature())?"script":"image";var policy=scenePolicies.get("studio",scene);row.put("scenePolicyAppCode","studio");row.put("scenePolicyScene",scene);
                status=policy.isEmpty()?"unconfigured":policy.get().candidates().stream().anyMatch(c->candidates.stream().noneMatch(x->x.endpointId().equals(c.endpointId())&&Boolean.TRUE.equals(x.enabled())&&Boolean.TRUE.equals(x.endpointEnabled())))?"unavailable":"configured";
            }
            row.put("status",status);rows.add(row);
        }return rows;
    }
    public List<Object> pricingCatalog(){
        var rows=new ArrayList<Object>();
        for(var f:ModelFeatureRegistry.FEATURES){
            var row=mapper.<com.fasterxml.jackson.databind.node.ObjectNode>valueToTree(f);var p=mapper.valueToTree(pricing(f.appCode(),f.feature()));row.put("purpose",f.purpose()==null?null:f.purpose().name());if(f.purpose()==com.aistareco.aep.model.AiModelPurpose.DAP_REAL_AVATAR)row.put("modelProtocol","modelink");row.put("pricingKind",pricingKind(f));row.put("priceSemantics",p.path("priceSemantics").asText());
            row.set("affectedFeatures",mapper.valueToTree(ModelFeatureRegistry.affected(f)));row.set("priceAffectedFeatures",mapper.valueToTree(priceAffected(f)));row.set("secondaryPurposes",mapper.valueToTree(ModelFeatureRegistry.secondary(f).stream().map(Enum::name).toList()));row.putNull("binding");row.set("candidates",mapper.createArrayNode());row.set("pricing",p);
            String status="none".equals(f.pricingKind())?"not_required":"runtime_snapshot".equals(pricingKind(f))?"external":p.path("value").isNull()?(p.hasNonNull("fallback")?"configured":"unconfigured"):"configured";
            var values=p.path("value");if(values.isObject()&&values.has("candidates"))values=values.path("candidates");if(values.isArray() && values.isEmpty())status="unconfigured";if(values.isArray() && !values.isEmpty() && java.util.stream.StreamSupport.stream(values.spliterator(),false).anyMatch(x->x.has("available")&&!x.path("available").asBoolean()))status="unavailable";
            if("scene_policy".equals(f.routingKind())){row.put("scenePolicyAppCode","studio");row.put("scenePolicyScene","script".equals(f.feature())?"script":"image");if(!p.path("value").path("configured").asBoolean())status="unconfigured";}
            row.put("status",status);rows.add(row);
        }return rows;
    }
    /** Only sale data plus endpoint display fields; credentials and addresses are never projected. */
    public Object pricing(String app,String feature) {
        var f=ModelFeatureRegistry.require(app,feature);var row=new LinkedHashMap<String,Object>();row.put("appCode",app);row.put("feature",feature);row.put("pricingKind",pricingKind(f));row.put("priceSemantics","runtime_snapshot".equals(pricingKind(f))?"runtime_release":f.priceSemantics());row.put("billingUnit",f.billingUnit());
        switch(pricingKind(f)) {
            case "action": row.put("value",prices.getAll().get(f.priceKey()));row.put("fallback",actionFallback(f.priceKey()));break;
            case "engine_matrix": {var safe=new LinkedHashMap<String,Object>();zone.getEnginePricing().forEach((key,v)->safe.put(key,Map.of("creditPrice",v.creditPrice())));row.put("value",safe);break;}
            case "supplier_points": {
                var entries=new ArrayList<Object>();var current=config.findByKey(com.aistareco.aep.ipstudio.service.StudioPointPricing.KEY).map(PlatformConfigDto::value).orElse(null);
                for(var c:bindings.listCandidates(f.purpose())) {var v=new LinkedHashMap<String,Object>();var rate=point.find(c.endpointId());boolean fixed=current!=null&&current.path("customerPrices").path(c.endpointId()).isNumber();v.put("endpointId",c.endpointId());v.put("endpointName",c.endpointName());v.put("endpointEnabled",c.endpointEnabled());v.put("available",Boolean.TRUE.equals(c.endpointEnabled())&&Boolean.TRUE.equals(c.enabled()));v.put("creditPrice",rate==null?(current==null?c.creditCostOverride():null):rate.platformPointsPerSecond());v.put("priceSource",fixed?"fixed":rate==null?(current==null&&c.creditCostOverride()!=null?"legacy_candidate":"unconfigured"):"legacy_conversion");entries.add(v);}row.put("value",entries);break;
            }
            case "config": row.put("value",config.findByKey(f.priceKey()).map(PlatformConfigDto::value).orElse(null));row.put("fallback",dramaFallback(f.feature()));break;
            case "candidate": {
                var entries=new ArrayList<Object>();for(var c:bindings.listCandidates(f.purpose())) {
                    var v=new LinkedHashMap<String,Object>();v.put("endpointId",c.endpointId());v.put("endpointName",c.endpointName());v.put("endpointEnabled",c.endpointEnabled());v.put("available",Boolean.TRUE.equals(c.endpointEnabled())&&Boolean.TRUE.equals(c.enabled()));v.put("creditCostOverride",c.creditCostOverride());v.put("billingUnit","endpoint".equals(f.billingUnit())?endpoints.list().stream().filter(e->e.id().equals(c.endpointId())).findFirst().map(e->"PER_SECOND".equals(e.billingMode())?"per_second":"per_call").orElse("per_call"):f.billingUnit());entries.add(v);
                }row.put("value",entries);row.put("fallback",f.priceKey().isEmpty()?("music".equals(app)?music.getDefaultCreditsPerSecond():null):config.getLong(f.priceKey(),dramaFallback(f.feature())));break;
            }
            case "scene_policy": {
                String scene="script".equals(f.feature())?"script":"image";var policy=scenePolicies.get("studio",scene);var value=new LinkedHashMap<String,Object>();value.put("configured",policy.isPresent());var entries=new ArrayList<Object>();var models=endpoints.list();var shared=bindings.listCandidates(f.purpose());
                for(var c:policy.map(AiAppSceneModelPolicyDto::candidates).orElse(List.of())){var v=new LinkedHashMap<String,Object>();var e=models.stream().filter(x->x.id().equals(c.endpointId())).findFirst();v.put("endpointId",c.endpointId());v.put("endpointName",e.map(AiModelEndpointDto::name).orElse(null));v.put("endpointEnabled",e.map(AiModelEndpointDto::enabled).orElse(false));v.put("available",e.map(AiModelEndpointDto::enabled).orElse(false)&&shared.stream().anyMatch(x->x.endpointId().equals(c.endpointId())&&Boolean.TRUE.equals(x.enabled())));v.put("creditCost",c.creditCost());v.put("billingUnit",c.billingUnit());entries.add(v);}value.put("candidates",entries);row.put("value",value);break;
            }
            case "video_matrix": row.put("value",videoPrices.current());break;
            // Existing scene-policy and published Runtime pricing keep their dedicated editors.
            default: row.put("value",null);
        }return row;
    }
    public Map<String,ActionPricingDto> saveAction(String app,String feature,ActionPricingDto value) {
        var f=ModelFeatureRegistry.require(app,feature);if(!"action".equals(f.pricingKind()))throw bad();
        if(value==null || value.creditPrice()==null || value.creditPrice()<0 || Boolean.TRUE.equals(value.useEnginePricing())&&!"celebrity.video".equals(f.priceKey()))throw bad();
        lockActions();var next=new LinkedHashMap<>(prices.getAll());config.findByKey(CelebrityActionPricingService.ACTION_PRICING_CONFIG_KEY).ifPresent(c->{Map<String,ActionPricingDto> raw=mapper.convertValue(c.value(),mapper.getTypeFactory().constructMapType(LinkedHashMap.class,String.class,ActionPricingDto.class));next.putAll(raw);});var old=next.get(f.priceKey());value=new ActionPricingDto(value.creditPrice(),value.useEnginePricing()==null?(old==null?false:old.useEnginePricing()):value.useEnginePricing());next.put(f.priceKey(),value);return prices.replaceAll(next);
    }
    public Object saveConfig(String app,String feature,long value,String actor) {
        var f=ModelFeatureRegistry.require(app,feature);if(!"config".equals(f.pricingKind()) || value<0)throw bad();
        config.lockExisting(f.priceKey());return config.upsert(f.priceKey(),mapper.valueToTree(value),f.name()+"积分售价",actor);
    }
    public String pricingKind(ModelFeatureRegistry.Feature f){return "studio".equals(f.appCode())&&"speech".equals(f.feature())&&platform.enabled()?"runtime_snapshot":f.pricingKind();}
    public List<String> priceAffected(ModelFeatureRegistry.Feature f){return ModelFeatureRegistry.priceAffected(f).stream().filter(k->!platform.enabled()||!"supplier_points".equals(f.pricingKind())||!"studio.speech".equals(k)).toList();}
    public void acknowledgePrice(String app,String feature,List<String> keys){var f=ModelFeatureRegistry.require(app,feature);if(keys.size()!=new HashSet<>(keys).size()||!new HashSet<>(keys).equals(new HashSet<>(priceAffected(f))))throw bad();}
    public void lockConfig(String app,String feature){var f=ModelFeatureRegistry.require(app,feature);if("supplier_points".equals(f.pricingKind()))config.lockRequired(CelebrityActionPricingService.ACTION_PRICING_CONFIG_KEY);config.lockExisting(f.priceKey());}
    public Object saveSupplierPoint(String app,String feature,String endpointId,java.math.BigDecimal value,String actor){
        var f=ModelFeatureRegistry.require(app,feature);if(!"supplier_points".equals(pricingKind(f))||value==null||value.signum()<0)throw bad();
        if(bindings.listCandidates(f.purpose()).stream().noneMatch(c->c.endpointId().equals(endpointId)))throw bad();
        String key=com.aistareco.aep.ipstudio.service.StudioPointPricing.KEY;config.lockRequired(CelebrityActionPricingService.ACTION_PRICING_CONFIG_KEY);config.lockExisting(key);
        var merged=config.findByKey(key).map(PlatformConfigDto::value).filter(com.fasterxml.jackson.databind.JsonNode::isObject).map(v->(com.fasterxml.jackson.databind.node.ObjectNode)v.deepCopy()).orElseGet(mapper::createObjectNode);
        var customer=merged.path("customerPrices").isObject()?(com.fasterxml.jackson.databind.node.ObjectNode)merged.path("customerPrices").deepCopy():mapper.createObjectNode();customer.set(endpointId,mapper.valueToTree(value));merged.set("customerPrices",customer);return config.upsert(key,merged,"Studio客户固定积分售价",actor);
    }
    public Object saveEngine(String app,String feature,String engine,int creditPrice){
        var f=ModelFeatureRegistry.require(app,feature);if(!"engine_matrix".equals(f.pricingKind())||!Set.of("KeLing","HiGen","MiniMax").contains(engine)||creditPrice<0)throw bad();
        config.lockExisting(CelebrityZoneService.ENGINE_PRICING_CONFIG_KEY);var next=new LinkedHashMap<>(zone.getEnginePricing());config.findByKey(CelebrityZoneService.ENGINE_PRICING_CONFIG_KEY).ifPresent(c->{Map<String,EnginePricingDto> raw=mapper.convertValue(c.value(),mapper.getTypeFactory().constructMapType(LinkedHashMap.class,String.class,EnginePricingDto.class));next.putAll(raw);});var old=next.get(engine);if(old==null)throw bad();next.put(engine,new EnginePricingDto(creditPrice,old.quotaCost()));return zone.adminReplaceEnginePricing(next);
    }
    private Long actionFallback(String key){return switch(key){
        case "material.video-generate"->30L;case "material.script-draft"->0L;case "publish.upload"->defaultUploadCost;case "mixcut.generate"->{long v=config.getLong("mixcut.credit-per-variant",30);yield v>0?v:30L;}
        case "dap.generate"->dap.generate();case "dap.generate-upload"->dap.generateUpload();case "dap.iterate"->dap.iterate();case "dap.warp"->dap.warp();case "dap.look"->dap.look();case "dap.scene-generate"->dap.sceneGenerate();case "dap.scene-variant"->dap.sceneVariant();case "dap.product-generate"->dap.productGenerate();case "dap.product-angle"->dap.productAngle();case "dap.compose"->dap.compose();case "dap.ip-identity"->dap.ipIdentity();case "dap.ip-image"->dap.ipImage();case "dap.voice-clone"->dap.voiceClone();case "dap.derive-atlas"->dap.derive("atlas");case "dap.derive-expr"->dap.derive("expr");case "dap.derive-scene"->dap.derive("scene");case "dap.derive-ward"->dap.derive("ward");case "dap.derive-d3"->dap.derive("d3");case "dap.derive-video"->dap.derive("video");default->null;};}
    private static long dramaFallback(String feature){return switch(feature){
        case "outline-trial","split-scene","canvas-script-outline"->6L;case "outline-full","interactive-draft"->18L;case "epscript","short-entry"->10L;case "cast"->5L;case "decompose"->3L;case "shot-rewrite","frame","canvas-script-setting"->2L;case "clip"->30L;case "canvas-script-episode","canvas-extract","canvas-storyboard"->4L;default->0L;};}
    public void lockActions(){config.lockExisting(CelebrityActionPricingService.ACTION_PRICING_CONFIG_KEY);}
    private BusinessException bad(){return BusinessException.badRequest("MODEL_FEATURE_PRICE_INVALID","此功能售价配置无效");}
}
