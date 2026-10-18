package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.PostMessageRequest;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Post-message rules: idempotency, context checks, steering while busy, the price gate and afterCommit dispatch. */
class StudioDialogueServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final IpProjectService projects = mock(IpProjectService.class);
    private final IpRunRepository runs = mock(IpRunRepository.class);
    private final IpDialogueThreadRepository threads = mock(IpDialogueThreadRepository.class);
    private final IpDialogueMessageRepository messages = mock(IpDialogueMessageRepository.class);
    private final IpDialogueSteeringRepository steering = mock(IpDialogueSteeringRepository.class);
    private final StudioDialogueTurnWorker worker = mock(StudioDialogueTurnWorker.class);
    private final StudioFixtureProvider fixtures = mock(StudioFixtureProvider.class);
    private final AiModelInvocationService models = mock(AiModelInvocationService.class);
    private final PromptService prompts = mock(PromptService.class);
    private final CreditService credits = mock(CreditService.class);
    private final PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
    private final IpDialogueThread thread = IpDialogueThread.builder().id("IPT-P1").projectId("P1").ownerUserId("u1")
            .createdAt(Instant.now()).updatedAt(Instant.now()).lastOpenedAt(Instant.now()).build();
    private StudioDialogueService service;

    @BeforeEach void setUp() {
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        var project = IpProject.builder().id("P1").ownerUserId("u1").docJson("{\"nodes\":[{\"id\":\"n1\",\"type\":\"text\",\"title\":\"文案\"}],\"connections\":[]}").build();
        when(projects.required("u1", "P1")).thenReturn(project);
        when(projects.requiredForUpdate("u1", "P1")).thenReturn(project);
        when(projects.readDoc(project)).thenAnswer(i -> mapper.readTree(project.getDocJson()));
        when(threads.findById("IPT-P1")).thenReturn(Optional.of(thread));
        when(threads.lockById("IPT-P1")).thenReturn(Optional.of(thread));
        when(messages.findByThreadIdAndClientMessageId(anyString(), anyString())).thenReturn(Optional.empty());
        when(messages.save(any())).thenAnswer(i -> i.getArgument(0));
        var store = new StudioDialogueStore(threads, messages, mock(IpDialogueEventRepository.class), new StudioDialogueEventHub(), mapper, manager);
        service = new StudioDialogueService(projects, runs, mock(IpRunService.class), threads, messages, steering, store, worker,
                new StudioDialogueSignals(), new StudioSkillCatalog(), fixtures, models, prompts, mock(DapPricingService.class), credits, mapper, manager);
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach void clear() { if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization(); }

    private PostMessageRequest request(String id, String text, Long maxCost) { return new PostMessageRequest(id, text, null, null, null, null, null, maxCost, null); }

    @Test void busyThreadQueuesTheMessageAsSteeringAndStartsNoSecondTurn() {
        thread.setActiveTurnId("TRN-1"); thread.setActiveRunId("IPR-1");
        when(runs.findById("IPR-1")).thenReturn(Optional.of(IpRun.builder().id("IPR-1").status("running").heartbeatAt(Instant.now()).build()));
        var result = service.post("u1", "P1", "IPT-P1", request("c-1", "第3段换成这张图", 5L));
        assertEquals("queued", result.queueState());
        assertEquals("TRN-1", result.turnId());
        var row = ArgumentCaptor.forClass(IpDialogueSteering.class);
        verify(steering).save(row.capture());
        assertEquals(IpDialogueSteering.QUEUED, row.getValue().getStatus());
        verify(runs, never()).save(any());
        verifyNoInteractions(credits);
    }

    @Test void resendingTheSameMessageIsIdempotentAndAChangedBodyIs409() {
        var prior = IpDialogueMessage.builder().id("IDM-1").threadId("IPT-P1").seq(1).role("user").text("你好").status("done").turnId("TRN-1").runId("IPR-1")
                .pinnedNodeIdsJson("[]").attachmentNodeIdsJson("[]").createdAt(Instant.now()).build();
        when(messages.findByThreadIdAndClientMessageId("IPT-P1", "c-1")).thenReturn(Optional.of(prior));
        var same = service.post("u1", "P1", "IPT-P1", request("c-1", "你好", 5L));
        assertEquals("IDM-1", same.messageId());
        assertEquals("accepted", same.queueState());
        var e = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1", request("c-1", "你好呀", 5L)));
        assertEquals("STUDIO_REQUEST_CHANGED", e.getCode());
        assertEquals(409, e.getStatus().value());
        verify(runs, never()).save(any());
    }

    @Test void pinnedNodesMustExistOnTheCanvas() {
        var e = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1",
                new PostMessageRequest("c-2", "看看这个", List.of("missing"), null, null, null, null, 5L, null)));
        assertEquals("STUDIO_CONTEXT_NOT_FOUND", e.getCode());
    }

    @Test void anotherUsersThreadIsNotFound() {
        thread.setOwnerUserId("someone-else");
        var e = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1", request("c-3", "你好", 5L)));
        assertEquals("STUDIO_THREAD_NOT_FOUND", e.getCode());
    }

    @Test void fixtureTurnIsFreeAndDispatchedOnlyAfterCommit() {
        when(fixtures.enabled()).thenReturn(true);
        var result = service.post("u1", "P1", "IPT-P1", request("c-4", "你好", null));
        assertEquals("accepted", result.queueState());
        var run = ArgumentCaptor.forClass(IpRun.class);
        verify(runs).save(run.capture());
        assertEquals("studio-dialogue", run.getValue().getKind());
        assertEquals("IPT-P1", run.getValue().getNodeId());
        assertEquals(0L, run.getValue().getCost());
        assertEquals(result.runId(), thread.getActiveRunId());
        verifyNoInteractions(credits);
        verify(worker, never()).execute(anyString());
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(worker).execute(result.runId());
    }

    @Test void approvalConfirmationMustPointAtTheAssistantCardOnThisUsersThread() {
        String card = "[{\"type\":\"approval\",\"approvalId\":\"APV-1\",\"status\":\"pending\",\"planFingerprint\":\"fp\",\"expiresAt\":\"" + Instant.now().plusSeconds(600) + "\"}]";
        var assistant = IpDialogueMessage.builder().id("IDM-A").threadId("IPT-P1").seq(2).role("assistant").blocksJson(card).status("done").createdAt(Instant.now()).build();
        var user = IpDialogueMessage.builder().id("IDM-U").threadId("IPT-P1").seq(1).role("user").blocksJson(card).status("done").createdAt(Instant.now()).build();
        when(messages.findById("IDM-A")).thenReturn(Optional.of(assistant));
        when(messages.findById("IDM-U")).thenReturn(Optional.of(user));
        var ok = service.requireApproval("u1", "P1", "IDM-A", "APV-1");
        assertEquals("IPT-P1", ok.path("threadId").asText());
        assertEquals("fp", ok.path("planFingerprint").asText());
        assertEquals("STUDIO_APPROVAL_NOT_FOUND", assertThrows(BusinessException.class, () -> service.requireApproval("u1", "P1", "IDM-U", "APV-1")).getCode());
        assertEquals("STUDIO_APPROVAL_NOT_FOUND", assertThrows(BusinessException.class, () -> service.requireApproval("u1", "P1", "IDM-A", "APV-2")).getCode());
        assertEquals("STUDIO_APPROVAL_NOT_FOUND", assertThrows(BusinessException.class, () -> service.requireApproval("u2", "P1", "IDM-A", "APV-1")).getCode());
        assistant.setBlocksJson(card.replace("pending", "superseded"));
        assertEquals("STUDIO_PLAN_STALE", assertThrows(BusinessException.class, () -> service.requireApproval("u1", "P1", "IDM-A", "APV-1")).getCode());
    }

    @Test void aModelChoiceIsIgnoredWhereTheSceneIsFixed() {
        var scenes = mock(AiAppSceneModelPolicyService.class);
        var endpoint = AiModelEndpoint.builder().id("ep-1").name("对话").enabled(true).build();
        when(scenes.mode("studio", "script")).thenReturn("fixed");
        when(scenes.resolve(eq("studio"), eq("script"), isNull(), anyLong()))
                .thenReturn(new AiAppSceneModelPolicyService.Selection(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true), 2, "per_call"));
        ReflectionTestUtils.setField(service, "scenePolicies", scenes);
        when(prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_DIALOGUE))
                .thenReturn(new PromptService.ResolvedPrompt("系统", "{{input}}", new PromptParamsDto(null, null, null), "resource"));
        var e = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1",
                new PostMessageRequest("c-9", "你好", null, null, null, null, null, 50L, "ep-other")));
        assertEquals("AI_TOKEN_PRICE_NOT_CONFIGURED", e.getCode(), "resolved the scene default, not the requested model");
        verify(scenes).resolve(eq("studio"), eq("script"), isNull(), anyLong());
    }

    @Test void realTurnNeedsATokenPriceAndTheApprovedCeiling() {
        var endpoint = AiModelEndpoint.builder().id("ep-1").name("对话").enabled(true).build();
        when(models.resolveEndpoint(eq(AiModelPurpose.DAP_PERSONA), isNull(), eq("studio")))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true)));
        when(prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_DIALOGUE))
                .thenReturn(new PromptService.ResolvedPrompt("系统", "{{input}}", new PromptParamsDto(null, null, null), "resource"));
        var noPrice = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1", request("c-5", "你好", 50L)));
        assertEquals("AI_TOKEN_PRICE_NOT_CONFIGURED", noPrice.getCode());

        var pricing = mock(AiChatTokenPricing.class);
        var rate = new AiChatTokenPricing.Rate(BigDecimal.ONE, BigDecimal.valueOf(2), 10_000, 2_000); // maxCost = 14
        when(pricing.find("ep-1")).thenReturn(rate);
        ReflectionTestUtils.setField(service, "tokenPricing", pricing);
        var missingCeiling = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1", request("c-6", "你好", null)));
        assertEquals("STUDIO_PRICE_CHANGED", missingCeiling.getCode());
        var lowCeiling = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1", request("c-7", "你好", 13L)));
        assertEquals("STUDIO_PRICE_CHANGED", lowCeiling.getCode());
        verifyNoInteractions(credits);

        var ok = service.post("u1", "P1", "IPT-P1", request("c-8", "你好", 14L));
        verify(credits).hold(eq("u1"), eq(14L), eq(IpRunService.REF_TYPE), eq(ok.runId()), anyString());
        var run = ArgumentCaptor.forClass(IpRun.class);
        verify(runs).save(run.capture());
        assertEquals(14L, run.getValue().getCost());
        assertTrue(run.getValue().getInputJson().contains("\"tokenPricing\""));
    }
}
