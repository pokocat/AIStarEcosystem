package com.aistareco.aep.config;

import com.aistareco.aep.dto.ProductInputDto;
import com.aistareco.aep.model.MixcutAsset;
import com.aistareco.aep.model.PlatformConfig;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.repository.MixcutAssetRepository;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.aistareco.aep.repository.ProductRepository;
import com.aistareco.aep.service.ProductService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

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

    public CelebrityProductSeeder(ProductRepository productRepository,
                                  ProductService productService,
                                  MixcutAssetRepository mixcutAssetRepository,
                                  PlatformConfigRepository platformConfigRepository) {
        this.productRepository = productRepository;
        this.productService = productService;
        this.mixcutAssetRepository = mixcutAssetRepository;
        this.platformConfigRepository = platformConfigRepository;
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
    @Transactional
    public void run(String... args) {
        var existingConfig = platformConfigRepository.findByConfigKey(CONFIG_KEY);
        String currentVersion = existingConfig
                .map(PlatformConfig::getValueJson)
                .orElse(null);

        if (SEED_VERSION.equals(currentVersion)) {
            log.debug("CelebrityProductSeeder: version {} already seeded, skip.", SEED_VERSION);
            return;
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
    }

    /**
     * 清空老数据：
     *  1. 先清掉所有 product 关联的 MixcutAsset 行（按 relatedProductId 命中）—— 避免商品被删后
     *     素材表里留下指向不存在 productId 的孤儿行；
     *  2. 再 deleteAll() product 表；
     *  3. MixcutRenderJob.productId 是软引用字符串（无 FK 约束），残留指向被删商品的 job 不动 ——
     *     下游 BatchPublishDrawer fetch product null 时优雅降级。
     */
    private void clearExistingData() {
        // 收集所有 relatedProductId 非空的 MixcutAsset，逐条删除
        // 因为无现成「按 productId 任意删」的 service 方法，直接用 repo
        for (Product p : productRepository.findAll()) {
            List<MixcutAsset> assets = mixcutAssetRepository.findByRelatedProductIdOrderByUploadedAtDesc(p.getId());
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
                        List.of(),               // images 留空；运营首次点「从链接解析」回填
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
}
