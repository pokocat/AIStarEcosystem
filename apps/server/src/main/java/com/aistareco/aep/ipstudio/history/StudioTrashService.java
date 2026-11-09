package com.aistareco.aep.ipstudio.history;

import com.aistareco.aep.ipstudio.director.DirectorWork;
import com.aistareco.aep.ipstudio.director.DirectorWorkRepository;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import com.aistareco.aep.ipstudio.repository.IpProjectRevisionRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;

/**
 * 画布与导演台作品的「彻底删除」和到期清理。
 *
 * <p>彻底删除只删画布 / 作品本身（含画布历史版本），<b>不删</b>生成记录（IpRun，计费与任务历史的依据）和文件
 * （生成的图片、视频已收进资产库，可能还被别的画布引用）。只能删回收站里的；还有生成中的任务时拒绝。
 *
 * <p>到期清理：{@code aep.ipstudio.trash-retention-days} &gt; 0 时每天清一次删除超过该天数的；默认 0 = 不自动清理（不改变现有行为）。
 */
@Service
public class StudioTrashService {
    private static final Logger log = LoggerFactory.getLogger(StudioTrashService.class);

    private final IpProjectRepository projects;
    private final IpProjectRevisionRepository revisions;
    private final DirectorWorkRepository works;
    private final IpRunRepository runs;
    private final TransactionTemplate tx;
    private final int retentionDays;

    public StudioTrashService(IpProjectRepository projects, IpProjectRevisionRepository revisions, DirectorWorkRepository works,
                              IpRunRepository runs, org.springframework.transaction.PlatformTransactionManager txManager,
                              @Value("${aep.ipstudio.trash-retention-days:0}") int retentionDays) {
        this.projects = projects; this.revisions = revisions; this.works = works; this.runs = runs;
        this.tx = new TransactionTemplate(txManager);
        this.retentionDays = Math.max(0, retentionDays);
    }

    public int retentionDays() { return retentionDays; }

    @Transactional
    public void purgeCanvas(String user, String id) {
        IpProject p = projects.findById(id).filter(x -> user.equals(x.getOwnerUserId()))
                .orElseThrow(() -> BusinessException.notFound("IP_PROJECT_NOT_FOUND", "这张画布不存在"));
        if (p.getDeletedAt() == null) throw conflict("IP_PROJECT_NOT_IN_TRASH", "请先删除画布，再从回收站彻底删除");
        if (hasRunning(id)) throw conflict("IP_PROJECT_BUSY", "这张画布还有生成中的任务，请等任务结束后再彻底删除");
        revisions.deleteAll(revisions.findByProjectIdOrderByCreatedAtDesc(id));
        projects.delete(p);
        log.info("[trash] canvas purged user={} project={}", user, id);
    }

    @Transactional
    public void purgeWork(String user, String id) {
        DirectorWork w = works.lockById(id).filter(x -> user.equals(x.getOwnerUserId()))
                .orElseThrow(() -> BusinessException.notFound("DIRECTOR_WORK_NOT_FOUND", "这部作品不存在"));
        if (w.getDeletedAt() == null) throw conflict("DIRECTOR_WORK_NOT_IN_TRASH", "请先删除作品，再从回收站彻底删除");
        if (hasRunning(id)) throw conflict("DIRECTOR_WORK_BUSY", "这部作品还有生成中的任务，请等任务结束后再彻底删除");
        works.delete(w);
        log.info("[trash] director work purged user={} work={}", user, id);
    }

    /** 每天 04:20 清一次过期的回收站内容；retentionDays=0 时不做任何事。单条失败不影响其余。 */
    @Scheduled(cron = "${aep.ipstudio.trash-purge-cron:0 20 4 * * *}")
    public void purgeExpired() {
        if (retentionDays <= 0) return;
        Instant cutoff = Instant.now().minus(Duration.ofDays(retentionDays));
        int purged = 0;
        for (Object[] row : projects.trashedBefore(cutoff)) {
            String id = (String) row[0], owner = (String) row[1];
            try { tx.executeWithoutResult(s -> purgeCanvas(owner, id)); purged++; }
            catch (RuntimeException e) { log.warn("[trash] expired canvas kept project={}: {}", id, e.getMessage()); }
        }
        for (DirectorWork w : works.findByDeletedAtBefore(cutoff)) {
            try { tx.executeWithoutResult(s -> purgeWork(w.getOwnerUserId(), w.getId())); purged++; }
            catch (RuntimeException e) { log.warn("[trash] expired work kept work={}: {}", w.getId(), e.getMessage()); }
        }
        if (purged > 0) log.info("[trash] expired purge done count={} retentionDays={}", purged, retentionDays);
    }

    private boolean hasRunning(String projectId) {
        return runs.findByProjectIdOrderByCreatedAtDesc(projectId).stream().anyMatch(r -> IpRun.STATUS_RUNNING.equals(r.getStatus()));
    }

    private static BusinessException conflict(String code, String message) {
        return new BusinessException(HttpStatus.CONFLICT, code, message);
    }
}
