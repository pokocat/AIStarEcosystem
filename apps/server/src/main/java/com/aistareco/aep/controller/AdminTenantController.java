package com.aistareco.aep.controller;

import com.aistareco.aep.dto.EntitlementDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.EntitlementService;
import com.aistareco.aep.service.TenantService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/admin/tenants")
public class AdminTenantController {

    private final TenantService tenantService;
    private final CreditService creditService;
    private final EntitlementService entitlementService;

    public AdminTenantController(
            TenantService tenantService,
            CreditService creditService,
            EntitlementService entitlementService
    ) {
        this.tenantService = tenantService;
        this.creditService = creditService;
        this.entitlementService = entitlementService;
    }

    @GetMapping
    public ApiResponse<PageEnvelope<TenantDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(tenantService.list(pageable)));
    }

    @GetMapping("/{id}")
    public ApiResponse<TenantDto> getById(@PathVariable String id) {
        return ApiResponse.of(tenantService.findById(id));
    }

    @GetMapping("/{id}/wallet")
    public ApiResponse<WalletDto> getWallet(@PathVariable String id) {
        return ApiResponse.of(creditService.findWalletByTenantId(id));
    }

    @GetMapping("/{id}/entitlements")
    public ApiResponse<List<EntitlementDto>> listEntitlements(@PathVariable String id) {
        return ApiResponse.of(entitlementService.listByTenant(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TenantDto> create(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(tenantService.create(body));
    }

    @PutMapping("/{id}")
    public ApiResponse<TenantDto> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(tenantService.update(id, body));
    }

    @PatchMapping("/{id}")
    public ApiResponse<TenantDto> patch(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(tenantService.update(id, body));
    }
}
