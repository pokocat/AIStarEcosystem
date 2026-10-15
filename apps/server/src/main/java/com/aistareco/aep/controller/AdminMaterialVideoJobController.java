package com.aistareco.aep.controller;

import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import java.security.Principal;

/** 管理端视频异步任务对账；恢复既有上游 Job，不会重新提交生成。 */
@RestController
@org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('SUPER_ADMIN', 'OPERATOR')")
@RequestMapping("/api/admin/material-video-jobs")
public class AdminMaterialVideoJobController {

    private final MaterialVideoJobService jobs;

    public AdminMaterialVideoJobController(MaterialVideoJobService jobs) {
        this.jobs = jobs;
    }

    @PostMapping("/{id}/reconcile")
    public ApiResponse<JsonNode> reconcile(@PathVariable String id,
            @RequestBody(required=false) com.aistareco.aep.dto.MaterialVideoReconcileRequest request,Principal principal) {
        if(request!=null)return ApiResponse.of(jobs.bindOriginalSupplierTask(id,request,principal.getName()),
                Boolean.TRUE.equals(request.confirmedNotAccepted())?"已按核对结果关闭任务":"已补录原任务号，正在核对");
        return ApiResponse.of(jobs.reconcileSucceeded(id), "视频任务已完成对账恢复");
    }

    @GetMapping("/{id}")
    public ApiResponse<JsonNode> get(@PathVariable String id) {return ApiResponse.of(jobs.adminGet(id));}
}
