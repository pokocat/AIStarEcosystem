package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.DapAssetService;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioWorkflowWorkerJsonTest {
    private final ObjectMapper json = new ObjectMapper();

    record Harness(StudioWorkflowWorker worker, IpRun run, AiModelInvocationService models,
                   CreditService credits, StudioRunErrorLog errors) {}

    Harness harness(String reply, String finish) {
        var runs = mock(IpRunRepository.class);
        var models = mock(AiModelInvocationService.class);
        var credits = mock(CreditService.class);
        var tx = mock(PlatformTransactionManager.class);
        when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        var input = json.createObjectNode().put("operation", "director");
        input.putObject("_director").put("task", "script").put("draftRev", 0);
        var exec = input.putObject("_exec").put("systemPrompt", "编剧").put("userPrompt", "创意").put("endpointId", "qwen");
        exec.set("tokenPricing", json.valueToTree(new AiChatTokenPricing.Rate(new BigDecimal("0.18"), new BigDecimal("1.08"), 65536, 8192)));
        var run = IpRun.builder().id("r").projectId("work").ownerUserId("u").hostType("director").nodeId("script")
                .kind("studio-director").status("running").cost(21).inputJson(input.toString()).build();
        when(runs.findById("r")).thenReturn(Optional.of(run));
        when(runs.lockById("r")).thenReturn(Optional.of(run));
        var endpoint = AiModelEndpoint.builder().id("qwen").providerType(AiModelProviderType.DEEPSEEK).enabled(true).build();
        when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA, "qwen", "studio"))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true)));
        when(models.invokeChatOnEndpoint(eq(endpoint), eq(AiModelPurpose.DAP_PERSONA), anyList(), anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(reply, finish, 2000L, "qwen", "qwen", 1000L, 1000L));
        var worker = new StudioWorkflowWorker(runs, mock(StudioFixtureProvider.class), mock(FileStorageService.class), models,
                mock(DramaAssembleService.class), credits, json, tx, mock(DapAssetService.class));
        var errors = mock(StudioRunErrorLog.class);
        ReflectionTestUtils.setField(worker, "errorLog", errors);
        return new Harness(worker, run, models, credits, errors);
    }

    private void runOnce(Harness h) {
        h.worker().runBlocking("r");
        h.worker().runBlocking("r");
        verify(h.models(), times(1)).invokeChatOnEndpoint(any(), any(), anyList(), anyMap());
    }

    @Test void deepSeekDirectorScriptDisablesThinking() {
        var h = harness("{\"title\":\"完整剧本\",\"content\":\"深夜便利店里，两个人终于把多年的误会说开，然后一起收拾散落满地的货物。\"}", "stop");
        runOnce(h);
        @SuppressWarnings("unchecked") var options = (java.util.Map<String,Object>) mockingDetails(h.models()).getInvocations().stream()
                .filter(i -> i.getMethod().getName().equals("invokeChatOnEndpoint")).findFirst().orElseThrow().getArgument(3);
        assertEquals("disabled", ((java.util.Map<?,?>) options.get("thinking")).get("type"));
    }

    @Test void repairedScriptUsesOriginalModelOutputAndSettlesItsUsageExactlyOnce() throws Exception {
        var h = harness("{\"title\":\"账本\",\"content\":\"两人相视一笑，没有言语。\\远处，孩子们的笑声传来，清脆悦耳。\"", "stop");
        runOnce(h);
        assertEquals("done", h.run().getStatus());
        assertEquals("两人相视一笑，没有言语。远处，孩子们的笑声传来，清脆悦耳。",
                json.readTree(h.run().getOutputJson()).path("director").path("content").asText());
        assertEquals(2, h.run().getCost());
        verify(h.credits()).commitHold(eq(IpRunService.REF_TYPE), eq("r"), eq(2L), anyString(), org.mockito.ArgumentMatchers.any());
        verify(h.credits()).releaseHold(eq(IpRunService.REF_TYPE), eq("r"), anyString());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"content\":\"半句话", "{\"content\":\"未知\\q转义\"}", "{\"content\":\"正文\",,}", "{\"content\":1 \"title\":2}"})
    void unrecoverableJsonExplainsTheFormatFailureAndRefundsWithoutRetry(String reply) {
        var h = harness(reply, "stop");
        runOnce(h);
        assertEquals("failed", h.run().getStatus());
        assertEquals("AI_BAD_OUTPUT", h.run().getErrorCode());
        // The wording is the regression: a parser error used to become only "这次创作没有完成，请重试".
        assertTrue(h.run().getErrorMessage().contains("格式有误"));
        assertTrue(h.run().getErrorMessage().contains("无法自动恢复"));
        assertTrue(h.run().getErrorMessage().contains("未扣积分"));
        assertFalse(h.run().getErrorMessage().contains("JsonParseException"));
        assertEquals(0, h.run().getCost());
        verify(h.credits()).releaseHold(eq(IpRunService.REF_TYPE), eq("r"), anyString());
        verify(h.credits(), never()).commitHold(anyString(), anyString(), anyLong(), anyString(), org.mockito.ArgumentMatchers.any());
        verify(h.errors()).attach(eq(h.run()), argThat(e -> e instanceof BusinessException && e.getCause() instanceof JsonProcessingException));
    }

    @Test void lengthTerminationCannotBeRepairedIntoSuccess() {
        var h = harness("{\"content\":\"这一段看起来完整，但后面其实还没有返回，不能靠补括号冒充成功。\"", "length");
        runOnce(h);
        assertEquals("failed", h.run().getStatus());
        assertEquals("AI_BAD_OUTPUT", h.run().getErrorCode());
        assertTrue(h.run().getErrorMessage().contains("截断"));
        assertEquals(0, h.run().getCost());
        verify(h.credits()).releaseHold(eq(IpRunService.REF_TYPE), eq("r"), anyString());
        verify(h.credits(), never()).commitHold(anyString(), anyString(), anyLong(), anyString(), org.mockito.ArgumentMatchers.any());
    }

    @Test void syntaxRecoveryDoesNotBypassBusinessValidation() {
        var h = harness("{\"title\":\"缺少剧本正文\",}", "stop");
        runOnce(h);
        assertEquals("failed", h.run().getStatus());
        assertEquals("AI_BAD_OUTPUT", h.run().getErrorCode());
        assertEquals(0, h.run().getCost());
        verify(h.credits(), never()).commitHold(anyString(), anyString(), anyLong(), anyString(), org.mockito.ArgumentMatchers.any());
    }
}
