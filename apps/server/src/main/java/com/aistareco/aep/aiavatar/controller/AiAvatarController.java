package com.aistareco.aep.aiavatar.controller;

import com.aistareco.aep.aiavatar.dto.*;
import com.aistareco.aep.aiavatar.model.*;
import com.aistareco.aep.aiavatar.service.AiAvatarService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * AiAvatar 资产中心 · 用户侧主 API（/api/me/aiavatar/avatars）。
 *
 * 覆盖任务书 §7 的 10 个核心页面 + 7 步链路：
 *   资产总库 / 创建 / 素材授权 / 打样 / 草稿迭代 / 精调 / 模板出图 / 定稿 / 衍生 / 详情。
 *
 * 全部经 Principal 取 userId（= JWT subject），service 层做 ownerUserId 校验。
 */
@RestController
@RequestMapping("/api/me/aiavatar/avatars")
public class AiAvatarController {

    private final AiAvatarService service;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper;

    public AiAvatarController(AiAvatarService service, com.fasterxml.jackson.databind.ObjectMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    private static String uid(Principal p) {
        if (p == null) throw BusinessException.notFound("UNAUTHORIZED", "未登录");
        return p.getName();
    }

    // ── 资产总库 / CRUD ────────────────────────────────────────────────────────

    @GetMapping
    public ApiResponse<List<AiAvatarDto>> list(Principal principal) {
        return ApiResponse.of(service.listForUser(uid(principal)));
    }

    @PostMapping
    public ApiResponse<AiAvatarDto> create(@RequestBody AiAvatarRequests.CreateAvatar in, Principal principal) {
        return ApiResponse.of(service.toCardDto(service.create(uid(principal), in)));
    }

    @GetMapping("/{id}")
    public ApiResponse<AiAvatarDetailDto> detail(@PathVariable String id, Principal principal) {
        return ApiResponse.of(service.detail(id, uid(principal)));
    }

    @PutMapping("/{id}")
    public ApiResponse<AiAvatarDto> update(@PathVariable String id,
                                           @RequestBody AiAvatarRequests.UpdateAvatar in, Principal principal) {
        return ApiResponse.of(service.toCardDto(service.update(id, uid(principal), in)));
    }

    @PostMapping("/{id}/archive")
    public ApiResponse<AiAvatarDto> archive(@PathVariable String id, Principal principal) {
        return ApiResponse.of(service.toCardDto(service.archiveFinal(id, uid(principal))));
    }

    @PostMapping("/{id}/fork")
    public ApiResponse<AiAvatarDto> fork(@PathVariable String id,
                                         @RequestBody(required = false) AiAvatarRequests.ForkAvatar in, Principal principal) {
        String name = in == null ? null : in.name();
        return ApiResponse.of(service.toCardDto(service.fork(id, uid(principal), name)));
    }

    @PostMapping("/{id}/transition")
    public ApiResponse<AiAvatarDto> transition(@PathVariable String id,
                                               @RequestParam String status, Principal principal) {
        return ApiResponse.of(service.toCardDto(
                service.transition(id, uid(principal), AiAvatarStatus.fromWire(status))));
    }

    // ── 素材 / 授权 ────────────────────────────────────────────────────────────

    @PostMapping("/{id}/source-text")
    public ApiResponse<AiAvatarSourceMaterial> addText(@PathVariable String id,
                                                 @RequestBody AiAvatarRequests.AddSourceText in, Principal principal) {
        return ApiResponse.of(service.addText(id, uid(principal), in));
    }

    @PostMapping("/{id}/licenses")
    public ApiResponse<AiAvatarLicenseGrantDto> signLicense(@PathVariable String id,
                                                      @RequestBody AiAvatarRequests.SignLicense in, Principal principal) {
        return ApiResponse.of(AiAvatarLicenseGrantDto.from(service.signLicense(id, uid(principal), in)));
    }

    // ── 7 步生成动作 ────────────────────────────────────────────────────────────

    @PostMapping("/{id}/sampling")
    public ApiResponse<AiAvatarJobDto> sampling(@PathVariable String id,
                                          @RequestBody(required = false) AiAvatarRequests.SubmitJob req, Principal principal) {
        return ApiResponse.of(toJobDto(service.startSampling(id, uid(principal), req)));
    }

    @PostMapping("/{id}/draft-iterate")
    public ApiResponse<AiAvatarJobDto> draftIterate(@PathVariable String id,
                                              @RequestBody AiAvatarRequests.SubmitJob req, Principal principal) {
        return ApiResponse.of(toJobDto(service.startDraftIterate(id, uid(principal), req)));
    }

    @PostMapping("/{id}/refine/appearance")
    public ApiResponse<AiAvatarJobDto> refineAppearance(@PathVariable String id,
                                                  @RequestParam String capability,
                                                  @RequestBody AiAvatarRequests.SubmitJob req, Principal principal) {
        return ApiResponse.of(toJobDto(
                service.startAppearanceRefine(id, uid(principal), AiAvatarCapability.fromWire(capability), req)));
    }

    @PostMapping("/{id}/refine/region")
    public ApiResponse<AiAvatarJobDto> refineRegion(@PathVariable String id,
                                              @RequestBody AiAvatarRequests.SubmitJob req, Principal principal) {
        return ApiResponse.of(toJobDto(service.startRegionInpaint(id, uid(principal), req)));
    }

    @PostMapping("/{id}/refine/geometry")
    public ApiResponse<AiAvatarVersionDto> refineGeometry(@PathVariable String id,
                                                          @RequestBody AiAvatarRequests.GeometryRefine in, Principal principal) {
        return ApiResponse.of(service.toVersionDto(service.recordGeometryRefine(id, uid(principal), in)));
    }

    @PostMapping("/{id}/template-beautify")
    public ApiResponse<AiAvatarJobDto> templateBeautify(@PathVariable String id,
                                                  @RequestBody AiAvatarRequests.SubmitJob req, Principal principal) {
        return ApiResponse.of(toJobDto(service.startTemplateBeautify(id, uid(principal), req)));
    }

    @PostMapping("/{id}/finalize")
    public ApiResponse<AiAvatarDto> finalize(@PathVariable String id,
                                             @RequestBody(required = false) AiAvatarRequests.Finalize in, Principal principal) {
        AiAvatarRequests.Finalize body = in == null ? new AiAvatarRequests.Finalize(null, null, null) : in;
        return ApiResponse.of(service.toCardDto(service.finalize(id, uid(principal), body)));
    }

    @PostMapping("/{id}/derive")
    public ApiResponse<List<AiAvatarJobDto>> derive(@PathVariable String id,
                                              @RequestBody AiAvatarRequests.Derive in, Principal principal) {
        return ApiResponse.of(service.derive(id, uid(principal), in).stream().map(this::toJobDto).toList());
    }

    // ── 版本管理 ───────────────────────────────────────────────────────────────

    @GetMapping("/{id}/versions")
    public ApiResponse<List<AiAvatarVersionDto>> versions(@PathVariable String id, Principal principal) {
        return ApiResponse.of(service.listVersions(id, uid(principal)));
    }

    @PostMapping("/{id}/versions/{versionId}/mark")
    public ApiResponse<AiAvatarVersionDto> markVersion(@PathVariable String id, @PathVariable String versionId,
                                                       @RequestParam(required = false) Boolean preferred,
                                                       @RequestParam(required = false) Boolean discarded,
                                                       Principal principal) {
        return ApiResponse.of(service.toVersionDto(
                service.markVersion(id, uid(principal), versionId, preferred, discarded)));
    }

    @PostMapping("/{id}/versions/{versionId}/revert")
    public ApiResponse<AiAvatarDto> revert(@PathVariable String id, @PathVariable String versionId,
                                           Principal principal) {
        return ApiResponse.of(service.toCardDto(service.revertToVersion(id, uid(principal), versionId)));
    }

    private AiAvatarJobDto toJobDto(AiAvatarJob job) {
        return AiAvatarJobDto.from(job, mapper);
    }
}
