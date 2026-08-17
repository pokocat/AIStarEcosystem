package com.aistareco.aep.controller;

import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 管理端视频异步任务对账；恢复既有上游 Job，不会重新提交生成。 */
@RestController
@RequestMapping("/api/admin/material-video-jobs")
public class AdminMaterialVideoJobController {

    private final MaterialVideoJobService jobs;

    public AdminMaterialVideoJobController(MaterialVideoJobService jobs) {
        this.jobs = jobs;
    }

    @PostMapping("/{id}/reconcile")
    public ApiResponse<JsonNode> reconcile(@PathVariable String id) {
        return ApiResponse.of(jobs.reconcileSucceeded(id), "视频任务已完成对账恢复");
    }
}
