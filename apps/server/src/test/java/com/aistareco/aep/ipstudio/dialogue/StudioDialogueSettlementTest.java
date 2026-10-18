package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.ipstudio.dialogue.tools.StudioDialogueToolRegistry;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.service.AiChatTokenPricing;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Turn settlement: real usage committed, remainder released, failures release all, terminal runs untouched. */
class StudioDialogueSettlementTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final IpRunRepository runs = mock(IpRunRepository.class);
    private final IpDialogueThreadRepository threads = mock(IpDialogueThreadRepository.class);
    private final IpDialogueMessageRepository messages = mock(IpDialogueMessageRepository.class);
    private final IpDialogueEventRepository events = mock(IpDialogueEventRepository.class);
    private final CreditService credits = mock(CreditService.class);
    private final PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
    private final AiChatTokenPricing.Rate rate = new AiChatTokenPricing.Rate(BigDecimal.ONE, BigDecimal.valueOf(2), 10_000, 2_000); // maxCost 14
    private IpRun run;
    private IpDialogueThread thread;
    private IpDialogueMessage assistant;
    private StudioDialogueTurnWorker worker;

    @BeforeEach void setUp() {
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        run = IpRun.builder().id("IPR-1").projectId("P1").ownerUserId("u1").nodeId("IPT-P1").kind("studio-dialogue").status("running").cost(14)
                .inputJson("{\"turnId\":\"TRN-1\",\"dialogue\":{\"threadId\":\"IPT-P1\",\"messageId\":\"IDM-U\"},\"_exec\":{\"assistantMessageId\":\"IDM-A\"}}")
                .createdAt(Instant.now()).heartbeatAt(Instant.now()).build();
        thread = IpDialogueThread.builder().id("IPT-P1").projectId("P1").ownerUserId("u1").activeTurnId("TRN-1").activeRunId("IPR-1")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        assistant = IpDialogueMessage.builder().id("IDM-A").threadId("IPT-P1").seq(2).role("assistant").text("我看了一下画布。")
                .blocksJson("[{\"type\":\"tool_call\",\"toolCallId\":\"tc-1\",\"settling\":true}]").status("streaming").createdAt(Instant.now()).build();
        when(runs.lockById("IPR-1")).thenReturn(Optional.of(run));
        when(threads.lockById("IPT-P1")).thenReturn(Optional.of(thread));
        when(messages.findById("IDM-A")).thenReturn(Optional.of(assistant));
        when(messages.save(any())).thenAnswer(i -> i.getArgument(0));
        var store = new StudioDialogueStore(threads, messages, events, new StudioDialogueEventHub(), mapper, manager);
        @SuppressWarnings("unchecked") ObjectProvider<StudioDialogueService> service = mock(ObjectProvider.class);
        worker = new StudioDialogueTurnWorker(runs, mock(IpProjectService.class), store, threads, messages, mock(IpDialogueSteeringRepository.class),
                mock(AiModelInvocationService.class), credits, new StudioSkillCatalog(), new StudioDialogueToolRegistry(List.of()),
                new StudioDialogueSignals(), service, mapper, manager);
    }

    private StudioDialogueTurnWorker.Settlement usage(DialogueLoop.Reason reason, long in, long out) {
        return new StudioDialogueTurnWorker.Settlement(new DialogueLoop.Outcome(reason, reason == DialogueLoop.Reason.LIMIT ? "calls" : null, 2, 1),
                in, out, rate, 2, null, List.of());
    }

    @Test void completedTurnCommitsActualUsageAndReleasesTheRest() throws Exception {
        worker.finish("IPR-1", usage(DialogueLoop.Reason.COMPLETED, 1000, 500), null); // (1000×1 + 500×2) / 1000 = 2
        verify(credits).commitHold(IpRunService.REF_TYPE, "IPR-1", 2L, "Studio 对话实际结算");
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq("IPR-1"), anyString());
        assertEquals("done", run.getStatus());
        assertEquals(2L, run.getCost());
        assertEquals("completed", run.getStage());
        assertEquals(2L, mapper.readTree(run.getOutputJson()).path("billing").path("credits").asLong());
        assertEquals("done", assistant.getStatus());
        assertEquals(2L, mapper.readTree(assistant.getBillingJson()).path("credits").asLong());
        assertFalse(mapper.readTree(assistant.getBlocksJson()).get(0).path("settling").asBoolean(), "parent-billed cards stop settling");
        assertNull(thread.getActiveTurnId());
        assertNull(thread.getActiveRunId());
        var event = ArgumentCaptor.forClass(IpDialogueEvent.class);
        verify(events).save(event.capture());
        assertEquals("turn.done", event.getValue().getType());
        assertEquals("completed", mapper.readTree(event.getValue().getDataJson()).path("reason").asText());
        assertEquals(1L, event.getValue().getSeq());
    }

    @Test void failureReleasesTheWholeHoldAndSaysWhy() throws Exception {
        worker.finish("IPR-1", usage(DialogueLoop.Reason.COMPLETED, 1000, 500),
                new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "AI 生成失败，请稍后重试"));
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq("IPR-1"), anyString());
        assertEquals("failed", run.getStatus());
        assertEquals(0L, run.getCost());
        assertEquals("AI_CALL_FAILED", run.getErrorCode());
        assertEquals("failed", assistant.getStatus());
        var saved = ArgumentCaptor.forClass(IpDialogueMessage.class);
        verify(messages, atLeastOnce()).save(saved.capture());
        assertTrue(saved.getAllValues().stream().anyMatch(m -> "system".equals(m.getRole()) && m.getText().startsWith("本轮没有完成")));
        var event = ArgumentCaptor.forClass(IpDialogueEvent.class);
        verify(events).save(event.capture());
        assertEquals("failed", mapper.readTree(event.getValue().getDataJson()).path("reason").asText());
    }

    @Test void usageBeyondTheApprovedCeilingIsNeverCharged() {
        worker.finish("IPR-1", usage(DialogueLoop.Reason.COMPLETED, 20_000, 500), null);
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        assertEquals("failed", run.getStatus());
        assertEquals("AI_USAGE_LIMIT", run.getErrorCode());
    }

    @Test void interruptedBeforeAnyCallReleasesEverything() throws Exception {
        run.setCancelRequested(true);
        worker.finish("IPR-1", null, null);
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq("IPR-1"), anyString());
        assertEquals(0L, run.getCost());
        assertEquals("interrupted", assistant.getStatus());
        var event = ArgumentCaptor.forClass(IpDialogueEvent.class);
        verify(events).save(event.capture());
        assertEquals("interrupted", mapper.readTree(event.getValue().getDataJson()).path("reason").asText());
    }

    @Test void limitEndsAsWaitingForTheUserWithARealNote() throws Exception {
        worker.finish("IPR-1", usage(DialogueLoop.Reason.LIMIT, 100, 100), null);
        assertEquals("waiting_user", run.getStage());
        var saved = ArgumentCaptor.forClass(IpDialogueMessage.class);
        verify(messages, atLeastOnce()).save(saved.capture());
        assertTrue(saved.getAllValues().stream().anyMatch(m -> "system".equals(m.getRole()) && m.getText().contains("继续")));
    }

    @Test void aRunFinishedElsewhereIsNeverSettledTwice() {
        run.setStatus("failed");
        worker.finish("IPR-1", usage(DialogueLoop.Reason.COMPLETED, 1000, 500), null);
        verifyNoInteractions(credits);
        verify(events, never()).save(any());
        assertEquals("TRN-1", thread.getActiveTurnId());
    }
}
