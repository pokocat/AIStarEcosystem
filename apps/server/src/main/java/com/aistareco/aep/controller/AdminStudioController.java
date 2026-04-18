package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdminStudioDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.StudioDto;
import com.aistareco.aep.service.StudioService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 经纪公司 / 工作室 admin 接口。对齐前端 {@code apps/admin/src/api/studios.ts}。
 * 注：GET 返回 {@link AdminStudioDto}（含聚合指标），PUT 仅返回基础 {@link StudioDto}。
 */
@RestController
@RequestMapping("/api/admin/studios")
public class AdminStudioController {

    private final StudioService studioService;

    public AdminStudioController(StudioService studioService) {
        this.studioService = studioService;
    }

    @GetMapping
    public PageEnvelope<AdminStudioDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return PageEnvelope.from(studioService.listAdmin(pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminStudioDto> getById(@PathVariable String id) {
        return ApiResponse.of(studioService.findAdminById(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<StudioDto> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(studioService.update(id, body));
    }

    @PatchMapping("/{id}")
    public ApiResponse<StudioDto> patch(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(studioService.update(id, body));
    }
}
