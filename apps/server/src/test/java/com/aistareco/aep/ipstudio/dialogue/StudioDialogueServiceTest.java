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
    private final Map<String, IpDialogueMessage> stored = new LinkedHashMap<>();
    private final List<IpDialogueEvent> events = new ArrayList<>();

    @BeforeEach void setUp() {
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        var project = IpProject.builder().id("P1").ownerUserId("u1").docJson("{\"nodes\":[{\"id\":\"n1\",\"type\":\"text\",\"title\":\"文案\"}],\"connections\":[]}").build();
        when(projects.required("u1", "P1")).thenReturn(project);
        when(projects.requiredForUpdate("u1", "P1")).thenReturn(project);
        when(projects.readDoc(project)).thenAnswer(i -> mapper.readTree(project.getDocJson()));
        when(threads.findById("IPT-P1")).thenReturn(Optional.of(thread));
        when(threads.lockById("IPT-P1")).thenReturn(Optional.of(thread));
        // An in-memory message table: saves are visible to findById and to the newest-first thread scan.
        when(messages.findByThreadIdAndClientMessageId(anyString(), anyString())).thenAnswer(i -> stored.values().stream()
                .filter(m -> i.getArgument(0).equals(m.getThreadId()) && i.getArgument(1).equals(m.getClientMessageId())).findFirst());
        when(messages.save(any())).thenAnswer(i -> { IpDialogueMessage m = i.getArgument(0); stored.put(m.getId(), m); return m; });
        when(messages.findById(anyString())).thenAnswer(i -> Optional.ofNullable(stored.get((String) i.getArgument(0))));
        when(messages.findByThreadIdOrderBySeqDesc(anyString(), any())).thenAnswer(i -> stored.values().stream().filter(m -> i.getArgument(0).equals(m.getThreadId()))
                .sorted(Comparator.comparingLong(IpDialogueMessage::getSeq).reversed()).toList());
        when(messages.findByThreadIdAndSeqLessThanOrderBySeqDesc(anyString(), anyLong(), any())).thenAnswer(i -> stored.values().stream()
                .filter(m -> i.getArgument(0).equals(m.getThreadId()) && m.getSeq() < (long)i.getArgument(1))
                .sorted(Comparator.comparingLong(IpDialogueMessage::getSeq).reversed()).toList());
        var eventRepo = mock(IpDialogueEventRepository.class);
        when(eventRepo.save(any())).thenAnswer(i -> { events.add(i.getArgument(0)); return i.getArgument(0); });
        var store = new StudioDialogueStore(threads, messages, eventRepo, new StudioDialogueEventHub(), mapper, manager);
        service = new StudioDialogueService(projects, runs, mock(IpRunService.class), threads, messages, steering, store, worker,
                new StudioDialogueSignals(), new StudioSkillCatalog(), fixtures, models, prompts, mock(DapPricingService.class), credits, mapper, manager);
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach void clear() { if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization(); }

    private PostMessageRequest request(String id, String text, Long maxCost) { return new PostMessageRequest(id, text, null, null, null, null, null, maxCost, null); }

    /**
     * docs/ip-studio-dialogue-no-continue.md §3: a typed 「继续」 after a limited turn is an ordinary message now. Nothing is
     * unlocked by it (no continueUntilDone / continuationOf on the new run); the chain continues work by itself.
     */
    @Test void aTypedContinueIsAnOrdinaryMessageThatUnlocksNothing() throws Exception {
        when(fixtures.enabled()).thenReturn(true);
        var stopped=IpRun.builder().id("IPR-paused").projectId("P1").ownerUserId("u1").nodeId("IPT-P1").kind("studio-dialogue")
                .status("done").inputJson("{}").outputJson("{\"limit\":\"tokens\"}").build();
        when(runs.findById("IPR-paused")).thenReturn(Optional.of(stopped));
        message("previous",1,"assistant","[]").setRunId("IPR-paused");thread.setMessageSeq(1);
        var accepted=service.post("u1","P1","IPT-P1",request("resume-1","继续",null));
        var run=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(run.capture());
        var exec=mapper.readTree(run.getValue().getInputJson()).path("_exec");
        assertFalse(exec.has("continueUntilDone"));assertFalse(exec.has("continuationOf"));
        assertEquals(accepted.runId(),service.post("u1","P1","IPT-P1",request("resume-1","继续",null)).runId());
        verify(runs,times(1)).save(any());
    }

    // Codex real-environment retest 2026-10-19: the home page brief (a conversation record with no turns) was imported as
    // 「之前的对话「创作想法」」, the thread was no longer empty, and the brief was never sent as the first message.
    @Test void aHomepageBriefWithNoTurnsIsNotHistoryButARealOldConversationIs() throws Exception {
        var om = new com.fasterxml.jackson.databind.ObjectMapper();
        assertFalse(StudioDialogueService.hasHistory(om.readTree(
                "{\"id\":\"P-brief\",\"metadata\":{\"studioStart\":\"assistant\",\"studio\":{\"kind\":\"assistant\",\"conversation\":{\"mode\":\"general\",\"turns\":[]}}}}")));
        assertTrue(StudioDialogueService.hasHistory(om.readTree(
                "{\"id\":\"old\",\"metadata\":{\"studio\":{\"conversation\":{\"turns\":[{\"role\":\"user\",\"content\":\"讨论\"}]}}}}")));
        assertTrue(StudioDialogueService.hasHistory(om.readTree(
                "{\"id\":\"planned\",\"metadata\":{\"studio\":{\"conversation\":{\"turns\":[],\"plan\":{\"summary\":\"s\"}}}}}")));
    }

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

    private IpDialogueMessage message(String id, long seq, String role, String blocks) {
        var m = IpDialogueMessage.builder().id(id).threadId("IPT-P1").seq(seq).role(role).text("").blocksJson(blocks).status("done").createdAt(Instant.now()).build();
        stored.put(id, m);
        return m;
    }
    private static String plan(int revision, String fingerprint) {
        return "{\"type\":\"plan\",\"planRunId\":\"IPR-plan-" + revision + "\",\"revision\":" + revision + ",\"fingerprint\":\"" + fingerprint + "\",\"plan\":{\"summary\":\"s\"}}";
    }
    private static String card(String approvalId, String fingerprint, String status) {
        return "{\"type\":\"approval\",\"approvalId\":\"" + approvalId + "\",\"stage\":\"analysis\",\"status\":\"" + status + "\",\"planFingerprint\":\"" + fingerprint
                + "\",\"quotedCost\":30,\"budgetCap\":1000,\"autoFixCap\":0,\"expiresAt\":\"" + Instant.now().plusSeconds(600) + "\"}";
    }

    /** D09: no card on that message → 404; D01: a card that is not for the thread's newest plan → 409. */
    @Test void approvalConfirmationMustPointAtTheAssistantCardOfTheCurrentPlan() {
        message("IDM-A", 2, "assistant", "[" + plan(1, "fp") + "," + card("APV-1", "fp", "pending") + "]");
        message("IDM-U", 3, "user", "[]");
        var ok = service.requireApproval("u1", "P1", "IDM-A", "APV-1");
        assertEquals("IPT-P1", ok.threadId());
        assertEquals("fp", ok.planFingerprint());
        assertEquals(1, ok.currentPlanRevision());
        assertEquals("IPR-plan-1", ok.cardPlanRunId());
        for (var bad : List.of(new String[]{"u1", "IDM-U", "APV-1"}, new String[]{"u1", "IDM-A", "APV-2"}, new String[]{"u2", "IDM-A", "APV-1"}, new String[]{"u1", "IDM-missing", "APV-1"})) {
            var e = assertThrows(BusinessException.class, () -> service.requireApproval(bad[0], "P1", bad[1], bad[2]));
            assertEquals("STUDIO_APPROVAL_NOT_FOUND", e.getCode());
            assertEquals(404, e.getStatus().value(), "not a bad request: there is no such card");
        }
        message("IDM-B", 4, "assistant", "[" + plan(2, "fp2") + "]");
        var stale = assertThrows(BusinessException.class, () -> service.requireApproval("u1", "P1", "IDM-A", "APV-1"));
        assertEquals("STUDIO_PLAN_STALE", stale.getCode(), "a newer plan revision makes the old card stale even while it still says pending");
        assertEquals(409, stale.getStatus().value());
        stored.remove("IDM-B");
        stored.get("IDM-A").setBlocksJson("[" + plan(1, "fp") + "," + card("APV-1", "fp", "superseded") + "]");
        assertEquals("STUDIO_PLAN_STALE", assertThrows(BusinessException.class, () -> service.requireApproval("u1", "P1", "IDM-A", "APV-1")).getCode());
        stored.get("IDM-A").setBlocksJson("[" + plan(1, "fp") + "," + card("APV-1", "fp", "approved") + "]");
        assertEquals("STUDIO_PLAN_STALE", assertThrows(BusinessException.class, () -> service.requireApproval("u1", "P1", "IDM-A", "APV-1")).getCode(), "a card approves once");
    }

    /** D04: an approval in words is the user's own message after the card, and only when exactly one card is open. */
    @Test void approvalInWordsNeedsTheUsersMessageAfterTheOnlyOpenCard() {
        message("IDM-early", 1, "user", "[]").setText("先给个方案");
        message("IDM-A", 2, "assistant", "[" + plan(1, "fp") + "," + card("APV-1", "fp", "pending") + "]");
        message("IDM-U", 3, "user", "[]").setText("就按这个开始");
        var ok = service.requireApprovalByMessage("u1", "P1", "IDM-U", "APV-1");
        assertEquals("IDM-A", ok.cardMessageId());
        assertEquals("IDM-U", ok.approvingMessageId());
        assertEquals("就按这个开始", ok.approvingText());
        assertEquals("STUDIO_PLAN_STALE", assertThrows(BusinessException.class, () -> service.requireApprovalByMessage("u1", "P1", "IDM-early", "APV-1")).getCode(),
                "a message sent before the card is not an answer to it");
        assertEquals("STUDIO_MESSAGE_NOT_FOUND", assertThrows(BusinessException.class, () -> service.requireApprovalByMessage("u1", "P1", "IDM-A", "APV-1")).getCode(),
                "the model's own message never approves");
        message("IDM-A2", 4, "assistant", "[" + card("APV-2", "fp", "pending") + "]");
        message("IDM-U2", 5, "user", "[]").setText("好的开始");
        assertEquals("STUDIO_APPROVAL_AMBIGUOUS", assertThrows(BusinessException.class, () -> service.requireApprovalByMessage("u1", "P1", "IDM-U2", "APV-1")).getCode());
    }

    /** D10: the card keeps the authorization snapshot and the thread is bound, with the update published. */
    @Test void markApprovedWritesTheImmutableSnapshot() throws Exception {
        message("IDM-A", 2, "assistant", "[" + plan(1, "fp") + "," + card("APV-1", "fp", "pending") + "]");
        var card = service.requireApproval("u1", "P1", "IDM-A", "APV-1");
        Instant at = Instant.parse("2026-10-18T08:00:00Z");
        service.markApproved("u1", "P1", card, new StudioDialogueApprovals.Approved("PEX-1", "analysis", 280, 0, "IDM-A", 1, at));
        var block = mapper.readTree(stored.get("IDM-A").getBlocksJson()).get(1);
        assertEquals("approved", block.path("status").asText());
        assertEquals(1000, block.path("budgetCap").asLong(), "the proposal stays as shown");
        assertEquals(280, block.path("approvedBudgetCap").asLong());
        assertEquals(0, block.path("approvedAutoFixCap").asLong());
        assertEquals(1, block.path("approvedPlanRevision").asInt());
        assertEquals("IDM-A", block.path("approvedByMessageId").asText());
        assertEquals("2026-10-18T08:00:00Z", block.path("approvedAt").asText());
        assertEquals("PEX-1", block.path("executionId").asText());
        assertEquals("PEX-1", thread.getActiveExecutionId());
        assertEquals(List.of("approval.required", "turn.done"), events.stream().map(IpDialogueEvent::getType).toList(), "a self-closing update, so the timeline never looks busy");
    }

    /** D01: a new revision / card supersedes every other pending card, with an update event for each. */
    @Test void supersedingFlipsOnlyPendingCardsAndPublishesThem() throws Exception {
        message("IDM-A", 2, "assistant", "[" + card("APV-1", "fp", "pending") + "," + card("APV-0", "fp0", "approved") + "]");
        message("IDM-B", 3, "assistant", "[" + card("APV-2", "fp", "pending") + "]");
        var store = new StudioDialogueStore(threads, messages, mock(IpDialogueEventRepository.class), new StudioDialogueEventHub(), mapper, manager);
        var pending = store.supersedePendingApprovals(thread, "APV-2", "TRN-1", "IPR-1", null);
        assertEquals(1, pending.size());
        assertEquals("superseded", pending.get(0).data().path("block").path("status").asText());
        var a = mapper.readTree(stored.get("IDM-A").getBlocksJson());
        assertEquals("superseded", a.get(0).path("status").asText());
        assertEquals("approved", a.get(1).path("status").asText(), "an approved card keeps its snapshot");
        assertEquals("pending", mapper.readTree(stored.get("IDM-B").getBlocksJson()).get(0).path("status").asText(), "the kept card");
    }

    /** D03: with no turn active, a message while the bound execution runs is steering for it: queued, no paid turn. */
    @Test void aMessageWhileTheExecutionRunsIsQueuedSteeringBoundToIt() {
        var control = mock(StudioExecutionControl.class);
        when(control.active("u1", "P1", "IPT-P1")).thenReturn(Optional.of(new StudioExecutionControl.ExecutionView("PEX-1", "analysis", "running")));
        ReflectionTestUtils.setField(service, "executionControl", control);
        var result = service.post("u1", "P1", "IPT-P1", request("c-run", "第二步不要执行，只保留第一步", 5L));
        assertEquals("queued", result.queueState());
        assertNull(result.turnId());
        var row = ArgumentCaptor.forClass(IpDialogueSteering.class);
        verify(steering).save(row.capture());
        assertEquals("PEX-1", row.getValue().getExecutionId());
        assertEquals(IpDialogueSteering.QUEUED, row.getValue().getStatus());
        assertEquals("queued", stored.get(result.messageId()).getStatus());
        verify(runs, never()).save(any());
        verifyNoInteractions(credits);
        verify(control, never()).wake(anyString());
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(control).wake("PEX-1");
    }

    /** D03: a paused / waiting execution submits nothing, so a message there is ordinary conversation. */
    @Test void aMessageToAWaitingExecutionStartsAnOrdinaryTurn() {
        when(fixtures.enabled()).thenReturn(true);
        var control = mock(StudioExecutionControl.class);
        when(control.active("u1", "P1", "IPT-P1")).thenReturn(Optional.of(new StudioExecutionControl.ExecutionView("PEX-1", "analysis", "needs_user")));
        ReflectionTestUtils.setField(service, "executionControl", control);
        assertEquals("accepted", service.post("u1", "P1", "IPT-P1", request("c-wait", "分析好了，帮我规划制作", null)).queueState());
        verifyNoInteractions(steering);
    }

    /** D06: a turn on a thread bound to an active execution is checked against that stage first; 402 freezes nothing. */
    @Test void aBoundTurnMustFitTheStageBudgetBeforeAnythingIsHeld() {
        var endpoint = AiModelEndpoint.builder().id("ep-1").name("对话").enabled(true).build();
        when(models.resolveAcceptedEndpoint(eq(AiModelPurpose.DAP_PERSONA), isNull(), eq("studio")))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true)));
        when(prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_DIALOGUE))
                .thenReturn(new PromptService.ResolvedPrompt("系统", "{{input}}", new PromptParamsDto(null, null, null), "resource"));
        var pricing = mock(AiChatTokenPricing.class);
        when(pricing.findDialogue("ep-1")).thenReturn(new AiChatTokenPricing.Rate(BigDecimal.ONE, BigDecimal.valueOf(2), 10_000, 2_000)); // maxCost = 14
        ReflectionTestUtils.setField(service, "tokenPricing", pricing);
        var control = mock(StudioExecutionControl.class);
        when(control.active("u1", "P1", "IPT-P1")).thenReturn(Optional.of(new StudioExecutionControl.ExecutionView("PEX-1", "analysis", "needs_user")));
        ReflectionTestUtils.setField(service, "executionControl", control);
        var gate = mock(StudioExecutionGate.class);
        @SuppressWarnings("unchecked") org.springframework.beans.factory.ObjectProvider<StudioExecutionGate> gates = mock(org.springframework.beans.factory.ObjectProvider.class);
        when(gates.getIfAvailable()).thenReturn(gate);
        ReflectionTestUtils.setField(service, "gates", gates);
        when(gate.attributeTurn(eq("u1"), eq("P1"), eq("PEX-1"), anyString(), eq(14L)))
                .thenThrow(new BusinessException(org.springframework.http.HttpStatus.PAYMENT_REQUIRED, "STUDIO_PLAN_BUDGET_EXCEEDED", "预算不够，还差 4 积分"));
        var refused = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1", request("c-b1", "规划制作", 14L)));
        assertEquals("STUDIO_PLAN_BUDGET_EXCEEDED", refused.getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        verify(runs, never()).save(any());

        reset(gate);
        when(gate.attributeTurn(eq("u1"), eq("P1"), eq("PEX-1"), anyString(), eq(14L))).thenReturn("analysis");
        var ok = service.post("u1", "P1", "IPT-P1", request("c-b2", "规划制作", 14L));
        verify(gate).attributeTurn("u1", "P1", "PEX-1", ok.runId(), 14L);
        var run = ArgumentCaptor.forClass(IpRun.class);
        verify(runs).save(run.capture());
        assertTrue(run.getValue().getInputJson().contains("\"attributedExecutionId\":\"PEX-1\""));
        assertTrue(run.getValue().getInputJson().contains("\"executionId\":\"PEX-1\""));
    }

    /** D07 / executor cards: one message per key, plan blocks get the next revision, events close their own turn. */
    @Test void executionMessagesArePersistedOnceAndPublishedAsAClosedTurn() throws Exception {
        message("IDM-A", 2, "assistant", "[" + card("APV-1", "fp", "pending") + "]");
        thread.setPlanRevision(2);
        var planBlock = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(plan(0, "fp-prod"));
        var cardBlock = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(card("APV-p", "fp-prod", "pending"));
        String id = service.postExecutionMessage("IPT-P1", "PEX-1", "exec-card-1", "分析做完了。", List.of(planBlock, cardBlock), null);
        assertEquals(id, service.postExecutionMessage("IPT-P1", "PEX-1", "exec-card-1", "分析做完了。", List.of(planBlock, cardBlock), null), "idempotent on the key");
        var saved = stored.get(id);
        assertEquals("assistant", saved.getRole());
        assertEquals("分析做完了。", saved.getText());
        assertEquals(3, mapper.readTree(saved.getBlocksJson()).get(0).path("revision").asInt(), "the next thread revision");
        assertEquals(3, thread.getPlanRevision());
        assertEquals("superseded", mapper.readTree(stored.get("IDM-A").getBlocksJson()).get(0).path("status").asText());
        assertEquals(List.of("approval.required", "message.delta", "plan.proposed", "approval.required", "turn.done"), events.stream().map(IpDialogueEvent::getType).toList());
        events.clear();
        String summary = service.postExecutionMessage("IPT-P1", "PEX-1", "exec-summary-PEX-1", "这次制作完成了。", List.of(), List.of("把这张画布存为模板", "重做第 1 段"));
        var done = mapper.readTree(events.get(events.size() - 1).getDataJson());
        assertEquals("turn.done", events.get(events.size() - 1).getType());
        assertEquals(summary, done.path("messageId").asText());
        assertEquals("completed", done.path("reason").asText());
        assertEquals(2, done.path("suggestions").size());
        assertEquals(events.get(0).getTurnId(), events.get(events.size() - 1).getTurnId(), "delta and turn.done share one synthetic turn");
        assertEquals(List.of("把这张画布存为模板", "重做第 1 段"), service.toDto(stored.get(summary)).suggestions(), "follow-ups survive a reload");
        assertNull(service.toDto(stored.get(id)).suggestions());
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

    /** §8: the token price is required; the client's maxCost is not, and an old or low one no longer refuses (409). */
    @Test void realTurnNeedsATokenPriceButNotTheClientsCeiling() {
        var endpoint = AiModelEndpoint.builder().id("ep-1").name("对话").enabled(true).build();
        when(models.resolveAcceptedEndpoint(eq(AiModelPurpose.DAP_PERSONA), isNull(), eq("studio")))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true)));
        when(prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_DIALOGUE))
                .thenReturn(new PromptService.ResolvedPrompt("系统", "{{input}}", new PromptParamsDto(null, null, null), "resource"));
        var noPrice = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1", request("c-5", "你好", 50L)));
        assertEquals("AI_TOKEN_PRICE_NOT_CONFIGURED", noPrice.getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());

        var pricing = mock(AiChatTokenPricing.class);
        var rate = new AiChatTokenPricing.Rate(BigDecimal.ONE, BigDecimal.valueOf(2), 10_000, 2_000); // maxCost = 14
        when(pricing.findDialogue("ep-1")).thenReturn(rate);
        ReflectionTestUtils.setField(service, "tokenPricing", pricing);
        var ok = service.post("u1", "P1", "IPT-P1", request("c-6", "你好", null));
        assertEquals("accepted", ok.queueState(), "no client ceiling: accepted, not STUDIO_PRICE_CHANGED");
        verify(credits).hold(eq("u1"), eq(14L), eq(IpRunService.REF_TYPE), eq(ok.runId()), anyString());
        var run = ArgumentCaptor.forClass(IpRun.class);
        verify(runs).save(run.capture());
        assertEquals(14L, run.getValue().getCost());
        assertTrue(run.getValue().getInputJson().contains("\"tokenPricing\""));
        assertTrue(run.getValue().getInputJson().contains("\"dialogueRate\""), "the full ceiling is kept for the next task of a chain");
    }

    /** §8: only the dialogue stopped checking the client's ceiling; paid generations keep the shared check (409). */
    @Test void paidGenerationsKeepTheirApprovedCostCheck() {
        var e = assertThrows(BusinessException.class, () -> IpRunService.requireApprovedCost(7L, 8));
        assertEquals("STUDIO_PRICE_CHANGED", e.getCode());
        assertDoesNotThrow(() -> IpRunService.requireApprovedCost(8L, 8));
    }

    @Test void aLowClientCeilingNoLongerRefusesTheTurn() {
        var endpoint = AiModelEndpoint.builder().id("ep-1").name("对话").enabled(true).build();
        when(models.resolveAcceptedEndpoint(eq(AiModelPurpose.DAP_PERSONA), isNull(), eq("studio")))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true)));
        when(prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_DIALOGUE))
                .thenReturn(new PromptService.ResolvedPrompt("系统", "{{input}}", new PromptParamsDto(null, null, null), "resource"));
        var pricing = mock(AiChatTokenPricing.class);
        when(pricing.findDialogue("ep-1")).thenReturn(new AiChatTokenPricing.Rate(BigDecimal.ONE, BigDecimal.valueOf(2), 10_000, 2_000));
        ReflectionTestUtils.setField(service, "tokenPricing", pricing);
        var ok = service.post("u1", "P1", "IPT-P1", request("c-7", "你好", 0L));
        verify(credits).hold(eq("u1"), eq(14L), eq(IpRunService.REF_TYPE), eq(ok.runId()), anyString());
    }

    /**
     * §3 / §8: an old page that still sends 21 is not capped by it: the hold is min(the dialogue ceiling, the balance).
     * With a balance of 21 that is at most 21; the snapshot keeps the unit prices; the hold bounds what is charged.
     */
    @Test void theHoldFollowsTheBalanceNotTheClientsNumber() throws Exception {
        var endpoint=AiModelEndpoint.builder().id("ep-1").enabled(true).build();
        when(models.resolveAcceptedEndpoint(eq(AiModelPurpose.DAP_PERSONA),isNull(),eq("studio")))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        when(prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_DIALOGUE))
                .thenReturn(new PromptService.ResolvedPrompt("system","{{input}}",new PromptParamsDto(null,null,null),"resource"));
        var pricing=mock(AiChatTokenPricing.class);
        var current=new AiChatTokenPricing.Rate(new BigDecimal(".18"),new BigDecimal("1.08"),1048576,65536);
        when(pricing.findDialogue("ep-1")).thenReturn(current);
        ReflectionTestUtils.setField(service,"tokenPricing",pricing);
        var wallet=new com.aistareco.aep.model.Wallet();wallet.setTotalBalance(21);
        when(credits.getOrCreateWallet("u1")).thenReturn(wallet);
        var accepted=service.post("u1","P1","IPT-P1",request("old-page","继续",5L));
        var captor=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(captor.capture());
        var run=captor.getValue();assertTrue(run.getCost()>0&&run.getCost()<=21,"capped by the balance, not by the page's 5");
        var exec=mapper.readTree(run.getInputJson()).path("_exec");
        var snapshot=mapper.treeToValue(exec.path("tokenPricing"),AiChatTokenPricing.Rate.class);
        assertEquals(current.inputCreditsPerK(),snapshot.inputCreditsPerK());
        assertEquals(current.outputCreditsPerK(),snapshot.outputCreditsPerK());
        assertEquals(run.getCost(),snapshot.maxCost());
        assertEquals(current.maxCost(),mapper.treeToValue(exec.path("dialogueRate"),AiChatTokenPricing.Rate.class).maxCost());
        verify(credits).hold(eq("u1"),eq(run.getCost()),eq(IpRunService.REF_TYPE),eq(accepted.runId()),anyString());
        assertEquals(accepted.runId(),service.post("u1","P1","IPT-P1",request("old-page","继续",5L)).runId());
        verify(runs,times(1)).save(any());
        var budget=DialogueLoop.TurnBudget.metered(snapshot,4096,java.time.Clock.systemUTC());
        budget.record(110000,0);assertEquals("budget",budget.blockReason(10000,256));
        assertThrows(BusinessException.class,()->snapshot.settleContinued(200000L,0L));
    }

    /**
     * Codex 2026-10-19 (P2): 「先停」 typed while the execution ran was queued as steering, so nothing stopped until the next
     * safe boundary and a model turn, and queued tasks were not cancelled. It is now the priority stop, at once.
     */
    @Test void aTypedStopWhileTheExecutionRunsIsThePriorityStopNotSteering() {
        var control = mock(StudioExecutionControl.class);
        when(control.active("u1", "P1", "IPT-P1")).thenReturn(Optional.of(new StudioExecutionControl.ExecutionView("PEX-1", "production", "running")));
        ReflectionTestUtils.setField(service, "executionControl", control);
        var result = service.post("u1", "P1", "IPT-P1", request("c-stop", "先停", 5L));
        assertEquals("applied", result.queueState());
        verify(control).stop(eq("u1"), eq("P1"), eq("PEX-1"), startsWith("say-"));
        verify(steering, never()).save(any());
        verify(runs, never()).save(any());
        verifyNoInteractions(credits);
        assertEquals("done", stored.get(result.messageId()).getStatus());
        assertTrue(stored.values().stream().anyMatch(m -> "assistant".equals(m.getRole()) && m.getText().contains("已停止")), "answered with what happened");
        assertEquals(result.messageId(), service.post("u1", "P1", "IPT-P1", request("c-stop", "先停", 5L)).messageId(), "a resend is the same message");
        verify(control, times(1)).stop(anyString(), anyString(), anyString(), anyString());
    }

    /** 「暂停」 keeps the queued tasks (pause), and a sentence that only mentions stopping is ordinary steering. */
    @Test void aTypedPauseIsAPauseAndAnythingLongerIsSteering() {
        var control = mock(StudioExecutionControl.class);
        when(control.active("u1", "P1", "IPT-P1")).thenReturn(Optional.of(new StudioExecutionControl.ExecutionView("PEX-1", "production", "running")));
        ReflectionTestUtils.setField(service, "executionControl", control);
        assertEquals("applied", service.post("u1", "P1", "IPT-P1", request("c-pause", "暂停一下", 5L)).queueState());
        verify(control).pause(eq("u1"), eq("P1"), eq("PEX-1"), startsWith("say-"));
        verify(control, never()).stop(anyString(), anyString(), anyString(), anyString());
        assertTrue(stored.values().stream().anyMatch(m -> "assistant".equals(m.getRole()) && m.getText().contains("已暂停")), "answered with what happened");
        for (String text : List.of("不要停", "要停吗？", "先停一下第 3 段，换个人物"))
            assertEquals("queued", service.post("u1", "P1", "IPT-P1", request("c-" + text.hashCode(), text, 5L)).queueState(), text);
        verify(control, times(1)).pause(anyString(), anyString(), anyString(), anyString());
    }

    /** With nothing working, 「停」 is just a message (there is nothing to stop). */
    @Test void aTypedStopWithNothingWorkingIsAnOrdinaryMessage() {
        when(fixtures.enabled()).thenReturn(true);
        var control = mock(StudioExecutionControl.class);
        ReflectionTestUtils.setField(service, "executionControl", control);
        assertEquals("accepted", service.post("u1", "P1", "IPT-P1", request("c-idle", "停", null)).queueState());
        verify(control, never()).stop(anyString(), anyString(), anyString(), anyString());
    }

    /**
     * Codex 2026-10-19 (P1): a later turn on a thread bound to an enterprise-paid execution could carry a personal payer
     * and was accepted, drawing on the enterprise stage budget. The execution's fixed payer now pays every such turn.
     */
    @Test void aTurnOnABoundExecutionIsPaidByItsFixedPayer() {
        when(fixtures.enabled()).thenReturn(true);
        var control = mock(StudioExecutionControl.class);
        when(control.active("u1", "P1", "IPT-P1")).thenReturn(Optional.of(new StudioExecutionControl.ExecutionView("PEX-1", "production", "needs_user")));
        ReflectionTestUtils.setField(service, "executionControl", control);
        var gate = mock(StudioExecutionGate.class);
        @SuppressWarnings("unchecked") org.springframework.beans.factory.ObjectProvider<StudioExecutionGate> gates = mock(org.springframework.beans.factory.ObjectProvider.class);
        when(gates.getIfAvailable()).thenReturn(gate);
        ReflectionTestUtils.setField(service, "gates", gates);
        var enterprise = new com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection("enterprise", "ent-1");
        when(gate.executionPayer("u1", "P1", "PEX-1")).thenReturn(enterprise);
        var personal = new PostMessageRequest("c-pay", "第 3 段换个人物", null, null, null, null,
                new com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection("personal", null), null, null);
        var refused = assertThrows(BusinessException.class, () -> service.post("u1", "P1", "IPT-P1", personal));
        assertEquals("BILLING_SELECTION_CONFLICT", refused.getCode());
        verify(runs, never()).save(any());
        var none = service.post("u1", "P1", "IPT-P1", request("c-none", "第 3 段换个人物", null));
        var run = ArgumentCaptor.forClass(IpRun.class);
        verify(runs).save(run.capture());
        assertEquals(none.runId(), run.getValue().getId());
        assertTrue(run.getValue().getInputJson().contains("\"billing\":{\"mode\":\"enterprise\",\"enterpriseId\":\"ent-1\"}"), "the fixed payer, not the message's");
    }
}
