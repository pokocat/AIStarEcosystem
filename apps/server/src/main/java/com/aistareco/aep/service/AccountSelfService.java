package com.aistareco.aep.service;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.MeDto;
import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.model.Membership;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.MembershipRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.aep.repository.TenantRepository;
import com.aistareco.aep.repository.WalletRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class AccountSelfService {

    private final AepUserRepository userRepo;
    private final MembershipRepository membershipRepo;
    private final TenantRepository tenantRepo;
    private final WalletRepository walletRepo;
    private final LedgerEntryRepository ledgerRepo;
    private final StudioRepository studioRepo;

    public AccountSelfService(
            AepUserRepository userRepo,
            MembershipRepository membershipRepo,
            TenantRepository tenantRepo,
            WalletRepository walletRepo,
            LedgerEntryRepository ledgerRepo,
            StudioRepository studioRepo
    ) {
        this.userRepo = userRepo;
        this.membershipRepo = membershipRepo;
        this.tenantRepo = tenantRepo;
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
        this.studioRepo = studioRepo;
    }

    public AepUserDto getCurrentUser(String userId) {
        return userRepo.findById(userId)
                .map(AepUserDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "当前用户不存在"));
    }

    /**
     * GET /api/me — user + owning Studio (if any). Web frontend treats the studio as
     * "the agency entity the logged-in user operates as".
     */
    public MeDto getCurrentMe(String userId) {
        var user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "当前用户不存在"));
        var studio = studioRepo.findByOwnerUserId(userId).orElse(null);
        return MeDto.from(user, studio);
    }

    /**
     * 用户修改自己的可编辑字段：displayName / avatarUrl / phone / langPreference / bio。
     * 返回的 MeDto 会嵌入当前用户所属的 Studio（便于前端设置页一次性刷新）。
     */
    public MeDto updateCurrentUser(String userId, Map<String, Object> body) {
        var user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "当前用户不存在"));

        if (body.containsKey("displayName")) user.setDisplayName(asString(body.get("displayName")));
        if (body.containsKey("avatarUrl"))   user.setAvatarUrl(asString(body.get("avatarUrl")));
        if (body.containsKey("phone"))       user.setPhone(asString(body.get("phone")));
        if (body.containsKey("email"))       user.setEmail(asString(body.get("email")));
        if (body.containsKey("bio"))         user.setBio(asString(body.get("bio")));
        if (body.containsKey("langPreference")) user.setLangPreference(asString(body.get("langPreference")));

        user.setUpdatedAt(Instant.now());
        var saved = userRepo.save(user);
        var studio = studioRepo.findByOwnerUserId(userId).orElse(null);
        return MeDto.from(saved, studio);
    }

    private static String asString(Object v) {
        return v == null ? null : v.toString();
    }

    /**
     * Tenants the current user belongs to (via license-activation memberships).
     * Tenants are pure attribution containers — wallet lives on the user, not the tenant.
     */
    public List<TenantDto> listCurrentTenants(String userId) {
        List<String> tenantIds = membershipRepo.findByUserId(userId).stream()
                .map(Membership::getTenantId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        if (tenantIds.isEmpty()) {
            return List.of();
        }

        return tenantRepo.findAllById(tenantIds).stream()
                .sorted((left, right) -> right.getCreatedAt().compareTo(left.getCreatedAt()))
                .map(TenantDto::from)
                .toList();
    }

    public WalletDto getWallet(String userId) {
        return walletRepo.findByUserId(userId)
                .map(WalletDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "当前账号尚未开通钱包"));
    }

    public Page<LedgerEntryDto> listLedger(String userId, Pageable pageable) {
        return ledgerRepo.findByUserId(userId, pageable).map(LedgerEntryDto::from);
    }
}
