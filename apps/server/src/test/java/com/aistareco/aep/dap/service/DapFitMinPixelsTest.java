package com.aistareco.aep.dap.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 按端点下限上调画幅。
 *
 * <p>起因：换成火山方舟 seedream 4.5 之后出图一直失败 ——
 * {@code image size must be at least 3686400 pixels}。而画布的画幅是**逐节点**存的、
 * 模板还写死了 768×1024，换个模型就得把画布上每个节点挨个改一遍。
 */
class DapFitMinPixelsTest {

    private static final int SEEDREAM_MIN = 3_686_400;

    private static long pixels(String size) {
        String[] p = size.split("x");
        return Long.parseLong(p[0]) * Long.parseLong(p[1]);
    }

    @Test
    @DisplayName("没声明下限 —— 原样返回，既有端点行为不变")
    void noMinimumKeepsSizeUntouched() {
        assertEquals("768x1024", DapMultimodalClient.fitMinPixels("768x1024", null));
        assertEquals("768x1024", DapMultimodalClient.fitMinPixels("768x1024", 0));
    }

    @Test
    @DisplayName("已经够大 —— 不动它，绝不往下调")
    void alreadyBigEnoughIsNotShrunk() {
        assertEquals("2480x3312", DapMultimodalClient.fitMinPixels("2480x3312", SEEDREAM_MIN));
    }

    @Test
    @DisplayName("不够大 —— 顶上去，且保持原比例")
    void tooSmallIsScaledUpKeepingRatio() {
        String out = DapMultimodalClient.fitMinPixels("768x1024", SEEDREAM_MIN);
        assertTrue(pixels(out) >= SEEDREAM_MIN, "顶上去之后仍然不够：" + out);
        String[] p = out.split("x");
        double ratio = Double.parseDouble(p[0]) / Double.parseDouble(p[1]);
        assertEquals(768.0 / 1024.0, ratio, 0.02, "比例被改了：" + out);
    }

    @Test
    @DisplayName("边长按 8 对齐 —— 多数出图模型要求能被 8 整除")
    void dimensionsAreAlignedToEight() {
        String out = DapMultimodalClient.fitMinPixels("768x1024", SEEDREAM_MIN);
        String[] p = out.split("x");
        assertEquals(0, Integer.parseInt(p[0]) % 8, out);
        assertEquals(0, Integer.parseInt(p[1]) % 8, out);
    }

    @Test
    @DisplayName("各种比例都要真的过线（对齐时向上取整不能把结果又压回下限以下）")
    void everyRatioEndsUpAboveTheFloor() {
        for (String s : new String[]{"1024x1024", "768x1024", "1536x864", "864x1536", "2016x864", "1360x2048"}) {
            String out = DapMultimodalClient.fitMinPixels(s, SEEDREAM_MIN);
            assertTrue(pixels(out) >= SEEDREAM_MIN, s + " → " + out + " 仍然不够");
        }
    }

    @Test
    @DisplayName("比例值（\"1:1\"）不是像素 —— 原样交给上游解释，别乱算")
    void ratioValuesArePassedThrough() {
        assertEquals("1:1", DapMultimodalClient.fitMinPixels("1:1", SEEDREAM_MIN));
        assertEquals("auto", DapMultimodalClient.fitMinPixels("auto", SEEDREAM_MIN));
    }

    // ── 从上游的拒绝理由里读出下限（v0.169）──────────────────────────────

    @Test
    @DisplayName("火山方舟那句原话 —— 读出下限并算出该改成多大")
    void readsMinimumFromVolcanoMessage() {
        String msg = "The parameter `size` specified in the request is not valid: "
                + "image size must be at least 3686400 pixels. Request id: 0217888";
        String out = DapMultimodalClient.sizeFromMinPixelsHint(msg, "768x1024");
        assertTrue(out != null && pixels(out) >= SEEDREAM_MIN, "没读出来或没改够：" + out);
    }

    @Test
    @DisplayName("已经够大 —— 不改（说明是别的原因，重试没意义）")
    void doesNotRetryWhenSizeAlreadySatisfiesTheStatedMinimum() {
        String msg = "image size must be at least 3686400 pixels";
        assertEquals(null, DapMultimodalClient.sizeFromMinPixelsHint(msg, "2480x3312"));
    }

    @Test
    @DisplayName("跟画幅无关的拒绝 —— 不改，照常抛错")
    void unrelatedErrorsAreNotTreatedAsSizeProblems() {
        assertEquals(null, DapMultimodalClient.sizeFromMinPixelsHint("content policy violation", "768x1024"));
        assertEquals(null, DapMultimodalClient.sizeFromMinPixelsHint("invalid api key", "768x1024"));
        assertEquals(null, DapMultimodalClient.sizeFromMinPixelsHint(null, "768x1024"));
    }

    @Test
    @DisplayName("比例值（\"1:1\"）读不出像素 —— 不瞎改")
    void ratioValueIsNotRewritten() {
        assertEquals(null, DapMultimodalClient.sizeFromMinPixelsHint("image size must be at least 3686400 pixels", "1:1"));
    }

    // 下限读出来之后要**记到端点上**，否则每一次出图都先发一版必然被拒的画幅再改一次：
    // 用户多等一轮，日志里每次一条 400，而且哪天对方换了措辞解析不出来就直接变成出图失败。
    @Test
    @DisplayName("从拒绝理由里读出下限像素数（与画幅无关，纯解析）")
    void readsTheStatedMinimumPixelCount() {
        assertEquals(Integer.valueOf(3686400),
                DapMultimodalClient.minPixelsHint("The parameter `size` specified in the request is not valid: "
                        + "image size must be at least 3686400 pixels. Request id: 021788856216"));
        assertEquals(Integer.valueOf(3686400),
                DapMultimodalClient.minPixelsHint("image size must be AT LEAST 3686400 Pixels"));
    }

    @Test
    @DisplayName("没说下限就不记 —— 绝不拿别的数字当画幅下限")
    void doesNotInventAMinimumFromUnrelatedErrors() {
        assertEquals(null, DapMultimodalClient.minPixelsHint("content policy violation"));
        assertEquals(null, DapMultimodalClient.minPixelsHint("rate limit exceeded, retry after 30 seconds"));
        assertEquals(null, DapMultimodalClient.minPixelsHint(null));
    }
}
