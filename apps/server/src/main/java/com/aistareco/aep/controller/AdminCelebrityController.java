package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.service.CelebrityActionPricingService;
import com.aistareco.aep.service.CelebrityZoneService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin 侧 AI 明星专区运营：/api/admin/celebrity/*。
 * v0.5：补齐 CRUD（明星 / 模板 / 资料图集 / 视频 / 引擎价）。
 * v0.35：加 action-pricing 端点（动作级权益扣减配置）。
 * 由 AepSecurityConfig 强制管理员角色（SUPER_ADMIN / OPERATOR）。
 */
@RestController
@RequestMapping("/api/admin/celebrity")
public class AdminCelebrityController {

    private final CelebrityZoneService service;
    private final CelebrityActionPricingService actionPricing;

    public AdminCelebrityController(CelebrityZoneService service,
                                     CelebrityActionPricingService actionPricing) {
        this.service = service;
        this.actionPricing = actionPricing;
    }

    // ── Stars 读 ────────────────────────────────────────────────────────────
    @GetMapping("/stars")
    public ApiResponse<List<CelebrityStarDto>> listStars(@RequestParam(required = false) String category,
                                                          @RequestParam(required = false) String sort) {
        return ApiResponse.of(service.listStars(category, sort));
    }

    @GetMapping("/stars/{id}")
    public ApiResponse<CelebrityStarDto> getStar(@PathVariable String id) {
        return ApiResponse.of(service.getStar(id));
    }

    // ── Stars 写（v0.5 新增；v0.62 起档案「编辑」移交明星商务工作台 PUT /api/star/profile，
    //    admin 仅保留运营性的新增 / 软删）──────────────────────────────────────
    @PostMapping("/stars")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CelebrityStarDto> createStar(@RequestBody AdminCelebrityStarUpsertDto req) {
        return ApiResponse.of(service.adminCreateStar(req));
    }

    @DeleteMapping("/stars/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStar(@PathVariable String id) {
        service.adminDeleteStar(id);
    }

    // ── Star photos / videos（v0.5 新增）─────────────────────────────────────
    @PostMapping("/stars/{id}/photos")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CelebrityStarDto> appendPhoto(@PathVariable String id,
                                                      @RequestBody AdminCelebrityStarPhotoUpsertDto req) {
        return ApiResponse.of(service.adminAppendStarPhoto(id, req));
    }

    @DeleteMapping("/stars/{id}/photos/{photoId}")
    public ApiResponse<CelebrityStarDto> removePhoto(@PathVariable String id, @PathVariable String photoId) {
        return ApiResponse.of(service.adminRemoveStarPhoto(id, photoId));
    }

    @PostMapping("/stars/{id}/videos")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CelebrityStarDto> appendVideo(@PathVariable String id,
                                                      @RequestBody AdminCelebrityStarVideoUpsertDto req) {
        return ApiResponse.of(service.adminAppendStarVideo(id, req));
    }

    @DeleteMapping("/stars/{id}/videos/{videoId}")
    public ApiResponse<CelebrityStarDto> removeVideo(@PathVariable String id, @PathVariable String videoId) {
        return ApiResponse.of(service.adminRemoveStarVideo(id, videoId));
    }

    // ── Templates 读 + CRUD（v0.5 新增写）───────────────────────────────────
    @GetMapping("/templates")
    public ApiResponse<List<CelebrityTemplateDto>> listTemplates() {
        return ApiResponse.of(service.listTemplates());
    }

    @PostMapping("/templates")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CelebrityTemplateDto> createTemplate(@RequestBody AdminCelebrityTemplateUpsertDto req) {
        return ApiResponse.of(service.adminCreateTemplate(req));
    }

    @PutMapping("/templates/{id}")
    public ApiResponse<CelebrityTemplateDto> updateTemplate(@PathVariable String id,
                                                              @RequestBody AdminCelebrityTemplateUpsertDto req) {
        return ApiResponse.of(service.adminUpdateTemplate(id, req));
    }

    @DeleteMapping("/templates/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTemplate(@PathVariable String id) {
        service.adminDeleteTemplate(id);
    }

    @PutMapping("/templates/{id}/preview")
    public ApiResponse<CelebrityTemplateDto> setTemplatePreview(@PathVariable String id,
                                                                  @RequestBody AdminCelebrityTemplatePreviewUpsertDto req) {
        return ApiResponse.of(service.adminSetTemplatePreview(id, req));
    }

    // ── Showcases / Projects / Videos / Overview / Engine pricing ──────────
    @GetMapping("/showcases")
    public ApiResponse<List<CelebrityShowcaseDto>> listShowcases(@RequestParam(required = false) String mode) {
        return ApiResponse.of(service.listShowcases(mode));
    }

    /** Admin 看到所有用户的项目（不按 ownerUserId 过滤）。 */
    @GetMapping("/projects")
    public ApiResponse<List<CelebrityProjectDto>> listProjects(@RequestParam(required = false) String status) {
        return ApiResponse.of(service.listAllProjects(status));
    }

    @GetMapping("/videos")
    public ApiResponse<List<CelebrityProjectVideoDto>> listAllVideos(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String starId,
            @RequestParam(required = false) String projectId,
            @RequestParam(required = false) String sort) {
        return ApiResponse.of(service.listAllVideos(status, starId, projectId, sort));
    }

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.of(service.getOverview());
    }

    @GetMapping("/engine-pricing")
    public ApiResponse<Map<String, EnginePricingDto>> enginePricing() {
        return ApiResponse.of(service.getEnginePricing());
    }

    /** v0.5：admin 调价。本期挂 in-memory（重启失效）；落 PlatformConfig 留给 §D5 后续迭代。 */
    @PutMapping("/engine-pricing")
    public ApiResponse<Map<String, EnginePricingDto>> replaceEnginePricing(
            @RequestBody Map<String, EnginePricingDto> next) {
        return ApiResponse.of(service.adminReplaceEnginePricing(next));
    }

    // ── v0.35：动作级权益扣减单价（PlatformConfig key=celebrity.action-pricing）─────
    @GetMapping("/action-pricing")
    public ApiResponse<Map<String, ActionPricingDto>> actionPricing() {
        return ApiResponse.of(actionPricing.getAll());
    }

    @PutMapping("/action-pricing")
    public ApiResponse<Map<String, ActionPricingDto>> replaceActionPricing(
            @RequestBody Map<String, ActionPricingDto> next) {
        return ApiResponse.of(actionPricing.replaceAll(next));
    }
}
