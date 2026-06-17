package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaFrameJob;
import com.aistareco.aep.repository.DramaFrameJobRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/**
 * 首帧后台 worker。独立 bean 是为了让 @Async 生效。
 */
@Service
public class DramaFrameJobWorker {

    private static final Logger log = LoggerFactory.getLogger(DramaFrameJobWorker.class);

    private final DramaFrameJobRepository jobRepo;
    private final DramaRenderService renderService;
    private final ObjectMapper om;

    public DramaFrameJobWorker(DramaFrameJobRepository jobRepo,
                               DramaRenderService renderService,
                               ObjectMapper om) {
        this.jobRepo = jobRepo;
        this.renderService = renderService;
        this.om = om;
    }

    @Async("dramaFrameExecutor")
    public void generateAsync(String jobId) {
        DramaFrameJob job = jobRepo.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[drama-frame] job {} not found, skip", jobId);
            return;
        }
        if (isTerminal(job.getStatus())) {
            log.info("[drama-frame] job {} already terminal ({}), skip", jobId, job.getStatus());
            return;
        }
        try {
            markRunning(jobId);
            JsonNode body = om.readTree(job.getRequestJson());
            JsonNode result = renderService.renderFrame(body, job.getOwnerUserId());
            markSucceeded(jobId, result);
            log.info("[drama-frame] job {} succeeded user={} shot={}", jobId, job.getOwnerUserId(), job.getShotId());
        } catch (Throwable t) {
            String msg = t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
            log.warn("[drama-frame] job {} failed: {}", jobId, msg);
            markFailed(jobId, msg);
        }
    }

    private void markRunning(String jobId) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("running");
            j.setProgress(10);
            j.setStage("生成中");
            j.setStartedAt(OffsetDateTime.now());
            j.setUpdatedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    private void markSucceeded(String jobId, JsonNode result) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("succeeded");
            j.setProgress(100);
            j.setStage("已完成");
            try {
                j.setResultJson(om.writeValueAsString(result));
            } catch (Exception e) {
                j.setResultJson("{}");
            }
            j.setErrorMessage(null);
            j.setCompletedAt(OffsetDateTime.now());
            j.setUpdatedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    private void markFailed(String jobId, String message) {
        jobRepo.findById(jobId).ifPresent(j -> {
            j.setStatus("failed");
            j.setProgress(100);
            j.setStage("失败");
            j.setErrorMessage(truncate(message, 1000));
            j.setCompletedAt(OffsetDateTime.now());
            j.setUpdatedAt(OffsetDateTime.now());
            jobRepo.save(j);
        });
    }

    private static boolean isTerminal(String status) {
        return "succeeded".equals(status) || "failed".equals(status);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
