package com.aistareco.aep.controller;

import com.aistareco.aep.dto.EntitlementDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.service.EntitlementService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/entitlements")
public class AdminEntitlementController {

    private final EntitlementService entitlementService;

    public AdminEntitlementController(EntitlementService entitlementService) {
        this.entitlementService = entitlementService;
    }

    @GetMapping
    public ApiResponse<PageEnvelope<EntitlementDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String productId) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(entitlementService.list(tenantId, productId, pageable)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<EntitlementDto> create(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(entitlementService.create(body));
    }

    @PutMapping("/{id}")
    public ApiResponse<EntitlementDto> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(entitlementService.update(id, body));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable String id) {
        entitlementService.revoke(id);
    }
}
