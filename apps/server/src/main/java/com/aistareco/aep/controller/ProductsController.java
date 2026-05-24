package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.service.ProductService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 商品库只读端点（v0.31 起）：
 *   GET /api/products            — 列出全部 / 按类目 / 关键词搜索
 *   GET /api/products/{id}       — 查单条
 *
 * 写操作（create / update / delete / from-link / refresh-images /
 * extract-selling-points）一律落在 {@link AdminProductsController}（/api/admin/products/**）
 * 下，仅 SUPER_ADMIN / OPERATOR 可调。
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
}
