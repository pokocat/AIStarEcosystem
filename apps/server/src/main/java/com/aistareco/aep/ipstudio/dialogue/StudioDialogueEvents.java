package com.aistareco.aep.ipstudio.dialogue;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Contract shared by the dialogue loop (S1) and the plan executor (S2): persist one event on a thread and publish it to
 * live subscribers. Implemented by the dialogue service; the executor only depends on this interface.
 *
 * <p>Rules (docs/ip-studio-conversational-video-recreation-plan.md §对话事件协议): call only after the state the event
 * describes has been durably saved (afterCommit); {@code seq} is monotonic per thread; the event store is a display and
 * recovery projection, never task, orchestration or ledger truth.
 */
public interface StudioDialogueEvents {
    /** @return the assigned per-thread seq. {@code runId} / {@code executionId} may be null. */
    long publish(String threadId, String turnId, String runId, String executionId, String type, JsonNode data);
}
