package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MixcutTemplateDto;
import com.aistareco.aep.dto.MixcutTemplateUpsertRequest;
import com.aistareco.aep.service.mixcut.MixcutTemplateService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin 混剪工厂模板 CRUD。
 *
 * 鉴权：/api/admin/** 由 AepSecurityConfig 统一限制为 SUPER_ADMIN / OPERATOR。
 * 这里只操作 ownerScope=factory 的全局模板，不读取或删除任何用户私有 override。
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

    @GetMapping
    public ApiResponse<List<MixcutTemplateDto>> list() {
        var rows = service.listFactoryTemplates().stream()
                .map(t -> MixcutTemplateDto.from(t, mapper))
                .toList();
        return ApiResponse.of(rows);
    }

    @GetMapping("/{templateId}")
    public ApiResponse<MixcutTemplateDto> get(@PathVariable String templateId) {
        return ApiResponse.of(
                service.getFactoryTemplate(templateId)
                        .map(t -> MixcutTemplateDto.from(t, mapper))
                        .orElse(null)
        );
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<MixcutTemplateDto> create(@RequestBody MixcutTemplateUpsertRequest req) {
        var saved = service.upsertFactory(req);
        return ApiResponse.of(MixcutTemplateDto.from(saved, mapper));
    }

    @PutMapping("/{templateId}")
    public ApiResponse<MixcutTemplateDto> upsert(
            @PathVariable String templateId,
            @RequestBody MixcutTemplateUpsertRequest req
    ) {
        var saved = service.upsertFactory(withPathTemplateId(templateId, req));
        return ApiResponse.of(MixcutTemplateDto.from(saved, mapper));
    }

    @DeleteMapping("/{templateId}")
    public ApiResponse<Boolean> delete(@PathVariable String templateId) {
        return ApiResponse.of(service.deleteFactory(templateId));
    }

    private static MixcutTemplateUpsertRequest withPathTemplateId(
            String templateId,
            MixcutTemplateUpsertRequest req
    ) {
        if (req.templateId() != null && templateId.equals(req.templateId())) {
            return req;
        }
        return new MixcutTemplateUpsertRequest(
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
}
