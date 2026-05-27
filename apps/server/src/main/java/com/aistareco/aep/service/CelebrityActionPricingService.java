package com.aistareco.aep.service;

import com.aistareco.aep.dto.ActionPricingDto;
import com.aistareco.aep.dto.PlatformConfigDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * v0.35：celebrity 动作级权益扣减单价配置。
 *
 * 现状之前：mixcut 生成单价硬编在 PlatformConfig key {@code mixcut.credit-per-variant}（默认 30），
 *           分发上传单价硬编在 application.yml {@code sau.default-upload-cost}（默认 20）。
 *           运营无法按动作细粒度配置。
 *
 * 本服务：统一从 PlatformConfig key {@code celebrity.action-pricing} 读取 JSON 表，
 *         结构为 {@code { "<action>": { "creditPrice": <long> | "useEnginePricing": true } }}。
 *         action 例：{@code mixcut.generate}（单变体）/ {@code publish.upload}（单任务）/
 *                     {@code celebrity.video}（数字人视频生成，可选 useEnginePricing=true 回退到引擎价）。
 *
 * 读路径优先 PlatformConfig，缺失时 fallback 到旧 key / 默认值；admin PUT 立刻失效缓存。
 */
@Service
public class CelebrityActionPricingService {

    private static final Logger log = LoggerFactory.getLogger(CelebrityActionPricingService.class);
    private static final ObjectMapper OM = new ObjectMapper();

    public static final String ACTION_PRICING_CONFIG_KEY = "celebrity.action-pricing";

    public static final String ACTION_MIXCUT_GENERATE = "mixcut.generate";
    public static final String ACTION_PUBLISH_UPLOAD = "publish.upload";
    public static final String ACTION_CELEBRITY_VIDEO = "celebrity.video";

    /** 默认表：与 v0.34 行为完全一致（运行时若 config 为空则按此 fallback）。 */
    private static final Map<String, ActionPricingDto> ACTION_PRICING_DEFAULTS = new LinkedHashMap<>() {{
        put(ACTION_MIXCUT_GENERATE, new ActionPricingDto(30L, false));
        put(ACTION_PUBLISH_UPLOAD,  new ActionPricingDto(20L, false));
        put(ACTION_CELEBRITY_VIDEO, new ActionPricingDto(0L,  true));
    }};

    private static final long CACHE_TTL_MS = 60_000L;

    private record Cache(Map<String, ActionPricingDto> snapshot, long fetchedAt) {}
    private final AtomicReference<Cache> cache = new AtomicReference<>(null);

    private final PlatformConfigService platformConfig;

    public CelebrityActionPricingService(PlatformConfigService platformConfig) {
        this.platformConfig = platformConfig;
    }

    @PostConstruct
    void seedIfAbsent() {
        try {
            platformConfig.seedIfAbsent(
                    ACTION_PRICING_CONFIG_KEY,
                    OM.valueToTree(ACTION_PRICING_DEFAULTS),
                    "celebrity 动作级权益扣减单价（混剪生成 / 分发上传 / 视频生成）"
            );
        } catch (Exception e) {
            log.warn("[celebrity-action-pricing] seed failed: {}", e.getMessage());
        }
    }

    /** 读全表（admin GET 用）。 */
    public Map<String, ActionPricingDto> getAll() {
        Cache c = cache.get();
        long now = System.currentTimeMillis();
        if (c != null && now - c.fetchedAt < CACHE_TTL_MS) return c.snapshot;
        Map<String, ActionPricingDto> fresh = loadFromConfig();
        cache.set(new Cache(fresh, now));
        return fresh;
    }

    /**
     * 读单个 action 的单价。
     * config 缺失或 useEnginePricing=true → 返回 null（调用方按 fallback 决定怎么算）。
     */
    public Long creditPriceOf(String action) {
        ActionPricingDto p = getAll().get(action);
        if (p == null) return null;
        if (Boolean.TRUE.equals(p.useEnginePricing())) return null;
        Long cp = p.creditPrice();
        return cp != null && cp > 0 ? cp : null;
    }

    /** admin PUT，整表替换，立即 invalidate 缓存。 */
    public Map<String, ActionPricingDto> replaceAll(Map<String, ActionPricingDto> next) {
        if (next == null || next.isEmpty()) {
            throw new IllegalArgumentException("action pricing 不能为空");
        }
        JsonNode payload = OM.valueToTree(next);
        platformConfig.upsert(
                ACTION_PRICING_CONFIG_KEY,
                payload,
                "celebrity 动作级权益扣减单价（混剪生成 / 分发上传 / 视频生成）",
                "admin"
        );
        Map<String, ActionPricingDto> snap = new LinkedHashMap<>(next);
        cache.set(new Cache(snap, System.currentTimeMillis()));
        return snap;
    }

    // ── internals ────────────────────────────────────────────────────────────

    private Map<String, ActionPricingDto> loadFromConfig() {
        try {
            return platformConfig.findByKey(ACTION_PRICING_CONFIG_KEY)
                    .map(PlatformConfigDto::value)
                    .map(this::parse)
                    .orElseGet(() -> new LinkedHashMap<>(ACTION_PRICING_DEFAULTS));
        } catch (Exception e) {
            log.warn("[celebrity-action-pricing] load failed, falling back to defaults: {}", e.getMessage());
            return new LinkedHashMap<>(ACTION_PRICING_DEFAULTS);
        }
    }

    private Map<String, ActionPricingDto> parse(JsonNode root) {
        Map<String, ActionPricingDto> out = new LinkedHashMap<>();
        if (root == null || !root.isObject()) return new LinkedHashMap<>(ACTION_PRICING_DEFAULTS);
        Iterator<Map.Entry<String, JsonNode>> it = root.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            JsonNode v = e.getValue();
            Long price = v.hasNonNull("creditPrice") ? v.get("creditPrice").asLong() : null;
            boolean useEngine = v.hasNonNull("useEnginePricing") && v.get("useEnginePricing").asBoolean(false);
            out.put(e.getKey(), new ActionPricingDto(price, useEngine));
        }
        // 兜底缺失 action
        for (Map.Entry<String, ActionPricingDto> def : ACTION_PRICING_DEFAULTS.entrySet()) {
            out.putIfAbsent(def.getKey(), def.getValue());
        }
        return out;
    }
}
