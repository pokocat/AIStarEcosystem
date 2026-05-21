package com.aistareco.aep.service;

import com.aistareco.aep.dto.MixcutPublishBatchRequest.ScheduleSpec;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.PublishBatchSummaryDto;
import com.aistareco.aep.dto.PublishJobDto;
import com.aistareco.aep.model.PublishJob;
import com.aistareco.aep.model.PublishJobStatus;
import com.aistareco.aep.repository.PublishJobRepository;
import com.aistareco.aep.service.publish.ScheduleExpander;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * v0.22: 分发中心「任务追踪」按 projectId 聚合的入口。
 *
 * 不替代 PublishJobService 的单条操作 —— cancel/retry 仍走原方法，本服务只是把它们
 * 包成 batch 操作，让前端一键搞定整批。reschedule 是新增能力。
 *
 * 设计要点：
 *   - 服务端分页：listBatches(userId, page, size) 走 2 步 query（先 projectId 分页页签，
 *     再 IN 拉所有 row），fold 成 PublishBatchSummaryDto[]。
 *   - cancel/retry 在 service 层做循环 + 单条 try/catch；部分成功不让单条失败拖累其他。
 *   - reschedule 只对 QUEUED 子集生效（已经 in-flight 的不动），复用 ScheduleExpander。
 */
@Service
public class PublishJobBatchService {

    private static final Logger log = LoggerFactory.getLogger(PublishJobBatchService.class);

    private final PublishJobRepository jobRepo;
    private final PublishJobService publishJobService;
    private final ScheduleExpander scheduleExpander;

    public PublishJobBatchService(PublishJobRepository jobRepo,
                                   PublishJobService publishJobService,
                                   ScheduleExpander scheduleExpander) {
        this.jobRepo = jobRepo;
        this.publishJobService = publishJobService;
        this.scheduleExpander = scheduleExpander;
    }

    // ── list ────────────────────────────────────────────────────────────

    public PageEnvelope<PublishBatchSummaryDto> listBatches(String userId, int page, int size) {
        if (userId == null || userId.isBlank()) {
            throw BusinessException.badRequest("UNAUTHENTICATED", "未登录");
        }
        if (page < 0) page = 0;
        if (size <= 0 || size > 100) size = 20;

        // 第一查：拉本页 projectId + maxC（已 GROUP BY；ORDER BY maxC DESC 走 Pageable Sort）。
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "maxC"));
        Page<Object[]> idsPage = jobRepo.findBatchProjectIdsByUserId(userId, pageable);
        if (idsPage.isEmpty()) {
            return PageEnvelope.from(new PageImpl<>(List.of(), pageable, idsPage.getTotalElements()));
        }

        // 保留 page 内顺序（最新批次在前）
        List<String> projectIds = new ArrayList<>(idsPage.getNumberOfElements());
        for (Object[] row : idsPage.getContent()) {
            projectIds.add((String) row[0]);
        }

        // 第二查：把这些 projectId 下所有 row 一次性 IN 拉回来，按 projectId 分组。
        List<PublishJob> rows = jobRepo.findByUserIdAndProjectIdInOrderByCreatedAtAsc(userId, projectIds);
        Map<String, List<PublishJob>> byProject = new HashMap<>();
        for (PublishJob j : rows) {
            byProject.computeIfAbsent(j.getProjectId(), k -> new ArrayList<>()).add(j);
        }

        // 按第一查的 projectId 顺序 fold 出 summary。
        List<PublishBatchSummaryDto> content = new ArrayList<>(projectIds.size());
        for (String pid : projectIds) {
            List<PublishJob> group = byProject.get(pid);
            if (group == null || group.isEmpty()) {
                // 极端竞态：第一查与第二查之间该 projectId 的所有 row 被删了 —— 跳过即可。
                log.warn("batch list: projectId {} disappeared between queries for user {}", pid, userId);
                continue;
            }
            content.add(PublishBatchSummaryDto.from(pid, group));
        }

        Page<PublishBatchSummaryDto> resultPage = new PageImpl<>(content, pageable, idsPage.getTotalElements());
        return PageEnvelope.from(resultPage);
    }

    public PublishBatchSummaryDto getBatchDetail(String userId, String projectId) {
        if (userId == null || userId.isBlank()) {
            throw BusinessException.badRequest("UNAUTHENTICATED", "未登录");
        }
        if (projectId == null || projectId.isBlank()) {
            throw BusinessException.badRequest("PROJECT_ID_REQUIRED", "缺少 projectId");
        }
        List<PublishJob> rows = jobRepo.findByUserIdAndProjectIdOrderByCreatedAtDesc(userId, projectId);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("BATCH_NOT_FOUND",
                    "未找到 projectId=" + projectId + " 的批次或不属于当前用户");
        }
        return PublishBatchSummaryDto.from(projectId, rows);
    }

    // ── bulk actions ────────────────────────────────────────────────────

    /**
     * 取消整批：循环非终态行调 publishJobService.cancel；逐条 try/catch 部分成功。
     * 返回受影响行的最新 DTO 列表（前端用来立刻刷新 Drawer，无需重拉）。
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public List<PublishJobDto> cancelBatch(String userId, String projectId) {
        List<PublishJob> rows = loadBatch(userId, projectId);
        List<PublishJobDto> affected = new ArrayList<>();
        for (PublishJob j : rows) {
            if (j.getStatus() == null || j.getStatus().isTerminal()) continue;
            try {
                affected.add(publishJobService.cancel(userId, j.getId()));
            } catch (BusinessException be) {
                log.warn("batch cancel: job {} skip ({}): {}", j.getId(), be.getCode(), be.getMessage());
            } catch (Exception e) {
                log.warn("batch cancel: job {} failed: {}", j.getId(), e.getMessage());
            }
        }
        return affected;
    }

    /**
     * 重试整批失败：循环 status=FAILED 行调 publishJobService.retry。
     * 注意每条 retry 走 startJob 会扣费一次 —— 与单条重试一致。
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public List<PublishJobDto> retryFailedBatch(String userId, String projectId) {
        List<PublishJob> rows = loadBatch(userId, projectId);
        List<PublishJobDto> affected = new ArrayList<>();
        for (PublishJob j : rows) {
            if (j.getStatus() != PublishJobStatus.FAILED) continue;
            try {
                affected.add(publishJobService.retry(userId, j.getId()));
            } catch (BusinessException be) {
                log.warn("batch retry: job {} skip ({}): {}", j.getId(), be.getCode(), be.getMessage());
            } catch (Exception e) {
                log.warn("batch retry: job {} failed: {}", j.getId(), e.getMessage());
            }
        }
        return affected;
    }

    /**
     * 重新调度未开始：仅对 status=QUEUED 子集生效。
     *
     * 顺序：按 createdAt asc 取 QUEUED 子集 → 用 ScheduleExpander 展开为 Instant[N]
     * → 第 i 条 QUEUED 行的 scheduledAt = arr[i]。
     *
     * 已开始 (UPLOADING/TRANSCODING/PUBLISHING/AWAITING_USER) 或 终态行原样保留 ——
     * 不重设 scheduledAt、不重置 progress。
     */
    @Transactional
    public List<PublishJobDto> rescheduleBatch(String userId, String projectId, ScheduleSpec spec) {
        if (spec == null) {
            throw BusinessException.badRequest("SCHEDULE_REQUIRED", "缺少 schedule");
        }
        List<PublishJob> rows = loadBatch(userId, projectId);
        List<PublishJob> queued = new ArrayList<>();
        for (PublishJob j : rows) {
            if (j.getStatus() == PublishJobStatus.QUEUED) queued.add(j);
        }
        if (queued.isEmpty()) {
            throw new BusinessException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "NO_QUEUED_JOBS",
                    "该批次没有待派单的任务可重新调度"
            );
        }
        queued.sort(Comparator.comparing(PublishJob::getCreatedAt));

        Instant[] perJobAt = scheduleExpander.expandSchedule(spec, queued.size());
        List<PublishJobDto> affected = new ArrayList<>(queued.size());
        for (int i = 0; i < queued.size(); i++) {
            PublishJob j = queued.get(i);
            j.setScheduledAt(perJobAt[i]);
            jobRepo.save(j);
            affected.add(PublishJobDto.from(j));
        }
        log.info("batch reschedule: user={} project={} updated {} queued job(s)",
                userId, projectId, affected.size());
        return affected;
    }

    // ── helpers ─────────────────────────────────────────────────────────

    private List<PublishJob> loadBatch(String userId, String projectId) {
        if (userId == null || userId.isBlank()) {
            throw BusinessException.badRequest("UNAUTHENTICATED", "未登录");
        }
        if (projectId == null || projectId.isBlank()) {
            throw BusinessException.badRequest("PROJECT_ID_REQUIRED", "缺少 projectId");
        }
        List<PublishJob> rows = jobRepo.findByUserIdAndProjectIdOrderByCreatedAtDesc(userId, projectId);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("BATCH_NOT_FOUND",
                    "未找到 projectId=" + projectId + " 的批次或不属于当前用户");
        }
        return rows;
    }
}
