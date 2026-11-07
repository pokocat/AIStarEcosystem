package com.aistareco.aep.ipstudio.director;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.List;

/**
 * 整集导出的已知台词（2026-11-07）：把每个片段每个镜头的台词连同预计时间交给合成，实际时间由语音识别校正。
 * 同一镜头里有几句话，按字数分配这个镜头的时间。
 */
final class DirectorCaptions {
    private DirectorCaptions() {}

    static ArrayNode knownClips(ObjectMapper om, List<JsonNode> clips) {
        ArrayNode out = om.createArrayNode();
        for (JsonNode clip : clips) {
            ObjectNode known = out.addObject().put("plannedSec", clip.path("durationSec").asDouble());
            ArrayNode lines = known.putArray("lines");
            for (JsonNode shot : clip.path("shots")) {
                int chars = 0;
                for (JsonNode line : shot.path("dialogue")) if (!line.path("text").asText("").isBlank()) chars += line.path("text").asText().length();
                if (chars == 0) continue;
                double start = shot.path("startSec").asDouble(), span = shot.path("endSec").asDouble() - start, at = start;
                for (JsonNode line : shot.path("dialogue")) {
                    String text = line.path("text").asText("");
                    if (text.isBlank()) continue;
                    double seconds = span * text.length() / chars;
                    lines.addObject().put("text", text).put("start", at).put("end", at + seconds);
                    at += seconds;
                }
            }
        }
        return out;
    }
}
