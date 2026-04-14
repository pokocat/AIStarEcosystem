package com.aistareco.aep.service;

import com.aistareco.aep.dto.LicenseBatchDto;
import com.aistareco.aep.dto.LicenseKeyDto;
import com.aistareco.aep.model.LicenseBatch;
import com.aistareco.aep.model.LicenseKey;
import com.aistareco.aep.repository.LicenseBatchRepository;
import com.aistareco.aep.repository.LicenseKeyRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
public class LicenseService {

    private final LicenseBatchRepository batchRepo;
    private final LicenseKeyRepository keyRepo;

    public LicenseService(LicenseBatchRepository batchRepo, LicenseKeyRepository keyRepo) {
        this.batchRepo = batchRepo;
        this.keyRepo = keyRepo;
    }

    // --- Batches ---

    public Page<LicenseBatchDto> listBatches(Pageable pageable) {
        return batchRepo.findAll(pageable).map(LicenseBatchDto::from);
    }

    @Transactional
    public LicenseBatchDto createBatch(Map<String, Object> body) {
        int count = getInt(body, "totalCount", 1);
        LicenseBatch batch = LicenseBatch.builder()
                .id(UUID.randomUUID().toString())
                .batchNo("BATCH-" + System.currentTimeMillis())
                .productId(getString(body, "productId"))
                .planId(getString(body, "planId"))
                .licenseType(parseEnum(body, "licenseType", LicenseBatch.LicenseType.class, LicenseBatch.LicenseType.PLAN_ACTIVATION))
                .durationDays(getInt(body, "durationDays", null))
                .creditDelta(getLong(body, "creditDelta", 0L))
                .settlementMode(parseEnum(body, "settlementMode", LicenseBatch.SettlementMode.class, LicenseBatch.SettlementMode.PREPAID))
                .totalCount(count)
                .activatedCount(0)
                .channelPartnerId(getString(body, "channelPartnerId"))
                .validFrom(parseInstant(body, "validFrom"))
                .validTo(parseInstant(body, "validTo"))
                .createdAt(Instant.now())
                .build();
        batchRepo.save(batch);

        // Generate license keys
        for (int i = 0; i < count; i++) {
            String rawCode = UUID.randomUUID().toString().replace("-", "").toUpperCase();
            String codeHash = sha256(rawCode);
            String maskedCode = "AISTAR-" + rawCode.substring(0, 4) + "-****-****-" + rawCode.substring(rawCode.length() - 4);
            LicenseKey key = LicenseKey.builder()
                    .id(UUID.randomUUID().toString())
                    .batchId(batch.getId())
                    .codeHash(codeHash)
                    .maskedCode(maskedCode)
                    .status(LicenseKey.LicenseKeyStatus.CREATED)
                    .createdAt(Instant.now())
                    .build();
            keyRepo.save(key);
        }

        return LicenseBatchDto.from(batch);
    }

    // --- Keys ---

    public Page<LicenseKeyDto> listKeys(String batchId, LicenseKey.LicenseKeyStatus status, Pageable pageable) {
        Page<LicenseKey> page;
        if (batchId != null && status != null) {
            page = keyRepo.findByBatchIdAndStatus(batchId, status, pageable);
        } else if (batchId != null) {
            page = keyRepo.findByBatchId(batchId, pageable);
        } else if (status != null) {
            page = keyRepo.findByStatus(status, pageable);
        } else {
            page = keyRepo.findAll(pageable);
        }
        return page.map(LicenseKeyDto::from);
    }

    public LicenseKeyDto revokeKey(String id) {
        LicenseKey key = keyRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "License key not found: " + id));
        key.setStatus(LicenseKey.LicenseKeyStatus.REVOKED);
        return LicenseKeyDto.from(keyRepo.save(key));
    }

    // --- helpers ---

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String getString(Map<String, Object> body, String key) {
        Object val = body.get(key);
        return val != null ? val.toString() : null;
    }

    private long getLong(Map<String, Object> body, String key, long defaultVal) {
        Object val = body.get(key);
        if (val == null) return defaultVal;
        if (val instanceof Number n) return n.longValue();
        return Long.parseLong(val.toString());
    }

    private int getInt(Map<String, Object> body, String key, Integer defaultVal) {
        Object val = body.get(key);
        if (val == null) return defaultVal != null ? defaultVal : 0;
        if (val instanceof Number n) return n.intValue();
        return Integer.parseInt(val.toString());
    }

    private Instant parseInstant(Map<String, Object> body, String key) {
        Object val = body.get(key);
        if (val == null) return null;
        return Instant.parse(val.toString());
    }

    private <E extends Enum<E>> E parseEnum(Map<String, Object> body, String key, Class<E> enumClass, E defaultVal) {
        Object val = body.get(key);
        if (val == null) return defaultVal;
        try {
            return Enum.valueOf(enumClass, val.toString());
        } catch (IllegalArgumentException ex) {
            return defaultVal;
        }
    }
}
