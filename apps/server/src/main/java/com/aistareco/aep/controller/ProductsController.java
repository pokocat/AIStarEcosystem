package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.dto.ProductInputDto;
import com.aistareco.aep.service.ProductService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 用户侧商品库：/api/products/*。
 * 字段与方法语义对齐前端 apps/web/src/api/products.ts。
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

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProductDto> create(@RequestBody ProductInputDto input) {
        return ApiResponse.of(service.create(input));
    }

    @GetMapping("/{id}")
    public ApiResponse<ProductDto> get(@PathVariable String id) {
        return ApiResponse.of(service.get(id));
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

    /** 视频生成时调用，按 link/name 匹配已有商品 → +usageCount；找不到自动建档。 */
    @PostMapping("/upsert-from-generation")
    public ApiResponse<ProductDto> upsertFromGeneration(@RequestBody ProductInputDto input) {
        return ApiResponse.of(service.upsertFromGeneration(input));
    }

    /** Mock LLM 卖点抽取。 */
    @PostMapping("/extract-selling-points")
    public ApiResponse<Map<String, String>> extractSellingPoints(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "");
        String link = body.getOrDefault("link", "");
        String sellingPoints = service.extractSellingPoints(name, link);
        return ApiResponse.of(Map.of("sellingPoints", sellingPoints));
    }
}
