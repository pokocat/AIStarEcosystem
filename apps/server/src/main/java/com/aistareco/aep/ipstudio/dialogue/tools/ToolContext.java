package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.dialogue.DialogueLoop;
import com.aistareco.aep.ipstudio.dto.StudioDialogueDtos.NodeUpsertData;
import com.aistareco.aep.ipstudio.skill.StudioSkill;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.AiChatTokenPricing;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.BooleanSupplier;

/** Per-turn state shared by the tools of one dialogue turn. Side effects go through {@link Effects} (persist, then publish). */
public final class ToolContext {
    /** Durable side effects owned by the turn worker. Each call persists first and broadcasts after commit. */
    public interface Effects {
        /** Fresh copy of the saved canvas document (the client owns it; the server never writes it). */
        JsonNode readDoc();
        void publishNodeUpserts(List<NodeUpsertData> upserts);
        /** Bind a skill (and the analysis stage) to the thread; snapshot is used for the rest of this turn. */
        void bindSkill(StudioSkill skill);
        /** Persist a plan block with the next thread revision and publish plan.proposed; returns the block. */
        ObjectNode appendPlan(ObjectNode plan, String fingerprint);
        /** Persist a block on this turn's assistant message; publishes {@code eventType} with {@code eventData} when given. */
        void appendBlock(ObjectNode block, String eventType, JsonNode eventData);
        /** Latest plan block on this thread, if any. */
        Optional<ObjectNode> latestPlanBlock();
        /** Record a native child run on the parent run checkpoint so a priority stop can cancel it. */
        void checkpointChild(String runId);
        /** Dispatch gate before any model call billed to this turn (enterprise authorization still valid, run not stopped). */
        void beforeModelCall();
    }

    public final String userId, projectId, threadId, turnId, runId, assistantMessageId, userMessageId;
    public final String executionId;
    public final BillingSelection billing;
    public final boolean mock;
    public final AiModelEndpoint endpoint;
    public final AiChatTokenPricing.Rate rate;
    public final DialogueLoop.TurnBudget budget;
    public final BooleanSupplier stopRequested;
    public final Effects effects;
    public final Set<String> createdNodeIds = new LinkedHashSet<>();
    private StudioSkill skill;
    private String stage;
    private int questions;
    private int sequence;

    public ToolContext(String userId, String projectId, String threadId, String turnId, String runId, String assistantMessageId,
                       String userMessageId, String executionId, BillingSelection billing, boolean mock, AiModelEndpoint endpoint,
                       AiChatTokenPricing.Rate rate, DialogueLoop.TurnBudget budget, StudioSkill skill, String stage,
                       BooleanSupplier stopRequested, Effects effects) {
        this.userId = userId; this.projectId = projectId; this.threadId = threadId; this.turnId = turnId; this.runId = runId;
        this.assistantMessageId = assistantMessageId; this.userMessageId = userMessageId; this.executionId = executionId;
        this.billing = billing; this.mock = mock; this.endpoint = endpoint; this.rate = rate; this.budget = budget;
        this.skill = skill; this.stage = stage; this.stopRequested = stopRequested; this.effects = effects;
    }

    public synchronized StudioSkill skill() { return skill; }
    public synchronized String stage() { return stage; }
    public synchronized void bindSkill(StudioSkill bound, String boundStage) { this.skill = bound; this.stage = boundStage; }
    public synchronized int nextQuestion() { return ++questions; }
    /** Turn-scoped sequence for idempotent child request ids. */
    public synchronized int nextSequence() { return ++sequence; }
    public boolean stopped() { return stopRequested.getAsBoolean(); }
}
