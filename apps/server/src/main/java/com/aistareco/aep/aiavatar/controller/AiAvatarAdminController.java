package com.aistareco.aep.aiavatar.controller;

import com.aistareco.aep.aiavatar.dto.AiAvatarRequests;
import com.aistareco.aep.aiavatar.dto.AiAvatarTemplateDto;
import com.aistareco.aep.aiavatar.dto.AiAvatarUiConfigDto;
import com.aistareco.aep.aiavatar.service.AiAvatarJobWatchdog;
import com.aistareco.aep.aiavatar.service.AiAvatarTemplateService;
import com.aistareco.aep.aiavatar.service.AiAvatarUiConfigService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * AiAvatar 资产中心 · 管理端 API（/api/admin/aiavatar/**）。受 SUPER_ADMIN / OPERATOR 门禁（AepSecurityConfig）。
 *
 * - 工厂模板 CRUD（AI 模板中心运营）
 * - 手动触发监控线程巡检（运维 / 联调）
 */
@RestController
@RequestMapping("/api/admin/aiavatar")
public class AiAvatarAdminController {

    private final AiAvatarTemplateService templateService;
    private final AiAvatarJobWatchdog watchdog;
    private final AiAvatarUiConfigService uiConfigService;

    public AiAvatarAdminController(AiAvatarTemplateService templateService, AiAvatarJobWatchdog watchdog,
                                   AiAvatarUiConfigService uiConfigService) {
        this.templateService = templateService;
        this.watchdog = watchdog;
        this.uiConfigService = uiConfigService;
    }

    @GetMapping("/templates")
    public ApiResponse<List<AiAvatarTemplateDto>> listTemplates() {
        return ApiResponse.of(templateService.listAll());
    }

    @PostMapping("/templates")
    public ApiResponse<AiAvatarTemplateDto> createTemplate(@RequestBody AiAvatarRequests.TemplateUpsert in, Principal principal) {
        boolean official = in.official() == null || in.official();
        String owner = principal == null ? null : principal.getName();
        return ApiResponse.of(templateService.toDto(templateService.create(in, official, owner)));
    }

    @PutMapping("/templates/{id}")
    public ApiResponse<AiAvatarTemplateDto> updateTemplate(@PathVariable String id, @RequestBody AiAvatarRequests.TemplateUpsert in) {
        return ApiResponse.of(templateService.toDto(templateService.update(id, in)));
    }

    @DeleteMapping("/templates/{id}")
    public ApiResponse<Boolean> deleteTemplate(@PathVariable String id) {
        templateService.delete(id);
        return ApiResponse.of(true);
    }

    // ── UI 文案配置（快捷指令 / 默认人设 / 局部重绘默认词） ──────────────────────
    @GetMapping("/ui-config")
    public ApiResponse<AiAvatarUiConfigDto> getUiConfig() {
        return ApiResponse.of(uiConfigService.get());
    }

    @PutMapping("/ui-config")
    public ApiResponse<AiAvatarUiConfigDto> updateUiConfig(@RequestBody AiAvatarUiConfigDto in, Principal principal) {
        String by = principal == null ? "operator" : principal.getName();
        return ApiResponse.of(uiConfigService.update(in, by));
    }

    /** 手动触发一次监控线程巡检（任务书监控线程：平时每小时自动，运维可即时触发）。 */
    @PostMapping("/watchdog/sweep")
    public ApiResponse<String> sweep() {
        watchdog.sweep();
        return ApiResponse.of("ok", "已触发任务监控巡检");
    }
}
