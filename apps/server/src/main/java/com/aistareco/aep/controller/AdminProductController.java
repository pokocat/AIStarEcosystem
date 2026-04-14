package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PlanDto;
import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.service.ProductService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminProductController {

    private final ProductService productService;

    public AdminProductController(ProductService productService) {
        this.productService = productService;
    }

    // --- Products ---

    @GetMapping("/products")
    public ApiResponse<List<ProductDto>> listProducts() {
        return ApiResponse.of(productService.listProducts());
    }

    @PostMapping("/products")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProductDto> createProduct(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(productService.createProduct(body));
    }

    @PutMapping("/products/{id}")
    public ApiResponse<ProductDto> updateProduct(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(productService.updateProduct(id, body));
    }

    // --- Plans ---

    @GetMapping("/plans")
    public ApiResponse<Page<PlanDto>> listPlans(
            @RequestParam(required = false) String productId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(productService.listPlans(productId, pageable));
    }

    @PostMapping("/plans")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PlanDto> createPlan(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(productService.createPlan(body));
    }

    @PutMapping("/plans/{id}")
    public ApiResponse<PlanDto> updatePlan(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(productService.updatePlan(id, body));
    }
}
