package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MixcutPublishBatchRequest;
import com.aistareco.aep.dto.MixcutPublishBatchResultDto;
import com.aistareco.aep.service.mixcut.MixcutPublishService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

/**
 * v0.15+: 混剪 → 发布 桥接 API。
 *
 *   POST /api/me/mixcut/publish-batch
 *
 * 接受混剪产出（含 cdn_url）+ 多平台 targets，调度 N×M 条 PublishJob。
 * 部分成功语义见 MixcutPublishBatchResultDto。
 *
 * 安全：路径 /api/me/** 已 authenticated，service 内 userId 取自 principal。
 */
@RestController
@RequestMapping("/api/me/mixcut")
public class MixcutPublishController {

    private final MixcutPublishService service;

    public MixcutPublishController(MixcutPublishService service) {
        this.service = service;
    }

    @PostMapping("/publish-batch")
    public ApiResponse<MixcutPublishBatchResultDto> publishBatch(
            Principal principal,
            @RequestBody MixcutPublishBatchRequest req
    ) {
        return ApiResponse.of(service.batchPublish(currentUserId(principal), req));
    }

    private static String currentUserId(Principal principal) {
        return principal == null ? null : principal.getName();
    }
}
