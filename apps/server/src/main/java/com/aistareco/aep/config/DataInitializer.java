package com.aistareco.aep.config;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Seeds an empty database with demo accounts, tenants, license batches and wallets
 * that mirror the model defined in /product_spec.md.
 *
 * Idempotent: skips when admin staff already exist.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private final AdminUserRepository adminUserRepo;
    private final AepUserRepository userRepo;
    private final TenantRepository tenantRepo;
    private final MembershipRepository membershipRepo;
    private final WalletRepository walletRepo;
    private final LedgerEntryRepository ledgerRepo;
    private final StudioRepository studioRepo;
    private final LicenseBatchRepository licenseBatchRepo;
    private final LicenseKeyRepository licenseKeyRepo;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(AdminUserRepository adminUserRepo,
                            AepUserRepository userRepo,
                            TenantRepository tenantRepo,
                            MembershipRepository membershipRepo,
                            WalletRepository walletRepo,
                            LedgerEntryRepository ledgerRepo,
                            StudioRepository studioRepo,
                            LicenseBatchRepository licenseBatchRepo,
                            LicenseKeyRepository licenseKeyRepo,
                            PasswordEncoder passwordEncoder) {
        this.adminUserRepo = adminUserRepo;
        this.userRepo = userRepo;
        this.tenantRepo = tenantRepo;
        this.membershipRepo = membershipRepo;
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
        this.studioRepo = studioRepo;
        this.licenseBatchRepo = licenseBatchRepo;
        this.licenseKeyRepo = licenseKeyRepo;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (adminUserRepo.count() > 0) {
            return;
        }

        Instant now = Instant.now();

        // ─── Admin staff ────────────────────────────────────────────────────────
        adminUserRepo.save(AdminUser.builder()
                .id(UUID.randomUUID().toString())
                .username("admin")
                .passwordHash(passwordEncoder.encode("admin123"))
                .email("admin@aistareco.com")
                .displayName("超级管理员")
                .role(AdminUser.AdminRole.SUPER_ADMIN)
                .status(AdminUser.AdminStatus.ACTIVE)
                .createdAt(now)
                .updatedAt(now)
                .build());

        adminUserRepo.save(AdminUser.builder()
                .id(UUID.randomUUID().toString())
                .username("operator")
                .passwordHash(passwordEncoder.encode("operator123"))
                .email("operator@aistareco.com")
                .displayName("平台运营")
                .role(AdminUser.AdminRole.OPERATOR)
                .status(AdminUser.AdminStatus.ACTIVE)
                .createdAt(now)
                .updatedAt(now)
                .build());

        // ─── Issuer tenants (license-distribution attribution) ──────────────────
        String platformTenantId = UUID.randomUUID().toString();
        tenantRepo.save(Tenant.builder()
                .id(platformTenantId)
                .name("AI Star Eco 平台")
                .kind(Tenant.TenantKind.PLATFORM)
                .status(Tenant.TenantStatus.ACTIVE)
                .createdAt(now)
                .updatedAt(now)
                .build());

        String agencyTenantId = UUID.randomUUID().toString();
        tenantRepo.save(Tenant.builder()
                .id(agencyTenantId)
                .name("星梦娱乐经纪公司")
                .kind(Tenant.TenantKind.ORGANIZATION)
                .status(Tenant.TenantStatus.ACTIVE)
                .createdAt(now)
                .updatedAt(now)
                .build());

        // ─── Demo platform users + wallets ──────────────────────────────────────
        // User 1 — personal fan
        AepUser fanUser = AepUser.builder()
                .id(UUID.randomUUID().toString())
                .username("fan_luna")
                .email("luna@example.com")
                .displayName("Luna 粉丝")
                .kind(AepUser.AccountKind.PERSONAL)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(false)
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .updatedAt(now)
                .build();
        userRepo.save(fanUser);

        seedMembershipAndWallet(fanUser.getId(), platformTenantId, 500L, now.minus(7, ChronoUnit.DAYS));

        // User 2 — studio operator (经纪/工作室)
        AepUser studioUser = AepUser.builder()
                .id(UUID.randomUUID().toString())
                .username("studio_starlight")
                .email("starlight@example.com")
                .displayName("星光经纪")
                .kind(AepUser.AccountKind.STUDIO)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(true)
                .phone("13900139000")
                .createdAt(now.minus(30, ChronoUnit.DAYS))
                .updatedAt(now)
                .build();
        userRepo.save(studioUser);

        seedMembershipAndWallet(studioUser.getId(), agencyTenantId, 3000L, now.minus(30, ChronoUnit.DAYS));

        studioRepo.save(Studio.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(studioUser.getId())
                .name("星光工作室")
                .kind(Studio.StudioKind.AGENCY)
                .bio("专注于 AI 虚拟艺人孵化的精品工作室。")
                .contactEmail("contact@starlight.example.com")
                .createdAt(now.minus(30, ChronoUnit.DAYS))
                .updatedAt(now)
                .build());

        // ─── License batches ────────────────────────────────────────────────────
        LicenseBatch agencyBatch = LicenseBatch.builder()
                .id(UUID.randomUUID().toString())
                .batchNo("BATCH-XINGMENG-001")
                .name("星梦娱乐 · 种子艺人激活包")
                .issuerTenantId(agencyTenantId)
                .initialCreditGrant(500L)
                .totalCount(50)
                .activatedCount(0)
                .validFrom(now.minus(30, ChronoUnit.DAYS))
                .validTo(now.plus(335, ChronoUnit.DAYS))
                .status(LicenseBatch.LicenseBatchStatus.ACTIVE)
                .createdAt(now.minus(30, ChronoUnit.DAYS))
                .build();
        licenseBatchRepo.save(agencyBatch);
        seedSampleKeys(agencyBatch.getId(), 5, now.minus(30, ChronoUnit.DAYS));

        LicenseBatch platformBatch = LicenseBatch.builder()
                .id(UUID.randomUUID().toString())
                .batchNo("BATCH-PLATFORM-001")
                .name("平台直发 · 创作者体验包")
                .issuerTenantId(platformTenantId)
                .initialCreditGrant(1000L)
                .totalCount(100)
                .activatedCount(0)
                .validFrom(now)
                .validTo(now.plus(180, ChronoUnit.DAYS))
                .status(LicenseBatch.LicenseBatchStatus.ACTIVE)
                .createdAt(now)
                .build();
        licenseBatchRepo.save(platformBatch);
        seedSampleKeys(platformBatch.getId(), 5, now);
    }

    private void seedMembershipAndWallet(String userId, String tenantId, long initialCredit, Instant when) {
        membershipRepo.save(Membership.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .userId(userId)
                .source(Membership.MembershipSource.LICENSE_ACTIVATION)
                .joinedAt(when)
                .build());

        Wallet wallet = Wallet.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .totalBalance(initialCredit)
                .licenseBalance(initialCredit)
                .rechargeBalance(0L)
                .giftBalance(0L)
                .pendingBalance(0L)
                .createdAt(when)
                .updatedAt(when)
                .build();
        walletRepo.save(wallet);

        if (initialCredit > 0) {
            ledgerRepo.save(LedgerEntry.builder()
                    .id(UUID.randomUUID().toString())
                    .walletId(wallet.getId())
                    .userId(userId)
                    .entryType(LedgerEntry.LedgerEntryType.LICENSE_GRANT)
                    .amount(initialCredit)
                    .balanceAfter(initialCredit)
                    .description("初始化数据 · 演示发放")
                    .referenceType("seed")
                    .createdAt(when)
                    .build());
        }
    }

    private void seedSampleKeys(String batchId, int count, Instant when) {
        for (int i = 0; i < count; i++) {
            String raw = UUID.randomUUID().toString().replace("-", "").toUpperCase();
            licenseKeyRepo.save(LicenseKey.builder()
                    .id(UUID.randomUUID().toString())
                    .batchId(batchId)
                    .codeHash(sha256Hex(raw))
                    .maskedCode("AISTAR-" + raw.substring(0, 4) + "-****-****-" + raw.substring(raw.length() - 4))
                    .status(LicenseKey.LicenseKeyStatus.CREATED)
                    .createdAt(when)
                    .build());
        }
    }

    private String sha256Hex(String input) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
