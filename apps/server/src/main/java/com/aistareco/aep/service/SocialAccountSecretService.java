package com.aistareco.aep.service;

import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Playwright storage_state JSON 的对称加密 / 解密层。
 *
 * 策略：
 *   - 加密：Map<String, Object> → JSON 序列化 → AepCryptoUtil.encrypt → Base64 字符串
 *   - 解密：Base64 字符串 → AepCryptoUtil.decrypt → JSON 反序列化 → Map<String, Object>
 *
 * 密文长期持久化在 aep_social_accounts.storage_state_encrypted (TEXT 列)；
 * 明文仅在 startJob / verify / pollBind 等方法的**局部变量**中存活，
 * 方法返回后 GC，永不写盘。
 *
 * 密钥来源：复用 AepCryptoUtil 的 KEK (环境变量 AEP_SECRET_KEY)。
 */
@Service
public class SocialAccountSecretService {

    private static final ObjectMapper OM = new ObjectMapper();

    /** 加密 storage_state map；输入 null 或 empty 时返回 null。 */
    public String encryptStorageState(Map<String, Object> plaintext) {
        if (plaintext == null || plaintext.isEmpty()) return null;
        try {
            String json = OM.writeValueAsString(plaintext);
            return AepCryptoUtil.encrypt(json);
        } catch (Exception e) {
            throw new RuntimeException("encrypt storage_state failed", e);
        }
    }

    /** 解密 storage_state；输入 null / blank 返回 null。 */
    public Map<String, Object> decryptStorageState(String ciphertextB64) {
        if (ciphertextB64 == null || ciphertextB64.isBlank()) return null;
        try {
            String json = AepCryptoUtil.decrypt(ciphertextB64);
            if (json == null) return null;
            return OM.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            throw new RuntimeException("decrypt storage_state failed", e);
        }
    }
}
