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
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 内置 10 个官方形象（PA-01…PA-10）入库（2026-11-10）。
 *
 * <p>这 10 个原来只在 {@link DapCatalogService#publicAvatars()} 里，图是前端自带的静态图（/plaza/*），
 * 不在存储里，所以画布和 AI 图片 / AI 视频没法拿来当参考图。这里把随服务端打包的同一批图
 * （resources/dap/plaza）存进存储，写成 dap_public_avatar 的行并标为免费，之后官方形象只有这一个来源。
 *
 * <p>只做一次：做完写平台配置 {@value #MARKER}。运营之后在后台删掉或改成需授权，重启不会改回来。
 * 存图失败不写标记、下次启动再试，期间这几个形象照旧按目录展示，但不能用于生成（不放行没有入库的图）。
 *
 * <p>test profile 不跑：每个测试上下文都会往本机存储写一遍 30 张图。需要它的测试自己调 {@link #seed()}。
 */
@Component
@Profile("!test")
@ConditionalOnProperty(name = "aep.dap.builtin-public-avatars.enabled", havingValue = "true", matchIfMissing = true)
@Order(200)
public class DapBuiltinPublicAvatarSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DapBuiltinPublicAvatarSeeder.class);
    public static final String MARKER = "dap.builtin-public-avatars.seeded";
    private static final String[] SHOTS = {"1", "2", "3"};

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
        if (configs.findByKey(MARKER).isPresent()) return List.of();
        List<String> created = new ArrayList<>();
        List<Map<String, Object>> builtins = catalog.publicAvatars();
        for (int i = 0; i < builtins.size(); i++) {
            Map<String, Object> pub = builtins.get(i);
            String id = String.valueOf(pub.get("id"));
            if (repo.existsById(id)) continue;
            String[] keys = new String[SHOTS.length];
            for (int s = 0; s < SHOTS.length; s++) keys[s] = store(id + "-" + SHOTS[s] + ".jpg");
            repo.save(row(pub, i, keys));
            created.add(id);
        }
        configs.seedIfAbsent(MARKER, json.valueToTree(Map.of("ids", builtins.stream().map(p -> p.get("id")).toList(), "at", Instant.now().toString())),
                "内置官方形象已入库（存在即不再写入；删改以后台为准）");
        if (!created.isEmpty()) log.info("[official-avatars] 内置官方形象入库 {} 个：{}", created.size(), created);
        return created;
    }

    private String store(String file) throws Exception {
        var res = new ClassPathResource("dap/plaza/" + file);
        if (!res.exists()) return null;
        try (InputStream in = res.getInputStream()) {
            return storage.store(in.readAllBytes(), DapPublicAvatarService.CATEGORY, null, "jpg", "image/jpeg").key();
        }
    }

    @SuppressWarnings("unchecked")
    private static DapPublicAvatar row(Map<String, Object> pub, int order, String[] keys) {
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
                .frontKey(keys[0]).rightKey(keys[1]).leftKey(keys[2])
                .fav(Boolean.TRUE.equals(pub.get("fav")))
                .sortOrder(-100 + order)
                .access(DapPublicAvatar.ACCESS_FREE)
                .createdByUserId("platform")
                .createdAt(now).updatedAt(now)
                .build();
    }
}
