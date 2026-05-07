package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.service.CelebrityZoneService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin 侧 AI 明星专区运营：/api/admin/celebrity/*。
 * 仅暴露读取 + 跨用户聚合视图；写操作（star 上下架 / 模板维护）后续按需补充。
 * 由 AepSecurityConfig 强制管理员角色（SUPER_ADMIN / OPERATOR）。
 */
@RestController
@RequestMapping("/api/admin/celebrity")
public class AdminCelebrityController {

    private final CelebrityZoneService service;

    public AdminCelebrityController(CelebrityZoneService service) {
        this.service = service;
    }

    @GetMapping("/stars")
    public ApiResponse<List<CelebrityStarDto>> listStars(@RequestParam(required = false) String category,
                                                          @RequestParam(required = false) String sort) {
        return ApiResponse.of(service.listStars(category, sort));
    }

    @GetMapping("/stars/{id}")
    public ApiResponse<CelebrityStarDto> getStar(@PathVariable String id) {
        return ApiResponse.of(service.getStar(id));
    }

    @GetMapping("/templates")
    public ApiResponse<List<CelebrityTemplateDto>> listTemplates() {
        return ApiResponse.of(service.listTemplates());
    }

    @GetMapping("/showcases")
    public ApiResponse<List<CelebrityShowcaseDto>> listShowcases(@RequestParam(required = false) String mode) {
        return ApiResponse.of(service.listShowcases(mode));
    }

    /** Admin 看到所有用户的项目（不按 ownerUserId 过滤）。 */
    @GetMapping("/projects")
    public ApiResponse<List<CelebrityProjectDto>> listProjects(@RequestParam(required = false) String status) {
        return ApiResponse.of(service.listAllProjects(status));
    }

    @GetMapping("/videos")
    public ApiResponse<List<CelebrityProjectVideoDto>> listAllVideos(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String starId,
            @RequestParam(required = false) String projectId,
            @RequestParam(required = false) String sort) {
        return ApiResponse.of(service.listAllVideos(status, starId, projectId, sort));
    }

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.of(service.getOverview());
    }

    @GetMapping("/engine-pricing")
    public ApiResponse<Map<String, EnginePricingDto>> enginePricing() {
        return ApiResponse.of(service.getEnginePricing());
    }
}
