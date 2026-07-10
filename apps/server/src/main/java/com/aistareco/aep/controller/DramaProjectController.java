package com.aistareco.aep.controller;

import com.aistareco.aep.service.DramaAssembleService;
import com.aistareco.aep.service.DramaProjectService;
import com.aistareco.aep.service.DramaRecipeService;
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
    private final DramaRecipeService recipeService;

    public DramaProjectController(DramaProjectService service, DramaAssembleService assembleService,
                                  DramaRecipeService recipeService) {
        this.service = service;
        this.assembleService = assembleService;
        this.recipeService = recipeService;
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

    /** 软删（移入回收站，保留 30 天后由定时任务物理删除）。 */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Principal principal, @PathVariable String id) {
        service.deleteProject(id, principal.getName());
    }

    /** 回收站列表 → DramaProjectSummary[] + { deletedAt, purgeAt, daysLeft }。 */
    @GetMapping("/trash")
    public ApiResponse<List<JsonNode>> trash(Principal principal) {
        return ApiResponse.of(service.listTrash(principal.getName()));
    }

    /** 从回收站恢复 → { meta, data }。 */
    @PostMapping("/{id}/restore")
    public ApiResponse<JsonNode> restore(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.restoreProject(id, principal.getName()));
    }

    /** 彻底删除（物理，需已在回收站）。 */
    @DeleteMapping("/{id}/purge")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void purge(Principal principal, @PathVariable String id) {
        service.purgeProject(id, principal.getName());
    }

    /** 大纲 AI 起草。body: { count? } → { episodes: [...] }（未落库，前端合并后再 PUT 保存）。 */
    @PostMapping("/{id}/outline/ai-draft")
    public ApiResponse<JsonNode> outlineAiDraft(Principal principal, @PathVariable String id, @RequestBody(required = false) JsonNode body) {
        return ApiResponse.of(service.outlineAiDraft(id, body, principal.getName()));
    }

    /** v0.79 互动剧 AI 起草整张分支图。body: { theme? } → { episodes, interactive }（未落库，前端合并后再 PUT 保存）。 */
    @PostMapping("/{id}/interactive/draft")
    public ApiResponse<JsonNode> interactiveDraft(Principal principal, @PathVariable String id, @RequestBody(required = false) JsonNode body) {
        return ApiResponse.of(service.interactiveDraft(id, body, principal.getName()));
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

    /** C-2 三视图：角色一键生成 正/侧/全身 参考图集（IMAGE_GENERATION，hold→逐角度 commit）。
     *  body:{ angles?:[front|side|full], ratio?, appearanceHint? } → { characterId, refImages:[{cdnKey,url,angle,label}], cost }。 */
    @PostMapping("/{id}/characters/{charId}/reference-sheet")
    public ApiResponse<JsonNode> characterReferenceSheet(Principal principal, @PathVariable String id,
                                                         @PathVariable String charId,
                                                         @RequestBody(required = false) JsonNode body) {
        return ApiResponse.of(service.generateCharacterReferenceSheet(id, charId, body, principal.getName()));
    }

    /** 镜头分解（v0.97 P2，借鉴 ViMax）：单镜画面 → 首/末帧静态快照 + 运动描述 + 变化等级（未落库，前端合并）。
     *  body: { desc, cast?:[名] } → { ffDesc, ffChars[], lfDesc, lfChars[], motionDesc, variationType, variationReason }。 */
    @PostMapping("/{id}/shot/decompose")
    public ApiResponse<JsonNode> decomposeShot(Principal principal, @PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.of(service.decomposeShot(id, body, principal.getName()));
    }

    /** 行级就地改写本镜（v0.97 P5）。body: { desc, size?, move?, line?, instruction, cast?:[名] } → { desc, size, move, line }。 */
    @PostMapping("/{id}/shot/rewrite")
    public ApiResponse<JsonNode> rewriteShot(Principal principal, @PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.of(service.rewriteShot(id, body, principal.getName()));
    }

    /** 成片合成：把某集已出片分镜按序拼成完整片。body: { ep } → { url, cdnKey, durationSec, shotCount, at }。 */
    @PostMapping("/{id}/assemble")
    public ApiResponse<JsonNode> assemble(Principal principal, @PathVariable String id,
                                          @RequestBody(required = false) JsonNode body) {
        return ApiResponse.of(assembleService.assemble(id, body, principal.getName()));
    }

    /** v0.73 抽 skill：把本项目反向蒸馏成可复用配方 Recipe（status=submitted，待运营审核）。→ Recipe DTO。 */
    @PostMapping("/{id}/extract-recipe")
    public ApiResponse<JsonNode> extractRecipe(Principal principal, @PathVariable String id) {
        return ApiResponse.of(recipeService.extractFromProject(id, principal.getName()));
    }
}
