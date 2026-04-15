package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PlanDto;
import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.security.AdminPrincipal;
import com.aistareco.aep.service.AdminAuditRecorder;
import com.aistareco.aep.service.ProductService;
import com.aistareco.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminProductController {

    private final ProductService productService;
    private final AdminAuditRecorder auditRecorder;

    public AdminProductController(ProductService productService, AdminAuditRecorder auditRecorder) {
        this.productService = productService;
        this.auditRecorder = auditRecorder;
    }

    // --- Products ---

    @GetMapping("/products")
    public ApiResponse<List<ProductDto>> listProducts() {
        return ApiResponse.of(productService.listProducts());
    }

    @PostMapping("/products")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProductDto> createProduct(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        ProductDto product = productService.createProduct(body);
        auditRecorder.success(principal, request, "product.create", "product", product.id(), "创建产品");
        return ApiResponse.of(product);
    }

    @PutMapping("/products/{id}")
    public ApiResponse<ProductDto> updateProduct(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        ProductDto product = productService.updateProduct(id, body);
        auditRecorder.success(principal, request, "product.update", "product", id, "更新产品");
        return ApiResponse.of(product);
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
    public ApiResponse<PlanDto> createPlan(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        PlanDto plan = productService.createPlan(body);
        auditRecorder.success(principal, request, "plan.create", "plan", plan.id(), "创建套餐");
        return ApiResponse.of(plan);
    }

    @PutMapping("/plans/{id}")
    public ApiResponse<PlanDto> updatePlan(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        PlanDto plan = productService.updatePlan(id, body);
        auditRecorder.success(principal, request, "plan.update", "plan", id, "更新套餐");
        return ApiResponse.of(plan);
    }
}
