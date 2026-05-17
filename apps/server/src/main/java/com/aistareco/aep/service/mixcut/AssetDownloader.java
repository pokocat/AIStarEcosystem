package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.config.MixcutProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * 把素材 URL 下载到工作目录的本地文件；已下载过的复用（按 url SHA-256 哈希）。
 */
@Component
public class AssetDownloader {

    private static final Logger log = LoggerFactory.getLogger(AssetDownloader.class);

    private final MixcutProperties props;

    public AssetDownloader(MixcutProperties props) {
        this.props = props;
    }

    public File ensureLocal(String urlOrPath) throws IOException {
        if (urlOrPath == null || urlOrPath.isBlank()) {
            throw new IOException("empty asset url");
        }
        // 本地路径直接返回
        if (urlOrPath.startsWith("/") || urlOrPath.startsWith("file:")) {
            File f = new File(urlOrPath.replace("file:", ""));
            if (f.exists()) return f;
            throw new IOException("local file not found: " + urlOrPath);
        }
        if (!urlOrPath.startsWith("http://") && !urlOrPath.startsWith("https://")) {
            throw new IOException("unsupported asset url: " + urlOrPath);
        }

        File cacheDir = new File(props.getWorkDir(), "asset-cache");
        if (!cacheDir.exists() && !cacheDir.mkdirs()) {
            throw new IOException("Cannot create cache dir: " + cacheDir);
        }

        String hash = sha256Hex(urlOrPath);
        String ext = guessExt(urlOrPath);
        File target = new File(cacheDir, hash + ext);
        if (target.exists() && target.length() > 0) {
            return target;
        }

        log.info("[mixcut] downloading asset: {}", urlOrPath);
        URL url = URI.create(urlOrPath).toURL();
        URLConnection conn = url.openConnection();
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(60_000);
        conn.setRequestProperty("User-Agent", "aistareco-mixcut/0.1");

        File tmp = new File(cacheDir, hash + ".part");
        long total = 0;
        try (InputStream in = conn.getInputStream();
             FileOutputStream out = new FileOutputStream(tmp)) {
            byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > props.getMaxAssetBytes()) {
                    throw new IOException("asset exceeds max bytes: " + urlOrPath);
                }
                out.write(buf, 0, n);
            }
        }
        Files.move(tmp.toPath(), target.toPath());
        log.info("[mixcut] downloaded {} → {} ({} bytes)", urlOrPath, target.getName(), total);
        return target;
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
