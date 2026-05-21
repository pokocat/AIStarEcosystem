package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.PublishBatchSummaryDto;
import com.aistareco.aep.dto.PublishJobDto;
import com.aistareco.aep.dto.RescheduleBatchInputDto;
import com.aistareco.aep.service.PublishJobBatchService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/**
 * v0.22: 分发中心「任务追踪」按 projectId 聚合的入口。
 *
 * 路由：/api/me/publish-jobs/batches/*
 * 需 JWT (AepSecurityConfig: /api/me/** authenticated)。
 *
 * 路径与 PublishJobController 的 `/{id}` 不冲突 —— Spring 路由按特定度排序，
 * 字面段 "batches" 优先于 `{id}` 变量段。projectId 是 UUID/带前缀的字符串，
 * 不会出现等于 "batches" 的情况。
 */
@RestController
@RequestMapping("/api/me/publish-jobs/batches")
public class PublishJobBatchController {

    private final PublishJobBatchService service;

    public PublishJobBatchController(PublishJobBatchService service) {
        this.service = service;
    }

    /** 服务端分页列表。返回 PageEnvelope —— 不再包 ApiResponse（PageEnvelope 自带 success/data/pagination）。 */
    @GetMapping
    public PageEnvelope<PublishBatchSummaryDto> list(Principal principal,
                                                       @RequestParam(value = "page", defaultValue = "0") int page,
                                                       @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return service.listBatches(principal.getName(), page, limit);
    }

    @GetMapping("/{projectId}")
    public ApiResponse<PublishBatchSummaryDto> get(Principal principal,
                                                     @PathVariable("projectId") String projectId) {
        return ApiResponse.of(service.getBatchDetail(principal.getName(), projectId));
    }

    @PostMapping("/{projectId}/cancel")
    public ApiResponse<List<PublishJobDto>> cancelBatch(Principal principal,
                                                          @PathVariable("projectId") String projectId) {
        return ApiResponse.of(service.cancelBatch(principal.getName(), projectId));
    }

    @PostMapping("/{projectId}/retry-failed")
    public ApiResponse<List<PublishJobDto>> retryFailedBatch(Principal principal,
                                                               @PathVariable("projectId") String projectId) {
        return ApiResponse.of(service.retryFailedBatch(principal.getName(), projectId));
    }

    @PostMapping("/{projectId}/reschedule")
    public ApiResponse<List<PublishJobDto>> rescheduleBatch(Principal principal,
                                                              @PathVariable("projectId") String projectId,
                                                              @RequestBody RescheduleBatchInputDto body) {
        if (body == null) {
            throw BusinessException.badRequest("INPUT_REQUIRED", "缺少请求体");
        }
        return ApiResponse.of(service.rescheduleBatch(principal.getName(), projectId, body.schedule()));
    }
}
