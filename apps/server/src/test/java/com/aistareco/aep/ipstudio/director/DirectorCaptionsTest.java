package com.aistareco.aep.ipstudio.director;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** 整集导出交给合成的已知台词（2026-11-07）。 */
class DirectorCaptionsTest {
    private final ObjectMapper om = new ObjectMapper();

    @Test void linesOfAShotShareItsTimeByLength() throws Exception {
        JsonNode clip = om.readTree("""
                {"durationSec":10,"shots":[
                  {"startSec":0,"endSec":4,"dialogue":[]},
                  {"startSec":4,"endSec":10,"dialogue":[{"speakerId":"a1","text":"一二"},{"speakerId":"a2","text":"三四五六"},{"speakerId":null,"text":" "}]}
                ]}""");
        JsonNode known = DirectorCaptions.knownClips(om, List.of(clip)).get(0);
        assertEquals(10.0, known.path("plannedSec").asDouble());
        JsonNode lines = known.path("lines");
        assertEquals(2, lines.size(), "空白台词不算；没有台词的镜头不占位");
        assertEquals("一二", lines.get(0).path("text").asText());
        assertEquals(4.0, lines.get(0).path("start").asDouble(), 0.01);
        assertEquals(10.0, lines.get(1).path("end").asDouble(), 0.5);
        assertTrue(lines.get(1).path("start").asDouble() >= lines.get(0).path("end").asDouble() - 0.001);
    }

    @Test void aClipWithoutDialogueStillKeepsItsPlaceInTheOrder() throws Exception {
        var out = DirectorCaptions.knownClips(om, List.of(om.readTree("{\"durationSec\":5,\"shots\":[]}"), om.readTree("{\"durationSec\":6,\"shots\":[{\"startSec\":0,\"endSec\":6,\"dialogue\":[{\"text\":\"好\"}]}]}")));
        assertEquals(2, out.size());
        assertEquals(0, out.get(0).path("lines").size());
        assertEquals(1, out.get(1).path("lines").size());
    }
}
