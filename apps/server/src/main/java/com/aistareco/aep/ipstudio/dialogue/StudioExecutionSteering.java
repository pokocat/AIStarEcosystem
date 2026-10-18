package com.aistareco.aep.ipstudio.dialogue;

import java.time.Instant;
import java.util.List;

/**
 * User messages that arrived while a plan execution was running (docs/ip-studio-conversational-video-recreation-plan.md
 * §制作中输入与转向 / §线程转向与兼容契约). The dialogue stores them in {@code ip_dialogue_steering} bound to the execution;
 * the plan executor reads them at its safe boundary (before submitting the next step), stops further submissions and
 * asks the dialogue to open a turn that answers them. Implemented by the dialogue service.
 */
public interface StudioExecutionSteering {
    /** One steering message; {@code status} is the dialogue's queue status (queued | applied | rejected). */
    record Note(String id, String messageId, String text, String status, Instant createdAt) {}

    /** Steering messages bound to this execution, oldest first (rejected ones included so the caller can skip them). */
    List<Note> notes(String threadId, String executionId);

    /** Open the follow-up dialogue turn for queued messages on the thread; no-op while a turn is active or nothing is queued. */
    void openTurn(String threadId);
}
