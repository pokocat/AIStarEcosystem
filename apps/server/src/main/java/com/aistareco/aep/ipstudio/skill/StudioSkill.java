package com.aistareco.aep.ipstudio.skill;

import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.SkillLimits;
import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.SkillSummary;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One parsed repository skill file. The YAML header is the execution boundary (stage operation whitelist, limits,
 * checks); the Markdown body is method text for the model and never widens it.
 *
 * @param maxSegmentSec positive integer, or the string {@code "model"} (resolved from the selected video model contract)
 * @param digest        sha256 of the whole normalized file; part of every accepted snapshot
 */
public record StudioSkill(String key, String name, int version, String status, String planning, String summary,
                          List<String> methodExamples, Map<String, List<String>> operations, int maxSourceSec,
                          int maxSegments, Object maxSegmentSec, int maxSteps, int maxAutoFixPerSegment,
                          List<String> checks, List<String> autoFixChecks, List<String> requiredCapabilities,
                          String body, String digest) {
    public static final String ANALYSIS = "analysis";
    public static final String PRODUCTION = "production";

    public boolean active() { return "active".equals(status); }
    public boolean withdrawn() { return "withdrawn".equals(status); }
    public List<String> stageOperations(String stage) { return operations.getOrDefault(stage, List.of()); }
    public boolean allows(String stage, String operation) { return stageOperations(stage).contains(operation); }

    public SkillSummary summaryDto() {
        return new SkillSummary(key, name, version, status, planning, summary, methodExamples, operations,
                new SkillLimits(maxSourceSec, maxSegments, maxSegmentSec, maxSteps, maxAutoFixPerSegment),
                checks, autoFixChecks, requiredCapabilities);
    }

    /**
     * Immutable snapshot stored with an accepted dialogue turn ({@code _exec.skill}). Deploying a new file later never
     * rewrites what an in-flight turn uses. Shape matches the executor's skill snapshot (limits.maxSegmentSec as text).
     */
    public ObjectNode snapshot(ObjectMapper mapper) {
        ObjectNode out = mapper.createObjectNode().put("key", key).put("name", name).put("version", version)
                .put("status", status).put("planning", planning).put("summary", summary).put("digest", digest);
        var examples = out.putArray("methodExamples");
        methodExamples.forEach(examples::add);
        var ops = out.putObject("operations");
        operations.forEach((stage, list) -> { var array = ops.putArray(stage); list.forEach(array::add); });
        out.putObject("limits").put("maxSourceSec", maxSourceSec).put("maxSegments", maxSegments)
                .put("maxSegmentSec", String.valueOf(maxSegmentSec)).put("maxSteps", maxSteps)
                .put("maxAutoFixPerSegment", maxAutoFixPerSegment);
        var checkArray = out.putArray("checks");
        checks.forEach(checkArray::add);
        var fixes = out.putArray("autoFixChecks");
        autoFixChecks.forEach(fixes::add);
        var caps = out.putArray("requiredCapabilities");
        requiredCapabilities.forEach(caps::add);
        out.put("body", body);
        return out;
    }

    public static StudioSkill fromSnapshot(JsonNode node) {
        if (node == null || !node.isObject() || !node.path("key").isTextual()) throw new IllegalStateException("Skill snapshot missing");
        Map<String, List<String>> operations = new LinkedHashMap<>();
        node.path("operations").fields().forEachRemaining(e -> operations.put(e.getKey(), strings(e.getValue())));
        JsonNode limits = node.path("limits");
        String segment = limits.path("maxSegmentSec").asText("model");
        Object maxSegmentSec = "model".equals(segment) ? "model" : (Object) Integer.parseInt(segment);
        return new StudioSkill(node.path("key").asText(), node.path("name").asText(), node.path("version").asInt(),
                node.path("status").asText(), node.path("planning").asText("dynamic"), node.path("summary").asText(""),
                strings(node.path("methodExamples")), Map.copyOf(operations), limits.path("maxSourceSec").asInt(),
                limits.path("maxSegments").asInt(), maxSegmentSec, limits.path("maxSteps").asInt(),
                limits.path("maxAutoFixPerSegment").asInt(), strings(node.path("checks")), strings(node.path("autoFixChecks")),
                strings(node.path("requiredCapabilities")), node.path("body").asText(""), node.path("digest").asText(""));
    }

    private static List<String> strings(JsonNode array) {
        List<String> out = new ArrayList<>();
        if (array != null && array.isArray()) array.forEach(v -> out.add(v.asText()));
        return List.copyOf(out);
    }
}
