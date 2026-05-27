package com.aistareco.common;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 对称加密工具（AES-GCM）。
 *
 * 用于落库 AiModelProvider.apiKey 等敏感字段。
 *
 *   密钥来源（按优先级）：
 *     1) 环境变量 AEP_SECRET_KEY（生产环境强制配置）
 *     2) 系统属性 aep.secret.key
 *     3) dev 兜底 "dev-aes-256-key-32bytes!!!!!!!!"（**正式环境绝不能依赖**）
 *
 *   key 必须 32 字节（AES-256）。短/长会用 SHA-256 派生为 32 字节。
 *
 *   payload 形式：base64(iv[12] || ciphertext || tag[16])
 */
public final class AepCryptoUtil {

    private static final String ALGO = "AES";
    private static final String TRANS = "AES/GCM/NoPadding";
    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RNG = new SecureRandom();

    private AepCryptoUtil() {}

    public static String encrypt(String plaintext) {
        if (plaintext == null) return null;
        try {
            byte[] iv = new byte[IV_LEN];
            RNG.nextBytes(iv);
            Cipher c = Cipher.getInstance(TRANS);
            c.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = c.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new RuntimeException("encrypt failed", e);
        }
    }

    public static String decrypt(String ciphertextB64) {
        if (ciphertextB64 == null || ciphertextB64.isBlank()) return null;
        try {
            byte[] all = Base64.getDecoder().decode(ciphertextB64);
            if (all.length < IV_LEN + 16) {
                throw new IllegalArgumentException("ciphertext too short");
            }
            byte[] iv = new byte[IV_LEN];
            byte[] ct = new byte[all.length - IV_LEN];
            System.arraycopy(all, 0, iv, 0, IV_LEN);
            System.arraycopy(all, IV_LEN, ct, 0, ct.length);
            Cipher c = Cipher.getInstance(TRANS);
            c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, iv));
            byte[] pt = c.doFinal(ct);
            return new String(pt, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("decrypt failed", e);
        }
    }

    /** 仅展示用途：把 apiKey 脱敏为 sk-...XXXX（保留前 3 + 后 4 位）。 */
    public static String mask(String plaintext) {
        if (plaintext == null) return null;
        int n = plaintext.length();
        if (n <= 8) return "***";
        return plaintext.substring(0, 3) + "..." + plaintext.substring(n - 4);
    }

    /** dev fallback；任何生产 profile 看到它就 fail-fast。 */
    private static final String DEV_DEFAULT_KEY = "dev-aes-256-key-32bytes!!!!!!!!";

    /** 启动时尝试静态校验一次；mysql/prod profile 看到 dev key 立即抛。 */
    static {
        String raw = readRaw();
        if (raw == null || raw.isBlank() || DEV_DEFAULT_KEY.equals(raw)) {
            String profiles = System.getProperty("spring.profiles.active",
                    System.getenv().getOrDefault("SPRING_PROFILES_ACTIVE", ""));
            if (isProdProfile(profiles)) {
                throw new IllegalStateException(
                    "FATAL: AEP_SECRET_KEY 未配置（或仍是 dev default）但 active profile 是 [" + profiles + "]。" +
                    " 请在 /etc/aistareco/server.env 设置 AEP_SECRET_KEY=<32 字节高熵随机 base64>。" +
                    " 参考 infra/env/server.env.example §3 密钥段。");
            }
            // dev 环境保留 warn —— 不抛，让本机调试继续可用
            System.err.println("[AepCryptoUtil] ⚠️  Using DEV-DEFAULT AES key. NEVER use in production.");
        }
    }

    private static String readRaw() {
        String raw = System.getenv("AEP_SECRET_KEY");
        if (raw == null || raw.isBlank()) raw = System.getProperty("aep.secret.key");
        return raw;
    }

    private static boolean isProdProfile(String profilesCsv) {
        if (profilesCsv == null || profilesCsv.isBlank()) return false;
        for (String p : profilesCsv.split(",")) {
            String trimmed = p.trim().toLowerCase();
            if (trimmed.equals("mysql") || trimmed.equals("prod") || trimmed.equals("production")) {
                return true;
            }
        }
        return false;
    }

    private static SecretKeySpec key() {
        String raw = readRaw();
        if (raw == null || raw.isBlank()) raw = DEV_DEFAULT_KEY;
        byte[] bytes = raw.getBytes(StandardCharsets.UTF_8);
        if (bytes.length != 32) {
            try {
                bytes = java.security.MessageDigest.getInstance("SHA-256").digest(bytes);
            } catch (Exception e) {
                throw new RuntimeException("cannot derive aes key", e);
            }
        }
        return new SecretKeySpec(bytes, ALGO);
    }
}
