package com.aistareco.aep.service;

import com.aistareco.aep.dto.LicenseBatchDto;
import com.aistareco.aep.dto.LicenseKeyDto;
import com.aistareco.aep.model.LicenseBatch;
import com.aistareco.aep.model.LicenseKey;
import com.aistareco.aep.repository.LicenseBatchRepository;
import com.aistareco.aep.repository.LicenseKeyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(LicenseService.class);

    private final LicenseBatchRepository batchRepo;
    private final LicenseKeyRepository keyRepo;
    private final SellingChannelService sellingChannelService;

    public LicenseService(LicenseBatchRepository batchRepo,
                          LicenseKeyRepository keyRepo,
                          SellingChannelService sellingChannelService) {
        this.batchRepo = batchRepo;
        this.keyRepo = keyRepo;
        this.sellingChannelService = sellingChannelService;
    }

    public Page<LicenseBatchDto> listBatches(Pageable pageable) {
        return batchRepo.findAll(pageable).map(this::toDtoWithDerivedCounts);
    }

    public LicenseBatchDto findBatchById(String id) {
        LicenseBatch batch = batchRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "License batch not found: " + id));
        return toDtoWithDerivedCounts(batch);
    }

    /**
     * v0.47：核销 / 总量 真实派生 + 自愈。
     *
     * <p>历史上 batch.totalCount / activatedCount 是 denormalized 列，靠
     * createBatch / mintKeys / activate 三处协同 +/-，曾出现：
     * <ul>
     *   <li>revokeKey 时未对 activatedCount 减回（v0.46 之前），导致只增不减；</li>
     *   <li>运营 / 测试手动改过列值；</li>
     *   <li>极端能见 activatedCount &gt; totalCount，admin UI「核销 / 总量」展示 110 / 20。</li>
     * </ul>
     * 这里把 DTO 返回值改成对 keys 表的直接计数；同时把派生值回写存储列（用于
     * EXHAUSTED 状态机判定等下游逻辑），并对状态做一次自愈：
     * <ul>
     *   <li>activatedCount &lt; totalCount &amp; status==EXHAUSTED → 回 ACTIVE；</li>
     *   <li>activatedCount &gt;= totalCount &amp; status==ACTIVE → EXHAUSTED；</li>
     *   <li>REVOKED / EXPIRED 不主动改回（人工状态权重高）。</li>
     * </ul>
     */
    private LicenseBatchDto toDtoWithDerivedCounts(LicenseBatch batch) {
        long derivedTotal = keyRepo.countByBatchId(batch.getId());
        long derivedActivated = keyRepo.countByBatchIdAndStatus(
                batch.getId(), LicenseKey.LicenseKeyStatus.ACTIVATED);

        boolean drifted = batch.getTotalCount() != derivedTotal
                || batch.getActivatedCount() != derivedActivated;
        if (drifted) {
            log.warn("[license-counter] self-heal batchId={} name='{}' storedTotal={} → derivedTotal={} | storedActivated={} → derivedActivated={}",
                    batch.getId(), batch.getName(),
                    batch.getTotalCount(), derivedTotal,
                    batch.getActivatedCount(), derivedActivated);
            batch.setTotalCount((int) Math.min(derivedTotal, Integer.MAX_VALUE));
            batch.setActivatedCount((int) Math.min(derivedActivated, Integer.MAX_VALUE));

            // 状态机微调：仅在 ACTIVE ↔ EXHAUSTED 之间自愈；REVOKED / EXPIRED 是运营人工决策，保留。
            if (batch.getStatus() == LicenseBatch.LicenseBatchStatus.EXHAUSTED
                    && derivedActivated < derivedTotal) {
                batch.setStatus(LicenseBatch.LicenseBatchStatus.ACTIVE);
            } else if (batch.getStatus() == LicenseBatch.LicenseBatchStatus.ACTIVE
                    && derivedTotal > 0 && derivedActivated >= derivedTotal) {
                batch.setStatus(LicenseBatch.LicenseBatchStatus.EXHAUSTED);
            }
            batchRepo.save(batch);
        }
        return LicenseBatchDto.fromDerived(batch, derivedTotal, derivedActivated);
    }

    @Transactional
    public LicenseBatchDto createBatch(Map<String, Object> body) {
        int count = getInt(body, "totalCount", 1);
        String name = getString(body, "name");
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "批次 name 不能为空");
        }

        // v0.36：批次必须绑定一个销售渠道（SellingChannel），issuerTenantId 仅向后兼容老路径
        String sellingChannelId = getString(body, "sellingChannelId");
        String issuerTenantId = getString(body, "issuerTenantId");
        if ((sellingChannelId == null || sellingChannelId.isBlank())
                && (issuerTenantId == null || issuerTenantId.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "sellingChannelId 不能为空（或提供 issuerTenantId 走老路径）");
        }
        if (sellingChannelId != null && !sellingChannelId.isBlank()) {
            sellingChannelService.requireActive(sellingChannelId); // 校验存在且 ACTIVE
        }

        // v0.53：批次可激活的子产品（数组或 CSV；空 = 全站可用）。
        // 仅保留 PlatformSupport.ALL 中的已知平台；未知值静默丢弃后若为空仍按全站处理。
        String platformsCsv = parsePlatforms(body.get("platforms"));

        // v0.53（审计 #5）：tier 白名单校验 —— 之前是自由 string，三方注释各说各话。
        // 契约收敛为 6 档宽集（admin UI 当前只暴露 basic/premium 两档，其余为预留档位）。
        String tier = normalizeTier(getString(body, "tier"));

        LicenseBatch batch = LicenseBatch.builder()
                .id(UUID.randomUUID().toString())
                .batchNo("BATCH-" + System.currentTimeMillis())
                .name(name)
                .issuerTenantId(issuerTenantId) // 可为 null
                .sellingChannelId(sellingChannelId)
                .tier(tier)
                .platforms(platformsCsv)
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

    /**
     * v0.31+: 在指定 batch 下新铸 N 把 key，**一次性返回 raw codes**（仅本次响应；DB 只存 sha256）。
     * 用途：admin 给具体用户发码（与 createBatch 不同的是不另建 batch；与 listKeys 不同的是
     * 此处暴露明文供线下/线上分发）。
     * 注意：raw codes 是敏感信息，调用方有责任安全传递；server 不留存。
     */
    public java.util.List<String> mintKeysAndReturnRawCodes(String batchId, int count) {
        if (count <= 0 || count > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "count 必须在 1..100");
        }
        LicenseBatch batch = batchRepo.findById(batchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "批次不存在"));
        if (batch.getStatus() != LicenseBatch.LicenseBatchStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "批次状态非 ACTIVE，无法铸码");
        }
        java.util.List<String> raws = new java.util.ArrayList<>(count);
        Instant now = Instant.now();
        for (int i = 0; i < count; i++) {
            String rawCode = UUID.randomUUID().toString().replace("-", "").toUpperCase();
            String codeHash = sha256(rawCode);
            String maskedCode = "AISTAR-" + rawCode.substring(0, 4) + "-****-****-" + rawCode.substring(rawCode.length() - 4);
            LicenseKey key = LicenseKey.builder()
                    .id(UUID.randomUUID().toString())
                    .batchId(batchId)
                    .codeHash(codeHash)
                    .maskedCode(maskedCode)
                    .status(LicenseKey.LicenseKeyStatus.CREATED)
                    .createdAt(now)
                    .build();
            keyRepo.save(key);
            raws.add(rawCode);
        }
        // 同步 totalCount
        batch.setTotalCount(batch.getTotalCount() + count);
        batchRepo.save(batch);
        return raws;
    }

    @Transactional
    public LicenseKeyDto revokeKey(String id) {
        LicenseKey key = keyRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "License key not found: " + id));
        // v0.47：撤销前若已激活，需把对应批次的 activatedCount 减回 1，避免 denormalized 列只增不减。
        // DTO 已改走 keys 表派生 + 自愈，理论上这里可不再维护；但 service 层下游仍然有 batch.activatedCount
        // 读取场景（如 EXHAUSTED 状态机），保持对称性以避免后续 regress。
        boolean wasActivated = key.getStatus() == LicenseKey.LicenseKeyStatus.ACTIVATED;
        key.setStatus(LicenseKey.LicenseKeyStatus.REVOKED);
        LicenseKey saved = keyRepo.save(key);
        if (wasActivated && key.getBatchId() != null) {
            batchRepo.findById(key.getBatchId()).ifPresent(batch -> {
                int newCount = Math.max(0, batch.getActivatedCount() - 1);
                batch.setActivatedCount(newCount);
                if (batch.getStatus() == LicenseBatch.LicenseBatchStatus.EXHAUSTED
                        && newCount < batch.getTotalCount()) {
                    batch.setStatus(LicenseBatch.LicenseBatchStatus.ACTIVE);
                }
                batchRepo.save(batch);
            });
        }
        return LicenseKeyDto.from(saved);
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

    /**
     * v0.53（审计 #5）：tier 档位白名单。与 admin types/license.ts 的 LICENSE_TIERS 注释
     * 及 LicenseBatch.tier javadoc 三方对齐的唯一真源：6 档宽集；admin UI 当前只暴露
     * basic / premium，其余档位预留（trial / standard / annual_pro / city_agent）。
     */
    private static final java.util.Set<String> KNOWN_TIERS =
            java.util.Set.of("trial", "basic", "standard", "premium", "annual_pro", "city_agent");

    /** tier 归一化 + 白名单校验；null/空 = 不设档位（按 initialCreditGrant 派生展示）。 */
    private String normalizeTier(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String t = raw.trim().toLowerCase(java.util.Locale.ROOT);
        if (!KNOWN_TIERS.contains(t)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "tier 必须是 trial / basic / standard / premium / annual_pro / city_agent 之一（或留空）");
        }
        return t;
    }

    /**
     * v0.53：解析批次 platforms 入参 —— 兼容 JSON 数组（["aiavatar"]）与 CSV 字符串
     * （"music,drama"）。清洗 / 去重 / 仅保留已知平台由 PlatformSupport.toCsv 完成；
     * 空结果返回 null（= 全站可用）。
     */
    private String parsePlatforms(Object raw) {
        if (raw == null) return null;
        if (raw instanceof java.util.Collection<?> coll) {
            java.util.List<String> items = coll.stream()
                    .filter(java.util.Objects::nonNull)
                    .map(Object::toString)
                    .toList();
            return PlatformSupport.toCsv(items);
        }
        return PlatformSupport.toCsv(PlatformSupport.parse(raw.toString()));
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
