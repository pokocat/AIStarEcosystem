package com.aistareco.aep.aiavatar.service;

import com.aistareco.aep.aiavatar.config.AiAvatarProperties;
import com.aistareco.aep.aiavatar.dto.AiAvatarJobDto;
import com.aistareco.aep.aiavatar.model.*;
import com.aistareco.aep.aiavatar.repository.AiAvatarJobRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 异步任务编排服务：建任务 → 冻结积分 → 派发执行；查询 / 取消 / 重试。
 */
@Service
public class AiAvatarJobService {

    private static final Logger log = LoggerFactory.getLogger(AiAvatarJobService.class);

    private final AiAvatarJobRepository jobRepo;
    private final AiAvatarJobRunner runner;
    private final AiAvatarJobProgressTracker tracker;
    private final CreditService creditService;
    private final ObjectMapper mapper;
    private final AiAvatarProperties props;

    public AiAvatarJobService(AiAvatarJobRepository jobRepo, AiAvatarJobRunner runner, AiAvatarJobProgressTracker tracker,
                        CreditService creditService, ObjectMapper mapper, AiAvatarProperties props) {
        this.jobRepo = jobRepo;
        this.runner = runner;
        this.tracker = tracker;
        this.creditService = creditService;
        this.mapper = mapper;
        this.props = props;
    }

    /**
     * 创建并派发一个任务。
     *
     * @param units 计费单位数（如标准图集张数 / 视频条数）；扣费 = units × creditPerGeneration。
     */
    public AiAvatarJob createAndDispatch(String userId, String avatarId, AiAvatarCapability capability,
                                   String title, ObjectNode input, int units, String batchId) {
        String jobId = UUID.randomUUID().toString();
        long perUnit = Math.max(0, props.getCreditPerGeneration());
        long cost = perUnit * Math.max(1, units);

        // 冻结积分（hold）；不足直接 402
        if (cost > 0) {
            try {
                creditService.hold(userId, cost, "aiavatar_job", jobId, "AiAvatar生成：" + capability.label());
            } catch (org.springframework.web.server.ResponseStatusException e) {
                throw new BusinessException(HttpStatus.PAYMENT_REQUIRED, "INSUFFICIENT_CREDITS",
                        e.getReason() == null ? "积分不足" : e.getReason());
            }
        }

        AiAvatarJob job = AiAvatarJob.builder()
                .id(jobId)
                .ownerUserId(userId)
                .avatarId(avatarId)
                .capability(capability)
                .status(AiAvatarJobStatus.QUEUED)
                .progress(0)
                .title(title)
                .inputJson(input == null ? null : input.toString())
                .attempts(0)
                .maxAttempts(3)
                .creditsHeld(cost)
                .creditsPerUnit(perUnit)
                .batchId(batchId)
                .createdAt(OffsetDateTime.now())
                .build();
        jobRepo.save(job);
        tracker.publish(jobId, 0, "已排队", "queued");
        runner.runAsync(jobId);
        return job;
    }

    public List<AiAvatarJobDto> listForUser(String userId) {
        return jobRepo.findByOwnerUserIdOrderByCreatedAtDesc(userId)
                .stream().map(j -> AiAvatarJobDto.from(j, mapper)).toList();
    }

    public List<AiAvatarJobDto> listForAvatar(String avatarId, String userId) {
        return jobRepo.findByAvatarIdOrderByCreatedAtDesc(avatarId).stream()
                .filter(j -> j.getOwnerUserId().equals(userId))
                .map(j -> AiAvatarJobDto.from(j, mapper)).toList();
    }

    public AiAvatarJob requireOwned(String jobId, String userId) {
        AiAvatarJob job = jobRepo.findByIdAndOwnerUserId(jobId, userId)
                .orElseThrow(() -> BusinessException.notFound("AIAVATAR_JOB_NOT_FOUND", "任务不存在"));
        return job;
    }

    public AiAvatarJobDto getForUser(String jobId, String userId) {
        return AiAvatarJobDto.from(requireOwned(jobId, userId), mapper);
    }

    /** 取消任务（标志位 + 若仍排队直接置取消）。 */
    public AiAvatarJobDto cancel(String jobId, String userId) {
        AiAvatarJob job = requireOwned(jobId, userId);
        if (job.getStatus().isTerminal()) return AiAvatarJobDto.from(job, mapper);
        tracker.markCancelled(jobId);
        if (job.getStatus() == AiAvatarJobStatus.QUEUED) {
            job.setStatus(AiAvatarJobStatus.CANCELLED);
            job.setCompletedAt(OffsetDateTime.now());
            if (job.getCreditsHeld() > 0) {
                try { creditService.releaseHold("aiavatar_job", jobId, "取消任务回滚"); job.setCreditsHeld(0); }
                catch (Exception ignored) {}
            }
            jobRepo.save(job);
            tracker.complete(jobId, "cancelled");
        }
        return AiAvatarJobDto.from(job, mapper);
    }

    /** 手动重试失败任务（用户在任务中心点「重试」）。 */
    public AiAvatarJobDto retry(String jobId, String userId) {
        AiAvatarJob job = requireOwned(jobId, userId);
        if (job.getStatus() != AiAvatarJobStatus.FAILED) {
            throw BusinessException.badRequest("AIAVATAR_JOB_NOT_RETRYABLE", "仅失败任务可重试");
        }
        // 重试重置上限计数窗口：允许再跑 maxAttempts 次
        job.setMaxAttempts(job.getAttempts() + 3);
        job.setStatus(AiAvatarJobStatus.QUEUED);
        job.setErrorMessage(null);
        tracker.clearCancel(jobId);
        // 重新 hold（之前失败已 release）
        if (job.getCreditsHeld() == 0 && job.getCreditsPerUnit() > 0) {
            long cost = job.getCreditsPerUnit();
            try {
                creditService.hold(userId, cost, "aiavatar_job", jobId, "AiAvatar生成重试：" + job.getCapability().label());
                job.setCreditsHeld(cost);
            } catch (Exception e) {
                throw new BusinessException(HttpStatus.PAYMENT_REQUIRED, "INSUFFICIENT_CREDITS", "积分不足，无法重试");
            }
        }
        jobRepo.save(job);
        runner.runAsync(jobId);
        return AiAvatarJobDto.from(job, mapper);
    }
}
