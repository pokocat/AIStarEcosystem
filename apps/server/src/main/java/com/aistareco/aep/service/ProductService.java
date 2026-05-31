package com.aistareco.aep.service;

import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.dto.ProductInputDto;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.repository.ProductRepository;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 商品库领域服务（v2.7）。
 * 字段与方法语义对齐前端 apps/web/src/api/products.ts。
 */
@Service
@Transactional
public class ProductService {

    private static final Logger log = LoggerFactory.getLogger(ProductService.class);

    private final ProductRepository repo;
    private final MaterialAiService materialAi;

    public ProductService(ProductRepository repo, MaterialAiService materialAi) {
        this.repo = repo;
        this.materialAi = materialAi;
    }

    public List<ProductDto> list(String category, String q) {
        List<Product> rows = (category == null || category.isBlank() || "全部".equals(category))
                ? repo.findAllByOrderByUpdatedAtDesc()
                : repo.findByCategoryOrderByUpdatedAtDesc(category);
        if (q != null && !q.isBlank()) {
            String needle = q.trim().toLowerCase();
            rows = rows.stream().filter(p ->
                    (p.getName() != null && p.getName().toLowerCase().contains(needle))
                            || (p.getSellingPoints() != null && p.getSellingPoints().toLowerCase().contains(needle))
            ).toList();
        }
        return rows.stream().map(ProductDto::from).toList();
    }

    public ProductDto get(String id) {
        return repo.findById(id).map(ProductDto::from).orElse(null);
    }

    public ProductDto create(ProductInputDto input) {
        if (input == null || input.name() == null || input.name().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PRODUCT_NAME_REQUIRED", "商品名称不能为空");
        }
        if (input.category() == null || input.category().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PRODUCT_CATEGORY_REQUIRED", "商品类目不能为空");
        }
        LocalDate today = LocalDate.now();
        Product p = Product.builder()
                .id(nextId())
                .name(input.name().trim())
                .category(input.category())
                .link(blank(input.link()) ? null : input.link().trim())
                .images(input.images() == null ? new ArrayList<>() : new ArrayList<>(input.images()))
                .sellingPoints(input.sellingPoints() == null ? "" : input.sellingPoints().trim())
                .usageCount(0)
                .source(input.source() != null && !input.source().isBlank() ? input.source() : "manual")
                .priceCents(input.priceCents())
                .commissionRate(input.commissionRate())
                .createdAt(today)
                .updatedAt(today)
                .build();
        return ProductDto.from(repo.save(p));
    }

    /**
     * 同 create，但允许调用方指定 id（用于商品库链接解析时把抖音商品ID直接作为主键，
     * 以及 DataInitializer seed 时保留可读 id）。
     */
    public ProductDto createWithId(String forcedId, ProductInputDto input) {
        if (forcedId == null || forcedId.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PRODUCT_ID_REQUIRED", "商品 id 不能为空");
        }
        if (input == null || input.name() == null || input.name().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PRODUCT_NAME_REQUIRED", "商品名称不能为空");
        }
        if (input.category() == null || input.category().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PRODUCT_CATEGORY_REQUIRED", "商品类目不能为空");
        }
        LocalDate today = LocalDate.now();
        Product p = Product.builder()
                .id(forcedId)
                .name(input.name().trim())
                .category(input.category())
                .link(blank(input.link()) ? null : input.link().trim())
                .images(input.images() == null ? new ArrayList<>() : new ArrayList<>(input.images()))
                .sellingPoints(input.sellingPoints() == null ? "" : input.sellingPoints().trim())
                .usageCount(0)
                .source(input.source() != null && !input.source().isBlank() ? input.source() : "manual")
                .priceCents(input.priceCents())
                .commissionRate(input.commissionRate())
                .createdAt(today)
                .updatedAt(today)
                .build();
        return ProductDto.from(repo.save(p));
    }

    public ProductDto update(String id, ProductInputDto patch) {
        Product p = repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "商品不存在"));
        if (patch.name() != null && !patch.name().isBlank()) p.setName(patch.name().trim());
        if (patch.category() != null && !patch.category().isBlank()) p.setCategory(patch.category());
        if (patch.link() != null) p.setLink(blank(patch.link()) ? null : patch.link().trim());
        if (patch.images() != null) p.setImages(new ArrayList<>(patch.images()));
        if (patch.sellingPoints() != null) p.setSellingPoints(patch.sellingPoints().trim());
        if (patch.source() != null && !patch.source().isBlank()) p.setSource(patch.source());
        if (patch.priceCents() != null) p.setPriceCents(patch.priceCents());
        if (patch.commissionRate() != null) p.setCommissionRate(patch.commissionRate());
        p.setUpdatedAt(LocalDate.now());
        return ProductDto.from(repo.save(p));
    }

    public void delete(String id) {
        if (!repo.existsById(id)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "商品不存在");
        }
        repo.deleteById(id);
    }

    /**
     * v0.31：视频生成时按 productId 直接 +usageCount。MixcutJobService.createInternal
     * 在事务内调用 —— 用户混剪带商品时直接拿到 id 引用，无需 link/name 模糊匹配。
     * 找不到返回 null，调用方应包 try/catch（业务路径不阻断）。
     */
    public ProductDto bumpUsageCountByProductId(String productId) {
        if (blank(productId)) return null;
        Product existing = repo.findById(productId).orElse(null);
        if (existing == null) return null;
        existing.setUsageCount(existing.getUsageCount() + 1);
        existing.setUpdatedAt(LocalDate.now());
        return ProductDto.from(repo.save(existing));
    }

    /**
     * v0.31：视频生成时由 MixcutJobService 内部调用 —— 仅按 link/name 匹配已存在
     * 商品并 +usageCount，找不到不创建。商品库自 v0.31 起改为「公共池 + admin 写」，
     * 普通用户不可往池中灌入名字。返回匹配到的 ProductDto；未匹配返回 null。
     */
    public ProductDto bumpUsageCountByLinkOrName(String link, String name) {
        String trimmedLink = blank(link) ? null : link.trim();
        String trimmedName = blank(name) ? null : name.trim();
        if (trimmedLink == null && trimmedName == null) {
            return null;
        }
        Product existing = null;
        if (trimmedLink != null) {
            existing = repo.findFirstByLink(trimmedLink).orElse(null);
        }
        if (existing == null && trimmedName != null) {
            existing = repo.findFirstByNameIgnoreCase(trimmedName).orElse(null);
        }
        if (existing == null) {
            return null;
        }
        existing.setUsageCount(existing.getUsageCount() + 1);
        existing.setUpdatedAt(LocalDate.now());
        return ProductDto.from(repo.save(existing));
    }

    /**
     * 视频生成时调用：按 link/name 匹配已有商品 → +usageCount；找不到则自动建档（source=auto-from-generation）。
     * 与 apps/web/src/api/products.ts:upsertFromGeneration 行为一致。
     *
     * v0.31 起前端不再直接调用此入口（普通用户不可往公共池里灌名字），仅 admin 流程
     * 内部复用「找不到则建档」语义。普通用户生成视频走 {@link #bumpUsageCountByLinkOrName}。
     */
    public ProductDto upsertFromGeneration(ProductInputDto input) {
        if (input == null || input.name() == null || input.name().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PRODUCT_NAME_REQUIRED", "商品名称不能为空");
        }
        String name = input.name().trim();
        String link = blank(input.link()) ? null : input.link().trim();

        Product existing = null;
        if (link != null) {
            existing = repo.findFirstByLink(link).orElse(null);
        }
        if (existing == null) {
            existing = repo.findFirstByNameIgnoreCase(name).orElse(null);
        }
        if (existing != null) {
            existing.setUsageCount(existing.getUsageCount() + 1);
            existing.setUpdatedAt(LocalDate.now());
            return ProductDto.from(repo.save(existing));
        }
        ProductInputDto created = new ProductInputDto(
                name,
                input.category() == null ? "其他" : input.category(),
                link,
                input.images(),
                input.sellingPoints(),
                "auto-from-generation",
                input.priceCents(),
                input.commissionRate()
        );
        return create(created);
    }

    /** 卖点抽取：真 LLM（MaterialAiService → invokeChat，purpose=SELLING_POINTS），失败直接透出配置/调用错误。 */
    public String extractSellingPoints(String name, String link) {
        String points = materialAi.extractSellingPoints(name, link);
        log.info("[products] AI 卖点抽取成功 namePresent={} linkPresent={} pointsLength={}",
                !blank(name), !blank(link), points == null ? 0 : points.length());
        return points;
    }

    private static boolean blank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static String nextId() {
        return "prod-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
