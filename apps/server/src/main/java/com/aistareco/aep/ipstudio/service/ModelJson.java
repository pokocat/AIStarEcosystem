package com.aistareco.aep.ipstudio.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Reads the JSON object out of a chat model's reply. Many endpoints ignore {@code response_format=json_object} and wrap the
 * object in a markdown fence or a sentence ({@code ```json ... ```}); the content is still the model's own words, so it is
 * unwrapped here and then validated like any other model output.
 *
 * <p>The one repair: a reply that is complete except for its final closing brackets (Qwen does this on long replies,
 * finish=stop — 2026-10-24 a 1500-character script came back without its last {@code }}) gets those brackets appended.
 * Only brackets are added, only when the text ends on a finished value (not inside a string, not after {@code ,} or {@code :}),
 * so no content is invented; a reply cut off mid-string still fails.
 */
public final class ModelJson {
    private ModelJson() {}

    /** @throws JsonProcessingException when no JSON value can be read from the reply. A blank reply reads as a missing node. */
    public static JsonNode parse(ObjectMapper mapper, String reply) throws JsonProcessingException {
        String text = stripFence(reply);
        try {
            return mapper.readTree(text);
        } catch (JsonProcessingException direct) {
            int open = text.indexOf('{'), close = text.lastIndexOf('}');
            if (open >= 0 && close > open) {
                try { return mapper.readTree(text.substring(open, close + 1)); } catch (JsonProcessingException ignored) { /* report the first failure */ }
            }
            String closed = open >= 0 ? closeBrackets(text.substring(open)) : null;
            if (closed != null) {
                try { return mapper.readTree(closed); } catch (JsonProcessingException ignored) { /* report the first failure */ }
            }
            throw direct;
        }
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
