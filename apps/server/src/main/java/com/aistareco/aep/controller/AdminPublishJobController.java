package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PublishJobDto;
import com.aistareco.aep.dto.PublishJobEventDto;
import com.aistareco.aep.service.PublishJobService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin 视图：跨用户发布任务 + 事件流。
 *
 * 路由：/api/admin/publish-jobs
 * 角色：SUPER_ADMIN / OPERATOR（AepSecurityConfig.hasAnyRole）。
 * 仅读：失败任务的人工调账走 admin Wallet 接口；不在此处暴露 cancel/retry。
 */
@RestController
@RequestMapping("/api/admin/publish-jobs")
public class AdminPublishJobController {

    private final PublishJobService service;

    public AdminPublishJobController(PublishJobService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<PublishJobDto>> list(@RequestParam(value = "status", required = false) String status) {
        return ApiResponse.of(service.listAll(status));
    }

    @GetMapping("/{id}/events")
    public ApiResponse<List<PublishJobEventDto>> events(@PathVariable("id") String id) {
        return ApiResponse.of(service.listEvents(id));
    }
}
