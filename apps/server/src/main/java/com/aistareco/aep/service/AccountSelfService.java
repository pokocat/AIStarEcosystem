package com.aistareco.aep.service;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.dto.EntitlementDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.model.Membership;
import com.aistareco.aep.model.Tenant;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.EntitlementRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.MembershipRepository;
import com.aistareco.aep.repository.TenantRepository;
import com.aistareco.aep.repository.WalletRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Stream;

@Service
public class AccountSelfService {

    private final AepUserRepository userRepo;
    private final MembershipRepository membershipRepo;
    private final TenantRepository tenantRepo;
    private final WalletRepository walletRepo;
    private final EntitlementRepository entitlementRepo;
    private final LedgerEntryRepository ledgerRepo;

    public AccountSelfService(
            AepUserRepository userRepo,
            MembershipRepository membershipRepo,
            TenantRepository tenantRepo,
            WalletRepository walletRepo,
            EntitlementRepository entitlementRepo,
            LedgerEntryRepository ledgerRepo
    ) {
        this.userRepo = userRepo;
        this.membershipRepo = membershipRepo;
        this.tenantRepo = tenantRepo;
        this.walletRepo = walletRepo;
        this.entitlementRepo = entitlementRepo;
        this.ledgerRepo = ledgerRepo;
    }

    public AepUserDto getCurrentUser(String userId) {
        return userRepo.findById(userId)
                .map(AepUserDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "当前用户不存在"));
    }

    public List<TenantDto> listCurrentTenants(String userId) {
        List<String> tenantIds = loadAccessibleTenantIds(userId);

        if (tenantIds.isEmpty()) {
            return List.of();
        }

        return tenantRepo.findAllById(tenantIds).stream()
                .sorted((left, right) -> right.getCreatedAt().compareTo(left.getCreatedAt()))
                .map(TenantDto::from)
                .toList();
    }

    public WalletDto getWallet(String userId, String tenantId) {
        String resolvedTenantId = resolveAccessibleTenantId(userId, tenantId);
        return walletRepo.findByTenantId(resolvedTenantId)
                .map(WalletDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "当前租户尚未开通钱包"));
    }

    public List<EntitlementDto> listEntitlements(String userId, String tenantId) {
        String resolvedTenantId = resolveAccessibleTenantId(userId, tenantId);
        return entitlementRepo.findByTenantIdOrderByCreatedAtDesc(resolvedTenantId).stream()
                .map(EntitlementDto::from)
                .toList();
    }

    public Page<LedgerEntryDto> listLedger(String userId, String tenantId, Pageable pageable) {
        String resolvedTenantId = resolveAccessibleTenantId(userId, tenantId);
        return ledgerRepo.findByTenantId(resolvedTenantId, pageable).map(LedgerEntryDto::from);
    }

    private String resolveAccessibleTenantId(String userId, String tenantId) {
        List<String> tenantIds = loadAccessibleTenantIds(userId);
        if (tenantIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "当前账号尚未加入任何租户");
        }

        String resolvedTenantId = tenantId;
        if (resolvedTenantId == null || resolvedTenantId.isBlank()) {
            resolvedTenantId = tenantIds.get(0);
        }

        if (!tenantIds.contains(resolvedTenantId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问目标租户的数据");
        }

        Tenant tenant = tenantRepo.findById(resolvedTenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "目标租户不存在"));
        return tenant.getId();
    }

    private List<String> loadAccessibleTenantIds(String userId) {
        return Stream.concat(
                        membershipRepo.findByUserId(userId).stream().map(Membership::getTenantId),
                        tenantRepo.findByOwnerUserIdOrderByCreatedAtDesc(userId).stream().map(Tenant::getId)
                )
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
    }
}
