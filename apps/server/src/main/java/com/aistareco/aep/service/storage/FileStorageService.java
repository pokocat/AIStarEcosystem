package com.aistareco.aep.service.storage;

import com.aistareco.aep.config.FileStorageProperties;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

/**
 * 统一文件存储门面（v0.49+）。
 *
 * <p>全系统「上传 / 生成 / 大模型返回」的图片、视频、音频、模型等**文件存储一律走这里**，
 * 不再各业务各自 {@code Files.copy} 落本地 + 各自拼 URL。统一能力：
 * <ul>
 *   <li>落本机暂存 + 推 CDN（{@link CdnUploader}，local / oss driver 一键切）</li>
 *   <li>出 wire URL 经 {@link CdnUrlSigner} 加时效签名（防流量盗刷）</li>
 *   <li>统一 key 约定：{@code <category>/<owner?>/<uuid>.<ext>}，DB 真值存 key（§4.7.4）</li>
 *   <li>ffmpeg / python 子进程读文件统一走 {@link #openForRead(String)}（本地有则用、否则下载到临时区）</li>
 * </ul>
 *
 * <p>底层 driver / 签名逻辑不重复造 —— 复用既有 {@code service/cdn/*}；本类只做编排 + key 约定 +
 * 本地暂存生命周期。各业务（mixcut 素材 / 成片、celebrity 上传、aiavatar 资产、material video、
 * 形象锻造产出…）调 {@link #store} 系列方法即可。
 */
@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);

    private final FileStorageProperties props;
    private final CdnUploader cdn;        // 可空（driver 配错时）；默认 local-fake 必在
    private final CdnUrlSigner signer;

    public FileStorageService(
            FileStorageProperties props,
            @Autowired(required = false) CdnUploader cdn,
            CdnUrlSigner signer
    ) {
        this.props = props;
        this.cdn = cdn;
        this.signer = signer;
        log.info("[file-storage] ready: driver={}, localDir={}, keepLocal={}",
                cdn == null ? "<none>" : cdn.driverName(), props.getLocalDir(), props.isKeepLocalCopy());
    }

    /**
     * 落库后的文件句柄。
     * - key：OSS object key，DB 真值（与 driver / 域名 / 前缀无关）
     * - url：未签名的公开 URL（兜底字段，过渡期可双写；出 wire 优先用 {@link #signedUrl(String)}）
     * - signedUrl：带时效签名的可访问 URL（前端直接用）
     * - localPath：本机副本路径（keepLocalCopy=false 时为 null）；ffmpeg / python 本地消费用
     */
    public record StoredFile(String key, String url, String signedUrl, String localPath, long bytes, String contentType) {}

    // ── 写入 ──────────────────────────────────────────────────────────────────

    /** 存一个 multipart 上传文件（图片 / 视频 / 音频…）。ext / contentType 从上传文件推断。 */
    public StoredFile store(MultipartFile file, String category, String ownerId) {
        try {
            String ext = extOf(file.getOriginalFilename(), null);
            String mime = (file.getContentType() != null && !file.getContentType().isBlank())
                    ? file.getContentType()
                    : guessMime(ext);
            try (InputStream in = file.getInputStream()) {
                return ingest(in, category, ownerId, ext, mime);
            }
        } catch (IOException e) {
            throw new RuntimeException("文件存储失败: " + e.getMessage(), e);
        }
    }

    /** 存一段字节（如大模型返回的图片 / 程序生成的内容）。 */
    public StoredFile store(byte[] data, String category, String ownerId, String ext, String contentType) {
        try (InputStream in = new ByteArrayInputStream(data)) {
            return ingest(in, category, ownerId, ext, contentType == null ? guessMime(ext) : contentType);
        } catch (IOException e) {
            throw new RuntimeException("文件存储失败: " + e.getMessage(), e);
        }
    }

    /**
     * 上传一个**已存在的本机文件**（如 ffmpeg 渲染产出、已下载到本地的视频）。
     * 不再二次拷贝；按 category/owner 生成 key 推 CDN。
     *
     * @param deleteAfter 上传成功后是否删本机源文件（成片这类「本机仅临时」的设 true）
     */
    public StoredFile storeExisting(Path localFile, String category, String ownerId, String ext, String contentType, boolean deleteAfter) {
        try {
            long bytes = Files.size(localFile);
            String key = buildKey(category, ownerId, ext);
            String mime = contentType == null ? guessMime(ext) : contentType;
            String url = null;
            String signed = null;
            String keptLocal = localFile.toAbsolutePath().toString();
            if (cdn != null) {
                CdnUploader.CdnUploadResult r = cdn.upload(localFile, key, mime);
                url = r.cdnUrl();
                signed = signedUrl(key);
                if (deleteAfter) {
                    deleteLocalQuietly(localFile);
                    keptLocal = null;
                }
            } else {
                url = props.getPublicUrlBase() + "/" + key;
                signed = url;
            }
            return new StoredFile(key, url, signed, keptLocal, bytes, mime);
        } catch (IOException e) {
            throw new RuntimeException("文件上传失败: " + e.getMessage(), e);
        }
    }

    private StoredFile ingest(InputStream in, String category, String ownerId, String ext, String contentType) throws IOException {
        String key = buildKey(category, ownerId, ext);
        Path local = Paths.get(props.getLocalDir(), key);
        Files.createDirectories(local.getParent());
        Files.copy(in, local, StandardCopyOption.REPLACE_EXISTING);
        long bytes = Files.size(local);

        String url;
        String signed;
        String keptLocal = local.toAbsolutePath().toString();
        if (cdn != null) {
            cdn.upload(local, key, contentType);
            url = cdn.publicUrlFor(key);
            signed = signedUrl(key);
            if (!props.isKeepLocalCopy()) {
                deleteLocalQuietly(local);
                keptLocal = null;
            }
        } else {
            // 无 CDN：本机文件经 FileStorageWebConfig 静态映射对外
            url = props.getPublicUrlBase() + "/" + key;
            signed = url;
        }
        return new StoredFile(key, url, signed, keptLocal, bytes, contentType);
    }

    // ── 读取 / 签名 / 删除 ───────────────────────────────────────────────────

    /** 出 wire 的带签名 URL。cdn 缺失时回退本机静态 URL。 */
    public String signedUrl(String key) {
        if (key == null || key.isBlank()) return null;
        if (signer != null) {
            String s = signer.signKey(key);
            if (s != null && !s.isBlank()) return s;
        }
        if (cdn != null) return cdn.publicUrlFor(key);
        return props.getPublicUrlBase() + "/" + key;
    }

    /** 删除（key 对应的 CDN 对象 + 本机副本）。best-effort。 */
    public void delete(String key) {
        if (key == null || key.isBlank()) return;
        if (cdn != null) {
            try { cdn.delete(key); } catch (Exception e) { log.warn("[file-storage] cdn delete failed key={}: {}", key, e.getMessage()); }
        }
        deleteLocalQuietly(Paths.get(props.getLocalDir(), key));
    }

    /**
     * 取一个本机可读文件供 ffmpeg / python 消费：本机暂存有 → 直接用；否则从签名 URL 下载到临时区。
     * 注意：返回的可能是下载到 read-cache 的临时文件；调用方用完不必删（由清理流程统一管）。
     */
    public Path openForRead(String key) throws IOException {
        Path local = Paths.get(props.getLocalDir(), key);
        if (Files.exists(local) && Files.size(local) > 0) return local;
        // 本机没有 → 从 CDN 下载到 read-cache
        String url = signedUrl(key);
        if (url == null) throw new IOException("no source for key: " + key);
        Path cacheDir = Paths.get(props.getLocalDir(), ".read-cache");
        Files.createDirectories(cacheDir);
        Path target = cacheDir.resolve(key.replaceAll("[^A-Za-z0-9._-]", "_"));
        if (Files.exists(target) && Files.size(target) > 0) return target;
        URLConnection conn = URI.create(url).toURL().openConnection();
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(60_000);
        try (InputStream in = conn.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
        return target;
    }

    public String driverName() {
        return cdn == null ? "none" : cdn.driverName();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static String buildKey(String category, String ownerId, String ext) {
        String cat = sanitizeSegment(category == null || category.isBlank() ? "misc" : category);
        String uuid = UUID.randomUUID().toString().replace("-", "");
        String e = (ext == null || ext.isBlank()) ? "bin" : ext.replaceFirst("^\\.", "").toLowerCase();
        if (ownerId == null || ownerId.isBlank()) {
            return cat + "/" + uuid + "." + e;
        }
        return cat + "/" + sanitizeSegment(ownerId) + "/" + uuid + "." + e;
    }

    private static String sanitizeSegment(String s) {
        return s.replaceAll("[^A-Za-z0-9_\\-]", "_");
    }

    private static String extOf(String filename, String fallback) {
        if (filename != null) {
            int dot = filename.lastIndexOf('.');
            if (dot >= 0 && dot < filename.length() - 1) {
                String ext = filename.substring(dot + 1).toLowerCase();
                if (ext.matches("[a-z0-9]{1,6}")) return ext;
            }
        }
        return fallback == null ? "bin" : fallback;
    }

    private static String guessMime(String ext) {
        if (ext == null) return "application/octet-stream";
        return switch (ext.replaceFirst("^\\.", "").toLowerCase()) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            case "mp4", "m4v" -> "video/mp4";
            case "mov" -> "video/quicktime";
            case "webm" -> "video/webm";
            case "mp3" -> "audio/mpeg";
            case "wav" -> "audio/wav";
            case "m4a", "aac" -> "audio/aac";
            case "glb" -> "model/gltf-binary";
            case "json" -> "application/json";
            case "txt" -> "text/plain";
            default -> "application/octet-stream";
        };
    }

    private void deleteLocalQuietly(Path p) {
        if (p == null) return;
        try { Files.deleteIfExists(p); }
        catch (Exception e) { log.debug("[file-storage] delete local failed {}: {}", p, e.getMessage()); }
    }
}
