package com.aistareco.aep.ipstudio.execution;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Optional;

/**
 * Where a confirmable plan lives when it is not a native planning run's {@code output.plan}: e.g. a plan block the dialogue
 * loop stored on an assistant message (planRunId = the parent dialogue run). Implemented by the dialogue side; the
 * execution service still re-checks owner, project, stage whitelist and fingerprint on whatever a source returns.
 */
public interface StudioPlanSource {
    /** The plan for this owner/project/run whose server fingerprint equals {@code fingerprint}; empty when unknown here. */
    Optional<PlanRecord> find(String userId,String projectId,String planRunId,String fingerprint);

    /**
     * Canvas objects the assistant created in this conversation (its finished create_nodes calls), the only objects a step
     * is bound to without the planner naming them (§6.1). Null when this source does not know the conversation.
     */
    default java.util.Set<String> assistantNodeIds(String threadId) {return null;}

    /**
     * Canvas objects the user picked or attached in this conversation's recent messages, newest first (repeats removed):
     * materials named in an earlier message than the one the plan answered (docs/ip-studio-dialogue-intents.md
     * 「方案素材范围跨轮」). Empty when this source does not know the conversation.
     */
    default List<String> conversationPicks(String threadId) {return List.of();}

    /**
     * @param plan           normalized plan with skillKey / skillVersion / stage / server quotes (as fingerprinted)
     * @param skillSnapshot  the skill snapshot the plan was validated against ({@link StudioSkillRules#snapshot} shape)
     * @param contextNodeIds canvas node ids the plan turn's own messages picked or attached (the material scope is built from
     *                       them by {@code StudioPlanMaterials})
     * @param revision       plan revision shown to the user (expectedRevision is checked against it)
     */
    record PlanRecord(String planRunId,JsonNode plan,JsonNode skillSnapshot,List<String> contextNodeIds,int revision,
                      String threadId,String messageId) {}
}
