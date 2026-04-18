package com.aistareco.aep.config;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.model.*;
import com.aistareco.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * dev/test profile 下的目录数据种子。
 * 在 {@link DataInitializer} 之后运行，针对"前端会读取"的核心领域
 * 插入 2–5 条演示记录，便于 USE_MOCK=0 时页面不为空。
 *
 * 幂等：每种表独立判断 count == 0 才插入。
 *
 * <p>范围限定：只 seed 我们能清晰映射字段的实体。
 * 其余领域（drama/movie/ad/voice/fan-tier/fan-activity/community-event/
 * signed-artist/copyright/distribution-content/distribution-queue）
 * 若 DB 为空，对应 GET 会返回空列表，前端 mock 兜底仍可工作。
 */
@Component
@Profile({"dev", "test"})
@Order(100)
public class DemoCatalogSeeder implements CommandLineRunner {

    private final AepUserRepository userRepo;
    private final DigitalIpRepository ipRepo;
    private final WalletRepository walletRepo;
    private final LedgerEntryRepository ledgerRepo;

    private final SongRepository songRepo;
    private final AlbumRepository albumRepo;
    private final ConcertRepository concertRepo;
    private final MusicGenreRepository musicGenreRepo;
    private final PlatformRepository platformRepo;
    private final CreditPackRepository creditPackRepo;
    private final RechargeRecordRepository rechargeRepo;
    private final ForgeTemplateRepository forgeTemplateRepo;
    private final NotificationRepository notificationRepo;

    private final WardrobeItemRepository wardrobeRepo;
    private final PoseRepository poseRepo;
    private final ExpressionRepository expressionRepo;
    private final GestureRepository gestureRepo;
    private final NftCollectionRepository nftRepo;

    private final SavedOutfitRepository savedOutfitRepo;
    private final ForgeBlueprintRepository blueprintRepo;
    private final CreditPurchaseRepository purchaseRepo;
    private final PlatformConnectionRepository platformConnRepo;
    private final CommunityPostRepository postRepo;
    private final EventRsvpRepository rsvpRepo;

    private final PlatformConfigService configService;
    private final ObjectMapper objectMapper;

    public DemoCatalogSeeder(
            AepUserRepository userRepo, DigitalIpRepository ipRepo,
            WalletRepository walletRepo, LedgerEntryRepository ledgerRepo,
            SongRepository songRepo, AlbumRepository albumRepo,
            ConcertRepository concertRepo, MusicGenreRepository musicGenreRepo,
            PlatformRepository platformRepo,
            CreditPackRepository creditPackRepo, RechargeRecordRepository rechargeRepo,
            ForgeTemplateRepository forgeTemplateRepo, NotificationRepository notificationRepo,
            WardrobeItemRepository wardrobeRepo, PoseRepository poseRepo,
            ExpressionRepository expressionRepo, GestureRepository gestureRepo,
            NftCollectionRepository nftRepo,
            SavedOutfitRepository savedOutfitRepo, ForgeBlueprintRepository blueprintRepo,
            CreditPurchaseRepository purchaseRepo, PlatformConnectionRepository platformConnRepo,
            CommunityPostRepository postRepo, EventRsvpRepository rsvpRepo,
            PlatformConfigService configService, ObjectMapper objectMapper
    ) {
        this.userRepo = userRepo; this.ipRepo = ipRepo;
        this.walletRepo = walletRepo; this.ledgerRepo = ledgerRepo;
        this.songRepo = songRepo; this.albumRepo = albumRepo;
        this.concertRepo = concertRepo; this.musicGenreRepo = musicGenreRepo;
        this.platformRepo = platformRepo;
        this.creditPackRepo = creditPackRepo; this.rechargeRepo = rechargeRepo;
        this.forgeTemplateRepo = forgeTemplateRepo; this.notificationRepo = notificationRepo;
        this.wardrobeRepo = wardrobeRepo; this.poseRepo = poseRepo;
        this.expressionRepo = expressionRepo; this.gestureRepo = gestureRepo;
        this.nftRepo = nftRepo;
        this.savedOutfitRepo = savedOutfitRepo; this.blueprintRepo = blueprintRepo;
        this.purchaseRepo = purchaseRepo; this.platformConnRepo = platformConnRepo;
        this.postRepo = postRepo; this.rsvpRepo = rsvpRepo;
        this.configService = configService; this.objectMapper = objectMapper;
    }

    @Override
    public void run(String... args) {
        Instant now = Instant.now();

        AepUser studio = userRepo.findAll().stream()
                .filter(u -> u.getKind() == AepUser.AccountKind.STUDIO)
                .findFirst().orElse(null);
        AepUser fan = userRepo.findAll().stream()
                .filter(u -> u.getKind() == AepUser.AccountKind.PERSONAL)
                .findFirst().orElse(null);

        seedPlatformConfigs();
        seedMusicGenres();
        seedSongs(now);
        seedAlbums();
        seedConcerts(now);
        seedPlatforms();
        seedCreditPacks();
        seedRechargeHistory(fan);
        seedForgeTemplates();
        seedNotifications(now, studio, fan);
        seedWardrobe();
        seedPoseLibrary();
        seedNftCollections();
        seedDigitalIps(now, studio);
        seedRevenueLedger(now, studio);
        seedSavedOutfits(studio);
        seedBlueprints(now, studio);
        seedCreditPurchases(now, fan);
        seedPlatformConnections(now, studio);
        seedCommunityPosts(now, studio);
        seedEventRsvps(now, fan);
    }

    // ── music ───────────────────────────────────────────────────────────────

    private void seedMusicGenres() {
        if (musicGenreRepo.count() > 0) return;
        musicGenreRepo.saveAll(List.of(
                MusicGenre.builder().id("g-pop").name("流行").icon("🎤").color("#06b6d4").build(),
                MusicGenre.builder().id("g-rnb").name("R&B").icon("🎷").color("#a855f7").build(),
                MusicGenre.builder().id("g-edm").name("电子").icon("🎧").color("#f59e0b").build()
        ));
    }

    private void seedSongs(Instant now) {
        if (songRepo.count() > 0) return;
        songRepo.saveAll(List.of(
                Song.builder().id("song-1").title("Starlight Drift").genre("流行")
                        .duration(212).status(Song.SongStatus.RELEASED)
                        .plays(1_280_000L).revenue(52_000L).rating(4.6)
                        .releaseDate(now.minus(60, ChronoUnit.DAYS)).build(),
                Song.builder().id("song-2").title("Neon Heart").genre("电子")
                        .duration(198).status(Song.SongStatus.RELEASED)
                        .plays(865_000L).revenue(34_000L).rating(4.4)
                        .releaseDate(now.minus(35, ChronoUnit.DAYS)).build(),
                Song.builder().id("song-3").title("Silent Echo").genre("R&B")
                        .duration(244).status(Song.SongStatus.MIXING)
                        .plays(120_000L).revenue(4_500L).rating(4.8)
                        .releaseDate(now.minus(7, ChronoUnit.DAYS)).build()
        ));
    }

    private void seedAlbums() {
        if (albumRepo.count() > 0) return;
        albumRepo.saveAll(List.of(
                Album.builder().id("album-1").name("Nova EP").cover("🌌").trackCount(5)
                        .status(Album.AlbumStatus.RELEASED).sales(8_200L).revenue(68_000L).build(),
                Album.builder().id("album-2").name("Echo Chamber").cover("🔊").trackCount(8)
                        .status(Album.AlbumStatus.RECORDING).sales(0L).revenue(0L).build()
        ));
    }

    private void seedConcerts(Instant now) {
        if (concertRepo.count() > 0) return;
        concertRepo.save(Concert.builder().id("concert-1").name("星光盛典 2026")
                .venue("上海 · 梅赛德斯奔驰文化中心")
                .date(now.plus(45, ChronoUnit.DAYS))
                .ticketPrice(480L).capacity(18_000).soldTickets(5_600)
                .status(Concert.ConcertStatus.SELLING).revenue(2_688_000L).build());
    }

    // ── platforms ───────────────────────────────────────────────────────────

    private void seedPlatforms() {
        if (platformRepo.count() > 0) return;
        platformRepo.saveAll(List.of(
                Platform.builder().id("tencent-music").name("腾讯音乐").icon("🎵")
                        .category(Platform.PlatformCategory.MUSIC)
                        .status(Platform.PlatformStatus.CONNECTED).followersCount(150_000L).build(),
                Platform.builder().id("netease-music").name("网易云音乐").icon("🎶")
                        .category(Platform.PlatformCategory.MUSIC)
                        .status(Platform.PlatformStatus.CONNECTED).followersCount(98_000L).build(),
                Platform.builder().id("douyin").name("抖音").icon("🎬")
                        .category(Platform.PlatformCategory.VIDEO)
                        .status(Platform.PlatformStatus.PENDING).followersCount(220_000L).build(),
                Platform.builder().id("bilibili").name("哔哩哔哩").icon("📺")
                        .category(Platform.PlatformCategory.VIDEO)
                        .status(Platform.PlatformStatus.DISCONNECTED).followersCount(45_000L).build()
        ));
    }

    // ── settings ────────────────────────────────────────────────────────────

    private void seedCreditPacks() {
        if (creditPackRepo.count() > 0) return;
        creditPackRepo.saveAll(List.of(
                CreditPack.builder().id("pack-starter")
                        .code(CreditPack.CreditPackTier.STARTER).name("新手包")
                        .credits(1_000L).priceCents(9_900L)
                        .highlights(List.of("1000 积分", "新手专享"))
                        .recommended(false)
                        .status(CreditPack.CreditPackStatus.ACTIVE).build(),
                CreditPack.builder().id("pack-standard")
                        .code(CreditPack.CreditPackTier.STANDARD).name("标准包")
                        .credits(5_000L).priceCents(39_900L)
                        .highlights(List.of("5000 积分", "无 AI 生成限流"))
                        .recommended(true)
                        .status(CreditPack.CreditPackStatus.ACTIVE).build(),
                CreditPack.builder().id("pack-pro")
                        .code(CreditPack.CreditPackTier.PRO).name("专业包")
                        .credits(15_000L).priceCents(99_900L)
                        .highlights(List.of("15000 积分", "专属客服", "优先发行队列"))
                        .recommended(false)
                        .status(CreditPack.CreditPackStatus.ACTIVE).build()
        ));
    }

    private void seedRechargeHistory(AepUser fan) {
        if (rechargeRepo.count() > 0 || fan == null) return;
        rechargeRepo.saveAll(List.of(
                RechargeRecord.builder().id("rc-1").userId(fan.getId())
                        .recordDate(LocalDate.now().minusDays(30))
                        .description("首次充值 · 新手包")
                        .source(RechargeRecord.RechargeSource.CREDIT_PACK)
                        .creditsAdded(1_000L).priceCents(9_900L).build(),
                RechargeRecord.builder().id("rc-2").userId(fan.getId())
                        .recordDate(LocalDate.now().minusDays(7))
                        .description("兑换激活码")
                        .source(RechargeRecord.RechargeSource.LICENSE_REDEEM)
                        .creditsAdded(500L).priceCents(0L).build()
        ));
    }

    // ── forge ───────────────────────────────────────────────────────────────

    private void seedForgeTemplates() {
        if (forgeTemplateRepo.count() > 0) return;
        forgeTemplateRepo.saveAll(List.of(
                ForgeTemplate.builder().id("tpl-cyber").name("赛博朋克 · 霓虹")
                        .image("").tags(List.of("cyberpunk", "neon")).style("cyberpunk").build(),
                ForgeTemplate.builder().id("tpl-sweet").name("甜美 · 日系少女")
                        .image("").tags(List.of("sweet", "jpop")).style("sweet").build(),
                ForgeTemplate.builder().id("tpl-cool").name("酷飒 · 街头")
                        .image("").tags(List.of("cool", "street")).style("cool").build()
        ));
    }

    // ── notifications ───────────────────────────────────────────────────────

    private void seedNotifications(Instant now, AepUser studio, AepUser fan) {
        if (notificationRepo.count() > 0) return;
        if (studio != null) {
            notificationRepo.saveAll(List.of(
                    Notification.builder().id(UUID.randomUUID().toString())
                            .userId(studio.getId()).type(Notification.NotificationType.REVENUE)
                            .title("月度结算到账").description("本月营收 ¥61,000 已到账")
                            .read(false).createdAt(now.minus(2, ChronoUnit.HOURS)).build(),
                    Notification.builder().id(UUID.randomUUID().toString())
                            .userId(studio.getId()).type(Notification.NotificationType.CONTENT)
                            .title("版权登记已通过").description("「Neon Heart 编舞」审核通过")
                            .read(false).createdAt(now.minus(1, ChronoUnit.DAYS)).build(),
                    Notification.builder().id(UUID.randomUUID().toString())
                            .userId(studio.getId()).type(Notification.NotificationType.FAN)
                            .title("新粉丝里程碑").description("Luna 突破 16 万粉丝")
                            .read(true).createdAt(now.minus(3, ChronoUnit.DAYS)).build()
            ));
        }
        if (fan != null) {
            notificationRepo.save(Notification.builder().id(UUID.randomUUID().toString())
                    .userId(fan.getId()).type(Notification.NotificationType.SYSTEM)
                    .title("欢迎加入").description("送你 500 积分新手大礼包")
                    .read(false).createdAt(now.minus(7, ChronoUnit.DAYS)).build());
        }
    }

    // ── wardrobe / pose / nft (legacy pkg) ───────────────────────────────────

    private void seedWardrobe() {
        if (wardrobeRepo.count() > 0) return;
        wardrobeRepo.saveAll(List.of(
                WardrobeItem.builder().id("cloth-1").nameZh("星空外套").nameEn("Galaxy Jacket")
                        .category("top").imageUrl("").rarity("epic").price(2_800)
                        .tags(List.of("cyberpunk", "neon")).locked(false).newItem(true).trending(true)
                        .priceCredits(0).saleStatus(WardrobeItem.SaleStatus.FREE)
                        .previewUrl("").build(),
                WardrobeItem.builder().id("cloth-2").nameZh("银河长裙").nameEn("Milky Dress")
                        .category("bottom").imageUrl("").rarity("rare").price(1_600)
                        .tags(List.of("elegant")).locked(false).newItem(false).trending(false)
                        .priceCredits(200).saleStatus(WardrobeItem.SaleStatus.PAID)
                        .previewUrl("").build(),
                WardrobeItem.builder().id("cloth-3").nameZh("机械耳饰").nameEn("Mech Earring")
                        .category("accessory").imageUrl("").rarity("legendary").price(4_500)
                        .tags(List.of("cyber", "accessory")).locked(true).newItem(false).trending(true)
                        .priceCredits(500).saleStatus(WardrobeItem.SaleStatus.PAID)
                        .previewUrl("").build(),
                WardrobeItem.builder().id("cloth-4").nameZh("霓虹球鞋").nameEn("Neon Sneakers")
                        .category("shoes").imageUrl("").rarity("rare").price(1_200)
                        .tags(List.of("street", "neon")).locked(false).newItem(true).trending(false)
                        .priceCredits(150).saleStatus(WardrobeItem.SaleStatus.PAID)
                        .previewUrl("").build()
        ));
    }

    private void seedPoseLibrary() {
        if (poseRepo.count() == 0) {
            poseRepo.saveAll(List.of(
                    Pose.builder().id("pose-1").nameZh("舞台 C 位").nameEn("Center Stage")
                            .category("standing").thumbnail("").difficulty("medium")
                            .locked(false).newItem(true)
                            .priceCredits(0).saleStatus(WardrobeItem.SaleStatus.FREE).build(),
                    Pose.builder().id("pose-2").nameZh("旋转三连").nameEn("Triple Spin")
                            .category("dancing").thumbnail("").difficulty("hard")
                            .locked(false).newItem(false)
                            .priceCredits(300).saleStatus(WardrobeItem.SaleStatus.PAID).build(),
                    Pose.builder().id("pose-3").nameZh("麦霸握话筒").nameEn("Mic Grip")
                            .category("singing").thumbnail("").difficulty("easy")
                            .locked(false).newItem(false)
                            .priceCredits(0).saleStatus(WardrobeItem.SaleStatus.FREE).build()
            ));
        }
        if (expressionRepo.count() == 0) {
            expressionRepo.saveAll(List.of(
                    Expression.builder().id("exp-1").nameZh("灿烂笑").nameEn("Big Smile")
                            .emoji("😄").intensity(85).category("happy")
                            .priceCredits(0).saleStatus(WardrobeItem.SaleStatus.FREE).build(),
                    Expression.builder().id("exp-2").nameZh("酷峻冷漠").nameEn("Cold Stare")
                            .emoji("😎").intensity(70).category("cool")
                            .priceCredits(100).saleStatus(WardrobeItem.SaleStatus.PAID).build(),
                    Expression.builder().id("exp-3").nameZh("惊喜").nameEn("Surprised")
                            .emoji("😲").intensity(60).category("surprised")
                            .priceCredits(0).saleStatus(WardrobeItem.SaleStatus.FREE).build()
            ));
        }
        if (gestureRepo.count() == 0) {
            gestureRepo.saveAll(List.of(
                    Gesture.builder().id("ges-1").nameZh("挥手致意").nameEn("Wave")
                            .icon("👋").category("greeting")
                            .priceCredits(0).saleStatus(WardrobeItem.SaleStatus.FREE).build(),
                    Gesture.builder().id("ges-2").nameZh("比心").nameEn("Heart Sign")
                            .icon("🫶").category("love")
                            .priceCredits(120).saleStatus(WardrobeItem.SaleStatus.PAID).build(),
                    Gesture.builder().id("ges-3").nameZh("rock").nameEn("Rock")
                            .icon("🤘").category("energy")
                            .priceCredits(0).saleStatus(WardrobeItem.SaleStatus.FREE).build()
            ));
        }
    }

    private void seedNftCollections() {
        if (nftRepo.count() > 0) return;
        nftRepo.saveAll(List.of(
                NftCollection.builder().id("nft-1").name("Luna · 首张专辑纪念卡")
                        .coverUrl("").priceLabel("0.05 ETH").remaining(120)
                        .rarity("rare").trackId("song-1").build(),
                NftCollection.builder().id("nft-2").name("Nova X · 出道限定")
                        .coverUrl("").priceLabel("0.12 ETH").remaining(30)
                        .rarity("legendary").trackId("song-2").build()
        ));
    }

    // ── digital-ips + revenue seed ──────────────────────────────────────────

    private void seedDigitalIps(Instant now, AepUser studio) {
        if (ipRepo.count() > 0 || studio == null) return;
        ipRepo.saveAll(List.of(
                DigitalIp.builder().id("ip-luna")
                        .name("Luna").kind(DigitalIp.DigitalIpKind.SINGER)
                        .quality(DigitalIp.Quality.EPIC)
                        .status(DigitalIp.DigitalIpStatus.ACTIVE)
                        .level(18).exp(4_200).maxExp(5_000).avatarUrl("")
                        .talentSinging(88).talentActing(40).talentDancing(60)
                        .talentHosting(30).talentComedy(20).talentVariety(35)
                        .statSongs(12).statDramas(1).statAds(3).statVariety(5)
                        .statFans(162_000L).statRevenueCredits(480_000L)
                        .statMonthlyRevenueCredits(61_000L).statPopularity(82)
                        .statEndorsements(3).statCommercialValueCredits(3_200_000L)
                        .bio("星光工作室旗下主打歌手").domains(List.of("music"))
                        .ownerUserId(studio.getId())
                        .createdAt(now.minus(180, ChronoUnit.DAYS)).updatedAt(now).build(),
                DigitalIp.builder().id("ip-novax")
                        .name("Nova X").kind(DigitalIp.DigitalIpKind.IDOL)
                        .quality(DigitalIp.Quality.LEGENDARY)
                        .status(DigitalIp.DigitalIpStatus.ACTIVE)
                        .level(25).exp(9_600).maxExp(12_000).avatarUrl("")
                        .talentSinging(75).talentActing(70).talentDancing(92)
                        .talentHosting(65).talentComedy(50).talentVariety(80)
                        .statSongs(24).statDramas(3).statAds(8).statVariety(12)
                        .statFans(320_000L).statRevenueCredits(720_000L)
                        .statMonthlyRevenueCredits(88_000L).statPopularity(94)
                        .statEndorsements(6).statCommercialValueCredits(7_500_000L)
                        .bio("全能型顶流偶像").domains(List.of("music", "drama", "ad"))
                        .ownerUserId(studio.getId())
                        .createdAt(now.minus(300, ChronoUnit.DAYS)).updatedAt(now).build(),
                DigitalIp.builder().id("ip-pixel")
                        .name("Pixel Dream").kind(DigitalIp.DigitalIpKind.DANCER)
                        .quality(DigitalIp.Quality.RARE)
                        .status(DigitalIp.DigitalIpStatus.DEBUT)
                        .level(6).exp(800).maxExp(1_500).avatarUrl("")
                        .talentSinging(45).talentActing(35).talentDancing(85)
                        .talentHosting(20).talentComedy(30).talentVariety(40)
                        .statSongs(2).statDramas(0).statAds(1).statVariety(2)
                        .statFans(38_000L).statRevenueCredits(42_000L)
                        .statMonthlyRevenueCredits(12_000L).statPopularity(58)
                        .statEndorsements(1).statCommercialValueCredits(320_000L)
                        .bio("新人舞者，专攻编舞与 MV").domains(List.of("music"))
                        .ownerUserId(studio.getId())
                        .createdAt(now.minus(60, ChronoUnit.DAYS)).updatedAt(now).build()
        ));
    }

    private void seedRevenueLedger(Instant now, AepUser studio) {
        if (studio == null) return;
        Wallet w = walletRepo.findByUserId(studio.getId()).orElse(null);
        if (w == null) return;
        long existing = ledgerRepo.findByUserId(studio.getId(),
                org.springframework.data.domain.PageRequest.of(0, 2)).getTotalElements();
        if (existing >= 3) return;

        String[] refTypes = {"streaming", "endorsement", "nft", "live"};
        long bal = w.getTotalBalance();
        for (int month = 10; month >= 0; month--) {
            for (int i = 0; i < 4; i++) {
                long amount = 8_000L + (long)(Math.random() * 15_000);
                bal += amount;
                ledgerRepo.save(LedgerEntry.builder()
                        .id(UUID.randomUUID().toString())
                        .walletId(w.getId())
                        .userId(studio.getId())
                        .entryType(LedgerEntry.LedgerEntryType.INCOME)
                        .amount(amount).balanceAfter(bal)
                        .description("月度结算 · " + refTypes[i])
                        .referenceType(refTypes[i])
                        .createdAt(now.minus(month * 30L + i, ChronoUnit.DAYS))
                        .build());
            }
        }
        w.setTotalBalance(bal);
        w.setRechargeBalance(bal - w.getLicenseBalance());
        walletRepo.save(w);
    }

    // ── new tables (this PR) ────────────────────────────────────────────────

    private void seedSavedOutfits(AepUser studio) {
        if (savedOutfitRepo.count() > 0 || studio == null) return;
        savedOutfitRepo.save(SavedOutfit.builder()
                .id(UUID.randomUUID().toString())
                .userId(studio.getId())
                .name("Luna · 舞台造型")
                .createdAt(Instant.now())
                .slotsJson(new java.util.LinkedHashMap<>(Map.of(
                        "top", "cloth-1",
                        "bottom", "cloth-2",
                        "accessory", "cloth-3",
                        "shoes", "cloth-4"
                )))
                .build());
    }

    private void seedBlueprints(Instant now, AepUser studio) {
        if (blueprintRepo.count() > 0 || studio == null) return;
        blueprintRepo.save(ForgeBlueprint.builder()
                .id(UUID.randomUUID().toString())
                .artistId("ip-luna")
                .resultId("seed-result-1")
                .createdAt(now)
                .snapshotJson(new java.util.LinkedHashMap<>(Map.of(
                        "templateId", "tpl-sweet",
                        "mode", "template_prompt",
                        "locked", List.of("eyes", "hair")
                )))
                .build());
    }

    private void seedCreditPurchases(Instant now, AepUser fan) {
        if (purchaseRepo.count() > 0 || fan == null) return;
        purchaseRepo.save(CreditPurchase.builder()
                .id(UUID.randomUUID().toString())
                .userId(fan.getId())
                .packId("pack-starter")
                .priceCents(9_900L)
                .creditsAdded(1_000L)
                .createdAt(now.minus(30, ChronoUnit.DAYS))
                .paymentMetaJson(new java.util.LinkedHashMap<>(Map.of(
                        "channel", "alipay",
                        "orderId", "SEED-ORDER-0001"
                )))
                .build());
    }

    private void seedPlatformConnections(Instant now, AepUser studio) {
        if (platformConnRepo.count() > 0 || studio == null) return;
        platformConnRepo.save(PlatformConnection.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(studio.getId())
                .userId(studio.getId())
                .platformId("tencent-music")
                .status(PlatformConnection.ConnectionStatus.CONNECTED)
                .connectedAt(now.minus(5, ChronoUnit.DAYS))
                .credentialsJson(new java.util.LinkedHashMap<>(Map.of(
                        "accountName", "starlight-official"
                )))
                .build());
    }

    private void seedCommunityPosts(Instant now, AepUser studio) {
        if (postRepo.count() > 0 || studio == null) return;
        postRepo.saveAll(List.of(
                CommunityPost.builder().id(UUID.randomUUID().toString())
                        .userId(studio.getId()).artistId("ip-luna")
                        .content("Luna 新单《Starlight Drift》今晚 20:00 全平台首发")
                        .mediaUrls(List.of()).createdAt(now.minus(2, ChronoUnit.HOURS)).build(),
                CommunityPost.builder().id(UUID.randomUUID().toString())
                        .userId(studio.getId()).artistId("ip-novax")
                        .content("Nova X 生日应援开启，参与抽限定周边🎉")
                        .mediaUrls(List.of()).createdAt(now.minus(1, ChronoUnit.DAYS)).build()
        ));
    }

    private void seedEventRsvps(Instant now, AepUser fan) {
        if (rsvpRepo.count() > 0 || fan == null) return;
        rsvpRepo.save(EventRsvp.builder()
                .eventId("ev-2").userId(fan.getId())
                .createdAt(now.minus(1, ChronoUnit.HOURS))
                .build());
    }

    // ── platform_configs 种子（孵化向导 + 锻造炉选项） ───────────────────────

    private void seedPlatformConfigs() {
        seedJson("incubation.faceStyles", "孵化向导 · 面部风格选项",
                """
                [
                  {"id":"sweet","zh":"甜美","en":"Sweet"},
                  {"id":"cool","zh":"酷帅","en":"Cool"},
                  {"id":"elegant","zh":"优雅","en":"Elegant"},
                  {"id":"cute","zh":"可爱","en":"Cute"},
                  {"id":"sharp","zh":"凌厉","en":"Sharp"},
                  {"id":"soft","zh":"温柔","en":"Soft"}
                ]
                """);

        seedJson("incubation.fashionStyles", "孵化向导 · 服装风格选项",
                """
                [
                  {"id":"modern","zh":"现代潮流","en":"Modern"},
                  {"id":"retro","zh":"复古","en":"Retro"},
                  {"id":"cyberpunk","zh":"赛博朋克","en":"Cyberpunk"},
                  {"id":"casual","zh":"休闲","en":"Casual"},
                  {"id":"formal","zh":"正式","en":"Formal"},
                  {"id":"sporty","zh":"运动","en":"Sporty"}
                ]
                """);

        seedJson("incubation.templates", "孵化向导 · 一键模版",
                """
                [
                  {"id":"cute","type":"idol","zh":"甜美偶像","en":"Cute Idol","color":"border-pink-500/30 hover:border-pink-400/60"},
                  {"id":"cool","type":"singer","zh":"酷炫歌手","en":"Cool Singer","color":"border-cyan-500/30 hover:border-cyan-400/60"},
                  {"id":"elegant","type":"actor","zh":"优雅演员","en":"Elegant Actor","color":"border-purple-500/30 hover:border-purple-400/60"},
                  {"id":"energetic","type":"entertainer","zh":"活力综艺","en":"Energetic Host","color":"border-amber-500/30 hover:border-amber-400/60"},
                  {"id":"mysterious","type":"dancer","zh":"神秘舞者","en":"Mysterious Dancer","color":"border-green-500/30 hover:border-green-400/60"},
                  {"id":"custom","type":"singer","zh":"自定义","en":"Custom","color":"border-white/10 hover:border-white/30"}
                ]
                """);

        seedJson("forge.hairStyles", "锻造炉 · 发型选项（LabeledOption）",
                """
                [
                  {"id":"long-straight","label":"长直发","color":null},
                  {"id":"short-bob","label":"波波头","color":null},
                  {"id":"ponytail","label":"马尾","color":null},
                  {"id":"curly","label":"卷发","color":null},
                  {"id":"undercut","label":"侧剃","color":null}
                ]
                """);

        seedJson("forge.eyeColors", "锻造炉 · 瞳色选项（LabeledOption + color hex）",
                """
                [
                  {"id":"amber","label":"琥珀","color":"#f59e0b"},
                  {"id":"azure","label":"天蓝","color":"#06b6d4"},
                  {"id":"emerald","label":"翡翠","color":"#10b981"},
                  {"id":"violet","label":"紫罗兰","color":"#a855f7"},
                  {"id":"ruby","label":"红宝石","color":"#ef4444"}
                ]
                """);

        seedJson("forge.styleTags", "锻造炉 · 风格标签",
                """
                [
                  {"id":"cyberpunk","label":"赛博朋克","color":null},
                  {"id":"gothic","label":"哥特","color":null},
                  {"id":"holo","label":"全息","color":null},
                  {"id":"streetwear","label":"街头","color":null},
                  {"id":"ethereal","label":"空灵","color":null}
                ]
                """);

        seedJson("forge.faceSliders", "锻造炉 · 面部微调滑块（0-100）",
                """
                [
                  {"id":"eyeSize","label":"眼睛大小"},
                  {"id":"noseHeight","label":"鼻梁高度"},
                  {"id":"lipThickness","label":"唇厚度"},
                  {"id":"faceWidth","label":"脸型宽度"},
                  {"id":"chinSharpness","label":"下颌锐利度"}
                ]
                """);

        seedJson("forge.colorSchemes", "锻造炉 · 主题配色",
                """
                [
                  {"id":"neon-sunset","name":"霓虹日落","colors":["#f472b6","#f59e0b"]},
                  {"id":"cyber-rain","name":"赛博雨","colors":["#06b6d4","#a855f7"]},
                  {"id":"forest-mist","name":"雾林","colors":["#10b981","#06b6d4"]},
                  {"id":"midnight","name":"午夜","colors":["#1e293b","#a855f7"]}
                ]
                """);

        seedJson("forge.promptSuggestions", "锻造炉 · 指令输入框推荐标签（string[]）",
                """
                [
                  "cyberpunk neon portrait",
                  "soft pastel anime style",
                  "hyperrealistic fashion shoot",
                  "ethereal holographic glow",
                  "street style candid photo"
                ]
                """);
    }

    private void seedJson(String key, String description, String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            configService.seedIfAbsent(key, node, description);
        } catch (Exception e) {
            // seed 失败不阻断启动；日志留给 Spring
            throw new RuntimeException("seed platform_config " + key + " failed", e);
        }
    }
}
