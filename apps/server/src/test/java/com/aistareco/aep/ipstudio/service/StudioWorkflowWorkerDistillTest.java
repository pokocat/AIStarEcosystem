package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.DapAssetService;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.skill.StudioSkillDraftSink;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Distill runs settle only together with a saved draft; a draft that cannot be saved fails the run with a full refund. */
class StudioWorkflowWorkerDistillTest {
    final ObjectMapper json = new ObjectMapper();
    final AiChatTokenPricing.Rate rate = new AiChatTokenPricing.Rate(new java.math.BigDecimal("0.18"), new java.math.BigDecimal("1.08"), 65536, 8192);

    record Harness(StudioWorkflowWorker worker, IpRun run, CreditService credits, StudioSkillDraftSink sink) {}

    Harness harness(String reply) {
        var runs = mock(IpRunRepository.class); var models = mock(AiModelInvocationService.class); var credits = mock(CreditService.class);
        var tx = mock(PlatformTransactionManager.class);
        when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        var input = json.createObjectNode().put("operation", "text").put("purpose", "skill-distill");
        var exec = input.putObject("_exec").put("systemPrompt", "system").put("userPrompt", "user").put("endpointId", "text").put("maxTokens", 8192);
        exec.set("tokenPricing", json.valueToTree(rate));
        var distill = exec.putObject("skillDistill").put("skillKey", "reference-video-recreation").put("baseVersion", 1).put("executionId", "PEX-1");
        distill.putArray("baseHeadings").add("## 分段规则");
        distill.putArray("privateFragments");
        var run = IpRun.builder().id("r").projectId("p").ownerUserId("op").kind("studio-text").status("running").cost(21).inputJson(input.toString()).build();
        when(runs.findById("r")).thenReturn(Optional.of(run)); when(runs.lockById("r")).thenReturn(Optional.of(run));
        var endpoint = AiModelEndpoint.builder().id("text").enabled(true).model("m").build();
        when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA, "text", "studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true)));
        when(models.invokeChatOnEndpoint(eq(endpoint), eq(AiModelPurpose.DAP_PERSONA), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(reply, "stop", 2000L, "m", "m", 1000L, 1000L));
        var worker = new StudioWorkflowWorker(runs, mock(StudioFixtureProvider.class), mock(FileStorageService.class), models, mock(DramaAssembleService.class), credits, json, tx, mock(DapAssetService.class));
        var sink = mock(StudioSkillDraftSink.class);
        @SuppressWarnings("unchecked") ObjectProvider<StudioSkillDraftSink> sinks = mock(ObjectProvider.class);
        when(sinks.getIfAvailable()).thenReturn(sink);
        ReflectionTestUtils.setField(worker, "skillDrafts", sinks);
        return new Harness(worker, run, credits, sink);
    }

    static final String REPLY = "{\"bodyMd\":\"# 方法\\n## 分段规则\\n- 见 https://x.example.com/a.png\",\"changeNote\":\"补了分段经验\"}";

    @Test void aDraftIsSavedInTheSettlementTransactionAndTheRunCarriesNoText() throws Exception {
        var h = harness(REPLY);
        doAnswer(i -> { ObjectNode draft = i.getArgument(1); draft.put("version", 2); draft.remove("bodyMd"); return null; }).when(h.sink()).save(any(), any());
        h.worker().runBlocking("r");
        assertEquals("done", h.run().getStatus());
        JsonNode output = json.readTree(h.run().getOutputJson());
        assertEquals(2, output.path("skillDraft").path("version").asInt());
        assertFalse(output.path("skillDraft").has("bodyMd"));
        assertFalse(output.has("text"), "the asset library must not file the draft as a text asset");
        verify(h.sink()).save(eq(h.run()), argThat(d -> !d.path("bodyMd").asText("").contains("https://") ));
        verify(h.credits()).commitHold(anyString(), eq("r"), eq(rate.settle(1000L, 1000L)), anyString());
    }

    @Test void aDraftThatCannotBeSavedFailsTheRunAndRefundsEverything() {
        var h = harness(REPLY);
        doThrow(new BusinessException(HttpStatus.NOT_FOUND, "STUDIO_SKILL_NOT_FOUND", "这个制作方法已不存在，草稿没有保存，本次未扣积分")).when(h.sink()).save(any(), any());
        h.worker().runBlocking("r");
        assertEquals("failed", h.run().getStatus());
        assertEquals("STUDIO_SKILL_NOT_FOUND", h.run().getErrorCode());
        verify(h.credits(), never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        verify(h.credits()).releaseHold(anyString(), eq("r"), anyString());
    }

    @Test void aReplyWithoutABodyFailsWithoutCharge() {
        var h = harness("{\"changeNote\":\"什么也没写\"}");
        h.worker().runBlocking("r");
        assertEquals("failed", h.run().getStatus());
        assertEquals("AI_BAD_OUTPUT", h.run().getErrorCode());
        verify(h.sink(), never()).save(any(), any());
        verify(h.credits(), never()).commitHold(anyString(), anyString(), anyLong(), anyString());
    }
}
