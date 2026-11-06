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

    private Harness sceneDirector() throws Exception {
        var h = harness("", "stop");
        var input = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(h.run().getInputJson());
        input.put("operation", "text").remove("_director");
        input.putObject("scene").put("kind", "video-script");
        h.run().setInputJson(input.toString()); h.run().setKind("studio-text"); h.run().setHostType(null);
        return h;
    }

    @Test void sceneDirectorStoppedBeforeTheModelIsCalledReleasesTheWholeHold() throws Exception {
        var h = sceneDirector();
        var endpoint = AiModelEndpoint.builder().id("qwen").providerType(AiModelProviderType.DEEPSEEK).enabled(true).build();
        when(h.models().resolveAcceptedEndpoint(any(), any(), any())).thenAnswer(call -> {
            h.run().setCancelRequested(true);
            return Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true));
        });
        h.worker().runBlocking("r");
        verify(h.models(), never()).invokeChatCancellable(any(), any(), anyList(), anyMap(), any());
        assertEquals("IP_RUN_CANCELLED", h.run().getErrorCode());
        verify(h.credits()).releaseHold(anyString(), eq("r"), anyString());
        verify(h.credits(), never()).commitHold(anyString(), anyString(), anyLong(), anyString(), any());
    }

    @Test void sceneDirectorStoppedMidStreamSettlesTheEstimateAndReleasesTheRest() throws Exception {
        var h = sceneDirector();
        when(h.models().invokeChatCancellable(any(), any(), anyList(), anyMap(), any())).thenAnswer(call -> {
            h.run().setCancelRequested(true);
            assertTrue(((java.util.function.BooleanSupplier) call.getArgument(4)).getAsBoolean());
            // 半截正文不是 JSON，不能因为解析失败就退成全额释放。
            return new AiModelInvocationService.AiModelResponse("{\"summary\":\"写到一半", "cancelled", 2000L, "qwen", "qwen", 1000L, 1000L, null, true);
        });
        h.worker().runBlocking("r"); h.worker().runBlocking("r");
        assertEquals("failed", h.run().getStatus());
        assertEquals("IP_RUN_CANCELLED", h.run().getErrorCode());
        assertTrue(h.run().getErrorMessage().contains("生成的内容"));
        var output = json.readTree(h.run().getOutputJson());
        assertFalse(output.has("textRevision"));
        assertTrue(output.path("billing").path("usageEstimated").asBoolean());
        verify(h.credits(), times(1)).commitHold(eq(IpRunService.REF_TYPE), eq("r"), anyLong(), anyString(), any());
        verify(h.credits(), times(1)).releaseHold(eq(IpRunService.REF_TYPE), eq("r"), anyString());
    }

    @Test void sceneDirectorThatTimesOutReleasesInsteadOfWaitingForever() throws Exception {
        var h = sceneDirector();
        h.run().setHeartbeatAt(java.time.Instant.EPOCH);
        h.run().setStartedAt(java.time.Instant.EPOCH);
        assertTrue(h.worker().expire("r", java.time.Instant.now()));
        assertEquals("IP_RUN_TIMEOUT", h.run().getErrorCode());
        verify(h.credits()).releaseHold(anyString(), eq("r"), anyString());
    }

    @Test void sceneDirectorDiscardsALateReplyAndSettlesItsMeasuredUsageExactlyOnce() throws Exception {
        var h = sceneDirector();
        when(h.models().invokeChatCancellable(any(), any(), anyList(), anyMap(), any())).thenAnswer(call -> {
            h.run().setCancelRequested(true);
            return new AiModelInvocationService.AiModelResponse("late script", "stop", 2000L, "qwen", "qwen", 1000L, 1000L);
        });
        h.worker().runBlocking("r"); h.worker().runBlocking("r");
        assertEquals("IP_RUN_CANCELLED", h.run().getErrorCode());
        var output = json.readTree(h.run().getOutputJson());
        assertFalse(output.has("textRevision"));
        assertEquals(1000, output.path("billing").path("outputTokens").asLong());
        verify(h.credits(), times(1)).commitHold(eq(IpRunService.REF_TYPE), eq("r"), anyLong(), anyString(), any());
    }

    private void runOnce(Harness h) {
        h.worker().runBlocking("r");
        h.worker().runBlocking("r");
        verify(h.models(), times(1)).invokeChatOnEndpoint(any(), any(), anyList(), anyMap());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"3430,69396,76,21", "1000,9000,10,10", "70000,1000,14,14"})
    void completedScriptSurvivesProviderTokenAndInvoiceOverruns(long in,long out,long actual,long charged) throws Exception {
        String reply="{\"title\":\"完整剧本\",\"content\":\"深夜便利店里，两个人终于把多年的误会说开，然后一起收拾散落满地的货物。\"}";
        var h=harness(reply,"stop");
        when(h.models().invokeChatOnEndpoint(any(),any(),anyList(),anyMap())).thenReturn(
                new AiModelInvocationService.AiModelResponse(reply,"stop",in+out,"qwen","qwen",in,out));
        runOnce(h);
        assertEquals("done",h.run().getStatus());assertNull(h.run().getErrorCode());
        var output=json.readTree(h.run().getOutputJson());
        assertEquals("完整剧本",output.path("director").path("title").asText());
        assertEquals(in,output.path("billing").path("inputTokens").asLong());
        assertEquals(out,output.path("billing").path("outputTokens").asLong());
        assertEquals(charged,h.run().getCost());
        if(actual>charged)assertEquals(actual-charged,output.path("billing").path("platformCoveredCredits").asLong());
        verify(h.credits(),times(1)).commitHold(eq(IpRunService.REF_TYPE),eq("r"),eq(charged),anyString(),any());
        verifyNoInteractions(h.errors());
    }

    @Test void longScriptContentIsPreservedBeyond64000Characters() throws Exception {
        String content="这是剧本中的一个场景。".repeat(7000);
        String reply=json.createObjectNode().put("title","长剧本").put("content",content).toString();
        var h=harness(reply,"stop");
        when(h.models().invokeChatOnEndpoint(any(),any(),anyList(),anyMap())).thenReturn(
                new AiModelInvocationService.AiModelResponse(reply,"stop",72826L,"qwen","qwen",3430L,69396L));
        runOnce(h);
        assertEquals("done",h.run().getStatus());
        assertEquals(content,json.readTree(h.run().getOutputJson()).path("director").path("content").asText());
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
    @ValueSource(strings={"普通正文，没有 JSON。", "{\"content\":\"半句话", "{\"content\":\"未知\\q转义\"}", "{\"title\":\"只有标题\",}"})
    void unstructuredOutputIsDeliveredAndRetainedWithoutAnotherModelCall(String reply) throws Exception {
        var h=harness(reply,"stop");runOnce(h);
        assertEquals("done",h.run().getStatus());assertNull(h.run().getErrorCode());
        var out=json.readTree(h.run().getOutputJson());
        assertEquals(reply,out.path("rawResponse").path("content").asText());
        assertFalse(out.path("text").asText().isBlank());
        assertFalse(out.path("warnings").isEmpty());
        assertEquals(2,h.run().getCost());
    }
    @Test void lengthTerminationPreservesReturnedTextAndWarnsThatItMayBeIncomplete() throws Exception {
        String reply="{\"content\":\"已写完的这一段\"}";
        var h=harness(reply,"length");runOnce(h);
        assertEquals("done",h.run().getStatus());
        var out=json.readTree(h.run().getOutputJson());
        assertEquals(reply,out.path("rawResponse").path("content").asText());
        assertEquals("已写完的这一段",out.path("director").path("content").asText());
        assertFalse(out.path("warnings").isEmpty());
    }
    @Test void missingUsageKeepsTheScriptAndReleasesTheHoldWithoutInventingUsage() throws Exception {
        String reply="{\"title\":\"短片\",\"content\":\"门开了。她没回头。\"}";
        var h=harness(reply,"stop");
        when(h.models().invokeChatOnEndpoint(any(),any(),anyList(),anyMap())).thenReturn(
                new AiModelInvocationService.AiModelResponse(reply,"stop",null,"qwen","qwen",null,null));
        runOnce(h);assertEquals("done",h.run().getStatus());assertEquals(0,h.run().getCost());
        var out=json.readTree(h.run().getOutputJson());
        assertEquals("门开了。她没回头。",out.path("director").path("content").asText());
        assertTrue(out.path("billingUnknown").asBoolean());
        verify(h.credits(),never()).commitHold(anyString(),anyString(),anyLong(),anyString(),any());
        verify(h.credits()).releaseHold(eq(IpRunService.REF_TYPE),eq("r"),anyString());
    }
    @Test void genuinelyEmptyContentStillFails() {
        var h=harness("","stop");runOnce(h);assertEquals("failed",h.run().getStatus());
    }
}
