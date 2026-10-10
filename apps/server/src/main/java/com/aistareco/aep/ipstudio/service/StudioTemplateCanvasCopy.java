package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import java.util.regex.Pattern;

/** Turn an immutable published recipe into a normal editable canvas copy. No model, quote or ledger call. */
final class StudioTemplateCanvasCopy {
    private static final Pattern VARIABLE = Pattern.compile("\\{\\{([a-zA-Z0-9_-]+)}}");
    private StudioTemplateCanvasCopy() {}
    static ObjectNode copy(ObjectMapper mapper, JsonNode source, Recipe recipe) {
        ObjectNode doc = (ObjectNode) source.deepCopy();
        Map<String, String> nodeIds = new LinkedHashMap<>();
        for (var node : doc.path("nodes")) nodeIds.put(node.path("id").asText(), id("N-"));
        Map<String, Input> textInputs = new HashMap<>();
        for (Input input : recipe.inputs()) {
            ObjectNode node = (ObjectNode) IpDocs.node(doc, input.nodeId());
            ObjectNode md = node.withObject("/metadata");
            // Input constraints stay on nodes; no mandatory form before entering the canvas.
            ObjectNode constraint = md.withObject("/studio").putObject("templateInput");
            constraint.put("required", input.required()).put("label", input.label());
            if (input.options() != null) constraint.set("options", mapper.valueToTree(input.options()));
            if (Set.of("text", "option").contains(input.type())) {
                textInputs.put(input.id(), input);
                md.put("content", input.defaultValue() == null ? "" : input.defaultValue());
            }
        }
        for (Step step : recipe.steps()) {
            ObjectNode md = ((ObjectNode) IpDocs.node(doc, step.nodeId())).withObject("/metadata");
            var matcher = VARIABLE.matcher(step.prompt());
            // Editable text nodes supply their current content through actual canvas edges.
            md.put("prompt", matcher.replaceAll(""));
            matcher.reset(); Set<String> linked = new HashSet<>();
            while (matcher.find()) {
                Input input = textInputs.get(matcher.group(1));
                if (input != null && linked.add(input.nodeId()) && !hasEdge(doc, input.nodeId(), step.nodeId()))
                    doc.withArray("connections").addObject().put("id", id("E-")).put("fromNodeId", input.nodeId()).put("toNodeId", step.nodeId());
            }
            if ("video".equals(step.operation())) {
                md.put("seconds", step.durationSec()); md.put("size", step.aspectRatio());
                if (step.video() != null) {
                    md.put("videoMode", "universal_reference_video".equals(step.video().mode()) ? "reference" : "frames");
                    md.put("vquality", step.video().resolutionTier());
                    var preset = md.withObject("/studio").putObject("videoPreset");
                    preset.put("mode", step.video().mode()).put("resolutionTier", step.video().resolutionTier());
                    if (step.video().seed() != null) preset.put("seed", step.video().seed());
                }
            } else if (step.size() != null) {
                md.put("size", step.size());
            }
        }
        for (var node : doc.path("nodes")) ((ObjectNode) node).put("id", nodeIds.get(node.path("id").asText()));
        for (var edge : doc.path("connections")) {
            ObjectNode e = (ObjectNode) edge; e.put("id", id("E-")).put("fromNodeId", nodeIds.get(e.path("fromNodeId").asText())).put("toNodeId", nodeIds.get(e.path("toNodeId").asText()));
        }
        return doc;
    }
    private static boolean hasEdge(JsonNode doc, String from, String to) {
        for (var e : doc.path("connections")) if (from.equals(e.path("fromNodeId").asText()) && to.equals(e.path("toNodeId").asText())) return true;
        return false;
    }
    private static String id(String prefix) { return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 20); }
}
