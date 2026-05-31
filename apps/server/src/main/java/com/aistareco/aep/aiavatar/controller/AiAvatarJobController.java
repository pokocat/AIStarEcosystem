package com.aistareco.aep.aiavatar.controller;

import com.aistareco.aep.aiavatar.dto.AiAvatarJobDto;
import com.aistareco.aep.aiavatar.service.AiAvatarJobProgressTracker;
import com.aistareco.aep.aiavatar.service.AiAvatarJobService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.security.Principal;
import java.util.List;

/**
 * 异步任务中心 API（/api/me/aiavatar/jobs）+ SSE 进度流（任务书 §7 任务中心：实时进度 / 重试 / 取消）。
 */
@RestController
@RequestMapping("/api/me/aiavatar/jobs")
public class AiAvatarJobController {

    private final AiAvatarJobService jobService;
    private final AiAvatarJobProgressTracker tracker;

    public AiAvatarJobController(AiAvatarJobService jobService, AiAvatarJobProgressTracker tracker) {
        this.jobService = jobService;
        this.tracker = tracker;
    }

    private static String uid(Principal p) {
        if (p == null) throw BusinessException.notFound("UNAUTHORIZED", "未登录");
        return p.getName();
    }

    @GetMapping
    public ApiResponse<List<AiAvatarJobDto>> list(Principal principal) {
        return ApiResponse.of(jobService.listForUser(uid(principal)));
    }

    @GetMapping("/{id}")
    public ApiResponse<AiAvatarJobDto> get(@PathVariable String id, Principal principal) {
        return ApiResponse.of(jobService.getForUser(id, uid(principal)));
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<AiAvatarJobDto> cancel(@PathVariable String id, Principal principal) {
        return ApiResponse.of(jobService.cancel(id, uid(principal)));
    }

    @PostMapping("/{id}/retry")
    public ApiResponse<AiAvatarJobDto> retry(@PathVariable String id, Principal principal) {
        return ApiResponse.of(jobService.retry(id, uid(principal)));
    }

    /** SSE 进度流：前端 EventSource 订阅；事件 name=progress|done。 */
    @GetMapping(path = "/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String id, Principal principal) {
        jobService.requireOwned(id, uid(principal)); // owner 校验
        return tracker.subscribe(id);
    }
}
