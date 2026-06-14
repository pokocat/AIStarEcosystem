package com.aistareco.aep.controller;

import com.aistareco.aep.service.DramaInteractiveService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 互动短剧（剧情互动）用户侧端点：剧集分支图 CRUD + AI 起草 + 按集生成视频。
 * 全部 /api/me/drama/interactive/** → AepSecurityConfig 下 authenticated，按 principal 严格隔离归属。
 *
 * 视频生成复用 MaterialVideoJobService（kind="drama-interactive-node"），
 * 生成进度沿用既有 GET /api/me/drama/episodes/jobs/{id} 轮询。
 */
@RestController
@RequestMapping("/api/me/drama/interactive")
public class DramaInteractiveController {

    private final DramaInteractiveService service;

    public DramaInteractiveController(DramaInteractiveService service) {
        this.service = service;
    }

    // ── 剧集分支图 ───────────────────────────────────────────────────────────────

    @GetMapping("/series")
    public ApiResponse<List<JsonNode>> listSeries(Principal principal) {
        return ApiResponse.of(service.listSeries(principal.getName()));
    }

    @GetMapping("/series/{id}")
    public ApiResponse<JsonNode> getSeries(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.getSeries(id, principal.getName()));
    }

    @PostMapping("/series")
    public ApiResponse<JsonNode> saveSeries(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.saveSeries(body, principal.getName()));
    }

    @DeleteMapping("/series/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSeries(Principal principal, @PathVariable String id) {
        service.deleteSeries(id, principal.getName());
    }

    // ── AI 起草整张剧集图 ─────────────────────────────────────────────────────────

    @PostMapping("/ai-draft")
    public ApiResponse<JsonNode> aiDraft(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.aiDraft(body, principal.getName()));
    }

    // ── 按集生成视频 ─────────────────────────────────────────────────────────────

    @PostMapping("/series/{seriesId}/episodes/{episodeId}/generate")
    public ApiResponse<JsonNode> generateEpisode(Principal principal,
                                                 @PathVariable String seriesId,
                                                 @PathVariable String episodeId) {
        return ApiResponse.of(service.generateEpisode(seriesId, episodeId, principal.getName()));
    }
}
