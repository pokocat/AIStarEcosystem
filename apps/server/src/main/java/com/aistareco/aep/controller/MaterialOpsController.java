package com.aistareco.aep.controller;

import com.aistareco.aep.service.MaterialOpsService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

/**
 * 素材运营 · 用户侧端点 /api/material/*（authenticated）。
 * 脚本 / 视频 / 爆款雷达；与商品库（/api/products）以 product_id 关联。
 * 字段语义对齐前端 apps/web-celebrity/src/api/material-ops.ts。
 */
@RestController
@RequestMapping("/api/material")
public class MaterialOpsController {

    private final MaterialOpsService service;

    public MaterialOpsController(MaterialOpsService service) {
        this.service = service;
    }

    // ── 脚本 ─────────────────────────────────────────────────────────────────
    @GetMapping("/scripts")
    public ApiResponse<List<JsonNode>> listScripts() {
        return ApiResponse.of(service.listScripts());
    }

    @GetMapping("/scripts/{id}")
    public ApiResponse<JsonNode> getScript(@PathVariable String id) {
        return ApiResponse.of(service.getScript(id));
    }

    @PostMapping("/scripts")
    public ApiResponse<JsonNode> saveScript(@RequestBody JsonNode body) {
        return ApiResponse.of(service.saveScript(body));
    }

    // ── 视频 ─────────────────────────────────────────────────────────────────
    @GetMapping("/videos")
    public ApiResponse<List<JsonNode>> listVideos(@RequestParam(value = "product_id", required = false) String productId) {
        return ApiResponse.of(service.listVideos(productId));
    }

    @PostMapping("/videos/batch")
    public ApiResponse<Object> addVideos(@RequestBody JsonNode body) {
        List<JsonNode> videos = new ArrayList<>();
        JsonNode arr = body.get("videos");
        if (arr != null && arr.isArray()) arr.forEach(videos::add);
        service.addVideos(videos);
        return ApiResponse.of(null, "ok");
    }

    @DeleteMapping("/videos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteVideo(@PathVariable String id) {
        service.deleteVideo(id);
    }

    // ── 爆款雷达 ───────────────────────────────────────────────────────────────
    @GetMapping("/viral-hits")
    public ApiResponse<List<JsonNode>> listViralHits() {
        return ApiResponse.of(service.listViralHits());
    }
}
