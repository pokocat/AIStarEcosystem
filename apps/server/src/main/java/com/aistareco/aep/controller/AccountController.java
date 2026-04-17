package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.dto.DigitalIpDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.service.AccountSelfService;
import com.aistareco.aep.service.DigitalIpService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/me")
public class AccountController {

    private final AccountSelfService accountSelfService;
    private final DigitalIpService digitalIpService;

    public AccountController(AccountSelfService accountSelfService,
                             DigitalIpService digitalIpService) {
        this.accountSelfService = accountSelfService;
        this.digitalIpService = digitalIpService;
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
    public ApiResponse<WalletDto> wallet(Principal principal) {
        return ApiResponse.of(accountSelfService.getWallet(principal.getName()));
    }

    @GetMapping("/ledger")
    public ApiResponse<PageEnvelope<LedgerEntryDto>> ledger(
            Principal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(accountSelfService.listLedger(principal.getName(), pageable)));
    }

    @GetMapping("/digital-ips")
    public ApiResponse<PageEnvelope<DigitalIpDto>> listDigitalIps(
            Principal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(
                digitalIpService.list(principal.getName(), null, null, pageable)));
    }

    @GetMapping("/digital-ips/{id}")
    public ApiResponse<DigitalIpDto> getDigitalIp(Principal principal, @PathVariable String id) {
        return ApiResponse.of(digitalIpService.findOwnedById(id, principal.getName()));
    }

    @PostMapping("/digital-ips")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<DigitalIpDto> createDigitalIp(Principal principal, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(digitalIpService.create(body, principal.getName()));
    }

    @PutMapping("/digital-ips/{id}")
    public ApiResponse<DigitalIpDto> updateDigitalIp(Principal principal,
                                                      @PathVariable String id,
                                                      @RequestBody Map<String, Object> body) {
        return ApiResponse.of(digitalIpService.updateOwned(id, principal.getName(), body));
    }

    @PatchMapping("/digital-ips/{id}")
    public ApiResponse<DigitalIpDto> patchDigitalIp(Principal principal,
                                                     @PathVariable String id,
                                                     @RequestBody Map<String, Object> body) {
        return ApiResponse.of(digitalIpService.updateOwned(id, principal.getName(), body));
    }

    @DeleteMapping("/digital-ips/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDigitalIp(Principal principal, @PathVariable String id) {
        digitalIpService.deleteOwned(id, principal.getName());
    }
}
