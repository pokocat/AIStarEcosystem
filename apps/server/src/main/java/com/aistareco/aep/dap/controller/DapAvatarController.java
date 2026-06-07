package com.aistareco.aep.dap.controller;

import com.aistareco.aep.dap.dto.DapDtos.AvatarDto;
import com.aistareco.aep.dap.dto.DapDtos.DerivativeDto;
import com.aistareco.aep.dap.dto.DapDtos.LookDto;
import com.aistareco.aep.dap.dto.DapDtos.TrashItemDto;
import com.aistareco.aep.dap.dto.DapDtos.VersionDto;
import com.aistareco.aep.dap.dto.DapRequests.BindVoiceRequest;
import com.aistareco.aep.dap.dto.DapRequests.CreateAvatarRequest;
import com.aistareco.aep.dap.dto.DapRequests.CreateDerivativeRequest;
import com.aistareco.aep.dap.dto.DapRequests.CreateLookRequest;
import com.aistareco.aep.dap.dto.DapRequests.DescribeRequest;
import com.aistareco.aep.dap.dto.DapRequests.FinalizeRequest;
import com.aistareco.aep.dap.dto.DapRequests.GenerateRequest;
import com.aistareco.aep.dap.dto.DapRequests.IterateRequest;
import com.aistareco.aep.dap.dto.DapRequests.PatchAvatarRequest;
import com.aistareco.aep.dap.dto.DapRequests.PickRequest;
import com.aistareco.aep.dap.service.DapAvatarService;
import com.aistareco.aep.dap.service.DapCatalogService;
import com.aistareco.aep.dap.service.DapTrashService;
import com.aistareco.aep.dap.service.DapVoiceService;
import com.aistareco.aep.dap.service.DapWorkflowService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 数字人资产平台 · Avatars（/api/v1/avatars/**，REST 面 = apps/web-aiavatar/src/proto/api.ts）。
 * 所有端点 authenticated（AepSecurityConfig /api/v1/**），principal.getName() = userId。
 */
@RestController
@RequestMapping("/api/v1/avatars")
public class DapAvatarController {

    private final DapAvatarService avatarService;
    private final DapWorkflowService workflow;
    private final DapVoiceService voiceService;
    private final DapCatalogService catalog;
    private final DapTrashService trashService;

    public DapAvatarController(DapAvatarService avatarService,
                               DapWorkflowService workflow,
                               DapVoiceService voiceService,
                               DapCatalogService catalog,
                               DapTrashService trashService) {
        this.avatarService = avatarService;
        this.workflow = workflow;
        this.voiceService = voiceService;
        this.catalog = catalog;
        this.trashService = trashService;
    }

    private static String uid(Principal p) {
        if (p == null) throw new BusinessException(org.springframework.http.HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        return p.getName();
    }

    // ── 列表 / 详情 / CRUD ─────────────────────────────────────

    @GetMapping
    public ApiResponse<List<?>> list(Principal principal,
                                     @RequestParam(defaultValue = "mine") String scope,
                                     @RequestParam(required = false) String path,
                                     @RequestParam(required = false) String status,
                                     @RequestParam(required = false) Boolean fav,
                                     @RequestParam(required = false) String q) {
        if ("public".equals(scope)) {
            return ApiResponse.of(catalog.publicAvatars());
        }
        return ApiResponse.of(avatarService.list(uid(principal), path, status, fav, q));
    }

    @PostMapping
    public ApiResponse<AvatarDto> create(Principal principal, @RequestBody CreateAvatarRequest req) {
        return ApiResponse.of(avatarService.create(uid(principal), req));
    }

    @GetMapping("/{id}")
    public ApiResponse<AvatarDto> get(Principal principal, @PathVariable String id) {
        return ApiResponse.of(avatarService.get(uid(principal), id));
    }

    @PatchMapping("/{id}")
    public ApiResponse<AvatarDto> patch(Principal principal, @PathVariable String id,
                                        @RequestBody PatchAvatarRequest req) {
        return ApiResponse.of(avatarService.patch(uid(principal), id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Map<String, Object>> remove(Principal principal, @PathVariable String id) {
        trashService.softDelete(uid(principal), id);
        return ApiResponse.of(Map.of(
                "deleted", true,
                "retentionDays", trashService.retentionDays()));
    }

    // ── 回收站（软删 → 恢复 / 彻底删除；30 天到期自动清理）─────

    @GetMapping("/trash")
    public ApiResponse<List<TrashItemDto>> trash(Principal principal) {
        return ApiResponse.of(trashService.listTrash(uid(principal)));
    }

    @PostMapping("/{id}/restore")
    public ApiResponse<AvatarDto> restore(Principal principal, @PathVariable String id) {
        trashService.restore(uid(principal), id);
        return ApiResponse.of(avatarService.get(uid(principal), id));
    }

    @DeleteMapping("/{id}/purge")
    public ApiResponse<Map<String, Object>> purge(Principal principal, @PathVariable String id) {
        trashService.purge(uid(principal), id);
        return ApiResponse.of(Map.of("purged", true));
    }

    // ── 版本 / 造型 / 衍生 ─────────────────────────────────────

    @GetMapping("/{id}/versions")
    public ApiResponse<List<VersionDto>> versions(Principal principal, @PathVariable String id) {
        return ApiResponse.of(avatarService.versions(uid(principal), id));
    }

    @GetMapping("/{id}/looks")
    public ApiResponse<List<LookDto>> looks(Principal principal, @PathVariable String id) {
        return ApiResponse.of(workflow.looks(uid(principal), id));
    }

    @PostMapping("/{id}/looks")
    public ApiResponse<LookDto> createLook(Principal principal, @PathVariable String id,
                                           @RequestBody CreateLookRequest req) {
        return ApiResponse.of(workflow.createLook(uid(principal), id, req));
    }

    @GetMapping("/{id}/derivatives")
    public ApiResponse<List<DerivativeDto>> derivatives(Principal principal, @PathVariable String id) {
        return ApiResponse.of(workflow.derivatives(uid(principal), id));
    }

    @PostMapping("/{id}/derivatives")
    public ApiResponse<Map<String, Object>> createDerivative(Principal principal, @PathVariable String id,
                                                             @RequestBody CreateDerivativeRequest req) {
        return ApiResponse.of(workflow.createDerivative(uid(principal), id, req.type(), req.templateId(), req.options()).toWire());
    }

    // ── 创建链路 ──────────────────────────────────────────────

    @PostMapping("/{id}/describe")
    public ApiResponse<Map<String, Object>> describe(Principal principal, @PathVariable String id,
                                                     @RequestBody DescribeRequest req) {
        return ApiResponse.of(workflow.describe(uid(principal), id, req));
    }

    @PostMapping("/{id}/photos")
    public ApiResponse<Map<String, Object>> photos(Principal principal, @PathVariable String id,
                                                   @RequestParam("files") List<MultipartFile> files) {
        return ApiResponse.of(avatarService.uploadPhotos(uid(principal), id, files));
    }

    @PostMapping("/{id}/generate")
    public ApiResponse<Map<String, Object>> generate(Principal principal, @PathVariable String id,
                                                     @RequestBody GenerateRequest req) {
        return ApiResponse.of(workflow.generate(uid(principal), id, req).toWire());
    }

    @PostMapping("/{id}/pick")
    public ApiResponse<AvatarDto> pick(Principal principal, @PathVariable String id,
                                       @RequestBody PickRequest req) {
        int idx = req.variantIndex() == null ? 0 : req.variantIndex();
        return ApiResponse.of(avatarService.pick(uid(principal), id, idx));
    }

    @PostMapping("/{id}/iterate")
    public ApiResponse<Map<String, Object>> iterate(Principal principal, @PathVariable String id,
                                                    @RequestBody IterateRequest req) {
        return ApiResponse.of(workflow.iterate(uid(principal), id, req).toWire());
    }

    @PostMapping("/{id}/warp")
    public ApiResponse<Map<String, Object>> warp(Principal principal, @PathVariable String id,
                                                 @RequestBody Map<String, Object> params) {
        return ApiResponse.of(workflow.warp(uid(principal), id, params).toWire());
    }

    // ── 端上精调（v0.52：浏览器实时美颜）─────────────────────

    /** 当前定妆图同源流式输出（owner 校验）。供前端画布取图，规避 CDN 跨域 canvas 污染。 */
    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> image(Principal principal, @PathVariable String id) {
        var img = avatarService.imageContent(uid(principal), id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, img.contentType())
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=0, no-store")
                .body(img.bytes());
    }

    /** 接收端上精调成品图 → 存储 / 切定妆图 / 记版本 / 登记已完成作业（零积分）。 */
    @PostMapping("/{id}/refine-apply")
    public ApiResponse<Map<String, Object>> refineApply(Principal principal, @PathVariable String id,
                                                        @RequestParam("file") MultipartFile file,
                                                        @RequestParam(value = "params", required = false) String params,
                                                        @RequestParam(value = "note", required = false) String note) {
        return ApiResponse.of(workflow.refineApply(uid(principal), id, file, params, note));
    }

    @PostMapping("/{id}/finalize")
    public ApiResponse<AvatarDto> finalizeAvatar(Principal principal, @PathVariable String id,
                                                 @RequestBody FinalizeRequest req) {
        boolean archive = req.archive() != null && req.archive();
        return ApiResponse.of(avatarService.finalizeAvatar(uid(principal), id,
                req.templateId(), req.confirmedShots(), archive));
    }

    @PostMapping("/{id}/voice")
    public ApiResponse<AvatarDto> bindVoice(Principal principal, @PathVariable String id,
                                            @RequestBody BindVoiceRequest req) {
        String name = req.voiceName() != null && !req.voiceName().isBlank() ? req.voiceName() : req.voiceId();
        return ApiResponse.of(avatarService.bindVoice(uid(principal), id, name));
    }
}
