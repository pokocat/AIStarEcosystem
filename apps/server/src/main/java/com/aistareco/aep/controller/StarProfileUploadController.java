package com.aistareco.aep.controller;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.service.StarWorkbenchService;
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

import java.security.Principal;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * v0.62：明星商务工作台档案图片上传（avatar / cover）。
 *
 * 档案编辑从 admin 移入 star 端后，明星 / 经纪团队需要自助上传头像与封面。
 * 与 {@link AdminCelebrityUploadController} 同构：走统一 {@link FileStorageService}
 * → OSS（key 前缀 {@code celebrity/<kind>}），返回未签名稳定公开 URL 回填档案字段。
 * 仅允许图片 kind（avatar / cover），且必须已绑定明星档案（防游客占用存储）。
 */
@RestController
@RequestMapping("/api/star/profile/uploads")
public class StarProfileUploadController {

    private static final Logger log = LoggerFactory.getLogger(StarProfileUploadController.class);

    private static final Set<String> ALLOWED_KINDS = Set.of("avatar", "cover");
    private static final Set<String> IMAGE_MIME = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif");

    private final MixcutProperties props;
    private final FileStorageService fileStorage;
    private final StarWorkbenchService workbench;

    public StarProfileUploadController(MixcutProperties props,
                                       FileStorageService fileStorage,
                                       StarWorkbenchService workbench) {
        this.props = props;
        this.fileStorage = fileStorage;
        this.workbench = workbench;
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ApiResponse<Map<String, String>> upload(
            Principal principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "kind", defaultValue = "avatar") String kind
    ) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        }
        workbench.requireAccount(principal.getName());

        if (file == null || file.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "FILE_EMPTY", "文件不能为空");
        }
        String safeKind = kind == null ? "avatar" : kind.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_KINDS.contains(safeKind)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "KIND_INVALID", "kind 必须是 avatar/cover 之一");
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

        FileStorageService.StoredFile stored = fileStorage.store(file, "celebrity/" + safeKind, null);
        log.info("[star-profile-upload] user={} {} → {} ({} bytes)",
                principal.getName(), safeKind, stored.url(), file.getSize());
        return ApiResponse.of(Map.of("url", stored.url(), "kind", safeKind));
    }
}
