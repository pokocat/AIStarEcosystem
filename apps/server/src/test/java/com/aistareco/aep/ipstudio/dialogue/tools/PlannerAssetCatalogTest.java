package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.dialogue.DialogueCanvasDigest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * What the planner sees of the canvas (§6.1 / §6.2): the shape of a picture it may use as a first frame, and the draft the
 * assistant made earlier in the same turn, which the canvas has not saved yet but is exactly what targetNodeId should name.
 */
class PlannerAssetCatalogTest {
    final ObjectMapper om = new ObjectMapper();

    @Test void aPicturesRecordedSizeAndShapeAreInItsCatalogLine() throws Exception {
        var square = om.readTree("{\"id\":\"img-1\",\"type\":\"image\",\"title\":\"末日英雄\",\"metadata\":{\"storageKey\":\"ipstudio_gen/u/a.png\",\"naturalWidth\":1024,\"naturalHeight\":1024}}");
        assertTrue(DialogueCanvasDigest.line(square).contains("1024×1024（1:1）"), DialogueCanvasDigest.line(square));
        var unknown = om.readTree("{\"id\":\"img-2\",\"type\":\"image\",\"title\":\"没量过\",\"metadata\":{\"storageKey\":\"k\"}}");
        assertFalse(DialogueCanvasDigest.line(unknown).contains("×"), "no size is invented");
        assertEquals("9:16", DialogueCanvasDigest.ratioLabel(768, 1344));
        // The settings written on an empty draft are shown too: the plan for that object follows them.
        var draft = om.readTree("{\"id\":\"dlg-1\",\"type\":\"video\",\"title\":\"转身\",\"metadata\":{\"studio\":{\"spec\":{\"aspectRatio\":\"1:1\",\"durationSec\":5,\"source\":\"assistant\"}}}}");
        assertTrue(DialogueCanvasDigest.line(draft).contains("·待生成·设定 1:1、5 秒"), DialogueCanvasDigest.line(draft));
        assertEquals("16:9", DialogueCanvasDigest.ratioLabel(1920, 1080));
        assertEquals("5:7", DialogueCanvasDigest.ratioLabel(1000, 1400));
    }

    // 线上 2026-11-06：灵感示例的「我的版本」设的是 16:9、6 秒，助手看不到，按默认 9:16 报价。
    @Test void aDraftsOwnSettingsAreListedAndWhatTheAssistantWroteWins() throws Exception {
        var own = om.readTree("{\"id\":\"mine\",\"type\":\"video\",\"title\":\"我的版本\",\"metadata\":{\"size\":\"16:9\",\"seconds\":6,\"count\":1}}");
        assertTrue(DialogueCanvasDigest.line(own).contains("·设定 16:9、6 秒"), DialogueCanvasDigest.line(own));
        var written = om.readTree("{\"id\":\"mine\",\"type\":\"video\",\"title\":\"我的版本\",\"metadata\":{\"size\":\"16:9\",\"seconds\":6,\"studio\":{\"spec\":{\"aspectRatio\":\"9:16\",\"durationSec\":5}}}}");
        assertTrue(DialogueCanvasDigest.line(written).contains("·设定 9:16、5 秒"), DialogueCanvasDigest.line(written));
        // A picture's pixel size is not a setting, and anything with a file has no draft settings at all.
        var pixels = om.readTree("{\"id\":\"a\",\"type\":\"image\",\"title\":\"图\",\"metadata\":{\"size\":\"1024x1024\"}}");
        assertFalse(DialogueCanvasDigest.line(pixels).contains("设定"), DialogueCanvasDigest.line(pixels));
        var done = om.readTree("{\"id\":\"a\",\"type\":\"image\",\"title\":\"图\",\"metadata\":{\"size\":\"1:1\",\"storageKey\":\"k.png\"}}");
        assertFalse(DialogueCanvasDigest.line(done).contains("设定"), DialogueCanvasDigest.line(done));
    }

    @Test void aDraftCreatedThisTurnIsListedUntilTheCanvasSavesIt() throws Exception {
        var ctx = new ToolContext("u", "p", "t", "turn", "run", "a", "m", null, null, false, null, null, null, null, null, () -> false, null);
        var draft = om.readTree("{\"id\":\"dlg-1\",\"type\":\"video\",\"title\":\"让她转身\",\"metadata\":{\"prompt\":\"转身\",\"studio\":{\"kind\":\"shot\"}}}");
        ctx.createdNodeLines.put("dlg-1", DialogueCanvasDigest.line(draft));
        var saved = om.readTree("{\"nodes\":[{\"id\":\"img-1\",\"type\":\"image\",\"title\":\"首帧\",\"metadata\":{\"storageKey\":\"k\"}}],\"connections\":[]}");
        String assets = ProposePlanTool.assets(saved, ctx);
        assertTrue(assets.contains("[dlg-1]") && assets.contains("待生成"), assets);
        var afterSave = om.readTree("{\"nodes\":[{\"id\":\"img-1\",\"type\":\"image\",\"title\":\"首帧\",\"metadata\":{\"storageKey\":\"k\"}},"
                + "{\"id\":\"dlg-1\",\"type\":\"video\",\"title\":\"让她转身\",\"metadata\":{}}],\"connections\":[]}");
        String once = ProposePlanTool.assets(afterSave, ctx);
        assertEquals(1, once.split("\\[dlg-1\\]", -1).length - 1, "listed once when the canvas has it");
    }
}
