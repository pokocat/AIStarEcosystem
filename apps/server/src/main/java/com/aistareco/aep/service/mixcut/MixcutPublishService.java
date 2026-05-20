package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.dto.CreatePublishJobInputDto;
import com.aistareco.aep.dto.MixcutPublishBatchRequest;
import com.aistareco.aep.dto.MixcutPublishBatchResultDto;
import com.aistareco.aep.dto.PublishJobDto;
import com.aistareco.aep.service.PublishJobService;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * v0.15+: 把混剪变体批量派单成 PublishJob。
 *
 * 每个 (output × target) 一条 PublishJob。
 * 失败处理：逐 output 独立 try/catch，单条失败不影响其他 output 派单（部分成功）。
 * 不开顶层事务（PublishJobService.createBatch 自己有事务边界）—— 避免一条失败整批回滚。
 */
@Service
public class MixcutPublishService {

    private static final Logger log = LoggerFactory.getLogger(MixcutPublishService.class);

    private final PublishJobService publishJobService;

    public MixcutPublishService(PublishJobService publishJobService) {
        this.publishJobService = publishJobService;
    }

    public MixcutPublishBatchResultDto batchPublish(String userId, MixcutPublishBatchRequest req) {
        if (userId == null || userId.isBlank()) {
            throw BusinessException.badRequest("UNAUTHENTICATED", "未登录");
        }
        if (req == null) {
            throw BusinessException.badRequest("INPUT_REQUIRED", "缺少请求体");
        }
        if (req.outputs() == null || req.outputs().isEmpty()) {
            throw BusinessException.badRequest("OUTPUTS_REQUIRED", "outputs 至少一个");
        }
        if (req.targets() == null || req.targets().isEmpty()) {
            throw BusinessException.badRequest("TARGETS_REQUIRED", "targets 至少一个");
        }
        if (req.title() == null || req.title().isBlank()) {
            throw BusinessException.badRequest("TITLE_REQUIRED", "title 必填");
        }

        String projectId = (req.projectId() != null && !req.projectId().isBlank())
                ? req.projectId()
                : "mixcut-batch-" + (req.sourceMixcutJobId() != null ? req.sourceMixcutJobId() : "ad-hoc");

        // 复用 CreatePublishJobInputDto.Target —— targets[] 在 outputs 之间共享
        List<CreatePublishJobInputDto.Target> sharedTargets = new ArrayList<>();
        for (var t : req.targets()) {
            sharedTargets.add(new CreatePublishJobInputDto.Target(
                    t.platform(), t.socialAccountId(), t.scheduledAt()
            ));
        }

        List<PublishJobDto> successJobs = new ArrayList<>();
        List<MixcutPublishBatchResultDto.FailedItem> failed = new ArrayList<>();
        int totalRequested = 0;

        for (var output : req.outputs()) {
            totalRequested += sharedTargets.size();
            if (output.cdnUrl() == null || output.cdnUrl().isBlank()) {
                failed.add(new MixcutPublishBatchResultDto.FailedItem(
                        output.outputId(),
                        "MISSING_CDN_URL",
                        "该变体尚未上传到 CDN，无法发布"));
                continue;
            }
            try {
                CreatePublishJobInputDto input = new CreatePublishJobInputDto(
                        projectId,
                        output.cdnUrl(),
                        req.title(),
                        req.description(),
                        req.tags() != null ? req.tags() : List.of(),
                        output.thumbnailUrl() != null ? output.thumbnailUrl() : req.coverUrl(),
                        sharedTargets
                );
                List<PublishJobDto> created = publishJobService.createBatch(userId, input);
                successJobs.addAll(created);
                log.info("[mixcut-publish] output {} → {} jobs queued", output.outputId(), created.size());
            } catch (BusinessException be) {
                failed.add(new MixcutPublishBatchResultDto.FailedItem(
                        output.outputId(),
                        be.getCode() != null ? be.getCode() : "BUSINESS_ERROR",
                        be.getMessage()
                ));
                log.warn("[mixcut-publish] output {} failed: {} {}", output.outputId(), be.getCode(), be.getMessage());
            } catch (Exception e) {
                failed.add(new MixcutPublishBatchResultDto.FailedItem(
                        output.outputId(),
                        "INTERNAL_ERROR",
                        e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()
                ));
                log.warn("[mixcut-publish] output {} failed: {}", output.outputId(), e.getMessage());
            }
        }

        return new MixcutPublishBatchResultDto(successJobs, failed, totalRequested);
    }
}
