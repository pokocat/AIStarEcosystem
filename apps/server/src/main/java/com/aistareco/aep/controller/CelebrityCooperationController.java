package com.aistareco.aep.controller;

import com.aistareco.aep.dto.CelebrityAuthApplyDto;
import com.aistareco.aep.dto.StarProductFilingDto;
import com.aistareco.aep.dto.StarProductFilingRequestDto;
import com.aistareco.aep.model.CelebrityStarAuthorization;
import com.aistareco.aep.service.StarWorkbenchService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * web-celebrity → web-star 打通端点（v0.60，挂在 /api/me/** 强制登录）。
 *
 * <ul>
 *   <li>授权申请：创作者对明星发起带货授权（→ 明星端「带货授权」审批队列）。</li>
 *   <li>商品报备：把公共商品池商品报备给明星（→ 明星端「商品入库」6 步流程），
 *       并可回查自己全部报备单的流转状态。</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/me/celebrity")
public class CelebrityCooperationController {

    private final StarWorkbenchService service;

    public CelebrityCooperationController(StarWorkbenchService service) {
        this.service = service;
    }

    private static String requireUserId(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        }
        return principal.getName();
    }

    /** 申请明星带货授权：upsert 至 pending，等待明星端审批。 */
    @PostMapping("/stars/{starId}/authorization/apply")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> applyAuthorization(Principal principal,
                                                                @PathVariable String starId,
                                                                @RequestBody(required = false) CelebrityAuthApplyDto req) {
        CelebrityStarAuthorization auth = service.applyAuthorization(requireUserId(principal), starId, req);
        return ApiResponse.of(Map.of(
                "id", auth.getId(),
                "starId", auth.getStarId(),
                "status", auth.getStatus().wire(),
                "pendingNote", auth.getPendingNote() != null ? auth.getPendingNote() : ""
        ), "申请已提交，等待明星经纪团队复核");
    }

    /** 把公共商品池商品报备给明星（→ 明星端商品入库 step=2 明星审核）。 */
    @PostMapping("/products/{productId}/star-filings")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<StarProductFilingDto> fileProductToStar(Principal principal,
                                                                @PathVariable String productId,
                                                                @RequestBody StarProductFilingRequestDto req) {
        if (req == null || req.starId() == null || req.starId().isBlank()) {
            throw BusinessException.badRequest("STAR_ID_REQUIRED", "请选择要报备的明星");
        }
        return ApiResponse.of(service.fileProductToStar(requireUserId(principal), productId, req.starId()));
    }

    /** 我的报备单（可按 productId / starId 过滤），celebrity 端商品库展示报备状态。 */
    @GetMapping("/star-filings")
    public ApiResponse<List<StarProductFilingDto>> listFilings(Principal principal,
                                                                @RequestParam(required = false) String productId,
                                                                @RequestParam(required = false) String starId) {
        return ApiResponse.of(service.listFilings(requireUserId(principal), productId, starId));
    }
}
