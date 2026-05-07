package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.dto.ProductInputDto;
import com.aistareco.aep.service.ProductService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin 侧商品库管理：/api/admin/products/*。
 * 与用户侧 ProductsController 共享同一 ProductService，但路径前缀走 /api/admin/，
 * 由 AepSecurityConfig 强制管理员角色（SUPER_ADMIN / OPERATOR）。
 */
@RestController
@RequestMapping("/api/admin/products")
public class AdminProductsController {

    private final ProductService service;

    public AdminProductsController(ProductService service) {
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
}
