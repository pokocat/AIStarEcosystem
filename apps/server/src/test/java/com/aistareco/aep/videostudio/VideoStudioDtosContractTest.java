package com.aistareco.aep.videostudio;

import com.aistareco.aep.videostudio.dto.VideoStudioDtos;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioJob;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioJobRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimization;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimizationRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioPricingConfig;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTemplate;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioUpload;
import com.aistareco.aep.videostudio.service.VideoStudioPricing;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * 跨端契约（CLAUDE.md §4.1）：Java DTO 与 {@code packages/types/src/video-studio.ts} 逐字段一致。
 *
 * <p>手抄的类型一定会和服务端漂移（§8.0.1 ⑦，v0.163 {@code output} 写成 {@code outputs}）——
 * 这里直接读 TS 真源比对字段名，而不是再手抄一份期望值。
 */
class VideoStudioDtosContractTest {

    /** Spring 的全局配置是 non_null；这里照它配，看 DTO 自己的 @JsonInclude(ALWAYS) 是否顶得住。 */
    private final ObjectMapper springLike = new ObjectMapper()
            .setSerializationInclusion(JsonInclude.Include.NON_NULL)
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private static Path tsSource() {
        for (Path p : List.of(Path.of("../../packages/types/src/video-studio.ts"),
                Path.of("packages/types/src/video-studio.ts"))) {
            if (Files.exists(p)) return p;
        }
        return null;
    }

    /** export interface X { a: T; b?: T | null; ... } → X → {a, b}（注释行跳过）。 */
    private static Map<String, Set<String>> tsInterfaces(String src) {
        Map<String, Set<String>> out = new LinkedHashMap<>();
        Matcher block = Pattern.compile("export interface (\\w+)\\s*\\{(.*?)\\n}", Pattern.DOTALL).matcher(src);
        Pattern field = Pattern.compile("^\\s*(\\w+)\\??\\s*:", Pattern.MULTILINE);
        while (block.find()) {
            String body = block.group(2).replaceAll("(?s)/\\*.*?\\*/", "").replaceAll("//[^\\n]*", "");
            Matcher f = field.matcher(body);
            Set<String> names = new TreeSet<>();
            while (f.find()) names.add(f.group(1));
            out.put(block.group(1), names);
        }
        return out;
    }

    @Test
    @DisplayName("每个 TS interface 都有同名 record，字段名一个不差")
    void everyTsInterfaceMatchesItsRecord() throws Exception {
        Path ts = tsSource();
        assumeTrue(ts != null, "找不到 packages/types/src/video-studio.ts（服务端单独构建时跳过）");
        Map<String, Set<String>> interfaces = tsInterfaces(Files.readString(ts, StandardCharsets.UTF_8));
        assertEquals(19, interfaces.size(), interfaces.keySet().toString());

        Map<String, Class<?>> records = Arrays.stream(VideoStudioDtos.class.getDeclaredClasses())
                .filter(Class::isRecord)
                .collect(Collectors.toMap(Class::getSimpleName, c -> c));
        assertEquals(interfaces.keySet(), records.keySet());
        for (Map.Entry<String, Set<String>> e : interfaces.entrySet()) {
            Set<String> javaFields = Arrays.stream(records.get(e.getKey()).getRecordComponents())
                    .map(RecordComponent::getName).collect(Collectors.toCollection(TreeSet::new));
            assertEquals(e.getValue(), javaFields, e.getKey());
        }
    }

    @Test
    @DisplayName("T | null 字段出 wire 是 null，不是消失；isDefault / selectableById 按原名序列化")
    void nullsStayOnTheWireAndBooleansKeepTheirNames() throws Exception {
        VideoStudioJob job = new VideoStudioJob("mvj_1", "t2v", "p", "768p", "9:16", null, null, 5, null, null,
                "queued", 0, "已入队", List.of(), null, null, null, 0L, null, null, "2026-09-30T12:00Z", null);
        JsonNode j = springLike.readTree(springLike.writeValueAsString(job));
        for (String f : List.of("width", "height", "seed", "modelName", "videoUrl", "thumbnailUrl", "errorMessage",
                "originalPrompt", "templateId", "completedAt")) {
            assertTrue(j.has(f) && j.get(f).isNull(), f);
        }

        // 未定价的格子是 perSecond 这个 Map 里的 null 值：必须原样是 null，不能被 non_null 吞掉（吞掉 = 前端拿到 undefined）
        VideoStudioModel model = new VideoStudioModel("ep", "H3", true, false, VideoStudioService.contract(5, 15),
                VideoStudioPricing.effective(VideoStudioPricing.defaults(), null));
        JsonNode m = springLike.readTree(springLike.writeValueAsString(model));
        assertTrue(m.path("isDefault").asBoolean());
        assertFalse(m.has("default"));
        assertFalse(m.path("selectableById").asBoolean());
        JsonNode t2vCells = m.path("pricing").path("perSecond").path("t2v");
        assertTrue(t2vCells.has("768p") && t2vCells.get("768p").isNull(), t2vCells.toString());
        assertTrue(t2vCells.has("544p") && t2vCells.get("544p").isNull(), t2vCells.toString());
        List<String> modes = new ArrayList<>();
        m.path("pricing").path("perSecond").fieldNames().forEachRemaining(modes::add);
        assertEquals(List.of("t2v", "i2v", "first_last_frame_video", "universal_reference_video"), modes);
        JsonNode t2v = m.path("contract").path("modes").get(0);
        assertTrue(t2v.has("frameImage") && t2v.get("frameImage").isNull());
        assertTrue(t2v.has("references") && t2v.get("references").isNull());

        VideoStudioUpload up = new VideoStudioUpload("k", "u", "image", 3, "a.png", null, null, null);
        JsonNode u = springLike.readTree(springLike.writeValueAsString(up));
        assertTrue(u.has("durationSec") && u.get("durationSec").isNull());

        VideoStudioOptimization opt = new VideoStudioOptimization("vso_1", "queued", "p", null, null, 0L,
                "2026-09-30T12:00Z", null);
        JsonNode o = springLike.readTree(springLike.writeValueAsString(opt));
        for (String f : List.of("optimizedPrompt", "errorMessage", "completedAt")) {
            assertTrue(o.has(f) && o.get(f).isNull(), f);
        }

        VideoStudioTemplate tpl = new VideoStudioTemplate("vst_1", "private", "t", null, "t2v", "p", "768p", "9:16", 5,
                null, null, null, List.of(), null, null, 0L, true, "2026-09-30T12:00Z");
        JsonNode t = springLike.readTree(springLike.writeValueAsString(tpl));
        for (String f : List.of("description", "seed", "endpointId", "modelName", "previewVideoUrl", "previewThumbnailUrl")) {
            assertTrue(t.has(f) && t.get(f).isNull(), f);
        }
        assertTrue(t.path("mine").asBoolean());
    }

    @Test
    @DisplayName("提交请求：TS 形状能直接读进来；请求里没有任何价格字段，客户端塞了也没地方落")
    void requestShapeHasNoPrice() throws Exception {
        VideoStudioJobRequest req = springLike.readValue("""
                {"mode":"universal_reference_video","prompt":"p","resolutionTier":"768p","aspectRatio":"9:16",
                 "seconds":5,"references":[{"mediaType":"image","key":"k"}],"templateId":"vst_1",
                 "optimizationId":"vso_1","credit_cost":0,"creditCost":0}""",
                VideoStudioJobRequest.class);
        assertEquals("universal_reference_video", req.mode());
        assertEquals(5, req.seconds());
        assertNull(req.seed());
        assertNull(req.endpointId());
        assertEquals("k", req.references().get(0).key());
        assertEquals("vst_1", req.templateId());
        assertEquals("vso_1", req.optimizationId());
        for (Class<?> type : List.of(VideoStudioJobRequest.class, VideoStudioOptimizationRequest.class)) {
            for (RecordComponent c : type.getRecordComponents()) {
                String n = c.getName().toLowerCase();
                assertFalse(n.contains("cost") || n.contains("price") || n.contains("credit"), c.getName());
            }
        }
    }

    @Test
    @DisplayName("后台定价配置：空格子出 wire 是 null；PUT 的 TS 形状能直接读进来")
    void pricingConfigShape() throws Exception {
        JsonNode c = springLike.readTree(springLike.writeValueAsString(VideoStudioPricing.defaults()));
        assertTrue(c.path("perSecond").path("i2v").has("544p") && c.path("perSecond").path("i2v").get("544p").isNull());
        assertEquals(0, c.path("freeRefImages").asInt(-1));
        assertEquals(0, c.path("promptOptimizationPerCall").asInt(-1));
        VideoStudioPricingConfig parsed = springLike.readValue("""
                {"perSecond":{"t2v":{"768p":30,"544p":null}},"freeRefImages":6,"extraRefImagePerSecond":5,
                 "promptOptimizationPerCall":2}""", VideoStudioPricingConfig.class);
        assertEquals(30L, parsed.perSecond().get("t2v").get("768p"));
        assertNull(parsed.perSecond().get("t2v").get("544p"));
        assertEquals(6, parsed.freeRefImages());
        assertEquals(2L, parsed.promptOptimizationPerCall());
    }
}
