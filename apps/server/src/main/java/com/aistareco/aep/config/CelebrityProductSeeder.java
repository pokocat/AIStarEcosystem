package com.aistareco.aep.config;

import com.aistareco.aep.dto.ProductInputDto;
import com.aistareco.aep.repository.ProductRepository;
import com.aistareco.aep.service.ProductService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * v0.26+ 选品表格初始数据 seed。
 *
 * 当 product 表为空时种这 6 条用户提供的抖音商城选品商品。
 * 启动后页面就有样例可点「生成视频」走通整链路；运营自己录入后表非空 → 跳过种子。
 *
 * 仅 Product 行，**不**调 ProductLinkPersistService 抓图片（避免启动时打外网）。
 * 运营首次访问后台后，可在前端逐条点「📋 从抖音链接解析」回填 images + MixcutAsset。
 */
@Component
@Order(30)
public class CelebrityProductSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CelebrityProductSeeder.class);

    private final ProductRepository productRepository;
    private final ProductService productService;

    public CelebrityProductSeeder(ProductRepository productRepository, ProductService productService) {
        this.productRepository = productRepository;
        this.productService = productService;
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
        long existing = productRepository.count();
        if (existing > 0) {
            log.debug("CelebrityProductSeeder: products already present (count={}), skip.", existing);
            return;
        }
        log.info("CelebrityProductSeeder: seeding {} initial products …", INITIAL_PRODUCTS.size());
        int created = 0;
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
                created++;
            } catch (Exception e) {
                log.warn("CelebrityProductSeeder: seed failed for id={} err={}", s.id(), e.getMessage());
            }
        }
        log.info("CelebrityProductSeeder: seeded {} products.", created);
    }
}
