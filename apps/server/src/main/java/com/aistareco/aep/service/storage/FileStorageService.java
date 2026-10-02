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
import java.time.Instant;

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
    /**
     * 未签名的公开 URL。给**服务端到服务端**的场景用（把图交给上游模型去抓）。
     *
     * <p>浏览器那侧照旧用 {@link #signedUrl(String)}。这里之所以要另开一条：
     * 签名 URL 多一层会失败的环节（TTL、签名与实际请求对不对得上），
     * 而上游抓不到图时往往**不报错**，直接当没有参考图跑完 —— 排查起来极其昂贵。
     */
    public String publicUrl(String key) {
        if (key == null || key.isBlank()) return null;
        return cdn == null ? props.getPublicUrlBase() + "/" + key : cdn.publicUrlFor(key);
    }

    /**
     * 交给视频厂商**自己去抓**的地址（seedance / agnes / 通用协议的首帧）：先给签名 URL，签不出来再退公开 URL。
     *
     * <p>为什么签名优先（与 {@code DapImageInput.of} 的「公开优先」不同）：{@link #publicUrl} 只是把域名和 key
     * 拼起来，**不管桶能不能匿名读**。生产默认按 OSS 签名出 wire（{@code aep.cdn.signed-url.strategy}），
     * 桶是私有的话未签名地址就是 403，厂商要么报错、要么当没有首帧跑完。签名地址对公开桶同样有效，
     * 短剧线交给 seedance 的首尾帧也一直是签名地址（{@code DramaReferenceAssembler} → {@code signKey}），
     * 生产上跑通过。厂商在提交时就抓图，一小时的 TTL 足够。
     *
     * <p>这个选择只写在这里，视频链调它，不各自再判一遍。返回的可能是本机静态路径（无 CDN 的 dev 环境），
     * 调用方要自己判断上游能不能访问。
     */
    public String upstreamFetchUrl(String key) {
        if (key == null || key.isBlank()) return null;
        String url = signedUrl(key);
        if (url == null || url.isBlank()) url = publicUrl(key);
        return url;
    }

    /**
     * 把我方存储给出去的地址反解回 key（签名 / 未签名、OSS / 本机静态都认）；不是我方地址返回 null。
     *
     * <p>给「历史上只存了 URL」的字段用（如 {@code MaterialVideoJob.videoUrl}）：先问 {@link CdnUrlSigner#keyOf}
     * （认 OSS 域名）；它认不出时再按存储驱动自己的公开地址前缀剥一次 —— dev 用本机 fake CDN 时
     * OSS 域名是空的，只靠 {@code keyOf} 会一律返回 null。
     */
    public String keyOfStoredUrl(String url) {
        if (url == null || url.isBlank()) return null;
        if (signer != null) {
            String k = signer.keyOf(url);
            if (k != null && !k.isBlank()) return k;
        }
        String probe = "__key_probe__";
        String sample = cdn != null ? cdn.publicUrlFor(probe) : props.getPublicUrlBase() + "/" + probe;
        if (sample == null || !sample.endsWith(probe)) return null;
        String base = sample.substring(0, sample.length() - probe.length());
        if (base.isBlank() || !url.startsWith(base)) return null;
        String rest = url.substring(base.length());
        int cut = rest.length();
        int q = rest.indexOf('?');
        if (q >= 0) cut = q;
        int h = rest.indexOf('#');
        if (h >= 0 && h < cut) cut = h;
        rest = rest.substring(0, cut);
        return rest.isBlank() || rest.contains("..") ? null : rest;
    }

    /**
     * 某分类下某人的 key 前缀：{@code <category>/<owner>/}。与 {@link #store} 系列生成 key 用的是
     * **同一套** sanitize（{@code buildKey}），归属闸据此判「这个 key 是不是本人在这个分类下存的」，
     * 调用方不要自己拼前缀 —— 存储层会把分类名里的 `/` 等字符换成 `_`，手拼的前缀跟真实 key 对不上。
     *
     * @throws IllegalArgumentException ownerId 为空（没有属主段的前缀会匹配到所有人的文件）
     */
    public static String ownedKeyPrefix(String category, String ownerId) {
        if (ownerId == null || ownerId.isBlank()) {
            throw new IllegalArgumentException("ownerId is required for an owned key prefix");
        }
        return categorySegment(category) + "/" + sanitizeSegment(ownerId) + "/";
    }

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

    /**
     * 存一段字节（如大模型返回的图片 / 程序生成的内容）。
     *
     * <p>{@code ext} / {@code contentType} 只是调用方的**声明**：全仓十几处都写死
     * {@code ("png", "image/png")}，而厂商给的常常是 JPEG。声明与字节不符时以**字节**为准
     * —— 存错类型平时看不出来（浏览器自己嗅探），但把这张图转交给另一个厂商时，对方按我们
     * 声明的类型去解码就会直接拒收（v0.184：聚算 400 {@code input image cannot be decoded}）。
     * 认不出格式的字节（音视频等）原样沿用声明值，这里不猜。
     */
    public StoredFile store(byte[] data, String category, String ownerId, String ext, String contentType) {
        ImageBytes.Format real = ImageBytes.sniff(data);
        if (real != null && !real.mime().equalsIgnoreCase(contentType)) {
            log.info("[file-storage] 声明类型与字节不符，按字节存 category={} declared={}/{} actual={}/{}",
                    category, ext, contentType, real.ext(), real.mime());
            ext = real.ext();
            contentType = real.mime();
        }
        String mime = contentType;
        try (InputStream in = new ByteArrayInputStream(data)) {
            return ingest(in, category, ownerId, ext, mime == null ? guessMime(ext) : mime);
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

    /** 只分配逻辑 key，不创建空对象；给受限直传票使用。 */
    public String allocateKey(String category, String ownerId, String filename) {
        return buildKey(category, ownerId, extOf(filename, "bin"));
    }

    public CdnUploader.BrowserUploadTicket browserUpload(String key, String contentType, long minBytes, long maxBytes, Instant expiresAt) {
        if (cdn == null) throw new IllegalStateException("file storage CDN is not configured");
        return cdn.browserUpload(key, contentType, minBytes, maxBytes, expiresAt);
    }

    public CdnUploader.ObjectInfo stat(String key) throws IOException {
        return cdn == null ? null : cdn.stat(key);
    }

    /** 已由受限直传写入 CDN 的对象句柄；调用前必须先 stat 并核对 owner/session。 */
    public StoredFile adopt(String key, long bytes, String contentType) {
        return new StoredFile(key, cdn == null ? props.getPublicUrlBase() + "/" + key : cdn.publicUrlFor(key),
                signedUrl(key), null, bytes, contentType);
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
        String cat = categorySegment(category);
        String uuid = UUID.randomUUID().toString().replace("-", "");
        String e = (ext == null || ext.isBlank()) ? "bin" : ext.replaceFirst("^\\.", "").toLowerCase();
        if (ownerId == null || ownerId.isBlank()) {
            return cat + "/" + uuid + "." + e;
        }
        return cat + "/" + sanitizeSegment(ownerId) + "/" + uuid + "." + e;
    }

    /** key 的第一段（分类）。buildKey 与 ownedKeyPrefix 共用，保证两边永远一致。 */
    private static String categorySegment(String category) {
        return sanitizeSegment(category == null || category.isBlank() ? "misc" : category);
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
