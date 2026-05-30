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
import com.aistareco.common.BusinessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private final PasswordEncoder passwordEncoder;

    public AccountSelfService(
            AepUserRepository userRepo,
            MembershipRepository membershipRepo,
            TenantRepository tenantRepo,
            WalletRepository walletRepo,
            LedgerEntryRepository ledgerRepo,
            StudioRepository studioRepo,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepo = userRepo;
        this.membershipRepo = membershipRepo;
        this.tenantRepo = tenantRepo;
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
        this.studioRepo = studioRepo;
        this.passwordEncoder = passwordEncoder;
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

    /**
     * 当前登录用户设置 / 修改登录密码。
     * - 首次设置：不要求 currentPassword（用户已通过 JWT 证明刚登录过）。
     * - 已有密码：必须校验 currentPassword，避免被已登录设备无感改密。
     */
    public Map<String, Object> changePassword(String userId, String currentPassword, String newPassword) {
        var user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "当前用户不存在"));

        String next = newPassword == null ? "" : newPassword.trim();
        if (next.isBlank()) {
            throw BusinessException.badRequest("PASSWORD_REQUIRED", "请填写新密码");
        }
        if (next.length() < 6) {
            throw BusinessException.badRequest("PASSWORD_TOO_SHORT", "新密码至少 6 位");
        }

        boolean hasPassword = user.getPasswordHash() != null && !user.getPasswordHash().isBlank();
        if (hasPassword) {
            String current = currentPassword == null ? "" : currentPassword;
            if (current.isBlank()) {
                throw BusinessException.badRequest("CURRENT_PASSWORD_REQUIRED", "请填写当前密码");
            }
            if (!passwordEncoder.matches(current, user.getPasswordHash())) {
                throw new BusinessException(HttpStatus.FORBIDDEN, "CURRENT_PASSWORD_INVALID", "当前密码错误");
            }
            if (passwordEncoder.matches(next, user.getPasswordHash())) {
                throw BusinessException.badRequest("PASSWORD_UNCHANGED", "新密码不能与当前密码相同");
            }
        }

        user.setPasswordHash(passwordEncoder.encode(next));
        user.setUpdatedAt(Instant.now());
        userRepo.save(user);
        return Map.of("changed", true, "hasPassword", true);
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
