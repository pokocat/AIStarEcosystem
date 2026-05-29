package com.aistareco.aep.config;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.MaterialScript;
import com.aistareco.aep.model.MaterialVideo;
import com.aistareco.aep.model.MaterialViralHit;
import com.aistareco.aep.model.PlatformConfig;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.MaterialScriptRepository;
import com.aistareco.aep.repository.MaterialVideoRepository;
import com.aistareco.aep.repository.MaterialViralHitRepository;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.aistareco.aep.repository.ProductRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 素材运营 seed —— 把前端 mock（脚本 / 视频 / 爆款 / 商品）落库为 DB 初始数据。
 *
 * 数据集成：
 *  - 6 个带货商品并入共享 products 表（与商品库同源，脚本/视频以 product_id 关联）。
 *  - 脚本「归属人」映射到系统真实 seed 用户：created_by = 真实 AepUser.id；
 *    我的脚本（source.type=user）的 source.author 改为该用户 displayName；
 *    爆款同款保留原始外部 @作者；官方模板归 celebrity_operator。
 *
 * 幂等 / 升级：
 *  - 商品按 id existence 守门（每次启动确保存在）。
 *  - 脚本/视频/爆款用 SEED_VERSION（存 PlatformConfig）守门：版本不匹配则按 id upsert
 *    重新落库（覆盖 seed 行、保留用户自建草稿），无需手动清库。改 seed 数据 → 升版本号即可。
 */
@Component
@Order(36)
@ConditionalOnProperty(name = "aep.seed.dev-data.enabled", havingValue = "true", matchIfMissing = true)
public class MaterialOpsSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MaterialOpsSeeder.class);

    /** 改 seed 数据（含归属人映射）时升这个值，下次启动自动 re-upsert。 */
    private static final String SEED_VERSION = "v2-2026-05-29-owners";
    private static final String CONFIG_KEY = "aep.material.seed-version";

    private static final List<String> STUDIO_USERNAMES = List.of("creator_luna", "studio_starlight", "agency_moonrise");
    private static final String OPERATOR_USERNAME = "celebrity_operator";

    private final ProductRepository productRepo;
    private final MaterialScriptRepository scriptRepo;
    private final MaterialVideoRepository videoRepo;
    private final MaterialViralHitRepository viralRepo;
    private final AepUserRepository userRepo;
    private final PlatformConfigRepository platformConfigRepo;
    private final ObjectMapper om;

    public MaterialOpsSeeder(ProductRepository productRepo,
                             MaterialScriptRepository scriptRepo,
                             MaterialVideoRepository videoRepo,
                             MaterialViralHitRepository viralRepo,
                             AepUserRepository userRepo,
                             PlatformConfigRepository platformConfigRepo,
                             ObjectMapper om) {
        this.productRepo = productRepo;
        this.scriptRepo = scriptRepo;
        this.videoRepo = videoRepo;
        this.viralRepo = viralRepo;
        this.userRepo = userRepo;
        this.platformConfigRepo = platformConfigRepo;
        this.om = om;
    }

    @Override
    public void run(String... args) {
        try {
            seedProducts();

            var existing = platformConfigRepo.findByConfigKey(CONFIG_KEY);
            String current = existing.map(PlatformConfig::getValueJson).orElse(null);
            if (SEED_VERSION.equals(current)) return; // 已是最新版本，跳过脚本/视频/爆款

            seedScripts();
            seedVideos();
            seedViralHits();
            upsertSeedVersion(existing.orElse(null));
        } catch (Exception e) {
            log.error("MaterialOpsSeeder failed: {}", e.getMessage(), e);
        }
    }

    private void seedProducts() throws Exception {
        LocalDate today = LocalDate.now();
        int added = 0;
        for (JsonNode n : readArray("seed/material-products.json")) {
            String id = n.get("id").asText();
            if (productRepo.existsById(id)) continue;
            List<String> images = new ArrayList<>();
            JsonNode imgs = n.get("images");
            if (imgs != null && imgs.isArray()) imgs.forEach(i -> images.add(i.asText()));
            productRepo.save(Product.builder()
                    .id(id)
                    .name(n.get("name").asText())
                    .category(n.get("category").asText())
                    .link(text(n, "link"))
                    .images(images)
                    .sellingPoints(text(n, "sellingPoints"))
                    .usageCount(0)
                    .source("manual")
                    .priceCents(n.hasNonNull("priceCents") ? n.get("priceCents").asInt() : null)
                    .commissionRate(n.hasNonNull("commissionRate") ? n.get("commissionRate").asInt() : null)
                    .createdAt(today)
                    .updatedAt(today)
                    .build());
            added++;
        }
        if (added > 0) log.info("MaterialOpsSeeder: +{} 带货商品并入商品库", added);
    }

    private void seedScripts() throws Exception {
        // 解析系统真实 seed 用户作为归属人池
        List<AepUser> studios = new ArrayList<>();
        for (String u : STUDIO_USERNAMES) userRepo.findByUsername(u).ifPresent(studios::add);
        AepUser operator = userRepo.findByUsername(OPERATOR_USERNAME)
                .orElse(studios.isEmpty() ? null : studios.get(0));
        if (studios.isEmpty()) {
            log.warn("MaterialOpsSeeder: 找不到 studio seed 用户，脚本归属人不映射（保留 mock 值）");
        }

        int i = 0;
        int ownerCursor = 0;
        for (JsonNode raw : readArray("seed/material-scripts.json")) {
            ObjectNode n = (ObjectNode) raw;
            if (!studios.isEmpty()) ownerCursor = assignOwner(n, studios, operator, ownerCursor);
            scriptRepo.save(MaterialScript.builder()
                    .id(n.get("id").asText())
                    .productId(text(n, "product_id"))
                    .kind(orDefault(text(n, "kind"), "my_script"))
                    .tier(orDefault(text(n, "tier"), "D"))
                    .category(text(n, "category"))
                    .hookType(text(n, "hook_type"))
                    .durationSec(n.path("duration_sec").asInt(0))
                    .ord(i++)
                    .payloadJson(om.writeValueAsString(n))
                    .build());
        }
        log.info("MaterialOpsSeeder: upsert {} material scripts（归属人已映射到 seed 用户）", i);
    }

    /**
     * 把脚本归属人映射到真实 seed 用户：
     *  - 官方模板（source.type=system）→ created_by = celebrity_operator，source.author 保留「系统内置」
     *  - 我的脚本（source.type=user）  → created_by + source.author = 轮转分配的 studio 用户
     *  - 爆款同款（source.type=viral） → created_by = studio 用户（克隆者），source.author 保留外部 @作者
     * 返回更新后的轮转游标。
     */
    private int assignOwner(ObjectNode n, List<AepUser> studios, AepUser operator, int cursor) {
        JsonNode srcNode = n.get("source");
        String type = srcNode != null ? optText(srcNode, "type") : "user";
        boolean isSystem = "system".equals(type);
        AepUser owner = isSystem ? (operator != null ? operator : studios.get(0))
                : studios.get(cursor % studios.size());
        if (!isSystem) cursor++;

        n.put("created_by", owner.getId());
        if (srcNode instanceof ObjectNode src && !"viral".equals(type)) {
            // user → 用户名；system → 保留「系统内置」展示
            if ("user".equals(type)) src.put("author", owner.getDisplayName());
        }
        return cursor;
    }

    private void seedVideos() throws Exception {
        int i = 0;
        for (JsonNode n : readArray("seed/material-videos.json")) {
            videoRepo.save(MaterialVideo.builder()
                    .id(n.get("id").asText())
                    .scriptId(text(n, "script_id"))
                    .productId(text(n, "product_id"))
                    .kind(text(n, "kind"))
                    .status(orDefault(text(n, "status"), "ready"))
                    .parentVideoId(text(n, "parent_video_id"))
                    .ord(i++)
                    .payloadJson(om.writeValueAsString(n))
                    .build());
        }
        log.info("MaterialOpsSeeder: upsert {} material videos", i);
    }

    private void seedViralHits() throws Exception {
        int i = 0;
        for (JsonNode n : readArray("seed/material-viral-hits.json")) {
            viralRepo.save(MaterialViralHit.builder()
                    .id(n.get("id").asText())
                    .platform(text(n, "platform"))
                    .score(n.path("score").asInt(0))
                    .payloadJson(om.writeValueAsString(n))
                    .build());
            i++;
        }
        log.info("MaterialOpsSeeder: upsert {} viral hits", i);
    }

    private void upsertSeedVersion(PlatformConfig existing) {
        PlatformConfig cfg = existing != null
                ? existing
                : PlatformConfig.builder()
                        .id(UUID.randomUUID().toString())
                        .configKey(CONFIG_KEY)
                        .description("MaterialOpsSeeder 已种植版本号；不匹配时按 id upsert 重新落库脚本/视频/爆款")
                        .version(0)
                        .build();
        cfg.setValueJson(SEED_VERSION);
        cfg.setVersion(cfg.getVersion() + 1);
        cfg.setUpdatedAt(Instant.now());
        cfg.setUpdatedBy("system:MaterialOpsSeeder");
        platformConfigRepo.save(cfg);
    }

    private List<JsonNode> readArray(String resourcePath) throws Exception {
        try (var in = new ClassPathResource(resourcePath).getInputStream()) {
            JsonNode root = om.readTree(in);
            List<JsonNode> out = new ArrayList<>();
            if (root.isArray()) root.forEach(out::add);
            return out;
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String optText(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? "" : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }
}
