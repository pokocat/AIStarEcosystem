package com.aistareco.aep.ipstudio.dialogue.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;

/** Small JSON helpers shared by the tools. */
public final class DialogueTools {
    private DialogueTools() {}
    public static final ObjectMapper OM = new ObjectMapper();

    public static ObjectNode schema(ObjectMapper m, String... required) {
        ObjectNode s = m.createObjectNode().put("type", "object");
        s.putObject("properties");
        ArrayNode req = s.putArray("required");
        for (String r : required) req.add(r);
        s.put("additionalProperties", false);
        return s;
    }
    public static ObjectNode prop(ObjectNode schema, String name, String type, String description) {
        return ((ObjectNode) schema.path("properties")).putObject(name).put("type", type).put("description", description);
    }
    public static String text(JsonNode args, String field) {
        JsonNode v = args == null ? null : args.path(field);
        return v != null && v.isTextual() && !v.asText().isBlank() ? v.asText().strip() : null;
    }
    public static String excerpt(String text, int max) {
        if (text == null) return "";
        String t = text.strip();
        return t.length() <= max ? t : t.substring(0, max) + "…";
    }
    public static String ok(ObjectNode body) { return body.put("ok", true).toString(); }
    public static String fail(String summary) { return OM.createObjectNode().put("ok", false).put("summary", summary).toString(); }
    public static List<String> strings(JsonNode array, int max) {
        if (array == null || !array.isArray()) return List.of();
        return java.util.stream.StreamSupport.stream(array.spliterator(), false).filter(JsonNode::isTextual)
                .map(JsonNode::asText).limit(max).toList();
    }
}
