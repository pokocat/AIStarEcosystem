package com.aistareco.aep.enterprise.controller;

import com.aistareco.aep.enterprise.dto.EnterpriseRechargeDtos.*;
import com.aistareco.aep.enterprise.service.EnterpriseRechargeService;
import com.aistareco.common.*;
import com.aistareco.aep.dto.PageEnvelope;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequestMapping("/api/admin/finance/enterprise-recharges")
@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")
public class AdminEnterpriseRechargeController {
    private final EnterpriseRechargeService service;
    public AdminEnterpriseRechargeController(EnterpriseRechargeService service){this.service=service;}
    @GetMapping public PageEnvelope<Order> list(@RequestParam(required=false)String enterpriseId,@RequestParam(required=false)String status,
            @RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(service.adminList(enterpriseId,status,page,limit));}
    @PostMapping("/{orderId}/confirm") public ApiResponse<Order> confirm(Principal p,@PathVariable String orderId,@RequestBody ConfirmRequest r){return ApiResponse.of(service.confirm(p.getName(),orderId,r));}
    @PostMapping("/{orderId}/reject") public ApiResponse<Order> reject(Principal p,@PathVariable String orderId,@RequestBody RejectRequest r){return ApiResponse.of(service.reject(p.getName(),orderId,r.reason()));}
    @GetMapping("/{orderId}/refund-preview") public ApiResponse<RefundPreview> preview(@PathVariable String orderId){return ApiResponse.of(service.refundPreview(orderId));}
    @PostMapping("/{orderId}/refund") public ApiResponse<Order> refund(Principal p,@PathVariable String orderId,@RequestBody RefundRequest r){return ApiResponse.of(service.refund(p.getName(),orderId,r));}
}
