package com.aistareco.aep.ipstudio.dialogue;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;

/**
 * Messages the plan executor posts on its thread without a model call: the completion summary, an approval card for a
 * budget shortfall, or the production plan an analysis compiled. Persisted first (idempotent on {@code key}), then
 * published as message.delta (the whole text once — server text, not model output), the blocks' events and a
 * turn.done that closes the synthetic turn, so an open timeline refreshes and a reload shows the same message.
 */
public interface StudioExecutionMessages {
    /**
     * @param key         idempotency key (≤ 64 chars); a second post with the same key returns the first message id
     * @param blocks      typed blocks ({@code plan} gets the next thread revision; a pending {@code approval} supersedes
     *                    the other pending cards, as a new plan revision does)
     * @param suggestions 2–3 follow-ups shown under the message, or null
     * @return the message id
     */
    String postExecutionMessage(String threadId, String executionId, String key, String text, List<ObjectNode> blocks, List<String> suggestions);
}
