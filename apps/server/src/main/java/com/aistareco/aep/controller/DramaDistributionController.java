package com.aistareco.aep.controller;

import com.aistareco.aep.dto.DramaPublishJobDto;
import com.aistareco.aep.service.DramaPublishService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 短剧分发发布任务端点（v0.45）：/api/distribution/jobs/**。
 *
 * 与遗留 {@link com.aistareco.controller.DistributionController}（同 /api/distribution 前缀，
 * 提供 platforms / content / platform-views / connections / publish）路径不重叠。
 *
 * ⚠️ /api/distribution/** 当前 permitAll（无强制认证）。已登录请求带 JWT → principal 非空；
 * 匿名访问回退到 demo 用户。生产硬化时应迁到 /api/me 前缀并强制认证。
 */
@RestController
@RequestMapping("/api/distribution")
public class DramaDistributionController {

    private static final String ANON = "demo-anon";

    private final DramaPublishService service;

    public DramaDistributionController(DramaPublishService service) {
        this.service = service;
    }

    @GetMapping("/jobs")
    public ApiResponse<List<DramaPublishJobDto>> listJobs(Principal principal,
                                                          @RequestParam(name = "projectId", required = false) String projectId) {
        return ApiResponse.of(service.listJobs(userId(principal), projectId));
    }

    @GetMapping("/jobs/{id}")
    public ApiResponse<DramaPublishJobDto> getJob(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.getJob(id, userId(principal)));
    }

    @PostMapping("/jobs")
    public ApiResponse<DramaPublishJobDto> createJob(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.createJob(body, userId(principal)));
    }

    @PostMapping("/jobs/{id}/retry")
    public ApiResponse<DramaPublishJobDto> retryJob(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.retryJob(id, userId(principal)));
    }

    @PostMapping("/jobs/{id}/cancel")
    public ApiResponse<DramaPublishJobDto> cancelJob(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.cancelJob(id, userId(principal)));
    }

    private static String userId(Principal principal) {
        return principal != null && principal.getName() != null ? principal.getName() : ANON;
    }
}
