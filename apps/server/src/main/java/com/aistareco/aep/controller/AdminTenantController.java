package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.service.TenantService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/tenants")
public class AdminTenantController {

    private final TenantService tenantService;

    public AdminTenantController(TenantService tenantService) {
        this.tenantService = tenantService;
    }

    @GetMapping
    public PageEnvelope<TenantDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        // page/size 是未校验入参；PageRequest.of 对 page<0 或 size<1 抛 IllegalArgumentException → 500。
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), 100);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return PageEnvelope.from(tenantService.list(pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<TenantDto> getById(@PathVariable String id) {
        return ApiResponse.of(tenantService.findById(id));
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
