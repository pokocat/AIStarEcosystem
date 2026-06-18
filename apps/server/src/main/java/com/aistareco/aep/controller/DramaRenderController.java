package com.aistareco.aep.controller;

import com.aistareco.aep.service.DramaRenderService;
import com.aistareco.aep.service.DramaFrameJobService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 短剧渲染端点（v0.65）：分镜首帧（图像）+ 直出/动态视频。
 * /api/me/drama/render/** → authenticated；项目工作台与短视频工坊共用。
 * 视频任务轮询复用 /api/me/drama/episodes/jobs/{id}。
 */
@RestController
@RequestMapping("/api/me/drama/render")
public class DramaRenderController {

    private final DramaRenderService service;
    private final DramaFrameJobService frameJobs;

    public DramaRenderController(DramaRenderService service, DramaFrameJobService frameJobs) {
        this.service = service;
        this.frameJobs = frameJobs;
    }

    /** 首帧渲染。body: { kind?("shot"|"short"), vars{}, ratio?, count?, ref_images?, ref_pool?, frame_desc?, consistency? }
     *  → { frames:[{url,cdnKey}], cost, consistency:{used,clause?,selected?,reason?} }
     *  v0.72：prompt 模板服务端化（drama.frame_image / drama.short_frame_image），前端传 vars 填充。
     *  v0.85：可降级的视觉一致性中间件 —— 传 ref_pool（候选参考池）即在出图前挑参考图 + 改写参考说明。 */
    @PostMapping("/frame")
    public ApiResponse<JsonNode> frame(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.renderFrame(body, principal.getName()));
    }

    /** 角色定妆三视图（正/侧/背）。body: { name, features?, style?, ratio?, ref_images? }
     *  → { portraits:{front:{url,cdnKey},side,back}, cost }。v0.85 视觉一致性地基。 */
    @PostMapping("/portraits")
    public ApiResponse<JsonNode> portraits(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.renderPortraits(body, principal.getName()));
    }

    /** 首帧后台任务。body 同 /frame，额外支持 project_id / scene_id / shot_id / episode_no / name。 */
    @PostMapping("/frame-jobs")
    public ApiResponse<JsonNode> submitFrameJob(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(frameJobs.submitFrame(body, principal.getName()));
    }

    @GetMapping("/frame-jobs")
    public ApiResponse<List<JsonNode>> listFrameJobs(Principal principal,
                                                     @RequestParam(name = "project_id", required = false) String projectId) {
        return ApiResponse.of(frameJobs.listFrameJobs(principal.getName(), projectId));
    }

    @GetMapping("/frame-jobs/{id}")
    public ApiResponse<JsonNode> getFrameJob(Principal principal, @PathVariable String id) {
        return ApiResponse.of(frameJobs.getFrameJob(id, principal.getName()));
    }

    /** 分镜视频生成（直出或基于首帧）。body: { kind?, vars{}, name?, duration_sec?, ratio?, project_id?, frame_url? } → 任务卡
     *  v0.72：prompt 模板服务端化（drama.clip_video / drama.short_clip_video）。 */
    @PostMapping("/clip")
    public ApiResponse<JsonNode> clip(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.renderClip(body, principal.getName()));
    }

    /** 统一后台任务视图：首帧任务 + 视频任务 + 当前系统负载摘要。 */
    @GetMapping("/tasks")
    public ApiResponse<JsonNode> tasks(Principal principal,
                                       @RequestParam(name = "project_id", required = false) String projectId) {
        return ApiResponse.of(frameJobs.listTasks(principal.getName(), projectId));
    }
}
