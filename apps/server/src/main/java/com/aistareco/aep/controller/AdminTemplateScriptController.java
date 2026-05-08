package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.service.TemplateScriptAdminService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Admin 模板脚本：/api/admin/template-scripts/*。v0.5 新增。
 */
@RestController
@RequestMapping("/api/admin/template-scripts")
public class AdminTemplateScriptController {

    private final TemplateScriptAdminService service;

    public AdminTemplateScriptController(TemplateScriptAdminService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<TemplateScriptDto>> list(
            @RequestParam(required = false) String templateId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String kind) {
        return ApiResponse.of(service.list(templateId, status, kind));
    }

    @GetMapping("/{id}")
    public ApiResponse<TemplateScriptDto> get(@PathVariable String id) {
        return ApiResponse.of(service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TemplateScriptDto> create(@RequestBody AdminTemplateScriptUpsertDto req) {
        return ApiResponse.of(service.create(req));
    }

    @PutMapping("/{id}")
    public ApiResponse<TemplateScriptDto> update(@PathVariable String id,
                                                   @RequestBody AdminTemplateScriptUpsertDto req) {
        return ApiResponse.of(service.update(id, req));
    }

    @PostMapping("/{id}/submit-review")
    public ApiResponse<TemplateScriptDto> submitReview(@PathVariable String id) {
        return ApiResponse.of(service.submitReview(id));
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<TemplateScriptDto> publish(Principal principal, @PathVariable String id) {
        String op = principal != null ? principal.getName() : "admin";
        return ApiResponse.of(service.publish(id, op));
    }

    @PostMapping("/{id}/rollback")
    public ApiResponse<TemplateScriptDto> rollback(Principal principal, @PathVariable String id) {
        String op = principal != null ? principal.getName() : "admin";
        return ApiResponse.of(service.rollback(id, op));
    }

    @PostMapping("/{id}/dry-run")
    public ApiResponse<DryRunResponseDto> dryRun(@PathVariable String id, @RequestBody DryRunRequestDto req) {
        return ApiResponse.of(service.dryRun(id, req));
    }

    @PostMapping("/{id}/draft-with-ai")
    public ApiResponse<Map<String, String>> draftWithAi(@PathVariable String id,
                                                          @RequestBody Map<String, Object> req) {
        return ApiResponse.of(service.draftWithAi(id, req));
    }

    /** v0.5：本期 application/json 接 URL，不处理 multipart。 */
    @PostMapping("/{id}/upload-clip")
    public ApiResponse<TemplateScriptDto> uploadClip(@PathVariable String id,
                                                       @RequestBody Map<String, Object> referenceClip) {
        return ApiResponse.of(service.uploadClip(id, referenceClip));
    }
}
