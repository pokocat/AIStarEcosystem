package com.aistareco.aep.service.storage;

import com.aistareco.aep.dto.StorageUsageDto;
import com.aistareco.aep.model.StorageAsset;
import com.aistareco.aep.model.StorageGrant;
import com.aistareco.aep.repository.StorageAssetRepository;
import com.aistareco.aep.repository.StorageGrantRepository;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 通用存储配额服务（v0.92）—— 任意子应用对接：记账 / 查用量余量 / 释放 / 配额校验。
 *
 * 配额「admin 后台可配」：读 PlatformConfig key {@code storage.quota_mb.<app>}，
 * 缺省回落 {@code storage.quota_mb.default}（再缺省 {@link #DEFAULT_QUOTA_MB}）。
 * 每个子应用各配各的额度，未来按套餐分级也只需扩展这里的 {@link #quotaMb}。
 *
 * §8.0：记账是观测类 best-effort —— record/release 出错只 WARN，绝不阻断业务主链路。
 */
@Service
public class StorageQuotaService {

    private static final Logger log = LoggerFactory.getLogger(StorageQuotaService.class);
    private static final long BYTES_PER_MB = 1024L * 1024L;
    /** 缺省配额（MB）：5 GB。 */
    public static final long DEFAULT_QUOTA_MB = 5120;

    private final StorageAssetRepository repo;
    private final StorageGrantRepository grantRepo;
    private final PlatformConfigService configs;

    public StorageQuotaService(StorageAssetRepository repo, StorageGrantRepository grantRepo, PlatformConfigService configs) {
        this.repo = repo;
        this.grantRepo = grantRepo;
        this.configs = configs;
    }

    /** 记一笔占用（幂等：同 cdnKey 不重复记）。best-effort，不抛。 */
    @Transactional
    public void record(String app, String userId, String category, String refId, String cdnKey, long bytes) {
        if (app == null || userId == null || cdnKey == null || cdnKey.isBlank() || bytes <= 0) return;
        try {
            if (repo.existsByCdnKey(cdnKey)) return;
            repo.save(StorageAsset.builder()
                    .id("sa_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16))
                    .app(app)
                    .ownerUserId(userId)
                    .category(category == null || category.isBlank() ? "其他" : category)
                    .refId(refId)
                    .cdnKey(cdnKey)
                    .bytes(bytes)
                    .createdAt(OffsetDateTime.now())
                    .build());
        } catch (Exception e) {
            log.warn("[storage] record failed app={} user={} key={}: {}", app, userId, cdnKey, e.getMessage());
        }
    }

    /** 彻底删除某业务对象（如短剧项目）时释放其占用。best-effort，不抛。 */
    @Transactional
    public void releaseByRef(String app, String refId) {
        if (app == null || refId == null) return;
        try {
            repo.deleteByAppAndRefId(app, refId);
        } catch (Exception e) {
            log.warn("[storage] release failed app={} ref={}: {}", app, refId, e.getMessage());
        }
    }

    /** 该子应用基础配额（MB），admin 可配（不含用户购买扩容）。 */
    public long quotaMb(String app) {
        long byApp = configs.getLong("storage.quota_mb." + app, -1);
        if (byApp > 0) return byApp;
        return configs.getLong("storage.quota_mb.default", DEFAULT_QUOTA_MB);
    }

    /** 某用户某子应用的实际配额（MB）= 基础配额 + 已购存储扩容。 */
    public long quotaMb(String app, String userId) {
        return quotaMb(app) + grantRepo.sumActiveMb(app, userId, OffsetDateTime.now());
    }

    /**
     * 授予存储扩容（购买存储套餐结算时调用，幂等 by source）。best-effort 记录，但购买结算不应吞错，故抛。
     */
    @Transactional
    public void grantStorage(String app, String userId, long mb, String source, OffsetDateTime expiresAt) {
        if (app == null || userId == null || mb <= 0 || source == null) return;
        if (grantRepo.existsBySource(source)) return; // 幂等：同一订单不重复授予
        grantRepo.save(StorageGrant.builder()
                .id("sg_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16))
                .app(app)
                .ownerUserId(userId)
                .mb(mb)
                .source(source)
                .createdAt(OffsetDateTime.now())
                .expiresAt(expiresAt)
                .build());
    }

    /** 用量视图：used / quota（基础 + 购买扩容） / remaining + 分类明细。 */
    public StorageUsageDto usage(String app, String userId) {
        long usedMb = toMb(repo.sumBytes(app, userId));
        long quotaMb = quotaMb(app, userId);
        List<StorageUsageDto.Slice> breakdown = new ArrayList<>();
        for (Object[] row : repo.sumBytesByCategory(app, userId)) {
            long mb = toMb(((Number) row[1]).longValue());
            if (mb > 0) breakdown.add(new StorageUsageDto.Slice((String) row[0], mb));
        }
        return new StorageUsageDto(app, usedMb, quotaMb, Math.max(0, quotaMb - usedMb), breakdown);
    }

    /** 可选配额校验：超额抛 402 STORAGE_QUOTA_EXCEEDED。调用方按需在上传 / 生成前调用。 */
    public void checkQuota(String app, String userId, long addBytes) {
        long quota = quotaMb(app, userId);
        long quotaBytes = quota * BYTES_PER_MB;
        long used = repo.sumBytes(app, userId);
        if (used + Math.max(0, addBytes) > quotaBytes) {
            throw new BusinessException(HttpStatus.PAYMENT_REQUIRED, "STORAGE_QUOTA_EXCEEDED",
                    "存储空间已满（" + toMb(used) + " / " + quota + " MB），请清理或购买存储套餐后再试。");
        }
    }

    private static long toMb(long bytes) {
        if (bytes <= 0) return 0;
        return Math.max(1, Math.round((double) bytes / BYTES_PER_MB));
    }
}
