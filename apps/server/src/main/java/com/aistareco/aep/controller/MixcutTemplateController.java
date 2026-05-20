package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MixcutTemplateDto;
import com.aistareco.aep.dto.MixcutTemplateUpsertRequest;
import com.aistareco.aep.service.mixcut.MixcutTemplateService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 混剪模板 REST API（v0.12+）。
 *
 *   GET    /api/mixcut/templates                 → 列出当前用户视角下的全部模板
 *   GET    /api/mixcut/templates/{templateId}    → 取单个模板（user 版本优先）
 *   PUT    /api/mixcut/templates/{templateId}    → 保存（upsert）当前用户的模板
 *   DELETE /api/mixcut/templates/{templateId}    → 删除当前用户的模板版本（factory 不可删）
 *
 * 当前 user_id 通过 query param 或请求头 X-User-Id 传入（MVP 兼容）。
 * v0.13 接入 Spring Security Principal 后可改从 SecurityContext 取。
 */
@RestController
@RequestMapping("/api/mixcut/templates")
public class MixcutTemplateController {

    private final MixcutTemplateService service;
    private final ObjectMapper mapper;

    public MixcutTemplateController(MixcutTemplateService service, ObjectMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping
    public ApiResponse<List<MixcutTemplateDto>> list(Principal principal) {
        var userId = currentUserId(principal);
        var rows = service.listForUser(userId).stream()
                .map(t -> MixcutTemplateDto.from(t, mapper))
                .toList();
        return ApiResponse.of(rows);
    }

    @GetMapping("/{templateId}")
    public ApiResponse<MixcutTemplateDto> get(@PathVariable String templateId, Principal principal) {
        var userId = currentUserId(principal);
        return ApiResponse.of(
                service.getForUser(templateId, userId)
                        .map(t -> MixcutTemplateDto.from(t, mapper))
                        .orElse(null)
        );
    }

    @PutMapping("/{templateId}")
    public ApiResponse<MixcutTemplateDto> upsert(
            @PathVariable String templateId,
            @RequestBody MixcutTemplateUpsertRequest req,
            Principal principal
    ) {
        // path 与 body 中 templateId 不一致时以 path 为准
        if (req.templateId() == null || !templateId.equals(req.templateId())) {
            req = new MixcutTemplateUpsertRequest(
                    templateId,
                    req.name(),
                    req.version(),
                    req.canvas(),
                    req.scenes(),
                    req.perturbationProfile(),
                    req.outputVariantsDefault(),
                    req.qualityGate(),
                    req.metadata()
            );
        }
        var userId = currentUserId(principal);
        var saved = service.upsertForUser(req, userId);
        return ApiResponse.of(MixcutTemplateDto.from(saved, mapper));
    }

    @DeleteMapping("/{templateId}")
    public ApiResponse<Boolean> delete(@PathVariable String templateId, Principal principal) {
        var userId = currentUserId(principal);
        return ApiResponse.of(service.deleteUserCopy(templateId, userId));
    }

    private static String currentUserId(Principal principal) {
        return principal == null ? null : principal.getName();
    }
}
