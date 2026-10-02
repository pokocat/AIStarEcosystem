package com.aistareco.aep.service.materialvideo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** H3 厂商合同（docs/video-studio-plan.md §2）：两档 × 六种画布的像素、朝向与尺寸编码。 */
class JusuanH3ContractTest {

    @ParameterizedTest(name = "{0} · {1} → {2}×{3} {4} {5}")
    @CsvSource({
            "768p, 21:9, 1536, 672, landscape, h3-768-21x9",
            "768p, 16:9, 1344, 768, landscape, h3-768-16x9",
            "768p, 4:3, 1024, 768, landscape, h3-768-4x3",
            "768p, 1:1, 768, 768, square, h3-768-1x1",
            "768p, 3:4, 768, 1024, portrait, h3-768-3x4",
            "768p, 9:16, 768, 1344, portrait, h3-768-9x16",
            "544p, 21:9, 1280, 544, landscape, h3-544-21x9",
            "544p, 16:9, 960, 544, landscape, h3-544-16x9",
            "544p, 4:3, 736, 544, landscape, h3-544-4x3",
            "544p, 1:1, 544, 544, square, h3-544-1x1",
            "544p, 3:4, 544, 736, portrait, h3-544-3x4",
            "544p, 9:16, 544, 960, portrait, h3-544-9x16",
    })
    void everyCanvasHasPixelsOrientationAndSizeCode(String tier, String aspect, int width, int height,
                                                     String orientation, String sizeCode) {
        JusuanH3Contract.Canvas canvas = JusuanH3Contract.canvas(tier, aspect);
        assertNotNull(canvas);
        assertEquals(width, canvas.width());
        assertEquals(height, canvas.height());
        assertEquals(orientation, JusuanH3Contract.orientation(canvas));
        assertEquals(sizeCode, JusuanH3Contract.outputSizeCode(tier, aspect));
    }

    @Test
    @DisplayName("每档恰好六种画布，顺序固定（前端按这个顺序画按钮）")
    void eachTierHasSixCanvasesInDisplayOrder() {
        List<String> order = List.of("21:9", "16:9", "4:3", "1:1", "3:4", "9:16");
        for (String tier : JusuanH3Contract.TIERS) {
            assertEquals(order, JusuanH3Contract.canvases(tier).stream().map(JusuanH3Contract.Canvas::aspectRatio).toList());
        }
        assertEquals(List.of("768p", "544p"), JusuanH3Contract.TIERS);
    }

    @Test
    @DisplayName("不在合同里的清晰度 / 比例查不到，不猜一个最接近的")
    void unknownTierOrAspectIsNotInContract() {
        assertNull(JusuanH3Contract.canvas("1080p", "9:16"));
        assertNull(JusuanH3Contract.canvas("768p", "2:3"));
        assertNull(JusuanH3Contract.canvas("768p", null));
        assertTrue(JusuanH3Contract.canvases("720p").isEmpty());
    }

    @Test
    void modesMediaTypesAndLimits() {
        assertEquals(List.of("t2v", "i2v", "first_last_frame_video", "universal_reference_video"), JusuanH3Contract.MODES);
        assertTrue(JusuanH3Contract.isMode("i2v"));
        assertFalse(JusuanH3Contract.isMode("I2V"));
        assertFalse(JusuanH3Contract.isMode(null));
        assertEquals("reference_audio", JusuanH3Contract.referenceRole("audio"));
        assertEquals(30L * 1024 * 1024, JusuanH3Contract.referenceMaxBytes("image"));
        assertEquals(50L * 1024 * 1024, JusuanH3Contract.referenceMaxBytes("video"));
        assertEquals(15L * 1024 * 1024, JusuanH3Contract.referenceMaxBytes("audio"));
        assertEquals(16L * 1024 * 1024, JusuanH3Contract.FRAME_IMAGE_MAX_BYTES);
        assertEquals(5, JusuanH3Contract.MIN_SECONDS);
        assertEquals(15, JusuanH3Contract.MAX_SECONDS);
        assertEquals(7000, JusuanH3Contract.PROMPT_MAX_CHARS);
        assertEquals(2_147_483_647L, JusuanH3Contract.SEED_MAX);
        assertEquals(List.of("MP4"), JusuanH3Contract.formatsOf("video"));
    }
}
