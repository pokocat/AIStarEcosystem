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
        return new StudioDialogueTurnWorker.Settlement(new DialogueLoop.Outcome(reason, reason == DialogueLoop.Reason.LIMIT ? "steps" : null, 2, 2, 1),
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


    /** The hold is the only limit: input may use what the rate allotted to output, within the frozen money. */
    @Test void theHoldIsTheOnlyLimitSoInputMayUseTheOutputShare() {
        worker.finish("IPR-1", new StudioDialogueTurnWorker.Settlement(
                new DialogueLoop.Outcome(DialogueLoop.Reason.COMPLETED, null, 50, 30, 25), 12000, 500, rate, 50, null, List.of()), null);
        assertEquals("done", run.getStatus()); assertEquals(13, run.getCost());
        verify(credits).commitHold(IpRunService.REF_TYPE, "IPR-1", 13, "Studio 对话实际结算");
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq("IPR-1"), anyString());
    }

    @Test void nothingIsChargedBeyondTheFrozenMoney() {
        worker.finish("IPR-1", new StudioDialogueTurnWorker.Settlement(
                new DialogueLoop.Outcome(DialogueLoop.Reason.COMPLETED, null, 50, 30, 25), 15000, 500, rate, 50, null, List.of()), null);
        assertEquals("failed", run.getStatus()); assertEquals("AI_USAGE_LIMIT", run.getErrorCode());
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
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

    private StudioDialogueTurnWorker.Settlement limited(String limit) {
        return new StudioDialogueTurnWorker.Settlement(new DialogueLoop.Outcome(DialogueLoop.Reason.LIMIT, limit, 9, 6, 8), 100, 100, rate, 9, null, List.of());
    }

    /** A task that used up its hold: 9000 input + 1000 output = 11 of 14 credits, the refused call needed 3000 input. */
    private StudioDialogueTurnWorker.Settlement usedUp() {
        return new StudioDialogueTurnWorker.Settlement(new DialogueLoop.Outcome(DialogueLoop.Reason.LIMIT, "budget", 4, 3, 3), 9000, 1000, rate, 4,
                null, List.of(), 4, 3000);
    }

    private List<IpDialogueMessage> systemNotes() {
        var saved = ArgumentCaptor.forClass(IpDialogueMessage.class);
        verify(messages, atLeastOnce()).save(saved.capture());
        return saved.getAllValues().stream().filter(m -> "system".equals(m.getRole())).toList();
    }

    private String systemNote() {
        return systemNotes().stream().map(IpDialogueMessage::getText).findFirst().orElse(null);
    }

    private com.fasterxml.jackson.databind.JsonNode turnDone() throws Exception {
        var event = ArgumentCaptor.forClass(IpDialogueEvent.class);
        verify(events).save(event.capture());
        assertEquals("turn.done", event.getValue().getType());
        return mapper.readTree(event.getValue().getDataJson());
    }

    private com.aistareco.aep.model.Wallet wallet(long balance) {
        var wallet = new com.aistareco.aep.model.Wallet();
        wallet.setId("W-u1"); wallet.setUserId("u1"); wallet.setTotalBalance(balance);
        return wallet;
    }

    /**
     * 2026-10-23 (docs/ip-studio-dialogue-no-continue.md §2): no stop asks the user to type 「继续」 any more, and none
     * offers it as a one-tap reply.
     */
    @Test void noStopOffersAContinueReply() throws Exception {
        for (String limit : List.of("loop", "protocol", "safeguard")) {
            clearInvocations(events, messages, credits, runs);
            setUp();
            worker.finish("IPR-1", limited(limit), null);
            assertNull(assistant.getRequestJson(), limit);
            var done = turnDone();
            assertTrue(done.path("suggestions").isNull() || done.path("suggestions").isMissingNode(), limit);
            String note = systemNote();
            assertNotNull(note, limit);
            assertFalse(note.contains("继续") || note.contains("暂停") || note.contains("——"), limit + ": " + note);
        }
    }

    @Test void notesNeverMentionContinuing() {
        for (String limit : List.of("loop", "protocol", "safeguard", "budget", "steps", "tokens", "time"))
            assertFalse(StudioDialogueTurnWorker.limitNote(limit).contains("继续"), limit);
        for (var kind : StudioDialogueTurnWorker.Refusal.values())
            assertFalse(StudioDialogueTurnWorker.refusalNote(new StudioDialogueTurnWorker.ChainRefusal(kind, "原因")).contains("继续"), kind.name());
    }

    @Test void aLoopEndsAsWaitingForTheUserWithItsNote() throws Exception {
        worker.finish("IPR-1", limited("loop"), null);
        assertEquals("waiting_user", run.getStage());
        assertEquals("waiting_user", turnDone().path("reason").asText());
        assertEquals(1, systemNotes().size());
        assertNull(thread.getActiveTurnId());
    }

    /** The hidden safety net ends the chain as failed, still charging the real usage, with one plain line. */
    @Test void theSafetyNetEndsAsFailedAndStillChargesRealUsage() throws Exception {
        worker.finish("IPR-1", limited("safeguard"), null);
        verify(credits).commitHold(IpRunService.REF_TYPE, "IPR-1", 1L, "Studio 对话实际结算");
        assertEquals("failed", turnDone().path("reason").asText());
        assertEquals("failed", assistant.getStatus());
        assertEquals("failed", systemNotes().get(0).getStatus());
    }

    @Test void aFormatFailureKeepsItsNoteAndOffersNoContinue() throws Exception {
        worker.finish("IPR-1", limited("protocol"), null);
        assertTrue(systemNote().startsWith("模型返回的执行格式有误"));
        assertNull(assistant.getRequestJson());
        var done = turnDone();
        assertTrue(done.path("suggestions").isNull() || done.path("suggestions").isMissingNode());
    }

    @Test void aCompletedTurnOffersNoContinue() throws Exception {
        worker.finish("IPR-1", usage(DialogueLoop.Reason.COMPLETED, 100, 100), null);
        assertNull(assistant.getRequestJson());
        var done = turnDone();
        assertTrue(done.path("suggestions").isNull() || done.path("suggestions").isMissingNode());
    }

    @Test void aRunFinishedElsewhereIsNeverSettledTwice() {
        run.setStatus("failed");
        worker.finish("IPR-1", usage(DialogueLoop.Reason.COMPLETED, 1000, 500), null);
        verifyNoInteractions(credits);
        verify(events, never()).save(any());
        assertEquals("TRN-1", thread.getActiveTurnId());
    }

    // ── Task chain (docs/ip-studio-dialogue-no-continue.md §3) ───────────────────────────────────────────────────

    /**
     * A task whose hold is used up is settled and, in the same transaction, the next task is created with its own hold from
     * the same payer; the thread moves to it (never idle), turn.done says so, and it is dispatched after commit.
     */
    @Test void aUsedUpHoldHandsTheWorkToTheNextTaskInTheSameTransaction() throws Exception {
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet(100));
        List<String> dispatched = new java.util.ArrayList<>();
        worker.useDispatcher(dispatched::add);
        var savedRuns = ArgumentCaptor.forClass(IpRun.class);
        worker.finish("IPR-1", usedUp(), null);

        verify(credits).commitHold(IpRunService.REF_TYPE, "IPR-1", 11L, "Studio 对话实际结算");
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq("IPR-1"), anyString());
        verify(runs, atLeastOnce()).save(savedRuns.capture());
        IpRun next = savedRuns.getAllValues().stream().filter(r -> !"IPR-1".equals(r.getId())).findFirst().orElseThrow();
        verify(credits).hold("u1", 14L, IpRunService.REF_TYPE, next.getId(), "Studio 对话");
        assertEquals(14L, next.getCost());
        assertEquals("running", next.getStatus());
        assertEquals("studio-dialogue", next.getKind());
        var exec = mapper.readTree(next.getInputJson()).path("_exec");
        assertEquals("IPR-1", exec.path("chainOf").asText());
        assertEquals(1, exec.path("chainIndex").asInt());
        assertEquals(List.of("IPR-1"), mapper.convertValue(exec.path("chainRunIds"), List.class));
        assertEquals(4, exec.path("chainModelCalls").asInt());
        assertEquals("IDM-U:1", next.getClientRequestId());
        assertEquals(next.getId(), thread.getActiveRunId());
        String nextTurn = mapper.readTree(next.getInputJson()).path("turnId").asText();
        assertEquals(nextTurn, thread.getActiveTurnId(), "the thread never goes idle in between");
        assertEquals("done", assistant.getStatus());
        assertEquals("chained", run.getStage());
        var done = turnDone();
        assertEquals("chained", done.path("reason").asText());
        assertEquals(nextTurn, done.path("nextTurnId").asText());
        assertTrue(systemNotes().isEmpty(), "no pause note, nothing to type");
        var saved = ArgumentCaptor.forClass(IpDialogueMessage.class);
        verify(messages, atLeastOnce()).save(saved.capture());
        assertTrue(saved.getAllValues().stream().anyMatch(m -> "assistant".equals(m.getRole()) && next.getId().equals(m.getRunId())
                && "streaming".equals(m.getStatus())), "the next task's reply is open");
        assertEquals(List.of(next.getId()), dispatched);
    }

    /** The next hold is min(the dialogue ceiling, the balance): a small balance still carries on. */
    @Test void theNextHoldIsCappedByTheBalance() {
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet(9));
        worker.useDispatcher(id -> { });
        worker.finish("IPR-1", usedUp(), null);
        verify(credits).hold(eq("u1"), longThat(a -> a > 0 && a <= 9), eq(IpRunService.REF_TYPE), anyString(), eq("Studio 对话"));
    }

    /** §2: the balance cannot pay for the next call: the chain ends, every hold is settled, a recharge note says so. */
    @Test void aBalanceThatCannotPayTheNextCallEndsTheChainWithARechargeNote() throws Exception {
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet(2)); // the refused call needs cost(3000, 256) = 4
        List<String> dispatched = new java.util.ArrayList<>();
        worker.useDispatcher(dispatched::add);
        worker.finish("IPR-1", usedUp(), null);
        verify(credits).commitHold(IpRunService.REF_TYPE, "IPR-1", 11L, "Studio 对话实际结算");
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq("IPR-1"), anyString());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        var notes = systemNotes();
        assertEquals(1, notes.size());
        assertEquals("recharge", mapper.readTree(notes.get(0).getRequestJson()).path("notice").asText());
        assertFalse(notes.get(0).getText().contains("继续"));
        assertNull(thread.getActiveTurnId()); assertNull(thread.getActiveRunId());
        assertEquals("waiting_user", turnDone().path("reason").asText());
        assertEquals("balance", mapper.readTree(run.getOutputJson()).path("chainRefused").asText());
        assertTrue(dispatched.isEmpty());
    }

    /**
     * A refused next hold (402 under the lock) rolls the whole attempt back; the task is then settled once more without a
     * next task, with the recharge note. The mocks here return a fresh row per lock, the way a rolled-back database does.
     */
    @Test void aRefusedNextHoldRollsBackAndEndsWithARechargeNote() throws Exception {
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet(100));
        String input = run.getInputJson();
        when(runs.lockById("IPR-1")).thenAnswer(i -> Optional.of(IpRun.builder().id("IPR-1").projectId("P1").ownerUserId("u1").nodeId("IPT-P1")
                .kind("studio-dialogue").status("running").cost(14).inputJson(input).createdAt(Instant.now()).heartbeatAt(Instant.now()).build()));
        when(threads.lockById("IPT-P1")).thenAnswer(i -> Optional.of(IpDialogueThread.builder().id("IPT-P1").projectId("P1").ownerUserId("u1")
                .activeTurnId("TRN-1").activeRunId("IPR-1").createdAt(Instant.now()).updatedAt(Instant.now()).build()));
        when(credits.hold(anyString(), anyLong(), anyString(), anyString(), anyString()))
                .thenThrow(new org.springframework.web.server.ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "积分余额不足"));
        List<String> dispatched = new java.util.ArrayList<>();
        worker.useDispatcher(dispatched::add);
        worker.finish("IPR-1", usedUp(), null);
        verify(manager, atLeastOnce()).rollback(any());
        var savedRuns = ArgumentCaptor.forClass(IpRun.class);
        verify(runs, atLeastOnce()).save(savedRuns.capture());
        IpRun last = savedRuns.getAllValues().get(savedRuns.getAllValues().size() - 1);
        assertEquals("IPR-1", last.getId());
        assertEquals("done", last.getStatus());
        assertEquals("balance", mapper.readTree(last.getOutputJson()).path("chainRefused").asText());
        assertTrue(systemNotes().stream().anyMatch(m -> m.getRequestJson() != null && m.getRequestJson().contains("recharge")));
        assertTrue(dispatched.isEmpty());
    }

    /** A stop that arrived before settlement wins: no next task. */
    @Test void aStoppedTaskIsNotChained() throws Exception {
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet(100));
        run.setCancelRequested(true);
        worker.useDispatcher(id -> fail("a stopped chain must not dispatch"));
        worker.finish("IPR-1", usedUp(), null);
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        assertEquals("interrupted", turnDone().path("reason").asText());
        assertNull(thread.getActiveTurnId());
    }

    /** A task that made no call cannot be helped by another one: no loop of empty tasks. */
    @Test void aTaskThatMadeNoCallIsNotChained() throws Exception {
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet(100));
        worker.useDispatcher(id -> fail("no progress, no next task"));
        worker.finish("IPR-1", new StudioDialogueTurnWorker.Settlement(new DialogueLoop.Outcome(DialogueLoop.Reason.LIMIT, "budget", 0, 0, 0),
                0, 0, rate, 0, null, List.of(), 0, 50_000), null);
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        assertEquals("too_large", mapper.readTree(run.getOutputJson()).path("chainRefused").asText());
    }

    /** §7: a running dialogue task with a live heartbeat owns its hold; without one it is not live. */
    @Test void aLiveDialogueTaskIsRecognizedByItsHeartbeat() {
        Instant now = Instant.now();
        assertTrue(StudioDialogueTurnWorker.isLive(run, now));
        run.setHeartbeatAt(now.minus(java.time.Duration.ofMinutes(5)));
        assertFalse(StudioDialogueTurnWorker.isLive(run, now));
        run.setHeartbeatAt(now); run.setStatus("done");
        assertFalse(StudioDialogueTurnWorker.isLive(run, now));
    }
}
