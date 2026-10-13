package com.aistareco.aep.ipstudio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class StudioTemplateCanvasCopyTest {
    final ObjectMapper mapper = new ObjectMapper();
    @Test void copiesAreIndependentEditableNodesAndPreserveRealTextAndImageLinks() {
        var preset = StudioTemplatePresets.definitions().get(1);
        var source = StudioTemplateService.cleanDoc(StudioTemplatePresets.source(preset, mapper), preset.recipe());
        String original = source.toString();
        var one = StudioTemplateCanvasCopy.copy(mapper, source, preset.recipe());
        var two = StudioTemplateCanvasCopy.copy(mapper, source, preset.recipe());
        assertEquals(original, source.toString()); assertEquals(5, one.path("nodes").size());
        Set<String> ids = new HashSet<>(); one.path("nodes").forEach(n -> ids.add(n.path("id").asText()));
        for (var n : two.path("nodes")) assertFalse(ids.contains(n.path("id").asText()));
        assertEquals(5, one.path("connections").size()); // 3 image links + brief to both generated nodes.
        for (var edge : one.path("connections")) { assertTrue(ids.contains(edge.path("fromNodeId").asText())); assertTrue(ids.contains(edge.path("toNodeId").asText())); }
        assertFalse(one.toString().contains("{{brief}}")); assertFalse(one.toString().contains("templateStepId"));
        var brief = one.path("nodes").get(2); assertTrue(brief.path("metadata").path("studio").path("templateInput").path("required").asBoolean());
        assertEquals("", brief.path("metadata").path("content").asText());
        assertEquals(5, one.path("nodes").get(4).path("metadata").path("seconds").asInt());
        assertEquals("9:16", one.path("nodes").get(4).path("metadata").path("size").asText());
        ((ObjectNode) brief.path("metadata")).put("content", "自己的新卖点");
        assertFalse(two.toString().contains("自己的新卖点")); assertEquals(original, source.toString());
    }
    @Test void authoredTextDefaultsAndVideoModeAreCanvasParametersRatherThanPrerequisites() {
        var preset = StudioTemplatePresets.definitions().get(0);
        var source = StudioTemplateService.cleanDoc(StudioTemplatePresets.source(preset, mapper), preset.recipe());
        var copy = StudioTemplateCanvasCopy.copy(mapper, source, preset.recipe());
        assertEquals(preset.recipe().inputs().get(1).defaultValue(), copy.path("nodes").get(1).path("metadata").path("content").asText());
        assertEquals("idle", copy.path("nodes").get(0).path("metadata").path("status").asText());
        assertFalse(copy.path("nodes").get(0).path("metadata").has("storageKey"));
    }
    @Test void completeCanvasCopyKeepsTextAndGeneratedMediaWithoutRecipeSteps() throws Exception {
        var source = mapper.readTree("""
            {"nodes":[{"id":"text","type":"text","metadata":{"content":"完整角色描述","prompt":"保留提示词"}},
            {"id":"image","type":"image","metadata":{"storageKey":"ipstudio_demo/IPV/image.png","images":[{"id":"candidate","storageKey":"ipstudio_demo/IPV/old.png"}]}},
            {"id":"video","type":"video","metadata":{"storageKey":"ipstudio_demo/IPV/video.mp4"}}],
            "connections":[{"fromNodeId":"text","toNodeId":"image"},{"fromNodeId":"image","toNodeId":"video"}],"viewport":{"x":11,"y":22,"k":0.3}}
            """);
        String original = source.toString();
        var copy = StudioTemplateCanvasCopy.copy(mapper, source, new com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.Recipe(List.of(), List.of()));
        assertEquals(3, copy.path("nodes").size()); assertEquals(2, copy.path("connections").size());
        assertEquals("完整角色描述", copy.path("nodes").get(0).path("metadata").path("content").asText());
        assertEquals("保留提示词", copy.path("nodes").get(0).path("metadata").path("prompt").asText());
        assertEquals(source.path("nodes").get(1).path("metadata"), copy.path("nodes").get(1).path("metadata"));
        assertEquals(source.path("nodes").get(2).path("metadata"), copy.path("nodes").get(2).path("metadata"));
        assertEquals(source.path("viewport"), copy.path("viewport"));
        assertNotEquals("text", copy.path("nodes").get(0).path("id").asText());
        assertEquals(copy.path("nodes").get(1).path("id"), copy.path("connections").get(1).path("fromNodeId"));
        assertEquals(original, source.toString());
    }

}
