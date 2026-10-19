package com.aistareco.aep.ipstudio.dialogue.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * One server-side dialogue tool. Tools only perform controlled business actions through existing services; skill text
 * and model output can never grant a tool or an operation (the registry checks the skill's stage whitelist first).
 */
public interface StudioDialogueTool {
    String name();
    /** Work-record card title (Chinese, user-facing). */
    String title();
    /** Description for the model. */
    String description();
    /** JSON schema of {@code args} (shared by native function calling and the JSON action protocol). */
    ObjectNode parameters(com.fasterxml.jackson.databind.ObjectMapper mapper);
    /** Native operation this action spends on (checked against the skill stage whitelist), or null when free. */
    default String operation(JsonNode args) { return null; }
    /** Whether this action is shown as a work-record card (pure loop markers are not). */
    default boolean recorded() { return true; }
    /** Argument problems found before anything runs; null when valid. Never touches money or state. */
    default String validate(JsonNode args, ToolContext ctx) { return null; }
    /** Short Chinese input summary for the card: no storage keys, signed URLs or private request data. */
    String safeInputSummary(JsonNode args, ToolContext ctx);
    ToolRun run(JsonNode args, ToolContext ctx, ToolHandle handle) throws Exception;
}
