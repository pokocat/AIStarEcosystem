package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpPromptGroupDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpPromptPresetDto;
import com.aistareco.aep.ipstudio.service.IpCatalogService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static com.aistareco.aep.ipstudio.IpStudioFixtures.OM;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 内置提示词模板的构建期体检。
 *
 * <p>模板是「产品内容」，跟代码一起发布 —— JSON 打错一个逗号，线上就是模板列表
 * 少一组、用户点「内置模板」得到空列表。让它在这里就炸。
 *
 * <p>同时守住一条产品约束：<b>性别只决定服装品类与体态基准，不决定表情与性格</b>。
 * 表情组与短动作组必须全部是 {@code any}。
 */
class IpPromptPresetsTest {

    private final IpCatalogService catalog = new IpCatalogService(OM);

    private IpPromptGroupDto group(String id) {
        return catalog.promptPresets().stream().filter(g -> id.equals(g.id())).findFirst()
                .orElseThrow(() -> new AssertionError("缺分组：" + id));
    }

    @Test
    void threeGroupsParse() {
        List<IpPromptGroupDto> groups = catalog.promptPresets();
        assertEquals(Set.of("outfit", "expression", "motion"),
                groups.stream().map(IpPromptGroupDto::id).collect(java.util.stream.Collectors.toSet()));
        groups.forEach(g -> assertFalse(g.presets().isEmpty(), g.id() + " 组是空的"));
    }

    @Test
    void everyPresetCarriesAFullPrompt() {
        for (IpPromptGroupDto g : catalog.promptPresets()) {
            for (IpPromptPresetDto p : g.presets()) {
                assertNotNull(p.prompt(), g.id() + "/" + p.id() + " 缺提示词");
                // 模板是「一段完整的提示词」，不是几个词的字段值 —— 太短说明写成字段了。
                assertTrue(p.prompt().length() >= 20,
                        g.id() + "/" + p.id() + " 提示词太短，模板应当是一段完整的话");
            }
        }
    }

    @Test
    void genderOnlySplitsOutfit() {
        // 装扮按性别分（服装品类 + 体态基准），男女各有若干套。
        Set<String> outfitGenders = group("outfit").presets().stream()
                .map(IpPromptPresetDto::gender).collect(java.util.stream.Collectors.toSet());
        assertTrue(outfitGenders.contains("female"));
        assertTrue(outfitGenders.contains("male"));

        // 表情与短动作**必须**男女共用：把「男性克制 / 女性活泼」编码进产品是刻板印象。
        for (String gid : List.of("expression", "motion")) {
            for (IpPromptPresetDto p : group(gid).presets()) {
                assertEquals("any", p.gender(), gid + "/" + p.id() + " 不该按性别分");
            }
        }
    }

    @Test
    void expressionAndMotionLockTheRest() {
        // 这两组能成套用的前提：只改表情 / 动作，服装机位光线锁死。
        for (String gid : List.of("expression", "motion")) {
            for (IpPromptPresetDto p : group(gid).presets()) {
                assertTrue(p.prompt().contains("与主形象完全一致"),
                        gid + "/" + p.id() + " 没锁死服装 / 机位 / 光线");
            }
        }
    }

    @Test
    void motionPresetsDeclareDuration() {
        // 短动作要产出 2–3 秒循环，时长是给视频衍生链路的参数，不能缺。
        for (IpPromptPresetDto p : group("motion").presets()) {
            assertNotNull(p.durationSec(), "motion/" + p.id() + " 缺时长");
            assertTrue(p.durationSec() >= 1 && p.durationSec() <= 3, "短动作应在 1–3 秒");
        }
    }

    @Test
    void presetIdsAreUnique() {
        List<String> ids = catalog.promptPresets().stream()
                .flatMap(g -> g.presets().stream()).map(IpPromptPresetDto::id).toList();
        assertEquals(ids.size(), Set.copyOf(ids).size(), "模板 id 重复");
    }
}
