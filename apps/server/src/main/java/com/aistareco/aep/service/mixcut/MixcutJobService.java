package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.dto.MixcutCreateJobRequest;
import com.aistareco.aep.dto.MixcutRenderJobDto;
import com.aistareco.aep.model.MixcutRenderJob;
import com.aistareco.aep.repository.MixcutRenderJobRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class MixcutJobService {

    private static final Logger log = LoggerFactory.getLogger(MixcutJobService.class);

    private final MixcutRenderJobRepository jobRepo;
    private final ObjectMapper mapper;
    private final MixcutRenderingService rendering;

    public MixcutJobService(
            MixcutRenderJobRepository jobRepo,
            ObjectMapper mapper,
            MixcutRenderingService rendering
    ) {
        this.jobRepo = jobRepo;
        this.mapper = mapper;
        this.rendering = rendering;
    }

    @Transactional(readOnly = true)
    public List<MixcutRenderJobDto> listAll() {
        return jobRepo.findAllByOrderByCreatedAtDesc().stream()
                .map(j -> MixcutRenderJobDto.from(j, mapper))
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<MixcutRenderJobDto> get(String id) {
        return jobRepo.findById(id).map(j -> MixcutRenderJobDto.from(j, mapper));
    }

    /**
     * 创建任务并 dispatch 异步 worker。返回的 DTO 状态固定为 "queued"。
     */
    @Transactional
    public MixcutRenderJobDto create(MixcutCreateJobRequest req) {
        MixcutRenderJob job = new MixcutRenderJob();
        job.setId(req.id() != null && !req.id().isBlank() ? req.id() : ("job_" + shortUuid()));
        job.setUserId(req.userId() != null ? req.userId() : "anonymous");
        job.setTemplateId(req.templateId());
        job.setTemplateName(req.templateName());
        job.setTemplateThumbnail(req.templateThumbnail());

        String bindingsJson;
        try {
            bindingsJson = req.slotBindings() == null || req.slotBindings().isNull()
                    ? "{}"
                    : mapper.writeValueAsString(req.slotBindings());
        } catch (Exception e) {
            bindingsJson = "{}";
        }
        job.setSlotBindingsJson(bindingsJson);

        job.setPerturbationProfile(safe(req.perturbationProfile(), "moderate"));
        job.setOutputVariants(req.outputVariants() != null && req.outputVariants() > 0 ? req.outputVariants() : 1);
        job.setStatus("queued");
        job.setProgress(0);
        job.setCreatedAt(OffsetDateTime.now());

        jobRepo.save(job);
        log.info("[mixcut] queued job {} template={} variants={} profile={}",
                job.getId(), job.getTemplateId(), job.getOutputVariants(), job.getPerturbationProfile());

        // 异步 dispatch 必须在事务 commit 之后；否则 worker 新事务里 SELECT 看不到这条 job。
        final String jobId = job.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    rendering.renderAsync(jobId);
                }
            });
        } else {
            rendering.renderAsync(jobId);
        }

        return MixcutRenderJobDto.from(job, mapper);
    }

    @Transactional
    public Optional<MixcutRenderJobDto> updateProgress(String id, Integer progress, String status) {
        return jobRepo.findById(id).map(job -> {
            if (progress != null) job.setProgress(Math.max(0, Math.min(100, progress)));
            if (status != null && !status.isBlank()) job.setStatus(status);
            jobRepo.save(job);
            return MixcutRenderJobDto.from(job, mapper);
        });
    }

    private static String shortUuid() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private static String safe(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }
}
