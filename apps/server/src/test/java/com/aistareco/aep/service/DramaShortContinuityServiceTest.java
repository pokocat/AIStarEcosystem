package com.aistareco.aep.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DramaShortContinuityServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();
    private final DramaShortContinuityService service = new DramaShortContinuityService(OM);

    @Test
    void enrichesScriptWithoutSecondModelOutputAndSeparatesVisualFromPerformanceTraits() throws Exception {
        ObjectNode script = (ObjectNode) OM.readTree("""
                {"meta":{"title":"喵影江湖","scene":"雨夜客栈","character":{"name":"喵无影","description":"嘴硬，口头禅是本喵懒得理你"}},
                 "scenes":[
                   {"heading":"夜·客栈","dialogue":"本喵懒得理你","sfx":"瓦片碎裂","duration_sec":5},
                   {"heading":"夜·客栈","dialogue":"","bgm":"急促锣鼓","duration_sec":7}
                 ]}
                """);

        ObjectNode enriched = service.enrichScript(script);
        var manifest = enriched.path("continuity_manifest");

        assertEquals("1.0", manifest.path("version").asText());
        assertEquals("喵无影", manifest.path("characters").path(0).path("visualTraits").asText());
        assertFalse(manifest.path("characters").path(0).path("visualTraits").asText().contains("口头禅"));
        assertTrue(manifest.path("characters").path(0).path("performanceTraits").asText().contains("口头禅"));
        assertEquals("shot-01", enriched.path("scenes").path(0).path("id").asText());
        assertEquals("shot-01", manifest.path("shots").path(1).path("parentShotId").asText());
        assertEquals(5, manifest.path("shots").path(1).path("audio").path("startSec").asInt());
        assertEquals(12, manifest.path("shots").path(1).path("audio").path("endSec").asInt());
    }

    @Test
    void preflightIsDeterministicAndReportsVoiceAndDroppedRefs() throws Exception {
        ObjectNode data = (ObjectNode) OM.readTree("""
                {"meta":{"scene":"客栈","character":{"name":"喵无影","description":""}},
                 "shots":[{"id":"s1","no":1,"dur":5,"visual":"跃上屋檐","voText":"退后","flow":"done","videoUrl":"/cdn/v.mp4",
                   "appliedRefs":{"requested":2,"applied":1}}]}
                """);

        var out = service.preflight(data);

        assertFalse(out.path("audioReady").asBoolean());
        assertFalse(out.path("assemblyReady").asBoolean());
        assertEquals("s1", out.path("dependencyPlan").path(0).path("shotId").asText());
        String issues = out.path("issues").toString();
        assertTrue(issues.contains("VOICE_SOURCE_REQUIRED"));
        assertTrue(issues.contains("REFS_DROPPED"));
    }
}
