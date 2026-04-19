package com.aistareco.aep.config;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Seeds an empty database with demo accounts, tenants, license batches and wallets
 * that mirror the model defined in /product_spec.md.
 *
 * Idempotent: skips when admin staff already exist.
 */
@Component
@Order(1)
public class DataInitializer implements CommandLineRunner {

    private final AdminUserRepository adminUserRepo;
    private final AepUserRepository userRepo;
    private final TenantRepository tenantRepo;
    private final MembershipRepository membershipRepo;
    private final WalletRepository walletRepo;
    private final LedgerEntryRepository ledgerRepo;
    private final StudioRepository studioRepo;
    private final DigitalIpRepository digitalIpRepo;
    private final SongRepository songRepo;
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
                            DigitalIpRepository digitalIpRepo,
                            SongRepository songRepo,
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
        this.digitalIpRepo = digitalIpRepo;
        this.songRepo = songRepo;
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
        // 所有账号 = Studio。独立创作者账号（原 fan_luna）也挂一个 PERSONAL_CREATOR 工作室。
        AepUser lunaUser = AepUser.builder()
                .id(UUID.randomUUID().toString())
                .username("creator_luna")
                .email("luna@example.com")
                .displayName("Luna 个人创作者")
                .kind(AepUser.AccountKind.STUDIO)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(false)
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .updatedAt(now)
                .build();
        userRepo.save(lunaUser);

        seedMembershipAndWallet(lunaUser.getId(), platformTenantId, 500L, now.minus(7, ChronoUnit.DAYS));

        Studio lunaStudio = studioRepo.save(Studio.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(lunaUser.getId())
                .name("Luna 个人工作室")
                .kind(Studio.StudioKind.PERSONAL_CREATOR)
                .status(Studio.StudioStatus.ACTIVE)
                .bio("独立创作者单人工作室，以短视频 BGM 切入。")
                .contactEmail("luna@example.com")
                .createdAt(now.minus(7, ChronoUnit.DAYS))
                .updatedAt(now)
                .build());

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

        Studio starlightStudio = studioRepo.save(Studio.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(studioUser.getId())
                .name("星光工作室")
                .kind(Studio.StudioKind.AGENCY)
                .status(Studio.StudioStatus.ACTIVE)
                .bio("专注于 AI 虚拟艺人孵化的精品工作室。")
                .contactEmail("contact@starlight.example.com")
                .createdAt(now.minus(30, ChronoUnit.DAYS))
                .updatedAt(now)
                .build());

        // 星光工作室签约艺人 × 3（ownerUserId 指向 studioUser，studioId 指向 starlightStudio）
        List<DigitalIp> starlightIps = seedDigitalIps(studioUser.getId(), starlightStudio.getId(), List.of(
                new IpSeed("星野瞳", DigitalIp.DigitalIpKind.SINGER, DigitalIp.Quality.EPIC,
                        DigitalIp.DigitalIpStatus.ACTIVE, 42, 88,
                        "https://images.unsplash.com/photo-1745532665626-09f20c9408dd?w=200&q=80",
                        "赛博朋克风格 AI 歌手，擅长电子音乐与未来感旋律。"),
                new IpSeed("夏栖羽", DigitalIp.DigitalIpKind.IDOL, DigitalIp.Quality.LEGENDARY,
                        DigitalIp.DigitalIpStatus.ACTIVE, 58, 95,
                        "https://images.unsplash.com/photo-1596395463910-3ac2899a5bea?w=200&q=80",
                        "顶级偶像型 AI 艺人，超强粉丝运营力与应援文化引领者。"),
                new IpSeed("林夜川", DigitalIp.DigitalIpKind.ACTOR, DigitalIp.Quality.RARE,
                        DigitalIp.DigitalIpStatus.ACTIVE, 35, 72,
                        "https://images.unsplash.com/photo-1694877286935-0e7decac9bb1?w=200&q=80",
                        "暗黑系演员型 AI 艺人，悬疑电影与犯罪剧领域的新生力量。")
        ), now);

        // ─── 第二个经纪公司账号（演示切换） ────────────────────────────────────
        AepUser agencyUser = AepUser.builder()
                .id(UUID.randomUUID().toString())
                .username("agency_moonrise")
                .email("moonrise@example.com")
                .displayName("月升经纪")
                .kind(AepUser.AccountKind.STUDIO)
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(true)
                .phoneVerified(false)
                .createdAt(now.minus(60, ChronoUnit.DAYS))
                .updatedAt(now)
                .build();
        userRepo.save(agencyUser);

        seedMembershipAndWallet(agencyUser.getId(), agencyTenantId, 5000L, now.minus(60, ChronoUnit.DAYS));

        Studio moonriseStudio = studioRepo.save(Studio.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(agencyUser.getId())
                .name("月升传媒")
                .kind(Studio.StudioKind.MCN)
                .status(Studio.StudioStatus.ACTIVE)
                .bio("覆盖短剧 / 综艺 / 直播的 MCN 机构，AI 艺人矩阵化运营。")
                .contactEmail("contact@moonrise.example.com")
                .createdAt(now.minus(60, ChronoUnit.DAYS))
                .updatedAt(now)
                .build());

        List<DigitalIp> moonriseIps = seedDigitalIps(agencyUser.getId(), moonriseStudio.getId(), List.of(
                new IpSeed("苏安歌", DigitalIp.DigitalIpKind.ALL_ROUNDER, DigitalIp.Quality.EPIC,
                        DigitalIp.DigitalIpStatus.ACTIVE, 48, 80,
                        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80",
                        "声线清甜的全能型 AI 艺人,擅长 OST 与综艺主持。"),
                new IpSeed("白予辰", DigitalIp.DigitalIpKind.HOST, DigitalIp.Quality.RARE,
                        DigitalIp.DigitalIpStatus.DEBUT, 22, 60,
                        "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&q=80",
                        "理性冷静的主持人型 AI 艺人,新闻与科技访谈首选。"),
                new IpSeed("米可乐", DigitalIp.DigitalIpKind.ENTERTAINER, DigitalIp.Quality.COMMON,
                        DigitalIp.DigitalIpStatus.TRAINEE, 8, 40,
                        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&q=80",
                        "幽默风趣的综艺担当,直播间即兴互动能力强。")
        ), now);

        // Luna 个人工作室（1 艺人）
        List<DigitalIp> lunaIps = seedDigitalIps(lunaUser.getId(), lunaStudio.getId(), List.of(
                new IpSeed("沐月", DigitalIp.DigitalIpKind.SINGER, DigitalIp.Quality.COMMON,
                        DigitalIp.DigitalIpStatus.DEBUT, 12, 45,
                        "https://images.unsplash.com/photo-1611432579402-7037e3e2c1e4?w=200&q=80",
                        "治愈系民谣 AI 歌手，主打短视频 BGM 场景。")
        ), now);

        // 为每个 Studio 的首艺人挂两首 seed Song，验证 §10.2 字段链路。
        seedSongsFor(starlightIps.get(0),
                List.of(new SongSeed("赛博之夜", "电子舞曲", 245, Song.SongStatus.RELEASED, 582_000L, 18_600L),
                        new SongSeed("霓虹梦境", "电子舞曲", 198, Song.SongStatus.MIXING, 0L, 0L)),
                now);
        seedSongsFor(moonriseIps.get(0),
                List.of(new SongSeed("星光漫步", "流行", 203, Song.SongStatus.RELEASED, 423_000L, 12_400L),
                        new SongSeed("月升之约", "流行", 215, Song.SongStatus.RECORDING, 0L, 0L)),
                now);
        seedSongsFor(lunaIps.get(0),
                List.of(new SongSeed("晨光", "民谣", 175, Song.SongStatus.RELEASED, 68_000L, 2_400L)),
                now);

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

    /** Seed DigitalIp rows for a studio (both ownerUserId and studioId pointed at the studio). */
    private List<DigitalIp> seedDigitalIps(String ownerUserId, String studioId, List<IpSeed> seeds, Instant when) {
        List<DigitalIp> saved = new java.util.ArrayList<>();
        int i = 0;
        for (IpSeed seed : seeds) {
            saved.add(digitalIpRepo.save(DigitalIp.builder()
                    .id(UUID.randomUUID().toString())
                    .name(seed.name())
                    .kind(seed.kind())
                    .quality(seed.quality())
                    .status(seed.status())
                    .level(seed.level())
                    .exp(0)
                    .maxExp(seed.level() * 200)
                    .avatarUrl(seed.avatar())
                    .bio(seed.bio())
                    .talentSinging(seed.kind() == DigitalIp.DigitalIpKind.SINGER ? 85 : 40)
                    .talentActing(seed.kind() == DigitalIp.DigitalIpKind.ACTOR ? 82 : 35)
                    .talentDancing(seed.kind() == DigitalIp.DigitalIpKind.DANCER ? 88 : 40)
                    .talentHosting(seed.kind() == DigitalIp.DigitalIpKind.HOST ? 80 : 30)
                    .talentComedy(seed.kind() == DigitalIp.DigitalIpKind.ENTERTAINER ? 70 : 25)
                    .talentVariety(seed.kind() == DigitalIp.DigitalIpKind.ALL_ROUNDER ? 82 : 40)
                    .statFans(seed.popularity() * 2_000L)
                    .statPopularity(seed.popularity())
                    .domains(defaultDomainsFor(seed.kind()))
                    .ownerUserId(ownerUserId)
                    .studioId(studioId)
                    .createdAt(when.minus(i, ChronoUnit.DAYS))
                    .updatedAt(when)
                    .lastActiveAt(when)
                    .build()));
            i++;
        }
        return saved;
    }

    /** 按艺人分类推断默认领域（见 product_spec.md §4.1 八大领域）。新艺人档案在孵化向导后会覆盖本值。 */
    private static List<String> defaultDomainsFor(DigitalIp.DigitalIpKind kind) {
        return switch (kind) {
            case SINGER      -> List.of("音乐", "舞台表演");
            case ACTOR       -> List.of("影视");
            case ENTERTAINER -> List.of("综艺", "曲艺表演");
            case DANCER      -> List.of("舞台表演", "综艺");
            case HOST        -> List.of("综艺", "教育培训");
            case IDOL        -> List.of("音乐", "综艺", "商业代言");
            case ALL_ROUNDER -> List.of("音乐", "影视", "综艺", "商业代言");
        };
    }

    private void seedSongsFor(DigitalIp artist, List<SongSeed> seeds, Instant when) {
        int i = 0;
        for (SongSeed seed : seeds) {
            songRepo.save(Song.builder()
                    .id("s-" + UUID.randomUUID().toString().substring(0, 8))
                    .title(seed.title())
                    .genre(seed.genre())
                    .duration(seed.duration())
                    .status(seed.status())
                    .plays(seed.plays())
                    .revenue(seed.revenue())
                    .rating(0)
                    .releaseDate(seed.status() == Song.SongStatus.RELEASED ? when.minus(i + 3L, ChronoUnit.DAYS) : null)
                    .artistId(artist.getId())
                    .audioUrl("https://cdn.placeholder.local/mock/audio.mp3")
                    .coverUrl(artist.getAvatarUrl())
                    .modelVersion("suno-v3")
                    .thinkDepth("standard")
                    .creditsSpent(120L)
                    .createdAt(when.minus(i, ChronoUnit.DAYS))
                    .build());
            i++;
        }
    }

    private record IpSeed(
            String name,
            DigitalIp.DigitalIpKind kind,
            DigitalIp.Quality quality,
            DigitalIp.DigitalIpStatus status,
            int level,
            int popularity,
            String avatar,
            String bio
    ) {}

    private record SongSeed(
            String title,
            String genre,
            int duration,
            Song.SongStatus status,
            long plays,
            long revenue
    ) {}

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
