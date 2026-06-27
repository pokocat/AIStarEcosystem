package com.aistareco.aep.controller;

import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.service.RechargeService;
import com.aistareco.aep.service.payment.PaymentReconcileService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 运营后台 · 充值订单核销（v0.56 新增）。
 *
 * 用户在前端下单生成 PENDING 账单后，运营在此「线下收款 → 核准入账（approve）」或「驳回（reject）」。
 * 受 {@code /api/admin/**} 通用门禁保护（SUPER_ADMIN / OPERATOR）。
 */
@RestController
@RequestMapping("/api/admin/finance/recharge-orders")
public class AdminRechargeOrderController {

    private final RechargeService rechargeService;
    private final PaymentReconcileService reconcileService;

    public AdminRechargeOrderController(RechargeService rechargeService,
                                        PaymentReconcileService reconcileService) {
        this.rechargeService = rechargeService;
        this.reconcileService = reconcileService;
    }

    /** 列出充值订单。可选 {@code ?status=pending|paid|rejected|cancelled|all}（默认全部，最新在前）。 */
    @GetMapping
    public ApiResponse<List<RechargeOrderDto>> list(@RequestParam(required = false) String status) {
        return ApiResponse.of(rechargeService.listForAdmin(status));
    }

    /** 核准入账：确认线下已收款 → 经不可变账本入账，订单转 PAID。 */
    @PostMapping("/{orderId}/approve")
    public ApiResponse<RechargeOrderDto> approve(Principal principal,
                                                 @PathVariable String orderId,
                                                 @RequestBody(required = false) ReviewRequest body) {
        String reviewer = principal != null ? principal.getName() : "admin";
        String note = body == null ? null : body.note();
        return ApiResponse.of(rechargeService.approveOrder(orderId, reviewer, note));
    }

    /** 驳回：收款不符 / 无效订单。reason 必填。 */
    @PostMapping("/{orderId}/reject")
    public ApiResponse<RechargeOrderDto> reject(Principal principal,
                                                @PathVariable String orderId,
                                                @RequestBody(required = false) ReviewRequest body) {
        String reason = body == null ? null : body.reason();
        if (reason == null || reason.isBlank()) {
            throw BusinessException.badRequest("REJECT_REASON_REQUIRED", "请填写驳回原因");
        }
        String reviewer = principal != null ? principal.getName() : "admin";
        return ApiResponse.of(rechargeService.rejectOrder(orderId, reviewer, reason));
    }

    /**
     * 现金退款 + 未消费积分回收（v2 §15.5 / D17）。资金面动作 → 限 FINANCE_ADMIN / SUPER_ADMIN；
     * OPERATOR 不可退款。reason 必填。仅 PAID 订单可退；clamp 到未消费充值额，已消费完毕 → 409。
     */
    @PostMapping("/{orderId}/refund")
    @PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")
    public ApiResponse<RechargeOrderDto> refund(Principal principal,
                                                @PathVariable String orderId,
                                                @RequestBody(required = false) ReviewRequest body) {
        String reason = body == null ? null : body.reason();
        if (reason == null || reason.isBlank()) {
            throw BusinessException.badRequest("REFUND_REASON_REQUIRED", "请填写退款原因");
        }
        String operator = principal != null ? principal.getName() : "admin";
        return ApiResponse.of(rechargeService.refundOrder(orderId, operator, reason));
    }

    /**
     * 手动触发查单兜底（v2 §6.4，直连方案）：对 PENDING 在线订单逐单查网关,已支付则结算（幂等）。
     * 用于回调丢失 / 本地无公网时的补单,也让沙箱 E2E 可确定性推进（不必等定时器）。限 FINANCE_ADMIN / SUPER_ADMIN。
     */
    @PostMapping("/reconcile")
    @PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")
    public ApiResponse<Map<String, Object>> reconcile() {
        int settled = reconcileService.reconcilePending();
        return ApiResponse.of(Map.of("settled", settled));
    }

    public record ReviewRequest(String note, String reason) {}
}
