package com.aistareco.aep.ipstudio.skill;

import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;

import java.util.*;

/**
 * Picks a skill for a dialogue thread that has none yet (S3 intent routing). Pure function of the active skills, the
 * media types of the nodes the user pinned or attached, and the message text; the caller persists the choice on the
 * thread. Triggers are hints only: the chosen skill's header still bounds every operation.
 *
 * <ol>
 *   <li>no active skill → none (the dialogue answers without a method, as before S3);</li>
 *   <li>score = 2 × matching media types + matching keywords (case-insensitive substring); a unique best score above zero wins;</li>
 *   <li>no hit at all → none: 「全能创作」 answers by the general rules. A skill is a method for one kind of job, and binding it
 *       to a message that never asked for that job is wrong even when it is the only skill on the shelf: with the recreation
 *       skill alone (and {@code default: true}), 「做一张宣传图」 used to bind 「参考视频复刻」, and the thread kept it
 *       (local e2e 2026-10-19);</li>
 *   <li>a tie among the best → the {@code default: true} skill when it is one of them;</li>
 *   <li>otherwise 400 {@code STUDIO_SKILL_REQUIRED} with the tied skills, so the UI can ask which one.</li>
 * </ol>
 */
public final class StudioSkillRouter {
    private StudioSkillRouter() {}

    public static Optional<StudioSkill> route(List<StudioSkill> active, Set<String> media, String text) {
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
        if (best == 0) return Optional.empty();
        if (leaders.size() == 1) return Optional.of(leaders.get(0));
        List<StudioSkill> defaults = leaders.stream().filter(s -> s.triggers().defaultSkill()).toList();
        if (defaults.size() == 1) return Optional.of(defaults.get(0));
        throw required(leaders);
    }

    static int score(StudioSkill.Triggers triggers, Set<String> media, String lowerText) {
        int score = 0;
        for (String type : triggers.media()) if (media.contains(type)) score += 2;
        for (String keyword : triggers.keywords()) if (!keyword.isBlank() && lowerText.contains(keyword.toLowerCase(Locale.ROOT))) score += 1;
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

    public static BusinessException required(List<StudioSkill> active) {
        List<Map<String, String>> skills = new ArrayList<>();
        for (StudioSkill s : active) skills.add(Map.of("key", s.key(), "name", s.name(), "summary", s.summary() == null ? "" : s.summary()));
        return new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_SKILL_REQUIRED", "有几种制作方法都能做这件事，请先选一种再发送", Map.of("skills", skills));
    }
}
