package com.aistareco.aep.videostudio.service;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.materialvideo.JusuanH3Contract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioPricingConfig;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 视频生成区计价配置（平台配置 key {@value #CONFIG_KEY}，形状 = {@link VideoStudioPricingConfig}，
 * docs/video-studio-plan.md §3）。范式同 {@code CelebrityActionPricingService}：首次启动写入默认值、
 * 60 秒缓存、后台整份替换后立即失效。
 *
 * <p>与那个范式**刻意不同的一点**：库里的配置读不出来（手工改坏了 JSON、值越界）时**不回落默认值**。
 * 这里的默认值是「不加价、智能优化不收费」，悄悄回落等于把运营定的价改成白送（§8.0）。
 * 此时一律 503 {@code VIDEO_STUDIO_PRICE_NOT_CONFIGURED}，告诉运营去后台重新保存一次。
 * 库里根本没有这条（种子写入失败）不算读不出：那就是初始状态，按默认值。
 */
@Service
public class VideoStudioPricingService {

    private static final Logger log = LoggerFactory.getLogger(VideoStudioPricingService.class);

    public static final String CONFIG_KEY = "celebrity.video-studio-pricing";
    private static final String DESCRIPTION =
            "视频生成区计价：模式 × 清晰度每秒价（空 = 按模型单价）、全能参考加价、智能优化单价";
    private static final long CACHE_TTL_MS = 60_000L;

    /** 读库用：未知字段忽略（以后加字段时旧代码不至于读崩）。 */
    private static final ObjectMapper OM = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private record Cache(VideoStudioPricingConfig config, long fetchedAt) {}

    private final AtomicReference<Cache> cache = new AtomicReference<>(null);
    private final PlatformConfigService platformConfig;

    public VideoStudioPricingService(PlatformConfigService platformConfig) {
        this.platformConfig = platformConfig;
    }

    @PostConstruct
    void seedIfAbsent() {
        try {
            platformConfig.seedIfAbsent(CONFIG_KEY, OM.valueToTree(VideoStudioPricing.defaults()), DESCRIPTION);
        } catch (Exception e) {
            log.warn("[video-studio-pricing] seed failed: {}", e.getMessage());
        }
    }

    /** 当前生效的配置（60 秒缓存）。读不出来 → 503，不回落默认值。 */
    public VideoStudioPricingConfig current() {
        Cache c = cache.get();
        long now = System.currentTimeMillis();
        if (c != null && now - c.fetchedAt() < CACHE_TTL_MS) return c.config();
        VideoStudioPricingConfig fresh = load();
        cache.set(new Cache(fresh, now));
        return fresh;
    }

    /** 后台整份替换：严格校验 → 落库 → 缓存立即换成新值。 */
    public VideoStudioPricingConfig replace(VideoStudioPricingConfig next, String updatedBy) {
        VideoStudioPricingConfig normalized = VideoStudioPricing.validate(next);
        platformConfig.upsert(CONFIG_KEY, OM.valueToTree(normalized), DESCRIPTION,
                updatedBy == null || updatedBy.isBlank() ? "admin" : updatedBy);
        cache.set(new Cache(normalized, System.currentTimeMillis()));
        log.info("[video-studio-pricing] 已更新 by={} config={}", updatedBy, normalized);
        return normalized;
    }

    private VideoStudioPricingConfig load() {
        JsonNode stored = platformConfig.findByKey(CONFIG_KEY).map(PlatformConfigDto::value).orElse(null);
        if (stored == null || stored.isNull()) return VideoStudioPricing.defaults();
        try {
            return parseStored(stored);
        } catch (Exception e) {
            log.error("[video-studio-pricing] 库里的计价配置读不出来，视频生成区暂停报价 key={} value={} err={}",
                    CONFIG_KEY, stored, e.toString());
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_STUDIO_PRICE_NOT_CONFIGURED",
                    "视频生成的定价配置读不出来，暂时不能生成。请运营到后台「明星带货 → 引擎定价 → 视频生成」重新保存一次");
        }
    }

    /**
     * 解析库里的配置：不认识的模式 / 清晰度忽略（以后删了一个模式，旧配置不至于让整个区停摆），
     * 缺的标量按 0；但**值越界一律不收**（抛出，由 {@link #load} 转成 503）。
     */
    static VideoStudioPricingConfig parseStored(JsonNode stored) throws Exception {
        VideoStudioPricingConfig raw = OM.treeToValue(stored, VideoStudioPricingConfig.class);
        Map<String, Map<String, Long>> known = new LinkedHashMap<>();
        if (raw.perSecond() != null) {
            for (Map.Entry<String, Map<String, Long>> row : raw.perSecond().entrySet()) {
                if (!JusuanH3Contract.isMode(row.getKey()) || row.getValue() == null) continue;
                Map<String, Long> cells = new LinkedHashMap<>();
                row.getValue().forEach((tier, v) -> {
                    if (JusuanH3Contract.TIERS.contains(tier)) cells.put(tier, v);
                });
                known.put(row.getKey(), cells);
            }
        }
        return VideoStudioPricing.validate(new VideoStudioPricingConfig(known,
                raw.freeRefImages() == null ? 0 : raw.freeRefImages(),
                raw.extraRefImagePerSecond() == null ? 0L : raw.extraRefImagePerSecond(),
                raw.promptOptimizationPerCall() == null ? 0L : raw.promptOptimizationPerCall()));
    }
}
