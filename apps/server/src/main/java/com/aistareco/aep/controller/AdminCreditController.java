package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminCreditController {

    private final CreditService creditService;

    public AdminCreditController(CreditService creditService) {
        this.creditService = creditService;
    }

    @GetMapping("/wallets")
    public ApiResponse<PageEnvelope<WalletDto>> listWallets(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(creditService.listWallets(pageable)));
    }

    @GetMapping("/wallets/{tenantId}")
    public ApiResponse<WalletDto> getWalletByTenant(@PathVariable String tenantId) {
        return ApiResponse.of(creditService.findWalletByTenantId(tenantId));
    }

    @PostMapping("/wallets/{tenantId}/credit")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<LedgerEntryDto> creditWallet(@PathVariable String tenantId,
                                                     @RequestBody Map<String, Object> body) {
        return ApiResponse.of(creditService.creditWallet(tenantId, body));
    }

    /**
     * Query ledger entries.
     * Supports filtering by tenantId (租户视角), userId (用户视角), or walletId.
     */
    @GetMapping("/ledger-entries")
    public ApiResponse<PageEnvelope<LedgerEntryDto>> listLedgerEntries(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String walletId,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String userId) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(creditService.listLedgerEntries(walletId, tenantId, userId, pageable)));
    }
}
