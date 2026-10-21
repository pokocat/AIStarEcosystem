package com.aistareco.aep.ipstudio.skill;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Picks a skill for a dialogue turn (S3 intent routing; 「意图直达」 2026-10-20; tie and writing rules 2026-10-21). Pure
 * function of the active skills, the media types of the nodes the user pinned or attached, the message text and the skill
 * the thread was last bound to; the caller persists the choice on the thread. Triggers are hints only: the chosen skill's
 * header still bounds every operation. Design source: docs/ip-studio-dialogue-intents.md §4.
 *
 * <ol>
 *   <li>no active skill → none (the dialogue answers without a method, as before S3);</li>
 *   <li><b>writing intent</b> → 写剧本与文案 ({@link #WRITING_SKILL}), whatever is attached: a writing verb whose object ends
 *       in a piece of text (「写三条卖点文案」「做个视频脚本」「润色一下口播」「想几个标题」). The picture next to 「用这张商品图
 *       写三条卖点文案」 is material; the words say what to make of it. Not when the message first asks for another kind of
 *       output (「画一张海报，上面写标题…」 is a poster with a title on it: then the writing skill's keywords do not count
 *       either), and not when the text is part of a picture or a video (「做一张带标题的海报」「做个口播视频」「海报上的标题」);</li>
 *   <li>no keyword of any skill hit → the words name no job, and attachments alone never pick one: the skill the thread
 *       is already bound to stays (「再来一张」 after an image job; 「把做好的片段合成一条成片」 with the clips pinned does
 *       not jump to 复刻 because a video is pinned), else none: 「全能创作」 answers by the general rules and the model may
 *       bind a skill itself with read_skill. A skill is a method for one kind of job, and binding it to a message that
 *       never asked for that job is wrong even when it is the only skill on the shelf (local e2e 2026-10-19: 「做一张宣传图」
 *       used to bind 参考视频复刻);</li>
 *   <li>otherwise score = 2 × matching keywords (case-insensitive substring) + 1 × matching media types: words outrank media,
 *       media adds weight once the words have named something (「照这条做一段视频」 with a video pinned is 复刻);
 *       a unique best score wins;</li>
 *   <li>a tie among the best → {@link Kind#OPEN}: no skill for this message, the thread is unbound and the model picks with
 *       read_skill from the intent table and the skill summaries — even when the current skill is one of the tied (that
 *       used to keep it: 「用这几张图做一段视频」 on a thread that had just made the pictures stayed 出图). Never a 400 that
 *       makes the UI ask which method; {@code triggers.default} stays a hint the model is shown, never a tie-break here.</li>
 * </ol>
 */
public final class StudioSkillRouter {
    private StudioSkillRouter() {}

    /** The method a writing intent goes to (resources/studio/skills/script-writing.md); the rule is off while it is not active. */
    public static final String WRITING_SKILL = "script-writing";

    public enum Kind {
        /** The words name one job (writing intent, or a unique best score): bind {@link Decision#skill()}. */
        MATCH,
        /** Nothing named a job: the thread keeps the skill it has ({@link Decision#skill()} is it when still offered, else null). */
        KEEP,
        /** A tie: no skill for this message, the thread is unbound and the model decides with read_skill. */
        OPEN
    }

    /** @param tied the keys of the tied skills ({@link Kind#OPEN}), for the log and the turn input; empty otherwise. */
    public record Decision(Kind kind, StudioSkill skill, List<String> tied, String reason) {
        static Decision match(StudioSkill skill, String reason) { return new Decision(Kind.MATCH, skill, List.of(), reason); }
        static Decision keep(StudioSkill skill) { return new Decision(Kind.KEEP, skill, List.of(), "no-hit"); }
        static Decision open(List<String> tied) { return new Decision(Kind.OPEN, null, List.copyOf(tied), "tie"); }
    }

    public static Optional<StudioSkill> route(List<StudioSkill> active, Set<String> media, String text) {
        return route(active, media, text, null);
    }

    /** The skill this message is handled with: the match, or the bound skill when nothing named a job; empty for a tie. */
    public static Optional<StudioSkill> route(List<StudioSkill> active, Set<String> media, String text, StudioSkill bound) {
        return Optional.ofNullable(decide(active, media, text, bound).skill());
    }

    /**
     * @param bound the skill the thread is currently bound to (any status) or null; kept only when nothing names a job and
     *              it is still active and offered, so a withdrawn method never carries over.
     */
    public static Decision decide(List<StudioSkill> active, Set<String> media, String text, StudioSkill bound) {
        if (active == null || active.isEmpty()) return Decision.keep(null);
        String haystack = text == null ? "" : text.toLowerCase(Locale.ROOT);
        Set<String> types = media == null ? Set.of() : media;
        boolean boundOffered = bound != null && bound.active() && active.stream().anyMatch(s -> s.key().equals(bound.key()));
        StudioSkill writing = active.stream().filter(s -> s.key().equals(WRITING_SKILL)).findFirst().orElse(null);
        Writing intent = writing == null ? Writing.NONE : writingIntent(haystack);
        if (intent == Writing.FIRST) return Decision.match(writing, "writing");
        boolean anyKeyword = false;
        int best = 0;
        List<StudioSkill> leaders = new ArrayList<>();
        for (StudioSkill skill : active) {
            // 「画一张海报，上面写标题…」: the text belongs to the output asked for first, so its words do not bid for 写稿.
            int words = intent == Writing.AFTER_OTHER && skill == writing ? 0 : keywordScore(skill.triggers(), haystack);
            anyKeyword |= words > 0;
            int score = words + mediaScore(skill.triggers(), types);
            if (score > best) { best = score; leaders.clear(); leaders.add(skill); }
            else if (score == best && score > 0) leaders.add(skill);
        }
        // The words name no job: whatever is pinned is material, not a request. The bound method stays; an unbound thread
        // stays unbound and the model reads the message (a pinned video alone is not 「复刻」, a pinned text alone not 「写稿」).
        if (!anyKeyword) return Decision.keep(boundOffered ? bound : null);
        if (leaders.size() == 1) return Decision.match(leaders.get(0), "keywords");
        return Decision.open(leaders.stream().map(StudioSkill::key).toList());
    }

    private static int keywordScore(StudioSkill.Triggers triggers, String lowerText) {
        int score = 0;
        for (String keyword : triggers.keywords()) if (!keyword.isBlank() && lowerText.contains(keyword.toLowerCase(Locale.ROOT))) score += 2;
        return score;
    }

    private static int mediaScore(StudioSkill.Triggers triggers, Set<String> media) {
        int score = 0;
        for (String type : triggers.media()) if (media.contains(type)) score += 1;
        return score;
    }

    // ── Writing intent ───────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Characters that end a clause: a verb never reaches its object across them. The full-width colon too (「写一集剧本：
     * 视频里的主角…」 must not read 剧本 as part of a video); the ASCII one is left alone for 「9:16」.
     */
    private static final String CLAUSE = "[^，。！？；：,.!?;\\n]";
    /** A piece of text someone writes (口播 covers 口播稿; no bare 稿, which is also 线稿 / 草稿 in a drawing). */
    private static final String TEXT = "(?:文案|卖点|标题|口播|脚本|台词|剧本|简介|广告语|旁白|分镜|小传|人设|标语|话术|大纲|故事|文字|文稿|稿子|讲稿)";
    /** Pictures and videos: a text noun followed by one of these is part of a visual product (标题海报, 口播视频, 分镜图). */
    private static final String VISUAL = "(?:图|海报|封面|插画|头像|视频|短片|片子|动画|宣传片|成片|镜头)";
    /**
     * Writing verbs. 写 but not 写上 / 写在 / 写到 / 写着 (putting text on something) nor 特写 / 描写; 做 / 出 / 来 because
     * 「做个视频脚本」「出几条文案」「来一段口播」 ask for text; 起 only before a count (起几个标题, not 动起来).
     */
    private static final String VERB = "(?:(?<![特描抄速])写(?![上在到着])|改|润色|扩写|缩写|精简|优化|拟|编|做|出|想|来|列|起(?=[个几一两二三四五六七八九十0-9]))";
    /**
     * Verb, then at most 16 characters of the same clause that do not start a picture / video word, then the text noun
     * that heads the object — optionally right after a picture / video word that only qualifies it (视频脚本, 海报文案,
     * 镜头的台词). So 「做一张海报然后写个标题」 does not read 做…标题 as one phrase (the 写 later still counts), and the
     * noun is not 「…上的 / 里的」 a picture, not followed by 的 (标题的海报) or by a picture / video word within two characters
     * (口播视频, 卖点图).
     */
    private static final Pattern WRITING = Pattern.compile(VERB + "(?:(?!" + VISUAL + ")" + CLAUSE + "){0,16}?(?:" + VISUAL + "的?)?(?<!上的)(?<!里的)" + TEXT
            + "(?![的之]|" + CLAUSE + "{0,2}?" + VISUAL + ")");
    /**
     * Asking for another kind of output: making a picture or a video (not 「拍的 / 做好的 / 生成了」, which is material that
     * already exists), making something move, or recreating a reference video. 「画一张海报，上面写标题」 is a poster;
     * 「写个脚本，再做成视频」 is writing first (the script skill hands over to video). 「照这条视频写个口播」 is writing:
     * 照这条 says how, not what.
     */
    private static final Pattern OTHER_OUTPUT = Pattern.compile("(?:(?:画|做|出|生成|来|设计|拍|修|弄|搞|剪|合成)(?![的了过好来完])" + CLAUSE + "{0,4}?" + VISUAL
            + "|p图|动起来|动一下|复刻|拉片|翻拍|仿拍|做同款)");

    enum Writing {
        /** No writing verb with a text object. */
        NONE,
        /** The message asks for a piece of text before anything else: the writing skill wins. */
        FIRST,
        /** It asks for a picture / video / recreation first and the text is part of that: the writing skill's words do not count. */
        AFTER_OTHER
    }

    /** Where a writing intent stands in the (lowercased) message. */
    static Writing writingIntent(String lowerText) {
        if (lowerText == null || lowerText.isBlank()) return Writing.NONE;
        Matcher writing = WRITING.matcher(lowerText);
        if (!writing.find()) return Writing.NONE;
        Matcher other = OTHER_OUTPUT.matcher(lowerText);
        return other.find() && other.start() < writing.start() ? Writing.AFTER_OTHER : Writing.FIRST;
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
