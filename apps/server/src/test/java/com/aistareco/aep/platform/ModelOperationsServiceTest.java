package com.aistareco.aep.platform;
import com.aistareco.aep.dto.AiModelUsageRecordDto;
import com.aistareco.aep.dto.AiModelDiscoveryResultDto;
import com.aistareco.aep.dto.AiModelEntryDto;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiVideoRequestSpec;
import com.aistareco.aep.service.AiModelEndpointAdminService;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class ModelOperationsServiceTest {
 private final AiModelEndpointAdminService endpoints=mock(AiModelEndpointAdminService.class);
 private final AiModelUsageService usage=mock(AiModelUsageService.class);
 private final ObjectMapper mapper=new ObjectMapper().findAndRegisterModules();
 private final ModelOperationsService service=new ModelOperationsService(endpoints,usage,mapper);
 @Test void savedConnectionCheckDoesNotReturnVendorPayload() throws Exception {
  when(endpoints.testConnection("e")).thenReturn(Map.of("ok",true,"snippet","private vendor payload"));var result=mapper.valueToTree(service.execute(mapper.readTree("{\"action\":\"endpointTest\",\"id\":\"e\"}")));assertTrue(result.path("ok").asBoolean());assertFalse(result.has("snippet"));verify(endpoints).testConnection("e");
 }
 @Test void fetchesSavedModelCatalogAndSanitizesVendorErrors() throws Exception {
  when(endpoints.fetchModels("e")).thenReturn(AiModelDiscoveryResultDto.ok(200,List.of(new AiModelEntryDto("m","Model",32000,false))));
  var command=mapper.readTree("{\"action\":\"endpointFetchModels\",\"id\":\"e\"}");
  var result=mapper.valueToTree(service.execute(command));assertEquals("m",result.path("models").get(0).path("id").asText());
  when(endpoints.fetchModels("e")).thenReturn(AiModelDiscoveryResultDto.fail(401,"raw private vendor error"));
  result=mapper.valueToTree(service.execute(command));assertFalse(result.path("error").asText().contains("raw private"));
 }
 @Test void probesDraftConnectionWithoutLeakingVendorError() throws Exception {
  when(endpoints.probe("e",AiModelProviderType.OPENAI_COMPATIBLE,"https://vendor.example/v1",null,"/v1/models"))
   .thenReturn(AiModelDiscoveryResultDto.fail(401,"private vendor payload"));
  var command=mapper.readTree("{\"action\":\"endpointProbe\",\"id\":\"e\",\"providerType\":\"OPENAI_COMPATIBLE\",\"baseUrl\":\"https://vendor.example/v1\",\"modelsPath\":\"/v1/models\"}");
  var result=mapper.valueToTree(service.execute(command));
  assertFalse(result.path("ok").asBoolean());assertEquals(401,result.path("statusCode").asInt());
  assertFalse(result.path("error").asText().contains("private vendor"));
  assertTrue(result.path("error").asText().contains("密钥"));
  verify(endpoints).probe("e",AiModelProviderType.OPENAI_COMPATIBLE,"https://vendor.example/v1",null,"/v1/models");
 }
 @Test void probeAcceptsTheSavedCatalogRouteLength() {
  String route="/models?filter="+"video".repeat(50);
  var command=mapper.createObjectNode().put("action","endpointProbe")
   .put("providerType","OPENAI_COMPATIBLE").put("baseUrl","https://vendor.example/v1")
   .put("modelsPath",route);
  when(endpoints.probe(null,AiModelProviderType.OPENAI_COMPATIBLE,"https://vendor.example/v1",null,route))
   .thenReturn(AiModelDiscoveryResultDto.ok(200,List.of()));
  assertTrue(mapper.valueToTree(service.execute(command)).path("ok").asBoolean());
 }
 @Test void probeAcceptsAConfiguredCredentialHeaderButNotHopByHopHeaders() throws Exception {
  var auth=new AiVideoRequestSpec.AuthHeader("x-api-key","");
  when(endpoints.probe("e",AiModelProviderType.OPENAI_COMPATIBLE,"https://vendor.example/v1",null,"/v1/models",auth))
   .thenReturn(AiModelDiscoveryResultDto.ok(200,List.of()));
  var result=mapper.valueToTree(service.execute(mapper.readTree("{\"action\":\"endpointProbe\",\"id\":\"e\",\"providerType\":\"OPENAI_COMPATIBLE\",\"baseUrl\":\"https://vendor.example/v1\",\"modelsPath\":\"/v1/models\",\"authHeader\":{\"name\":\"x-api-key\",\"prefix\":\"\"}}")));
  assertTrue(result.path("ok").asBoolean());
  verify(endpoints).probe("e",AiModelProviderType.OPENAI_COMPATIBLE,"https://vendor.example/v1",null,"/v1/models",auth);
  assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"endpointProbe\",\"providerType\":\"OPENAI_COMPATIBLE\",\"baseUrl\":\"https://vendor.example/v1\",\"authHeader\":{\"name\":\"Host\",\"prefix\":\"\"}}")));
 }
 @Test void probeForwardsCatalogPointersFromTheDraft() throws Exception {
  var catalog=new AiVideoRequestSpec.CatalogSpec("/payload/models","/model_id","/title",null);
  when(endpoints.probe("e",AiModelProviderType.OPENAI_COMPATIBLE,"https://vendor.example/v1",null,
   "/models",null,catalog)).thenReturn(AiModelDiscoveryResultDto.ok(200,List.of()));
  var command=mapper.readTree("{\"action\":\"endpointProbe\",\"id\":\"e\",\"providerType\":\"OPENAI_COMPATIBLE\",\"baseUrl\":\"https://vendor.example/v1\",\"modelsPath\":\"/models\",\"catalogSpec\":{\"items\":\"/payload/models\",\"id\":\"/model_id\",\"label\":\"/title\"}}");
  assertTrue(mapper.valueToTree(service.execute(command)).path("ok").asBoolean());
  verify(endpoints).probe("e",AiModelProviderType.OPENAI_COMPATIBLE,"https://vendor.example/v1",null,
   "/models",null,catalog);
  assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"endpointProbe\",\"providerType\":\"OPENAI_COMPATIBLE\",\"baseUrl\":\"https://vendor.example/v1\",\"catalogSpec\":{\"items\":\"bad\",\"id\":\"/id\"}}")));
 }
 @Test void originalRecordsAreFilteredAndRawBodiesRemoved() throws Exception {
  var record=new AiModelUsageRecordDto("r",Instant.now(),"e","Endpoint","m","GENERAL","通用","u","Fixture",null,null,"studio","Studio",1,2,3,"TOKENS",0,0,0,false,0,"request",null,1L,"ERR",null,null,"failure","private prompt","private result",null,null,null,null);
  when(usage.records(30,"studio",null,null,null,null,false,null,500,false,false)).thenReturn(List.of(record));var result=mapper.valueToTree(service.execute(mapper.readTree("{\"action\":\"usageRecords\",\"appCode\":\"studio\",\"success\":false}"))).get(0);assertEquals("r",result.path("id").asText());assertFalse(result.has("requestBodyJson"));assertFalse(result.has("responseBodyJson"));
 }
 @Test void malformedFiltersCannotTriggerProviderOrQuery(){assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"usageRecords\",\"size\":501}")));assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"endpointTest\",\"id\":\"e\",\"url\":\"https://arbitrary.example\"}")));assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"endpointProbe\",\"providerType\":\"UNKNOWN\",\"baseUrl\":\"https://vendor.example\"}")));verifyNoInteractions(endpoints,usage);}
 @Test void paginatedCommandRejectsMalformedPagingBeforeQuery() {
  for(String json : List.of("{\"action\":\"usageRecordsPage\",\"page\":-1}", "{\"action\":\"usageRecordsPage\",\"size\":201}", "{\"action\":\"usageRecordsPage\",\"asOf\":\"bad\"}"))
   assertThrows(BusinessException.class,()->service.execute(mapper.readTree(json)));
  verifyNoInteractions(endpoints,usage);
 }

 @Test void malformedDraftProbeCannotSendArbitraryHeaders() {
  assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"endpointProbe\",\"providerType\":\"OPENAI\",\"baseUrl\":\"https://a.example/v1\",\"headers\":{}}")));
  verifyNoInteractions(endpoints, usage);
 }

 @Test void unassignedFiltersAreForwardedAndRequireBooleans() throws Exception {
  when(usage.records(30,null,null,null,null,null,null,null,500,true,true)).thenReturn(List.of());
  service.execute(mapper.readTree("{\"action\":\"usageRecords\",\"unassignedUser\":true,\"unassignedTenant\":true}"));
  verify(usage).records(30,null,null,null,null,null,null,null,500,true,true);
  assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"usageRecords\",\"unassignedUser\":\"true\"}")));
 }

}
