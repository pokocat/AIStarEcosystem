package com.aistareco.aep.enterprise.controller;

import com.aistareco.aep.enterprise.dto.EnterpriseRechargeDtos.*;
import com.aistareco.aep.enterprise.service.EnterpriseRechargeService;
import com.aistareco.common.*;
import com.aistareco.aep.dto.PageEnvelope;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequestMapping("/api/v1/ip-studio/enterprises/{id}")
@ConditionalOnProperty(name="aep.enterprise.enabled",havingValue="true")
public class EnterpriseRechargeController {
    private final EnterpriseRechargeService service;
    public EnterpriseRechargeController(EnterpriseRechargeService service){this.service=service;}
    @GetMapping("/wallet") public ApiResponse<WalletSummary> wallet(Principal p,@PathVariable String id){return ApiResponse.of(service.wallet(p.getName(),id));}
    @GetMapping("/my-balance") public ApiResponse<MemberBalance> myBalance(Principal p,@PathVariable String id){return ApiResponse.of(service.myBalance(p.getName(),id));}
    @GetMapping("/member-balances") public PageEnvelope<MemberBalance> memberBalances(Principal p,@PathVariable String id,
            @RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(service.memberBalances(p.getName(),id,page,limit));}
    @GetMapping("/recharges") public PageEnvelope<Order> recharges(Principal p,@PathVariable String id,
            @RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(service.list(p.getName(),id,page,limit));}
    @PostMapping("/recharges") public ApiResponse<Order> request(Principal p,@PathVariable String id,@RequestBody RechargeRequest r){return ApiResponse.of(service.request(p.getName(),id,r));}
}
