package com.aistareco.aep.ipstudio.dialogue;

import java.util.Optional;

/**
 * Priority controls forwarded from the dialogue to a bound plan execution (implemented by the S2 plan executor).
 * Injected as optional: when no implementation exists the dialogue skips forwarding and says so.
 *
 * <p>Semantics (docs/ip-studio-conversational-video-recreation-plan.md §服务端推进与恢复): {@code stop} immediately blocks
 * new submissions and cancels cancellable queued tasks (already-submitted vendor jobs keep being polled and settled);
 * {@code pause} blocks new submissions but keeps refreshing existing runs; {@code resume} re-checks the stage
 * authorization and wakes the shared advance entry. All three must be idempotent on {@code controlId}.
 */
public interface StudioExecutionControl {
    /** Minimal view of an active execution bound to a thread; {@code status} is null when only the thread pointer is known. */
    record ExecutionView(String id, String stage, String status) {}

    void stop(String userId, String projectId, String executionId, String controlId);
    void pause(String userId, String projectId, String executionId, String controlId);
    void resume(String userId, String projectId, String executionId, String controlId);
    /** StudioPlanExecution projection for StudioDialogueState.execution, or null when not visible to this user. */
    Object describe(String userId, String projectId, String executionId);

    /**
     * The canvas's active execution when it was created from this thread. Default: unknown, so the dialogue relies on the
     * pointer set through {@link StudioDialogueService#bindExecution}. The executor may override it instead of binding.
     */
    default Optional<ExecutionView> active(String userId, String projectId, String threadId) { return Optional.empty(); }

    /**
     * {@link #active} for several threads of one canvas at once, keyed by thread id (the 「历史对话」 list). Default: one
     * {@link #active} lookup per thread; the executor overrides it with a single query.
     */
    default java.util.Map<String, ExecutionView> activeByThread(String userId, String projectId, java.util.Collection<String> threadIds) {
        java.util.Map<String, ExecutionView> out = new java.util.HashMap<>();
        for (String threadId : threadIds) active(userId, projectId, threadId).ifPresent(v -> out.put(threadId, v));
        return out;
    }

    /** Wake the shared advance entry (e.g. steering arrived, a bound dialogue turn settled). Best-effort; the scan recovers. */
    default void wake(String executionId) { }

    /**
     * One plain-language line about the bound execution for the dialogue prompt (stage, status, why it waits, budget), or
     * null. Facts only from the execution record; the model must not infer progress from anything else.
     */
    default String promptSummary(String userId, String projectId, String executionId) { return null; }
}
