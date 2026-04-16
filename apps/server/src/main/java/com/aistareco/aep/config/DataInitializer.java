package com.aistareco.aep.config;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Component
public class DataInitializer implements CommandLineRunner {

    private final ProductRepository productRepo;
    private final PlanRepository planRepo;
    private final AepUserRepository userRepo;
    private final AdminUserRepository adminUserRepo;
    private final TenantRepository tenantRepo;
    private final MembershipRepository membershipRepo;
    private final EntitlementRepository entitlementRepo;
    private final WalletRepository walletRepo;
    private final LicenseBatchRepository licenseBatchRepo;
    private final LicenseKeyRepository licenseKeyRepo;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(ProductRepository productRepo,
                            PlanRepository planRepo,
                            AepUserRepository userRepo,
                            AdminUserRepository adminUserRepo,
                            TenantRepository tenantRepo,
                            MembershipRepository membershipRepo,
                            EntitlementRepository entitlementRepo,
                            WalletRepository walletRepo,
                            LicenseBatchRepository licenseBatchRepo,
                            LicenseKeyRepository licenseKeyRepo,
                            PasswordEncoder passwordEncoder) {
        this.productRepo = productRepo;
        this.planRepo = planRepo;
        this.userRepo = userRepo;
        this.adminUserRepo = adminUserRepo;
        this.tenantRepo = tenantRepo;
        this.membershipRepo = membershipRepo;
        this.entitlementRepo = entitlementRepo;
        this.walletRepo = walletRepo;
        this.licenseBatchRepo = licenseBatchRepo;
        this.licenseKeyRepo = licenseKeyRepo;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (productRepo.count() > 0) {
            return;
        }

        Instant now = Instant.now();

        // ─── 1. Products & Plans ───────────────────────────────────────────────

        Product aiSinger = createProduct("ai_singer", "AI Singer", "AI-powered virtual singer creation and management");
        Product aiVideo  = createProduct("ai_video",  "AI Video",  "AI-powered video generation and publishing");
        Product aiArtist = createProduct("ai_artist", "AI Artist", "AI-powered artist brand and content management");

        productRepo.save(aiSinger);
        productRepo.save(aiVideo);
        productRepo.save(aiArtist);

        Plan singerFree       = createPlan(aiSinger.getId(), "free",       "免费版",   0L,    0L);
        Plan singerPro        = createPlan(aiSinger.getId(), "pro",        "专业版",   999L,  9990L);
        Plan singerEnterprise = createPlan(aiSinger.getId(), "enterprise", "企业版",   4999L, 49990L);

        planRepo.save(singerFree);
        planRepo.save(singerPro);
        planRepo.save(singerEnterprise);

        // ─── 2. Admin Staff (AdminUser — separated from platform users) ────────

        // 超管 (Super Admin)
        AdminUser superAdmin = AdminUser.builder()
                .id(UUID.randomUUID().toString())
                .username("admin")
                .passwordHash(passwordEncoder.encode("admin123"))
                .email("admin@aistareco.com")
                .displayName("超级管理员")
                .role(AdminUser.AdminRole.SUPER_ADMIN)
                .status(AdminUser.AdminStatus.ACTIVE)
                .createdAt(now)
                .updatedAt(now)
                .build();
        adminUserRepo.save(superAdmin);

        // 运营 (Operator)
        AdminUser operator = AdminUser.builder()
                .id(UUID.randomUUID().toString())
                .username("operator")
                .passwordHash(passwordEncoder.encode("operator123"))
                .email("operator@aistareco.com")
                .displayName("平台运营")
                .role(AdminUser.AdminRole.OPERATOR)
                .status(AdminUser.AdminStatus.ACTIVE)
                .createdAt(now)
                .updatedAt(now)
                .build();
        adminUserRepo.save(operator);

        // ─── 3. Tenants (distribution channels) ───────────────────────────────

        // Tenant A — 星梦娱乐 (a talent agency that distributes keys to its signed AI artists)
        String tenantAId = UUID.randomUUID().toString();
        Tenant tenantA = Tenant.builder()
                .id(tenantAId)
                .name("星梦娱乐经纪公司")
                .type(Tenant.TenantType.ORGANIZATION)
                .status(Tenant.TenantStatus.ACTIVE)
                .ownerUserId(null)  // owned by the platform; no individual owner
                .createdAt(now)
                .updatedAt(now)
                .build();
        tenantRepo.save(tenantA);

        walletRepo.save(Wallet.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantAId)
                .totalBalance(5000L)
                .giftBalance(5000L)
                .rechargeBalance(0L)
                .planBalance(0L)
                .createdAt(now)
                .updatedAt(now)
                .build());

        // ─── 4. Platform Users (activated via license keys) ────────────────────

        // User 1 — AI 歌手，属于星梦娱乐
        String user1Id = UUID.randomUUID().toString();
        AepUser aiSingerUser = AepUser.builder()
                .id(user1Id)
                .username("singer_luna")
                .email("luna@aistareco.com")
                .displayName("Luna · AI歌手")
                .role(AepUser.UserRole.AI_SINGER)
                .credits(500L)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(false)
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .updatedAt(now)
                .build();
        userRepo.save(aiSingerUser);

        membershipRepo.save(Membership.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantAId)
                .userId(user1Id)
                .tenantRole("MEMBER")
                .joinedAt(now.minus(7, ChronoUnit.DAYS))
                .build());

        // User 2 — AI 艺人，属于星梦娱乐
        String user2Id = UUID.randomUUID().toString();
        AepUser aiArtistUser = AepUser.builder()
                .id(user2Id)
                .username("artist_nova")
                .email("nova@aistareco.com")
                .displayName("Nova · AI艺人")
                .role(AepUser.UserRole.AI_ARTIST)
                .credits(1200L)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(true)
                .phone("13900139000")
                .createdAt(now.minus(14, ChronoUnit.DAYS))
                .updatedAt(now)
                .build();
        userRepo.save(aiArtistUser);

        membershipRepo.save(Membership.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantAId)
                .userId(user2Id)
                .tenantRole("MEMBER")
                .joinedAt(now.minus(14, ChronoUnit.DAYS))
                .build());

        // User 3 — 经纪公司账号 (independent, personal tenant)
        String user3Id = UUID.randomUUID().toString();
        AepUser economicCoUser = AepUser.builder()
                .id(user3Id)
                .username("agency_starlight")
                .email("starlight@example.com")
                .displayName("星光经纪")
                .role(AepUser.UserRole.ECONOMIC_COMPANY)
                .credits(3000L)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(false)
                .createdAt(now.minus(30, ChronoUnit.DAYS))
                .updatedAt(now)
                .build();
        userRepo.save(economicCoUser);

        // Personal tenant for the economic company
        String tenant3Id = UUID.randomUUID().toString();
        Tenant tenant3 = Tenant.builder()
                .id(tenant3Id)
                .name("星光经纪 的工作空间")
                .type(Tenant.TenantType.PERSONAL)
                .status(Tenant.TenantStatus.ACTIVE)
                .ownerUserId(user3Id)
                .createdAt(now.minus(30, ChronoUnit.DAYS))
                .updatedAt(now)
                .build();
        tenantRepo.save(tenant3);

        membershipRepo.save(Membership.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenant3Id)
                .userId(user3Id)
                .tenantRole("OWNER")
                .joinedAt(now.minus(30, ChronoUnit.DAYS))
                .build());

        walletRepo.save(Wallet.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenant3Id)
                .totalBalance(3000L)
                .giftBalance(1000L)
                .rechargeBalance(2000L)
                .planBalance(0L)
                .createdAt(now.minus(30, ChronoUnit.DAYS))
                .updatedAt(now)
                .build());

        // ─── 5. Entitlements ───────────────────────────────────────────────────

        // Singer Luna's entitlement (via tenantA)
        entitlementRepo.save(Entitlement.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantAId)
                .productId(aiSinger.getId())
                .planId(singerPro.getId())
                .entitlementType(Entitlement.EntitlementType.FEATURE_ACCESS)
                .featureCode("singer.create")
                .value("true")
                .validFrom(now.minus(7, ChronoUnit.DAYS))
                .validTo(now.plus(358, ChronoUnit.DAYS))
                .status(Entitlement.EntitlementStatus.ACTIVE)
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .build());

        entitlementRepo.save(Entitlement.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantAId)
                .productId(aiSinger.getId())
                .planId(singerPro.getId())
                .entitlementType(Entitlement.EntitlementType.SINGER_SLOT)
                .featureCode("singer.slot.limit")
                .value("10")
                .validFrom(now.minus(7, ChronoUnit.DAYS))
                .validTo(now.plus(358, ChronoUnit.DAYS))
                .status(Entitlement.EntitlementStatus.ACTIVE)
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .build());

        // Starlight agency entitlement (personal tenant)
        entitlementRepo.save(Entitlement.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenant3Id)
                .productId(aiArtist.getId())
                .planId(null)
                .entitlementType(Entitlement.EntitlementType.MONTHLY_CREDIT)
                .featureCode("credit.monthly")
                .value("3000")
                .validFrom(now.minus(30, ChronoUnit.DAYS))
                .validTo(now.plus(335, ChronoUnit.DAYS))
                .status(Entitlement.EntitlementStatus.ACTIVE)
                .createdAt(now.minus(30, ChronoUnit.DAYS))
                .build());

        // ─── 6. License Batches — owned by tenants ─────────────────────────────

        // Batch for 星梦娱乐 — they distribute these keys to their signed artists
        LicenseBatch batch1 = LicenseBatch.builder()
                .id(UUID.randomUUID().toString())
                .batchNo("BATCH-XINGMENG-001")
                .productId(aiSinger.getId())
                .planId(singerPro.getId())
                .ownerTenantId(tenantAId)
                .licenseType(LicenseBatch.LicenseType.PLAN_ACTIVATION)
                .durationDays(365)
                .creditDelta(500L)
                .settlementMode(LicenseBatch.SettlementMode.PREPAID)
                .totalCount(50)
                .activatedCount(2)
                .validFrom(now.minus(30, ChronoUnit.DAYS))
                .validTo(now.plus(335, ChronoUnit.DAYS))
                .createdAt(now.minus(30, ChronoUnit.DAYS))
                .build();
        licenseBatchRepo.save(batch1);

        // Generate a few sample keys for that batch
        for (int i = 0; i < 5; i++) {
            String raw = UUID.randomUUID().toString().replace("-", "").toUpperCase();
            licenseKeyRepo.save(LicenseKey.builder()
                    .id(UUID.randomUUID().toString())
                    .batchId(batch1.getId())
                    .codeHash(sha256Hex(raw))
                    .maskedCode("AISTAR-" + raw.substring(0, 4) + "-****-****-" + raw.substring(raw.length() - 4))
                    .status(LicenseKey.LicenseKeyStatus.CREATED)
                    .createdAt(now.minus(30, ChronoUnit.DAYS))
                    .build());
        }

        // Platform-direct batch (no ownerTenantId — creates personal tenant on activation)
        LicenseBatch batch2 = LicenseBatch.builder()
                .id(UUID.randomUUID().toString())
                .batchNo("BATCH-DIRECT-001")
                .productId(aiArtist.getId())
                .planId(null)
                .ownerTenantId(null)
                .licenseType(LicenseBatch.LicenseType.CREDIT_PACK)
                .durationDays(null)
                .creditDelta(1000L)
                .settlementMode(LicenseBatch.SettlementMode.ON_ACTIVATION)
                .totalCount(100)
                .activatedCount(1)
                .validFrom(now)
                .validTo(now.plus(180, ChronoUnit.DAYS))
                .createdAt(now)
                .build();
        licenseBatchRepo.save(batch2);
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private Product createProduct(String code, String name, String description) {
        return Product.builder()
                .id(UUID.randomUUID().toString())
                .code(code)
                .name(name)
                .description(description)
                .enabled(true)
                .createdAt(Instant.now())
                .build();
    }

    private Plan createPlan(String productId, String code, String name,
                             long monthlyPriceCents, long annualPriceCents) {
        return Plan.builder()
                .id(UUID.randomUUID().toString())
                .productId(productId)
                .code(code)
                .name(name)
                .monthlyPriceCents(monthlyPriceCents)
                .annualPriceCents(annualPriceCents)
                .enabled(true)
                .createdAt(Instant.now())
                .build();
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
