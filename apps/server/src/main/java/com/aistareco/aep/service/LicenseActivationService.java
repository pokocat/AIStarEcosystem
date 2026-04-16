package com.aistareco.aep.service;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Handles account registration via license key activation.
 * Flow: raw code -> SHA-256 hash -> find key -> validate -> create user+tenant -> activate key -> issue token.
 *
 * License keys are imported by admin backend or synced from external CRM systems (future integration point).
 */
@Service
public class LicenseActivationService {

    private static final Set<LicenseKey.LicenseKeyStatus> ACTIVATABLE_STATUSES = Set.of(
            LicenseKey.LicenseKeyStatus.CREATED,
            LicenseKey.LicenseKeyStatus.ALLOCATED,
            LicenseKey.LicenseKeyStatus.SOLD
    );

    private final LicenseKeyRepository keyRepo;
    private final LicenseBatchRepository batchRepo;
    private final AepUserRepository userRepo;
    private final TenantRepository tenantRepo;
    private final MembershipRepository membershipRepo;
    private final WalletRepository walletRepo;
    private final EntitlementRepository entitlementRepo;
    private final LedgerEntryRepository ledgerRepo;
    private final PlanRepository planRepo;
    private final JwtUtil jwtUtil;

    public LicenseActivationService(LicenseKeyRepository keyRepo,
                                     LicenseBatchRepository batchRepo,
                                     AepUserRepository userRepo,
                                     TenantRepository tenantRepo,
                                     MembershipRepository membershipRepo,
                                     WalletRepository walletRepo,
                                     EntitlementRepository entitlementRepo,
                                     LedgerEntryRepository ledgerRepo,
                                     PlanRepository planRepo,
                                     JwtUtil jwtUtil) {
        this.keyRepo = keyRepo;
        this.batchRepo = batchRepo;
        this.userRepo = userRepo;
        this.tenantRepo = tenantRepo;
        this.membershipRepo = membershipRepo;
        this.walletRepo = walletRepo;
        this.entitlementRepo = entitlementRepo;
        this.ledgerRepo = ledgerRepo;
        this.planRepo = planRepo;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public Map<String, Object> activate(Map<String, String> body) {
        String rawCode = body.get("code");
        if (rawCode == null || rawCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "激活码不能为空");
        }

        // Find the license key by code hash
        String codeHash = sha256(rawCode.trim().toUpperCase());
        LicenseKey key = keyRepo.findByCodeHash(codeHash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "无效的激活码"));

        // Validate key is activatable
        if (!ACTIVATABLE_STATUSES.contains(key.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "该激活码已被使用或已失效（当前状态: " + key.getStatus() + "）");
        }

        // Get the batch for plan info
        LicenseBatch batch = batchRepo.findById(key.getBatchId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "批次数据异常"));

        // Check batch validity
        Instant now = Instant.now();
        if (batch.getValidTo() != null && batch.getValidTo().isBefore(now)) {
            throw new ResponseStatusException(HttpStatus.GONE, "该激活码所属批次已过期");
        }
        if (key.getExpiresAt() != null && key.getExpiresAt().isBefore(now)) {
            throw new ResponseStatusException(HttpStatus.GONE, "该激活码已过期");
        }

        // Create the user
        String username = body.getOrDefault("username", "user_" + System.currentTimeMillis());
        String email = body.get("email");
        String phone = body.get("phone");
        validateUserIdentity(username, email, phone);
        AepUser.UserPlan resolvedPlan = resolvePlan(batch.getPlanId());

        AepUser user = AepUser.builder()
                .id(UUID.randomUUID().toString())
                .username(username)
                .email(email)
                .phone(phone)
                .displayName(body.get("displayName"))
                .role(AepUser.UserRole.FAN)
                .plan(resolvedPlan)
                .credits(batch.getCreditDelta())
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(false)
                .phoneVerified(false)
                .createdAt(now)
                .updatedAt(now)
                .build();
        userRepo.save(user);

        // Create personal tenant
        Tenant tenant = Tenant.builder()
                .id(UUID.randomUUID().toString())
                .name(username + " 的个人空间")
                .type(Tenant.TenantType.PERSONAL)
                .status(Tenant.TenantStatus.ACTIVE)
                .ownerUserId(user.getId())
                .createdAt(now)
                .updatedAt(now)
                .build();
        tenantRepo.save(tenant);

        // Create membership
        Membership membership = Membership.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenant.getId())
                .userId(user.getId())
                .tenantRole("OWNER")
                .joinedAt(now)
                .build();
        membershipRepo.save(membership);

        // Create wallet for the tenant
        Wallet wallet = Wallet.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenant.getId())
                .totalBalance(batch.getCreditDelta())
                .giftBalance(batch.getCreditDelta())
                .rechargeBalance(0)
                .planBalance(0)
                .createdAt(now)
                .updatedAt(now)
                .build();
        walletRepo.save(wallet);

        if (batch.getCreditDelta() > 0) {
            LedgerEntry ledgerEntry = LedgerEntry.builder()
                    .id(UUID.randomUUID().toString())
                    .walletId(wallet.getId())
                    .tenantId(tenant.getId())
                    .entryType(LedgerEntry.LedgerEntryType.CREDIT)
                    .amount(batch.getCreditDelta())
                    .balanceAfter(wallet.getTotalBalance())
                    .description("激活码发放初始积分")
                    .referenceId(key.getId())
                    .referenceType("license_activation")
                    .createdAt(now)
                    .build();
            ledgerRepo.save(ledgerEntry);
        }

        // Create entitlement based on batch type
        if (batch.getLicenseType() == LicenseBatch.LicenseType.PLAN_ACTIVATION) {
            Instant validTo = batch.getDurationDays() != null
                    ? now.plusSeconds(batch.getDurationDays() * 86400L)
                    : null;
            Entitlement entitlement = Entitlement.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenant.getId())
                    .productId(batch.getProductId())
                    .planId(batch.getPlanId())
                    .entitlementType(Entitlement.EntitlementType.FEATURE_ACCESS)
                    .featureCode("plan.activated")
                    .value("true")
                    .validFrom(now)
                    .validTo(validTo)
                    .status(Entitlement.EntitlementStatus.ACTIVE)
                    .createdAt(now)
                    .build();
            entitlementRepo.save(entitlement);
        }

        // Activate the key
        key.setStatus(LicenseKey.LicenseKeyStatus.ACTIVATED);
        key.setActivatedByUserId(user.getId());
        key.setActivatedTenantId(tenant.getId());
        key.setActivatedAt(now);
        if (batch.getDurationDays() != null) {
            key.setExpiresAt(now.plusSeconds(batch.getDurationDays() * 86400L));
        }
        keyRepo.save(key);

        // Increment batch activated count
        batch.setActivatedCount(batch.getActivatedCount() + 1);
        batchRepo.save(batch);

        // Generate JWT token for the newly registered user
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole().name());

        return Map.of(
                "token", token,
                "user", AepUserDto.from(user),
                "tenantId", tenant.getId(),
                "wallet", Map.of(
                        "tenantId", tenant.getId(),
                        "totalBalance", wallet.getTotalBalance(),
                        "giftBalance", wallet.getGiftBalance()
                )
        );
    }

    private void validateUserIdentity(String username, String email, String phone) {
        if (userRepo.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名已存在，请更换后重试");
        }
        if (email != null && !email.isBlank() && userRepo.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邮箱已绑定其他账号");
        }
        if (phone != null && !phone.isBlank() && userRepo.existsByPhone(phone)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该手机号已绑定其他账号");
        }
    }

    private AepUser.UserPlan resolvePlan(String planId) {
        if (planId == null || planId.isBlank()) {
            return AepUser.UserPlan.FREE;
        }

        return planRepo.findById(planId)
                .map(plan -> {
                    String code = plan.getCode() == null ? "" : plan.getCode().trim().toLowerCase();
                    return switch (code) {
                        case "enterprise" -> AepUser.UserPlan.ENTERPRISE;
                        case "pro" -> AepUser.UserPlan.PRO;
                        default -> AepUser.UserPlan.FREE;
                    };
                })
                .orElse(AepUser.UserPlan.FREE);
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
