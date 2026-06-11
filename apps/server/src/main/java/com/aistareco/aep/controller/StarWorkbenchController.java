package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.StarContentReview;
import com.aistareco.aep.service.StarWorkbenchService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 明星商务工作台（web-star，v0.60）REST 端点。
 *
 * 安全：{@code /api/star/**} 在 {@link com.aistareco.aep.config.AepSecurityConfig}
 * 配置为 authenticated；本控制器内一律以 JWT principal（userId）解析账号绑定的
 * 明星档案，单据归属在 service 层逐条校验（starId == 绑定明星）。
 */
@RestController
@RequestMapping("/api/star")
public class StarWorkbenchController {

    private final StarWorkbenchService service;

    public StarWorkbenchController(StarWorkbenchService service) {
        this.service = service;
    }

    private static String requireUserId(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        }
        return principal.getName();
    }

    // ── 档案 / 入驻 / 总览 ──────────────────────────────────────────────────

    @GetMapping("/profile")
    public ApiResponse<StarProfileDto> profile(Principal principal) {
        return ApiResponse.of(service.getProfile(requireUserId(principal)));
    }

    /** v0.62：档案编辑（从 admin 移入）—— 明星本人 / 经纪团队自维护营销展示字段。 */
    @PutMapping("/profile")
    public ApiResponse<StarProfileDto> updateProfile(Principal principal,
                                                      @RequestBody StarProfileUpdateRequestDto req) {
        return ApiResponse.of(service.updateProfile(requireUserId(principal), req));
    }

    @PostMapping("/onboard")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<StarProfileDto> onboard(Principal principal, @RequestBody StarOnboardRequestDto req) {
        return ApiResponse.of(service.onboard(requireUserId(principal), req));
    }

    @GetMapping("/overview")
    public ApiResponse<StarOverviewDto> overview(Principal principal) {
        return ApiResponse.of(service.getOverview(requireUserId(principal)));
    }

    // ── IP 授权中心 ──────────────────────────────────────────────────────────

    @GetMapping("/ip-assets")
    public ApiResponse<List<StarIpAssetDto>> listIpAssets(Principal principal) {
        return ApiResponse.of(service.listIpAssets(requireUserId(principal)));
    }

    @PostMapping("/ip-assets/{type}/advance")
    public ApiResponse<StarIpAssetDto> advanceIpAsset(Principal principal, @PathVariable String type) {
        return ApiResponse.of(service.advanceIpAsset(requireUserId(principal), type));
    }

    // ── 带货授权（celebrity ↔ star 打通） ───────────────────────────────────

    @GetMapping("/cooperations")
    public ApiResponse<List<StarCooperationRequestDto>> listCooperations(Principal principal,
                                                                          @RequestParam(required = false) String status) {
        return ApiResponse.of(service.listCooperations(requireUserId(principal), status));
    }

    @PostMapping("/cooperations/{id}/approve")
    public ApiResponse<StarCooperationRequestDto> approveCooperation(Principal principal,
                                                                      @PathVariable String id,
                                                                      @RequestBody(required = false) StarCooperationDecisionDto req) {
        return ApiResponse.of(service.approveCooperation(requireUserId(principal), id, req));
    }

    @PostMapping("/cooperations/{id}/reject")
    public ApiResponse<StarCooperationRequestDto> rejectCooperation(Principal principal,
                                                                     @PathVariable String id,
                                                                     @RequestBody(required = false) StarCooperationDecisionDto req) {
        return ApiResponse.of(service.rejectCooperation(requireUserId(principal), id, req != null ? req.reason() : null));
    }

    // ── 报白 ─────────────────────────────────────────────────────────────────

    @GetMapping("/whitelist-requests")
    public ApiResponse<List<StarWhitelistRequestDto>> listWhitelist(Principal principal) {
        return ApiResponse.of(service.listWhitelist(requireUserId(principal)));
    }

    @PostMapping("/whitelist-requests/{id}/advance")
    public ApiResponse<StarWhitelistRequestDto> advanceWhitelist(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.advanceWhitelist(requireUserId(principal), id));
    }

    @PostMapping("/whitelist-requests/{id}/reject")
    public ApiResponse<StarWhitelistRequestDto> rejectWhitelist(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.rejectWhitelist(requireUserId(principal), id));
    }

    // ── 数字人授权 ───────────────────────────────────────────────────────────

    @GetMapping("/digital-human-requests")
    public ApiResponse<List<StarDigitalHumanRequestDto>> listDigitalHuman(Principal principal) {
        return ApiResponse.of(service.listDigitalHuman(requireUserId(principal)));
    }

    @PostMapping("/digital-human-requests/{id}/approve")
    public ApiResponse<StarDigitalHumanRequestDto> approveDigitalHuman(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.decideDigitalHuman(requireUserId(principal), id, true));
    }

    @PostMapping("/digital-human-requests/{id}/reject")
    public ApiResponse<StarDigitalHumanRequestDto> rejectDigitalHuman(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.decideDigitalHuman(requireUserId(principal), id, false));
    }

    // ── AI 形象授权 ──────────────────────────────────────────────────────────

    @GetMapping("/ai-likeness-requests")
    public ApiResponse<List<StarAiLikenessRequestDto>> listAiLikeness(Principal principal) {
        return ApiResponse.of(service.listAiLikeness(requireUserId(principal)));
    }

    @PostMapping("/ai-likeness-requests/{id}/approve")
    public ApiResponse<StarAiLikenessRequestDto> approveAiLikeness(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.decideAiLikeness(requireUserId(principal), id, true));
    }

    @PostMapping("/ai-likeness-requests/{id}/reject")
    public ApiResponse<StarAiLikenessRequestDto> rejectAiLikeness(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.decideAiLikeness(requireUserId(principal), id, false));
    }

    // ── 内容审核 ─────────────────────────────────────────────────────────────

    @GetMapping("/content-reviews")
    public ApiResponse<List<StarContentReviewDto>> listContentReviews(Principal principal) {
        return ApiResponse.of(service.listContentReviews(requireUserId(principal)));
    }

    @PostMapping("/content-reviews/{id}/approve")
    public ApiResponse<StarContentReviewDto> approveContent(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.decideContent(requireUserId(principal), id, StarContentReview.Status.APPROVED, null));
    }

    @PostMapping("/content-reviews/{id}/revision")
    public ApiResponse<StarContentReviewDto> reviseContent(Principal principal, @PathVariable String id,
                                                            @RequestBody(required = false) StarContentRevisionDto req) {
        return ApiResponse.of(service.decideContent(requireUserId(principal), id, StarContentReview.Status.REVISION,
                req != null ? req.note() : null));
    }

    @PostMapping("/content-reviews/{id}/reject")
    public ApiResponse<StarContentReviewDto> rejectContent(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.decideContent(requireUserId(principal), id, StarContentReview.Status.REJECTED, null));
    }

    // ── 商品入库 / 商品库 ────────────────────────────────────────────────────

    @GetMapping("/product-onboards")
    public ApiResponse<List<StarProductOnboardDto>> listProductOnboards(Principal principal) {
        return ApiResponse.of(service.listProductOnboards(requireUserId(principal)));
    }

    @PostMapping("/product-onboards/{id}/approve")
    public ApiResponse<StarProductOnboardDto> approveProductOnboard(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.approveProductOnboard(requireUserId(principal), id));
    }

    @PostMapping("/product-onboards/{id}/reject")
    public ApiResponse<StarProductOnboardDto> rejectProductOnboard(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.rejectProductOnboard(requireUserId(principal), id));
    }

    @PostMapping("/product-onboards/{id}/receive-sample")
    public ApiResponse<StarProductOnboardDto> receiveProductSample(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.receiveProductSample(requireUserId(principal), id));
    }

    @PostMapping("/product-onboards/{id}/confirm-sample")
    public ApiResponse<StarProductOnboardDto> confirmProductSample(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.confirmProductSample(requireUserId(principal), id));
    }

    @GetMapping("/product-library")
    public ApiResponse<List<StarProductLibItemDto>> listProductLibrary(Principal principal) {
        return ApiResponse.of(service.listProductLibrary(requireUserId(principal)));
    }

    // ── 品牌授权 ─────────────────────────────────────────────────────────────

    @GetMapping("/brand-auths")
    public ApiResponse<List<StarBrandAuthRequestDto>> listBrandAuths(Principal principal) {
        return ApiResponse.of(service.listBrandAuths(requireUserId(principal)));
    }

    @PostMapping("/brand-auths/{id}/approve")
    public ApiResponse<StarBrandAuthRequestDto> approveBrandAuth(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.approveBrandAuth(requireUserId(principal), id));
    }

    @PostMapping("/brand-auths/{id}/reject")
    public ApiResponse<StarBrandAuthRequestDto> rejectBrandAuth(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.rejectBrandAuth(requireUserId(principal), id));
    }

    @PostMapping("/brand-auths/{id}/receive-sample")
    public ApiResponse<StarBrandAuthRequestDto> receiveBrandSample(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.receiveBrandSample(requireUserId(principal), id));
    }

    @PostMapping("/brand-auths/{id}/confirm-sample")
    public ApiResponse<StarBrandAuthRequestDto> confirmBrandSample(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.confirmBrandSample(requireUserId(principal), id));
    }

    // ── 收益 / 规则 / 侵权 / 合同 ────────────────────────────────────────────

    @GetMapping("/revenue")
    public ApiResponse<StarRevenueSummaryDto> revenue(Principal principal) {
        return ApiResponse.of(service.getRevenue(requireUserId(principal)));
    }

    @GetMapping("/content-rules")
    public ApiResponse<List<StarContentRuleDto>> listContentRules(Principal principal) {
        return ApiResponse.of(service.listContentRules(requireUserId(principal)));
    }

    @PostMapping("/content-rules/{id}/toggle")
    public ApiResponse<StarContentRuleDto> toggleContentRule(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.toggleContentRule(requireUserId(principal), id));
    }

    @GetMapping("/infringements")
    public ApiResponse<List<StarInfringementCaseDto>> listInfringements(Principal principal) {
        return ApiResponse.of(service.listInfringements(requireUserId(principal)));
    }

    @PostMapping("/infringements/{id}/transition")
    public ApiResponse<StarInfringementCaseDto> transitionInfringement(Principal principal, @PathVariable String id,
                                                                        @RequestBody StarInfringementTransitionDto req) {
        return ApiResponse.of(service.transitionInfringement(requireUserId(principal), id, req));
    }

    @GetMapping("/contracts")
    public ApiResponse<List<StarContractDto>> listContracts(Principal principal) {
        return ApiResponse.of(service.listContracts(requireUserId(principal)));
    }
}
