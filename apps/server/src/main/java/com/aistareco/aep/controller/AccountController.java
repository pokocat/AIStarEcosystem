package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.dto.EntitlementDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.service.AccountSelfService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/me")
public class AccountController {

    private final AccountSelfService accountSelfService;

    public AccountController(AccountSelfService accountSelfService) {
        this.accountSelfService = accountSelfService;
    }

    @GetMapping
    public ApiResponse<AepUserDto> me(Principal principal) {
        return ApiResponse.of(accountSelfService.getCurrentUser(principal.getName()));
    }

    @GetMapping("/tenants")
    public ApiResponse<List<TenantDto>> tenants(Principal principal) {
        return ApiResponse.of(accountSelfService.listCurrentTenants(principal.getName()));
    }

    @GetMapping("/wallet")
    public ApiResponse<WalletDto> wallet(
            Principal principal,
            @RequestParam(required = false) String tenantId
    ) {
        return ApiResponse.of(accountSelfService.getWallet(principal.getName(), tenantId));
    }

    @GetMapping("/entitlements")
    public ApiResponse<List<EntitlementDto>> entitlements(
            Principal principal,
            @RequestParam(required = false) String tenantId
    ) {
        return ApiResponse.of(accountSelfService.listEntitlements(principal.getName(), tenantId));
    }

    @GetMapping("/ledger")
    public ApiResponse<PageEnvelope<LedgerEntryDto>> ledger(
            Principal principal,
            @RequestParam(required = false) String tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(accountSelfService.listLedger(principal.getName(), tenantId, pageable)));
    }
}
