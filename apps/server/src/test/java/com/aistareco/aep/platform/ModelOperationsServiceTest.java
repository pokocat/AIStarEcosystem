package com.aistareco.aep.platform;
import com.aistareco.aep.dto.AiModelUsageRecordDto;
import com.aistareco.aep.dto.AiModelDiscoveryResultDto;
import com.aistareco.aep.dto.AiModelEntryDto;
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
 @Test void originalRecordsAreFilteredAndRawBodiesRemoved() throws Exception {
  var record=new AiModelUsageRecordDto("r",Instant.now(),"e","Endpoint","m","GENERAL","通用","u","Fixture",null,null,"studio","Studio",1,2,3,"TOKENS",0,0,0,false,0,"request",null,1L,"ERR",null,null,"failure","private prompt","private result",null,null,null,null);
  when(usage.records(30,"studio",null,null,null,null,false,null,500)).thenReturn(List.of(record));var result=mapper.valueToTree(service.execute(mapper.readTree("{\"action\":\"usageRecords\",\"appCode\":\"studio\",\"success\":false}"))).get(0);assertEquals("r",result.path("id").asText());assertFalse(result.has("requestBodyJson"));assertFalse(result.has("responseBodyJson"));
 }
 @Test void malformedFiltersCannotTriggerProviderOrQuery(){assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"usageRecords\",\"size\":501}")));assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"endpointTest\",\"id\":\"e\",\"url\":\"https://arbitrary.example\"}")));verifyNoInteractions(endpoints,usage);}
 @Test void paginatedCommandRejectsMalformedPagingBeforeQuery() {
  for(String json : List.of("{\"action\":\"usageRecordsPage\",\"page\":-1}", "{\"action\":\"usageRecordsPage\",\"size\":201}", "{\"action\":\"usageRecordsPage\",\"asOf\":\"bad\"}"))
   assertThrows(BusinessException.class,()->service.execute(mapper.readTree(json)));
  verifyNoInteractions(endpoints,usage);
 }

 @Test void draftProbeUsesCurrentValuesAndDoesNotExposeVendorErrors() throws Exception {
  var req = new com.aistareco.aep.dto.AiModelDiscoveryRequestDto("OPENAI", "https://8.8.8.8/v1", "fixture-key");
  when(endpoints.probeDraft(null, req)).thenReturn(AiModelDiscoveryResultDto.ok(200,List.of(new AiModelEntryDto("m","Model",null,null))));
  var command=mapper.readTree("{\"action\":\"endpointProbe\",\"providerType\":\"OPENAI\",\"baseUrl\":\"https://8.8.8.8/v1\",\"apiKey\":\"fixture-key\"}");
  var result=mapper.valueToTree(service.execute(command));
  assertTrue(result.path("ok").asBoolean()); assertEquals("m",result.path("models").get(0).path("id").asText());
  assertTrue(result.path("latencyMs").asLong()>=0); verifyNoInteractions(usage);
  when(endpoints.probeDraft(null, req)).thenReturn(AiModelDiscoveryResultDto.fail(401,"fixture-key echoed by vendor"));
  result=mapper.valueToTree(service.execute(command)); assertFalse(result.toString().contains("fixture-key")); assertEquals(401,result.path("statusCode").asInt());
 }
 @Test void malformedDraftProbeCannotSendArbitraryHeaders() {
  assertThrows(BusinessException.class,()->service.execute(mapper.readTree("{\"action\":\"endpointProbe\",\"providerType\":\"OPENAI\",\"baseUrl\":\"https://a.example/v1\",\"headers\":{}}")));
  verifyNoInteractions(endpoints, usage);
 }

}
