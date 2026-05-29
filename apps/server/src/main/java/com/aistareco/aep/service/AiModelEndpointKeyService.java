package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelEndpointDto;
import com.aistareco.aep.dto.AiModelEndpointKeyMintedDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.LlmKeyValidationDto;
import com.aistareco.aep.dto.LlmUsageReportDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;

/**
 * 端点内嵌网关 Key 的生命周期（v0.41）：铸造 / 撤销（admin）+ 验证 / usage 上报（internal，给 llm-gateway）。
 *
 * 统一 Key 概念（决策 3）：同一 {@code sk-aep-*} Key 既标识一个 {@link AiModelEndpoint}（=上游+单模型），
 * 又是业务方调 llm-gateway 的凭证。validate / usage 优先命中端点；
 * **未命中再回退到旧 {@link LlmApiKeyService}**（兼容 1 版：现网旧 sk-aep-* 不立刻失效）。
 *
 * 创建：返回明文一次，DB 只存 bcrypt 哈希。
 */
@Service
public class AiModelEndpointKeyService {

    private static final Logger log = LoggerFactory.getLogger(AiModelEndpointKeyService.class);

    private static final String PLAINTEXT_PREFIX = "sk-aep-";
    private static final int PREFIX_LEN = 12; // sk-aep-XXXXX
    private static final int RANDOM_LEN = 32;
    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RNG = new SecureRandom();

    private final AiModelEndpointRepository repo;
    private final PasswordEncoder encoder;
    private final CreditService creditService;
    private final LlmApiKeyService legacy; // 兼容回退（旧 LlmApiKey）

    /** 每 100 tokens 扣 1 credit；可在 application.yml 调（沿用 v0.6 配置）。 */
    private final long creditsPer100Tokens;

    public AiModelEndpointKeyService(AiModelEndpointRepository repo,
                                     PasswordEncoder encoder,
                                     CreditService creditService,
                                     LlmApiKeyService legacy,
                                     @Value("${aep.llm.credits-per-100-tokens:1}") long creditsPer100Tokens) {
        this.repo = repo;
        this.encoder = encoder;
        this.creditService = creditService;
        this.legacy = legacy;
        this.creditsPer100Tokens = creditsPer100Tokens;
    }

    // ── admin：铸造 / 撤销 ─────────────────────────────────────────────────────

    /** 给端点铸造（或重铸）一个网关 Key，返回明文一次。 */
    @Transactional
    public AiModelEndpointKeyMintedDto mintKey(String endpointId) {
        AiModelEndpoint e = load(endpointId);
        String plaintext = generatePlaintextKey();
        e.setKeyPrefix(plaintext.substring(0, PREFIX_LEN));
        e.setKeyHash(encoder.encode(plaintext));
        e.setKeyRevokedAt(null); // 重铸即恢复
        AiModelEndpoint saved = repo.save(e);
        log.info("[ai-endpoint-key] minted key for endpoint {} (prefix={})", endpointId, saved.getKeyPrefix());
        return new AiModelEndpointKeyMintedDto(AiModelEndpointDto.from(saved), plaintext);
    }

    /** 撤销端点的网关 Key（不删端点；撤销后立即失效）。 */
    @Transactional
    public AiModelEndpointDto revokeKey(String endpointId) {
        AiModelEndpoint e = load(endpointId);
        e.setKeyRevokedAt(Instant.now());
        AiModelEndpoint saved = repo.save(e);
        log.info("[ai-endpoint-key] revoked key for endpoint {}", endpointId);
        return AiModelEndpointDto.from(saved);
    }

    // ── internal：验证 / usage（给 llm-gateway） ───────────────────────────────

    /** 验证 sk-aep-* → 命中端点（keyId=端点 id, userId=ownerUserId 可空）；未命中回退旧 LlmApiKey。 */
    public LlmKeyValidationDto validate(String plaintext) {
        if (plaintext == null || !plaintext.startsWith(PLAINTEXT_PREFIX) || plaintext.length() < PREFIX_LEN) {
            return LlmKeyValidationDto.fail("malformed");
        }
        String prefix = plaintext.substring(0, PREFIX_LEN);
        List<AiModelEndpoint> candidates = repo.findByKeyPrefix(prefix);
        for (AiModelEndpoint e : candidates) {
            if (!e.isEnabled() || e.getKeyRevokedAt() != null) continue;
            if (e.getKeyHash() == null || e.getKeyHash().isBlank()) continue;
            if (encoder.matches(plaintext, e.getKeyHash())) {
                // userId 可空（平台级端点）；gateway 用 path("userId").asText()→"" 不会 NPE
                return LlmKeyValidationDto.ok(e.getId(), e.getOwnerUserId(), e.getName());
            }
        }
        // 兼容回退：旧 LlmApiKey（1 版过渡）
        LlmKeyValidationDto legacyResult = legacy.validate(plaintext);
        if (legacyResult.ok()) {
            log.debug("[ai-endpoint-key] validate fell back to legacy LlmApiKey keyId={}", legacyResult.keyId());
        }
        return legacyResult;
    }

    /**
     * usage 上报：keyId 命中端点 → 累计 tokens/calls + 可选钱包扣减（ownerUserId 非空才扣）。
     * 未命中端点 → 回退旧 LlmApiKeyService。失败仅 log（gateway 已回响应给客户端）。
     */
    @Transactional
    public LedgerEntryDto reportUsage(LlmUsageReportDto report) {
        if (report.keyId() == null || report.keyId().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "KEY_ID_REQUIRED", "keyId 必填");
        }
        AiModelEndpoint e = repo.findById(report.keyId()).orElse(null);
        if (e == null) {
            // 旧 LlmApiKey（keyId=llmkey-*）→ 回退
            return legacy.reportUsage(report);
        }
        long tokens = report.totalTokens() > 0
                ? report.totalTokens()
                : (report.promptTokens() + report.completionTokens());
        e.setTotalTokens(e.getTotalTokens() + tokens);
        e.setTotalCalls(e.getTotalCalls() + 1);
        e.setLastUsedAt(Instant.now());
        repo.save(e);

        // 平台级端点（ownerUserId 空）只累计、不扣钱包
        if (e.getOwnerUserId() == null || e.getOwnerUserId().isBlank()) {
            return null;
        }
        long credits = Math.max(1, (tokens * creditsPer100Tokens + 99) / 100);
        try {
            return creditService.debit(
                    e.getOwnerUserId(),
                    credits,
                    "LLM_CALL",
                    report.requestId() != null ? report.requestId() : e.getId(),
                    String.format("LLM 调用 model=%s endpoint=%s tokens=%d", report.model(), e.getId(), tokens)
            );
        } catch (Exception ex) {
            // 余额不足等：累计已记，账本失败仅 warn
            log.warn("[ai-endpoint-key] usage debit failed for endpoint {} owner {}: {}",
                    e.getId(), e.getOwnerUserId(), ex.getMessage());
            return null;
        }
    }

    private AiModelEndpoint load(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ENDPOINT_NOT_FOUND",
                        "AI 模型端点不存在"));
    }

    private String generatePlaintextKey() {
        StringBuilder sb = new StringBuilder(PLAINTEXT_PREFIX);
        for (int i = 0; i < RANDOM_LEN; i++) {
            sb.append(ALPHABET.charAt(RNG.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
