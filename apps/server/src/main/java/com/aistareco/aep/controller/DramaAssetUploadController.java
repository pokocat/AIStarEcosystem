package com.aistareco.aep.controller;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * v0.89：短剧素材库上传 —— 角色 / 场景「上传参考图」入口。
 *
 * 用户在「短剧设定 · 角色与场景」上传真人剧照 / 场景参考图，文件经统一
 * {@link FileStorageService} → OSS（key 前缀 {@code drama/asset-refs/<cat>}），
 * 返回 key + 未签名稳定 URL：前端把它落到角色 / 场景的 refCdnKey/refUrl，
 * 并把这张图收进用户自己的素材库。仅图片、限大小、需登录。
 */
@RestController
@RequestMapping("/api/me/drama/assets/uploads")
public class DramaAssetUploadController {

    private static final Logger log = LoggerFactory.getLogger(DramaAssetUploadController.class);

    private static final Set<String> ALLOWED_CATS = Set.of("人物", "场景", "道具", "其他");
    private static final Set<String> IMAGE_MIME = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif");

    private final MixcutProperties props;
    private final FileStorageService fileStorage;
    private final StorageQuotaService storage;

    public DramaAssetUploadController(MixcutProperties props, FileStorageService fileStorage, StorageQuotaService storage) {
        this.props = props;
        this.fileStorage = fileStorage;
        this.storage = storage;
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ApiResponse<Map<String, String>> upload(
            Principal principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "cat", defaultValue = "其他") String cat
    ) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "FILE_EMPTY", "文件不能为空");
        }
        String safeCat = cat == null || cat.isBlank() ? "其他" : cat.trim();
        if (!ALLOWED_CATS.contains(safeCat)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CAT_INVALID", "类型必须是 人物/场景/道具/其他 之一");
        }
        String contentType = file.getContentType();
        if (contentType == null || !IMAGE_MIME.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "MIME_INVALID", "图片格式不支持: " + contentType);
        }
        long max = props.getMaxAssetBytes();
        if (max > 0 && file.getSize() > max) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE",
                    "文件超过最大限制 " + max + " 字节");
        }
        // 存储配额前置：已知本次文件大小，超额直接拒绝（不写文件、不记账）。
        storage.checkQuota("drama", principal.getName(), file.getSize());

        FileStorageService.StoredFile stored = fileStorage.store(file, "drama/asset-refs", principal.getName());
        // 记入存储用量（参考图素材，用户级；best-effort 不阻断）
        storage.record("drama", principal.getName(), "参考图素材", null, stored.key(), stored.bytes());
        String name = file.getOriginalFilename();
        log.info("[drama-asset-upload] user={} cat={} → {} ({} bytes)",
                principal.getName(), safeCat, stored.key(), file.getSize());
        return ApiResponse.of(Map.of(
                "cdnKey", stored.key(),
                "url", stored.url(),
                "cat", safeCat,
                "name", name != null && !name.isBlank() ? name : "参考图"
        ));
    }
}
