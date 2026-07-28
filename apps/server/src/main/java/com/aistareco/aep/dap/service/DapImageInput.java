package com.aistareco.aep.dap.service;

import com.aistareco.aep.service.storage.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

/**
 * storage key → 生成引擎可消费的图片输入（i2i 源图）。
 *
 * 公网可达的 OSS / CDN URL 直接给；本地 fake-CDN（localhost）对云端不可达，转 dataURI 上行，
 * 大图先等比压成 JPEG 以缓解大请求体导致的 EOF / 超时。
 * 由 {@link DapJobRunner}（人物线）与 {@link DapAssetJobs}（资产 / 合成线）共用。
 */
@Component
public class DapImageInput {

    private static final Logger log = LoggerFactory.getLogger(DapImageInput.class);

    /** dataURI 输入超过该字节数时先压缩。 */
    private static final int COMPRESS_THRESHOLD_BYTES = 300 * 1024;
    private static final int MAX_WIDTH = 768;

    private final FileStorageService storage;

    public DapImageInput(FileStorageService storage) {
        this.storage = storage;
    }

    /** key → 图片输入串（公网 URL 或 dataURI）；读不到返回 null。 */
    public String of(String key) {
        if (key == null || key.isBlank()) return null;
        String url = storage.signedUrl(key);
        boolean publicUrl = url != null && (url.startsWith("http://") || url.startsWith("https://"))
                && !url.contains("//localhost") && !url.contains("//127.0.0.1") && !url.contains("//0.0.0.0");
        if (publicUrl) return url;
        try {
            Path p = storage.openForRead(key);
            byte[] bytes = Files.readAllBytes(p);
            String mime = key.endsWith(".jpg") || key.endsWith(".jpeg") ? "image/jpeg"
                    : key.endsWith(".webp") ? "image/webp" : "image/png";
            if (bytes.length > COMPRESS_THRESHOLD_BYTES) {
                byte[] compressed = compressToJpeg(bytes, MAX_WIDTH);
                if (compressed != null && compressed.length < bytes.length) {
                    log.info("[dap] 参考图压缩 key={} {}B → {}B（dataURI 上行）", key, bytes.length, compressed.length);
                    bytes = compressed;
                    mime = "image/jpeg";
                }
            }
            return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
        } catch (IOException e) {
            log.warn("[dap] 读取参考图失败 key={}: {}", key, e.getMessage());
            return null;
        }
    }

    /** 等比缩到 maxWidth 宽 + JPEG q0.82（PNG alpha 铺白底）。失败返回 null（调用方用原图）。 */
    public static byte[] compressToJpeg(byte[] raw, int maxWidth) {
        try {
            java.awt.image.BufferedImage src = javax.imageio.ImageIO.read(new ByteArrayInputStream(raw));
            if (src == null) return null;
            int w = src.getWidth(), h = src.getHeight();
            int outW = Math.min(w, maxWidth);
            int outH = (int) Math.round(h * (outW / (double) w));
            java.awt.image.BufferedImage out =
                    new java.awt.image.BufferedImage(outW, outH, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = out.createGraphics();
            g.setColor(java.awt.Color.WHITE);
            g.fillRect(0, 0, outW, outH);
            g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION,
                    java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(src, 0, 0, outW, outH, null);
            g.dispose();

            var writer = javax.imageio.ImageIO.getImageWritersByFormatName("jpeg").next();
            var param = writer.getDefaultWriteParam();
            param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(0.82f);
            var bos = new ByteArrayOutputStream();
            try (var ios = javax.imageio.ImageIO.createImageOutputStream(bos)) {
                writer.setOutput(ios);
                writer.write(null, new javax.imageio.IIOImage(out, null, null), param);
            } finally {
                writer.dispose();
            }
            return bos.toByteArray();
        } catch (Exception e) {
            return null;
        }
    }
}
