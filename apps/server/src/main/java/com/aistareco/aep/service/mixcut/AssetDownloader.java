package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.config.MixcutProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * 把素材 URL 下载到工作目录的本地文件；已下载过的复用（按 url SHA-256 哈希）。
 *
 * 例行 QA 安全修复（2026-09-10，承接已随 main 历史重写而失效的 #98）：{@code ensureLocal}
 * 此前对 http(s) 绝对 URL 零校验就直接 {@code openConnection()}——而调用方
 * {@link MixcutRenderingService#resolveOne} 读取的 {@code file_url} 来自
 * {@code POST /api/mixcut/jobs} 请求体 {@code slot_bindings} 里客户端自行提交的字段
 * （不是所有场景都经 {@code asset_id} 回查 DB 校验），任何登录用户都可以直接把
 * {@code file_url} 设成阿里云 metadata 接口（{@code 100.100.100.200}）或任意内网服务地址，
 * 构成 SSRF——这与 {@code PublishJobService}/{@code DramaAssembleService} 已修过的同类漏洞
 * 是第三个独立代码路径。
 *
 * 与那两处不同：mixcut 合法业务（商品链接抓图落地渲染，见 {@code create-client.tsx}
 * "没素材时回退到 product.images[0]（外网 URL 直接作 file_url）"）确实需要下载任意公网 CDN
 * 域的图片，不能简单收窄成"仅自身 CDN 域"白名单（会破坏功能）。故这里改用 SSRF 标准防护
 * 姿势——按 host 解析出的实际 IP 校验，拒绝环回 / link-local / 私网（RFC1918）/ 组播 /
 * CGNAT（100.64.0.0/10，覆盖阿里云 metadata 100.100.100.200）等内部地址，公网 CDN 域名
 * 解析出的公网 IP 不受影响。
 */
@Component
public class AssetDownloader {

    private static final Logger log = LoggerFactory.getLogger(AssetDownloader.class);

    private final MixcutProperties props;
    private final okhttp3.OkHttpClient http;


    @org.springframework.beans.factory.annotation.Autowired
    public AssetDownloader(MixcutProperties props) {
        this(props, new okhttp3.OkHttpClient.Builder()
                .proxy(java.net.Proxy.NO_PROXY)
                .dns(host -> validatedAddresses(java.util.Arrays.asList(InetAddress.getAllByName(host))))
                .connectTimeout(java.time.Duration.ofSeconds(15))
                .readTimeout(java.time.Duration.ofSeconds(60))
                .callTimeout(java.time.Duration.ofMinutes(5))
                .followRedirects(false).followSslRedirects(false).build());
    }

    AssetDownloader(MixcutProperties props, okhttp3.OkHttpClient http) {
        this.props = props;
        this.http = http;
    }

    static java.util.List<InetAddress> validatedAddresses(java.util.List<InetAddress> addresses) throws UnknownHostException {
        if (addresses.isEmpty() || addresses.stream().anyMatch(AssetDownloader::isBlockedAddress))
            throw new UnknownHostException("asset host resolves to a disallowed internal address");
        return addresses;
    }

    static URI validateUrl(String value) throws IOException {
        try {
            URI uri = URI.create(value);
            if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    || uri.getUserInfo() != null || isBlockedHost(uri.getHost()))
                throw new IOException("asset URL has a disallowed scheme or internal address");
            return uri;
        } catch (IllegalArgumentException e) { throw new IOException("invalid asset URL", e); }
    }

    public File ensureLocal(String urlOrPath) throws IOException {
        if (urlOrPath == null || urlOrPath.isBlank()) {
            throw new IOException("empty asset url");
        }
        URI uri = validateUrl(urlOrPath);

        File cacheDir = new File(props.getWorkDir(), "asset-cache-v2");
        if (!cacheDir.exists() && !cacheDir.mkdirs()) {
            throw new IOException("Cannot create cache dir: " + cacheDir);
        }

        String hash = sha256Hex(urlOrPath);
        String ext = guessExt(urlOrPath);
        File target = new File(cacheDir, hash + ext);
        if (target.exists() && target.length() > 0) {
            return target;
        }

        // 用唯一临时文件，避免同 URL 并发下载覆盖彼此的半成品。
        var temp = Files.createTempFile(cacheDir.toPath(), hash + "-", ".part");
        try {
            for (int redirects = 0; redirects <= 5; redirects++) {
                uri = validateUrl(uri.toString());
                var request = new okhttp3.Request.Builder().url(uri.toString())
                        .header("User-Agent", "aistareco-mixcut/0.1").build();
                try (var response = http.newCall(request).execute()) {
                    int status = response.code();
                    if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                        String location = response.header("Location");
                        if (location == null || redirects == 5) throw new IOException("invalid or excessive asset redirects");
                        uri = validateUrl(uri.resolve(location).toString());
                        continue;
                    }
                    if (!response.isSuccessful() || response.body() == null) {
                        log.warn("[mixcut] asset download rejected host={} status={}", uri.getHost(), status);
                        throw new IOException("asset download failed HTTP " + status);
                    }
                    if (response.body().contentLength() > props.getMaxAssetBytes()) throw new IOException("asset exceeds max bytes");
                    long total = 0;
                    try (InputStream in = response.body().byteStream(); var out = Files.newOutputStream(temp)) {
                        byte[] buffer = new byte[16384];
                        int n;
                        while ((n = in.read(buffer)) != -1) {
                            total += n;
                            if (total > props.getMaxAssetBytes()) throw new IOException("asset exceeds max bytes");
                            out.write(buffer, 0, n);
                        }
                    }
                    if (total == 0) throw new IOException("empty asset response");
                    Files.move(temp, target.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    return target;
                }
            }
            throw new IOException("too many asset redirects");
        } finally { Files.deleteIfExists(temp); }
    }

    /**
     * host 是否解析到应当拒绝抓取的地址（环回 / link-local / 私网 / 组播 / CGNAT-metadata）。
     * 解析失败（DNS 不可达等）一律按拒绝处理——宁可误杀，不可放行不可控地址。
     * 包 default 可见性供单测直接调用，不下沉到 ensureLocal 的完整 I/O 流程。
     */
    static boolean isBlockedHost(String host) {
        if (host == null || host.isBlank()) return true;
        try {
            // 字面量 IP（含 "100.100.100.200" / "169.254.169.254" 这类）本地解析，不发起 DNS 查询；
            // 真实域名才会触发一次 DNS 查询——与 openConnection() 本就要做的解析等价，不新增网络面。
            return java.util.Arrays.stream(InetAddress.getAllByName(host)).anyMatch(AssetDownloader::isBlockedAddress);
        } catch (UnknownHostException e) {
            return true;
        }
    }

    private static boolean isBlockedAddress(InetAddress addr) {
        if (addr.isAnyLocalAddress() || addr.isLoopbackAddress() || addr.isLinkLocalAddress()
                || addr.isSiteLocalAddress() || addr.isMulticastAddress()) {
            return true;
        }
        if (addr instanceof Inet4Address) {
            byte[] b = addr.getAddress();
            int first = b[0] & 0xFF;
            int second = b[1] & 0xFF;
            // 100.64.0.0/10（RFC 6598 共享地址空间 / CGNAT）——阿里云 metadata 100.100.100.200 落在此段，
            // 不属于 RFC1918 私网，Java 的 isSiteLocalAddress() 不会覆盖，须显式拦。
            if (first == 0 || first >= 224 || (first == 100 && (second & 0xC0) == 64)
                    || (first == 198 && (second == 18 || second == 19))) return true;
        } else if (addr instanceof Inet6Address) {
            byte[] b = addr.getAddress();
            // fc00::/7（Unique Local Address）——IPv6 版私网段，isSiteLocalAddress() 只覆盖已废弃的
            // fec0::/10，不含 ULA，须显式拦。
            if ((b[0] & 0xFE) == 0xFC) return true;
        }
        return false;
    }

    private static String sha256Hex(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d).substring(0, 32);
        } catch (Exception e) {
            return Integer.toHexString(s.hashCode());
        }
    }

    private static String guessExt(String url) {
        int q = url.indexOf('?');
        String clean = q >= 0 ? url.substring(0, q) : url;
        int slash = clean.lastIndexOf('/');
        if (slash >= 0) clean = clean.substring(slash + 1);
        int dot = clean.lastIndexOf('.');
        if (dot >= 0 && dot < clean.length() - 1) {
            String ext = clean.substring(dot).toLowerCase();
            if (ext.length() <= 6 && ext.matches("\\.[a-z0-9]+")) return ext;
        }
        return ".bin";
    }
}
