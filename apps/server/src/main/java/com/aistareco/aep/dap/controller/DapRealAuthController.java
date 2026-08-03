package com.aistareco.aep.dap.controller;

import com.aistareco.aep.dap.dto.DapDtos.MaterialDto;
import com.aistareco.aep.dap.dto.DapDtos.RealAuthSessionDto;
import com.aistareco.aep.dap.dto.DapRequests.CreateRealAuthSessionRequest;
import com.aistareco.aep.dap.dto.DapRequests.SubmitMaterialRequest;
import com.aistareco.aep.dap.service.DapMaterialService;
import com.aistareco.aep.dap.service.DapRealAuthService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/**
 * 数字资产平台 · 真人授权（刷脸认证）+ 素材送审（/api/v1/real-auth/** 与 /api/v1/materials，v0.105）。
 *
 * <p>除 {@code GET /real-auth/callback}（浏览器刷脸回跳，无 JWT，见 AepSecurityConfig）外
 * 全部 authenticated；service 层按 ownerUserId 做归属校验。
 */
@RestController
@RequestMapping("/api/v1")
public class DapRealAuthController {

    private final DapRealAuthService realAuth;
    private final DapMaterialService materials;

    public DapRealAuthController(DapRealAuthService realAuth, DapMaterialService materials) {
        this.realAuth = realAuth;
        this.materials = materials;
    }

    private static String uid(Principal p) {
        if (p == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        return p.getName();
    }

    // ── 真人授权（刷脸认证）会话 ────────────────────────────────

    @PostMapping("/real-auth/sessions")
    public ApiResponse<RealAuthSessionDto> startSession(Principal principal,
                                                        @RequestBody CreateRealAuthSessionRequest req) {
        if (req == null || req.captureId() == null || req.captureId().isBlank()) {
            throw BusinessException.badRequest("DAP_CAPTURE_REQUIRED", "缺少捕获会话 id");
        }
        return ApiResponse.of(realAuth.start(uid(principal), req.captureId()));
    }

    @GetMapping("/real-auth/sessions/{id}")
    public ApiResponse<RealAuthSessionDto> session(Principal principal, @PathVariable String id) {
        return ApiResponse.of(realAuth.getSession(uid(principal), id));
    }

    /**
     * 刷脸完成后的浏览器回跳（permitAll）。上游按 {@code callback_url?bytedToken=..&resultCode=..}
     * 拼参数回跳，此时没有我们的 JWT —— 靠不可枚举的 {@code state}（= 会话 callbackToken）防伪。
     * 返回一张极简自包含 HTML 落地页；真正的生效判定由服务端轮询上游确认。
     */
    @GetMapping(value = "/real-auth/callback", produces = MediaType.TEXT_HTML_VALUE + ";charset=UTF-8")
    public ResponseEntity<String> callback(@RequestParam(required = false) String state,
                                           @RequestParam(required = false) String resultCode,
                                           @RequestParam(required = false) String bytedToken) {
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf(MediaType.TEXT_HTML_VALUE + ";charset=UTF-8"))
                .body(realAuth.handleCallback(state, resultCode, bytedToken));
    }

    // ── 素材送审 ───────────────────────────────────────────────

    @GetMapping("/materials")
    public ApiResponse<List<MaterialDto>> listMaterials(Principal principal,
                                                        @RequestParam String refType,
                                                        @RequestParam String refId) {
        return ApiResponse.of(materials.listByRef(uid(principal), refType, refId));
    }

    /**
     * 送审。refType=avatar → 定妆图送审（走平台 aigc 默认组）；
     * refType=capture → 重交该次捕获的素材（正常路径由 verify 自动送审）。
     */
    @PostMapping("/materials")
    public ApiResponse<List<MaterialDto>> submitMaterial(Principal principal,
                                                         @RequestBody SubmitMaterialRequest req) {
        String userId = uid(principal);
        String refType = req == null ? null : req.refType();
        String refId = req == null ? null : req.refId();
        if (refId == null || refId.isBlank()) {
            throw BusinessException.badRequest("DAP_MATERIAL_REF_REQUIRED", "缺少送审对象 id");
        }
        if ("avatar".equals(refType)) {
            return ApiResponse.of(List.of(materials.submitAvatarModeration(userId, refId)));
        }
        if ("capture".equals(refType)) {
            return ApiResponse.of(materials.resubmitForCapture(userId, refId));
        }
        throw BusinessException.badRequest("DAP_MATERIAL_BAD_REF", "未知送审对象类型：" + refType);
    }
}
