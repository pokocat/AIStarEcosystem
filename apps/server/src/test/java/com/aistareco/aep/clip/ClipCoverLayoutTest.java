package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.ClipCoverLayout;
import com.aistareco.aep.clip.service.ClipCoverTemplate;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ClipCoverLayoutTest {

    /** 假度量器：宽度与字号严格成正比，等价于「每个字宽 perChar/基准字号」的理想字体。 */
    private static ClipCoverLayout.Measurer proportional(int chars, double widthPerCharPerSize) {
        return size -> (float) (chars * widthPerCharPerSize * size);
    }

    @Test
    void keepsBaseSizeWhenTextAlreadyFits() {
        assertEquals(58, ClipCoverLayout.fitFontSize(58, 38, 620, proportional(6, 1.0)),
                "6 字 × 58px = 348 < 620，不该无谓缩小");
    }

    @Test
    void shrinksUntilWidestLineFitsMaxWidth() {
        // 14 字 × 字号 → 14*58 = 812 > 620，必须缩到 <= 620/14 = 44
        int size = ClipCoverLayout.fitFontSize(58, 38, 620, proportional(14, 1.0));
        assertTrue(size <= 44, "缩完必须真的放得下，实际=" + size);
        assertTrue(size >= 38, "不能击穿 minFontSize，实际=" + size);
        assertTrue(14 * size <= 620);
    }

    @Test
    void stopsAtMinFontSizeInsteadOfShrinkingIntoIllegibility() {
        // 极端超长：等比缩放会算出个位数字号，必须停在下限
        assertEquals(38, ClipCoverLayout.fitFontSize(58, 38, 620, proportional(200, 1.0)),
                "宁可轻微出血也不能把标语缩成看不清的小字");
    }

    @Test
    void neverReturnsSizeAboveBaseEvenIfMeasurerReportsTinyWidths() {
        assertEquals(76, ClipCoverLayout.fitFontSize(76, 46, 640, proportional(1, 0.1)));
    }

    @Test
    void findsTheLargestFittingSizeWhenWidthIsNonLinearInFontSize() {
        // 字距/hinting 让宽度对字号并非线性：等比预估会落在放不下的一侧，二分必须找到临界点 43
        ClipCoverLayout.Measurer lumpy = size -> size >= 44 ? 700f : 600f;

        int size = ClipCoverLayout.fitFontSize(58, 30, 620, lumpy);

        assertEquals(43, size, "必须收敛到放得下的最大字号，而不是试完固定次数就交差");
        assertTrue(lumpy.widthAt(size) <= 620, "返回的字号必须是验证过放得下的");
    }

    @Test
    void returnedSizeAlwaysFitsAcrossTheWholeRange() {
        // 逐一验证：只要 minFontSize 放得下，返回值就必须放得下
        for (int chars = 1; chars <= 30; chars++) {
            ClipCoverLayout.Measurer measurer = proportional(chars, 1.0);
            int size = ClipCoverLayout.fitFontSize(58, 20, 620, measurer);
            if (measurer.widthAt(20) <= 620) {
                assertTrue(measurer.widthAt(size) <= 620, chars + " 字时返回的字号仍然超宽：" + size);
            } else {
                assertEquals(20, size, chars + " 字时应停在下限");
            }
        }
    }

    @Test
    void alignsLeftCenterAndRightAgainstTheAnchor() {
        assertEquals(56, ClipCoverLayout.alignedX(ClipCoverTemplate.Align.LEFT, 56, 300));
        assertEquals(210, ClipCoverLayout.alignedX(ClipCoverTemplate.Align.CENTER, 360, 300));
        assertEquals(360, ClipCoverLayout.alignedX(ClipCoverTemplate.Align.RIGHT, 660, 300));
    }

    @Test
    void mainTemplateKeepsTheFourElementHierarchy() {
        ClipCoverTemplate t = ClipCoverTemplate.ENTITY_VOICE;

        // 版式是数据，这条断言锁的是「参考图的层级」：关键词最大、落款大于标语
        assertTrue(t.keyword().fontSize() > t.signature().fontSize());
        assertTrue(t.signature().fontSize() > t.slogan().fontSize(),
                "落款金句必须比标语更大");
        assertTrue(t.keyword().anchorY() <= 320, "书法关键词要落在顶部 1/4");
        assertTrue(t.handle().anchorY() > 640 && t.handle().anchorY() < t.slogan().anchorY(),
                "账号名标签在中部偏下、且在标语之上");
        assertTrue(t.slogan().anchorY() < t.signature().anchorY(), "落款在标语之下");
        assertEquals(ClipCoverTemplate.Align.LEFT, t.handle().align(), "账号名左对齐");
        assertEquals(ClipCoverTemplate.Align.CENTER, t.slogan().align());
        assertEquals(0xFFFFE400, t.keyword().fillArgb(), "关键词是亮黄");
        assertEquals(0xFFFFFFFF, t.slogan().fillArgb(), "标语是白字");
        assertNotNull(t.signature().gradient(), "落款是金色渐变");
        assertNotNull(t.handle().chip(), "账号名是白底黑字标签");
        assertEquals(ClipCoverTemplate.FontRole.BRUSH, t.keyword().fontRole());
        assertEquals(2, t.slogan().maxLines());
    }

    @Test
    void unknownTemplateIdFallsBackWithoutThrowing() {
        assertEquals(ClipCoverTemplate.ENTITY_VOICE, ClipCoverTemplate.byId(null));
        assertEquals(ClipCoverTemplate.ENTITY_VOICE, ClipCoverTemplate.byId(""));
        assertEquals(ClipCoverTemplate.ENTITY_VOICE, ClipCoverTemplate.byId("nope"));
        assertEquals(ClipCoverTemplate.ENTITY_VOICE, ClipCoverTemplate.byId("cover_shiti"));
    }
}
