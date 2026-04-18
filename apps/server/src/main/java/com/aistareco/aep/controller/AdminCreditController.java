package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminCreditController {

    private final CreditService creditService;

    public AdminCreditController(CreditService creditService) {
        this.creditService = creditService;
    }

    @GetMapping("/wallets")
    public PageEnvelope<WalletDto> listWallets(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return PageEnvelope.from(creditService.listWallets(pageable));
    }

    @GetMapping("/wallets/{userId}")
    public ApiResponse<WalletDto> getWalletByUser(@PathVariable String userId) {
        return ApiResponse.of(creditService.findWalletByUserId(userId));
    }

    /**
     * Query ledger entries. Supports filtering by walletId or userId.
     */
    @GetMapping("/ledger-entries")
    public PageEnvelope<LedgerEntryDto> listLedgerEntries(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String walletId,
            @RequestParam(required = false) String userId) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return PageEnvelope.from(creditService.listLedgerEntries(walletId, userId, pageable));
    }
}
