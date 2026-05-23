package com.aistareco.aep.service;

import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.dto.ProductInputDto;
import com.aistareco.aep.dto.ProductLinkInfoDto;
import com.aistareco.aep.service.mixcut.MixcutAssetService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public ProductLinkPersistService(ProductLinkService productLinkService,
                                     ProductService productService,
                                     MixcutAssetService mixcutAssetService) {
        this.productLinkService = productLinkService;
        this.productService = productService;
        this.mixcutAssetService = mixcutAssetService;
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
}
