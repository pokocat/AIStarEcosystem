package com.aistareco.aep.config;

import com.aistareco.aep.dto.ProductInputDto;
import com.aistareco.aep.model.MixcutAsset;
import com.aistareco.aep.model.PlatformConfig;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.repository.MixcutAssetRepository;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.aistareco.aep.repository.ProductRepository;
import com.aistareco.aep.service.ProductLinkPersistService;
import com.aistareco.aep.service.ProductService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * v0.28+ 选品表格初始数据 seed —— 用「版本号守门 + 一次性 reset」实现。
 *
 * 启动时读 PlatformConfig 里的 seed-version：
 *   - 与代码内 SEED_VERSION 一致 → 跳过
 *   - 不一致（首次启动 / 版本升级）→ 清空 product 表 + 关联的 MixcutAsset 行 + 重新种 6 行 +
 *     写回新版本号到 PlatformConfig
 *
 * 升级 seed 数据的标准做法：
 *   1. 修改 INITIAL_PRODUCTS 列表
 *   2. 把 SEED_VERSION 改为新值（如 "v0.29-2026-06-XX"）
 *   3. 下次启动自动 reset；之后版本号匹配跳过
 *
 * 注意：reset 会把**所有** product 表行清掉，包括运营手动录入的。这是 v0.28 用户
 * 明确要求的「初始化系统数据，把以前老的都删掉」语义。生产化时若需保留运营数据，
 * 应改为「仅清空 SEED_VERSION 版本之前的 seed 行」+ 用 source 字段区分 seed vs manual。
 */
@Component
@Order(30)
@ConditionalOnProperty(name = "aep.seed.dev-data.enabled", havingValue = "true", matchIfMissing = true)
public class CelebrityProductSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CelebrityProductSeeder.class);

    /** 升级 seed 数据时改这个值；下次启动会触发一次性 reset。 */
    private static final String SEED_VERSION = "v0.28-2026-05-23";

    /** PlatformConfig 里存放当前已 seed 版本的 key。 */
    private static final String CONFIG_KEY = "aep.celebrity.products.seed-version";

    private final ProductRepository productRepository;
    private final ProductService productService;
    private final MixcutAssetRepository mixcutAssetRepository;
    private final PlatformConfigRepository platformConfigRepository;
    private final ProductLinkPersistService productLinkPersistService;

    public CelebrityProductSeeder(ProductRepository productRepository,
                                  ProductService productService,
                                  MixcutAssetRepository mixcutAssetRepository,
                                  PlatformConfigRepository platformConfigRepository,
                                  ProductLinkPersistService productLinkPersistService) {
        this.productRepository = productRepository;
        this.productService = productService;
        this.mixcutAssetRepository = mixcutAssetRepository;
        this.platformConfigRepository = platformConfigRepository;
        this.productLinkPersistService = productLinkPersistService;
    }

    /** 一条 seed 记录：商品ID / 名称 / 链接 / 价格（分）/ 佣金率（整数百分比）。 */
    private record SeedProduct(String id, String name, String link, int priceCents, int commissionRate) {}

    private static final List<SeedProduct> INITIAL_PRODUCTS = List.of(
            new SeedProduct(
                    "3485332505048038713",
                    "一次性水槽过滤网干湿分离水池漏网洗碗池碗槽防堵",
                    "https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=3485332505048038713&origin_type=pc_buyin_selection_decision",
                    990, 50
            ),
            new SeedProduct(
                    "3706263707349811466",
                    "保鲜膜套食品级一次性食品保鲜膜碗罩防串味加厚",
                    "https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=3706263707349811466&origin_type=pc_buyin_selection_decision",
                    990, 15
            ),
            new SeedProduct(
                    "3548176134007053937",
                    "【夏季爆款】夏季大人儿童孕婴儿通用精油贴可爱便携植物精油防护贴",
                    "https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=3548176134007053937&origin_type=pc_buyin_selection_decision",
                    990, 50
            ),
            new SeedProduct(
                    "3819840696727240859",
                    "【爱❤️助力】酒精湿巾80抽消毒湿巾一次性家用大号酒精",
                    "https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=3819840696727240859&origin_type=pc_buyin_selection_decision",
                    2290, 50
            ),
            new SeedProduct(
                    "3737779702866247934",
                    "一次性保鲜膜套食品级家用冰箱饭菜水果密封松紧口保鲜悬挂抽取式",
                    "https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=3737779702866247934&origin_type=pc_buyin_selection_decision",
                    1990, 40
            ),
            new SeedProduct(
                    "3819075223949541738",
                    "【小眼妹精选】保鲜膜套【500】食品级一次性防尘保鲜碗罩【翻盖抽取式",
                    "https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=3819075223949541738&origin_type=pc_buyin_selection_decision",
                    990, 20
            )
    );

    @Override
    public void run(String... args) {
        // 主流程：guard 检查 + reset / seed + 版本号 upsert 都跑在 seed() 里的统一事务里；
        // 异步抓图在 commit 之后才启动，避免在事务里 sleep / 等外网 I/O。
        boolean shouldEnrich = seed();
        if (shouldEnrich) {
            enrichImagesInBackground();
        }
    }

    /**
     * 同步 seed 步骤。每个底层 repo / service 调用自带 @Transactional（Spring Data 默认 +
     * ProductService 类级 @Transactional），单独提交。本方法**不**加 @Transactional 是有意为之：
     *  1. 避免在 run() 调 seed() 时遇到 Spring 自调用绕过 AOP 的坑；
     *  2. 让 deleteAll / save / version-marker 一组组短事务依次提交，整体大概 50-100ms 顺利完成；
     *  3. 任何中途失败下次启动版本号仍不匹配 → 触发 reset 重跑（deleteAll 幂等，所以安全）。
     *
     * 返回 true 表示「我刚刚 seed 了，需要异步抓图」；false 表示「跳过」。
     */
    public boolean seed() {
        var existingConfig = platformConfigRepository.findByConfigKey(CONFIG_KEY);
        String currentVersion = existingConfig
                .map(PlatformConfig::getValueJson)
                .orElse(null);

        if (SEED_VERSION.equals(currentVersion)) {
            log.debug("CelebrityProductSeeder: version {} already seeded, skip.", SEED_VERSION);
            return false;
        }

        long existingProducts = productRepository.count();
        if (currentVersion == null && existingProducts == 0) {
            log.info("CelebrityProductSeeder: first-time seed, version={} count=0", SEED_VERSION);
        } else {
            log.warn("CelebrityProductSeeder: RESET triggered (oldVersion={} newVersion={}) — clearing {} existing products + related MixcutAssets",
                    currentVersion, SEED_VERSION, existingProducts);
            clearExistingData();
        }

        seedInitialProducts();
        upsertSeedVersion(existingConfig.orElse(null));
        log.info("CelebrityProductSeeder: seeded {} products at version {}.",
                INITIAL_PRODUCTS.size(), SEED_VERSION);
        return true;
    }

    /**
     * 清空老数据（私有 helper，走 seed() 的 ambient 事务）：
     *  1. 先清掉所有 product 关联的 MixcutAsset 行（按 relatedProductId 命中）—— 避免商品被删后
     *     素材表里留下指向不存在 productId 的孤儿行；
     *  2. 再 deleteAll() product 表；
     *  3. MixcutRenderJob.productId 是软引用字符串（无 FK 约束），残留指向被删商品的 job 不动 ——
     *     下游 BatchPublishDrawer fetch product null 时优雅降级。
     */
    private void clearExistingData() {
        for (Product p : productRepository.findAll()) {
            List<MixcutAsset> assets = mixcutAssetRepository.findByRelatedProductIdAndDeletedAtIsNullOrderByUploadedAtDesc(p.getId());
            if (!assets.isEmpty()) {
                log.info("CelebrityProductSeeder: deleting {} MixcutAssets for product {}", assets.size(), p.getId());
                mixcutAssetRepository.deleteAll(assets);
            }
        }
        productRepository.deleteAll();
        productRepository.flush();
    }

    private void seedInitialProducts() {
        for (SeedProduct s : INITIAL_PRODUCTS) {
            try {
                ProductInputDto input = new ProductInputDto(
                        s.name(),
                        "日用百货",
                        s.link(),
                        List.of(),
                        "",
                        "manual",
                        s.priceCents(),
                        s.commissionRate()
                );
                productService.createWithId(s.id(), input);
            } catch (Exception e) {
                log.warn("CelebrityProductSeeder: seed failed for id={} err={}", s.id(), e.getMessage());
            }
        }
    }

    private void upsertSeedVersion(PlatformConfig existing) {
        PlatformConfig cfg = existing != null
                ? existing
                : PlatformConfig.builder()
                        .id(UUID.randomUUID().toString())
                        .configKey(CONFIG_KEY)
                        .description("CelebrityProductSeeder 当前已种植的版本号；不匹配 SEED_VERSION 时触发一次性 reset")
                        .version(0)
                        .build();
        cfg.setValueJson(SEED_VERSION);
        cfg.setVersion(cfg.getVersion() + 1);
        cfg.setUpdatedAt(Instant.now());
        cfg.setUpdatedBy("system:CelebrityProductSeeder");
        platformConfigRepository.save(cfg);
    }

    /**
     * 异步并行抓图：
     *  - 每个 enrich 走 ProductLinkPersistService（独立事务），失败 log + 继续
     *  - 6 个 future 并行，固定线程池避免占满 common ForkJoinPool
     *  - 总超时 60s（最坏 6 × 8s HttpClient timeout = 48s，留出余量）
     *  - 整体异步，启动主线程不阻塞；CLI runner 返回后图片在后台逐个补到 MixcutAsset
     */
    private void enrichImagesInBackground() {
        ExecutorService pool = Executors.newFixedThreadPool(
                Math.min(INITIAL_PRODUCTS.size(), 6),
                r -> {
                    Thread t = new Thread(r, "celebrity-seed-enrich");
                    t.setDaemon(true);
                    return t;
                });
        // 整段 future 单独跑一个守护线程，让 CLI runner 立即返回
        Thread monitor = new Thread(() -> {
            long started = System.currentTimeMillis();
            log.info("CelebrityProductSeeder: enrich images in background for {} products …",
                    INITIAL_PRODUCTS.size());
            try {
                CompletableFuture<?>[] futures = INITIAL_PRODUCTS.stream()
                        .map(s -> CompletableFuture.runAsync(() -> {
                            try {
                                int n = productLinkPersistService.enrichProductImages(s.id(), null);
                                if (n > 0) {
                                    log.info("CelebrityProductSeeder: enriched product {} +{} images", s.id(), n);
                                } else {
                                    log.warn("CelebrityProductSeeder: product {} got 0 images (link DOM may have changed)", s.id());
                                }
                            } catch (Exception e) {
                                log.warn("CelebrityProductSeeder: enrich {} failed err={}", s.id(), e.getMessage());
                            }
                        }, pool))
                        .toArray(CompletableFuture[]::new);
                CompletableFuture.allOf(futures).get(60, TimeUnit.SECONDS);
                log.info("CelebrityProductSeeder: enrich done in {} ms",
                        System.currentTimeMillis() - started);
            } catch (Exception e) {
                log.warn("CelebrityProductSeeder: enrich timed out or interrupted: {}",
                        e.getMessage());
            } finally {
                pool.shutdown();
            }
        }, "celebrity-seed-enrich-monitor");
        monitor.setDaemon(true);
        monitor.start();
    }
}
