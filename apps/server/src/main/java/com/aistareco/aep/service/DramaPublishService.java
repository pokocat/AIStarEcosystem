package com.aistareco.aep.service;

import com.aistareco.aep.dto.DramaPublishJobDto;
import com.aistareco.aep.model.DramaPublishJob;
import com.aistareco.aep.repository.DramaPublishJobRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 短剧分发发布任务服务（v0.45）。
 *
 * 进度走「读时推进」（advance-on-read）：每次 list/get 按距离生效时间的秒数推进
 * queued → uploading → transcoding → publishing → live，约 15s 走完。
 * 不用 @Scheduled，避免多实例 ShedLock 顾虑（demo 模拟）。
 * 按 ownerUserId 隔离；/api/distribution/** 当前 permitAll，controller 用 principal 防御性 scope。
 */
@Service
public class DramaPublishService {

    /** 从生效时间到 live 的总模拟时长（秒）。 */
    private static final long TOTAL_SECONDS = 15;

    private final DramaPublishJobRepository repo;

    public DramaPublishService(DramaPublishJobRepository repo) {
        this.repo = repo;
    }

    public List<DramaPublishJobDto> listJobs(String userId, String projectId) {
        List<DramaPublishJob> jobs = (projectId != null && !projectId.isBlank())
                ? repo.findByOwnerUserIdAndProjectIdOrderByCreatedAtDesc(userId, projectId)
                : repo.findByOwnerUserIdOrderByCreatedAtDesc(userId);
        jobs.forEach(this::advance);
        return jobs.stream().map(DramaPublishJobDto::from).toList();
    }

    public DramaPublishJobDto getJob(String id, String userId) {
        DramaPublishJob job = repo.findByIdAndOwnerUserId(id, userId).orElse(null);
        if (job == null) return null;
        advance(job);
        return DramaPublishJobDto.from(job);
    }

    public DramaPublishJobDto createJob(JsonNode body, String userId) {
        String platformId = text(body, "platformId");
        if (platformId == null || platformId.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PLATFORM_REQUIRED", "请选择分发平台");
        }
        OffsetDateTime now = OffsetDateTime.now();
        DramaPublishJob job = DramaPublishJob.builder()
                .id("dpj_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .ownerUserId(userId)
                .projectId(text(body, "projectId"))
                .platformId(platformId)
                .platformName(orDefault(text(body, "platformName"), platformId))
                .status("queued")
                .progress(0)
                .scheduledAt(parseTime(text(body, "scheduledAt")))
                .createdAt(now)
                .updatedAt(now)
                .build();
        repo.save(job);
        return DramaPublishJobDto.from(job);
    }

    public DramaPublishJobDto retryJob(String id, String userId) {
        DramaPublishJob job = require(id, userId);
        OffsetDateTime now = OffsetDateTime.now();
        job.setStatus("queued");
        job.setProgress(0);
        job.setErrorCode(null);
        job.setErrorMessage(null);
        job.setExternalUrl(null);
        job.setScheduledAt(null);
        job.setCreatedAt(now); // 重启模拟计时
        job.setUpdatedAt(now);
        repo.save(job);
        return DramaPublishJobDto.from(job);
    }

    public DramaPublishJobDto cancelJob(String id, String userId) {
        DramaPublishJob job = require(id, userId);
        if (!"live".equals(job.getStatus())) {
            job.setStatus("cancelled");
            job.setUpdatedAt(OffsetDateTime.now());
            repo.save(job);
        }
        return DramaPublishJobDto.from(job);
    }

    // ── 读时推进 ─────────────────────────────────────────────────────────────

    private void advance(DramaPublishJob job) {
        String s = job.getStatus();
        if ("live".equals(s) || "failed".equals(s) || "cancelled".equals(s)) return;

        OffsetDateTime start = job.getScheduledAt() != null && job.getScheduledAt().isAfter(job.getCreatedAt())
                ? job.getScheduledAt() : job.getCreatedAt();
        OffsetDateTime now = OffsetDateTime.now();
        if (now.isBefore(start)) {
            // 定时未到：保持 queued / 0
            setIfChanged(job, "queued", 0, null);
            return;
        }
        long elapsed = Duration.between(start, now).getSeconds();
        int progress = (int) Math.min(100, Math.max(0, elapsed * 100 / TOTAL_SECONDS));
        String status;
        String externalUrl = null;
        if (progress >= 100) {
            status = "live";
            progress = 100;
            externalUrl = "https://demo.aibuzz.cn/" + safe(job.getPlatformId()) + "/" + job.getId();
        } else if (progress >= 70) {
            status = "publishing";
        } else if (progress >= 40) {
            status = "transcoding";
        } else if (progress >= 10) {
            status = "uploading";
        } else {
            status = "queued";
        }
        setIfChanged(job, status, progress, externalUrl);
    }

    private void setIfChanged(DramaPublishJob job, String status, int progress, String externalUrl) {
        boolean changed = false;
        if (!status.equals(job.getStatus())) { job.setStatus(status); changed = true; }
        if (progress != job.getProgress()) { job.setProgress(progress); changed = true; }
        if (externalUrl != null && !externalUrl.equals(job.getExternalUrl())) {
            job.setExternalUrl(externalUrl);
            changed = true;
        }
        if (changed) {
            job.setUpdatedAt(OffsetDateTime.now());
            repo.save(job);
        }
    }

    private DramaPublishJob require(String id, String userId) {
        return repo.findByIdAndOwnerUserId(id, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PUBLISH_JOB_NOT_FOUND", "发布任务不存在"));
    }

    private static OffsetDateTime parseTime(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return OffsetDateTime.parse(iso);
        } catch (Exception e) {
            return null;
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }

    private static String safe(String v) {
        return v == null ? "platform" : v;
    }
}
