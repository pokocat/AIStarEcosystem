package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MixcutCreateJobRequest;
import com.aistareco.aep.dto.MixcutRenderJobDto;
import com.aistareco.aep.dto.MixcutUpdateProgressRequest;
import com.aistareco.aep.service.mixcut.MixcutJobService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Mixcut 混剪专区 REST API。前端 apps/web-celebrity/src/api/mixcut.ts 真后端分支。
 *
 * 路径对齐前端 USE_MOCK=0 时的 apiFetch 调用：
 *   GET    /api/mixcut/jobs                       → listJobs
 *   GET    /api/mixcut/jobs/{id}                  → getJob
 *   POST   /api/mixcut/jobs                       → createJob（异步触发渲染）
 *   PATCH  /api/mixcut/jobs/{id}/progress         → updateJobProgress
 *
 * 注意：apiFetch 自动解包 ApiResponse.data，所以本 controller 返回 ApiResponse<T>，前端拿到 T。
 */
@RestController
@RequestMapping("/api/mixcut")
public class MixcutController {

    private final MixcutJobService service;

    public MixcutController(MixcutJobService service) {
        this.service = service;
    }

    @GetMapping("/jobs")
    public ApiResponse<List<MixcutRenderJobDto>> listJobs() {
        return ApiResponse.of(service.listAll());
    }

    @GetMapping("/jobs/{id}")
    public ApiResponse<MixcutRenderJobDto> getJob(@PathVariable String id) {
        return ApiResponse.of(service.get(id).orElse(null));
    }

    @PostMapping("/jobs")
    public ApiResponse<MixcutRenderJobDto> createJob(@RequestBody MixcutCreateJobRequest req) {
        return ApiResponse.of(service.create(req));
    }

    @PatchMapping("/jobs/{id}/progress")
    public ApiResponse<MixcutRenderJobDto> updateProgress(
            @PathVariable String id,
            @RequestBody MixcutUpdateProgressRequest req
    ) {
        return ApiResponse.of(service.updateProgress(id, req.progress(), req.status()).orElse(null));
    }
}
