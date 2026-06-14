package com.aistareco.aep.config;

import com.aistareco.aep.model.DramaRecipe;
import com.aistareco.aep.repository.DramaRecipeRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.OffsetDateTime;

/**
 * 官方内置短剧配方（v0.74，抽 skill 飞轮 · 平台内置素材）。
 *
 * 把 {@code resources/seed/drama-recipes-official.json} 里的一批 origin=official 配方
 * 声明式 upsert 进 drama_recipes：直接 status=published，所有 drama 用户在创意库可见、可套用。
 * 数据由 flova skill 转换而来（创作风格 / 工作流模板，封面落 web-drama/public/recipes/）。
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
    private static final String OFFICIAL_OWNER = "__official__";

    private final DramaRecipeRepository repo;
    private final ObjectMapper om;

    public DramaRecipeSeeder(DramaRecipeRepository repo, ObjectMapper om) {
        this.repo = repo;
        this.om = om;
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
        int inserted = 0, updated = 0;
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
            r.setCoverImage(n.path("coverImage").asText(null));
            r.setPreviewVideo(n.path("previewVideo").asText(null));
            r.setPayloadJson(n.path("payload").toString());
            r.setUpdatedAt(now);
            r.setDeletedAt(null);
            repo.save(r);
            if (isNew) inserted++; else updated++;
        }
        log.info("[drama-recipe-seed] 官方配方 seed 完成：新增 {} / 更新 {}（共 {} 条）", inserted, updated, arr.size());
    }
}
