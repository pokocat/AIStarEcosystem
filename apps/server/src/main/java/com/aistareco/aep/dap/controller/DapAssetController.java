package com.aistareco.aep.dap.controller;

import com.aistareco.aep.dap.dto.DapAssetDtos.AssetSummaryDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.AssetUsageDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.IpDetailDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.IpDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.ProductDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.SceneDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.StyleDto;
import com.aistareco.aep.dap.dto.DapAssetRequests.CreateIpRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.CreateProductRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.CreateSceneRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.CreateStyleRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.IpLicenseRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.IpMemberRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.PatchIpRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.PatchProductRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.PatchSceneRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.PatchStyleRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.ProductAngleRequest;
import com.aistareco.aep.dap.dto.DapAssetRequests.SceneVariantRequest;
import com.aistareco.aep.dap.service.DapAssetService;
import com.aistareco.aep.dap.service.DapCompositionService;
import com.aistareco.aep.dap.service.DapStarGrantService;
import com.aistareco.aep.dap.dto.DapStarGrantDto;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 数字资产平台 · 六类资产（/api/v1/assets/**）。
 * 全部 authenticated（AepSecurityConfig /api/v1/**），principal.getName() = userId，
 * service 层每个查询都带 ownerUserId 归属校验。
 */
@RestController
@RequestMapping("/api/v1/assets")
public class DapAssetController {

    private final DapAssetService assets;
    private final DapCompositionService compositions;
    private final DapStarGrantService starGrants;

    public DapAssetController(DapAssetService assets, DapCompositionService compositions, DapStarGrantService starGrants) {
        this.assets = assets;
        this.compositions = compositions;
        this.starGrants = starGrants;
    }

    private static String uid(Principal p) {
        if (p == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        return p.getName();
    }

    // ── 资产总览（首页 · 资产总览 / 资产库分类计数）─────────────

    @GetMapping("/summary")
    public ApiResponse<AssetSummaryDto> summary(Principal principal) {
        return ApiResponse.of(assets.summary(uid(principal)));
    }

    // ── 明星授权只读投影（资产中枢 P2：货架 / 授权中心「授权给我的」）──

    @GetMapping("/star-grants")
    public ApiResponse<List<DapStarGrantDto>> starGrants(Principal principal) {
        return ApiResponse.of(starGrants.list(uid(principal)));
    }

    // ── IP 容器 ────────────────────────────────────────────────

    @GetMapping("/ips")
    public ApiResponse<List<IpDto>> listIps(Principal principal) {
        return ApiResponse.of(assets.listIps(uid(principal)));
    }

    @PostMapping("/ips")
    public ApiResponse<IpDto> createIp(Principal principal, @RequestBody CreateIpRequest req) {
        return ApiResponse.of(assets.createIp(uid(principal), req));
    }

    @GetMapping("/ips/{id}")
    public ApiResponse<IpDetailDto> ipDetail(Principal principal, @PathVariable String id) {
        String userId = uid(principal);
        return ApiResponse.of(assets.ipDetail(userId, id, compositions.list(userId, id)));
    }

    @PatchMapping("/ips/{id}")
    public ApiResponse<IpDto> patchIp(Principal principal, @PathVariable String id,
                                      @RequestBody PatchIpRequest req) {
        return ApiResponse.of(assets.patchIp(uid(principal), id, req));
    }

    @DeleteMapping("/ips/{id}")
    public ApiResponse<Map<String, Object>> deleteIp(Principal principal, @PathVariable String id) {
        assets.deleteIp(uid(principal), id);
        return ApiResponse.of(Map.of("deleted", true));
    }

    /** 关联 / 取消关联成员资产（人物 / 场景 / 产品）。 */
    @PostMapping("/ips/{id}/members")
    public ApiResponse<IpDetailDto> ipMember(Principal principal, @PathVariable String id,
                                             @RequestBody IpMemberRequest req) {
        String userId = uid(principal);
        return ApiResponse.of(assets.member(userId, id, req, compositions.list(userId, id)));
    }

    /** 登记 / 续签 IP 授权（LIC 凭证 · 有效期 · 续签）。 */
    @PostMapping("/ips/{id}/license")
    public ApiResponse<Map<String, Object>> ipLicense(Principal principal, @PathVariable String id,
                                                      @RequestBody(required = false) IpLicenseRequest req) {
        return ApiResponse.of(assets.upsertIpLicense(uid(principal), id, req));
    }

    // ── 场景 ──────────────────────────────────────────────────

    @GetMapping("/scenes")
    public ApiResponse<List<SceneDto>> listScenes(Principal principal,
                                                  @RequestParam(required = false) String source,
                                                  @RequestParam(required = false) String space,
                                                  @RequestParam(required = false) String ipId,
                                                  @RequestParam(required = false) String q) {
        return ApiResponse.of(assets.listScenes(uid(principal), source, space, ipId, q));
    }

    /** AI 生成场景（异步任务 + 扣费）→ { scene, job }。 */
    @PostMapping("/scenes")
    public ApiResponse<Map<String, Object>> createScene(Principal principal,
                                                        @RequestBody CreateSceneRequest req) {
        return ApiResponse.of(assets.generateScene(uid(principal), req));
    }

    /** 实拍上传入库（multipart；轻资产只记来源，不扣费）。 */
    @PostMapping("/scenes/upload")
    public ApiResponse<SceneDto> uploadScene(Principal principal,
                                             @RequestParam("file") MultipartFile file,
                                             @RequestParam(required = false) String name,
                                             @RequestParam(required = false) String description,
                                             @RequestParam(required = false) String space,
                                             @RequestParam(required = false) String light,
                                             @RequestParam(required = false) String ipId) {
        return ApiResponse.of(assets.uploadScene(uid(principal), file, name, description, space, light, ipId));
    }

    @GetMapping("/scenes/{id}")
    public ApiResponse<SceneDto> scene(Principal principal, @PathVariable String id) {
        return ApiResponse.of(assets.sceneDto(uid(principal), id));
    }

    @PatchMapping("/scenes/{id}")
    public ApiResponse<SceneDto> patchScene(Principal principal, @PathVariable String id,
                                            @RequestBody PatchSceneRequest req) {
        return ApiResponse.of(assets.patchScene(uid(principal), id, req));
    }

    @DeleteMapping("/scenes/{id}")
    public ApiResponse<Map<String, Object>> deleteScene(Principal principal, @PathVariable String id) {
        assets.deleteScene(uid(principal), id);
        return ApiResponse.of(Map.of("deleted", true));
    }

    /** 生成光线变体（按张扣费）→ { job }。 */
    @PostMapping("/scenes/{id}/variants")
    public ApiResponse<Map<String, Object>> sceneVariants(Principal principal, @PathVariable String id,
                                                          @RequestBody(required = false) SceneVariantRequest req) {
        return ApiResponse.of(assets.sceneVariants(uid(principal), id, req));
    }

    // ── 产品 ──────────────────────────────────────────────────

    @GetMapping("/products")
    public ApiResponse<List<ProductDto>> listProducts(Principal principal,
                                                      @RequestParam(required = false) String category,
                                                      @RequestParam(required = false) String ipId,
                                                      @RequestParam(required = false) String q) {
        return ApiResponse.of(assets.listProducts(uid(principal), category, ipId, q));
    }

    /** AI 生成产品图（异步任务 + 扣费）→ { product, job }。 */
    @PostMapping("/products")
    public ApiResponse<Map<String, Object>> createProduct(Principal principal,
                                                          @RequestBody CreateProductRequest req) {
        return ApiResponse.of(assets.generateProduct(uid(principal), req));
    }

    /** 实拍上传入库（multipart；自动记为正面角度，不扣费）。 */
    @PostMapping("/products/upload")
    public ApiResponse<ProductDto> uploadProduct(Principal principal,
                                                 @RequestParam("file") MultipartFile file,
                                                 @RequestParam(required = false) String name,
                                                 @RequestParam(required = false) String category,
                                                 @RequestParam(required = false) String description,
                                                 @RequestParam(required = false) String ipId,
                                                 @RequestParam(required = false) Boolean brandAuthorized,
                                                 @RequestParam(required = false) String brandLicenseUntil) {
        return ApiResponse.of(assets.uploadProduct(uid(principal), file, name, category, description,
                ipId, brandAuthorized, brandLicenseUntil));
    }

    @GetMapping("/products/{id}")
    public ApiResponse<ProductDto> product(Principal principal, @PathVariable String id) {
        return ApiResponse.of(assets.productDto(uid(principal), id));
    }

    @PatchMapping("/products/{id}")
    public ApiResponse<ProductDto> patchProduct(Principal principal, @PathVariable String id,
                                                @RequestBody PatchProductRequest req) {
        return ApiResponse.of(assets.patchProduct(uid(principal), id, req));
    }

    @DeleteMapping("/products/{id}")
    public ApiResponse<Map<String, Object>> deleteProduct(Principal principal, @PathVariable String id) {
        assets.deleteProduct(uid(principal), id);
        return ApiResponse.of(Map.of("deleted", true));
    }

    /** 补充角度（按张扣费）→ { job }。 */
    @PostMapping("/products/{id}/angles")
    public ApiResponse<Map<String, Object>> productAngles(Principal principal, @PathVariable String id,
                                                          @RequestBody(required = false) ProductAngleRequest req) {
        return ApiResponse.of(assets.productAngles(uid(principal), id, req));
    }

    // ── 风格模板 ───────────────────────────────────────────────

    @GetMapping("/styles")
    public ApiResponse<List<StyleDto>> listStyles(Principal principal) {
        return ApiResponse.of(assets.listStyles(uid(principal)));
    }

    @PostMapping("/styles")
    public ApiResponse<StyleDto> createStyle(Principal principal, @RequestBody CreateStyleRequest req) {
        return ApiResponse.of(assets.createStyle(uid(principal), req));
    }

    @GetMapping("/styles/{id}")
    public ApiResponse<StyleDto> style(Principal principal, @PathVariable String id) {
        return ApiResponse.of(assets.styleDto(uid(principal), id));
    }

    @PatchMapping("/styles/{id}")
    public ApiResponse<StyleDto> patchStyle(Principal principal, @PathVariable String id,
                                            @RequestBody PatchStyleRequest req) {
        return ApiResponse.of(assets.patchStyle(uid(principal), id, req));
    }

    @DeleteMapping("/styles/{id}")
    public ApiResponse<Map<String, Object>> deleteStyle(Principal principal, @PathVariable String id) {
        assets.deleteStyle(uid(principal), id);
        return ApiResponse.of(Map.of("deleted", true));
    }

    // ── 引用台账（APPLIED TO · 已用于）──────────────────────────

    @GetMapping("/usages")
    public ApiResponse<List<AssetUsageDto>> usages(Principal principal,
                                                   @RequestParam String assetType,
                                                   @RequestParam String assetId) {
        return ApiResponse.of(assets.usages(uid(principal), assetType, assetId));
    }
}
