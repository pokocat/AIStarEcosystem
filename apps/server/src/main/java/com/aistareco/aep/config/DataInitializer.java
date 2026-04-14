package com.aistareco.aep.config;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.Plan;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.model.Tenant;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.PlanRepository;
import com.aistareco.aep.repository.ProductRepository;
import com.aistareco.aep.repository.TenantRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Component
public class DataInitializer implements CommandLineRunner {

    private final ProductRepository productRepo;
    private final PlanRepository planRepo;
    private final AepUserRepository userRepo;
    private final TenantRepository tenantRepo;

    public DataInitializer(ProductRepository productRepo,
                            PlanRepository planRepo,
                            AepUserRepository userRepo,
                            TenantRepository tenantRepo) {
        this.productRepo = productRepo;
        this.planRepo = planRepo;
        this.userRepo = userRepo;
        this.tenantRepo = tenantRepo;
    }

    @Override
    public void run(String... args) {
        if (productRepo.count() > 0) {
            return;
        }

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

        // Seed sample admin user
        String adminId = UUID.randomUUID().toString();
        AepUser adminUser = AepUser.builder()
                .id(adminId)
                .username("admin")
                .email("admin@aistareco.com")
                .displayName("Platform Admin")
                .role(AepUser.UserRole.PLATFORM_OPERATOR)
                .plan(AepUser.UserPlan.ENTERPRISE)
                .credits(0L)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(false)
                .langPreference("zh-CN")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        userRepo.save(adminUser);

        // Seed sample tenant
        Tenant sampleTenant = Tenant.builder()
                .id(UUID.randomUUID().toString())
                .name("Default Organization")
                .type(Tenant.TenantType.ORGANIZATION)
                .status(Tenant.TenantStatus.ACTIVE)
                .ownerUserId(adminId)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        tenantRepo.save(sampleTenant);
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
