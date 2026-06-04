package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MixcutDraftDto;
import com.aistareco.aep.dto.MixcutDraftUpsertRequest;
import com.aistareco.aep.dto.MixcutRenderJobDto;
import com.aistareco.aep.dto.MixcutRerunJobRequest;
import com.aistareco.aep.service.mixcut.MixcutDraftService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 混剪「实例 / 草稿」REST API（v0.48+）。前端 apps/web-celebrity/src/api/mixcut.ts 真后端分支。
 *
 * 路径（全部 authenticated，service 层按 principal 做 owner 校验）：
 *   GET    /api/mixcut/drafts                → 当前用户实例列表
 *   GET    /api/mixcut/drafts/{id}           → 取单个实例
 *   POST   /api/mixcut/drafts                → 新建实例（id 可前端预生成）
 *   PUT    /api/mixcut/drafts/{id}           → 更新实例（保存填充进度）
 *   DELETE /api/mixcut/drafts/{id}           → 删除实例
 *   POST   /api/mixcut/drafts/{id}/generate  → 从实例生成任务（body 可空，仅 variants/profile 可覆盖）
 *                                              409 MISSING_ASSETS 同 rerun
 */
@RestController
@RequestMapping("/api/mixcut/drafts")
public class MixcutDraftController {

    private final MixcutDraftService service;

    public MixcutDraftController(MixcutDraftService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<MixcutDraftDto>> list(Principal principal) {
        return ApiResponse.of(service.listForUser(currentUserId(principal)));
    }

    @GetMapping("/{id}")
    public ApiResponse<MixcutDraftDto> get(@PathVariable String id, Principal principal) {
        return ApiResponse.of(service.getForUser(id, currentUserId(principal)).orElse(null));
    }

    @PostMapping
    public ApiResponse<MixcutDraftDto> create(
            @RequestBody MixcutDraftUpsertRequest req,
            Principal principal
    ) {
        return ApiResponse.of(service.upsert(req, null, currentUserId(principal)));
    }

    @PutMapping("/{id}")
    public ApiResponse<MixcutDraftDto> update(
            @PathVariable String id,
            @RequestBody MixcutDraftUpsertRequest req,
            Principal principal
    ) {
        return ApiResponse.of(service.upsert(req, id, currentUserId(principal)));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@PathVariable String id, Principal principal) {
        return ApiResponse.of(service.deleteForUser(id, currentUserId(principal)));
    }

    @PostMapping("/{id}/generate")
    public ApiResponse<MixcutRenderJobDto> generate(
            @PathVariable String id,
            @RequestBody(required = false) MixcutRerunJobRequest body,
            Principal principal
    ) {
        return ApiResponse.of(service.generate(id, currentUserId(principal), body));
    }

    private static String currentUserId(Principal principal) {
        return principal == null ? null : principal.getName();
    }
}
