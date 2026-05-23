package com.aistareco.aep.service;

import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.dto.ProductInputDto;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.repository.ProductRepository;
import com.aistareco.common.BusinessException;
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

    private final ProductRepository repo;

    public ProductService(ProductRepository repo) {
        this.repo = repo;
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
     * 视频生成时调用：按 link/name 匹配已有商品 → +usageCount；找不到则自动建档（source=auto-from-generation）。
     * 与 apps/web/src/api/products.ts:upsertFromGeneration 行为一致。
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

    /**
     * Mock LLM 卖点抽取：根据商品名 + 链接产出一段固定模板的卖点。
     * 与前端 mock 行为一致（apps/web/src/api/products.ts:extractSellingPoints）。
     */
    public String extractSellingPoints(String name, String link) {
        if (name == null) name = "";
        String trimmed = name.trim();
        return trimmed + "：精选优质原料，工艺细节考究；上身/上脸效果显著，"
                + "用户好评 95%+。日常通勤 / 节日送礼 / 自用囤货皆宜，下单立享平台保障。";
    }

    private static boolean blank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static String nextId() {
        return "prod-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
