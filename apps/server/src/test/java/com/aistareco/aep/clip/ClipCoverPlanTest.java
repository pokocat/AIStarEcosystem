package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.ClipCoverPlan;
import com.aistareco.aep.clip.service.ClipCoverTemplate;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class ClipCoverPlanTest {

    @Test
    void skipsCoverWhenDisabledOrAbsent() {
        assertTrue(ClipCoverPlan.parse(null).isEmpty(), "payload 为空不该有封面");
        assertTrue(ClipCoverPlan.parse(Map.of()).isEmpty(), "没有 cover 键不该有封面");
        assertTrue(ClipCoverPlan.parse(Map.of("cover", Map.of("keyword", "团结"))).isEmpty(),
                "只填文案没开开关，仍然不加封面");
        assertTrue(ClipCoverPlan.parse(Map.of("cover", Map.of("enabled", false, "keyword", "团结"))).isEmpty());
    }

    @Test
    void skipsCoverWhenEnabledButEveryTextSlotIsBlank() {
        Map<String, Object> cover = new LinkedHashMap<>();
        cover.put("enabled", true);
        cover.put("keyword", "  ");
        cover.put("handle", "");
        cover.put("sloganLines", List.of("", "   "));
        cover.put("signature", null);

        assertTrue(ClipCoverPlan.parse(Map.of("cover", cover)).isEmpty(),
                "开了开关但一个字都没填，等于没填，不该拼一张空封面");
    }

    @Test
    void parsesFourSlotsAndFallsBackToMainTemplateOnUnknownId() {
        Map<String, Object> cover = new LinkedHashMap<>();
        cover.put("enabled", true);
        cover.put("templateId", "cover_不存在");
        cover.put("keyword", " 团结 ");
        cover.put("handle", "@可乐米乐麻麻讲Ai");
        cover.put("sloganLines", List.of("一群人一条心", "一件事一起拼"));
        cover.put("signature", "集体为实体发声");
        cover.put("backgroundSourceNo", 3);

        ClipCoverPlan.Spec spec = ClipCoverPlan.parse(Map.of("cover", cover)).orElseThrow();

        assertEquals(ClipCoverTemplate.ENTITY_VOICE, spec.template(), "未知模板 id 必须回落主模板而不是渲染失败");
        assertEquals("团结", spec.keyword());
        assertEquals("@可乐米乐麻麻讲Ai", spec.handle());
        assertEquals(List.of("一群人一条心", "一件事一起拼"), spec.sloganLines());
        assertEquals("集体为实体发声", spec.signature());
        assertEquals(3, spec.backgroundSourceNo());
    }

    @Test
    void truncatesKeywordToTwoCharactersWithoutSplittingSurrogatePairs() {
        // 关键词槽位是 2 字；第 3 字起截断，且必须按码点截，不能把 emoji 劈成半个字符
        assertEquals("团结", ClipCoverPlan.truncate("团结", 2));
        assertEquals("团…", ClipCoverPlan.truncate("团结一心", 2));
        assertEquals("🧧…", ClipCoverPlan.truncate("🧧🧧🧧", 2));
        assertTrue(Character.isHighSurrogate(ClipCoverPlan.truncate("🧧🧧🧧", 2).charAt(0)));
        assertEquals("", ClipCoverPlan.truncate(null, 2));
        assertEquals("", ClipCoverPlan.truncate("   ", 2));
    }

    @Test
    void keepsAtMostTwoSloganLinesAndAcceptsNewlineSeparatedInput() {
        ClipCoverTemplate.Slot slot = ClipCoverTemplate.ENTITY_VOICE.slogan();

        assertEquals(List.of("一群人一条心", "一件事一起拼"),
                ClipCoverPlan.sloganLines("一群人一条心\n一件事一起拼", slot),
                "用户在一个输入框里敲换行也要拆成两行");
        assertEquals(List.of("第一行", "第二行"),
                ClipCoverPlan.sloganLines(List.of("第一行", "第二行", "第三行会被丢掉"), slot),
                "超出的行直接丢弃，不能拼成一句读不通的长句");
        assertEquals(List.of(), ClipCoverPlan.sloganLines(List.of("", "  "), slot));
    }

    @Test
    void turningTheCoverOffKeepsTheCopyForNextTime() {
        Map<String, Object> cover = new LinkedHashMap<>();
        cover.put("enabled", false);
        cover.put("keyword", "团结");
        cover.put("sloganLines", List.of("一群人一条心", "一件事一起拼"));
        cover.put("signature", "集体为实体发声");

        Map<String, Object> stored = ClipCoverPlan.normalize(cover);

        assertEquals(false, stored.get("enabled"));
        assertEquals("团结", stored.get("keyword"), "关掉开关不能顺手清空用户写好的文案");
        assertEquals(List.of("一群人一条心", "一件事一起拼"), stored.get("sloganLines"));
        assertTrue(ClipCoverPlan.parse(Map.of("cover", stored)).isEmpty(), "关着就是不渲染");

        // 再打开：还是原来那几句
        stored.put("enabled", true);
        assertEquals("团结", ClipCoverPlan.parse(Map.of("cover", stored)).orElseThrow().keyword());
    }

    @Test
    void normalizeTruncatesEvenWhenTheCoverIsOff() {
        Map<String, Object> stored = ClipCoverPlan.normalize(Map.of("enabled", false, "keyword", "团结一心向前"));
        assertEquals("团…", stored.get("keyword"), "存进库的永远是截断后的值");
    }

    @Test
    void normalizedSpecRoundTripsBackIntoPayloadShape() {
        Map<String, Object> cover = new LinkedHashMap<>();
        cover.put("enabled", true);
        cover.put("keyword", "团结一心");
        cover.put("sloganLines", List.of("一群人一条心"));

        Optional<ClipCoverPlan.Spec> spec = ClipCoverPlan.parse(Map.of("cover", cover));
        Map<String, Object> out = ClipCoverPlan.toMap(spec.orElseThrow());

        assertEquals(true, out.get("enabled"));
        assertEquals("cover_shiti", out.get("templateId"));
        assertEquals("团…", out.get("keyword"), "回写的必须是截断后的值，库里不能留超长文案");
        assertNull(out.get("backgroundAssetId"));
        // 回写结果再解析一次必须完全等价，避免存读两次形状漂移
        assertEquals(spec.orElseThrow(), ClipCoverPlan.parse(Map.of("cover", out)).orElseThrow());
    }
}
