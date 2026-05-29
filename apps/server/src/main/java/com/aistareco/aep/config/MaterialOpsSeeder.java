package com.aistareco.aep.config;

import com.aistareco.aep.model.MaterialScript;
import com.aistareco.aep.model.MaterialVideo;
import com.aistareco.aep.model.MaterialViralHit;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.repository.MaterialScriptRepository;
import com.aistareco.aep.repository.MaterialVideoRepository;
import com.aistareco.aep.repository.MaterialViralHitRepository;
import com.aistareco.aep.repository.ProductRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 素材运营 seed —— 把前端 mock（脚本 / 视频 / 爆款 / 商品）落库为 DB 初始数据。
 *
 * 数据集成：6 个带货商品并入共享 products 表（与商品库同源，脚本/视频以 product_id 关联）。
 * 幂等：商品按 id existence 守门（每次启动确保存在，抵御 CelebrityProductSeeder 的 reset）；
 *       脚本 / 视频 / 爆款 按各自表「为空才 seed」。
 * 数据来自 classpath:seed/material-*.json（与前端 mock 同形）。
 */
@Component
@Order(36)
@ConditionalOnProperty(name = "aep.seed.dev-data.enabled", havingValue = "true", matchIfMissing = true)
public class MaterialOpsSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MaterialOpsSeeder.class);

    private final ProductRepository productRepo;
    private final MaterialScriptRepository scriptRepo;
    private final MaterialVideoRepository videoRepo;
    private final MaterialViralHitRepository viralRepo;
    private final ObjectMapper om;

    public MaterialOpsSeeder(ProductRepository productRepo,
                             MaterialScriptRepository scriptRepo,
                             MaterialVideoRepository videoRepo,
                             MaterialViralHitRepository viralRepo,
                             ObjectMapper om) {
        this.productRepo = productRepo;
        this.scriptRepo = scriptRepo;
        this.videoRepo = videoRepo;
        this.viralRepo = viralRepo;
        this.om = om;
    }

    @Override
    public void run(String... args) {
        try {
            seedProducts();
            seedScripts();
            seedVideos();
            seedViralHits();
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
        if (scriptRepo.count() > 0) return;
        int i = 0;
        for (JsonNode n : readArray("seed/material-scripts.json")) {
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
        log.info("MaterialOpsSeeder: seeded {} material scripts", i);
    }

    private void seedVideos() throws Exception {
        if (videoRepo.count() > 0) return;
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
        log.info("MaterialOpsSeeder: seeded {} material videos", i);
    }

    private void seedViralHits() throws Exception {
        if (viralRepo.count() > 0) return;
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
        log.info("MaterialOpsSeeder: seeded {} viral hits", i);
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

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }
}
