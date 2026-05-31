package com.aistareco.aep.aiavatar.controller;

import com.aistareco.aep.aiavatar.dto.AiAvatarAssetDto;
import com.aistareco.aep.aiavatar.dto.AiAvatarSourceMaterialDto;
import com.aistareco.aep.aiavatar.model.AiAvatarAsset;
import com.aistareco.aep.aiavatar.model.AiAvatarAssetKind;
import com.aistareco.aep.aiavatar.model.AiAvatarSourceMaterial;
import com.aistareco.aep.aiavatar.service.AiAvatarAssetService;
import com.aistareco.aep.aiavatar.service.AiAvatarService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;

/**
 * 资产上传 / 下载 API（/api/me/aiavatar/assets）。
 *
 * - 普通图片上传（参考图 / 几何形变结果回传）
 * - 真人原始照片上传（加密存储）+ 触发合规检测
 * - 加密原始照片解密下载（owner 校验）
 */
@RestController
@RequestMapping("/api/me/aiavatar")
public class AiAvatarAssetController {

    private final AiAvatarAssetService assetService;
    private final AiAvatarService avatarService;

    public AiAvatarAssetController(AiAvatarAssetService assetService, AiAvatarService avatarService) {
        this.assetService = assetService;
        this.avatarService = avatarService;
    }

    private static String uid(Principal p) {
        if (p == null) throw BusinessException.notFound("UNAUTHORIZED", "未登录");
        return p.getName();
    }

    /** 普通图片上传（multipart）。kind 默认 reference_image。 */
    @PostMapping(path = "/assets", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AiAvatarAssetDto> upload(@RequestParam("file") MultipartFile file,
                                          @RequestParam(required = false) String avatarId,
                                          @RequestParam(required = false) String kind,
                                          Principal principal) {
        AiAvatarAssetKind k = kind == null ? AiAvatarAssetKind.REFERENCE_IMAGE : AiAvatarAssetKind.fromWire(kind);
        AiAvatarAsset a = assetService.uploadImage(uid(principal), avatarId, k, file);
        return ApiResponse.of(assetService.toDto(a));
    }

    /** 真人原始照片上传（加密）+ 合规检测。 */
    @PostMapping(path = "/avatars/{avatarId}/source-photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AiAvatarSourceMaterial> uploadSourcePhoto(@PathVariable String avatarId,
                                                           @RequestParam("file") MultipartFile file,
                                                           @RequestParam(required = false, defaultValue = "true") boolean faceCheck,
                                                           Principal principal) {
        return ApiResponse.of(avatarService.addSourcePhoto(avatarId, uid(principal), file, faceCheck));
    }

    /** 解密下载原始照片（owner 校验）。 */
    @GetMapping("/assets/{assetId}/raw")
    public ResponseEntity<byte[]> rawPhoto(@PathVariable String assetId, Principal principal) {
        AiAvatarAsset a = assetService.requireOwned(assetId, uid(principal));
        byte[] data = assetService.decryptSourcePhoto(assetId, uid(principal));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, a.getMimeType() == null ? "image/png" : a.getMimeType())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(data);
    }

    @GetMapping("/avatars/{avatarId}/assets")
    public ApiResponse<java.util.List<AiAvatarAssetDto>> listAssets(@PathVariable String avatarId, Principal principal) {
        avatarService.requireOwned(avatarId, uid(principal));
        return ApiResponse.of(assetService.listForAvatar(avatarId));
    }
}
