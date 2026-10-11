package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.*;
import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioTextWorkflowTest {
    final ObjectMapper json=new ObjectMapper();
    @Test void intentAndSourceAreFrozenWithConfiguredModelPriceBeforeAfterCommitDispatch() throws Exception {
        var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);var models=mock(AiModelInvocationService.class);
        var credits=mock(CreditService.class);var pricing=mock(DapPricingService.class);var prompts=mock(PromptService.class);var worker=mock(StudioWorkflowWorker.class);
        var project=IpProject.builder().id("p").build();when(projects.requiredForUpdate("u","p")).thenReturn(project);
        when(projects.readDoc(project)).thenReturn(json.readTree("{\"nodes\":[{\"id\":\"text\",\"type\":\"text\",\"metadata\":{\"content\":\"原文\"}}]}"));
        when(runs.findByProjectIdAndClientRequestId(anyString(),anyString())).thenReturn(Optional.empty());when(pricing.ipIdentity()).thenReturn(2L);
        var endpoint=AiModelEndpoint.builder().id("agnes-text").enabled(true).build();
        when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"agnes-text")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        when(prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_ASSISTANT)).thenReturn(new PromptService.ResolvedPrompt("assistant","{{input}}",new PromptParamsDto(null,null,null),"resource"));
        var service=new StudioWorkflowService(projects,runs,mock(StudioFixtureProvider.class),worker,pricing,models,null,credits,null,null,null,null,json,null,prompts);
        var request=json.readValue("{\"clientRequestId\":\"key\",\"nodeId\":\"text\",\"operation\":\"text\",\"prompt\":\"起一个标题\",\"model\":\"agnes-text\",\"maxCost\":2,\"textEdit\":{\"content\":\"原文\"}}",RunRequest.class);
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.submit("u","p",request);verifyNoInteractions(worker);
            var capture=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(capture.capture());var run=capture.getValue();var input=json.readTree(run.getInputJson());
            assertEquals("text",run.getNodeId());assertEquals("studio-text",run.getKind());assertEquals("原文",input.path("textEdit").path("content").asText());
            assertEquals("agnes-text",input.path("_exec").path("endpointId").asText());assertTrue(input.path("_exec").path("userPrompt").asText().contains("起一个标题"));
            assertTrue(input.path("_exec").path("userPrompt").asText().contains("原文"));assertTrue(input.path("_exec").path("systemPrompt").asText().contains(StudioTextRevision.CONTRACT));
            verify(credits).hold(eq("u"),eq(2L),eq(IpRunService.REF_TYPE),eq(run.getId()),anyString());
            TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCommit());verify(worker).execute(run.getId());
        } finally {TransactionSynchronizationManager.clearSynchronization();}
    }
    @Test void providerRevisionSettlesOnceAndBadOutputReleasesTheHold() throws Exception {
        for(boolean invalid:new boolean[]{false,true}) {
            var runs=mock(IpRunRepository.class);var models=mock(AiModelInvocationService.class);var credits=mock(CreditService.class);var tx=mock(PlatformTransactionManager.class);
            when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
            var run=IpRun.builder().id("r").kind("studio-text").status("running").cost(2).inputJson("{\"operation\":\"text\",\"textEdit\":{\"content\":\"原文\"},\"_exec\":{\"systemPrompt\":\"text\",\"userPrompt\":\"起标题 + 原文\",\"endpointId\":\"text\"}}").build();
            when(runs.findById("r")).thenReturn(Optional.of(run));when(runs.lockById("r")).thenReturn(Optional.of(run));
            var endpoint=AiModelEndpoint.builder().id("text").enabled(true).build();when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"text")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
            when(models.invokeChatOnEndpoint(eq(endpoint),eq(AiModelPurpose.DAP_PERSONA),anyList(),anyMap())).thenReturn(new AiModelInvocationService.AiModelResponse(invalid?"{}":"{\"summary\":\"添加标题\",\"content\":\"雨夜\\n原文\"}","stop",12L,"text","text"));
            var worker=new StudioWorkflowWorker(runs,mock(StudioFixtureProvider.class),mock(FileStorageService.class),models,mock(DramaAssembleService.class),credits,json,tx,mock(DapAssetService.class));
            worker.runBlocking("r");worker.runBlocking("r");verify(models,times(1)).invokeChatOnEndpoint(eq(endpoint),eq(AiModelPurpose.DAP_PERSONA),anyList(),anyMap());
            if(invalid){assertEquals("failed",run.getStatus());assertEquals("AI_BAD_OUTPUT",run.getErrorCode());assertEquals(0,run.getCost());verify(credits).releaseHold(anyString(),eq("r"),anyString());verify(credits,never()).commitHold(anyString(),anyString(),anyLong(),anyString());}
            else {assertEquals("done",run.getStatus());assertEquals("雨夜\n原文",json.readTree(run.getOutputJson()).path("textRevision").path("content").asText());verify(credits,times(1)).commitHold(anyString(),eq("r"),eq(2L),anyString());}
        }
    }
}
