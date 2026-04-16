package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.dto.EntitlementDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.MembershipRepository;
import com.aistareco.aep.service.AepUserService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.EntitlementService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AepUserService userService;
    private final CreditService creditService;
    private final EntitlementService entitlementService;
    private final MembershipRepository membershipRepo;

    public AdminUserController(AepUserService userService,
                                CreditService creditService,
                                EntitlementService entitlementService,
                                MembershipRepository membershipRepo) {
        this.userService = userService;
        this.creditService = creditService;
        this.entitlementService = entitlementService;
        this.membershipRepo = membershipRepo;
    }

    @GetMapping
    public ApiResponse<PageEnvelope<AepUserDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String role) {

        AepUser.UserStatus statusEnum = parseEnum(status, AepUser.UserStatus.class, "不支持的用户状态筛选值");
        AepUser.UserRole roleEnum = parseEnum(role, AepUser.UserRole.class, "不支持的用户角色筛选值");
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(userService.list(statusEnum, roleEnum, pageable)));
    }

    @GetMapping("/{id}")
    public ApiResponse<AepUserDto> getById(@PathVariable String id) {
        return ApiResponse.of(userService.findById(id));
    }

    @GetMapping("/{id}/tenants")
    public ApiResponse<List<TenantDto>> listOwnedTenants(@PathVariable String id) {
        return ApiResponse.of(userService.listOwnedTenants(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AepUserDto> create(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(userService.create(body));
    }

    @PutMapping("/{id}")
    public ApiResponse<AepUserDto> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(userService.update(id, body));
    }

    @PatchMapping("/{id}")
    public ApiResponse<AepUserDto> patch(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(userService.update(id, body));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        userService.delete(id);
    }

    /**
     * Grant an entitlement directly to a platform user.
     * The entitlement is attached to the user's primary tenant.
     * Body: same fields as POST /api/admin/entitlements, tenantId is auto-resolved from userId.
     */
    @PostMapping("/{id}/entitlements")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<EntitlementDto> grantEntitlement(@PathVariable String id,
                                                         @RequestBody Map<String, Object> body) {
        // Resolve user's primary tenant
        String tenantId = membershipRepo.findByUserId(id).stream()
                .sorted((a, b) -> {
                    if ("OWNER".equals(a.getTenantRole())) return -1;
                    if ("OWNER".equals(b.getTenantRole())) return 1;
                    return 0;
                })
                .map(m -> m.getTenantId())
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "该用户没有关联的租户，无法开通权益"));

        // Inject the resolved tenantId
        Map<String, Object> entitlementBody = new java.util.HashMap<>(body);
        entitlementBody.put("tenantId", tenantId);

        return ApiResponse.of(entitlementService.create(entitlementBody));
    }

    /**
     * Manually adjust credit balance for a platform user (运营调差).
     * Body: { "amount": 100, "description": "补偿调整" }
     * Positive amount = credit; negative = debit.
     */
    @PostMapping("/{id}/credits/adjust")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<LedgerEntryDto> adjustCredits(@PathVariable String id,
                                                      @RequestBody Map<String, Object> body) {
        return ApiResponse.of(creditService.adjustUserCredits(id, body));
    }

    private <E extends Enum<E>> E parseEnum(String raw, Class<E> type, String errorMessage) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, errorMessage);
        }
    }
}
