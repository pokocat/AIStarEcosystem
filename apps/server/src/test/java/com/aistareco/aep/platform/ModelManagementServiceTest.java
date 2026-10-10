package com.aistareco.aep.platform;
import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AuditLogRepository;
import com.aistareco.aep.service.*;
import com.aistareco.aep.videostudio.service.VideoStudioPricingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ModelManagementServiceTest {
 private final ObjectMapper mapper=new ObjectMapper().findAndRegisterModules();
 private final AiModelEndpointAdminService endpoints=mock(AiModelEndpointAdminService.class);
 private final AiAppBindingService bindings=mock(AiAppBindingService.class);
 private final AuditLogRepository audit=mock(AuditLogRepository.class);
 private ModelManagementService service(){return new ModelManagementService(endpoints,bindings,mock(PromptService.class),mock(AgentBotProviderAdminService.class),mock(CelebrityActionPricingService.class),mock(VideoStudioPricingService.class),mock(AiModelUsageService.class),mock(AiAppSceneModelPolicyService.class),mock(ModelFeatureManagementService.class),audit,mapper);}
 @Test void costEditPreservesModelLimitsAndNeverRewritesKey() throws Exception {
  var old=mapper.readValue("{\"id\":\"a\",\"name\":\"A\",\"providerType\":\"OPENAI\",\"baseUrl\":\"https://example.com\",\"upstreamApiKeyMasked\":\"***\",\"model\":\"m\",\"concurrencyLimit\":3,\"rpmLimit\":30,\"tpmLimit\":4000,\"dailyTokenQuota\":9999,\"promptTokenPriceMicros\":10,\"completionTokenPriceMicros\":20,\"unitPriceMicros\":0}",AiModelEndpointDto.class);
  when(endpoints.get("a")).thenReturn(old);when(endpoints.updateCosts(eq("a"),any())).thenReturn(old);
  service().execute(mapper.readTree("{\"action\":\"endpointCosts\",\"id\":\"a\",\"value\":{\"supplierBillingMode\":\"TOKENS\",\"promptTokenPriceMicros\":100,\"completionTokenPriceMicros\":200,\"unitPriceMicros\":0}}"),"operator");
  var cap=ArgumentCaptor.forClass(AiModelEndpointCostUpsertDto.class);verify(endpoints).updateCosts(eq("a"),cap.capture());
  assertEquals("TOKENS",cap.getValue().supplierBillingMode());assertEquals(100L,cap.getValue().promptTokenPriceMicros());verify(endpoints,never()).update(any(),any());verify(audit).save(any());
 }
 @Test void capabilityEditPreservesSalePriceAndCostEditCannotSmuggleModel() throws Exception {
  var old=new AiAppEndpointCandidateDto("DAP_IMAGE","image","a","A",true,false,1,true,new EndpointCapabilityDto(6,true,false,15,5,768000,null,null),12L,null);
  when(bindings.listCandidates(AiModelPurpose.DAP_IMAGE)).thenReturn(List.of(old));when(bindings.updateCandidate(eq(AiModelPurpose.DAP_IMAGE),eq("a"),any())).thenReturn(old);
  service().execute(mapper.readTree("{\"action\":\"candidateSave\",\"purpose\":\"DAP_IMAGE\",\"endpointId\":\"a\",\"value\":{\"maxRefImages\":2,\"minImagePixels\":1920000}}"),"operator");
  var cap=ArgumentCaptor.forClass(AiAppEndpointCandidateUpsert.class);verify(bindings).updateCandidate(eq(AiModelPurpose.DAP_IMAGE),eq("a"),cap.capture());assertEquals(12L,cap.getValue().creditCostOverride());assertEquals(1920000,cap.getValue().minImagePixels());
  when(endpoints.get("a")).thenReturn(mapper.readValue("{}",AiModelEndpointDto.class));
  assertThrows(Exception.class,()->service().execute(mapper.readTree("{\"action\":\"endpointCosts\",\"id\":\"a\",\"value\":{\"model\":\"outside\"}}"),"operator"));
 }
 @Test void rejectsUnknownActionInsteadOfBecomingAnAdminProxy() {
  assertThrows(Exception.class,()->service().execute(mapper.readTree("{\"action\":\"staffDelete\",\"id\":\"root\"}"),"operator"));verifyNoInteractions(endpoints,bindings,audit);
 }
 @Test void scenePreparationPreservesSharedPriceAndNeverChangesDefault() throws Exception {
  var policies=mock(AiAppSceneModelPolicyService.class);when(policies.registeredPurpose("studio","image")).thenReturn(AiModelPurpose.DAP_IMAGE);
  var svc=new ModelManagementService(endpoints,bindings,mock(PromptService.class),mock(AgentBotProviderAdminService.class),mock(CelebrityActionPricingService.class),mock(VideoStudioPricingService.class),mock(AiModelUsageService.class),policies,mock(ModelFeatureManagementService.class),audit,mapper);
  var old=new AiAppEndpointCandidateDto("DAP_IMAGE","image","a","A",true,false,1,true,new EndpointCapabilityDto(6,true,false,15,5,768000,null,null),12L,null);
  when(bindings.listCandidates(AiModelPurpose.DAP_IMAGE)).thenReturn(List.of(old));when(bindings.updateCandidate(eq(AiModelPurpose.DAP_IMAGE),eq("a"),any())).thenReturn(old);
  svc.execute(mapper.readTree("{\"action\":\"sceneCandidatePrepare\",\"appCode\":\"studio\",\"scene\":\"image\",\"endpointId\":\"a\",\"value\":{\"maxRefImages\":2}}"),"operator");
  var cap=ArgumentCaptor.forClass(AiAppEndpointCandidateUpsert.class);verify(bindings).updateCandidate(eq(AiModelPurpose.DAP_IMAGE),eq("a"),cap.capture());assertEquals(12L,cap.getValue().creditCostOverride());assertEquals(2,cap.getValue().maxRefImages());verify(bindings,never()).bind(any(),any());verify(audit).save(any());
 }
 @Test void priceOnlyReadProjectsNameAndDisabledStateWithoutEndpointSecrets() throws Exception {
  var policies=mock(AiAppSceneModelPolicyService.class);
  when(policies.get("studio","script")).thenReturn(java.util.Optional.empty());when(policies.get("studio","image")).thenReturn(java.util.Optional.of(new AiAppSceneModelPolicyDto("studio","image","fixed","a",List.of(new AiAppSceneModelPolicyDto.Candidate("a",null,"per_image")))));
  when(policies.registeredPurpose("studio","script")).thenReturn(AiModelPurpose.DAP_PERSONA);when(policies.registeredPurpose("studio","image")).thenReturn(AiModelPurpose.DAP_IMAGE);when(bindings.listCandidates(any())).thenReturn(List.of());
  when(policies.billingUnit("script")).thenReturn("per_call");when(policies.billingUnit("image")).thenReturn("per_image");
  when(endpoints.list()).thenReturn(List.of(mapper.readValue("{\"id\":\"a\",\"name\":\"A\",\"baseUrl\":\"https://vendor.example\",\"upstreamApiKeyMasked\":\"***\",\"enabled\":false}",AiModelEndpointDto.class)));
  var svc=new ModelManagementService(endpoints,bindings,mock(PromptService.class),mock(AgentBotProviderAdminService.class),mock(CelebrityActionPricingService.class),mock(VideoStudioPricingService.class),mock(AiModelUsageService.class),policies,mock(ModelFeatureManagementService.class),audit,mapper);
  var result=mapper.valueToTree(svc.execute(mapper.readTree("{\"action\":\"scenePrices\"}"),"operator"));
  assertFalse(result.get(0).path("configured").asBoolean());var c=result.get(1).path("candidates").get(0);assertEquals("A",c.path("endpointName").asText());assertFalse(c.path("endpointEnabled").asBoolean());assertFalse(c.path("available").asBoolean());assertTrue(c.path("creditCost").isNull());assertFalse(c.has("baseUrl"));assertFalse(c.has("upstreamApiKeyMasked"));verifyNoInteractions(audit);
 }
 @Test void priceAvailabilityRequiresEnabledPurposeCandidateEvenWhenEndpointEnabled() throws Exception {
  var policies=mock(AiAppSceneModelPolicyService.class);when(policies.registeredPurpose("studio","script")).thenReturn(AiModelPurpose.DAP_PERSONA);when(policies.registeredPurpose("studio","image")).thenReturn(AiModelPurpose.DAP_IMAGE);
  when(policies.get("studio","script")).thenReturn(java.util.Optional.empty());when(policies.get("studio","image")).thenReturn(java.util.Optional.of(new AiAppSceneModelPolicyDto("studio","image","fixed","a",List.of(new AiAppSceneModelPolicyDto.Candidate("a",2L,"per_image")))));
  when(policies.billingUnit("script")).thenReturn("per_call");when(policies.billingUnit("image")).thenReturn("per_image");
  when(endpoints.list()).thenReturn(List.of(mapper.readValue("{\"id\":\"a\",\"name\":\"A\",\"enabled\":true}",AiModelEndpointDto.class)));
  var svc=new ModelManagementService(endpoints,bindings,mock(PromptService.class),mock(AgentBotProviderAdminService.class),mock(CelebrityActionPricingService.class),mock(VideoStudioPricingService.class),mock(AiModelUsageService.class),policies,mock(ModelFeatureManagementService.class),audit,mapper);
  for(Boolean enabled:List.of(false,true)) {
   when(bindings.listCandidates(AiModelPurpose.DAP_IMAGE)).thenReturn(List.of(new AiAppEndpointCandidateDto("DAP_IMAGE","image","a","A",true,false,1,enabled,null,null,null)));
   var c=mapper.valueToTree(svc.execute(mapper.readTree("{\"action\":\"scenePrices\"}"),"operator")).get(1).path("candidates").get(0);assertTrue(c.path("endpointEnabled").asBoolean());assertEquals(enabled,c.path("available").asBoolean());
  }
  when(bindings.listCandidates(AiModelPurpose.DAP_IMAGE)).thenReturn(List.of());var c=mapper.valueToTree(svc.execute(mapper.readTree("{\"action\":\"scenePrices\"}"),"operator")).get(1).path("candidates").get(0);assertTrue(c.path("endpointEnabled").asBoolean());assertFalse(c.path("available").asBoolean());
 }
}
