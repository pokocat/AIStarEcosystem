package com.aistareco.aep.service;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.LlmApiKey;
import com.aistareco.aep.repository.LlmApiKeyRepository;
import com.aistareco.common.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * LlmApiKey 业务 + 内部接口的合用 service。
 *
 * 创建：返回**明文一次**，DB 存 bcrypt hash。
 * 验证：按前 12 位 prefix 索引 + bcrypt 校验剩余部分。
 * 上报：累加 tokens/calls、写 LedgerEntry（CreditService.debit）。
 */
@Service
public class LlmApiKeyService {

    private static final String PLAINTEXT_PREFIX = "sk-aep-";
    private static final int PREFIX_LEN = 12; // sk-aep-XXXXX (前 5 位明文，便于识别)
    private static final int RANDOM_LEN = 32;
    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RNG = new SecureRandom();

    private final LlmApiKeyRepository repo;
    private final PasswordEncoder encoder;
    private final CreditService creditService;

    /** 每 100 tokens 扣 1 credit；可在 application.yml 调。 */
    private final long creditsPer100Tokens;

    public LlmApiKeyService(LlmApiKeyRepository repo,
                             PasswordEncoder encoder,
                             CreditService creditService,
                             @Value("${aep.llm.credits-per-100-tokens:1}") long creditsPer100Tokens) {
        this.repo = repo;
        this.encoder = encoder;
        this.creditService = creditService;
        this.creditsPer100Tokens = creditsPer100Tokens;
    }

    // ── admin CRUD ─────────────────────────────────────────────────────────

    public List<LlmApiKeyDto> list() {
        return repo.findAllByOrderByCreatedAtDesc().stream().map(LlmApiKeyDto::from).toList();
    }

    public LlmApiKeyDto get(String id) {
        return LlmApiKeyDto.from(load(id));
    }

    @Transactional
    public LlmApiKeyCreatedDto create(LlmApiKeyUpsertDto req) {
        if (req == null || req.userId() == null || req.userId().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "USER_ID_REQUIRED", "userId 必填");
        }
        if (req.name() == null || req.name().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "NAME_REQUIRED", "name 必填");
        }
        String plaintext = generatePlaintextKey();
        String prefix = plaintext.substring(0, PREFIX_LEN);
        LlmApiKey saved = repo.save(LlmApiKey.builder()
                .id("llmkey-" + UUID.randomUUID().toString().substring(0, 12))
                .keyPrefix(prefix)
                .keyHash(encoder.encode(plaintext))
                .userId(req.userId())
                .name(req.name())
                .enabled(req.enabled() == null ? true : req.enabled())
                .build());
        return new LlmApiKeyCreatedDto(LlmApiKeyDto.from(saved), plaintext);
    }

    @Transactional
    public LlmApiKeyDto update(String id, LlmApiKeyUpsertDto req) {
        LlmApiKey k = load(id);
        if (req.name() != null && !req.name().isBlank()) k.setName(req.name());
        if (req.enabled() != null) k.setEnabled(req.enabled());
        return LlmApiKeyDto.from(repo.save(k));
    }

    @Transactional
    public void revoke(String id) {
        LlmApiKey k = load(id);
        k.setEnabled(false);
        k.setRevokedAt(Instant.now());
        repo.save(k);
    }

    // ── internal: validate + usage ────────────────────────────────────────

    public LlmKeyValidationDto validate(String plaintext) {
        if (plaintext == null || !plaintext.startsWith(PLAINTEXT_PREFIX) || plaintext.length() < PREFIX_LEN) {
            return LlmKeyValidationDto.fail("malformed");
        }
        String prefix = plaintext.substring(0, PREFIX_LEN);
        List<LlmApiKey> candidates = repo.findByKeyPrefix(prefix);
        for (LlmApiKey k : candidates) {
            if (!k.isEnabled() || k.getRevokedAt() != null) continue;
            if (encoder.matches(plaintext, k.getKeyHash())) {
                return LlmKeyValidationDto.ok(k.getId(), k.getUserId(), k.getName());
            }
        }
        return LlmKeyValidationDto.fail("invalid");
    }

    /**
     * 上报 usage：更新 lastUsedAt / 累计 tokens / 写一条 LedgerEntry。
     * 失败时（如钱包余额不足）不抛——网关已经把响应回客户端了。
     */
    @Transactional
    public LedgerEntryDto reportUsage(LlmUsageReportDto report) {
        if (report.keyId() == null || report.keyId().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "KEY_ID_REQUIRED", "keyId 必填");
        }
        LlmApiKey k = load(report.keyId());
        long tokens = report.totalTokens() > 0
                ? report.totalTokens()
                : (report.promptTokens() + report.completionTokens());
        k.setTotalTokens(k.getTotalTokens() + tokens);
        k.setTotalCalls(k.getTotalCalls() + 1);
        k.setLastUsedAt(Instant.now());
        repo.save(k);

        long credits = Math.max(1, (tokens * creditsPer100Tokens + 99) / 100);
        try {
            return creditService.debit(
                    k.getUserId(),
                    credits,
                    "LLM_CALL",
                    report.requestId() != null ? report.requestId() : k.getId(),
                    String.format("LLM 调用 model=%s upstream=%s tokens=%d", report.model(), report.upstreamId(), tokens)
            );
        } catch (Exception e) {
            // 余额不足等场景：累计已记，账本失败仅 warn
            return null;
        }
    }

    private LlmApiKey load(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "KEY_NOT_FOUND",
                        "key 不存在"));
    }

    private String generatePlaintextKey() {
        StringBuilder sb = new StringBuilder(PLAINTEXT_PREFIX);
        for (int i = 0; i < RANDOM_LEN; i++) {
            sb.append(ALPHABET.charAt(RNG.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
