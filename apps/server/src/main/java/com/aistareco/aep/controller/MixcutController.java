package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MixcutCreateJobRequest;
import com.aistareco.aep.dto.MixcutRenderJobDto;
import com.aistareco.aep.dto.MixcutUpdateProgressRequest;
import com.aistareco.aep.service.mixcut.MixcutJobService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * Mixcut 混剪专区 REST API。前端 apps/web-celebrity/src/api/mixcut.ts 真后端分支。
 *
 * 路径对齐前端 USE_MOCK=0 时的 apiFetch 调用：
 *   GET    /api/mixcut/jobs                       → listJobs（仅当前用户）
 *   GET    /api/mixcut/jobs/{id}                  → getJob（仅当前用户）
 *   POST   /api/mixcut/jobs                       → createJob（user_id 强制取自 principal）
 *   PATCH  /api/mixcut/jobs/{id}/progress         → updateJobProgress（仅当前用户）
 *
 * v0.13.0+: 全部方法均接 Principal，service 层做 ownerUserId 校验，
 * 客户端发来的 user_id 字段被忽略（避免越权改他人 job）。
 */
@RestController
@RequestMapping("/api/mixcut")
public class MixcutController {

    private final MixcutJobService service;

    public MixcutController(MixcutJobService service) {
        this.service = service;
    }

    @GetMapping("/jobs")
    public ApiResponse<List<MixcutRenderJobDto>> listJobs(Principal principal) {
        return ApiResponse.of(service.listForUser(currentUserId(principal)));
    }

    @GetMapping("/jobs/{id}")
    public ApiResponse<MixcutRenderJobDto> getJob(@PathVariable String id, Principal principal) {
        return ApiResponse.of(service.getForUser(id, currentUserId(principal)).orElse(null));
    }

    @PostMapping("/jobs")
    public ApiResponse<MixcutRenderJobDto> createJob(
            @RequestBody MixcutCreateJobRequest req,
            Principal principal
    ) {
        return ApiResponse.of(service.create(req, currentUserId(principal)));
    }

    @PatchMapping("/jobs/{id}/progress")
    public ApiResponse<MixcutRenderJobDto> updateProgress(
            @PathVariable String id,
            @RequestBody MixcutUpdateProgressRequest req,
            Principal principal
    ) {
        return ApiResponse.of(service.updateProgressForUser(
                id, req.progress(), req.status(), currentUserId(principal)).orElse(null));
    }

    private static String currentUserId(Principal principal) {
        return principal == null ? null : principal.getName();
    }
}
