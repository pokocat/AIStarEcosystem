package com.aistareco.aep.config;

import com.aistareco.aep.dap.model.DapPublicAvatar;
import com.aistareco.aep.dap.repository.DapPublicAvatarRepository;
import com.aistareco.aep.dap.service.DapCatalogService;
import com.aistareco.aep.dap.service.DapPublicAvatarService;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 内置官方形象入库，每批使用独立标记。
 *
 * <p>把随服务端打包的图（resources/dap/plaza）存进存储，写成 dap_public_avatar 的行并标为免费，
 * 供画布和 AI 图片 / AI 视频引用。
 *
 * <p>存图失败不写该批标记，下次启动从尚未入库的形象继续。已完成批次不会覆盖运营之后的更改。
 *
 * <p>test profile 不跑。需要它的测试自己调 {@link #seed()}。
 */
@Component
@Profile("!test")
@ConditionalOnProperty(name = "aep.dap.builtin-public-avatars.enabled", havingValue = "true", matchIfMissing = true)
@Order(200)
public class DapBuiltinPublicAvatarSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DapBuiltinPublicAvatarSeeder.class);
    public static final String MARKER = "dap.builtin-public-avatars.seeded";
    public static final String EXPANSION_MARKER = "dap.builtin-public-avatars.expansion-20261113.seeded";
    private static final Set<String> ORIGINAL_IDS = Set.of(
            "PA-01", "PA-02", "PA-03", "PA-04", "PA-05", "PA-06", "PA-10");

    private final DapCatalogService catalog;
    private final DapPublicAvatarRepository repo;
    private final FileStorageService storage;
    private final PlatformConfigService configs;
    private final ObjectMapper json;

    public DapBuiltinPublicAvatarSeeder(DapCatalogService catalog, DapPublicAvatarRepository repo, FileStorageService storage,
                                        PlatformConfigService configs, ObjectMapper json) {
        this.catalog = catalog;
        this.repo = repo;
        this.storage = storage;
        this.configs = configs;
        this.json = json;
    }

    @Override
    public void run(String... args) {
        try {
            seed();
        } catch (Exception e) {
            log.error("[official-avatars] 内置官方形象入库失败，下次启动重试；在此之前它们不能用于生成", e);
        }
    }

    /** @return 本次新写入的形象 id */
    public List<String> seed() throws Exception {
        List<String> created = new ArrayList<>();
        List<Map<String, Object>> builtins = catalog.publicAvatars();
        seedBatch(MARKER, builtins.stream().filter(p -> ORIGINAL_IDS.contains(p.get("id"))).toList(), -100, created);
        if (configs.findByKey(EXPANSION_MARKER).isEmpty()) {
            // 线上旧行只补新视角，运营删掉的形象不重新上架。
            for (String id : ORIGINAL_IDS) {
                var row = repo.findById(id).orElse(null);
                if (row != null && row.getThreeViewKey() == null) {
                    repo.setBuiltinThreeViewIfMissing(id, store("/plaza/" + id + "-three-view.jpg"));
                }
            }
        }
        seedBatch(EXPANSION_MARKER, builtins.stream().filter(p -> !ORIGINAL_IDS.contains(p.get("id"))).toList(), -90, created);
        if (!created.isEmpty()) log.info("[official-avatars] 内置官方形象入库 {} 个：{}", created.size(), created);
        return created;
    }

    private void seedBatch(String marker, List<Map<String, Object>> builtins, int sortStart, List<String> created) throws Exception {
        if (configs.findByKey(marker).isPresent()) return;
        for (int i = 0; i < builtins.size(); i++) {
            Map<String, Object> pub = builtins.get(i);
            String id = String.valueOf(pub.get("id"));
            if (repo.existsById(id)) continue;
            Map<?, ?> shots = (Map<?, ?>) pub.get("shotImages");
            String front = store((String) shots.get("front-half"));
            String right = store((String) shots.get("right"));
            String left = store((String) shots.get("left"));
            String threeView = store((String) shots.get("three-view"));
            repo.save(row(pub, sortStart + i, front, right, left, threeView));
            created.add(id);
        }
        configs.seedIfAbsent(marker, json.valueToTree(Map.of("ids", builtins.stream().map(p -> p.get("id")).toList(), "at", Instant.now().toString())),
                "内置官方形象已入库（存在即不再写入；删改以后台为准）");
    }

    private String store(String path) throws Exception {
        if (path == null) return null;
        var res = new ClassPathResource("dap" + path);
        Path temporary = Files.createTempFile("dap-avatar-", ".jpg");
        try (InputStream in = res.getInputStream()) {
            Files.copy(in, temporary, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            String category = DapPublicAvatarService.CATEGORY;
            String key = FileStorageService.ownedKeyPrefix(category, "platform") + res.getFilename();
            return storage.storeAllocated(temporary, category, "platform", key, "image/jpeg").key();
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    @SuppressWarnings("unchecked")
    private static DapPublicAvatar row(Map<String, Object> pub, int order, String front, String right, String left, String threeView) {
        Instant now = Instant.now();
        Object palette = pub.get("palette"), def = pub.get("def");
        return DapPublicAvatar.builder()
                .id(String.valueOf(pub.get("id")))
                .name(String.valueOf(pub.get("name")))
                .codename(String.valueOf(pub.getOrDefault("codename", "plaza-avatar")))
                .archetype((String) pub.get("archetype"))
                .tagline((String) pub.get("tagline"))
                .cat((String) pub.get("cat"))
                .hue(pub.get("hue") instanceof Number n ? n.intValue() : 200)
                .path("ai")
                .engine((String) pub.get("engine"))
                .voiceName((String) pub.get("voiceName"))
                .palette(palette instanceof Map<?, ?> p ? new LinkedHashMap<>((Map<String, Object>) p) : null)
                .def(def instanceof Map<?, ?> d ? new LinkedHashMap<>((Map<String, Object>) d) : null)
                .frontKey(front).rightKey(right).leftKey(left)
                .threeViewKey(threeView)
                .fav(Boolean.TRUE.equals(pub.get("fav")))
                .sortOrder(order)
                .access(DapPublicAvatar.ACCESS_FREE)
                .createdByUserId("platform")
                .createdAt(now).updatedAt(now)
                .build();
    }
}
