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
 *  - 历史 p1-p6 演示商品不再并入共享 products 表；脚本直接引用商品库里的真实选品 id。
 *  - 脚本「归属人」映射到系统真实 seed 用户：created_by = 真实 AepUser.id；
 *    我的脚本（source.type=user）的 source.author 改为该用户 displayName；
 *    爆款同款保留原始外部 @作者；官方模板归 celebrity_operator。
 *
 * 幂等 / 升级：
 *  - 商品 seed 只负责清理历史 p1-p6 行，真实选品由 CelebrityProductSeeder 维护。
 *  - 脚本/视频/爆款用 SEED_VERSION（存 PlatformConfig）守门：版本不匹配则按 id upsert
 *    重新落库（覆盖 seed 行、保留用户自建草稿），无需手动清库。改 seed 数据 → 升版本号即可。
 */
@Component
@Order(36)
@ConditionalOnProperty(name = "aep.seed.dev-data.enabled", havingValue = "true", matchIfMissing = true)
public class MaterialOpsSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MaterialOpsSeeder.class);

    /** 改 seed 数据（含归属人映射）时升这个值，下次启动自动 re-upsert。 */
    private static final String SEED_VERSION = "v6-2026-05-29-oss-material-videos";
    private static final String CONFIG_KEY = "aep.material.seed-version";

    private static final List<String> STUDIO_USERNAMES = List.of("creator_luna", "studio_starlight", "agency_moonrise");
    private static final String OPERATOR_USERNAME = "celebrity_operator";
    private static final List<String> REMOVED_MATERIAL_PRODUCT_IDS = List.of("p1", "p2", "p3", "p4", "p5", "p6");

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
        int removed = 0;
        for (String id : REMOVED_MATERIAL_PRODUCT_IDS) {
            if (!productRepo.existsById(id)) continue;
            productRepo.deleteById(id);
            removed++;
        }
        if (removed > 0) log.info("MaterialOpsSeeder: removed {} legacy material demo products", removed);

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
        int myCursor = 0; // 个人脚本独立轮转：3 个 my_script 分给 3 个 studio 各一个，第一个给 creator_luna
        for (JsonNode raw : readArray("seed/material-scripts.json")) {
            ObjectNode n = (ObjectNode) raw;
            String id = n.get("id").asText();
            MaterialScript existingScript = scriptRepo.findById(id).orElse(null);
            String kind = orDefault(text(n, "kind"), "my_script");
            String ownerUserId = null; // 默认共享
            if (!studios.isEmpty()) {
                JsonNode srcNode = n.get("source");
                String type = srcNode != null ? optText(srcNode, "type") : "user";
                if ("system".equals(type)) {
                    // 官方模板：归 celebrity_operator（created_by），author 保留「系统内置」，共享
                    AepUser ownerOp = operator != null ? operator : studios.get(0);
                    n.put("created_by", ownerOp.getId());
                } else if ("my_script".equals(kind)) {
                    // 个人脚本：归轮转分配的 studio，私有（ownerUserId 非空）
                    AepUser owner = studios.get(myCursor++ % studios.size());
                    n.put("created_by", owner.getId());
                    if (srcNode instanceof ObjectNode src) src.put("author", owner.getDisplayName());
                    ownerUserId = owner.getId();
                } else {
                    // 爆款同款 / 非系统模板 / AI：共享，created_by 记克隆者(studios[0]) 供展示，author 保留外部
                    n.put("created_by", studios.get(0).getId());
                }
            }
            scriptRepo.save(MaterialScript.builder()
                    .id(id)
                    .productId(text(n, "product_id"))
                    .kind(kind)
                    .tier(orDefault(text(n, "tier"), "D"))
                    .category(text(n, "category"))
                    .hookType(text(n, "hook_type"))
                    .durationSec(n.path("duration_sec").asInt(0))
                    .ord(i++)
                    .ownerUserId(ownerUserId)
                    .deletedAt(existingScript != null ? existingScript.getDeletedAt() : null)
                    .payloadJson(om.writeValueAsString(n))
                    .build());
        }
        log.info("MaterialOpsSeeder: upsert {} material scripts（个人脚本归属 seed 用户，官方/爆款共享）", i);
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
