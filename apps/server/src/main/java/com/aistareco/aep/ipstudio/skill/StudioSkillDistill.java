package com.aistareco.aep.ipstudio.skill;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure normalization of a distill reply ({@code {bodyMd, changeNote}}) into a draft body (S3 §从成功画布整理方法草稿).
 *
 * <p>The prompt already forbids private material; the server does not trust that. It removes anything that looks like a
 * URL, a storage key or media file path, an internal task / message id, and any verbatim sentence from the case's own
 * plan text (summaries, rationales, check reasons — model text derived from the user's material), replacing each with
 * {@link #REMOVED} and counting them. A YAML header the model may have prepended is dropped: the header of a draft is
 * always copied from the base version, so model text can never change operations, limits or checks.
 */
public final class StudioSkillDistill {
    private StudioSkillDistill() {}

    static final String REMOVED = "（已移除）";
    static final int BODY_MAX = 64000, NOTE_MAX = 1000, FRAGMENT_MIN = 16;
    private static final ObjectMapper OM = new ObjectMapper();
    private static final List<Pattern> PRIVATE = List.of(
            Pattern.compile("(?i)\\b(?:https?|ftp)://[^\\s)\\]>\"'，。；、]+"),
            Pattern.compile("(?i)\\bdata:[a-z]+/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+"),
            Pattern.compile("(?i)\\bwww\\.[a-z0-9-]+(?:\\.[a-z0-9-]+)+[^\\s)\\]>\"'，。；、]*"),
            // Storage keys / media paths such as ipstudio_gen/u1/abc.png or /cdn/x/y.mp4
            Pattern.compile("(?i)/?(?:[a-z0-9_.-]+/)+[a-z0-9_.-]+\\.(?:png|jpe?g|webp|gif|bmp|mp4|mov|webm|m4v|mp3|wav|m4a|aac|flac|ogg|json|pdf)\\b"),
            Pattern.compile("(?i)\\b[a-z0-9_-]{2,}\\.(?:png|jpe?g|webp|gif|mp4|mov|webm|mp3|wav|m4a|aac)\\b"),
            // Internal ids: runs, threads, messages, executions, versions, projects (PREFIX-xxxxxxxx)
            Pattern.compile("\\b(?:IPR|IPT|IDM|IDS|PEX|ISV|IPD|IPV|TRN|IPP|IP|SKD)-[A-Za-z0-9_-]{6,}\\b"),
            // Long opaque hex tokens (object hashes, signatures)
            Pattern.compile("\\b[a-f0-9]{24,}\\b"));
    private static final Pattern FRONT_MATTER = Pattern.compile("\\A\\s*---\\s*\\n.*?\\n---\\s*(?:\\n|\\z)", Pattern.DOTALL);
    private static final Pattern SENTENCE = Pattern.compile("[^。！？；!?;\\n]+");

    /**
     * @param distill the run's {@code _exec.skillDistill}: skillKey, baseVersion, baseBody headings, privateFragments
     * @return {@code {skillKey, baseVersion, bodyMd, changeNote, strippedReferences}}
     */
    public static ObjectNode normalize(JsonNode answer, JsonNode distill) {
        if (answer == null || !answer.isObject()) throw badOutput("整理结果不是有效的 JSON，本次未扣积分");
        String body = answer.path("bodyMd").isTextual() ? answer.path("bodyMd").asText() : "";
        String note = answer.path("changeNote").isTextual() ? answer.path("changeNote").asText() : "";
        body = FRONT_MATTER.matcher(body).replaceFirst("").strip();
        if (body.isBlank()) throw badOutput("模型没有给出修改后的方法正文，本次未扣积分");
        List<String> fragments = fragments(distill.path("privateFragments"));
        int[] removed = {0};
        body = strip(body, fragments, removed);
        note = strip(note, fragments, removed).strip();
        if (body.length() > BODY_MAX) throw badOutput("整理出的方法正文过长，本次未扣积分");
        if (note.length() > NOTE_MAX) note = note.substring(0, NOTE_MAX);
        List<String> missing = new ArrayList<>();
        for (JsonNode heading : distill.path("baseHeadings")) if (!body.contains(heading.asText())) missing.add(heading.asText().replaceFirst("^#+\\s*", ""));
        if (!missing.isEmpty()) note = (note.isEmpty() ? "" : note + "\n") + "注意：草稿里没有原有的章节「" + String.join("」「", missing) + "」，发布前请核对。";
        if (removed[0] > 0) note = (note.isEmpty() ? "" : note + "\n") + "服务端移除了 " + removed[0] + " 处疑似私人素材或地址。";
        return OM.createObjectNode().put("skillKey", distill.path("skillKey").asText()).put("baseVersion", distill.path("baseVersion").asInt())
                .put("bodyMd", body).put("changeNote", note).put("strippedReferences", removed[0]);
    }

    static String strip(String text, List<String> fragments, int[] removed) {
        if (text == null || text.isEmpty()) return "";
        String out = text;
        for (String fragment : fragments) {
            int at;
            while ((at = out.indexOf(fragment)) >= 0) { out = out.substring(0, at) + REMOVED + out.substring(at + fragment.length()); removed[0]++; }
        }
        for (Pattern pattern : PRIVATE) {
            Matcher m = pattern.matcher(out);
            StringBuilder b = new StringBuilder();
            while (m.find()) { m.appendReplacement(b, Matcher.quoteReplacement(REMOVED)); removed[0]++; }
            m.appendTail(b);
            out = b.toString();
        }
        return out;
    }

    /** Sentences of at least {@link #FRAGMENT_MIN} characters from the case's own plan text, longest first. */
    static List<String> fragments(JsonNode raw) {
        Set<String> out = new LinkedHashSet<>();
        if (raw != null && raw.isArray()) for (JsonNode item : raw) {
            Matcher m = SENTENCE.matcher(item.asText(""));
            while (m.find()) { String s = m.group().strip(); if (s.length() >= FRAGMENT_MIN) out.add(s); }
        }
        List<String> list = new ArrayList<>(out);
        list.sort(Comparator.comparingInt(String::length).reversed());
        return list;
    }

    /** Level-2 headings of the base body, used to warn when a draft dropped a section. */
    static List<String> headings(String body) {
        List<String> out = new ArrayList<>();
        if (body != null) for (String line : body.split("\n")) if (line.startsWith("## ")) out.add(line.strip());
        return out;
    }

    static BusinessException badOutput(String message) {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", message);
    }
}
