package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpStylePresetDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpTemplateDto;
import com.aistareco.aep.ipstudio.service.IpCatalogService;
import com.aistareco.aep.ipstudio.service.IpDocs;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static com.aistareco.aep.ipstudio.IpStudioFixtures.OM;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 内置模板与风格 JSON 的构建期体检。
 *
 * <p>这些 JSON 是「产品内容」，跟着代码发布 —— 一个逗号打错，线上就是模板列表少一条、
 * 用户点「从模板新建」得到空画布。让它在这里就炸。
 */
class IpCatalogServiceTest {

    private final IpCatalogService catalog = new IpCatalogService(OM);

    @Test
    void allBuiltInTemplatesParse() {
        List<IpTemplateDto> templates = catalog.templates();
        // 顺序即首页展示顺序：「IP 打造」是主推工作流，排在两套单点模板前面。
        // JSON 打错一个逗号 → 目录里静默少一条（loadTemplates 只 WARN 不抛），所以这里逐条钉死。
        assertEquals(List.of("ip-toy-figure", "ip-launch-female", "ip-launch-male", "portrait-bjd-trio", "portrait-sticker-six"),
                templates.stream().map(IpTemplateDto::id).toList(),
                "内置工作流少了或顺序变了");
        for (IpTemplateDto t : templates) {
            assertFalse(t.name().isBlank());
            assertFalse(t.summary().isBlank());
            assertTrue(t.estimatedCredits() > 0);
            assertTrue(t.lookCount() > 0);
            assertNotNull(catalog.style(t.stylePresetId()).orElse(null),
                    "模板引用的风格预设必须存在：" + t.stylePresetId());
        }
    }

    @Test
    void templateGraphsAreWellFormedAndReachable() {
        for (IpTemplateDto t : catalog.templates()) {
            JsonNode doc = t.doc();
            IpDocs.requireValidDoc(doc);

            List<String> ids = new ArrayList<>();
            IpDocs.nodes(doc).forEach(n -> ids.add(n.path("id").asText()));
            assertEquals(ids.size(), ids.stream().distinct().count(), "节点 id 不能重复：" + t.id());

            for (JsonNode e : doc.path("edges")) {
                assertTrue(ids.contains(e.path("source").asText()),
                        t.id() + " 有一条边指向不存在的 source：" + e);
                assertTrue(ids.contains(e.path("target").asText()),
                        t.id() + " 有一条边指向不存在的 target：" + e);
            }

            // 每个节点都排好了位置（画布打开就是可读的左到右布局，不是全挤在原点）
            for (JsonNode n : IpDocs.nodes(doc)) {
                assertTrue(n.path("position").path("x").isNumber(), t.id() + " 节点缺 position.x：" + n.path("id"));
                assertTrue(n.path("position").path("y").isNumber(), t.id() + " 节点缺 position.y：" + n.path("id"));
            }

            // 形象卡数量与 lookCount 对得上，且每张都有 generate 节点接着
            // lookCount 数的是**发布时会登记成 DapLook 的那些**，也就是非主形象的出图节点
            // （IpPublishService 的 lookNodeIds 指的是 generate 节点）。
            // 不能拿形象卡节点数当代理：主形象自己也可以挂一张招牌造型（潮玩模板就是），
            // 那张不额外产出一条 DapLook。
            long publishedLooks = IpDocs.nodes(doc).stream()
                    .filter(n -> IpDocs.T_GENERATE.equals(IpDocs.typeOf(n)))
                    .filter(n -> !IpDocs.dataOf(n).path("isMaster").asBoolean(false)).count();
            assertEquals(t.lookCount(), publishedLooks, t.id() + " 的 lookCount 与实际出图节点数不符");

            long masters = IpDocs.nodes(doc).stream()
                    .filter(n -> IpDocs.T_GENERATE.equals(IpDocs.typeOf(n)))
                    .filter(n -> IpDocs.dataOf(n).path("isMaster").asBoolean(false)).count();
            assertEquals(1, masters, t.id() + " 必须且只能有一个主形象节点");

            for (JsonNode n : IpDocs.nodes(doc)) {
                if (!IpDocs.T_LOOK.equals(IpDocs.typeOf(n))) continue;
                JsonNode d = IpDocs.dataOf(n);
                assertFalse(IpDocs.text(d, "title") == null, t.id() + " 形象卡缺标题");
                // 形象卡自 v0.153 起只有一个自由 prompt（老画布的五字段仍可读，但内置模板一律用新字段）。
                // 内置模板的 prompt 空着 = 用户点进来看到一张空造型卡，属于打包事故。
                assertFalse(IpDocs.text(d, "prompt") == null, t.id() + " 形象卡缺造型提示词");
            }
        }
    }

    @Test
    void ipLaunchTemplatesAreGenderPairsWithSameShape() {
        // 「IP 打造」分男女只因为服装品类不同 —— 除了装扮文案，两套必须是同一张图、同一个价。
        IpTemplateDto f = catalog.template("ip-launch-female").orElseThrow();
        IpTemplateDto m = catalog.template("ip-launch-male").orElseThrow();
        assertEquals(f.lookCount(), m.lookCount());
        assertEquals(f.estimatedCredits(), m.estimatedCredits());
        assertEquals(f.stylePresetId(), m.stylePresetId());
        // 三套装扮 + 三个表情
        assertEquals(6, f.lookCount());
        // 特征卡 2 + 主形象 8×4 + 六套造型 8×2×6 = 130
        assertEquals(130, f.estimatedCredits());
        assertEquals(IpDocs.nodes(f.doc()).size(), IpDocs.nodes(m.doc()).size());
    }

    @Test
    void bjdTrioEstimateMatchesDefaultPricing() {
        IpTemplateDto t = catalog.template("portrait-bjd-trio").orElseThrow();
        // 默认单价：特征卡 2 + 主形象 8×4 + 三套造型 8×2×3 = 82
        assertEquals(82, t.estimatedCredits());
        assertEquals("bjd", t.stylePresetId());
        assertEquals(3, t.lookCount());
    }

    @Test
    void sixStylePresetsAreDeclaredWithPromptAndNegative() {
        List<IpStylePresetDto> styles = catalog.styles();
        assertEquals(List.of("bjd", "chibi", "pixar3d", "flat-vector", "guochao-ink", "clay"),
                styles.stream().map(IpStylePresetDto::id).toList());
        for (IpStylePresetDto s : styles) {
            assertFalse(s.name().isBlank(), s.id());
            assertFalse(s.summary().isBlank(), s.id() + " 需要一句中文说明给用户看");
            assertTrue(s.promptEn().length() > 40, s.id() + " 的 promptEn 太短，锁不住风格");
            assertNotNull(s.negativeEn(), s.id() + " 缺 negativeEn");
        }
    }

    @Test
    void unknownIdsResolveToEmptyRatherThanThrowing() {
        assertTrue(catalog.template("nope").isEmpty());
        assertTrue(catalog.style("nope").isEmpty());
        assertTrue(catalog.style(null).isEmpty());
    }
}
