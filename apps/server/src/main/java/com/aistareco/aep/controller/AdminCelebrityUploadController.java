package com.aistareco.aep.controller;

import com.aistareco.aep.config.MixcutProperties;
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

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * v0.34+：celebrity 明星档案 / 模板的图片上传通用入口。
 *
 * 上传到 {@code aep.mixcut.asset-dir}/celebrity/&lt;kind&gt;/ 目录，public URL 复用
 * {@code aep.mixcut.asset-public-url-base}。返回 {@code {url}} 给前端，前端把
 * URL 回填到 StarFormDialog / TemplateFormDialog 的 avatar / cover / preview 字段。
 *
 * 不写 MixcutAsset 表 —— 这些图片是「明星档案」的附属字段，不参与混剪资产管理；
 * 落 DB 的是 CelebrityStar / CelebrityTemplate 的 URL 字段。
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

    public AdminCelebrityUploadController(MixcutProperties props) {
        this.props = props;
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ApiResponse<Map<String, String>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "kind", defaultValue = "avatar") String kind
    ) throws IOException {
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

        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String ext = guessExt(file.getOriginalFilename(), file.getContentType());
        String storedName = id + ext;

        File dir = new File(new File(props.getAssetDir(), "celebrity"), safeKind);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("无法创建目录: " + dir.getAbsolutePath());
        }
        File target = new File(dir, storedName);
        try (var in = file.getInputStream()) {
            Files.copy(in, target.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
        String publicUrl = props.getAssetPublicUrlBase() + "/celebrity/" + safeKind + "/" + storedName;
        log.info("[celebrity-upload] {} → {} ({} bytes)", safeKind, publicUrl, file.getSize());
        return ApiResponse.of(Map.of("url", publicUrl, "kind", safeKind));
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

    private String guessExt(String filename, String mime) {
        if (filename != null) {
            int dot = filename.lastIndexOf('.');
            if (dot > 0) return filename.substring(dot).toLowerCase(Locale.ROOT);
        }
        if (mime == null) return "";
        return switch (mime.toLowerCase(Locale.ROOT)) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            case "video/mp4" -> ".mp4";
            case "video/webm" -> ".webm";
            case "video/quicktime" -> ".mov";
            default -> "";
        };
    }
}
