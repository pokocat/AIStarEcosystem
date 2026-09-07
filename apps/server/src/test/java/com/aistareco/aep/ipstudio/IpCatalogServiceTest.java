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
import static org.junit.jupiter.api.Assertions.assertNull;
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
        assertEquals(List.of("ip-toy-figure", "ip-launch-female", "ip-launch-male"),
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

            for (JsonNode e : doc.path("connections")) {
                assertTrue(ids.contains(e.path("fromNodeId").asText()),
                        t.id() + " 有一条连线来自不存在的节点：" + e);
                assertTrue(ids.contains(e.path("toNodeId").asText()),
                        t.id() + " 有一条连线指向不存在的节点：" + e);
            }

            // 每个节点都排好了位置与尺寸（画布打开就是可读的左到右布局，不是全挤在原点）
            for (JsonNode n : IpDocs.nodes(doc)) {
                assertTrue(n.path("position").path("x").isNumber(), t.id() + " 节点缺 position.x：" + n.path("id"));
                assertTrue(n.path("position").path("y").isNumber(), t.id() + " 节点缺 position.y：" + n.path("id"));
                assertTrue(n.path("width").asInt(0) > 0, t.id() + " 节点缺宽度：" + n.path("id"));
                assertTrue(n.path("height").asInt(0) > 0, t.id() + " 节点缺高度：" + n.path("id"));
                assertFalse(n.path("title").asText("").isBlank(), t.id() + " 节点缺标题：" + n.path("id"));
            }

            // lookCount 数的是**发布时会登记成 DapLook 的那些**：主形象之外、写了提示词的图节点。
            // 主形象自己不额外产出一条 DapLook（它是数字人的定妆图）。
            long variants = IpDocs.nodes(doc).stream()
                    .filter(n -> IpDocs.T_IMAGE.equals(IpDocs.typeOf(n)))
                    .filter(n -> IpDocs.text(IpDocs.metadataOf(n), "prompt") != null)
                    .filter(n -> !"n-master".equals(n.path("id").asText())).count();
            assertEquals(t.lookCount(), variants, t.id() + " 的 lookCount 与实际变体节点数不符");

            // 照片位必须是空的：它等着用户把自己的照片拖进来。
            // 预填了提示词就会被当成「可以直接跑」，跑出来的是个跟用户无关的人。
            JsonNode photo = IpDocs.node(doc, "n-photo");
            assertNotNull(photo, t.id() + " 缺照片位 n-photo");
            assertNull(IpDocs.text(IpDocs.metadataOf(photo), "prompt"), t.id() + " 照片位不该预填提示词");
            assertNull(IpDocs.primaryStorageKey(photo), t.id() + " 照片位不该预填图片");

            // 主形象必须写了提示词，且照片连着它 —— 否则用户拖完照片点运行会说「缺内容」
            JsonNode master = IpDocs.node(doc, "n-master");
            assertNotNull(master, t.id() + " 缺主形象 n-master");
            assertNotNull(IpDocs.text(IpDocs.metadataOf(master), "prompt"), t.id() + " 主形象缺提示词");
            assertTrue(IpDocs.upstream(doc, "n-master").stream()
                            .anyMatch(n -> "n-photo".equals(n.path("id").asText())),
                    t.id() + " 照片没有连到主形象上");

            // 每个变体都要挂在主形象之后 —— 不挂就拿不到身份锚，出来的不是同一个人
            for (JsonNode n : IpDocs.nodes(doc)) {
                String id = n.path("id").asText();
                if (!id.startsWith("n-look-")) continue;
                assertTrue(IpDocs.upstream(doc, id).stream()
                                .anyMatch(u -> "n-master".equals(u.path("id").asText())),
                        t.id() + " 变体 " + id + " 没有接在主形象之后");
                assertNotNull(IpDocs.text(IpDocs.metadataOf(n), "prompt"), t.id() + " 变体 " + id + " 缺提示词");
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
    void toyFigureEstimateMatchesDefaultPricing() {
        IpTemplateDto t = catalog.template("ip-toy-figure").orElseThrow();
        // 默认单价：招牌形象 8×4 + 五套变体 8×2×5 = 112（加上历史沿用的 2 分特征卡余量 = 114）
        assertEquals(114, t.estimatedCredits());
        assertEquals("bjd", t.stylePresetId());
        assertEquals(5, t.lookCount());
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
