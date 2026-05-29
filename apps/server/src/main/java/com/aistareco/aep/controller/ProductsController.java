package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.service.ProductService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 商品库只读端点（v0.31 起）：
 *   GET  /api/products                         — 列出全部 / 按类目 / 关键词搜索
 *   GET  /api/products/{id}                    — 查单条
 *   POST /api/products/extract-selling-points  — 仅抽取卖点，不写库
 *
 * 写操作（create / update / delete / from-link / refresh-images /
 * 持久化卖点）一律落在 {@link AdminProductsController}（/api/admin/products/**）
 * 下，仅 SUPER_ADMIN / OPERATOR 可调；用户侧抽取只返回文本给当前创作流使用。
 *
 * v0.31 之前曾匿名暴露 CRUD，现 AepSecurityConfig 已将 /api/products/** 收口到
 * authenticated()：任意普通登录用户均可读，匿名访问会被 401 拦截。
 */
@RestController
@RequestMapping("/api/products")
public class ProductsController {

    private final ProductService service;

    public ProductsController(ProductService service) {
        this.service = service;
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

    /** 登录用户可用的只读 LLM 卖点抽取；不修改商品库。 */
    @PostMapping("/extract-selling-points")
    public ApiResponse<Map<String, String>> extractSellingPoints(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "");
        String link = body.getOrDefault("link", "");
        String sellingPoints = service.extractSellingPoints(name, link);
        return ApiResponse.of(Map.of("sellingPoints", sellingPoints));
    }
}
