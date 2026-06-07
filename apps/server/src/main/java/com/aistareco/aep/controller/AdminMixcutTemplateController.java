package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MixcutTemplateDto;
import com.aistareco.aep.dto.MixcutTemplateUpsertRequest;
import com.aistareco.aep.service.mixcut.MixcutTemplateService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;

/**
 * 混剪「工厂模板」运营管理 REST API（v0.55+）。
 *
 *   PUT    /api/admin/mixcut/templates/{templateId}  → 就地写工厂模板（FACTORY_SCOPE，全员可见）
 *   DELETE /api/admin/mixcut/templates/{templateId}  → 删除工厂模板
 *
 * 与用户端 {@link MixcutTemplateController}（只作用于 user scope 的个人副本）互补：
 * 本控制器始终落 factory scope，供 web-celebrity 内嵌的运营角色 + admin 后台调用。
 *
 * 落在 /api/admin/** 下，由 AepSecurityConfig 强制 hasAnyRole(SUPER_ADMIN, OPERATOR)。
 */
@RestController
@RequestMapping("/api/admin/mixcut/templates")
public class AdminMixcutTemplateController {

    private final MixcutTemplateService service;
    private final ObjectMapper mapper;

    public AdminMixcutTemplateController(MixcutTemplateService service, ObjectMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @PutMapping("/{templateId}")
    public ApiResponse<MixcutTemplateDto> upsertFactory(
            @PathVariable String templateId,
            @RequestBody MixcutTemplateUpsertRequest req
    ) {
        // path 与 body 中 templateId 不一致时以 path 为准（mirror MixcutTemplateController.upsert）
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
        var saved = service.upsertFactory(req);
        return ApiResponse.of(MixcutTemplateDto.from(saved, mapper));
    }

    @DeleteMapping("/{templateId}")
    public ApiResponse<Boolean> deleteFactory(@PathVariable String templateId) {
        return ApiResponse.of(service.deleteFactory(templateId));
    }
}
