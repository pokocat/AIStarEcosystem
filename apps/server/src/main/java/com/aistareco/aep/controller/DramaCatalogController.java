package com.aistareco.aep.controller;

import com.aistareco.aep.security.InAppOperatorGuard;
import com.aistareco.aep.service.DramaHotspotService;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 短剧「平台目录 / 灵感」内容（v0.67）：内容类型 / 模板库 / 短视频格式 / 近期热点 / 创意推荐。
 *
 * 这些是平台提供的可运营内容（非「用户数据」）。读：任意已登录 drama 用户；
 * 写：仅平台运营（JWT 角色 OPERATOR / SUPER_ADMIN）—— 维护入口在 web-drama 端（不进 admin 后台）。
 * 存储复用 {@link PlatformConfigService}（key 前缀 {@code drama.catalog.}）；某 key 未配置时
 * 返回 null，前端回退到内置默认目录（mock 作为默认值，不在后端重复一份）。
 */
@RestController
@RequestMapping("/api/me/drama/catalog")
public class DramaCatalogController {

    /** 目录键白名单 → PlatformConfig key。 */
    private static final Map<String, String> KEYS = Map.of(
            "contentTypes", "drama.catalog.content-types",
            "templates", "drama.catalog.templates",
            "formats", "drama.catalog.formats",
            "hotTopics", "drama.catalog.hot-topics",
            "ideas", "drama.catalog.ideas");

    private final PlatformConfigService configs;
    private final ObjectMapper om;
    private final DramaHotspotService hotspots;
    private final InAppOperatorGuard operatorGuard;

    public DramaCatalogController(PlatformConfigService configs, ObjectMapper om, DramaHotspotService hotspots,
                                  InAppOperatorGuard operatorGuard) {
        this.operatorGuard = operatorGuard;
        this.configs = configs;
        this.om = om;
        this.hotspots = hotspots;
    }

    /** 全量目录：每项为运营已配的值，未配则 null（前端回退默认）。 */
    @GetMapping
    public ApiResponse<JsonNode> getAll() {
        ObjectNode out = om.createObjectNode();
        KEYS.forEach((field, cfgKey) ->
                out.set(field, configs.findByKey(cfgKey).map(c -> (JsonNode) c.value()).orElse(null)));
        return ApiResponse.of(out);
    }

    /** 运营写入某个目录（整体覆盖该 key 的 JSON 数组 / 对象）。 */
    @PutMapping("/{field}")
    public ApiResponse<JsonNode> save(Authentication auth, @PathVariable String field, @RequestBody JsonNode value) {
        requireOperator(auth);
        String cfgKey = KEYS.get(field);
        if (cfgKey == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CATALOG_KEY_INVALID",
                    "未知目录：" + field + "（可选 " + String.join(" / ", KEYS.keySet()) + "）");
        }
        if (value == null || value.isNull()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CATALOG_VALUE_REQUIRED", "缺少要保存的目录内容");
        }
        var saved = configs.upsert(cfgKey, value, "短剧平台目录 · " + field, auth.getName());
        ObjectNode out = om.createObjectNode();
        out.put("field", field);
        out.put("version", saved.version());
        out.set("value", value);
        return ApiResponse.of(out);
    }

    /**
     * 运营手动触发：抓抖音热搜 → LLM 蒸馏成短剧选题钩子，返回候选批次（不落库）。
     * 运营在前端审核后再经 PUT /{field}=hotTopics 采用。body 可选 { max }。
     */
    @PostMapping("/generate-hotspots")
    public ApiResponse<JsonNode> generateHotspots(Authentication auth, @RequestBody(required = false) JsonNode body) {
        requireOperator(auth);
        int max = body != null ? body.path("max").asInt(12) : 12;
        List<String> candidates = hotspots.generate(max);
        ObjectNode out = om.createObjectNode();
        ArrayNode arr = out.putArray("candidates");
        candidates.forEach(arr::add);
        return ApiResponse.of(out);
    }

    /** 运营恢复某目录为内置默认（删除 override → 前端回退默认）。 */
    @DeleteMapping("/{field}")
    public ApiResponse<JsonNode> reset(Authentication auth, @PathVariable String field) {
        requireOperator(auth);
        String cfgKey = KEYS.get(field);
        if (cfgKey == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CATALOG_KEY_INVALID", "未知目录：" + field);
        }
        configs.delete(cfgKey);
        ObjectNode out = om.createObjectNode();
        out.put("field", field);
        out.put("reset", true);
        return ApiResponse.of(out);
    }

    /**
     * v0.149（§12.1）：消费者令牌不再带 operatorRole，所以这里改判 AepUser.operatorRole 真值
     * （见 InAppOperatorGuard）；typ=admin 令牌照常放行。
     */
    private void requireOperator(Authentication auth) {
        operatorGuard.require(auth, "仅平台运营可维护短剧目录内容。");
    }

    /** 暴露给前端的字段清单（便于 CMS 渲染）。 */
    @SuppressWarnings("unused")
    public static List<String> fields() {
        return List.copyOf(KEYS.keySet());
    }
}
