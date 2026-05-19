package com.aistareco.aep.controller;

import com.aistareco.aep.dto.CreatePublishJobInputDto;
import com.aistareco.aep.dto.PublishJobDto;
import com.aistareco.aep.service.PublishJobService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 当前用户的发布任务 API。
 *
 * 路由：/api/me/publish-jobs/*
 * 需 JWT (AepSecurityConfig: /api/me/** authenticated)。
 *
 * Wire 见 specs/openapi.yaml 3.x social-distribution。
 */
@RestController
@RequestMapping("/api/me/publish-jobs")
public class PublishJobController {

    private final PublishJobService service;

    public PublishJobController(PublishJobService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<PublishJobDto>> list(Principal principal,
                                                   @RequestParam(value = "projectId", required = false) String projectId,
                                                   @RequestParam(value = "status", required = false) String status) {
        return ApiResponse.of(service.listForUser(principal.getName(), projectId, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<PublishJobDto> get(Principal principal, @PathVariable("id") String id) {
        return ApiResponse.of(service.get(principal.getName(), id));
    }

    @PostMapping
    public ApiResponse<List<PublishJobDto>> createBatch(Principal principal,
                                                          @RequestBody CreatePublishJobInputDto input) {
        return ApiResponse.of(service.createBatch(principal.getName(), input));
    }

    @PostMapping("/{id}/start")
    public ApiResponse<PublishJobDto> start(Principal principal, @PathVariable("id") String id) {
        return ApiResponse.of(service.startJob(principal.getName(), id));
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<PublishJobDto> cancel(Principal principal, @PathVariable("id") String id) {
        return ApiResponse.of(service.cancel(principal.getName(), id));
    }

    @PostMapping("/{id}/retry")
    public ApiResponse<PublishJobDto> retry(Principal principal, @PathVariable("id") String id) {
        return ApiResponse.of(service.retry(principal.getName(), id));
    }
}
