package com.aistareco.aep.controller;

import com.aistareco.aep.service.DramaDistributionService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 短剧分发端点（v0.65）：平台目录/连接 + 发布任务。
 * /api/me/distribution/** → authenticated，按 principal 严格隔离归属。
 */
@RestController
@RequestMapping("/api/me/distribution")
public class DramaDistributionController {

    private final DramaDistributionService service;

    public DramaDistributionController(DramaDistributionService service) {
        this.service = service;
    }

    @GetMapping("/platforms")
    public ApiResponse<List<JsonNode>> platforms(Principal principal) {
        return ApiResponse.of(service.listPlatforms(principal.getName()));
    }

    @PostMapping("/platforms/{platformId}/connection")
    public ApiResponse<JsonNode> connect(Principal principal, @PathVariable String platformId) {
        return ApiResponse.of(service.connect(platformId, principal.getName()));
    }

    @DeleteMapping("/platforms/{platformId}/connection")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disconnect(Principal principal, @PathVariable String platformId) {
        service.disconnect(platformId, principal.getName());
    }

    @GetMapping("/jobs")
    public ApiResponse<List<JsonNode>> jobs(Principal principal,
                                            @RequestParam(required = false) String projectId) {
        return ApiResponse.of(service.listJobs(principal.getName(), projectId));
    }

    @GetMapping("/jobs/{id}")
    public ApiResponse<JsonNode> job(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.getJob(id, principal.getName()));
    }

    @PostMapping("/jobs")
    public ApiResponse<JsonNode> create(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.createJob(body, principal.getName()));
    }

    @PostMapping("/jobs/{id}/retry")
    public ApiResponse<JsonNode> retry(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.retryJob(id, principal.getName()));
    }

    @PostMapping("/jobs/{id}/cancel")
    public ApiResponse<JsonNode> cancel(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.cancelJob(id, principal.getName()));
    }
}
