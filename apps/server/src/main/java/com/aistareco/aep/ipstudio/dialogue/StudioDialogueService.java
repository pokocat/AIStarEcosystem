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
public class StudioDialogueService implements StudioDialogueApprovals {
    private static final Logger log = LoggerFactory.getLogger(StudioDialogueService.class);
    static final String DEFAULT_TITLE = "全能创作";
    private static final Pattern CLIENT_ID = Pattern.compile("[A-Za-z0-9_.:-]{1,64}");
    static final int PAGE_DEFAULT = 50, PAGE_MAX = 200, TEXT_MAX = 4000, NODE_REFS_MAX = 64;

    @Autowired(required = false) private com.aistareco.aep.enterprise.service.EnterpriseBillingService enterpriseBilling;
    @Autowired(required = false) private com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies;
    @Autowired(required = false) private AiChatTokenPricing tokenPricing;
    @Autowired(required = false) private StudioExecutionControl executionControl;

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
        IpDialogueThread thread = requireThread(userId, projectId, threadId);
        if (beforeSeq == null) threads.markOpened(thread.getId(), Instant.now()); // opening a thread makes it the current one
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
                t.activeTurnId(), view.id(), t.createdAt(), t.updatedAt());
        return new State(withExecution, state.messages(), state.nextCursor(), state.latestSeq(), execution);
    }

    // ── Post ────────────────────────────────────────────────────────────────────────────────────────────────────

    public PostMessageResult post(String userId, String projectId, String threadId, PostMessageRequest request) {
        validate(request);
        requireThread(userId, projectId, threadId);
        reconcile(threadId); // an abandoned turn must not swallow new input as steering forever
        PostMessageResult result = tx.execute(s -> postLocked(userId, projectId, threadId, request));
        return result;
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
        ObjectNode settings = mapper.createObjectNode();
        if (request.billing() != null) settings.set("billing", mapper.valueToTree(request.billing()));
        if (request.maxCost() != null) settings.put("maxCost", request.maxCost());
        if (request.skillKey() != null) settings.put("skillKey", request.skillKey());
        if (request.expectedPlanRevision() != null) settings.put("expectedPlanRevision", request.expectedPlanRevision());
        if (request.model() != null && !request.model().isBlank()) settings.put("model", request.model().strip());
        IpDialogueMessage message = IpDialogueMessage.builder().id("IDM-" + StudioDialogueStore.uuid20()).threadId(threadId)
                .seq(StudioDialogueStore.nextMessageSeq(thread)).role("user").text(request.text()).blocksJson("[]")
                .pinnedNodeIdsJson(json(pinned)).attachmentNodeIdsJson(json(attachments)).clientMessageId(request.clientMessageId())
                .requestJson(settings.toString()).status(busy ? IpDialogueMessage.QUEUED : IpDialogueMessage.DONE).createdAt(now).updatedAt(now).build();
        messages.save(message);
        thread.setLastOpenedAt(now);
        if (busy) {
            steering.save(IpDialogueSteering.builder().id("IDS-" + StudioDialogueStore.uuid20()).threadId(threadId).messageId(message.getId())
                    .turnId(thread.getActiveTurnId()).executionId(thread.getActiveExecutionId()).status(IpDialogueSteering.QUEUED).createdAt(now).build());
            message.setTurnId(thread.getActiveTurnId()); message.setRunId(thread.getActiveRunId());
            messages.save(message);
            thread.setUpdatedAt(now);
            threads.save(thread);
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
        StudioSkill skill = null;
        if (skillKey != null && !skillKey.isBlank()) {
            skill = catalog.requireForNewWork(skillKey);
            if (thread.getSkillKey() != null && !thread.getSkillKey().equals(skill.key()))
                throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "这条对话已经在按另一种方法制作；要换方法，请从某条消息重新开始");
        } else if (thread.getSkillKey() != null) {
            skill = catalog.find(thread.getSkillKey()).filter(s -> !s.withdrawn()).orElse(null);
        }
        var bound = execution(userId, thread.getProjectId(), thread).orElse(null);
        String stage = bound != null && bound.stage() != null ? bound.stage()
                : thread.getStage() != null ? thread.getStage() : skill == null ? null : StudioSkill.ANALYSIS;
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
                endpoint = models.resolveEndpoint(AiModelPurpose.DAP_PERSONA, model, "studio")
                        .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, chosen ? "ENDPOINT_NOT_ALLOWED" : "AI_NOT_CONFIGURED",
                                chosen ? "所选文本模型不可用" : "还没有配置可用的对话模型，请联系管理员")).endpoint();
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
        if (skill != null && thread.getSkillKey() == null) { thread.setSkillKey(skill.key()); thread.setSkillVersion(skill.version()); }
        if (stage != null && thread.getStage() == null) thread.setStage(stage);
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
            if (executionId != null && executionControl != null) executionControl.stop(userId, projectId, executionId, request.controlId());
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
                    .skillKey(source.getSkillKey()).skillVersion(source.getSkillVersion()).stage(source.getSkillKey() == null ? null : StudioSkill.ANALYSIS)
                    .planRevision(source.getPlanRevision()).lastOpenedAt(now).createdAt(now).updatedAt(now).build();
            threads.save(branch);
            long seq = 0;
            for (var m : messages.findByThreadIdAndSeqLessThanEqualOrderBySeqAsc(threadId, from.getSeq())) {
                if (IpDialogueMessage.QUEUED.equals(m.getStatus())) continue;
                ArrayNode blocks = store.blocks(m);
                for (JsonNode b : blocks) if (b instanceof ObjectNode o && "approval".equals(b.path("type").asText())) {
                    o.put("status", "superseded"); o.remove("executionId"); o.remove("approvedMessageId");
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
    public JsonNode requireApproval(String userId, String projectId, String messageId, String approvalId) {
        var message = messages.findById(messageId == null ? "" : messageId)
                .orElseThrow(() -> BusinessException.badRequest("STUDIO_APPROVAL_NOT_FOUND", "找不到这张确认卡，请刷新对话后再确认"));
        IpDialogueThread thread = threads.findById(message.getThreadId())
                .filter(t -> userId.equals(t.getOwnerUserId()) && projectId.equals(t.getProjectId()))
                .orElseThrow(() -> BusinessException.badRequest("STUDIO_APPROVAL_NOT_FOUND", "找不到这张确认卡，请刷新对话后再确认"));
        if (!"assistant".equals(message.getRole()))
            throw BusinessException.badRequest("STUDIO_APPROVAL_NOT_FOUND", "确认需要来自对话里的确认卡");
        ObjectNode block = StudioDialogueStore.findBlock(store.blocks(message), "approval", "approvalId", approvalId == null ? "" : approvalId);
        if (block == null) throw BusinessException.badRequest("STUDIO_APPROVAL_NOT_FOUND", "这条消息里没有这张确认卡");
        String status = block.path("status").asText();
        String expires = block.path("expiresAt").asText(null);
        if ("superseded".equals(status) || "expired".equals(status)
                || "pending".equals(status) && expires != null && Instant.parse(expires).isBefore(Instant.now()))
            throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_PLAN_STALE", "这张确认卡已过期，请按最新方案重新确认");
        ObjectNode out = block.deepCopy();
        out.put("threadId", thread.getId()).put("messageId", message.getId());
        return out;
    }

    @Override
    public void markApproved(String userId, String projectId, String messageId, String approvalId, String executionId, String stage) {
        JsonNode card = requireApproval(userId, projectId, messageId, approvalId);
        String threadId = card.path("threadId").asText();
        store.write(threadId, t -> {
            var message = store.message(messageId);
            ArrayNode blocks = store.blocks(message);
            ObjectNode block = StudioDialogueStore.findBlock(blocks, "approval", "approvalId", approvalId);
            if (block == null) return List.of();
            block.put("status", "approved");
            if (executionId != null) block.put("executionId", executionId);
            store.saveBlocks(message, blocks);
            if (executionId != null) { t.setActiveExecutionId(executionId); if (stage != null) t.setStage(stage); }
            return List.of();
        });
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
        records.forEach((id, n) -> { if (!id.isBlank() && !imported.contains(id)) out.add(n); });
        return out;
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
                t.getActiveTurnId(), t.getActiveExecutionId(), iso(t.getCreatedAt()), iso(t.getUpdatedAt()));
    }

    Message toDto(IpDialogueMessage m) {
        JsonNode blocks = parse(m.getBlocksJson());
        if (!blocks.isArray()) blocks = mapper.createArrayNode();
        JsonNode billing = m.getBillingJson() == null ? null : parse(m.getBillingJson());
        List<String> pinned = ids(m.getPinnedNodeIdsJson()), attachments = ids(m.getAttachmentNodeIdsJson());
        return new Message(m.getId(), m.getThreadId(), m.getSeq(), m.getTurnId(), m.getRunId(), m.getRole(), m.getText() == null ? "" : m.getText(),
                blocks, pinned.isEmpty() ? null : pinned, attachments.isEmpty() ? null : attachments, m.getClientMessageId(),
                billing == null || billing.isEmpty() ? null : billing, m.isSettling() ? Boolean.TRUE : null, m.getStatus(), iso(m.getCreatedAt()), m.getLegacyNodeId());
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
