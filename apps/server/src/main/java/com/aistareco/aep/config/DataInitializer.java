package com.aistareco.aep.config;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.FeatureConfig;
import com.aistareco.aep.model.Plan;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.model.Tenant;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.FeatureConfigRepository;
import com.aistareco.aep.repository.PlanRepository;
import com.aistareco.aep.repository.ProductRepository;
import com.aistareco.aep.repository.TenantRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
public class DataInitializer implements CommandLineRunner {

    private final ProductRepository productRepo;
    private final PlanRepository planRepo;
    private final AepUserRepository userRepo;
    private final TenantRepository tenantRepo;
    private final FeatureConfigRepository featureConfigRepo;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(
            ProductRepository productRepo,
            PlanRepository planRepo,
            AepUserRepository userRepo,
            TenantRepository tenantRepo,
            FeatureConfigRepository featureConfigRepo,
            PasswordEncoder passwordEncoder
    ) {
        this.productRepo = productRepo;
        this.planRepo = planRepo;
        this.userRepo = userRepo;
        this.tenantRepo = tenantRepo;
        this.featureConfigRepo = featureConfigRepo;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        seedCatalog();
        seedAdminUsers();
        seedTenant();
        seedConfigs();
    }

    private void seedCatalog() {
        if (productRepo.count() > 0) {
            return;
        }

        Product aiSinger = createProduct("ai_singer", "AI Singer", "AI-powered virtual singer creation and management");
        Product aiVideo = createProduct("ai_video", "AI Video", "AI-powered video generation and publishing");
        Product aiArtist = createProduct("ai_artist", "AI Artist", "AI-powered artist brand and content management");

        productRepo.save(aiSinger);
        productRepo.save(aiVideo);
        productRepo.save(aiArtist);

        planRepo.save(createPlan(aiSinger.getId(), "free", "Free", 0L, 0L));
        planRepo.save(createPlan(aiSinger.getId(), "pro", "Pro", 999L, 9990L));
        planRepo.save(createPlan(aiSinger.getId(), "enterprise", "Enterprise", 4999L, 49990L));
    }

    private void seedAdminUsers() {
        ensureAdminUser("admin", "admin@aistareco.com", "Platform Admin", "admin123", AepUser.UserRole.PLATFORM_OPERATOR);
        ensureAdminUser("finance", "finance@aistareco.com", "Finance Admin", "finance123", AepUser.UserRole.FINANCE_ADMIN);
    }

    private void ensureAdminUser(String username, String email, String displayName, String rawPassword, AepUser.UserRole role) {
        AepUser user = userRepo.findByUsername(username).orElseGet(() -> AepUser.builder()
                .id(UUID.randomUUID().toString())
                .username(username)
                .createdAt(Instant.now())
                .build());

        user.setEmail(email);
        user.setDisplayName(displayName);
        user.setRole(role);
        user.setPlan(AepUser.UserPlan.ENTERPRISE);
        user.setCredits(0L);
        user.setStatus(AepUser.UserStatus.ACTIVE);
        user.setEmailVerified(true);
        user.setPhoneVerified(false);
        user.setLangPreference("zh-CN");
        user.setThemePreference("minimal");
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setUpdatedAt(Instant.now());
        userRepo.save(user);
    }

    private void seedTenant() {
        if (tenantRepo.count() > 0) {
            return;
        }

        String adminId = userRepo.findByUsername("admin").map(AepUser::getId).orElse(null);
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

    private void seedConfigs() {
        if (featureConfigRepo.count() > 0) {
            return;
        }

        featureConfigRepo.saveAll(List.of(
                config("credits.music.generate", "credits", FeatureConfig.ValueType.INT, "5", "5", "音乐生成默认消耗积分"),
                config("credits.music.generate.advanced", "credits", FeatureConfig.ValueType.INT, "15", "15", "高级模型音乐生成消耗积分"),
                config("credits.activation.default", "credits", FeatureConfig.ValueType.INT, "100", "100", "激活默认赠送积分"),
                config("credits.singer.avatar.generate", "credits", FeatureConfig.ValueType.INT, "3", "3", "AI 歌手头像生成消耗积分"),
                config("credits.singer.gene_mix", "credits", FeatureConfig.ValueType.INT, "10", "10", "基因混合实验室消耗积分"),
                config("credits.video.generate.per_minute", "credits", FeatureConfig.ValueType.INT, "20", "20", "视频生成每分钟积分"),
                config("quota.singer_slot.free", "quota", FeatureConfig.ValueType.INT, "3", "3", "免费套餐歌手名额"),
                config("quota.singer_slot.pro", "quota", FeatureConfig.ValueType.INT, "20", "20", "专业套餐歌手名额"),
                config("quota.singer_slot.enterprise", "quota", FeatureConfig.ValueType.INT, "-1", "-1", "企业套餐歌手名额"),
                config("quota.music_generate.daily.free", "quota", FeatureConfig.ValueType.INT, "5", "5", "免费套餐每日音乐生成次数"),
                config("quota.music_generate.daily.pro", "quota", FeatureConfig.ValueType.INT, "50", "50", "专业套餐每日音乐生成次数"),
                config("quota.track_publish.monthly.free", "quota", FeatureConfig.ValueType.INT, "3", "3", "免费套餐每月发行次数"),
                config("quota.track_publish.monthly.pro", "quota", FeatureConfig.ValueType.INT, "30", "30", "专业套餐每月发行次数"),
                config("feature.gene_lab.enabled", "feature", FeatureConfig.ValueType.BOOL, "true", "true", "基因实验室总开关"),
                config("feature.nft_mint.enabled", "feature", FeatureConfig.ValueType.BOOL, "true", "true", "NFT 铸造开关"),
                config("feature.distribution.enabled", "feature", FeatureConfig.ValueType.BOOL, "true", "true", "发行模块开关"),
                config("feature.mcn_coach.enabled", "feature", FeatureConfig.ValueType.BOOL, "true", "true", "MCN 模块开关"),
                config("feature.maintenance_mode", "feature", FeatureConfig.ValueType.BOOL, "false", "false", "全站维护模式"),
                config("ui.credits_low_threshold", "ui", FeatureConfig.ValueType.INT, "20", "20", "积分低余额提示阈值"),
                config("ui.credits_warn_before_generate", "ui", FeatureConfig.ValueType.BOOL, "true", "true", "生成前提示积分"),
                config("ui.announcement_banner", "ui", FeatureConfig.ValueType.STRING, "", "", "顶部公告栏"),
                config("pricing.plan.pro.monthly_cny", "pricing", FeatureConfig.ValueType.FLOAT, "199", "199", "专业套餐月付人民币"),
                config("pricing.plan.pro.yearly_cny", "pricing", FeatureConfig.ValueType.FLOAT, "1999", "1999", "专业套餐年付人民币"),
                config("pricing.plan.enterprise.monthly_usd", "pricing", FeatureConfig.ValueType.FLOAT, "99.99", "99.99", "企业套餐月付美元"),
                config("revenue.signing.seller_ratio", "revenue", FeatureConfig.ValueType.FLOAT, "0.80", "0.80", "签约费卖家分成比例"),
                config("revenue.signing.platform_ratio", "revenue", FeatureConfig.ValueType.FLOAT, "0.20", "0.20", "签约费平台分成比例")
        ));
    }

    private FeatureConfig config(
            String key,
            String group,
            FeatureConfig.ValueType valueType,
            String value,
            String defaultValue,
            String description
    ) {
        Instant now = Instant.now();
        return FeatureConfig.builder()
                .id(UUID.randomUUID().toString())
                .configKey(key)
                .configGroup(group)
                .valueType(valueType)
                .value(value)
                .defaultValue(defaultValue)
                .scope(FeatureConfig.Scope.GLOBAL)
                .isActive(true)
                .isEditableByOperator(true)
                .description(description)
                .updatedBy("system")
                .updatedAt(now)
                .createdAt(now)
                .build();
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

    private Plan createPlan(String productId, String code, String name, long monthlyPriceCents, long annualPriceCents) {
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
