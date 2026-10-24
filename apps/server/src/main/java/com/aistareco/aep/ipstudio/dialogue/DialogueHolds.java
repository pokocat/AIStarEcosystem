package com.aistareco.aep.ipstudio.dialogue;

import com.aistareco.aep.service.CreditService;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;

/**
 * The holds of one dialogue turn (docs/ip-studio-dialogue-no-continue.md §3): the first one under the run id, then
 * {@code runId#1}, {@code runId#2} … added while the turn works, recorded in {@code _exec.holdRefs}. Each is an ordinary
 * {@link CreditService} hold (one reference, one fixed amount); this class only orders and settles them.
 */
public final class DialogueHolds {
    private DialogueHolds() {}

    public record Ref(String ref, long amount) {}

    /** The run's holds in order; a run from before added holds has only its own, of {@code cost}. */
    public static List<Ref> of(JsonNode input, String runId, long cost) {
        List<Ref> out = new ArrayList<>();
        for (JsonNode r : input.path("_exec").path("holdRefs"))
            if (r.path("ref").isTextual()) out.add(new Ref(r.path("ref").asText(), Math.max(0, r.path("amount").asLong())));
        if (out.isEmpty()) out.add(new Ref(runId, Math.max(0, cost)));
        return out;
    }

    public static long total(List<Ref> refs) { return refs.stream().mapToLong(Ref::amount).sum(); }

    /** The run a hold reference belongs to ({@code runId#n} → {@code runId}). */
    public static String runOf(String reference) {
        int i = reference == null ? -1 : reference.indexOf('#');
        return i < 0 ? reference : reference.substring(0, i);
    }

    /**
     * Commit {@code actual} across the holds in order (the first until it is used up, then the next) and release what is
     * left of each. No hold is committed beyond its own amount; more than all of them together is refused.
     */
    public static void settle(CreditService credits, String referenceType, List<Ref> refs, long actual) {
        if (actual < 0 || actual > total(refs)) throw new IllegalStateException("Dialogue settlement exceeds reservation");
        long left = actual;
        for (Ref r : refs) {
            long commit = Math.min(left, r.amount());
            if (commit > r.amount()) throw new IllegalStateException("Dialogue settlement exceeds a hold");
            if (commit > 0) credits.commitHold(referenceType, r.ref(), commit, "Studio 对话实际结算");
            if (commit < r.amount()) credits.releaseHold(referenceType, r.ref(), "Studio 对话实际用量结算 · 退回余量");
            left -= commit;
        }
    }

    /** Failure, cancellation before any call, or an abandoned turn: every hold goes back. */
    public static void releaseAll(CreditService credits, String referenceType, List<Ref> refs) {
        for (Ref r : refs) credits.releaseHold(referenceType, r.ref(), "Studio 对话失败或取消 · 释放冻结");
    }
}
