package com.aistareco.aep.ipstudio.skill;

import java.util.*;

/**
 * Picks a skill for a dialogue turn (S3 intent routing, 2026-10-20 「意图直达」 revision). Pure function of the active skills,
 * the media types of the nodes the user pinned or attached, the message text and the skill the thread was last bound to;
 * the caller persists the choice on the thread. Triggers are hints only: the chosen skill's header still bounds every
 * operation.
 *
 * <ol>
 *   <li>no active skill → none (the dialogue answers without a method, as before S3);</li>
 *   <li>score = 2 × matching keywords (case-insensitive substring) + 1 × matching media types. Words outrank media:
 *       with a product image attached, 「写一段文案」 is a writing job, not an image job — the attachment is material,
 *       the words say what to make of it (the first S3 weights were the other way round and 「文案」 lost to the image);</li>
 *   <li>a unique best score above zero wins;</li>
 *   <li>no hit at all → the skill the thread was already bound to (continuity: 「再来一张」 after an image job stays an image
 *       job), else none: 「全能创作」 answers by the general rules and the model may bind a skill itself with read_skill.
 *       A skill is a method for one kind of job, and binding it to a message that never asked for that job is wrong even
 *       when it is the only skill on the shelf (local e2e 2026-10-19: 「做一张宣传图」 used to bind 参考视频复刻);</li>
 *   <li>a tie among the best → the bound skill when it is one of them (a tie never bumps the current job), otherwise none:
 *       the model decides inside the turn (it reads the message and the skill summaries and
 *       calls read_skill), which beats both a static default and a 400 that made the UI ask the user which method to use.
 *       {@code triggers.default} stays a hint the model is shown, never a tie-break here.</li>
 * </ol>
 */
public final class StudioSkillRouter {
    private StudioSkillRouter() {}

    public static Optional<StudioSkill> route(List<StudioSkill> active, Set<String> media, String text) {
        return route(active, media, text, null);
    }

    /**
     * @param bound the skill the thread is currently bound to (any status) or null; returned only when nothing else hits
     *              and it is still active, so a withdrawn method never carries over.
     */
    public static Optional<StudioSkill> route(List<StudioSkill> active, Set<String> media, String text, StudioSkill bound) {
        if (active == null || active.isEmpty()) return Optional.empty();
        String haystack = text == null ? "" : text.toLowerCase(Locale.ROOT);
        Set<String> types = media == null ? Set.of() : media;
        int best = 0;
        List<StudioSkill> leaders = new ArrayList<>();
        for (StudioSkill skill : active) {
            int score = score(skill.triggers(), types, haystack);
            if (score > best) { best = score; leaders.clear(); leaders.add(skill); }
            else if (score == best && score > 0) leaders.add(skill);
        }
        boolean boundOffered = bound != null && bound.active() && active.stream().anyMatch(s -> s.key().equals(bound.key()));
        if (best == 0) return boundOffered ? Optional.of(bound) : Optional.empty();
        if (leaders.size() == 1) return Optional.of(leaders.get(0));
        // A tie that includes the current job never bumps it; any other tie is the model's call.
        if (boundOffered && leaders.stream().anyMatch(s -> s.key().equals(bound.key()))) return Optional.of(bound);
        return Optional.empty();
    }

    static int score(StudioSkill.Triggers triggers, Set<String> media, String lowerText) {
        int score = 0;
        for (String keyword : triggers.keywords()) if (!keyword.isBlank() && lowerText.contains(keyword.toLowerCase(Locale.ROOT))) score += 2;
        for (String type : triggers.media()) if (media.contains(type)) score += 1;
        return score;
    }

    /** Canvas node type → trigger media type; unknown types (config, group…) do not count. */
    public static String mediaOf(String nodeType) {
        if (nodeType == null) return null;
        String t = nodeType.toLowerCase(Locale.ROOT);
        if (t.contains("video")) return "video";
        if (t.contains("image")) return "image";
        if (t.contains("audio") || t.contains("voice") || t.contains("music")) return "audio";
        if (t.contains("text") || t.contains("script")) return "text";
        return null;
    }
}
