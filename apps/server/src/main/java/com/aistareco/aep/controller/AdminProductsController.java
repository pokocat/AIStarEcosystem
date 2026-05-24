package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.dto.ProductInputDto;
import com.aistareco.aep.dto.ProductLinkParseRequest;
import com.aistareco.aep.service.ProductLinkPersistService;
import com.aistareco.aep.service.ProductService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 商品库 admin 端管理（v0.31 起，所有写入与 LLM/链接解析全部收归此处，仅
 * SUPER_ADMIN / OPERATOR 可调）。
 *
 * 端点：
 *   GET    /api/admin/products                       — admin 列表（与 /api/products 共享 service）
 *   GET    /api/admin/products/{id}                  — admin 查单条
 *   POST   /api/admin/products                       — 新建商品
 *   PATCH  /api/admin/products/{id}                  — 编辑商品
 *   DELETE /api/admin/products/{id}                  — 删除商品
 *   POST   /api/admin/products/extract-selling-points — Mock LLM 卖点抽取（建档辅助）
 *   POST   /api/admin/products/from-link             — 抖音链接解析 + 落 Product + 登记图片素材
 *   POST   /api/admin/products/{id}/refresh-images   — 已存在商品的补图通道
 *
 * 普通用户读路径见 {@link ProductsController}（/api/products/**, authenticated 即可）。
 * 与用户侧共用同一 ProductService；权限门禁由 AepSecurityConfig.requestMatchers("/api/admin/**")
 * 的 hasAnyRole(SUPER_ADMIN, OPERATOR) 自动施加，controller 内无需再校验。
 */
@RestController
@RequestMapping("/api/admin/products")
public class AdminProductsController {

    private final ProductService service;
    private final ProductLinkPersistService persistService;

    public AdminProductsController(ProductService service,
                                   ProductLinkPersistService persistService) {
        this.service = service;
        this.persistService = persistService;
    }

    @GetMapping
    public ApiResponse<List<ProductDto>> list(@RequestParam(required = false) String category,
                                              @RequestParam(required = false) String q) {
        return ApiResponse.of(service.list(category, q));
    }

    @GetMapping("/{id}")
    public ApiResponse<ProductDto> get(@PathVariable String id) {
        return ApiResponse.of(service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProductDto> create(@RequestBody ProductInputDto input) {
        return ApiResponse.of(service.create(input));
    }

    @PatchMapping("/{id}")
    public ApiResponse<ProductDto> update(@PathVariable String id, @RequestBody ProductInputDto patch) {
        return ApiResponse.of(service.update(id, patch));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }

    /** Mock LLM 卖点抽取。 */
    @PostMapping("/extract-selling-points")
    public ApiResponse<Map<String, String>> extractSellingPoints(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "");
        String link = body.getOrDefault("link", "");
        String sellingPoints = service.extractSellingPoints(name, link);
        return ApiResponse.of(Map.of("sellingPoints", sellingPoints));
    }

    /**
     * 抖音链接解析 + 落 Product + 登记图片为 MixcutAsset(subkind=product-photo)。
     * Principal 是当前 admin 账号；userId 仅用于 MixcutAsset owner 标记（admin 自己名下，
     * 用户消费商品图走 product.images 快照 / 全局素材池，不按 owner 过滤）。
     */
    @PostMapping("/from-link")
    public ApiResponse<ProductDto> fromLink(@RequestBody ProductLinkParseRequest req,
                                            Principal principal) {
        String userId = principal == null ? null : principal.getName();
        return ApiResponse.of(persistService.parseAndPersist(req == null ? null : req.url(), userId));
    }

    /**
     * v0.28+ 给已存在商品「刷新图片」—— 重新走链接解析，回填 Product.images 快照 +
     * 登记新图片到 MixcutAsset(subkind=product-photo)。运营手动重试通道：
     *  - seeder 启动时异步抓图失败 / 部分失败
     *  - 抖音商品图 CDN URL 失效后想换一批
     *  - 用户手动建档时漏抓图
     *
     * 返回新增的 MixcutAsset 数量；解析失败 / 商品无 link / 商品不存在 → 0。
     * 注意：不会清掉旧的 MixcutAsset 行（避免同时被混剪任务引用时悬挂）；新图追加。
     */
    @PostMapping("/{id}/refresh-images")
    public ApiResponse<Map<String, Integer>> refreshImages(@PathVariable String id,
                                                           Principal principal) {
        String userId = principal == null ? null : principal.getName();
        int registered = persistService.enrichProductImages(id, userId);
        return ApiResponse.of(Map.of("registered", registered));
    }
}
