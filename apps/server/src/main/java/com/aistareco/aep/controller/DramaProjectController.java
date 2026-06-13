package com.aistareco.aep.controller;

import com.aistareco.aep.service.DramaAssembleService;
import com.aistareco.aep.service.DramaProjectService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 短剧项目工作台（drama）用户侧端点：六阶段工作台的 ProjectData CRUD + 大纲 AI 起草。
 * 全部 /api/me/drama/projects/** → AepSecurityConfig 下 authenticated，按 principal 严格隔离归属。
 */
@RestController
@RequestMapping("/api/me/drama/projects")
public class DramaProjectController {

    private final DramaProjectService service;
    private final DramaAssembleService assembleService;

    public DramaProjectController(DramaProjectService service, DramaAssembleService assembleService) {
        this.service = service;
        this.assembleService = assembleService;
    }

    /** 列表卡片 DramaProjectSummary[]。 */
    @GetMapping
    public ApiResponse<List<JsonNode>> list(Principal principal) {
        return ApiResponse.of(service.listProjects(principal.getName()));
    }

    /** 新建项目 → { meta, data }。 */
    @PostMapping
    public ApiResponse<JsonNode> create(Principal principal, @RequestBody JsonNode body) {
        return ApiResponse.of(service.createProject(body, principal.getName()));
    }

    /** 详情 { meta: DramaProjectSummary, data: ProjectData }。 */
    @GetMapping("/{id}")
    public ApiResponse<JsonNode> get(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.getProject(id, principal.getName()));
    }

    /** 保存整套工作台文档。body: { data, stage?, progress? } → { meta, data }。 */
    @PutMapping("/{id}")
    public ApiResponse<JsonNode> save(Principal principal, @PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.of(service.saveProject(id, body, principal.getName()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Principal principal, @PathVariable String id) {
        service.deleteProject(id, principal.getName());
    }

    /** 大纲 AI 起草。body: { count? } → { episodes: [...] }（未落库，前端合并后再 PUT 保存）。 */
    @PostMapping("/{id}/outline/ai-draft")
    public ApiResponse<JsonNode> outlineAiDraft(Principal principal, @PathVariable String id, @RequestBody(required = false) JsonNode body) {
        return ApiResponse.of(service.outlineAiDraft(id, body, principal.getName()));
    }

    /** 剧集脚本（分场分镜）AI 起草。body: { ep, plot, style?, cast? } → { scenes, boardScenes }。 */
    @PostMapping("/{id}/epscript/ai-draft")
    public ApiResponse<JsonNode> epscriptAiDraft(Principal principal, @PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.of(service.epscriptAiDraft(id, body, principal.getName()));
    }

    /** 单场拆镜。body: { sceneId, place?, action, lines?, style? } → { shots }。 */
    @PostMapping("/{id}/epscript/split-scene")
    public ApiResponse<JsonNode> splitScene(Principal principal, @PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.of(service.splitSceneShots(id, body, principal.getName()));
    }

    /** 从大纲重抽角色阵容。→ { characters }（未落库）。 */
    @PostMapping("/{id}/cast/ai-draft")
    public ApiResponse<JsonNode> castAiDraft(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.castAiDraft(id, principal.getName()));
    }

    /** 成片合成：把某集已出片分镜按序拼成完整片。body: { ep } → { url, cdnKey, durationSec, shotCount, at }。 */
    @PostMapping("/{id}/assemble")
    public ApiResponse<JsonNode> assemble(Principal principal, @PathVariable String id,
                                          @RequestBody(required = false) JsonNode body) {
        return ApiResponse.of(assembleService.assemble(id, body, principal.getName()));
    }
}
