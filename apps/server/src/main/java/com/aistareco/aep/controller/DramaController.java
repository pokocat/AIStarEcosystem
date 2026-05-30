package com.aistareco.aep.controller;

import com.aistareco.aep.service.DramaScriptService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 短剧子产品（drama）用户侧端点：脚本 CRUD + AI 起草 + 短剧视频生成 / 进度。
 * 全部 /api/me/drama/** → AepSecurityConfig 下 authenticated，按 principal 严格隔离归属。
 *
 * 视频生成复用 celebrity 的 MaterialVideoJobService（异步 submit + poll），
 * 任务以 kind="drama-episode" + scriptId 与带货视频天然区分。
 */
@RestController
@RequestMapping("/api/me/drama")
public class DramaController {

    private final DramaScriptService service;

    public DramaController(DramaScriptService service) {
        this.service = service;
    }

    // ── 脚本 ───────────────────────────────────────────────────────────────────

    @GetMapping("/scripts")
    public ApiResponse<List<JsonNode>> listScripts(Principal principal) {
        return ApiResponse.of(service.listScripts(principal.getName()));
    }

    @GetMapping("/scripts/{id}")
    public ApiResponse<JsonNode> getScript(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.getScript(id, principal.getName()));
    }

    @PostMapping("/scripts")
    public ApiResponse<JsonNode> saveScript(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.saveScript(body, principal.getName()));
    }

    @DeleteMapping("/scripts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteScript(Principal principal, @PathVariable String id) {
        service.deleteScript(id, principal.getName());
    }

    @PostMapping("/scripts/ai-draft")
    public ApiResponse<List<JsonNode>> aiDraft(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.aiDraft(body, principal.getName()));
    }

    // ── 短剧视频 ─────────────────────────────────────────────────────────────────

    @PostMapping("/episodes/generate")
    public ApiResponse<List<JsonNode>> generateEpisodes(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.generateEpisodes(body, principal.getName()));
    }

    @GetMapping("/episodes/jobs")
    public ApiResponse<List<JsonNode>> listEpisodeJobs(Principal principal,
                                                       @RequestParam(name = "script_id", required = false) String scriptId) {
        return ApiResponse.of(service.listEpisodeJobs(principal.getName(), scriptId));
    }

    @GetMapping("/episodes/jobs/{id}")
    public ApiResponse<JsonNode> getEpisodeJob(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.getEpisodeJob(id, principal.getName()));
    }
}
