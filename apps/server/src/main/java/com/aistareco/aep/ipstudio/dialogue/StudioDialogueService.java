package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.*;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.service.StudioPlanValidator;
import com.aistareco.aep.ipstudio.skill.StudioSkill;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.ipstudio.skill.StudioSkillRouter;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiChatTokenPricing;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Conversation threads on a canvas (S1, docs/ip-studio-conversational-video-recreation-plan.md §对话形态 / §线程转向与兼容契约).
 *
 * <ul>
 *   <li>One main thread per canvas, created lazily; legacy four-mode conversation records are imported once as history
 *       (never re-run or re-billed).</li>
 *   <li>A user message is saved idempotently on (thread, clientMessageId). An idle thread starts a parent
 *       {@code studio-dialogue} run (price check, hold, afterCommit dispatch); a busy thread queues the message as
 *       steering — input is never refused because the assistant is busy.</li>
 *   <li>Stop is a priority control; branches copy history without any authorization.</li>
 * </ul>
 * Every call checks owner, project and thread.
 */
@Service
public class StudioDialogueService implements StudioDialogueApprovals, StudioExecutionSteering, StudioExecutionMessages {
    private static final Logger log = LoggerFactory.getLogger(StudioDialogueService.class);
    static final String DEFAULT_TITLE = "全能创作";
    private static final Pattern CLIENT_ID = Pattern.compile("[A-Za-z0-9_.:-]{1,64}");
    static final int PAGE_DEFAULT = 50, PAGE_MAX = 200, TEXT_MAX = 4000, NODE_REFS_MAX = 64;
    private static final Set<String> ACTIVE_EXECUTION = Set.of("running", "paused", "needs_user");

    @Autowired(required = false) private com.aistareco.aep.enterprise.service.EnterpriseBillingService enterpriseBilling;
    @Autowired(required = false) private com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies;
    @Autowired(required = false) private AiChatTokenPricing tokenPricing;
    @Autowired(required = false) private StudioExecutionControl executionControl;
    /** D06: a turn on a thread bound to an active execution is attributed to its stage budget through the gate. */
    @Autowired(required = false) private org.springframework.beans.factory.ObjectProvider<StudioExecutionGate> gates;

    /** Execution bound to this thread: the stored pointer, else the canvas's active execution created from this thread. */
    Optional<StudioExecutionControl.ExecutionView> execution(String userId, String projectId, IpDialogueThread thread) {
        if (executionControl == null) return Optional.empty();
        try {
            var active = executionControl.active(userId, projectId, thread.getId());
            if (thread.getActiveExecutionId() == null || active.map(a -> a.id().equals(thread.getActiveExecutionId())).orElse(false)) return active;
            return Optional.of(new StudioExecutionControl.ExecutionView(thread.getActiveExecutionId(), thread.getStage(), null));
        } catch (BusinessException e) {
            log.info("[dialogue] execution view unavailable thread={} code={}", thread.getId(), e.getCode());
            return Optional.empty();
        }
    }

    private final IpProjectService projects;
    private final IpRunRepository runs;
    private final IpRunService runService;
    private final IpDialogueThreadRepository threads;
    private final IpDialogueMessageRepository messages;
    private final IpDialogueSteeringRepository steering;
    private final StudioDialogueStore store;
    private final StudioDialogueTurnWorker worker;
    private final StudioDialogueSignals signals;
    private final StudioSkillCatalog catalog;
    private final StudioFixtureProvider fixtures;
    private final AiModelInvocationService models;
    private final PromptService prompts;
    private final DapPricingService pricing;
    private final CreditService credits;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;

    public StudioDialogueService(IpProjectService projects, IpRunRepository runs, IpRunService runService, IpDialogueThreadRepository threads,
                                 IpDialogueMessageRepository messages, IpDialogueSteeringRepository steering, StudioDialogueStore store,
                                 StudioDialogueTurnWorker worker, StudioDialogueSignals signals, StudioSkillCatalog catalog,
                                 StudioFixtureProvider fixtures, AiModelInvocationService models, PromptService prompts,
                                 DapPricingService pricing, CreditService credits, ObjectMapper mapper, PlatformTransactionManager manager) {
        this.projects = projects; this.runs = runs; this.runService = runService; this.threads = threads; this.messages = messages;
        this.steering = steering; this.store = store; this.worker = worker; this.signals = signals; this.catalog = catalog;
        this.fixtures = fixtures; this.models = models; this.prompts = prompts; this.pricing = pricing; this.credits = credits;
        this.mapper = mapper; this.tx = new TransactionTemplate(manager);
    }

    // ── Read ────────────────────────────────────────────────────────────────────────────────────────────────────

    /** Main thread (or the branch the user was last in), recent messages and the resume cursor. Never starts a task. */
    public State conversation(String userId, String projectId) {
        IpProject project = projects.required(userId, projectId);
        ensureMainThread(userId, project);
        List<IpDialogueThread> all = threads.findByProjectIdAndOwnerUserIdOrderByLastOpenedAtDescCreatedAtDesc(projectId, userId);
        IpDialogueThread thread = all.isEmpty() ? threads.findById(mainId(projectId)).orElseThrow() : all.get(0);
        reconcile(thread.getId());
        return snapshot(userId, thread.getId());
    }

    public List<Message> messages(String userId, String projectId, String threadId, Long beforeSeq, Integer limit) {
        // Reading never changes which thread is current: the parent preview of a branch reads its parent's messages, and
        // that must not send the next GET /conversation there. Only POST /conversations/{threadId}/open does.
        IpDialogueThread thread = requireThread(userId, projectId, threadId);
        int size = limit == null ? PAGE_DEFAULT : Math.max(1, Math.min(PAGE_MAX, limit));
        List<IpDialogueMessage> page = beforeSeq == null
                ? new ArrayList<>(messages.findByThreadIdOrderBySeqDesc(thread.getId(), PageRequest.of(0, size)))
                : new ArrayList<>(messages.findByThreadIdAndSeqLessThanOrderBySeqDesc(thread.getId(), beforeSeq, PageRequest.of(0, size)));
        Collections.reverse(page);
        return page.stream().map(this::toDto).toList();
    }

    /** Owner + project + thread check shared by every endpoint (SSE included). */
    public IpDialogueThread requireThread(String userId, String projectId, String threadId) {
        projects.required(userId, projectId);
        return threads.findById(threadId == null ? "" : threadId)
                .filter(t -> userId.equals(t.getOwnerUserId()) && projectId.equals(t.getProjectId()))
                .orElseThrow(() -> BusinessException.notFound("STUDIO_THREAD_NOT_FOUND", "这条对话不存在，请刷新画布"));
    }

    // ── Threads: 「新对话」 / 「历史对话」 (docs/ip-studio-new-canvas-and-threads.md §3) ─────────────────────────────────

    static final int THREAD_LIST_MAX = 50, THREAD_TITLE_MAX = 24;
    static final String UNTITLED = "新对话";
    private static final Pattern BLANKS = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);

    /**
     * The user's threads on this canvas, latest activity first, at most {@value #THREAD_LIST_MAX}: those with messages plus
     * the current one (what GET /conversation returns, even when empty). A fixed number of queries whatever the thread
     * count: the threads, one grouped count, one batch of first user messages, one active-execution lookup (plus a
     * reconcile for a thread still pointing at a reply run, as GET /conversation does). Never starts a task.
     */
    public List<ThreadSummary> threads(String userId, String projectId) {
        IpProject project = projects.required(userId, projectId);
        ensureMainThread(userId, project);
        List<IpDialogueThread> all = threads.findByProjectIdAndOwnerUserIdOrderByLastOpenedAtDescCreatedAtDesc(projectId, userId);
        if (all.isEmpty()) return List.of();
        IpDialogueThread current = all.get(0);
        Map<String, IpDialogueMessageRepository.ThreadMessageStats> stats = new HashMap<>();
        for (var row : messages.statsByCanvas(projectId, userId)) stats.put(row.getThreadId(), row);
        List<IpDialogueThread> listed = new ArrayList<>();
        for (var t : all) if (t == current || stats.containsKey(t.getId())) listed.add(t);
        listed.sort(Comparator.comparing((IpDialogueThread t) -> lastActivity(t, stats.get(t.getId())))
                .thenComparing(IpDialogueThread::getId).reversed());
        if (listed.size() > THREAD_LIST_MAX) {
            boolean kept = listed.subList(0, THREAD_LIST_MAX).contains(current);
            listed = new ArrayList<>(listed.subList(0, THREAD_LIST_MAX));
            if (!kept) listed.set(THREAD_LIST_MAX - 1, current); // older than every kept row, so the order holds
        }
        for (int i = 0; i < listed.size(); i++) {
            IpDialogueThread t = listed.get(i);
            if (t.getActiveRunId() == null) continue;
            reconcile(t.getId()); // a reply run that died must not show 「进行中」 forever
            listed.set(i, threads.findById(t.getId()).orElse(t));
        }
        List<String> withMessages = listed.stream().map(IpDialogueThread::getId).filter(stats::containsKey).toList();
        Map<String, String> firstTexts = new HashMap<>();
        if (!withMessages.isEmpty()) for (var row : messages.firstUserTexts(withMessages)) firstTexts.put(row.getThreadId(), row.getText());
        Map<String, StudioExecutionControl.ExecutionView> running = activeExecutions(userId, projectId, withMessages);
        List<ThreadSummary> out = new ArrayList<>();
        for (var t : listed) {
            var s = stats.get(t.getId());
            out.add(new ThreadSummary(t.getId(), threadTitle(firstTexts.get(t.getId())), t.getParentThreadId(), s == null ? 0 : s.getMessageCount(),
                    iso(lastActivity(t, s)), iso(t.getCreatedAt()), t.getId().equals(current.getId()), threadActive(t, running)));
        }
        return out;
    }

    /**
     * 「新对话」: make an empty thread the current one and return it. Idempotent on (owner, clientRequestId): a replay returns
     * the thread that key created (made current again). Otherwise an empty idle thread the user already has on this canvas
     * (no message, no reply or execution, not a branch, no skill; the newest created) is reused instead of piling up empty
     * ones. The reused thread keeps its own key, so a replay of the same request reaches it again through the same rule.
     * No message is copied, no skill inherited, no model called, nothing charged.
     */
    public State createThread(String userId, String projectId, CreateThreadRequest request) {
        if (request == null || request.clientRequestId() == null || !CLIENT_ID.matcher(request.clientRequestId()).matches())
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "新对话的请求编号无效");
        IpProject project = projects.required(userId, projectId);
        ensureMainThread(userId, project);
        String threadId = tx.execute(s -> {
            projects.requiredForUpdate(userId, projectId); // concurrent 「新对话」 on one canvas run one after another: one empty thread, not two
            var prior = threads.findByOwnerUserIdAndClientRequestId(userId, request.clientRequestId()).orElse(null);
            if (prior != null) {
                if (!projectId.equals(prior.getProjectId()) || prior.getBranchFromMessageId() != null)
                    throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_REQUEST_CHANGED", "同一请求的内容已改变，请重新提交");
                threads.markOpened(prior.getId(), Instant.now());
                return prior.getId();
            }
            Set<String> withMessages = new HashSet<>();
            for (var row : messages.statsByCanvas(projectId, userId)) withMessages.add(row.getThreadId());
            var reusable = threads.findByProjectIdAndOwnerUserIdOrderByLastOpenedAtDescCreatedAtDesc(projectId, userId).stream()
                    .filter(t -> !withMessages.contains(t.getId()) && t.getActiveTurnId() == null && t.getActiveRunId() == null
                            && t.getActiveExecutionId() == null && t.getParentThreadId() == null && t.getSkillKey() == null)
                    .max(Comparator.comparing(IpDialogueThread::getCreatedAt).thenComparing(IpDialogueThread::getId)).orElse(null);
            if (reusable != null) {
                threads.markOpened(reusable.getId(), Instant.now());
                return reusable.getId();
            }
            Instant now = Instant.now();
            String id = "IPT-" + StudioDialogueStore.uuid20();
            threads.save(IpDialogueThread.builder().id(id).projectId(projectId).ownerUserId(userId).clientRequestId(request.clientRequestId())
                    .title(DEFAULT_TITLE).lastOpenedAt(now).createdAt(now).updatedAt(now).build());
            return id;
        });
        reconcile(threadId); // a replayed key may point at a thread that has since replied
        return snapshot(userId, threadId);
    }

    /**
     * One thread's snapshot, by id, without making it current: what reconnects, polls and catch-up reads use. A poll still on
     * its way when the user moved to another conversation (or a second tab parked on another thread) must not take the
     * server's current thread back (Codex review 2026-10-20). Aligns a dead reply run like every other read. Never starts a task.
     */
    public State readThread(String userId, String projectId, String threadId) {
        IpDialogueThread thread = requireThread(userId, projectId, threadId);
        reconcile(thread.getId());
        return snapshot(userId, thread.getId());
    }

    /**
     * Open one thread: it becomes the current one (GET /conversation returns it from now on). Only the user's own choice
     * (a row of 「历史对话」) calls this; reads go through {@link #readThread}. Never starts a task.
     */
    public State openThread(String userId, String projectId, String threadId) {
        IpProject project = projects.required(userId, projectId);
        ensureMainThread(userId, project);
        IpDialogueThread thread = requireThread(userId, projectId, threadId);
        threads.markOpened(thread.getId(), Instant.now());
        reconcile(thread.getId());
        return snapshot(userId, thread.getId());
    }

    /**
     * Active executions of the listed threads, one lookup; null when the executor is absent or cannot answer, and then a
     * bound pointer counts as active, as {@link #execution} treats a pointer whose status is unknown.
     */
    private Map<String, StudioExecutionControl.ExecutionView> activeExecutions(String userId, String projectId, List<String> threadIds) {
        if (executionControl == null) return null;
        if (threadIds.isEmpty()) return Map.of();
        try { return executionControl.activeByThread(userId, projectId, threadIds); }
        catch (BusinessException e) {
            log.info("[dialogue] execution list unavailable project={} code={}", projectId, e.getCode());
            return null;
        }
    }

    /** A reply is running, or an execution created from this thread is running / paused / waiting for the user. */
    private static boolean threadActive(IpDialogueThread t, Map<String, StudioExecutionControl.ExecutionView> running) {
        if (t.getActiveTurnId() != null) return true;
        if (running == null) return t.getActiveExecutionId() != null;
        var view = running.get(t.getId());
        return view != null && (view.status() == null || ACTIVE_EXECUTION.contains(view.status()));
    }

    /**
     * The later of the last message and the thread's creation: a branch copies its messages with their original times, so
     * by the last message alone a branch just made would sort below the thread it came from.
     */
    private static Instant lastActivity(IpDialogueThread t, IpDialogueMessageRepository.ThreadMessageStats s) {
        Instant last = s == null ? null : s.getLastAt();
        return last == null || last.isBefore(t.getCreatedAt()) ? t.getCreatedAt() : last;
    }

    /** First user message with whitespace runs collapsed, at most {@value #THREAD_TITLE_MAX} code points plus 「…」; 「新对话」 when none. */
    static String threadTitle(String firstUserText) {
        String text = firstUserText == null ? "" : BLANKS.matcher(firstUserText).replaceAll(" ").strip();
        if (text.isEmpty()) return UNTITLED;
        if (text.codePointCount(0, text.length()) <= THREAD_TITLE_MAX) return text;
        return text.substring(0, text.offsetByCodePoints(0, THREAD_TITLE_MAX)) + "…";
    }

    /** Consistent snapshot: messages and latestSeq are read under the thread lock that every event write takes. */
    State snapshot(String userId, String threadId) {
        State state = tx.execute(s -> {
            IpDialogueThread thread = threads.lockById(threadId).orElseThrow();
            List<IpDialogueMessage> page = new ArrayList<>(messages.findByThreadIdOrderBySeqDesc(threadId, PageRequest.of(0, PAGE_DEFAULT)));
            Collections.reverse(page);
            String cursor = !page.isEmpty() && messages.existsByThreadIdAndSeqLessThan(threadId, page.get(0).getSeq()) ? String.valueOf(page.get(0).getSeq()) : null;
            return new State(toDto(thread), page.stream().map(this::toDto).toList(), cursor, thread.getLastSeq(), null);
        });
        IpDialogueThread thread = threads.findById(threadId).orElse(null);
        if (thread == null || executionControl == null) return state;
        var view = execution(userId, thread.getProjectId(), thread).orElse(null);
        if (view == null) return state;
        Object execution;
        try { execution = executionControl.describe(userId, thread.getProjectId(), view.id()); }
        catch (BusinessException e) { log.info("[dialogue] execution projection unavailable thread={} code={}", threadId, e.getCode()); execution = null; }
        var t = state.thread();
        var withExecution = new DialogueThread(t.id(), t.projectId(), t.parentThreadId(), t.branchFromMessageId(), t.title(), t.lastSeq(),
                t.activeTurnId(), view.id(), t.createdAt(), t.updatedAt(), t.skillKey(), t.skillVersion());
        return new State(withExecution, state.messages(), state.nextCursor(), state.latestSeq(), execution);
    }

    // ── Post ────────────────────────────────────────────────────────────────────────────────────────────────────

    public PostMessageResult post(String userId, String projectId, String threadId, PostMessageRequest request) {
        validate(request);
        requireThread(userId, projectId, threadId);
        reconcile(threadId); // an abandoned turn must not swallow new input as steering forever
        var said = StudioStopIntent.of(request.text());
        if (said != null && distinct(request.pinnedNodeIds()).isEmpty() && distinct(request.attachmentNodeIds()).isEmpty()) {
            PostMessageResult controlled = postControl(userId, projectId, threadId, request, said);
            if (controlled != null) return controlled;
        }
        PostMessageResult result = tx.execute(s -> postLocked(userId, projectId, threadId, request));
        return result;
    }

    /**
     * 「先停」「停止」「暂停」 typed while a reply or a bound execution is working is a priority control, not steering: it goes
     * through {@link #control} at once instead of waiting in the queue for the next safe boundary and a model turn (Codex
     * 2026-10-19). Stop cancels the cancellable queued tasks like the stop button; pause keeps them (plan §制作中输入与转向).
     * The message stays in the thread, answered with what happened; nothing is charged. Null when nothing is working (or
     * the message was already posted): it is then an ordinary message.
     */
    private PostMessageResult postControl(String userId, String projectId, String threadId, PostMessageRequest request, StudioStopIntent.Kind kind) {
        if (messages.findByThreadIdAndClientMessageId(threadId, request.clientMessageId()).isPresent()) return null;
        IpDialogueThread thread = threads.findById(threadId).orElse(null);
        if (thread == null) return null;
        var bound = execution(userId, projectId, thread).filter(v -> v.status() == null || ACTIVE_EXECUTION.contains(v.status())).orElse(null);
        if (bound == null && thread.getActiveTurnId() == null) return null;
        String action = kind == StudioStopIntent.Kind.PAUSE && bound != null ? "pause" : "stop";
        String key = UUID.nameUUIDFromBytes((threadId + "|" + request.clientMessageId()).getBytes(StandardCharsets.UTF_8)).toString().replace("-", "");
        try { control(userId, projectId, threadId, new ControlRequest("say-" + key, action, null)); }
        catch (BusinessException e) {
            log.info("[dialogue] typed {} not applied, posting it as a message thread={} code={}", action, threadId, e.getCode());
            return null;
        }
        String[] id = new String[1];
        store.write(threadId, t -> {
            var prior = messages.findByThreadIdAndClientMessageId(threadId, request.clientMessageId()).orElse(null);
            if (prior != null) { id[0] = prior.getId(); return List.of(); }
            Instant now = Instant.now();
            var message = IpDialogueMessage.builder().id("IDM-" + StudioDialogueStore.uuid20()).threadId(threadId)
                    .seq(StudioDialogueStore.nextMessageSeq(t)).role("user").text(request.text()).blocksJson("[]")
                    .pinnedNodeIdsJson("[]").attachmentNodeIdsJson("[]").clientMessageId(request.clientMessageId())
                    .requestJson(mapper.createObjectNode().put("control", action).toString()).status(IpDialogueMessage.DONE)
                    .createdAt(now).updatedAt(now).build();
            messages.save(message);
            id[0] = message.getId();
            t.setLastOpenedAt(now);
            return List.of();
        });
        String reply = "pause".equals(action) ? "已暂停，已经提交的任务会照常做完。"
                : bound != null ? "已停止，已经开始生成的任务会照常做完。"
                : "已停止。";
        postExecutionMessage(threadId, bound == null ? null : bound.id(), "ack-" + key, reply, null, null);
        return new PostMessageResult(id[0], null, null, "applied");
    }

    private PostMessageResult postLocked(String userId, String projectId, String threadId, PostMessageRequest request) {
        IpProject project = projects.requiredForUpdate(userId, projectId);
        IpDialogueThread thread = threads.lockById(threadId).filter(t -> userId.equals(t.getOwnerUserId()) && projectId.equals(t.getProjectId()))
                .orElseThrow(() -> BusinessException.notFound("STUDIO_THREAD_NOT_FOUND", "这条对话不存在，请刷新画布"));
        List<String> pinned = distinct(request.pinnedNodeIds()), attachments = distinct(request.attachmentNodeIds());
        var prior = messages.findByThreadIdAndClientMessageId(threadId, request.clientMessageId()).orElse(null);
        if (prior != null) {
            if (!Objects.equals(prior.getText(), request.text()) || !ids(prior.getPinnedNodeIdsJson()).equals(pinned)
                    || !ids(prior.getAttachmentNodeIdsJson()).equals(attachments))
                throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_REQUEST_CHANGED", "同一条消息的内容已改变，请重新发送");
            String state = IpDialogueMessage.QUEUED.equals(prior.getStatus()) ? "queued" : IpDialogueMessage.APPLIED.equals(prior.getStatus()) ? "applied" : "accepted";
            return new PostMessageResult(prior.getId(), prior.getTurnId(), prior.getRunId(), state);
        }
        JsonNode doc = projects.readDoc(project);
        for (String id : concat(pinned, attachments))
            if (IpDocs.node(doc, id) == null) throw BusinessException.badRequest("STUDIO_CONTEXT_NOT_FOUND", "引用的画布内容不存在，请重新选择");
        for (String id : attachments) {
            String key = IpDocs.primaryStorageKey(IpDocs.node(doc, id));
            if (key != null) projects.requireOwnedAssetKey(userId, key); // a material must be uploaded and owned before tools can use it
        }
        Instant now = Instant.now();
        boolean busy = thread.getActiveTurnId() != null;
        // D03: while the bound execution is running (even with no active turn) a new message is steering for it: the
        // executor reads it at its next safe boundary, submits nothing more, and opens the turn that answers it.
        var bound = execution(userId, projectId, thread).orElse(null);
        String steeredExecution = bound != null && "running".equals(bound.status()) ? bound.id() : null;
        boolean queue = busy || steeredExecution != null;
        ObjectNode settings = mapper.createObjectNode();
        if (request.billing() != null) settings.set("billing", mapper.valueToTree(request.billing()));
        if (request.maxCost() != null) settings.put("maxCost", request.maxCost());
        if (request.skillKey() != null) settings.put("skillKey", request.skillKey());
        if (request.expectedPlanRevision() != null) settings.put("expectedPlanRevision", request.expectedPlanRevision());
        if (request.model() != null && !request.model().isBlank()) settings.put("model", request.model().strip());
        IpDialogueMessage message = IpDialogueMessage.builder().id("IDM-" + StudioDialogueStore.uuid20()).threadId(threadId)
                .seq(StudioDialogueStore.nextMessageSeq(thread)).role("user").text(request.text()).blocksJson("[]")
                .pinnedNodeIdsJson(json(pinned)).attachmentNodeIdsJson(json(attachments)).clientMessageId(request.clientMessageId())
                .requestJson(settings.toString()).status(queue ? IpDialogueMessage.QUEUED : IpDialogueMessage.DONE).createdAt(now).updatedAt(now).build();
        messages.save(message);
        thread.setLastOpenedAt(now);
        if (queue) {
            // executionId is set only while the execution runs: those are the rows the executor must see before it
            // submits anything else. A message to a paused / waiting execution is ordinary conversation.
            steering.save(IpDialogueSteering.builder().id("IDS-" + StudioDialogueStore.uuid20()).threadId(threadId).messageId(message.getId())
                    .turnId(thread.getActiveTurnId()).executionId(steeredExecution).status(IpDialogueSteering.QUEUED).createdAt(now).build());
            if (busy) { message.setTurnId(thread.getActiveTurnId()); message.setRunId(thread.getActiveRunId()); messages.save(message); }
            thread.setUpdatedAt(now);
            threads.save(thread);
            if (steeredExecution != null) wakeAfterCommit(steeredExecution);
            return new PostMessageResult(message.getId(), thread.getActiveTurnId(), thread.getActiveRunId(), "queued");
        }
        var started = startTurn(userId, thread, List.of(message), request.billing(), request.maxCost(), request.skillKey(), request.model());
        return new PostMessageResult(message.getId(), started.turnId(), started.runId(), "accepted");
    }

    record Started(String turnId, String runId) {}

    /**
     * Accept a parent dialogue turn inside the caller's transaction (project and thread locks held): resolve the endpoint
     * and prompt, require the token price and the user's approved ceiling, hold credits, create the run and the
     * streaming assistant message, and dispatch after commit.
     */
    private Started startTurn(String userId, IpDialogueThread thread, List<IpDialogueMessage> inputs, BillingSelection billing, Long maxCost,
                              String skillKey, String requestedModel) {
        boolean mock = fixtures.enabled();
        var bound = execution(userId, thread.getProjectId(), thread).filter(v -> v.status() == null || ACTIVE_EXECUTION.contains(v.status())).orElse(null);
        // The skill is bound per job, not per thread for good (意图直达 2026-10-20): while an execution is active its method
        // stays; otherwise each message is routed again and may switch the thread to another method (画完图再写文案).
        StudioSkill current = thread.getSkillKey() == null ? null : catalog.find(thread.getSkillKey()).filter(s -> !s.withdrawn()).orElse(null);
        StudioSkill skill;
        boolean rebound = false, unbind = false;
        if (skillKey != null && !skillKey.isBlank()) {
            // Keeping the bound method only needs it not withdrawn (a draft keeps working); choosing another needs an active one.
            skill = current != null && current.key().equals(skillKey) ? catalog.requireForNewWork(skillKey) : catalog.requireForNewSelection(skillKey);
            if (current != null && !current.key().equals(skill.key())) {
                if (bound != null) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "这条对话正在按另一种方法制作；要换方法，请先结束这次制作，或从某条消息重新开始");
                rebound = true;
            } else rebound = current == null;
        } else if (bound != null) {
            skill = current;
        } else {
            // S3 routing (docs/ip-studio-dialogue-intents.md §4): the best match switches; nothing that names a job keeps the
            // current method; a tie unbinds the thread for this message and the model picks with read_skill (2026-10-21:
            // a tie used to keep the current method, so 「用这几张图做一段视频」 right after the pictures stayed 出图).
            var decision = routeSkill(userId, thread, inputs, current);
            switch (decision.kind()) {
                case MATCH -> {
                    skill = decision.skill();
                    rebound = current == null || !current.key().equals(skill.key());
                }
                case OPEN -> {
                    skill = null;
                    unbind = thread.getSkillKey() != null;
                }
                default -> skill = current;
            }
        }
        var gate = gates == null ? null : gates.getIfAvailable();
        // D10: an active execution's payer is fixed at its confirmation, and a turn on its thread counts against its stage
        // budget (D06), so the turn is paid by that same account. A message naming another payer is refused; one naming
        // none uses the fixed one (Codex 2026-10-19: a later personal selection was accepted and drew on the enterprise stage).
        BillingSelection fixedPayer = bound == null || gate == null ? null : gate.executionPayer(userId, thread.getProjectId(), bound.id());
        if (fixedPayer != null) {
            if (billing != null && !com.aistareco.aep.enterprise.service.EnterpriseBillingService.normalize(billing).equals(fixedPayer))
                throw new BusinessException(HttpStatus.CONFLICT, "BILLING_SELECTION_CONFLICT",
                        "这次制作已确认由" + ("enterprise".equals(fixedPayer.mode()) ? "企业" : "个人") + "积分付款，制作期间的对话也由它付；要换付款账户，请先结束这次制作");
            billing = fixedPayer;
        }
        // Without a running execution a new plan starts in the skill's first stage (production for 原创创作), whatever stage
        // the thread reached in an earlier, finished execution.
        String stage = bound != null && bound.stage() != null ? bound.stage() : skill == null ? null : skill.firstStage();
        AiModelEndpoint endpoint = null;
        PromptService.ResolvedPrompt prompt = null;
        AiChatTokenPricing.Rate rate = null;
        long cost = 0;
        int perCall = 4096;
        if (!mock) {
            // Same resolution as the assistant: a model the user picked is honored only where the scene is selectable.
            String model = requestedModel == null || requestedModel.isBlank() ? null : requestedModel.strip();
            if (scenePolicies != null) {
                if ("fixed".equals(scenePolicies.mode("studio", "script"))) model = null;
                endpoint = scenePolicies.resolve("studio", "script", model, pricing.ipIdentity()).resolved().endpoint();
            } else {
                boolean chosen = model != null;
                // D08: one rule with the worker (AiModelInvocationService#resolveAcceptedEndpoint): the default binding needs
                // no candidate; any other chosen model must be an enabled candidate, refused here before anything is frozen.
                endpoint = models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA, model, "studio")
                        .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, chosen ? "ENDPOINT_NOT_ALLOWED" : "AI_NOT_CONFIGURED",
                                chosen ? "所选文本模型不可用：它不是对话用途的默认模型，也没有在后台「AI 模型」里启用为对话用途的候选模型"
                                        : "还没有配置可用的对话模型：请在后台「AI 模型」里为对话用途绑定默认模型")).endpoint();
            }
            prompt = prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_DIALOGUE);
            if ("code".equals(prompt.origin())) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED", "尚未配置对话提示词");
            rate = tokenPricing == null ? null : tokenPricing.find(endpoint.getId());
            if (rate == null) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_TOKEN_PRICE_NOT_CONFIGURED", "此模型尚未配置按量积分售价");
            cost = rate.maxCost();
            if (maxCost == null) throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_PRICE_CHANGED", "模型计费配置已更新，请刷新后重试");
            IpRunService.requireApprovedCost(maxCost, cost);
            perCall = Math.min(Math.max(1024, prompt.params().maxTokensOrDefault()), rate.maxOutputTokens());
            if (endpoint.getChatMaxOutputTokens() != null) perCall = Math.min(perCall, endpoint.getChatMaxOutputTokens());
        }
        String turnId = "TRN-" + StudioDialogueStore.uuid20();
        String runId = "IPR-" + StudioDialogueStore.uuid20();
        String assistantId = "IDM-" + StudioDialogueStore.uuid20();
        Instant now = Instant.now();
        ObjectNode input = mapper.createObjectNode().put("operation", "dialogue").put("turnId", turnId).put("mock", mock);
        input.putObject("dialogue").put("threadId", thread.getId()).put("messageId", inputs.get(0).getId());
        if (maxCost != null) input.put("maxCost", maxCost);
        if (billing != null) input.set("billing", mapper.valueToTree(billing));
        if (skill != null) input.put("skillKey", skill.key()).put("skillVersion", skill.version());
        if (stage != null) input.put("stage", stage);
        var context = input.putArray("contextNodeIds");
        for (var m : inputs) { ids(m.getPinnedNodeIdsJson()).forEach(context::add); ids(m.getAttachmentNodeIdsJson()).forEach(context::add); }
        input.put("prompt", excerpt(inputs.get(inputs.size() - 1).getText(), 500));
        ObjectNode exec = input.putObject("_exec").put("holdTotal", cost).put("unitCost", cost).put("billingUnit", mock ? "per_call" : "per_token")
                .put("assistantMessageId", assistantId).put("maxTokens", perCall);
        var ids = exec.putArray("userMessageIds");
        inputs.forEach(m -> ids.add(m.getId()));
        exec.putArray("childRunIds");
        if (stage != null) exec.put("stage", stage);
        if (bound != null) exec.put("executionId", bound.id());
        if (skill != null) exec.set("skill", skill.snapshot(mapper));
        if (!mock) {
            exec.put("endpointId", endpoint.getId()).put("temperature", prompt.params().temperatureOrDefault());
            exec.set("tokenPricing", mapper.valueToTree(rate));
            exec.putObject("prompt").put("key", PromptService.KEY_DAP_IP_STUDIO_SKILL_DIALOGUE).put("system", prompt.system()).put("user", prompt.userTemplate());
            input.put("promptKey", PromptService.KEY_DAP_IP_STUDIO_SKILL_DIALOGUE);
        }
        // D06: a turn on a thread bound to an active execution belongs to that stage: the same pre-submit check
        // (spent + inFlight + this turn's ceiling ≤ approved cap) runs before anything is frozen; 402 when it does not fit.
        if (bound != null && gate != null && cost > 0) {
            String attributedStage = gate.attributeTurn(userId, thread.getProjectId(), bound.id(), runId, cost);
            if (attributedStage != null) exec.put("attributedExecutionId", bound.id()).put("attributedStage", attributedStage);
        }
        var account = enterpriseBilling == null ? null : enterpriseBilling.reserve(userId, billing, IpRunService.REF_TYPE, runId,
                endpoint == null ? null : endpoint.getId(), cost, "Studio 对话");
        if (enterpriseBilling == null && cost > 0) credits.hold(userId, cost, IpRunService.REF_TYPE, runId, "Studio 对话");
        IpRun run = IpRun.builder().id(runId).projectId(thread.getProjectId()).ownerUserId(userId).nodeId(thread.getId())
                .kind(StudioDialogueTurnWorker.KIND).status(IpRun.STATUS_RUNNING).stage("queued").cost(cost)
                .clientRequestId(inputs.get(0).getId()).inputFingerprint(fingerprint(thread.getId(), inputs)).inputJson(input.toString())
                .outputJson("{}").createdAt(now).heartbeatAt(now).build();
        if (account != null) {
            run.setBillingWalletId(account.walletId()); run.setEnterpriseId(account.enterpriseId());
            run.setMembershipId(account.membershipId()); run.setBillingAuthorizationId(account.billingAuthorizationId());
        }
        runs.save(run);
        messages.save(IpDialogueMessage.builder().id(assistantId).threadId(thread.getId()).seq(StudioDialogueStore.nextMessageSeq(thread))
                .turnId(turnId).runId(runId).role("assistant").text("").blocksJson("[]").settling(!mock).status(IpDialogueMessage.STREAMING)
                .createdAt(now).updatedAt(now).build());
        for (var m : inputs) { m.setTurnId(turnId); m.setRunId(runId); m.setStatus(IpDialogueMessage.DONE); m.setUpdatedAt(now); messages.save(m); }
        if (skill != null && (thread.getSkillKey() == null || rebound)) { thread.setSkillKey(skill.key()); thread.setSkillVersion(skill.version()); }
        // A tie: the thread holds no method until the model binds one with read_skill (which binds only an unbound thread or
        // a switch), so the old method neither carries over to the next message nor shows on the thread meanwhile.
        if (unbind) { thread.setSkillKey(null); thread.setSkillVersion(null); thread.setStage(null); }
        if (stage != null && bound == null) thread.setStage(stage);
        thread.setActiveTurnId(turnId); thread.setActiveRunId(runId); thread.setLastOpenedAt(now); thread.setUpdatedAt(now);
        threads.save(thread);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try { worker.execute(runId); } catch (RuntimeException e) { worker.reject(runId, e); }
            }
        });
        return new Started(turnId, runId);
    }

    /**
     * Intent routing for a message on a thread with no active execution ({@link StudioSkillRouter#decide}): the media types
     * of the pinned and attached nodes and the message text against each active skill's triggers. A message that names no
     * job keeps the method the thread already has (or stays unbound, 「全能创作」); a tie leaves the choice to the model,
     * which binds with read_skill. The caller persists a change on the thread.
     */
    private StudioSkillRouter.Decision routeSkill(String userId, IpDialogueThread thread, List<IpDialogueMessage> inputs, StudioSkill current) {
        List<StudioSkill> active = catalog.available();
        if (active.isEmpty()) return StudioSkillRouter.decide(active, Set.of(), null, current);
        Set<String> media = new LinkedHashSet<>();
        StringBuilder text = new StringBuilder();
        JsonNode doc = projects.readDoc(projects.required(userId, thread.getProjectId()));
        for (var m : inputs) {
            if (m.getText() != null) text.append(m.getText()).append('\n');
            for (String id : concat(ids(m.getPinnedNodeIdsJson()), ids(m.getAttachmentNodeIdsJson()))) {
                String type = StudioSkillRouter.mediaOf(IpDocs.node(doc, id) == null ? null : IpDocs.node(doc, id).path("type").asText(null));
                if (type != null) media.add(type);
            }
        }
        var decision = StudioSkillRouter.decide(active, media, text.toString(), current);
        StudioSkill chosen = decision.skill();
        if (decision.kind() == StudioSkillRouter.Kind.OPEN)
            log.info("[dialogue] routing tie thread={} among {} media={} (was {}); the model picks", thread.getId(), decision.tied(), media,
                    current == null ? "unbound" : current.key());
        else if (decision.kind() == StudioSkillRouter.Kind.MATCH && (current == null || !current.key().equals(chosen.key())))
            log.info("[dialogue] routed thread={} to skill={} v{} by {} media={}", thread.getId(), chosen.key(), chosen.version(), decision.reason(), media);
        return decision;
    }

    /**
     * After a turn ended: user messages that arrived as steering but were not consumed open the next turn (they were sent
     * to be answered). If that turn cannot be accepted (price changed, balance), the messages are marked failed with the
     * reason instead of silently disappearing.
     */
    public void afterTurn(String threadId) {
        IpDialogueThread snapshot = threads.findById(threadId).orElse(null);
        if (snapshot == null || snapshot.getActiveTurnId() != null) return;
        if (steering.findByThreadIdAndStatusOrderByCreatedAtAscIdAsc(threadId, IpDialogueSteering.QUEUED).isEmpty()) return;
        try {
            tx.executeWithoutResult(s -> {
                projects.requiredForUpdate(snapshot.getOwnerUserId(), snapshot.getProjectId());
                IpDialogueThread thread = threads.lockById(threadId).orElseThrow();
                if (thread.getActiveTurnId() != null) return;
                var rows = steering.findByThreadIdAndStatusOrderByCreatedAtAscIdAsc(threadId, IpDialogueSteering.QUEUED);
                if (rows.isEmpty()) return;
                List<IpDialogueMessage> inputs = new ArrayList<>();
                for (var row : rows) {
                    row.setStatus(IpDialogueSteering.APPLIED); row.setAppliedAt(Instant.now()); steering.save(row);
                    messages.findById(row.getMessageId()).ifPresent(inputs::add);
                }
                if (inputs.isEmpty()) return;
                JsonNode settings = parse(inputs.get(inputs.size() - 1).getRequestJson());
                BillingSelection billing = settings.hasNonNull("billing") ? mapper.convertValue(settings.path("billing"), BillingSelection.class) : null;
                Long maxCost = settings.hasNonNull("maxCost") ? settings.path("maxCost").asLong() : null;
                startTurn(snapshot.getOwnerUserId(), thread, inputs, billing, maxCost, null, settings.path("model").asText(null));
            });
        } catch (BusinessException e) {
            log.info("[dialogue] follow-up turn refused thread={} code={}", threadId, e.getCode());
            rejectQueued(threadId, "这几条消息没能开始回复：" + e.getMessage());
        } catch (org.springframework.web.server.ResponseStatusException e) {
            log.info("[dialogue] follow-up turn refused thread={} status={}", threadId, e.getStatusCode());
            rejectQueued(threadId, "这几条消息没能开始回复：" + (e.getReason() == null ? "积分或计费状态已变化" : e.getReason()) + "，请重新发送");
        }
    }

    private void rejectQueued(String threadId, String note) {
        store.write(threadId, t -> {
            int n = 0;
            for (var row : steering.findByThreadIdAndStatusOrderByCreatedAtAscIdAsc(threadId, IpDialogueSteering.QUEUED)) {
                row.setStatus(IpDialogueSteering.REJECTED); row.setAppliedAt(Instant.now()); steering.save(row);
                messages.findById(row.getMessageId()).ifPresent(m -> { m.setStatus(IpDialogueMessage.FAILED); m.setUpdatedAt(Instant.now()); messages.save(m); });
                n++;
            }
            if (n > 0) messages.save(IpDialogueMessage.builder().id("IDM-" + StudioDialogueStore.uuid20()).threadId(threadId)
                    .seq(StudioDialogueStore.nextMessageSeq(t)).role("system").text(note).blocksJson("[]").status(IpDialogueMessage.FAILED)
                    .createdAt(Instant.now()).build());
            return List.of();
        });
    }

    // ── Control ─────────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Priority control, idempotent on controlId. {@code stop}: flag the active parent run (the loop checks it at every
     * boundary and inside a live stream), reject queued steering, ask cancellable child runs to stop, and forward to a
     * bound plan execution. {@code pause} / {@code resume} are forwarded to the execution.
     */
    public State control(String userId, String projectId, String threadId, ControlRequest request) {
        if (request == null || request.controlId() == null || !CLIENT_ID.matcher(request.controlId()).matches())
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "控制请求编号无效");
        if (!Set.of("stop", "pause", "resume").contains(String.valueOf(request.action())))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "不支持的操作");
        IpDialogueThread thread = requireThread(userId, projectId, threadId);
        if (request.controlId().equals(thread.getLastControlId())) return snapshot(userId, threadId);
        String bound = execution(userId, projectId, thread).map(StudioExecutionControl.ExecutionView::id).orElse(null);
        if (request.executionId() != null && !request.executionId().equals(bound))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "这条对话没有绑定这次制作");
        String executionId = bound;
        if ("stop".equals(request.action())) {
            String runId = thread.getActiveRunId();
            List<String> children = new ArrayList<>();
            if (runId != null) {
                tx.executeWithoutResult(s -> runs.lockById(runId).ifPresent(run -> {
                    if (!IpRun.STATUS_RUNNING.equals(run.getStatus())) return;
                    run.setCancelRequested(true);
                    runs.save(run);
                    parse(run.getInputJson()).path("_exec").path("childRunIds").forEach(id -> children.add(id.asText()));
                }));
                signals.stop(runId);
            }
            store.write(threadId, t -> {
                t.setLastControlId(request.controlId());
                for (var row : steering.findByThreadIdAndStatusOrderByCreatedAtAscIdAsc(threadId, IpDialogueSteering.QUEUED)) {
                    row.setStatus(IpDialogueSteering.REJECTED); row.setAppliedAt(Instant.now()); steering.save(row);
                    messages.findById(row.getMessageId()).ifPresent(m -> { m.setStatus(IpDialogueMessage.INTERRUPTED); m.setUpdatedAt(Instant.now()); messages.save(m); });
                }
                return List.of();
            });
            for (String child : children) {
                try { runService.cancel(userId, child); }
                catch (BusinessException e) { log.info("[dialogue] child run keeps its accepted vendor job run={} code={}", child, e.getCode()); }
            }
            // A priority stop never fails because the bound execution already ended (or ended meanwhile).
            if (executionId != null && executionControl != null) {
                try { executionControl.stop(userId, projectId, executionId, request.controlId()); }
                catch (BusinessException e) { log.info("[dialogue] stop: execution not stoppable execution={} code={}", executionId, e.getCode()); }
            }
            return snapshot(userId, threadId);
        }
        if (executionId == null) throw BusinessException.badRequest("STUDIO_EXECUTION_NOT_ACTIVE", "当前没有进行中的制作");
        if (executionControl == null) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "STUDIO_EXECUTION_UNAVAILABLE", "后台制作尚未开放");
        if ("pause".equals(request.action())) executionControl.pause(userId, projectId, executionId, request.controlId());
        else executionControl.resume(userId, projectId, executionId, request.controlId());
        store.write(threadId, t -> { t.setLastControlId(request.controlId()); return List.of(); });
        return snapshot(userId, threadId);
    }

    /** Bind (or clear with null) the plan execution this thread drives; called by the plan executor. */
    public void bindExecution(String threadId, String executionId, String stage) {
        store.write(threadId, t -> {
            t.setActiveExecutionId(executionId);
            if (stage != null) t.setStage(stage);
            // A finished execution leaves no stage behind: the next job starts in its own skill's starting stage (a
            // thread that kept 「production」 after unbinding made the next plan a stage confirmation with nothing to confirm).
            else if (executionId == null) t.setStage(null);
            return List.of();
        });
    }

    // ── Branch ──────────────────────────────────────────────────────────────────────────────────────────────────

    /** Copy history up to {@code fromMessageId} into a new thread. Approvals become superseded; nothing is authorized. */
    public State branch(String userId, String projectId, String threadId, BranchRequest request) {
        if (request == null || request.clientRequestId() == null || !CLIENT_ID.matcher(request.clientRequestId()).matches()
                || request.fromMessageId() == null || request.fromMessageId().isBlank())
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "请选择从哪条消息重新开始");
        requireThread(userId, projectId, threadId);
        var prior = threads.findByOwnerUserIdAndClientRequestId(userId, request.clientRequestId()).orElse(null);
        if (prior != null) {
            if (!threadId.equals(prior.getParentThreadId()) || !request.fromMessageId().equals(prior.getBranchFromMessageId()))
                throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_REQUEST_CHANGED", "同一请求的内容已改变，请重新提交");
            return snapshot(userId, prior.getId());
        }
        String branchId = tx.execute(s -> {
            IpDialogueThread source = threads.lockById(threadId).orElseThrow();
            IpDialogueMessage from = messages.findById(request.fromMessageId()).filter(m -> threadId.equals(m.getThreadId()))
                    .orElseThrow(() -> BusinessException.notFound("STUDIO_MESSAGE_NOT_FOUND", "这条消息不存在"));
            Instant now = Instant.now();
            String id = "IPT-" + StudioDialogueStore.uuid20();
            IpDialogueThread branch = IpDialogueThread.builder().id(id).projectId(projectId).ownerUserId(userId).parentThreadId(threadId)
                    .branchFromMessageId(from.getId()).clientRequestId(request.clientRequestId())
                    .title(excerpt((source.getTitle() == null ? DEFAULT_TITLE : source.getTitle()) + " · 新的尝试", 128))
                    .skillKey(source.getSkillKey()).skillVersion(source.getSkillVersion())
                    .stage(source.getSkillKey() == null ? null : catalog.find(source.getSkillKey()).map(StudioSkill::firstStage).orElse(StudioSkill.ANALYSIS))
                    .planRevision(source.getPlanRevision()).lastOpenedAt(now).createdAt(now).updatedAt(now).build();
            threads.save(branch);
            long seq = 0;
            for (var m : messages.findByThreadIdAndSeqLessThanEqualOrderBySeqAsc(threadId, from.getSeq())) {
                if (IpDialogueMessage.QUEUED.equals(m.getStatus())) continue;
                ArrayNode blocks = store.blocks(m);
                for (JsonNode b : blocks) if (b instanceof ObjectNode o && "approval".equals(b.path("type").asText())) {
                    o.put("status", "superseded");
                    o.remove(List.of("executionId", "approvedMessageId", "approvedByMessageId", "approvedBudgetCap", "approvedAutoFixCap", "approvedAt", "approvedPlanRevision"));
                }
                String status = IpDialogueMessage.STREAMING.equals(m.getStatus()) ? IpDialogueMessage.INTERRUPTED : m.getStatus();
                messages.save(IpDialogueMessage.builder().id("IDM-" + StudioDialogueStore.uuid20()).threadId(id).seq(++seq).role(m.getRole())
                        .text(m.getText()).blocksJson(blocks.toString()).pinnedNodeIdsJson(m.getPinnedNodeIdsJson())
                        .attachmentNodeIdsJson(m.getAttachmentNodeIdsJson()).billingJson(m.getBillingJson()).status(status)
                        .legacyNodeId(m.getLegacyNodeId()).createdAt(m.getCreatedAt()).updatedAt(now).build());
            }
            branch.setMessageSeq(seq);
            threads.save(branch);
            return id;
        });
        return snapshot(userId, branchId);
    }

    // ── Approval cards (validated for the plan executor) ────────────────────────────────────────────────────────

    @Override
    public Card requireApproval(String userId, String projectId, String messageId, String approvalId) {
        var message = messages.findById(messageId == null ? "" : messageId).orElseThrow(StudioDialogueService::cardNotFound);
        IpDialogueThread thread = lockOwnedThread(userId, projectId, message.getThreadId());
        // D09: a message that does not hold the card (a user message, a forged id) is "no such card", not a bad request.
        if (!"assistant".equals(message.getRole())) throw cardNotFound();
        ObjectNode block = StudioDialogueStore.findBlock(store.blocks(message), "approval", "approvalId", approvalId == null ? "" : approvalId);
        if (block == null) throw cardNotFound();
        return validated(thread, message, block, null, null);
    }

    @Override
    public Card requireApprovalByMessage(String userId, String projectId, String userMessageId, String approvalId) {
        var approving = messages.findById(userMessageId == null ? "" : userMessageId)
                .orElseThrow(() -> BusinessException.notFound("STUDIO_MESSAGE_NOT_FOUND", "找不到这条确认消息"));
        IpDialogueThread thread = lockOwnedThread(userId, projectId, approving.getThreadId());
        if (!"user".equals(approving.getRole())) throw BusinessException.notFound("STUDIO_MESSAGE_NOT_FOUND", "确认需要是你自己发的消息");
        Instant now = Instant.now();
        StudioDialogueStore.CardRef target = null;
        int open = 0;
        for (var card : store.recentCards(thread.getId())) {
            if (StudioDialogueStore.openCard(card.block(), now)) open++;
            if (target == null && card.block().path("approvalId").asText().equals(approvalId)) target = card;
        }
        if (target == null) throw cardNotFound();
        if (target.message().getSeq() >= approving.getSeq())
            throw StudioDialogueService.stale("这条消息发在确认卡出现之前，不能当作对这张卡的确认");
        if (open > 1) throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_APPROVAL_AMBIGUOUS", "现在有不止一张待确认的方案，请说明确认的是哪一张，或直接点卡片上的按钮");
        return validated(thread, target.message(), target.block(), approving.getId(), approving.getText());
    }

    /** Pending, unexpired, and for the thread's newest plan revision (D01) — under the thread lock the caller now holds. */
    private Card validated(IpDialogueThread thread, IpDialogueMessage message, ObjectNode block, String approvingMessageId, String approvingText) {
        String status = block.path("status").asText("pending");
        if ("approved".equals(status)) throw stale("这张确认卡已经确认过了；要调整预算，请在对话里说明新的上限");
        if (!StudioDialogueStore.openCard(block, Instant.now())) throw stale("这张确认卡已过期或被新方案替代，请按最新方案重新确认");
        var current = store.currentPlan(thread.getId()).orElse(null);
        String fingerprint = block.path("planFingerprint").asText();
        if (current == null || !fingerprint.equals(current.fingerprint()))
            throw stale("方案已经更新到新的一版，这张确认卡对应的是旧方案，请看最新的方案后再确认");
        return new Card(block.deepCopy(), thread.getId(), message.getId(), approvingMessageId, approvingText, current.planRunId(), current.revision(),
                current.fingerprint(), current.revision());
    }

    @Override
    public void markApproved(String userId, String projectId, Card card, Approved approved) {
        IpDialogueThread thread = lockOwnedThread(userId, projectId, card.threadId());
        var message = store.message(card.cardMessageId());
        ArrayNode blocks = store.blocks(message);
        ObjectNode block = StudioDialogueStore.findBlock(blocks, "approval", "approvalId", card.block().path("approvalId").asText());
        if (block == null) return;
        // D10: the immutable authorization snapshot — what the user approved, not what the card proposed.
        block.put("status", "approved").put("executionId", approved.executionId())
                .put("approvedBudgetCap", approved.budgetCap()).put("approvedAutoFixCap", approved.autoFixCap())
                .put("approvedPlanRevision", approved.planRevision()).put("approvedAt", approved.at().toString());
        if (approved.approvedByMessageId() != null) block.put("approvedByMessageId", approved.approvedByMessageId());
        store.saveBlocks(message, blocks);
        thread.setActiveExecutionId(approved.executionId());
        if (approved.stage() != null) thread.setStage(approved.stage());
        // Inside a running turn (natural-language approval) the update belongs to that turn; otherwise a synthetic turn
        // that closes itself, so the timeline never thinks a reply is still running.
        String turnId = thread.getActiveTurnId() != null ? thread.getActiveTurnId() : "APR-" + StudioDialogueStore.uuid20();
        var data = mapper.createObjectNode().put("messageId", message.getId());
        data.set("block", block.deepCopy());
        List<StudioDialogueStore.Pending> pending = new ArrayList<>();
        pending.add(new StudioDialogueStore.Pending(turnId, null, approved.executionId(), StudioDialogueEventTypes.APPROVAL_REQUIRED, data));
        if (thread.getActiveTurnId() == null)
            pending.add(new StudioDialogueStore.Pending(turnId, null, approved.executionId(), StudioDialogueEventTypes.TURN_DONE,
                    mapper.valueToTree(new TurnDoneData("completed", message.getId(), null, false, null))));
        var written = store.appendLocked(thread, pending);
        afterCommit(() -> store.broadcast(written));
    }

    /** Owner + project check with the thread row lock when a transaction is active (the confirmation's), else a read. */
    private IpDialogueThread lockOwnedThread(String userId, String projectId, String threadId) {
        var found = TransactionSynchronizationManager.isActualTransactionActive() ? threads.lockById(threadId == null ? "" : threadId) : threads.findById(threadId == null ? "" : threadId);
        return found.filter(t -> userId.equals(t.getOwnerUserId()) && projectId.equals(t.getProjectId())).orElseThrow(StudioDialogueService::cardNotFound);
    }

    private static BusinessException cardNotFound() {
        return BusinessException.notFound("STUDIO_APPROVAL_NOT_FOUND", "找不到这张确认卡，请刷新对话后再确认");
    }
    private static BusinessException stale(String message) { return new BusinessException(HttpStatus.CONFLICT, "STUDIO_PLAN_STALE", message); }

    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() {
                    try { action.run(); } catch (RuntimeException e) { log.warn("[dialogue] after-commit publish failed: {}", e.toString()); }
                }
            });
        else action.run();
    }

    private void wakeAfterCommit(String executionId) {
        afterCommit(() -> { if (executionControl != null) executionControl.wake(executionId); });
    }

    // ── Execution steering (D03) and execution-authored messages (D07) ─────────────────────────────────────────

    @Override
    public long dialogueReserve(String userId) {
        if (fixtures.enabled() || tokenPricing == null) return 0;
        try {
            AiModelEndpoint endpoint = scenePolicies != null
                    ? scenePolicies.resolve("studio", "script", null, pricing.ipIdentity()).resolved().endpoint()
                    : models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA, null, "studio").map(AiModelInvocationService.ResolvedEndpoint::endpoint).orElse(null);
            var rate = endpoint == null ? null : tokenPricing.find(endpoint.getId());
            return rate == null ? 0 : rate.maxCost();
        } catch (RuntimeException e) {
            log.info("[dialogue] dialogue reserve unknown: {}", e.toString());
            return 0;
        }
    }

    @Override
    public List<Note> notes(String threadId, String executionId) {
        if (threadId == null || executionId == null) return List.of();
        List<Note> out = new ArrayList<>();
        for (var row : steering.findByThreadIdAndExecutionIdOrderByCreatedAtAscIdAsc(threadId, executionId)) {
            String text = messages.findById(row.getMessageId()).map(IpDialogueMessage::getText).orElse("");
            out.add(new Note(row.getId(), row.getMessageId(), text, row.getStatus(), row.getCreatedAt()));
        }
        return out;
    }

    @Override
    public void openTurn(String threadId) { afterTurn(threadId); }

    @Override
    public String postExecutionMessage(String threadId, String executionId, String key, String text, List<ObjectNode> blocks, List<String> suggestions) {
        if (key == null || key.isBlank() || key.length() > 64) throw new IllegalArgumentException("message key must be 1..64 chars");
        String[] id = new String[1];
        store.write(threadId, t -> {
            var prior = messages.findByThreadIdAndClientMessageId(threadId, key).orElse(null);
            if (prior != null) { id[0] = prior.getId(); return List.of(); }
            String turnId = "EXS-" + StudioDialogueStore.uuid20(), messageId = "IDM-" + StudioDialogueStore.uuid20();
            List<StudioDialogueStore.Pending> out = new ArrayList<>();
            List<ObjectNode> list = blocks == null ? List.of() : blocks;
            boolean replaces = list.stream().anyMatch(b -> "plan".equals(b.path("type").asText())
                    || "approval".equals(b.path("type").asText()) && "pending".equals(b.path("status").asText()));
            if (replaces) out.addAll(store.supersedePendingApprovals(t, null, turnId, null, executionId));
            ArrayNode saved = mapper.createArrayNode();
            for (ObjectNode block : list) {
                ObjectNode copy = block.deepCopy();
                if ("plan".equals(copy.path("type").asText())) {
                    int revision = t.getPlanRevision() + 1;
                    t.setPlanRevision(revision);
                    copy.put("revision", revision);
                    if (copy.path("plan") instanceof ObjectNode plan) plan.put("revision", revision);
                }
                saved.add(copy);
            }
            Instant now = Instant.now();
            messages.save(IpDialogueMessage.builder().id(messageId).threadId(threadId).seq(StudioDialogueStore.nextMessageSeq(t)).turnId(turnId)
                    .role("assistant").text(text == null ? "" : text).blocksJson(saved.toString()).clientMessageId(key)
                    .requestJson(suggestions == null || suggestions.isEmpty() ? null : mapper.createObjectNode().set("suggestions", mapper.valueToTree(suggestions)).toString())
                    .status(IpDialogueMessage.DONE).createdAt(now).updatedAt(now).build());
            if (text != null && !text.isEmpty())
                out.add(new StudioDialogueStore.Pending(turnId, null, executionId, StudioDialogueEventTypes.MESSAGE_DELTA,
                        mapper.valueToTree(new MessageDeltaData(messageId, "p1", text))));
            for (JsonNode block : saved) {
                String type = block.path("type").asText();
                if ("plan".equals(type)) out.add(new StudioDialogueStore.Pending(turnId, null, executionId, StudioDialogueEventTypes.PLAN_PROPOSED,
                        mapper.valueToTree(new PlanProposedData(messageId, block))));
                else if ("approval".equals(type)) out.add(new StudioDialogueStore.Pending(turnId, null, executionId, StudioDialogueEventTypes.APPROVAL_REQUIRED,
                        mapper.valueToTree(new ApprovalRequiredData(messageId, block, block.hasNonNull("shortfall") ? block.path("shortfall").asLong() : null))));
            }
            out.add(new StudioDialogueStore.Pending(turnId, null, executionId, StudioDialogueEventTypes.TURN_DONE,
                    mapper.valueToTree(new TurnDoneData("completed", messageId, null, false, suggestions == null || suggestions.isEmpty() ? null : suggestions))));
            id[0] = messageId;
            return out;
        });
        return id[0];
    }

    // ── Reconcile / legacy import ───────────────────────────────────────────────────────────────────────────────

    /**
     * Repair a thread whose active turn is gone: a stale running parent run is finished failed (hold released);
     * a run already terminal (e.g. reaped) gets its message closed and turn.done published so the pointer clears.
     */
    public void reconcile(String threadId) {
        IpDialogueThread thread = threads.findById(threadId).orElse(null);
        if (thread == null || thread.getActiveRunId() == null) return;
        String runId = thread.getActiveRunId();
        IpRun run = runs.findById(runId).orElse(null);
        if (run != null && IpRun.STATUS_RUNNING.equals(run.getStatus())) { worker.expireIfStale(runId); run = runs.findById(runId).orElse(null); }
        if (run != null && IpRun.STATUS_RUNNING.equals(run.getStatus())) return;
        final IpRun terminal = run;
        store.write(threadId, t -> {
            if (!runId.equals(t.getActiveRunId())) return List.of();
            String turnId = t.getActiveTurnId();
            t.setActiveRunId(null); t.setActiveTurnId(null);
            String assistantId = terminal == null ? null : parse(terminal.getInputJson()).path("_exec").path("assistantMessageId").asText(null);
            var message = assistantId == null ? null : messages.findById(assistantId).orElse(null);
            if (message != null && IpDialogueMessage.STREAMING.equals(message.getStatus())) {
                message.setStatus(IpRun.STATUS_DONE.equals(terminal.getStatus()) ? IpDialogueMessage.DONE : IpDialogueMessage.FAILED);
                message.setSettling(false); message.setUpdatedAt(Instant.now()); messages.save(message);
            }
            String reason = terminal != null && IpRun.STATUS_DONE.equals(terminal.getStatus()) ? "completed" : "failed";
            var data = mapper.valueToTree(new TurnDoneData(reason, assistantId, null, false, null));
            return List.of(new StudioDialogueStore.Pending(turnId, runId, t.getActiveExecutionId(), StudioDialogueEventTypes.TURN_DONE, data));
        });
    }

    static String mainId(String projectId) { return "IPT-" + projectId; }

    /** Create the main thread once, then import legacy conversation records not imported yet (history only). */
    void ensureMainThread(String userId, IpProject project) {
        String id = mainId(project.getId());
        var existing = threads.findById(id).orElse(null);
        if (existing != null && pendingLegacy(project, id).isEmpty()) return;
        tx.executeWithoutResult(s -> {
            IpProject locked = projects.requiredForUpdate(userId, project.getId());
            IpDialogueThread thread = threads.findById(id).isPresent() ? threads.lockById(id).orElseThrow() : null;
            Instant now = Instant.now();
            if (thread == null) {
                thread = IpDialogueThread.builder().id(id).projectId(project.getId()).ownerUserId(userId).title(DEFAULT_TITLE)
                        .lastOpenedAt(now).createdAt(now).updatedAt(now).build();
                threads.save(thread);
            }
            importLegacy(thread, locked);
            threads.save(thread);
        });
    }

    private List<JsonNode> pendingLegacy(IpProject project, String threadId) {
        JsonNode doc = projects.readDoc(project);
        Set<String> imported = new HashSet<>(messages.importedLegacyNodeIds(threadId));
        Map<String, JsonNode> records = new LinkedHashMap<>();
        for (JsonNode n : doc.path("assistantConversations")) if (n.path("metadata").path("studio").has("conversation")) records.putIfAbsent(n.path("id").asText(), n);
        for (JsonNode n : IpDocs.nodes(doc)) if (n.path("metadata").path("studio").has("conversation")) records.putIfAbsent(n.path("id").asText(), n);
        List<JsonNode> out = new ArrayList<>();
        records.forEach((id, n) -> { if (!id.isBlank() && !imported.contains(id) && hasHistory(n)) out.add(n); });
        return out;
    }

    /**
     * A record with no turns and no plan is not history. The home page saves its brief as exactly such a record; imported, it
     * became a 「之前的对话「创作想法」」 message, the thread was no longer empty, and the brief was never sent as the first
     * message (Codex real-environment retest 2026-10-19).
     */
    static boolean hasHistory(JsonNode record) {
        JsonNode conversation = record.path("metadata").path("studio").path("conversation");
        return conversation.path("turns").size() > 0 || conversation.path("plan").isObject();
    }

    /** Legacy turns become messages with legacyNodeId; their plan is attached as a plan block. Nothing runs or bills. */
    private void importLegacy(IpDialogueThread thread, IpProject project) {
        for (JsonNode record : pendingLegacy(project, thread.getId())) {
            String legacyId = record.path("id").asText();
            JsonNode conversation = record.path("metadata").path("studio").path("conversation");
            Instant now = Instant.now();
            messages.save(IpDialogueMessage.builder().id("IDM-" + StudioDialogueStore.uuid20()).threadId(thread.getId())
                    .seq(StudioDialogueStore.nextMessageSeq(thread)).role("system")
                    .text("之前的对话「" + excerpt(record.path("title").asText("对话"), 60) + "」").blocksJson("[]")
                    .status(IpDialogueMessage.DONE).legacyNodeId(legacyId).createdAt(now).updatedAt(now).build());
            IpDialogueMessage lastAssistant = null;
            for (JsonNode turn : conversation.path("turns")) {
                String role = "assistant".equals(turn.path("role").asText()) ? "assistant" : "user";
                var m = IpDialogueMessage.builder().id("IDM-" + StudioDialogueStore.uuid20()).threadId(thread.getId())
                        .seq(StudioDialogueStore.nextMessageSeq(thread)).role(role).text(turn.path("content").asText(""))
                        .blocksJson("[]").billingJson(turn.hasNonNull("billing") ? turn.path("billing").toString() : null)
                        .status(IpDialogueMessage.DONE).legacyNodeId(legacyId).createdAt(now).updatedAt(now).build();
                messages.save(m);
                if ("assistant".equals(role)) lastAssistant = m;
            }
            JsonNode plan = conversation.path("plan");
            if (plan.isObject() && lastAssistant != null) {
                ObjectNode block = mapper.createObjectNode().put("type", "plan")
                        .put("planRunId", record.path("metadata").path("studio").path("runId").asText(""))
                        .put("revision", 0).put("fingerprint", StudioPlanValidator.fingerprint(plan));
                block.set("plan", plan.deepCopy());
                ArrayNode blocks = mapper.createArrayNode();
                blocks.add(block);
                lastAssistant.setBlocksJson(blocks.toString());
                messages.save(lastAssistant);
            }
        }
    }

    // ── DTO / helpers ───────────────────────────────────────────────────────────────────────────────────────────

    DialogueThread toDto(IpDialogueThread t) {
        return new DialogueThread(t.getId(), t.getProjectId(), t.getParentThreadId(), t.getBranchFromMessageId(), t.getTitle(), t.getLastSeq(),
                t.getActiveTurnId(), t.getActiveExecutionId(), iso(t.getCreatedAt()), iso(t.getUpdatedAt()), t.getSkillKey(), t.getSkillVersion());
    }

    Message toDto(IpDialogueMessage m) {
        JsonNode blocks = parse(m.getBlocksJson());
        if (!blocks.isArray()) blocks = mapper.createArrayNode();
        JsonNode billing = m.getBillingJson() == null ? null : parse(m.getBillingJson());
        List<String> pinned = ids(m.getPinnedNodeIdsJson()), attachments = ids(m.getAttachmentNodeIdsJson());
        return new Message(m.getId(), m.getThreadId(), m.getSeq(), m.getTurnId(), m.getRunId(), m.getRole(), m.getText() == null ? "" : m.getText(),
                blocks, pinned.isEmpty() ? null : pinned, attachments.isEmpty() ? null : attachments, m.getClientMessageId(),
                billing == null || billing.isEmpty() ? null : billing, m.isSettling() ? Boolean.TRUE : null, m.getStatus(), iso(m.getCreatedAt()), m.getLegacyNodeId(),
                suggestions(m));
    }

    /** Assistant messages may carry follow-ups in requestJson ({@code {"suggestions":[...]}}); user messages carry settings there. */
    private List<String> suggestions(IpDialogueMessage m) {
        if (!"assistant".equals(m.getRole()) || m.getRequestJson() == null) return null;
        List<String> out = new ArrayList<>();
        parse(m.getRequestJson()).path("suggestions").forEach(v -> { if (v.isTextual()) out.add(v.asText()); });
        return out.isEmpty() ? null : out;
    }

    private void validate(PostMessageRequest r) {
        if (r == null || r.clientMessageId() == null || !CLIENT_ID.matcher(r.clientMessageId()).matches())
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "消息编号无效");
        boolean hasAttachments = r.attachmentNodeIds() != null && !r.attachmentNodeIds().isEmpty();
        if (r.text() == null || r.text().length() > TEXT_MAX || r.text().isBlank() && !hasAttachments)
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "消息不能为空且不超过 " + TEXT_MAX + " 字");
        for (var list : Arrays.asList(r.pinnedNodeIds(), r.attachmentNodeIds())) {
            if (list == null) continue;
            if (list.size() > NODE_REFS_MAX) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "一次最多引用 " + NODE_REFS_MAX + " 个画布对象");
            for (String id : list) if (id == null || id.isBlank() || id.length() > 64) throw BusinessException.badRequest("STUDIO_CONTEXT_NOT_FOUND", "引用的画布内容不存在，请重新选择");
        }
        if (r.maxCost() != null && r.maxCost() < 0) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "费用上限不能为负");
        if (r.billing() != null) com.aistareco.aep.enterprise.service.EnterpriseBillingService.normalize(r.billing());
    }

    private String fingerprint(String threadId, List<IpDialogueMessage> inputs) {
        StringBuilder b = new StringBuilder(threadId);
        for (var m : inputs) b.append('\n').append(m.getId()).append('\n').append(m.getText());
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b.toString().getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }

    private static List<String> distinct(List<String> ids) { return ids == null ? List.of() : List.copyOf(new LinkedHashSet<>(ids)); }
    private static List<String> concat(List<String> a, List<String> b) { List<String> out = new ArrayList<>(a); out.addAll(b); return out; }
    private List<String> ids(String json) {
        JsonNode n = parse(json);
        List<String> out = new ArrayList<>();
        if (n.isArray()) n.forEach(v -> out.add(v.asText()));
        return out;
    }
    private String json(Object value) { try { return mapper.writeValueAsString(value); } catch (Exception e) { throw new IllegalStateException(e); } }
    private JsonNode parse(String json) {
        try { JsonNode n = json == null || json.isBlank() ? null : mapper.readTree(json); return n == null ? mapper.createObjectNode() : n; }
        catch (Exception e) { return mapper.createObjectNode(); }
    }
    private static String iso(Instant t) { return t == null ? null : t.toString(); }
    private static String excerpt(String text, int max) { if (text == null) return ""; return text.length() <= max ? text : text.substring(0, max); }
}
