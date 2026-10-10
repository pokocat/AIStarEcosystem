package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.dto.PromptParamsDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class StudioScenePriceTest {
 @Test void textPolicyPriceAndEndpointAreSavedBeforeDispatch() throws Exception {
  var om=new ObjectMapper();var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);
  var fixture=mock(StudioFixtureProvider.class);var worker=mock(StudioWorkflowWorker.class);var price=mock(DapPricingService.class);
  when(price.ipIdentity()).thenReturn(2L);var models=mock(AiModelInvocationService.class);var credits=mock(CreditService.class);var prompts=mock(PromptService.class);
  when(projects.requiredForUpdate("u","p")).thenReturn(IpProject.builder().id("p").build());
  when(runs.findByProjectIdAndClientRequestId("p","request")).thenReturn(java.util.Optional.empty());
  when(prompts.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt("system","{{input}}",new PromptParamsDto(null,null,null),"resource"));
  when(projects.toRunDto(any())).thenReturn(null);
  var service=new StudioWorkflowService(projects,runs,fixture,worker,price,models,null,credits,null,null,null,null,om,null,prompts);
  var policies=mock(AiAppSceneModelPolicyService.class);var ep=AiModelEndpoint.builder().id("fixed-text").enabled(true).build();
  when(policies.resolve("studio","script",null,2L)).thenReturn(new AiAppSceneModelPolicyService.Selection(new AiModelInvocationService.ResolvedEndpoint(ep,null,true),17L,"per_call"));
  org.springframework.test.util.ReflectionTestUtils.setField(service,"scenePolicies",policies);
  var json=om.readTree("{\"clientRequestId\":\"request\",\"nodeId\":\"node\",\"operation\":\"script\",\"prompt\":\"故事\",\"maxCost\":17}");
  TransactionSynchronizationManager.initSynchronization();
  try {service.submit("u","p",om.treeToValue(json,RunRequest.class));}finally{TransactionSynchronizationManager.clearSynchronization();}
  var captured=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(captured.capture());var run=captured.getValue();
  var exec=om.readTree(run.getInputJson()).path("_exec");assertEquals("fixed-text",exec.path("endpointId").asText());assertEquals(17,exec.path("unitCost").asLong());assertEquals(17,run.getCost());
  verify(credits).hold(eq("u"),eq(17L),eq(IpRunService.REF_TYPE),eq(run.getId()),anyString());verifyNoInteractions(worker);
 }
}
