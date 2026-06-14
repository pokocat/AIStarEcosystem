package com.aistareco.aep.config;

import com.aistareco.aep.model.DramaRecipe;
import com.aistareco.aep.repository.DramaRecipeRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * 官方内置短剧配方（v0.74，抽 skill 飞轮 · 平台内置素材）。
 *
 * 把 {@code resources/seed/drama-recipes-official.json} 里的一批 origin=official 配方
 * 声明式 upsert 进 drama_recipes：直接 status=published，所有 drama 用户在创意库可见、可套用。
 * 数据由 flova skill 转换而来（创作风格 / 工作流模板，生产封面走 OSS key；
 * web-drama/public/recipes/ 仅作为历史 / dev fallback）。
 * previewVideo 在 dev/local 使用 flova-skill-example-videos.json 里已经上传的 OSS 公网样片 URL，
 * 避免本地 fake-CDN 没有视频文件时弹窗黑屏；线上 OSS driver 使用 OSS object key
 *（media/seed/flova/...），DB 存 key，URL 出 wire 时再签名派生。
 * coverImage 同理：seed 可同时声明本地 public fallback（coverImage）和 OSS key
 *（coverImageCdnKey）；OSS driver 下 DB 存 key，dev/local 下仍可读 web-drama/public。
 *
 * 幂等 + 声明式：seed JSON 是内容真值 —— 已存在的官方配方按 id 更新内容（title/summary/cover/payload…），
 * 但保留运行期累计的 {@code useCount} 与首次 {@code createdAt}。dev H2 每次重启重新 seed；
 * prod MySQL 首次插入后按 id 更新（改 seed 重启即生效）。非 official 配方（用户抽取的）不受影响。
 */
@Component
@Order(72)
public class DramaRecipeSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DramaRecipeSeeder.class);
    private static final String SEED_PATH = "seed/drama-recipes-official.json";
    private static final String VIDEO_META_PATH = "seed/flova-skill-example-videos.json";
    private static final String OFFICIAL_OWNER = "__official__";

    private final DramaRecipeRepository repo;
    private final ObjectMapper om;
    private final String cdnDriver;
    private final String videoSeedMode;

    public DramaRecipeSeeder(DramaRecipeRepository repo,
                             ObjectMapper om,
                             @Value("${aep.cdn.driver:local}") String cdnDriver,
                             @Value("${aep.drama.recipe.seed.video-mode:auto}") String videoSeedMode) {
        this.repo = repo;
        this.om = om;
        this.cdnDriver = cdnDriver == null ? "local" : cdnDriver.trim().toLowerCase(Locale.ROOT);
        this.videoSeedMode = normalizeVideoSeedMode(videoSeedMode);
    }

    @Override
    public void run(String... args) {
        JsonNode arr;
        try (InputStream in = new ClassPathResource(SEED_PATH).getInputStream()) {
            arr = om.readTree(in);
        } catch (Exception e) {
            log.warn("[drama-recipe-seed] 跳过：读取 {} 失败：{}", SEED_PATH, e.getMessage());
            return;
        }
        if (arr == null || !arr.isArray()) {
            log.warn("[drama-recipe-seed] 跳过：{} 不是 JSON 数组", SEED_PATH);
            return;
        }
        OffsetDateTime now = OffsetDateTime.now();
        String effectiveVideoMode = effectiveVideoMode();
        Map<String, VideoAsset> videoAssets = "logical-key".equals(effectiveVideoMode) ? Map.of() : loadVideoAssets();
        int inserted = 0, updated = 0, ossVideos = 0, publicVideos = 0;
        for (JsonNode n : arr) {
            String id = n.path("id").asText(null);
            if (id == null || id.isBlank()) continue;
            DramaRecipe r = repo.findById(id).orElse(null);
            boolean isNew = (r == null);
            if (isNew) {
                r = new DramaRecipe();
                r.setId(id);
                r.setOwnerUserId(OFFICIAL_OWNER);
                r.setUseCount(0);
                r.setCreatedAt(now);
                r.setPublishedAt(now);
            }
            // 声明式内容字段（每次启动以 seed 为准）
            r.setOrigin("official");
            r.setStatus("published");
            r.setTitle(n.path("title").asText(""));
            r.setSummary(n.path("summary").asText(""));
            r.setTypeKey(n.path("typeKey").asText("style"));
            r.setType(n.path("type").asText("风格短片"));
            r.setRatio(n.path("ratio").asText("9:16"));
            r.setEpisodes(n.path("episodes").asInt(1));
            r.setCoverFrom(n.path("coverFrom").asText("#f97316"));
            r.setCoverTo(n.path("coverTo").asText("#e11d48"));
            r.setCoverImage(resolveCoverImage(n));
            String previewVideo = resolvePreviewVideo(n, effectiveVideoMode, videoAssets);
            r.setPreviewVideo(previewVideo);
            if (isOssKey(previewVideo)) ossVideos++;
            if (isHttpUrl(previewVideo)) publicVideos++;
            r.setPayloadJson(n.path("payload").toString());
            r.setUpdatedAt(now);
            r.setDeletedAt(null);
            repo.save(r);
            if (isNew) inserted++; else updated++;
        }
        log.info("[drama-recipe-seed] 官方配方 seed 完成：新增 {} / 更新 {}（共 {} 条），cdnDriver={}，videoMode={}，OSS视频Key {} 条 / 公网视频URL {} 条",
                inserted, updated, arr.size(), cdnDriver, effectiveVideoMode, ossVideos, publicVideos);
    }

    private boolean isOssMode() {
        return "oss".equals(cdnDriver);
    }

    private String effectiveVideoMode() {
        if ("auto".equals(videoSeedMode)) {
            return isOssMode() ? "oss-key" : "public-url";
        }
        return videoSeedMode;
    }

    private String resolvePreviewVideo(JsonNode recipe, String mode, Map<String, VideoAsset> videoAssets) {
        String fallback = recipe.path("previewVideo").asText(null);
        if ("logical-key".equals(mode)) return fallback;
        String skillId = recipe.path("skillId").asText(null);
        if (skillId == null || skillId.isBlank()) return fallback;
        VideoAsset asset = videoAssets.get(skillId);
        if (asset == null) return fallback;
        String value = "oss-key".equals(mode) ? asset.ossKey() : asset.publicUrl();
        return (value == null || value.isBlank()) ? fallback : value;
    }

    private String resolveCoverImage(JsonNode recipe) {
        String fallback = recipe.path("coverImage").asText(null);
        if (!isOssMode()) return fallback;
        String cdnKey = recipe.path("coverImageCdnKey").asText(null);
        return (cdnKey == null || cdnKey.isBlank()) ? fallback : cdnKey;
    }

    private Map<String, VideoAsset> loadVideoAssets() {
        JsonNode arr;
        try (InputStream in = new ClassPathResource(VIDEO_META_PATH).getInputStream()) {
            arr = om.readTree(in);
        } catch (Exception e) {
            log.warn("[drama-recipe-seed] 视频元数据读取失败：{}，将回退 previewVideo 逻辑 key：{}",
                    VIDEO_META_PATH, e.getMessage());
            return Map.of();
        }
        if (arr == null || !arr.isArray()) return Map.of();
        Map<String, VideoAsset> out = new HashMap<>();
        for (JsonNode n : arr) {
            String skillId = n.path("skill_id").asText(null);
            String key = n.path("example_video_cdn_key").asText(null);
            String publicUrl = n.path("example_video_public_url").asText(null);
            if (skillId != null && !skillId.isBlank()) {
                out.put(skillId, new VideoAsset(key, publicUrl));
            }
        }
        if (out.isEmpty()) {
            log.warn("[drama-recipe-seed] 视频元数据为空：{}", VIDEO_META_PATH);
        }
        return out;
    }

    private String normalizeVideoSeedMode(String value) {
        String mode = value == null ? "auto" : value.trim().toLowerCase(Locale.ROOT);
        return switch (mode) {
            case "auto", "logical-key", "public-url", "oss-key" -> mode;
            default -> {
                log.warn("[drama-recipe-seed] 未知 video-mode={}，回退 auto", value);
                yield "auto";
            }
        };
    }

    private boolean isOssKey(String value) {
        return value != null && !value.isBlank() && !value.startsWith("/") && !value.startsWith("http://")
                && !value.startsWith("https://") && value.contains("/seed/flova/skills/");
    }

    private boolean isHttpUrl(String value) {
        return value != null && (value.startsWith("http://") || value.startsWith("https://"));
    }

    private record VideoAsset(String ossKey, String publicUrl) {}
}
