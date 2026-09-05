package com.aistareco.aep.identity;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 老用户一次性导入（{@code docs/unified-identity-plan.md} §12.3）。
 *
 * <p>把「有手机号且还没有 uid」的本地账号按批送到账号中心
 * {@code POST /api/products/aistar/import-users}，用返回的 uid 回写 {@code identity_uid}。
 *
 * <p>幂等：回写过 {@code identity_uid} 的行不再进候选集，重跑只处理剩下的。
 * 分批用 **id 游标**而不是 offset —— 处理过程中候选集在缩小，offset 会漏行。
 *
 * <p>{@code dryRun=true} 只统计候选条数，**不调账号中心**（那个端点会真的建 uid）、不写库。
 *
 * <p>§8.0：账号中心未配置 → 503，不做任何本地伪造。
 */
@Service
public class IdentityImportService {

    private static final Logger log = LoggerFactory.getLogger(IdentityImportService.class);

    /** 账号中心单批上限（§12.3）。 */
    private static final int MAX_BATCH = 500;
    private static final int DEFAULT_BATCH = 200;
    /** 单次调用的批次上限，防止一个请求跑到天荒地老。 */
    private static final int MAX_BATCHES_PER_CALL = 200;

    private final AepUserRepository userRepo;
    private final IdentityCenterClient client;

    public IdentityImportService(AepUserRepository userRepo, IdentityCenterClient client) {
        this.userRepo = userRepo;
        this.client = client;
    }

    /** 导入统计。字段名即 wire 契约（`/api/admin/identity/import` 响应体）。 */
    public record ImportReport(int scanned, int linked, int created, int skipped, int errors) {}

    public ImportReport run(Integer requestedBatchSize, boolean dryRun) {
        if (!client.isEnabled()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "IDENTITY_NOT_CONFIGURED",
                    "统一账号中心未配置，无法导入。请在 /etc/aistareco/server.env 配置 "
                            + "AEP_ID_ISSUER 与 AEP_ID_CLIENT_SECRET 后重启 server。");
        }
        int batchSize = clamp(requestedBatchSize == null ? DEFAULT_BATCH : requestedBatchSize);
        int scanned = 0, linked = 0, created = 0, skipped = 0, errors = 0;
        String cursor = "";

        for (int batch = 0; batch < MAX_BATCHES_PER_CALL; batch++) {
            List<AepUser> candidates =
                    userRepo.findImportCandidates(cursor, PageRequest.of(0, batchSize));
            if (candidates.isEmpty()) break;
            cursor = candidates.get(candidates.size() - 1).getId();
            scanned += candidates.size();
            if (dryRun) continue;

            Map<String, AepUser> byLocalId = new HashMap<>();
            List<IdentityCenterClient.ImportRequestItem> payload = new ArrayList<>(candidates.size());
            for (AepUser user : candidates) {
                byLocalId.put(user.getId(), user);
                payload.add(new IdentityCenterClient.ImportRequestItem(user.getId(), user.getPhone()));
            }

            List<IdentityCenterClient.ImportResultItem> results = client.importUsers(payload);
            for (IdentityCenterClient.ImportResultItem item : results) {
                AepUser user = item.localSubjectId() == null ? null : byLocalId.get(item.localSubjectId());
                if (user == null) {
                    log.warn("[identity] 导入返回了不在本批的 localSubjectId={}，忽略", item.localSubjectId());
                    errors++;
                    continue;
                }
                if (item.skipped() != null) {
                    log.info("[identity] 导入跳过 localUserId={} reason={}", user.getId(), item.skipped());
                    skipped++;
                    continue;
                }
                if (item.uid() == null || item.uid().isBlank()) {
                    log.warn("[identity] 导入返回缺 uid localUserId={}", user.getId());
                    errors++;
                    continue;
                }
                try {
                    user.setIdentityUid(item.uid());
                    user.setUpdatedAt(Instant.now());
                    userRepo.saveAndFlush(user);
                    linked++;
                    if (item.created()) created++;
                } catch (DataIntegrityViolationException e) {
                    // 同一个 uid 已挂在另一条本地档案上（历史重复账号）——不能自动合并业务数据。
                    log.warn("[identity] 回写 identity_uid 冲突，需人工处理 localUserId={} uid={} err={}",
                            user.getId(), item.uid(), e.getMostSpecificCause().getMessage());
                    errors++;
                }
            }
            if (results.isEmpty()) {
                log.warn("[identity] 账号中心对 {} 条候选返回空结果，停止本次导入", candidates.size());
                errors += candidates.size();
                break;
            }
        }

        ImportReport report = new ImportReport(scanned, linked, created, skipped, errors);
        log.info("[identity] 导入完成 dryRun={} batchSize={} report={}", dryRun, batchSize, report);
        return report;
    }

    private static int clamp(int value) {
        if (value < 1) return 1;
        return Math.min(value, MAX_BATCH);
    }
}
