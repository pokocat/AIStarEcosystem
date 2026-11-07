package com.aistareco.aep.controller;

import com.aistareco.aep.platform.ModelManagementService;
import com.aistareco.aep.platform.ModelOperationsService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.Set;

/**
 * Studio 运营后台的「模型配置」页（/api/admin/studio/model-config；SUPER_ADMIN / OPERATOR）。
 *
 * <p>和已停用的统一后台走同一份命令（{@link ModelManagementService}），校验、加锁、审计都在那里，这里不另写一遍。
 * 只放行页面用得到的命令：提示词、Agent 这些不在这个页面管的，这个入口调不到。
 */
@Slf4j
@RestController
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'OPERATOR')")
@RequestMapping("/api/admin/studio/model-config")
public class AdminStudioModelConfigController {
    private static final int MAX_COMMAND_CHARS = 250_000;
    static final Set<String> ACTIONS = Set.of(
            // 模型接入与开放范围
            "endpoints", "presets", "modelAccessCatalog",
            "endpointSave", "endpointDelete", "endpointCosts", "modelAccessSave",
            "endpointTest", "endpointFetchModels", "endpointProbe",
            // IP Studio 模型
            "sceneCatalog", "studioVideoGroup", "directorImageDefault",
            "scenePolicySave", "sceneCandidatePrepare", "studioVideoGroupSave", "directorImageDefaultSave",
            // 功能绑定与售价
            "functionCatalog", "functionPricingCatalog",
            "functionDefaultSave", "functionCandidatePrepare", "functionCandidatePriceSave",
            "functionActionPriceSave", "functionConfigPriceSave", "functionSupplierPointPriceSave",
            "functionEnginePriceSave", "videoPricesSave");

    private final ModelManagementService service;
    private final ModelOperationsService operations;

    public AdminStudioModelConfigController(ModelManagementService service, ModelOperationsService operations) {
        this.service = service;
        this.operations = operations;
    }

    @PostMapping("/command")
    public ApiResponse<Object> command(@RequestBody JsonNode command, Principal principal) {
        if (command == null || !command.isObject() || !ACTIONS.contains(command.path("action").asText())
                || command.toString().length() > MAX_COMMAND_CHARS) throw invalid();
        String action = command.path("action").asText();
        try {
            return ApiResponse.of(ModelOperationsService.handles(action)
                    ? operations.execute(command)
                    : service.execute(command, principal == null ? "admin" : principal.getName(), "studio-admin"));
        } catch (BusinessException | org.springframework.web.server.ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            // 只记动作和异常类型：命令正文可能带上游密钥。
            log.warn("[studio-model-config] rejected action={} cause={}", action, e.getClass().getName());
            throw invalid();
        }
    }

    private static BusinessException invalid() {
        return new BusinessException(HttpStatus.BAD_REQUEST, "MODEL_MANAGEMENT_COMMAND_INVALID", "配置内容无效，请检查后重试");
    }
}
