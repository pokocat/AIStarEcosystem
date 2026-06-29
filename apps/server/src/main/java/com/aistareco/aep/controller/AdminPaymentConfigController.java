package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdminPaymentChannelUpsertDto;
import com.aistareco.aep.dto.PaymentChannelConfigDto;
import com.aistareco.aep.service.payment.PaymentChannelConfigService;
import com.aistareco.aep.service.payment.PaymentGateway;
import com.aistareco.aep.service.payment.PaymentGatewayRegistry;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Admin 支付配置（v0.94 多渠道直连）。FINANCE_ADMIN / SUPER_ADMIN 专属。
 *
 * <p>渠道启用 + 机密运行时可配（取代 env 固定 driver）：GET 出脱敏配置；PUT 改启用/沙箱/机密；
 * POST /{code}/test 用当前 DB 配置做一次轻量自检（机密是否齐全 + SDK 能否构建）。
 * 机密绝不明文出 wire（{@link PaymentChannelConfigService} 脱敏）。
 */
@RestController
@RequestMapping("/api/admin/payment/channels")
@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")
public class AdminPaymentConfigController {

    private final PaymentChannelConfigService service;
    private final PaymentGatewayRegistry registry;

    public AdminPaymentConfigController(PaymentChannelConfigService service, PaymentGatewayRegistry registry) {
        this.service = service;
        this.registry = registry;
    }

    /** 全部可配渠道（即便未配置也列出空表单），机密脱敏。 */
    @GetMapping
    public ApiResponse<List<PaymentChannelConfigDto>> list() {
        return ApiResponse.of(service.listForAdmin());
    }

    /** 更新某渠道：启用/沙箱/展示名/排序/默认支付方式/机密（空=保留，__CLEAR__=清空）。 */
    @PutMapping("/{code}")
    public ApiResponse<PaymentChannelConfigDto> update(@PathVariable String code,
                                                       @RequestBody AdminPaymentChannelUpsertDto body,
                                                       Principal principal) {
        String by = principal != null ? principal.getName() : "admin";
        return ApiResponse.of(service.upsert(code, body, by));
    }

    /**
     * 轻量自检：机密是否齐全 + 网关是否就绪。不发起真实下单（避免误产生订单），
     * 返回 {@code {configured, ready}} 供 admin 判断该渠道是否可启用。
     */
    @PostMapping("/{code}/test")
    public ApiResponse<Map<String, Object>> test(@PathVariable String code) {
        PaymentGateway gw = registry.get(code);
        if (gw == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PAYMENT_CHANNEL_UNKNOWN", "未知支付渠道：" + code);
        }
        boolean configured = service.isConfigured(code);
        return ApiResponse.of(Map.of(
                "code", code,
                "configured", configured,
                "ready", configured && gw.isConfigured(),
                "message", configured ? "机密齐全，可启用" : "机密未填齐，无法启用"));
    }
}
