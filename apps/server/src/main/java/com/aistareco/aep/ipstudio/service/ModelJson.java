package com.aistareco.aep.ipstudio.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Reads the JSON object out of a chat model's reply. Many endpoints ignore {@code response_format=json_object} and wrap the
 * object in a markdown fence or a sentence ({@code ```json ... ```}); the content is still the model's own words, so it is
 * unwrapped here and then validated like any other model output.
 *
 * <p>Only local syntax repairs are allowed: stray escapes before Han characters (2026-10-25 Qwen returned
 * {@code \远处}), literal line breaks/tabs inside strings, trailing commas after complete values, and missing final
 * closing brackets. No values, quotes, commas between values, or missing string contents are invented. Callers must
 * reject {@code finish_reason=length} before parsing and validate the resulting business structure afterwards.
 */
public final class ModelJson {
    private static final Logger log = LoggerFactory.getLogger(ModelJson.class);
    private ModelJson() {}

    /** @throws JsonProcessingException when no JSON value can be read from the reply. A blank reply reads as a missing node. */
    public static JsonNode parse(ObjectMapper mapper, String reply) throws JsonProcessingException {
        String text = stripFence(reply);
        try {
            return readSingle(mapper, text);
        } catch (JsonProcessingException direct) {
            String body = unwrapObject(text);
            String repaired = repairSyntax(body);
            try {
                JsonNode result = readSingle(mapper, repaired);
                log.info("[model-json] recovered syntax chars={} unwrapped={} repaired={} closed=false",
                        text.length(), !text.equals(body), !body.equals(repaired));
                return result;
            } catch (JsonProcessingException ignored) { /* only missing final brackets may still be repaired */ }
            String closed = closeBrackets(repaired);
            if (closed != null) {
                try {
                    JsonNode result = readSingle(mapper, closed);
                    log.info("[model-json] recovered syntax chars={} unwrapped={} repaired={} closed=true",
                            text.length(), !text.equals(body), !body.equals(repaired));
                    return result;
                } catch (JsonProcessingException ignored) { /* report the original failure with its source location */ }
            }
            throw direct;
        }
    }

    /** Per-read settings: never relax the shared mapper or silently keep the first of multiple values/duplicate keys. */
    private static JsonNode readSingle(ObjectMapper mapper, String text) throws JsonProcessingException {
        return mapper.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                .with(JsonParser.Feature.STRICT_DUPLICATE_DETECTION).readTree(text);
    }

    /** Unwrap one object surrounded by prose, never a nested object from a broken array or incomplete outer object. */
    private static String unwrapObject(String text) {
        if (text.startsWith("[") || text.startsWith("\"")
                || text.matches("(?s)(?:true|false|null)(?:\\s|[\\[{]).*")
                || text.matches("(?s)-?[0-9].*")) return text;
        int open = text.indexOf('{');
        if (open < 0) return text;
        int array = text.indexOf('[');
        if (array >= 0 && array < open) return text;
        String lead = text.substring(0, open);
        if (lead.indexOf('}') >= 0 || lead.indexOf(']') >= 0) return text;
        int depth = 0;
        boolean inString = false, escaped = false;
        for (int i = open; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (inString) {
                if (escaped) escaped = false;
                else if (ch == '\\') escaped = true;
                else if (ch == '"') inString = false;
            } else if (ch == '"') inString = true;
            else if (ch == '{' || ch == '[') depth++;
            else if ((ch == '}' || ch == ']') && --depth == 0) {
                String tail = text.substring(i + 1).trim();
                // A second JSON document or broken structural suffix must not be discarded as commentary.
                if (tail.chars().anyMatch(c -> "{}[]\",:".indexOf(c) >= 0)
                        || tail.matches("(?s)(?:true|false|null|-?[0-9]).*")) return text;
                return text.substring(open, i + 1);
            }
        }
        return text.substring(open); // still incomplete: closeBrackets decides whether closure is safe
    }

    /** Syntax-only, one pass: preserve valid escapes and refuse unknown ASCII escapes or malformed Unicode escapes. */
    private static String repairSyntax(String text) {
        StringBuilder out = new StringBuilder(text.length());
        boolean inString = false;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (inString) {
                if (ch == '\\' && i + 1 < text.length()) {
                    int next = text.codePointAt(i + 1);
                    if (Character.UnicodeScript.of(next) == Character.UnicodeScript.HAN) continue;
                    out.append(ch).append(text.charAt(++i)); // valid escapes stay byte-for-byte; other escapes still fail
                    continue;
                }
                switch (ch) {
                    case '\n' -> out.append("\\n");
                    case '\r' -> out.append("\\r");
                    case '\t' -> out.append("\\t");
                    default -> { out.append(ch); if (ch == '"') inString = false; }
                }
                continue;
            }
            if (ch == '"') inString = true;
            if (ch == ',') {
                int previous = i - 1, next = i + 1;
                while (previous >= 0 && Character.isWhitespace(text.charAt(previous))) previous--;
                while (next < text.length() && Character.isWhitespace(text.charAt(next))) next++;
                if (previous >= 0 && "[{,:".indexOf(text.charAt(previous)) < 0 && next < text.length()
                        && (text.charAt(next) == ']' || text.charAt(next) == '}')) continue;
            }
            out.append(ch);
        }
        return out.toString();
    }

    /** Appends the closing brackets a reply is missing at its very end, or null when that is not the only problem. */
    static String closeBrackets(String text) {
        StringBuilder stack = new StringBuilder();
        boolean inString = false, escaped = false;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (inString) {
                if (escaped) escaped = false;
                else if (ch == '\\') escaped = true;
                else if (ch == '"') inString = false;
                continue;
            }
            switch (ch) {
                case '"' -> inString = true;
                case '{' -> stack.append('}');
                case '[' -> stack.append(']');
                case '}', ']' -> {
                    if (stack.isEmpty() || stack.charAt(stack.length() - 1) != ch) return null;
                    stack.setLength(stack.length() - 1);
                }
                default -> { }
            }
        }
        String trimmed = text.stripTrailing();
        if (inString || stack.isEmpty() || trimmed.endsWith(",") || trimmed.endsWith(":")) return null;
        return trimmed + stack.reverse();
    }

    /** Drop a leading ``` / ```json line and a trailing ``` line; anything else is returned trimmed and untouched. */
    public static String stripFence(String value) {
        String text = value == null ? "" : value.trim();
        if (text.startsWith("```")) {
            int first = text.indexOf('\n');
            if (first >= 0) text = text.substring(first + 1);
            if (text.endsWith("```")) text = text.substring(0, text.length() - 3);
        }
        return text.trim();
    }
}
