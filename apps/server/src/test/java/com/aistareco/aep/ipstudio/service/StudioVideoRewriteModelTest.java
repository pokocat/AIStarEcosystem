package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.h3.H3PromptRewrite;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioVideoRewriteModelTest {
    final ObjectMapper om=new ObjectMapper();
    final IpProjectService projects=mock(IpProjectService.class);
    final IpRunRepository runs=mock(IpRunRepository.class);
    final AiModelInvocationService models=mock(AiModelInvocationService.class);
    final CreditService credits=mock(CreditService.class);
    final StudioWorkflowWorker worker=mock(StudioWorkflowWorker.class);
    final AiAppSceneModelPolicyService policies=mock(AiAppSceneModelPolicyService.class);
    final AiChatTokenPricing prices=mock(AiChatTokenPricing.class);
    final StudioVideoService videos=mock(StudioVideoService.class);
    final AiModelEndpoint qwen=AiModelEndpoint.builder().id("configured-qwen").model("qwen38-27b").enabled(true).build();
    final AiChatTokenPricing.Rate rate=new AiChatTokenPricing.Rate(new BigDecimal("0.1"),new BigDecimal("0.2"),65536,8192);
    final StudioWorkflowService service=new StudioWorkflowService(projects,runs,mock(StudioFixtureProvider.class),worker,
            mock(DapPricingService.class),models,null,credits,null,null,null,null,om,null,null);

    StudioVideoRewriteModelTest() {
        ReflectionTestUtils.setField(service,"scenePolicies",policies);
        ReflectionTestUtils.setField(service,"tokenPricing",prices);
        ReflectionTestUtils.setField(service,"studioVideo",videos);
        when(models.resolveEndpoint(H3PromptRewrite.PURPOSE,null,"studio"))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(qwen,null,false)));
        when(prices.find(qwen.getId())).thenReturn(rate);
        when(videos.rewritable("h3")).thenReturn(true);
        when(videos.quote(eq("u"),any())).thenReturn(300L);
        when(projects.requiredForUpdate("u","p")).thenReturn(IpProject.builder().id("p").build());
        when(projects.readDoc(any())).thenReturn(om.createObjectNode().putArray("nodes"));
    }

    RunRequest request(String rewrite) throws Exception {
        return om.readValue("""
                {"clientRequestId":"r","nodeId":"n","operation":"video","model":"h3","prompt":"一个人走进咖啡馆",
                 "durationSec":5,"maxCost":300,"video":{"mode":"t2v","resolutionTier":"768p","rewrite":"%s"}}
                """.formatted(rewrite),RunRequest.class);
    }

    IpRun saved() throws Exception {
        var capture=ArgumentCaptor.forClass(IpRun.class);
        verify(runs).save(capture.capture());
        var run=capture.getValue();
        var exec=om.readTree(run.getInputJson()).path("_exec");
        assertEquals(qwen.getId(),exec.path("endpointId").asText());
        assertEquals(H3PromptRewrite.PURPOSE.wire(),exec.path("purpose").asText());
        assertEquals(H3PromptRewrite.MAX_TOKENS,exec.path("maxTokens").asInt());
        assertEquals(rate.limitOutputTokens(H3PromptRewrite.MAX_TOKENS).maxCost(),run.getCost());
        assertEquals(run.getCost(),exec.path("tokenPricing").path("maxCost").asLong());
        verify(credits).hold(eq("u"),eq(run.getCost()),eq(IpRunService.REF_TYPE),eq(run.getId()),anyString(),any());
        verifyNoInteractions(policies,worker);
        return run;
    }

    @ParameterizedTest @ValueSource(strings={"review","auto"})
    void canvasAndAssistantFreezeQwenRatherThanTheScriptDefault(String rewrite) throws Exception {
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.submit("u","p",request(rewrite));
            var run=saved();
            assertEquals(run.getCost(),service.videoRewriteHold());
            TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCommit());
            verify(worker).execute(run.getId());
        } finally {TransactionSynchronizationManager.clearSynchronization();}
    }

    @Test void directorRewriteIgnoresTheChosenTextModelAndUsesTheSameQuote() throws Exception {
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.submitDirectorText("u","w","videoPrompt:c","system","user",H3PromptRewrite.MAX_TOKENS,"r",
                    om.createObjectNode().put("task","videoPrompt"),"deepseek",null,service.videoRewriteHold());
            saved();
        } finally {TransactionSynchronizationManager.clearSynchronization();}
    }


    @Test void changingTheBackendBindingChangesTheEndpointAndRate() throws Exception {
        var other=AiModelEndpoint.builder().id("another-bound-model").model("another-model").enabled(true).build();
        var otherRate=new AiChatTokenPricing.Rate(new BigDecimal("0.3"),new BigDecimal("0.4"),65536,8192);
        when(models.resolveEndpoint(H3PromptRewrite.PURPOSE,null,"studio"))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(other,null,true)));
        when(prices.find(other.getId())).thenReturn(otherRate);
        assertEquals(otherRate.limitOutputTokens(H3PromptRewrite.MAX_TOKENS).maxCost(),service.videoRewriteHold());
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.submit("u","p",request("review"));
            var capture=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(capture.capture());
            var exec=om.readTree(capture.getValue().getInputJson()).path("_exec");
            assertEquals(other.getId(),exec.path("endpointId").asText());
            assertEquals(service.videoRewriteHold(),capture.getValue().getCost());
            verifyNoInteractions(policies);
        } finally {TransactionSynchronizationManager.clearSynchronization();}
    }

    @Test void unavailableQwenFailsBeforeChargingRatherThanFallingBack() throws Exception {
        when(models.resolveEndpoint(H3PromptRewrite.PURPOSE,null,"studio")).thenReturn(Optional.empty());
        var request=request("review");
        assertEquals("ENDPOINT_NOT_ALLOWED",assertThrows(BusinessException.class,()->service.submit("u","p",request)).getCode());
        assertThrows(BusinessException.class,()->service.videoRewriteHold());
        verifyNoInteractions(credits,worker,policies);
        verify(runs,never()).save(any());
    }
}
