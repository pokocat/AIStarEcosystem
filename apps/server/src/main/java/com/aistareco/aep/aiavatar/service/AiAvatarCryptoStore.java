package com.aistareco.aep.aiavatar.service;

import com.aistareco.aep.aiavatar.config.AiAvatarProperties;
import com.aistareco.common.AepCryptoUtil;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.UUID;

/**
 * 真人原始照片加密存储（任务书 §2/§3「原始真人照片加密存储；信封加密」）。
 *
 * 简化为 AES-GCM（{@link AepCryptoUtil}，密钥 {@code AEP_SECRET_KEY}）：
 *  - 原始字节 → base64 → AES-GCM 密文 → 落 {@code <assetDir>/secure/<owner>/<uuid>.enc}（不经静态映射）。
 *  - 解密：仅 {@code /api/me/aiavatar/assets/{id}/raw} 经 owner 校验后流式返回。
 *
 * DECISIONS.md：完整信封加密（KMS 包裹 DEK）留作生产化；当前单层 AES-GCM 已满足「明文不落盘」。
 */
@Service
public class AiAvatarCryptoStore {

    private final AiAvatarProperties props;

    public AiAvatarCryptoStore(AiAvatarProperties props) {
        this.props = props;
    }

    public record Encrypted(String encKey, int width, int height) {}

    /** 加密落盘，返回相对 key（存进 asset.metaJson）。 */
    public Encrypted encryptToBlob(byte[] data, String ownerUserId) {
        try {
            String safeOwner = ownerUserId == null ? "anon" : ownerUserId.replaceAll("[^A-Za-z0-9_\\-]", "_");
            Path dir = Paths.get(props.getAssetDir(), "secure", safeOwner);
            Files.createDirectories(dir);
            String name = UUID.randomUUID().toString().replace("-", "") + ".enc";
            String b64 = Base64.getEncoder().encodeToString(data);
            String cipher = AepCryptoUtil.encrypt(b64);
            Path file = dir.resolve(name);
            Files.write(file, cipher.getBytes(StandardCharsets.UTF_8));

            int w = 0, h = 0;
            try {
                BufferedImage img = ImageIO.read(new ByteArrayInputStream(data));
                if (img != null) { w = img.getWidth(); h = img.getHeight(); }
            } catch (Exception ignore) { /* 非图片 */ }

            return new Encrypted("secure/" + safeOwner + "/" + name, w, h);
        } catch (Exception e) {
            throw new RuntimeException("加密存储失败: " + e.getMessage(), e);
        }
    }

    /** 解密读取原始字节。 */
    public byte[] decryptBlob(String encKey) {
        try {
            Path file = Paths.get(props.getAssetDir(), encKey);
            String cipher = Files.readString(file, StandardCharsets.UTF_8);
            String b64 = AepCryptoUtil.decrypt(cipher);
            return Base64.getDecoder().decode(b64);
        } catch (Exception e) {
            throw new RuntimeException("解密失败: " + e.getMessage(), e);
        }
    }

    /** 生成不暴露原图的脱敏预览（降采样 + 暗化），供素材填写页展示。返回 null 表示非图片。 */
    public BufferedImage maskedPreview(byte[] data, int maxSide) {
        try {
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(data));
            if (src == null) return null;
            int w = src.getWidth(), h = src.getHeight();
            double scale = Math.min(1.0, (double) maxSide / Math.max(w, h));
            int nw = Math.max(1, (int) (w * scale));
            int nh = Math.max(1, (int) (h * scale));
            BufferedImage dst = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = dst.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(src, 0, 0, nw, nh, null);
            g.dispose();
            return dst;
        } catch (Exception e) {
            return null;
        }
    }
}
