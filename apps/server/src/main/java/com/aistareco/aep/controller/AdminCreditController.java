package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.security.AdminPrincipal;
import com.aistareco.aep.service.AdminAuditRecorder;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminCreditController {

    private final CreditService creditService;
    private final AdminAuditRecorder auditRecorder;

    public AdminCreditController(CreditService creditService, AdminAuditRecorder auditRecorder) {
        this.creditService = creditService;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping("/wallets")
    public ApiResponse<Page<WalletDto>> listWallets(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(creditService.listWallets(pageable));
    }

    @GetMapping("/wallets/{tenantId}")
    public ApiResponse<WalletDto> getWalletByTenant(@PathVariable String tenantId) {
        return ApiResponse.of(creditService.findWalletByTenantId(tenantId));
    }

    @PostMapping("/wallets/{tenantId}/credit")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<LedgerEntryDto> creditWallet(
            @PathVariable String tenantId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        LedgerEntryDto entry = creditService.creditWallet(tenantId, body);
        auditRecorder.success(principal, request, "credit.grant", "wallet", tenantId, "手动补点");
        return ApiResponse.of(entry);
    }

    @GetMapping("/ledger-entries")
    public ApiResponse<Page<LedgerEntryDto>> listLedgerEntries(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String walletId,
            @RequestParam(required = false) String tenantId) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(creditService.listLedgerEntries(walletId, tenantId, pageable));
    }
}
