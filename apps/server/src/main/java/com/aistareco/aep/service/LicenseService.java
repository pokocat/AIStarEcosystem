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

    public Page<LicenseBatchDto> listBatches(Pageable pageable) {
        return batchRepo.findAll(pageable).map(LicenseBatchDto::from);
    }

    public LicenseBatchDto findBatchById(String id) {
        return batchRepo.findById(id)
                .map(LicenseBatchDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "License batch not found: " + id));
    }

    @Transactional
    public LicenseBatchDto createBatch(Map<String, Object> body) {
        int count = getInt(body, "totalCount", 1);
        String issuerTenantId = getString(body, "issuerTenantId");
        if (issuerTenantId == null || issuerTenantId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "issuerTenantId 不能为空");
        }
        String name = getString(body, "name");
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "批次 name 不能为空");
        }

        LicenseBatch batch = LicenseBatch.builder()
                .id(UUID.randomUUID().toString())
                .batchNo("BATCH-" + System.currentTimeMillis())
                .name(name)
                .issuerTenantId(issuerTenantId)
                .initialCreditGrant(getLong(body, "initialCreditGrant", 0L))
                .totalCount(count)
                .activatedCount(0)
                .validFrom(parseInstant(body, "validFrom"))
                .validTo(parseInstant(body, "validTo"))
                .status(LicenseBatch.LicenseBatchStatus.ACTIVE)
                .createdAt(Instant.now())
                .build();
        batchRepo.save(batch);

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
}
