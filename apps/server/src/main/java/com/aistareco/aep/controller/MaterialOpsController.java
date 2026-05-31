package com.aistareco.aep.controller;

import com.aistareco.aep.service.MaterialOpsService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.ArrayList;
import java.util.List;

/**
 * 素材运营 · 用户侧端点 /api/material/*（authenticated）。
 * 数据按登录用户归属过滤（对齐 celebrity 模板 factory/private 模式）：
 *   - 脚本：共享（官方模板/爆款同款/AI）+ 自己的个人脚本。
 *   - 视频：共享演示 + 自己生成的。
 * 与商品库（/api/products，公共池）以 product_id 关联。
 * 字段语义对齐前端 apps/web-celebrity/src/api/material-ops.ts。
 */
@RestController
@RequestMapping("/api/material")
public class MaterialOpsController {

    private final MaterialOpsService service;
    private final MaterialVideoJobService videoJobs;

    public MaterialOpsController(MaterialOpsService service, MaterialVideoJobService videoJobs) {
        this.service = service;
        this.videoJobs = videoJobs;
    }

    private static String uid(Principal p) {
        return p != null ? p.getName() : null;
    }

    // ── 脚本 ─────────────────────────────────────────────────────────────────
    @GetMapping("/scripts")
    public ApiResponse<List<JsonNode>> listScripts(Principal principal) {
        return ApiResponse.of(service.listScripts(uid(principal)));
    }

    @GetMapping("/scripts/{id}")
    public ApiResponse<JsonNode> getScript(@PathVariable String id, Principal principal) {
        return ApiResponse.of(service.getScript(id, uid(principal)));
    }

    @PostMapping("/scripts")
    public ApiResponse<JsonNode> saveScript(@RequestBody JsonNode body, Principal principal) {
        return ApiResponse.of(service.saveScript(body, uid(principal)));
    }

    @DeleteMapping("/scripts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteScript(@PathVariable String id, Principal principal) {
        service.deleteScript(id, uid(principal));
    }

    /** AI 起稿候选（接真 LLM，失败直接透出明确错误）。不落库，用户选用保存时才落库。 */
    @PostMapping("/scripts/ai-draft")
    public ApiResponse<List<JsonNode>> aiDraft(@RequestBody JsonNode body, Principal principal) {
        return ApiResponse.of(service.draftScripts(body, uid(principal)));
    }

    /** 从脚本抽取可替换变量（接真 LLM，失败 / 无权访问返回空 → 前端用正则兜底）。 */
    @PostMapping("/scripts/{id}/variables")
    public ApiResponse<List<JsonNode>> extractVariables(@PathVariable String id, Principal principal) {
        return ApiResponse.of(service.extractVariables(id, uid(principal)));
    }

    // ── 视频 ─────────────────────────────────────────────────────────────────
    @GetMapping("/videos")
    public ApiResponse<List<JsonNode>> listVideos(
            @RequestParam(value = "product_id", required = false) String productId,
            Principal principal) {
        return ApiResponse.of(service.listVideos(productId, uid(principal)));
    }

    @PostMapping("/videos/batch")
    public ApiResponse<Object> addVideos(@RequestBody JsonNode body, Principal principal) {
        List<JsonNode> videos = new ArrayList<>();
        JsonNode arr = body.get("videos");
        if (arr != null && arr.isArray()) arr.forEach(videos::add);
        service.addVideos(videos, uid(principal));
        return ApiResponse.of(null, "ok");
    }

    @DeleteMapping("/videos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteVideo(@PathVariable String id, Principal principal) {
        service.deleteVideo(id, uid(principal));
    }

    // ── 带货视频生成任务（真实视频大模型 · 异步 submit + 轮询） ──────────────────
    /**
     * 提交一批视频生成任务。body = { items: [ {script_id, product_id, name, kind,
     * parent_video_id, prompt, variant_config, duration_sec, aspect_ratio} ... ] }。
     * 未配置视频大模型 → 503 VIDEO_NOT_CONFIGURED（明确提示去 AI 模型页配置）。
     * 返回创建出的任务卡（MaterialVideo 形状，status=rendering）。
     */
    @PostMapping("/videos/generate")
    public ApiResponse<List<JsonNode>> generateVideos(@RequestBody JsonNode body, Principal principal) {
        return ApiResponse.of(videoJobs.submit(body, uid(principal)));
    }

    /** 列出当前用户的生成任务（可按 script_id / product_id 过滤）。前端进入页面时拉取回显。 */
    @GetMapping("/videos/jobs")
    public ApiResponse<List<JsonNode>> listVideoJobs(
            @RequestParam(value = "script_id", required = false) String scriptId,
            @RequestParam(value = "product_id", required = false) String productId,
            Principal principal) {
        return ApiResponse.of(videoJobs.listJobs(uid(principal), scriptId, productId));
    }

    /** 单个生成任务的进度 / 结果（前端独立轮询）。 */
    @GetMapping("/videos/jobs/{id}")
    public ApiResponse<JsonNode> getVideoJob(@PathVariable String id, Principal principal) {
        return ApiResponse.of(videoJobs.getJob(id, uid(principal)));
    }

    // ── 爆款雷达（共享，无需归属过滤） ──────────────────────────────────────────
    @GetMapping("/viral-hits")
    public ApiResponse<List<JsonNode>> listViralHits() {
        return ApiResponse.of(service.listViralHits());
    }

    @PostMapping("/viral-hits/analyze-url")
    public ApiResponse<JsonNode> analyzeViralUrl(@RequestBody JsonNode body, Principal principal) {
        return ApiResponse.of(service.analyzeViralUrl(body, uid(principal)));
    }
}
