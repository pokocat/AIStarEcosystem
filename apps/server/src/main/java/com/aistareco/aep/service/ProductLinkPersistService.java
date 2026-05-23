package com.aistareco.aep.service;

import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.dto.ProductInputDto;
import com.aistareco.aep.dto.ProductLinkInfoDto;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.repository.ProductRepository;
import com.aistareco.aep.service.mixcut.MixcutAssetService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 把「从链接解析」串联成「Product 落库 + 图片素材统一登记到 MixcutAsset」。
 *
 * 调用链：parse(url) → ProductService.create → 遍历 imageUrls → MixcutAssetService.registerExternalUrl
 *
 * 单事务：解析失败 / Product 创建失败 → 不落任何 MixcutAsset 行。
 * 图片登记单条失败：log 警告但**不回滚**整体（图片不全比完全失败要好）。
 *
 * 重复链接：调用方应在调本服务前用 ProductService.upsertFromGeneration 或自行去重；本服务每次都创建新 Product。
 */
@Service
public class ProductLinkPersistService {

    private static final Logger log = LoggerFactory.getLogger(ProductLinkPersistService.class);

    private final ProductLinkService productLinkService;
    private final ProductService productService;
    private final MixcutAssetService mixcutAssetService;
    private final ProductRepository productRepository;

    public ProductLinkPersistService(ProductLinkService productLinkService,
                                     ProductService productService,
                                     MixcutAssetService mixcutAssetService,
                                     ProductRepository productRepository) {
        this.productLinkService = productLinkService;
        this.productService = productService;
        this.mixcutAssetService = mixcutAssetService;
        this.productRepository = productRepository;
    }

    @Transactional
    public ProductDto parseAndPersist(String url, String userId) {
        ProductLinkInfoDto info = productLinkService.parse(url);

        ProductInputDto input = new ProductInputDto(
                info.title() == null || info.title().isBlank() ? "未命名商品" : info.title(),
                "日用百货",                              // 默认类目；用户后续可改
                url,
                info.imageUrls(),
                info.inferredSellingPoints(),
                "manual",
                info.minPriceCents(),
                null                                    // 链接解析拿不到佣金率
        );
        ProductDto product = productService.create(input);

        // 把解析出的图片 URL 同步登记到 MixcutAsset（统一素材体系）
        List<String> imgs = info.imageUrls();
        if (imgs != null) {
            for (String imgUrl : imgs) {
                try {
                    mixcutAssetService.registerExternalUrl(userId, "image", "product-photo",
                            imgUrl, product.id());
                } catch (Exception e) {
                    log.warn("[product-link] register image asset failed url={} err={}",
                            imgUrl, e.getMessage());
                }
            }
        }
        log.info("[product-link] parseAndPersist done productId={} title={} images={}",
                product.id(), product.name(), imgs == null ? 0 : imgs.size());
        return product;
    }

    /**
     * v0.28+ 给已存在的 Product 异步「补图」—— seed 时调用，或运营手动点「刷新图片」时调用。
     * 流程：取 Product.link → ProductLinkService.parse → 取 imageUrls → 写回
     *  - Product.images snapshot
     *  - 逐个登记到 MixcutAsset(subkind="product-photo", relatedProductId=productId)
     *
     * 返回注册成功的 MixcutAsset 数量；解析失败 / 链接为空 / 无图 → 返回 0。
     * 调用方应包 try/catch；单个失败不影响业务主流程。
     */
    @Transactional
    public int enrichProductImages(String productId, String userId) {
        if (productId == null || productId.isBlank()) return 0;
        Product p = productRepository.findById(productId).orElse(null);
        if (p == null) {
            log.warn("[product-link] enrich: product not found id={}", productId);
            return 0;
        }
        if (p.getLink() == null || p.getLink().isBlank()) {
            log.debug("[product-link] enrich: product {} has no link, skip", productId);
            return 0;
        }
        ProductLinkInfoDto info;
        try {
            info = productLinkService.parse(p.getLink());
        } catch (Exception e) {
            log.warn("[product-link] enrich parse failed productId={} link={} err={}",
                    productId, p.getLink(), e.getMessage());
            return 0;
        }
        List<String> imgs = info.imageUrls();
        if (imgs == null || imgs.isEmpty()) {
            log.debug("[product-link] enrich: product {} parser returned 0 images", productId);
            return 0;
        }
        // 回填 Product.images 快照（保留向后兼容路径）
        p.setImages(new ArrayList<>(imgs));
        p.setUpdatedAt(LocalDate.now());
        productRepository.save(p);
        // 登记到 MixcutAsset（统一素材体系）
        int registered = 0;
        for (String url : imgs) {
            try {
                mixcutAssetService.registerExternalUrl(userId, "image", "product-photo", url, productId);
                registered++;
            } catch (Exception e) {
                log.warn("[product-link] enrich asset register failed url={} err={}", url, e.getMessage());
            }
        }
        log.info("[product-link] enrich done productId={} images={} registered={}",
                productId, imgs.size(), registered);
        return registered;
    }
}
