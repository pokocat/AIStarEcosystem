package com.aistareco.aep.ipstudio.history;

import com.aistareco.aep.ipstudio.director.DirectorService;
import com.aistareco.aep.ipstudio.director.DirectorWork;
import com.aistareco.aep.ipstudio.director.DirectorWorkRepository;
import com.aistareco.aep.ipstudio.execution.IpPlanExecution;
import com.aistareco.aep.ipstudio.execution.IpPlanExecutionRepository;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import com.aistareco.aep.ipstudio.repository.IpProjectRevisionRepository;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * 画布与导演台作品的「彻底删除」和到期清理。
 *
 * <p>彻底删除只删画布 / 作品本身（含画布历史版本），<b>不删</b>生成记录（IpRun，计费与任务历史的依据）和文件
 * （生成的图片、视频已收进资产库，可能还被别的画布引用）。只能删回收站里的。
 *
 * <p>并发：与恢复抢同一把行锁（画布 {@code IpProjectRepository.lockById}、作品 {@code DirectorWorkRepository.lockById}），
 * 锁内重新核对「仍在回收站」（到期清理还要核对删除时间仍早于截止点），避免恢复成功后又被删。
 *
 * <p>在途核对与导演台删除同一口径：任务记录未结束、绑定的原生视频任务未结束 / 受理待核对 / 查不到 / 归属不符、
 * 制作计划仍在跑或还有在途子任务，一律拒绝（409 *_BUSY），付费任务结束前不能把宿主删掉。
 *
 * <p>到期清理：{@code aep.ipstudio.trash-retention-days} &gt; 0 时每天清一次；默认 0 = 不自动清理（不改变现有行为）。
 */
@Service
public class StudioTrashService {
    private static final Logger log = LoggerFactory.getLogger(StudioTrashService.class);
    private static final Set<String> VIDEO_TERMINAL = Set.of("succeeded", "failed");
    private static final List<String> LIVE_EXECUTIONS = List.of(IpPlanExecution.RUNNING, IpPlanExecution.PAUSED, IpPlanExecution.NEEDS_USER,
            IpPlanExecution.PARTIAL, IpPlanExecution.CANCELED);

    private final IpProjectRepository projects;
    private final IpProjectRevisionRepository revisions;
    private final DirectorWorkRepository works;
    private final IpRunRepository runs;
    private final MaterialVideoJobRepository videoJobs;
    private final IpPlanExecutionRepository executions;
    private final DirectorService director;
    private final ObjectMapper om;
    private final TransactionTemplate tx;
    private final int retentionDays;

    public StudioTrashService(IpProjectRepository projects, IpProjectRevisionRepository revisions, DirectorWorkRepository works,
                              IpRunRepository runs, MaterialVideoJobRepository videoJobs, IpPlanExecutionRepository executions,
                              @Lazy DirectorService director, ObjectMapper om,
                              org.springframework.transaction.PlatformTransactionManager txManager,
                              @Value("${aep.ipstudio.trash-retention-days:0}") int retentionDays) {
        this.projects = projects; this.revisions = revisions; this.works = works; this.runs = runs;
        this.videoJobs = videoJobs; this.executions = executions; this.director = director; this.om = om;
        this.tx = new TransactionTemplate(txManager);
        this.tx.setIsolationLevel(TransactionTemplate.ISOLATION_READ_COMMITTED);
        this.retentionDays = Math.max(0, retentionDays);
    }

    public int retentionDays() { return retentionDays; }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void purgeCanvas(String user, String id) { purgeCanvas(user, id, null); }

    /** cutoff 非空时只删删除时间早于它的（到期清理用）；锁内重新核对，期间被恢复的不删。 */
    void purgeCanvas(String user, String id, Instant cutoff) {
        IpProject p = projects.lockById(id).filter(x -> user.equals(x.getOwnerUserId()))
                .orElseThrow(() -> BusinessException.notFound("IP_PROJECT_NOT_FOUND", "这张画布不存在"));
        if (p.getDeletedAt() == null) throw conflict("IP_PROJECT_NOT_IN_TRASH", "请先删除画布，再从回收站彻底删除");
        if (cutoff != null && !p.getDeletedAt().isBefore(cutoff)) throw conflict("IP_PROJECT_NOT_EXPIRED", "还没到自动清理的时间");
        String busy = canvasBusyReason(id, user);
        if (busy != null) throw conflict("IP_PROJECT_BUSY", busy);
        revisions.deleteAll(revisions.findByProjectIdOrderByCreatedAtDesc(id));
        projects.delete(p);
        log.info("[trash] canvas purged user={} project={} expired={}", user, id, cutoff != null);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void purgeWork(String user, String id) { purgeWork(user, id, null); }

    void purgeWork(String user, String id, Instant cutoff) {
        DirectorWork w = works.lockById(id).filter(x -> user.equals(x.getOwnerUserId()))
                .orElseThrow(() -> BusinessException.notFound("DIRECTOR_WORK_NOT_FOUND", "这部作品不存在"));
        if (w.getDeletedAt() == null) throw conflict("DIRECTOR_WORK_NOT_IN_TRASH", "请先删除作品，再从回收站彻底删除");
        if (cutoff != null && !w.getDeletedAt().isBefore(cutoff)) throw conflict("DIRECTOR_WORK_NOT_EXPIRED", "还没到自动清理的时间");
        String busy = director.purgeBlockReason(w);
        if (busy != null) throw conflict("DIRECTOR_WORK_BUSY", busy);
        works.delete(w);
        log.info("[trash] director work purged user={} work={} expired={}", user, id, cutoff != null);
    }

    /** 每天 04:20 清一次过期的回收站内容；retentionDays=0 时不做任何事。单条失败不影响其余。 */
    @Scheduled(cron = "${aep.ipstudio.trash-purge-cron:0 20 4 * * *}")
    public void purgeExpired() {
        if (retentionDays <= 0) return;
        Instant cutoff = Instant.now().minus(Duration.ofDays(retentionDays));
        int purged = 0;
        for (Object[] row : projects.trashedBefore(cutoff)) {
            String id = (String) row[0], owner = (String) row[1];
            try { tx.executeWithoutResult(s -> purgeCanvas(owner, id, cutoff)); purged++; }
            catch (RuntimeException e) { log.warn("[trash] expired canvas kept project={}: {}", id, e.getMessage()); }
        }
        for (DirectorWork w : works.findByDeletedAtBefore(cutoff)) {
            try { tx.executeWithoutResult(s -> purgeWork(w.getOwnerUserId(), w.getId(), cutoff)); purged++; }
            catch (RuntimeException e) { log.warn("[trash] expired work kept work={}: {}", w.getId(), e.getMessage()); }
        }
        if (purged > 0) log.info("[trash] expired purge done count={} retentionDays={}", purged, retentionDays);
    }

    /** 画布上还有没结束的付费任务时返回原因；没有返回 null。 */
    String canvasBusyReason(String projectId, String owner) {
        Set<String> jobIds = new LinkedHashSet<>();
        for (Object[] r : runs.taskStates(projectId)) {
            String status = (String) r[0], stage = (String) r[1], input = (String) r[3];
            if (!IpRun.STATUS_DONE.equals(status) && !IpRun.STATUS_FAILED.equals(status)) return "这张画布还有生成中的任务，任务结束后再彻底删除";
            if ("video.bound".equals(stage)) {
                try { jobIds.addAll(IpProjectService.nativeVideoJobIds(om.readTree(input == null ? "{}" : input))); }
                catch (Exception e) { return "这张画布的视频任务状态暂时无法确认，请稍后再试"; }
            }
        }
        for (IpPlanExecution e : executions.findByProjectIdAndStatusIn(projectId, LIVE_EXECUTIONS)) {
            if (!IpPlanExecution.CANCELED.equals(e.getStatus()) && !IpPlanExecution.PARTIAL.equals(e.getStatus()))
                return "这张画布的制作计划还没结束，停止或完成后再彻底删除";
            if (e.getInFlight() > 0) return "这张画布还有生成中的任务，任务结束后再彻底删除";
        }
        if (jobIds.isEmpty()) return null;
        Map<String, Object[]> jobs = new HashMap<>();
        for (Object[] j : videoJobs.states(jobIds)) jobs.put((String) j[0], j);
        for (String jobId : jobIds) {
            Object[] job = jobs.get(jobId);
            if (job == null || !owner.equals(job[3])) {
                log.warn("[trash] 彻底删除前核对视频任务失败 project={} job={}", projectId, jobId);
                return "这张画布的视频任务状态暂时无法确认，请稍后再试";
            }
            if (VIDEO_TERMINAL.contains((String) job[1])) continue;
            if ("VIDEO_SUBMISSION_UNKNOWN".equals(job[2]) || "VIDEO_RECONCILIATION_PENDING".equals(job[2]))
                return "视频的提交结果还在核对，核对完成后再彻底删除";
            return "这张画布还有视频在生成，任务结束后再彻底删除";
        }
        return null;
    }

    private static BusinessException conflict(String code, String message) {
        return new BusinessException(HttpStatus.CONFLICT, code, message);
    }
}
