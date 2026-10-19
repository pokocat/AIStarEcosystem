package com.aistareco.aep.ipstudio.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Reads the JSON object out of a chat model's reply. Many endpoints ignore {@code response_format=json_object} and wrap the
 * object in a markdown fence or a sentence ({@code ```json ... ```}); the content is still the model's own words, so it is
 * unwrapped here and then validated like any other model output. Nothing is repaired or filled in.
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
            throw direct;
        }
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
