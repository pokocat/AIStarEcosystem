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

    /** The wallet ran out on the way: 9000 input + 1000 output = 11 credits used, the added hold refused. */
    private StudioDialogueTurnWorker.Settlement outOfCredits(StudioDialogueTurnWorker.HoldRefusal refusal) {
        return new StudioDialogueTurnWorker.Settlement(new DialogueLoop.Outcome(DialogueLoop.Reason.LIMIT, "budget", 4, 3, 3), 9000, 1000, rate, 4,
                null, List.of(), refusal);
    }

    /** The run with three holds: its own (14), and IPR-1#1, IPR-1#2 (14 each) added while it worked. */
    private void threeHolds() {
        run.setInputJson("{\"turnId\":\"TRN-1\",\"dialogue\":{\"threadId\":\"IPT-P1\",\"messageId\":\"IDM-U\"},\"_exec\":{\"assistantMessageId\":\"IDM-A\","
                + "\"holdIncrement\":14,\"holdRefs\":[{\"ref\":\"IPR-1\",\"amount\":14},{\"ref\":\"IPR-1#1\",\"amount\":14},{\"ref\":\"IPR-1#2\",\"amount\":14}]}}");
        run.setCost(42);
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
        assertFalse(StudioDialogueTurnWorker.OUT_OF_CREDITS.contains("继续"));
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

    // ── One run, holds added while it works (docs/ip-studio-dialogue-no-continue.md §3) ──────────────────────────

    /** Real usage is committed across the holds in order (the first used up, then the next); the rest goes back. */
    @Test void addedHoldsAreSettledInOrderAndTheRestReleased() throws Exception {
        threeHolds();
        worker.finish("IPR-1", usage(DialogueLoop.Reason.COMPLETED, 20_000, 1_000), null); // 20 + 2 = 22 credits
        verify(credits).commitHold(IpRunService.REF_TYPE, "IPR-1", 14L, "Studio 对话实际结算");
        verify(credits).commitHold(IpRunService.REF_TYPE, "IPR-1#1", 8L, "Studio 对话实际结算");
        verify(credits, never()).commitHold(eq(IpRunService.REF_TYPE), eq("IPR-1#2"), anyLong(), anyString());
        verify(credits, never()).releaseHold(eq(IpRunService.REF_TYPE), eq("IPR-1"), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq("IPR-1#1"), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq("IPR-1#2"), anyString());
        assertEquals(22L, run.getCost());
        assertEquals("completed", turnDone().path("reason").asText());
        assertEquals(3, mapper.readTree(run.getOutputJson()).path("holds").asInt());
    }

    /** More than every hold together is never charged. */
    @Test void usageBeyondAllHoldsIsNeverCharged() {
        threeHolds();
        worker.finish("IPR-1", usage(DialogueLoop.Reason.COMPLETED, 40_000, 2_000), null); // 44 > 42
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        assertEquals("AI_USAGE_LIMIT", run.getErrorCode());
        for (String ref : List.of("IPR-1", "IPR-1#1", "IPR-1#2")) verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(ref), anyString());
    }

    /** A failure, a stop before any call and an abandoned turn release every added hold too. */
    @Test void failureStopAndExpiryReleaseEveryAddedHold() {
        threeHolds();
        worker.finish("IPR-1", usage(DialogueLoop.Reason.COMPLETED, 1000, 500), new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "失败"));
        for (String ref : List.of("IPR-1", "IPR-1#1", "IPR-1#2")) verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(ref), anyString());
        clearInvocations(credits);
        setUp(); threeHolds(); run.setCancelRequested(true);
        worker.finish("IPR-1", null, null);
        for (String ref : List.of("IPR-1", "IPR-1#1", "IPR-1#2")) verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(ref), anyString());
        clearInvocations(credits);
        setUp(); threeHolds(); run.setHeartbeatAt(Instant.now().minus(java.time.Duration.ofMinutes(10)));
        when(runs.findById("IPR-1")).thenReturn(Optional.of(run));
        assertTrue(worker.expireIfStale("IPR-1"));
        for (String ref : List.of("IPR-1", "IPR-1#1", "IPR-1#2")) verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(ref), anyString());
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
    }

    /** §2: the wallet ran out: one line, the recharge link, the work kept, every hold settled, no 「继续」. */
    @Test void outOfCreditsEndsWithOneLineAndARechargeLink() throws Exception {
        worker.finish("IPR-1", outOfCredits(new StudioDialogueTurnWorker.HoldRefusal(true, StudioDialogueTurnWorker.OUT_OF_CREDITS)), null);
        verify(credits).commitHold(IpRunService.REF_TYPE, "IPR-1", 11L, "Studio 对话实际结算");
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq("IPR-1"), anyString());
        var notes = systemNotes();
        assertEquals(1, notes.size());
        assertEquals("积分不够了，已经做好的都留在画布上。充值后跟我说一声，我接着做。", notes.get(0).getText());
        assertEquals("recharge", mapper.readTree(notes.get(0).getRequestJson()).path("notice").asText());
        assertNull(thread.getActiveTurnId());
        var done = turnDone();
        assertEquals("waiting_user", done.path("reason").asText());
        assertTrue(done.path("suggestions").isNull() || done.path("suggestions").isMissingNode());
        assertEquals("balance", mapper.readTree(run.getOutputJson()).path("holdRefused").asText());
    }

    /** Another refusal (an enterprise stopped the member's credits): the business error's own words, no canned prefix. */
    @Test void anotherRefusalSaysTheBusinessReasonItself() throws Exception {
        worker.finish("IPR-1", outOfCredits(new StudioDialogueTurnWorker.HoldRefusal(false, "企业成员关系已结束，不能继续使用企业积分")), null);
        var notes = systemNotes();
        assertEquals("企业成员关系已结束，不能继续使用企业积分", notes.get(0).getText());
        assertNull(notes.get(0).getRequestJson());
        assertEquals("other", mapper.readTree(run.getOutputJson()).path("holdRefused").asText());
    }

    /** A hold is added on the same run: reference runId#n, max(increment, need) within the balance, recorded on the run. */
    @Test void addingAHoldUsesTheSameRunAndRecordsIt() throws Exception {
        run.setInputJson("{\"turnId\":\"TRN-1\",\"dialogue\":{\"threadId\":\"IPT-P1\",\"messageId\":\"IDM-U\"},\"_exec\":{\"assistantMessageId\":\"IDM-A\","
                + "\"holdIncrement\":14,\"holdRefs\":[{\"ref\":\"IPR-1\",\"amount\":14}]}}");
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet(100));
        assertEquals(14L, worker.extendHold("IPR-1", 5));
        verify(credits).hold("u1", 14L, IpRunService.REF_TYPE, "IPR-1#1", "Studio 对话 · 追加冻结");
        assertEquals(30L, worker.extendHold("IPR-1", 30), "the call needs more than one increment");
        verify(credits).hold("u1", 30L, IpRunService.REF_TYPE, "IPR-1#2", "Studio 对话 · 追加冻结");
        var refs = mapper.readTree(run.getInputJson()).path("_exec").path("holdRefs");
        assertEquals(3, refs.size());
        assertEquals("IPR-1#2", refs.get(2).path("ref").asText());
        assertEquals(58L, run.getCost(), "the run's cost is what is held until it settles");
    }

    /** Within the balance: a smaller balance that still pays the call is used; one that does not refuses, nothing held. */
    @Test void anAddedHoldThatTheBalanceCannotPayIsRefused() {
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet(9));
        assertEquals(9L, worker.extendHold("IPR-1", 5), "capped by the balance");
        clearInvocations(credits);
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet(3));
        var refused = assertThrows(StudioDialogueTurnWorker.HoldRefused.class, () -> worker.extendHold("IPR-1", 5));
        assertTrue(refused.refusal.balance());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    /** The ledger refuses (402 under its lock): a balance refusal too, and the run is left as it was. */
    @Test void aLedgerRefusalIsABalanceRefusal() {
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet(100));
        when(credits.hold(anyString(), anyLong(), anyString(), anyString(), anyString()))
                .thenThrow(new org.springframework.web.server.ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "积分余额不足"));
        String before = run.getInputJson();
        var refused = assertThrows(StudioDialogueTurnWorker.HoldRefused.class, () -> worker.extendHold("IPR-1", 5));
        assertTrue(refused.refusal.balance());
        assertEquals(before, run.getInputJson());
        verify(manager, atLeastOnce()).rollback(any());
    }

    /** A turn being stopped adds nothing. */
    @Test void aStoppingTurnAddsNoHold() {
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet(100));
        run.setCancelRequested(true);
        assertEquals(0L, worker.extendHold("IPR-1", 5));
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
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
