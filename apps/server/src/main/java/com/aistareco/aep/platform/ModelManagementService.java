package com.aistareco.aep.platform;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.repository.AuditLogRepository;
import com.aistareco.aep.service.*;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioPricingConfig;
import com.aistareco.aep.videostudio.service.VideoStudioPricingService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/** Versioned allowlist. Original business services remain authoritative and invalidate their caches. */
@Service
public class ModelManagementService {
 private final AiModelEndpointAdminService endpoints; private final AiAppBindingService bindings;
 private final PromptService prompts; private final AgentBotProviderAdminService agents;
 private final CelebrityActionPricingService prices; private final VideoStudioPricingService videoPrices;
 private final AiAppSceneModelPolicyService scenePolicies;
 private final ModelFeatureManagementService features;
 private final AiModelUsageService usage; private final AuditLogRepository audit; private final ObjectMapper mapper;
 public ModelManagementService(AiModelEndpointAdminService endpoints,AiAppBindingService bindings,PromptService prompts,AgentBotProviderAdminService agents,CelebrityActionPricingService prices,VideoStudioPricingService videoPrices,AiModelUsageService usage,AiAppSceneModelPolicyService scenePolicies,ModelFeatureManagementService features,AuditLogRepository audit,ObjectMapper mapper) {this.endpoints=endpoints;this.bindings=bindings;this.prompts=prompts;this.agents=agents;this.prices=prices;this.videoPrices=videoPrices;this.usage=usage;this.scenePolicies=scenePolicies;this.features=features;this.audit=audit;this.mapper=mapper;}
 @Transactional(rollbackFor=Exception.class)
 public Object execute(JsonNode c,String actor) throws Exception {
  String a=c.path("action").asText(); Object before=null,result;
  switch(a) {
   case "scenePolicies": return scenePolicies.list();
   case "functionCatalog": return features.catalog();
   case "functionPricingCatalog": return features.pricingCatalog();
   case "functionPrices": return features.pricing(text(c,"appCode"),text(c,"feature"));
   case "functionActionPriceSave": {
    onlyFields(c,Set.of("action","appCode","feature","value"));onlyFields(c.path("value"),Set.of("creditPrice","useEnginePricing"));
    String app=text(c,"appCode"),feature=text(c,"feature");features.lockActions();before=features.pricing(app,feature);features.saveAction(app,feature,dto(c.path("value"),ActionPricingDto.class));result=features.pricing(app,feature);break;
   }
   case "functionConfigPriceSave": {
    onlyFields(c,Set.of("action","appCode","feature","creditPrice"));String app=text(c,"appCode"),feature=text(c,"feature");features.lockConfig(app,feature);before=features.pricing(app,feature);features.saveConfig(app,feature,c.path("creditPrice").longValue(),actor);result=features.pricing(app,feature);break;
   }
   case "functionDefaultSave": {
    onlyFields(c,Set.of("action","appCode","feature","endpointId","acknowledgedAffectedFeatures"));var f=registered(c);requireShared(f);acknowledge(f,c);if(bindings.listCandidates(f.purpose()).stream().noneMatch(x->x.endpointId().equals(text(c,"endpointId"))&&Boolean.TRUE.equals(x.enabled())&&Boolean.TRUE.equals(x.endpointEnabled())))throw BusinessException.badRequest("MODEL_FEATURE_ROUTE_INVALID","请先在当前功能补全并启用此模型候选");before=bindings.list();result=bindings.bind(f.purpose(),text(c,"endpointId"));break;
   }
   case "functionCandidatePrepare": {
    onlyFields(c,Set.of("action","appCode","feature","endpointId","value","acknowledgedAffectedFeatures"));var f=registered(c);requireShared(f);acknowledge(f,c);String id=text(c,"endpointId");
    ObjectNode v=(ObjectNode)c.path("value").deepCopy();onlyFields(v,Set.of("sortOrder","enabled","maxRefImages","supportsFirstLastFrame","supportsSubjectReference","maxDurationSec","minImagePixels"));v.put("endpointId",id);
    var old=bindings.listCandidates(f.purpose()).stream().filter(x->x.endpointId().equals(id)).findFirst();before=old.orElse(null);
    if(old.isPresent()){v.set("creditCostOverride",mapper.valueToTree(old.get().creditCostOverride()));result=bindings.updateCandidate(f.purpose(),id,dto(v,AiAppEndpointCandidateUpsert.class));}else result=bindings.addCandidate(f.purpose(),dto(v,AiAppEndpointCandidateUpsert.class));break;
   }
   case "functionCandidatePriceSave": {
    onlyFields(c,Set.of("action","appCode","feature","endpointId","creditCostOverride","acknowledgedAffectedFeatures"));var f=registered(c);requireShared(f);acknowledge(f,c);
    if(!"candidate".equals(f.pricingKind()))throw BusinessException.badRequest("MODEL_FEATURE_PRICE_INVALID","此功能不消费共享候选售价");
    var old=candidate(f.purpose(),text(c,"endpointId"));before=old;var cap=old.capability();Long price=c.path("creditCostOverride").isNull()?null:c.path("creditCostOverride").longValue();if(price!=null&&price<0)throw new IllegalArgumentException();
    result=bindings.updateCandidate(f.purpose(),old.endpointId(),new AiAppEndpointCandidateUpsert(old.endpointId(),old.sortOrder(),old.enabled(),cap.maxRefImages(),cap.supportsFirstLastFrame(),cap.supportsSubjectReference(),cap.maxDurationSec(),cap.minImagePixels(),price));break;
   }
   case "functionSupplierPointPriceSave": {
    onlyFields(c,Set.of("action","appCode","feature","endpointId","creditPrice","acknowledgedAffectedFeatures"));var f=registered(c);var impact=new ArrayList<String>();c.path("acknowledgedAffectedFeatures").forEach(x->impact.add(x.asText()));features.acknowledgePrice(f.appCode(),f.feature(),impact);String app=text(c,"appCode"),feature=text(c,"feature");features.lockConfig(app,feature);before=features.pricing(app,feature);features.saveSupplierPoint(app,feature,text(c,"endpointId"),c.path("creditPrice").decimalValue(),actor);result=features.pricing(app,feature);break;
   }
   case "functionEnginePriceSave": {
    onlyFields(c,Set.of("action","appCode","feature","engine","value"));onlyFields(c.path("value"),Set.of("creditPrice"));String app=text(c,"appCode"),feature=text(c,"feature");features.lockConfig(app,feature);before=features.pricing(app,feature);features.saveEngine(app,feature,text(c,"engine"),c.path("value").path("creditPrice").intValue());result=features.pricing(app,feature);break;
   }
   case "sceneCatalog": return sceneCatalog();
   case "scenePrices": return scenePrices();
   case "scenePriceSave": {
    onlyFields(c,Set.of("action","appCode","scene","prices"));String app=text(c,"appCode"),scene=text(c,"scene");scenePolicies.lockScene(app,scene);before=scenePolicies.get(app,scene).orElse(null);
    var updates=new ArrayList<AiAppSceneModelPolicyDto.Candidate>();for(var v:c.path("prices")){onlyFields(v,Set.of("endpointId","creditCost","billingUnit"));updates.add(dto(v,AiAppSceneModelPolicyDto.Candidate.class));}
    result=scenePolicies.savePrices(app,scene,updates,actor);break;
   }
   case "sceneCandidatePrepare": {
    onlyFields(c,Set.of("action","appCode","scene","endpointId","value"));var p=scenePolicies.registeredPurpose(text(c,"appCode"),text(c,"scene"));String id=text(c,"endpointId");
    ObjectNode v=(ObjectNode)c.path("value").deepCopy();onlyFields(v,Set.of("sortOrder","enabled","maxRefImages","supportsFirstLastFrame","supportsSubjectReference","maxDurationSec","minImagePixels"));v.put("endpointId",id);
    var old=bindings.listCandidates(p).stream().filter(x->x.endpointId().equals(id)).findFirst();before=old.orElse(null);
    if(old.isPresent()){v.set("creditCostOverride",mapper.valueToTree(old.get().creditCostOverride()));result=bindings.updateCandidate(p,id,dto(v,AiAppEndpointCandidateUpsert.class));}
    else result=bindings.addCandidate(p,dto(v,AiAppEndpointCandidateUpsert.class));break;
   }
   case "scenePolicySave": {var policy=dto(c.path("value"),AiAppSceneModelPolicyDto.class);scenePolicies.lockScene(policy.appCode(),policy.scene());before=scenePolicies.get(policy.appCode(),policy.scene()).orElse(null);result=scenePolicies.save(policy.appCode(),policy.scene(),policy,actor);break;}
   case "endpoints":
   case "endpointCostList": return endpoints.list();
   case "presets": return endpoints.listPresets();
   case "bindings": return bindings.list();
   case "candidates": return bindings.listCandidates(purpose(c));
   case "prompts": return prompts.listForAdmin();
   case "promptVersions": return prompts.versions(text(c,"key"));
   case "promptDryRun": return prompts.dryRun(text(c,"key"),mapper.convertValue(c.path("vars"),mapper.getTypeFactory().constructMapType(Map.class,String.class,String.class)));
   case "agents": return agents.list();
   case "agentScenes": return agents.listScenes();
   case "actionPrices": return prices.getAll();
   case "videoPrices": return videoPrices.current();
   case "usage": return usage.report(c.path("days").asInt(30));
   case "endpointSave": {
    ObjectNode v=(ObjectNode)c.path("value").deepCopy();
    // Cost and sale fields cannot be smuggled through a model-manager write.
    rejectFields(v,Set.of("promptTokenPriceMicros","completionTokenPriceMicros","unitPriceMicros","supplierBillingMode","id"));
    if(c.has("id")) {before=endpoints.get(text(c,"id")); result=endpoints.update(text(c,"id"),dto(v,AdminAiModelEndpointUpsertDto.class));}
    else result=endpoints.create(dto(v,AdminAiModelEndpointUpsertDto.class));
    break;
   }
   case "endpointCosts": {
    before=endpoints.get(text(c,"id"));onlyFields(c.path("value"),Set.of("supplierBillingMode","promptTokenPriceMicros","completionTokenPriceMicros","unitPriceMicros"));result=endpoints.updateCosts(text(c,"id"),dto(c.path("value"),AiModelEndpointCostUpsertDto.class));break;
   }
   case "endpointDelete": before=endpoints.get(text(c,"id"));endpoints.delete(text(c,"id"));result=Map.of("deleted",true);break;
   case "bind": before=bindings.list();result=bindings.bind(purpose(c),text(c,"endpointId"));break;
   case "unbind": before=bindings.list();bindings.unbind(purpose(c));result=Map.of("deleted",true);break;
   case "candidateSave": {
    var p=purpose(c);ObjectNode v=(ObjectNode)c.path("value").deepCopy();rejectFields(v,Set.of("creditCostOverride"));
    if(c.has("endpointId")) {var old=candidate(p,text(c,"endpointId"));before=old;v.set("creditCostOverride",mapper.valueToTree(old.creditCostOverride()));result=bindings.updateCandidate(p,text(c,"endpointId"),dto(v,AiAppEndpointCandidateUpsert.class));}
    else result=bindings.addCandidate(p,dto(v,AiAppEndpointCandidateUpsert.class));break;
   }
   case "candidatePrice": {
    var p=purpose(c);var old=candidate(p,text(c,"endpointId"));before=old;var cap=old.capability();
    Long price=c.path("creditCostOverride").isNull()?null:c.path("creditCostOverride").longValue();
    if(price!=null&&price<0) throw new IllegalArgumentException();
    result=bindings.updateCandidate(p,old.endpointId(),new AiAppEndpointCandidateUpsert(old.endpointId(),old.sortOrder(),old.enabled(),cap.maxRefImages(),cap.supportsFirstLastFrame(),cap.supportsSubjectReference(),cap.maxDurationSec(),cap.minImagePixels(),price));break;
   }
   case "candidateDelete": before=candidate(purpose(c),text(c,"endpointId"));bindings.removeCandidate(purpose(c),text(c,"endpointId"));result=Map.of("deleted",true);break;
   case "promptSave": before=prompts.getForAdmin(text(c,"key"));result=prompts.upsert(text(c,"key"),dto(c.path("value"),PromptTemplateUpsertDto.class),actor);break;
   case "promptRollback": before=prompts.getForAdmin(text(c,"key"));result=prompts.rollback(text(c,"key"),c.path("version").asInt(),actor);break;
   case "agentSave": if(c.has("id")) {before=agents.get(text(c,"id"));result=agents.update(text(c,"id"),dto(c.path("value"),AgentBotProviderUpsertDto.class));} else result=agents.create(dto(c.path("value"),AgentBotProviderUpsertDto.class));break;
   case "agentDelete": before=agents.get(text(c,"id"));agents.delete(text(c,"id"));result=Map.of("deleted",true);break;
   case "actionPricesSave": features.lockActions();before=prices.getAll();result=prices.replaceAll(mapper.convertValue(c.path("value"),mapper.getTypeFactory().constructMapType(Map.class,String.class,ActionPricingDto.class)));break;
   case "videoPricesSave": before=videoPrices.current();result=videoPrices.replace(dto(c.path("value"),VideoStudioPricingConfig.class),actor);break;
   default: throw new BusinessException(HttpStatus.BAD_REQUEST,"MODEL_MANAGEMENT_ACTION_INVALID","不支持此配置操作");
  }
  ObjectNode detail=mapper.createObjectNode();detail.set("before",mapper.valueToTree(before));detail.set("after",mapper.valueToTree(result));
  // Snapshot DTOs contain only masked credentials; no request body is persisted.
  audit.save(AuditLog.builder().id(UUID.randomUUID().toString()).userId(actor).username(actor).action("platform.model."+a).resourceType("model-config").resourceId(c.path("id").asText(c.path("key").asText(c.path("purpose").asText("global")))).appCode("platform-console").result(AuditLog.AuditResult.SUCCESS).detail(mapper.writeValueAsString(detail)).createdAt(Instant.now()).build());
  return result;
 }
 private ModelFeatureRegistry.Feature registered(JsonNode c){return ModelFeatureRegistry.require(text(c,"appCode"),text(c,"feature"));}
 private void requireShared(ModelFeatureRegistry.Feature f){if(!"shared_purpose".equals(f.routingKind())||f.purpose()==null)throw BusinessException.badRequest("MODEL_FEATURE_ROUTE_INVALID","此功能使用独立场景或专属引擎配置");}
 private void acknowledge(ModelFeatureRegistry.Feature f,JsonNode c){var keys=new ArrayList<String>();c.path("acknowledgedAffectedFeatures").forEach(x->keys.add(x.asText()));ModelFeatureRegistry.acknowledge(f,keys);}
 private List<Object> sceneCatalog() {
  var out=new ArrayList<Object>();var all=endpoints.list();
  for(String scene:List.of("script","image")) {
   var p=scenePolicies.registeredPurpose("studio",scene);var policy=scenePolicies.get("studio",scene);var candidates=bindings.listCandidates(p);String status=policy.isEmpty()?"unconfigured":"available";
   if(policy.isPresent() && policy.get().candidates().stream().anyMatch(c->c.creditCost()==null || c.creditCost()<0 || !scenePolicies.billingUnit(scene).equals(c.billingUnit()) || candidates.stream().noneMatch(x->x.endpointId().equals(c.endpointId()) && Boolean.TRUE.equals(x.endpointEnabled()) && Boolean.TRUE.equals(x.enabled()))))status="unavailable";
   var row=new LinkedHashMap<String,Object>();row.put("appCode","studio");row.put("scene",scene);row.put("purpose",p.name());row.put("billingUnit",scenePolicies.billingUnit(scene));row.put("policy",policy.orElse(null));row.put("status",status);row.put("candidates",candidates);row.put("endpoints",all);out.add(row);
  }return out;
 }
 private List<Object> scenePrices() {
  var out=new ArrayList<Object>();var all=endpoints.list();
  for(String scene:List.of("script","image")) {
   var policy=scenePolicies.get("studio",scene);var purpose=scenePolicies.registeredPurpose("studio",scene);var readyCandidates=bindings.listCandidates(purpose);var row=new LinkedHashMap<String,Object>();row.put("appCode","studio");row.put("scene",scene);row.put("billingUnit",scenePolicies.billingUnit(scene));row.put("configured",policy.isPresent());
   var candidates=new ArrayList<Object>();
   for(var c:policy.map(AiAppSceneModelPolicyDto::candidates).orElse(List.of())) {
    var e=all.stream().filter(x->x.id().equals(c.endpointId())).findFirst();var v=new LinkedHashMap<String,Object>();v.put("endpointId",c.endpointId());v.put("creditCost",c.creditCost());v.put("billingUnit",c.billingUnit());v.put("endpointName",e.map(AiModelEndpointDto::name).orElse(null));v.put("endpointEnabled",e.map(AiModelEndpointDto::enabled).orElse(false));v.put("available",e.map(AiModelEndpointDto::enabled).orElse(false) && readyCandidates.stream().anyMatch(x->x.endpointId().equals(c.endpointId()) && Boolean.TRUE.equals(x.enabled())));candidates.add(v);
   }row.put("candidates",candidates);out.add(row);
  }return out;
 }
 private AiAppEndpointCandidateDto candidate(AiModelPurpose p,String id) {return bindings.listCandidates(p).stream().filter(x->x.endpointId().equals(id)).findFirst().orElseThrow(()->new BusinessException(HttpStatus.NOT_FOUND,"CANDIDATE_NOT_FOUND","候选端点不存在"));}
 private AiModelPurpose purpose(JsonNode c) {try{return AiModelPurpose.valueOf(text(c,"purpose"));}catch(Exception e){throw new IllegalArgumentException();}}
 private String text(JsonNode c,String k) {String v=c.path(k).asText();if(!v.matches("[a-zA-Z0-9_.:-]{1,160}"))throw new IllegalArgumentException();return v;}
 private <T>T dto(JsonNode n,Class<T> t) throws Exception {return mapper.treeToValue(n,t);}
 private void rejectFields(JsonNode n,Set<String> fields) {for(String f:fields)if(n.has(f))throw new IllegalArgumentException();}
 private void onlyFields(JsonNode n,Set<String> fields) {n.fieldNames().forEachRemaining(k->{if(!fields.contains(k))throw new IllegalArgumentException();});}
}
