package com.aistareco.aep.aiavatar.service;

import com.aistareco.aep.aiavatar.config.AiAvatarProperties;
import com.aistareco.aep.aiavatar.provider.AiAvatarImageGen;
import com.aistareco.aep.service.cdn.CdnUploader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

/**
 * AiAvatar 资产落盘 / CDN 上传统一入口。
 *
 * dev：写本地 {@code aep.aiavatar.asset-dir}（默认 ./aiavatar-assets），再上传到 local fake-CDN，返回 {@code /cdn/...}。
 * prod：注入 {@link CdnUploader}（如阿里云 OSS），同步上传并返回 CDN / OSS URL（对象存储）。
 *
 * 真人原始照片以「信封加密简化版（AES-GCM）」存储（{@link AiAvatarCryptoStore} 负责），不经此明文落盘入口。
 */
@Service
public class AiAvatarStorage {

    private static final Logger log = LoggerFactory.getLogger(AiAvatarStorage.class);

    private final AiAvatarProperties props;
    private final CdnUploader cdn;

    public AiAvatarStorage(AiAvatarProperties props, @Autowired(required = false) CdnUploader cdn) {
        this.props = props;
        this.cdn = cdn;
    }

    public record StoredFile(String url, int width, int height, long bytes, String localPath) {}

    public StoredFile writeImagePng(BufferedImage img, String ownerUserId) {
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            ImageIO.write(img, "png", bos);
            byte[] data = bos.toByteArray();
            String filename = UUID.randomUUID().toString().replace("-", "") + ".png";
            StoredFile sf = persist(data, ownerUserId, filename, "image/png");
            return new StoredFile(sf.url(), img.getWidth(), img.getHeight(), sf.bytes(), sf.localPath());
        } catch (Exception e) {
            throw new RuntimeException("写图片失败: " + e.getMessage(), e);
        }
    }

    public StoredFile writeBytes(byte[] data, String ownerUserId, String ext, String mime) {
        String filename = UUID.randomUUID().toString().replace("-", "") + "." + ext;
        return persist(data, ownerUserId, filename, mime);
    }

    public StoredFile writeText(String text, String ownerUserId, String ext, String mime) {
        return persist(text.getBytes(StandardCharsets.UTF_8), ownerUserId, "tmp." + ext, mime);
    }

    private StoredFile persist(byte[] data, String ownerUserId, String filename, String mime) {
        String safeOwner = sanitize(ownerUserId == null ? "anon" : ownerUserId);
        try {
            Path dir = Paths.get(props.getAssetDir(), safeOwner);
            Files.createDirectories(dir);
            Path file = dir.resolve(filename);
            Files.write(file, data);

            String relativeKey = "aiavatar/" + safeOwner + "/" + filename;
            String url;
            if (cdn != null) {
                try {
                    CdnUploader.CdnUploadResult r = cdn.upload(file, relativeKey, mime);
                    url = r.cdnUrl();
                } catch (Exception e) {
                    log.warn("[aiavatar] CDN 上传失败 driver={}，回退本地 URL: {}",
                            cdn.driverName(), e.getMessage());
                    url = localUrl(safeOwner, filename);
                }
            } else {
                url = localUrl(safeOwner, filename);
            }
            return new StoredFile(url, 0, 0, data.length, file.toAbsolutePath().toString());
        } catch (Exception e) {
            throw new RuntimeException("资产落盘失败: " + e.getMessage(), e);
        }
    }

    private String localUrl(String owner, String filename) {
        String base = props.getAssetPublicUrlBase();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base + "/" + owner + "/" + filename;
    }

    public File assetRoot() {
        return new File(props.getAssetDir());
    }

    private static String sanitize(String s) {
        return s.replaceAll("[^A-Za-z0-9_\\-]", "_");
    }

    /** 便捷：直接产出一张占位图并落盘。 */
    public StoredFile writePlaceholder(int w, int h, String title, String subtitle,
                                       java.util.List<String> lines, String badge,
                                       boolean portrait, long seed, String ownerUserId) {
        BufferedImage img = AiAvatarImageGen.placeholder(w, h, title, subtitle, lines, badge, portrait, seed);
        return writeImagePng(img, ownerUserId);
    }
}
