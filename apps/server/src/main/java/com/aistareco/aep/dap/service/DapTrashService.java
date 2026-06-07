package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.dto.DapDtos.TrashItemDto;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapDerivative;
import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.model.DapLicense;
import com.aistareco.aep.dap.model.DapLook;
import com.aistareco.aep.dap.model.DapPhoto;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapAvatarVersionRepository;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapDerivativeRepository;
import com.aistareco.aep.dap.repository.DapJobRepository;
import com.aistareco.aep.dap.repository.DapLicenseRepository;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.dap.repository.DapPhotoRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 数字人回收站：软删（30 天可恢复）→ 恢复 / 彻底删除 / 到期自动物理清理。
 *
 * - 软删：deletedAt=now，列表/详情自然不可见（既有查询过滤 deletedAt IS NULL）；
 *   顺带对该数字人 queued/running 任务置 cancelRequested（runner 在检查点感知后释放冻结积分）。
 * - 物理清理：删全部关联行（versions / looks / derivatives / photos / captures / licenses / jobs）
 *   + best-effort 删存储文件（LedgerEntry 账本不动 —— 审计真值）。
 */
@Service
public class DapTrashService {

    private static final Logger log = LoggerFactory.getLogger(DapTrashService.class);

    private final DapAvatarRepository avatarRepo;
    private final DapAvatarVersionRepository versionRepo;
    private final DapLookRepository lookRepo;
    private final DapDerivativeRepository derivRepo;
    private final DapPhotoRepository photoRepo;
    private final DapCaptureRepository captureRepo;
    private final DapLicenseRepository licenseRepo;
    private final DapJobRepository jobRepo;
    private final FileStorageService storage;
    private final DapProperties props;

    public DapTrashService(DapAvatarRepository avatarRepo,
                           DapAvatarVersionRepository versionRepo,
                           DapLookRepository lookRepo,
                           DapDerivativeRepository derivRepo,
                           DapPhotoRepository photoRepo,
                           DapCaptureRepository captureRepo,
                           DapLicenseRepository licenseRepo,
                           DapJobRepository jobRepo,
                           FileStorageService storage,
                           DapProperties props) {
        this.avatarRepo = avatarRepo;
        this.versionRepo = versionRepo;
        this.lookRepo = lookRepo;
        this.derivRepo = derivRepo;
        this.photoRepo = photoRepo;
        this.captureRepo = captureRepo;
        this.licenseRepo = licenseRepo;
        this.jobRepo = jobRepo;
        this.storage = storage;
        this.props = props;
    }

    public int retentionDays() {
        return Math.max(1, props.getTrashRetentionDays());
    }

    // ── 软删 / 列表 / 恢复 / 彻底删除 ───────────────────────────

    @Transactional
    public void softDelete(String userId, String id) {
        DapAvatar a = ownedAny(userId, id);
        if (a.getDeletedAt() != null) return; // 已在回收站，幂等
        a.setDeletedAt(Instant.now());
        a.setUpdatedAt(Instant.now());
        avatarRepo.save(a);
        // best-effort：取消该数字人进行中的任务（runner 检查点感知后退回冻结积分）
        try {
            for (DapJob j : jobRepo.findByAvatarId(id)) {
                if ("queued".equals(j.getStatus()) || "running".equals(j.getStatus())) {
                    j.setCancelRequested(true);
                    jobRepo.save(j);
                }
            }
        } catch (Exception e) {
            log.warn("[dap-trash] cancel running jobs failed avatar={}: {}", id, e.getMessage());
        }
        log.info("[dap-trash] soft-deleted avatar={} owner={} retentionDays={}", id, userId, retentionDays());
    }

    public List<TrashItemDto> listTrash(String userId) {
        return avatarRepo.findByOwnerUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(userId).stream()
                .map(a -> TrashItemDto.from(a, retentionDays(), storage::signedUrl))
                .toList();
    }

    @Transactional
    public void restore(String userId, String id) {
        DapAvatar a = ownedAny(userId, id);
        if (a.getDeletedAt() == null) return; // 不在回收站，幂等
        a.setDeletedAt(null);
        a.setUpdatedAt(Instant.now());
        avatarRepo.save(a);
        log.info("[dap-trash] restored avatar={} owner={}", id, userId);
    }

    /** 立即彻底删除（仅允许对已在回收站的资产执行，防误触）。 */
    @Transactional
    public void purge(String userId, String id) {
        DapAvatar a = ownedAny(userId, id);
        if (a.getDeletedAt() == null) {
            throw BusinessException.badRequest("DAP_NOT_IN_TRASH", "请先删除（移入回收站）后再彻底删除");
        }
        hardDelete(a);
    }

    // ── 到期清理（调度器入口）──────────────────────────────────

    /** 物理清理回收站超期条目；单条失败只 log，下次重试。返回清理条数。 */
    public int purgeExpired() {
        Instant cutoff = Instant.now().minusSeconds(retentionDays() * 86400L);
        List<DapAvatar> expired = avatarRepo.findByDeletedAtBefore(cutoff);
        int done = 0;
        for (DapAvatar a : expired) {
            try {
                hardDelete(a);
                done++;
            } catch (Exception e) {
                log.warn("[dap-trash] purge expired failed avatar={}: {}", a.getId(), e.getMessage());
            }
        }
        if (!expired.isEmpty()) {
            log.info("[dap-trash] purge expired: {}/{} cleaned (cutoff={})", done, expired.size(), cutoff);
        }
        return done;
    }

    // ── 物理删除（行 + 文件）──────────────────────────────────

    @Transactional
    public void hardDelete(DapAvatar a) {
        String id = a.getId();
        Set<String> keys = new LinkedHashSet<>();
        addKey(keys, a.getImageKey());
        if (a.getVariantKeys() != null) a.getVariantKeys().forEach(k -> addKey(keys, k));
        if (a.getShotKeys() != null) a.getShotKeys().values().forEach(v -> addKey(keys, v == null ? null : String.valueOf(v)));

        versionRepo.findByAvatarIdOrderByVDesc(id).forEach(v -> { addKey(keys, v.getImageKey()); versionRepo.delete(v); });
        for (DapLook l : lookRepo.findByAvatarIdOrderByCreatedAtDesc(id)) { addKey(keys, l.getImageKey()); lookRepo.delete(l); }
        for (DapDerivative d : derivRepo.findByAvatarIdOrderByDerivKeyAscIdxAsc(id)) {
            addKey(keys, d.getFileKey()); addKey(keys, d.getThumbKey()); derivRepo.delete(d);
        }
        for (DapPhoto p : photoRepo.findByAvatarIdOrderByCreatedAtAsc(id)) { addKey(keys, p.getFileKey()); photoRepo.delete(p); }
        for (DapCapture c : captureRepo.findByAvatarId(id)) { addKey(keys, c.getFootageKey()); addKey(keys, c.getFrameKey()); captureRepo.delete(c); }
        for (DapLicense lic : licenseRepo.findByAvatarId(id)) { addKey(keys, lic.getCertKey()); licenseRepo.delete(lic); }
        for (DapJob j : jobRepo.findByAvatarId(id)) { jobRepo.delete(j); } // LedgerEntry 保留（审计）

        avatarRepo.delete(a);

        int filesDeleted = 0;
        for (String k : keys) {
            try {
                storage.delete(k);
                filesDeleted++;
            } catch (Exception e) {
                log.warn("[dap-trash] delete file failed key={}: {}", k, e.getMessage());
            }
        }
        log.info("[dap-trash] hard-deleted avatar={} owner={} files={}/{}", id, a.getOwnerUserId(), filesDeleted, keys.size());
    }

    private static void addKey(Set<String> keys, String k) {
        if (k != null && !k.isBlank()) keys.add(k);
    }

    /** 按 owner 取行（不过滤 deletedAt —— 回收站操作需要拿到软删行）。 */
    private DapAvatar ownedAny(String userId, String id) {
        return avatarRepo.findByIdAndOwnerUserId(id, userId)
                .orElseThrow(() -> BusinessException.notFound("DAP_AVATAR_NOT_FOUND", "数字人不存在或无权访问"));
    }
}
