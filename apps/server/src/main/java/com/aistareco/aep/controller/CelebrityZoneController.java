package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.service.CelebrityZoneService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 用户侧 AI 明星专区：/api/celebrity/*。
 * 字段与方法语义对齐前端 apps/web/src/api/celebrity-zone.ts。
 */
@RestController
@RequestMapping("/api/celebrity")
public class CelebrityZoneController {

    private final CelebrityZoneService service;

    public CelebrityZoneController(CelebrityZoneService service) {
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

    @GetMapping("/active-star")
    public ApiResponse<CelebrityStarDto> getActiveStar() {
        return ApiResponse.of(service.getActiveStar());
    }

    @GetMapping("/templates")
    public ApiResponse<List<CelebrityTemplateDto>> listTemplates() {
        return ApiResponse.of(service.listTemplates());
    }

    @GetMapping("/showcases")
    public ApiResponse<List<CelebrityShowcaseDto>> listShowcases(@RequestParam(required = false) String mode) {
        return ApiResponse.of(service.listShowcases(mode));
    }

    @GetMapping("/projects")
    public ApiResponse<List<CelebrityProjectDto>> listProjects(Principal principal,
                                                                @RequestParam(required = false) String status) {
        String userId = principal != null ? principal.getName() : "demo-user";
        return ApiResponse.of(service.listProjects(userId, status));
    }

    @PostMapping("/projects")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CelebrityProjectDto> createProject(Principal principal,
                                                           @RequestBody Map<String, String> body) {
        String userId = principal != null ? principal.getName() : "demo-user";
        String name = body.getOrDefault("name", "未命名项目");
        String starId = body.getOrDefault("starId", "");
        return ApiResponse.of(service.createProject(userId, name, starId));
    }

    @GetMapping("/projects/{id}")
    public ApiResponse<CelebrityProjectDto> getProject(Principal principal, @PathVariable String id) {
        String userId = principal != null ? principal.getName() : null;
        return ApiResponse.of(service.getProject(id, userId));
    }

    @GetMapping("/projects/{projectId}/videos")
    public ApiResponse<List<CelebrityProjectVideoDto>> listProjectVideos(@PathVariable String projectId) {
        return ApiResponse.of(service.listProjectVideos(projectId));
    }

    @PostMapping("/projects/{projectId}/distribute")
    @SuppressWarnings("unchecked")
    public ApiResponse<AsyncJobStartedDto> distribute(@PathVariable String projectId,
                                                       @RequestBody Map<String, Object> body) {
        Object videoIdsRaw = body.getOrDefault("videoIds", List.of());
        Object channelsRaw = body.getOrDefault("channels", List.of());
        List<String> videoIds = videoIdsRaw instanceof List<?> l ? (List<String>) l : List.of();
        List<String> channels = channelsRaw instanceof List<?> l ? (List<String>) l : List.of();
        return ApiResponse.of(service.batchDistribute(projectId, videoIds, channels));
    }

    @GetMapping("/videos")
    public ApiResponse<List<CelebrityProjectVideoDto>> listAllVideos(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String starId,
            @RequestParam(required = false) String projectId,
            @RequestParam(required = false) String sort) {
        return ApiResponse.of(service.listAllVideos(status, starId, projectId, sort));
    }

    @PostMapping("/generate")
    public ApiResponse<AsyncJobStartedDto> startGeneration(@RequestBody Map<String, Object> payload) {
        return ApiResponse.of(service.startGeneration(payload));
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
