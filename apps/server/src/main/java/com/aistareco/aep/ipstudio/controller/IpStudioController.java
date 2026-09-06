package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpPricingDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpProjectDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpProjectSummaryDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpPublishResultDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpStylePresetDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpTemplateDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpUploadResultDto;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpCreateProjectRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpPublishRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpRunNodeRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpUpdateProjectRequest;
import com.aistareco.aep.ipstudio.service.IpCatalogService;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpPublishService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * AI IP 工作台（apps/web-ipstudio）。
 *
 * <p>挂在 {@code /api/v1/**} 下，因此已被 {@code ProductRouteTable} 的
 * {@code any("/api/v1/**", AIAVATAR)} 兜底 —— 共用 aiavatar 开通，不新增产品码。
 * 全部 {@code authenticated}，属主校验统一在 service 层
 * （{@code IpProjectService.required} 是唯一入口）。
 */
@RestController
@RequestMapping("/api/v1/ip-studio")
public class IpStudioController {

    private final IpProjectService projects;
    private final IpRunService runs;
    private final IpPublishService publish;
    private final IpCatalogService catalog;

    public IpStudioController(IpProjectService projects,
                              IpRunService runs,
                              IpPublishService publish,
                              IpCatalogService catalog) {
        this.projects = projects;
        this.runs = runs;
        this.publish = publish;
        this.catalog = catalog;
    }

    // ── 目录 ──────────────────────────────────────────────────

    @GetMapping("/templates")
    public ApiResponse<List<IpTemplateDto>> templates() {
        return ApiResponse.of(catalog.templates());
    }

    @GetMapping("/styles")
    public ApiResponse<List<IpStylePresetDto>> styles() {
        return ApiResponse.of(catalog.styles());
    }

    @GetMapping("/pricing")
    public ApiResponse<IpPricingDto> pricing() {
        return ApiResponse.of(runs.pricingDto());
    }

    // ── 上传 ──────────────────────────────────────────────────

    @PostMapping("/uploads")
    public ApiResponse<IpUploadResultDto> upload(Principal principal,
                                                 @RequestPart("file") MultipartFile file) {
        return ApiResponse.of(projects.upload(uid(principal), file));
    }

    // ── 项目 ──────────────────────────────────────────────────

    @GetMapping("/projects")
    public ApiResponse<List<IpProjectSummaryDto>> list(Principal principal) {
        return ApiResponse.of(projects.list(uid(principal)));
    }

    @PostMapping("/projects")
    public ApiResponse<IpProjectDto> create(Principal principal,
                                            @RequestBody(required = false) IpCreateProjectRequest req) {
        return ApiResponse.of(projects.create(uid(principal), req));
    }

    @GetMapping("/projects/{id}")
    public ApiResponse<IpProjectDto> detail(Principal principal, @PathVariable String id) {
        return ApiResponse.of(projects.detail(uid(principal), id));
    }

    @PutMapping("/projects/{id}")
    public ApiResponse<IpProjectDto> update(Principal principal, @PathVariable String id,
                                            @RequestBody IpUpdateProjectRequest req) {
        return ApiResponse.of(projects.update(uid(principal), id, req));
    }

    @DeleteMapping("/projects/{id}")
    public ApiResponse<Map<String, Object>> remove(Principal principal, @PathVariable String id) {
        projects.remove(uid(principal), id);
        return ApiResponse.of(Map.of("id", id, "deleted", true));
    }

    // ── 运行 ──────────────────────────────────────────────────

    @PostMapping("/projects/{id}/nodes/{nodeId}/run")
    public ApiResponse<IpRunDto> run(Principal principal,
                                     @PathVariable String id,
                                     @PathVariable String nodeId,
                                     @RequestBody(required = false) IpRunNodeRequest req) {
        return ApiResponse.of(runs.run(uid(principal), id, nodeId, req));
    }

    @GetMapping("/runs/{id}")
    public ApiResponse<IpRunDto> run(Principal principal, @PathVariable String id) {
        return ApiResponse.of(runs.get(uid(principal), id));
    }

    @PostMapping("/runs/{id}/cancel")
    public ApiResponse<IpRunDto> cancelRun(Principal principal, @PathVariable String id) {
        return ApiResponse.of(runs.cancel(uid(principal), id));
    }

    // ── 发布 ──────────────────────────────────────────────────

    @PostMapping("/projects/{id}/publish")
    public ApiResponse<IpPublishResultDto> publish(Principal principal, @PathVariable String id,
                                                   @RequestBody IpPublishRequest req) {
        return ApiResponse.of(publish.publish(uid(principal), id, req));
    }

    private static String uid(Principal p) {
        if (p == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        return p.getName();
    }
}
