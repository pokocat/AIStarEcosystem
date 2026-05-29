package com.aistareco.aep.controller;

import com.aistareco.aep.service.MaterialOpsService;
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

    public MaterialOpsController(MaterialOpsService service) {
        this.service = service;
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

    // ── 爆款雷达（共享，无需归属过滤） ──────────────────────────────────────────
    @GetMapping("/viral-hits")
    public ApiResponse<List<JsonNode>> listViralHits() {
        return ApiResponse.of(service.listViralHits());
    }
}
