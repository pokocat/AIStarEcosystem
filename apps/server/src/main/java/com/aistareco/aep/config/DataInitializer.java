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
    private final TenantRepository tenantRepo;
    private final MembershipRepository membershipRepo;
    private final EntitlementRepository entitlementRepo;
    private final WalletRepository walletRepo;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(ProductRepository productRepo,
                            PlanRepository planRepo,
                            AepUserRepository userRepo,
                            TenantRepository tenantRepo,
                            MembershipRepository membershipRepo,
                            EntitlementRepository entitlementRepo,
                            WalletRepository walletRepo,
                            PasswordEncoder passwordEncoder) {
        this.productRepo = productRepo;
        this.planRepo = planRepo;
        this.userRepo = userRepo;
        this.tenantRepo = tenantRepo;
        this.membershipRepo = membershipRepo;
        this.entitlementRepo = entitlementRepo;
        this.walletRepo = walletRepo;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (productRepo.count() > 0) {
            return;
        }

        Instant now = Instant.now();

        // Seed products
        Product aiSinger = createProduct("ai_singer", "AI Singer", "AI-powered virtual singer creation and management");
        Product aiVideo = createProduct("ai_video", "AI Video", "AI-powered video generation and publishing");
        Product aiArtist = createProduct("ai_artist", "AI Artist", "AI-powered artist brand and content management");

        productRepo.save(aiSinger);
        productRepo.save(aiVideo);
        productRepo.save(aiArtist);

        // Seed plans for ai_singer
        Plan singerFree = createPlan(aiSinger.getId(), "free", "Free", 0L, 0L);
        Plan singerPro = createPlan(aiSinger.getId(), "pro", "Pro", 999L, 9990L);
        Plan singerEnterprise = createPlan(aiSinger.getId(), "enterprise", "Enterprise", 4999L, 49990L);

        planRepo.save(singerFree);
        planRepo.save(singerPro);
        planRepo.save(singerEnterprise);

        // Seed system admin (PLATFORM_OPERATOR) with password
        String adminId = UUID.randomUUID().toString();
        AepUser adminUser = AepUser.builder()
                .id(adminId)
                .username("admin")
                .passwordHash(passwordEncoder.encode("admin123"))
                .email("admin@aistareco.com")
                .displayName("系统管理员")
                .role(AepUser.UserRole.PLATFORM_OPERATOR)
                .plan(AepUser.UserPlan.ENTERPRISE)
                .credits(0L)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(false)
                .langPreference("zh-CN")
                .createdAt(now)
                .updatedAt(now)
                .build();
        userRepo.save(adminUser);

        // Seed finance admin
        String financeAdminId = UUID.randomUUID().toString();
        AepUser financeAdmin = AepUser.builder()
                .id(financeAdminId)
                .username("finance")
                .passwordHash(passwordEncoder.encode("finance123"))
                .email("finance@aistareco.com")
                .displayName("财务管理员")
                .role(AepUser.UserRole.FINANCE_ADMIN)
                .plan(AepUser.UserPlan.ENTERPRISE)
                .credits(0L)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(false)
                .langPreference("zh-CN")
                .createdAt(now)
                .updatedAt(now)
                .build();
        userRepo.save(financeAdmin);

        // Seed platform owner
        String ownerId = UUID.randomUUID().toString();
        AepUser platformOwner = AepUser.builder()
                .id(ownerId)
                .username("owner")
                .passwordHash(passwordEncoder.encode("owner123"))
                .email("owner@aistareco.com")
                .displayName("平台所有者")
                .role(AepUser.UserRole.PLATFORM_OWNER)
                .plan(AepUser.UserPlan.ENTERPRISE)
                .credits(0L)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(false)
                .langPreference("zh-CN")
                .createdAt(now)
                .updatedAt(now)
                .build();
        userRepo.save(platformOwner);

        // Seed channel manager
        String channelManagerId = UUID.randomUUID().toString();
        AepUser channelManager = AepUser.builder()
                .id(channelManagerId)
                .username("channel")
                .passwordHash(passwordEncoder.encode("channel123"))
                .email("channel@aistareco.com")
                .displayName("渠道管理员")
                .role(AepUser.UserRole.CHANNEL_MANAGER)
                .plan(AepUser.UserPlan.ENTERPRISE)
                .credits(0L)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(false)
                .langPreference("zh-CN")
                .createdAt(now)
                .updatedAt(now)
                .build();
        userRepo.save(channelManager);

        // Seed sample regular users (registered via license key)
        String userId1 = UUID.randomUUID().toString();
        AepUser regularUser = AepUser.builder()
                .id(userId1)
                .username("demo_producer")
                .email("producer@example.com")
                .displayName("示例制作人")
                .role(AepUser.UserRole.PRODUCER)
                .plan(AepUser.UserPlan.PRO)
                .credits(500L)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(false)
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .updatedAt(now)
                .build();
        userRepo.save(regularUser);

        String userId2 = UUID.randomUUID().toString();
        AepUser fanUser = AepUser.builder()
                .id(userId2)
                .username("demo_fan")
                .email("fan@example.com")
                .displayName("示例粉丝")
                .role(AepUser.UserRole.FAN)
                .plan(AepUser.UserPlan.FREE)
                .credits(100L)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(false)
                .phoneVerified(true)
                .phone("13800138000")
                .createdAt(now.minus(3, ChronoUnit.DAYS))
                .updatedAt(now)
                .build();
        userRepo.save(fanUser);

        // Seed admin tenant
        String adminTenantId = UUID.randomUUID().toString();
        Tenant adminTenant = Tenant.builder()
                .id(adminTenantId)
                .name("平台运营组织")
                .type(Tenant.TenantType.ORGANIZATION)
                .status(Tenant.TenantStatus.ACTIVE)
                .ownerUserId(adminId)
                .createdAt(now)
                .updatedAt(now)
                .build();
        tenantRepo.save(adminTenant);

        membershipRepo.save(Membership.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(adminTenantId)
                .userId(adminId)
                .tenantRole("tenant_admin")
                .joinedAt(now)
                .build());
        membershipRepo.save(Membership.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(adminTenantId)
                .userId(ownerId)
                .tenantRole("tenant_owner")
                .joinedAt(now)
                .build());
        membershipRepo.save(Membership.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(adminTenantId)
                .userId(financeAdminId)
                .tenantRole("finance_admin")
                .joinedAt(now)
                .build());
        membershipRepo.save(Membership.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(adminTenantId)
                .userId(channelManagerId)
                .tenantRole("channel_manager")
                .joinedAt(now)
                .build());

        // Seed user tenants
        String userTenantId = UUID.randomUUID().toString();
        Tenant userTenant = Tenant.builder()
                .id(userTenantId)
                .name("demo_producer 的个人空间")
                .type(Tenant.TenantType.PERSONAL)
                .status(Tenant.TenantStatus.ACTIVE)
                .ownerUserId(userId1)
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .updatedAt(now)
                .build();
        tenantRepo.save(userTenant);
        membershipRepo.save(Membership.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(userTenantId)
                .userId(userId1)
                .tenantRole("tenant_owner")
                .joinedAt(now.minus(7, ChronoUnit.DAYS))
                .build());

        // Seed sample entitlements
        entitlementRepo.save(Entitlement.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(userTenantId)
                .productId(aiSinger.getId())
                .planId(singerPro.getId())
                .entitlementType(Entitlement.EntitlementType.FEATURE_ACCESS)
                .featureCode("singer.create")
                .value("true")
                .validFrom(now.minus(7, ChronoUnit.DAYS))
                .validTo(now.plus(365, ChronoUnit.DAYS))
                .status(Entitlement.EntitlementStatus.ACTIVE)
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .build());

        entitlementRepo.save(Entitlement.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(userTenantId)
                .productId(aiSinger.getId())
                .planId(singerPro.getId())
                .entitlementType(Entitlement.EntitlementType.SINGER_SLOT)
                .featureCode("singer.slot.limit")
                .value("5")
                .validFrom(now.minus(7, ChronoUnit.DAYS))
                .validTo(now.plus(365, ChronoUnit.DAYS))
                .status(Entitlement.EntitlementStatus.ACTIVE)
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .build());

        entitlementRepo.save(Entitlement.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(userTenantId)
                .productId(aiSinger.getId())
                .planId(singerPro.getId())
                .entitlementType(Entitlement.EntitlementType.MONTHLY_CREDIT)
                .featureCode("credit.monthly")
                .value("1000")
                .validFrom(now.minus(7, ChronoUnit.DAYS))
                .validTo(now.plus(30, ChronoUnit.DAYS))
                .status(Entitlement.EntitlementStatus.ACTIVE)
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .build());

        entitlementRepo.save(Entitlement.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(adminTenantId)
                .productId(aiSinger.getId())
                .planId(singerEnterprise.getId())
                .entitlementType(Entitlement.EntitlementType.FEATURE_ACCESS)
                .featureCode("admin.full_access")
                .value("true")
                .validFrom(now)
                .status(Entitlement.EntitlementStatus.ACTIVE)
                .createdAt(now)
                .build());

        // Seed wallets
        walletRepo.save(Wallet.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(adminTenantId)
                .totalBalance(0)
                .giftBalance(0)
                .rechargeBalance(0)
                .planBalance(0)
                .createdAt(now)
                .updatedAt(now)
                .build());

        walletRepo.save(Wallet.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(userTenantId)
                .totalBalance(500)
                .giftBalance(200)
                .rechargeBalance(300)
                .planBalance(0)
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .updatedAt(now)
                .build());
    }

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
}
