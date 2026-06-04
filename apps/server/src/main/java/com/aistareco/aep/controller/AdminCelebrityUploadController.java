package com.aistareco.aep.controller;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.service.storage.FileStorageService;
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

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * v0.34+：celebrity 明星档案 / 模板的图片上传通用入口。
 *
 * v0.49+：改走统一 {@link FileStorageService} → 文件落 OSS（key 前缀 {@code celebrity/<kind>}）。
 * 返回 {@code {url}} 给前端，前端把 URL 回填到 StarFormDialog / TemplateFormDialog 的
 * avatar / cover / preview 字段并落 CelebrityStar / CelebrityTemplate 的 URL 列。
 *
 * 注意：返回**未签名的稳定公开 URL**（{@code stored.url()}）而非时效签名 URL —— 因为它会被
 * 持久化进档案字段长期复用，签名会过期。头像/封面非高带宽盗刷目标，公开 URL 可接受；
 * 若日后要防盗刷，应改为档案字段存 cdnKey + 出 wire 时 signer 派生（§4.7.4）。
 *
 * 不写 MixcutAsset 表 —— 这些图片是「明星档案」附属字段，不参与混剪资产管理。
 */
@RestController
@RequestMapping("/api/admin/celebrity/uploads")
public class AdminCelebrityUploadController {

    private static final Logger log = LoggerFactory.getLogger(AdminCelebrityUploadController.class);

    private static final Set<String> ALLOWED_KINDS = Set.of("avatar", "cover", "preview", "photo", "video");
    private static final Set<String> IMAGE_MIME = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Set<String> VIDEO_MIME = Set.of(
            "video/mp4", "video/webm", "video/quicktime");

    private final MixcutProperties props;
    private final FileStorageService fileStorage;

    public AdminCelebrityUploadController(MixcutProperties props, FileStorageService fileStorage) {
        this.props = props;
        this.fileStorage = fileStorage;
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ApiResponse<Map<String, String>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "kind", defaultValue = "avatar") String kind
    ) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "FILE_EMPTY", "文件不能为空");
        }
        String safeKind = kind == null ? "avatar" : kind.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_KINDS.contains(safeKind)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "KIND_INVALID",
                    "kind 必须是 avatar/cover/preview/photo/video 之一");
        }
        boolean isVideo = "video".equals(safeKind) || "preview".equals(safeKind);
        validateMime(file.getContentType(), isVideo);

        long max = props.getMaxAssetBytes();
        if (max > 0 && file.getSize() > max) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE",
                    "文件超过最大限制 " + max + " 字节");
        }

        FileStorageService.StoredFile stored = fileStorage.store(file, "celebrity/" + safeKind, null);
        log.info("[celebrity-upload] {} → {} ({} bytes)", safeKind, stored.url(), file.getSize());
        return ApiResponse.of(Map.of("url", stored.url(), "kind", safeKind));
    }

    private void validateMime(String contentType, boolean isVideo) {
        if (contentType == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "MIME_MISSING", "缺少 Content-Type");
        }
        Set<String> allowed = isVideo ? VIDEO_MIME : IMAGE_MIME;
        if (!allowed.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "MIME_INVALID",
                    (isVideo ? "视频" : "图片") + "格式不支持: " + contentType);
        }
    }
}
