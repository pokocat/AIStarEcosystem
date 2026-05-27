package com.aistareco.aep.config;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * 明星专区 + 商品库 seed 数据。独立 runner，避免与 DataInitializer 的 @Order(1) 互相耦合。
 * Idempotent：当 celebrity_stars 表已有数据时跳过。
 *
 * 字段对齐前端 mocks (apps/web/src/mocks/celebrity-zone.ts, products.ts)。
 */
@Component
@Order(2)
@ConditionalOnProperty(name = "aep.seed.dev-data.enabled", havingValue = "true", matchIfMissing = true)
public class CelebrityZoneDataInitializer implements CommandLineRunner {

    private static final ObjectMapper OM = new ObjectMapper();

    private final CelebrityStarRepository starRepo;
    private final CelebrityProjectRepository projectRepo;
    private final CelebrityProjectVideoRepository videoRepo;
    private final CelebrityTemplateRepository templateRepo;
    private final CelebrityShowcaseRepository showcaseRepo;
    private final ProductRepository productRepo;
    private final CelebrityStarAuthorizationRepository authRepo;
    private final RechargePackageRepository pkgRepo;
    private final com.aistareco.aep.repository.TemplateScriptRepository scriptRepo;
    private final com.aistareco.aep.repository.NotificationRepository notificationRepo;

    public CelebrityZoneDataInitializer(CelebrityStarRepository starRepo,
                                         CelebrityProjectRepository projectRepo,
                                         CelebrityProjectVideoRepository videoRepo,
                                         CelebrityTemplateRepository templateRepo,
                                         CelebrityShowcaseRepository showcaseRepo,
                                         ProductRepository productRepo,
                                         CelebrityStarAuthorizationRepository authRepo,
                                         RechargePackageRepository pkgRepo,
                                         com.aistareco.aep.repository.TemplateScriptRepository scriptRepo,
                                         com.aistareco.aep.repository.NotificationRepository notificationRepo) {
        this.starRepo = starRepo;
        this.projectRepo = projectRepo;
        this.videoRepo = videoRepo;
        this.templateRepo = templateRepo;
        this.showcaseRepo = showcaseRepo;
        this.productRepo = productRepo;
        this.authRepo = authRepo;
        this.pkgRepo = pkgRepo;
        this.scriptRepo = scriptRepo;
        this.notificationRepo = notificationRepo;
    }

    @Override
    public void run(String... args) {
        seedRechargePackages();

        if (starRepo.count() > 0) return;

        LocalDate today = LocalDate.now();

        // ── Stars (3 个 demo 明星) ────────────────────────────────────────────
        CelebrityStar s1 = buildStar(
                "star-li-dan", "李诞", "演员", true,
                "脱口秀厂牌创始人，善于将商品融入轻松幽默的语境。",
                "¥299起", "标准版", 12, 50,
                authorization("authorized", List.of("带货", "种草"), today.plusMonths(6).toString(), 5, null, null),
                stats(48, "12.4M", "8.2%", "¥1.8M"),
                List.of(
                        Map.of("id", "sv1", "label", "口红种草", "category", "美妆", "thumb", placeholderThumb(1), "videoUrl", placeholderVideo(1)),
                        Map.of("id", "sv2", "label", "气泡水开箱", "category", "食品饮料", "thumb", placeholderThumb(2), "videoUrl", placeholderVideo(2))
                ),
                pricingTiers()
        );
        attachV04(s1,
                "脱口秀厂牌创始人，长期作为脱口秀大会评委 / 主持出现，公众形象偏理性轻松，深度参与多个食品/美妆品牌代言。粉丝以 25-40 岁城市白领为主。",
                "上海 / 北京",
                8_240_000L, 32, 4820L,
                List.of(
                        photoMap("p1", placeholderThumb(101), "形象照 · 演播厅"),
                        photoMap("p2", placeholderThumb(102), "形象照 · 户外"),
                        photoMap("p3", placeholderThumb(103), "活动现场"),
                        photoMap("p4", placeholderThumb(104), "代言海报 · 坚果"),
                        photoMap("p5", placeholderThumb(105), "代言海报 · 速食"),
                        photoMap("p6", placeholderThumb(106), "节目剧照")
                ),
                List.of(
                        videoMap("v1", "代言案例 · 每日坚果", 30, placeholderThumb(111), placeholderVideo(111), "代言"),
                        videoMap("v2", "节目片段 · 试吃测评", 45, placeholderThumb(112), placeholderVideo(112), "综艺"),
                        videoMap("v3", "形象介绍片", 20, placeholderThumb(113), placeholderVideo(113), "介绍")
                )
        );
        starRepo.save(s1);

        CelebrityStar s2 = buildStar(
                "star-yi-nengjing", "伊能静", "歌手", true,
                "气质温婉的资深艺人，适合美妆 / 母婴品类的温情种草。",
                "¥499起", "标准版", 8, 30,
                authorization("authorized", List.of("带货", "种草", "测评"), today.plusMonths(3).toString(), 4, null, null),
                stats(32, "8.7M", "9.5%", "¥2.3M"),
                List.of(
                        Map.of("id", "sv1", "label", "母婴推荐", "category", "母婴", "thumb", placeholderThumb(3), "videoUrl", placeholderVideo(3))
                ),
                pricingTiers()
        );
        attachV04(s2,
                "气质温婉的资深艺人，演员 / 歌手 / 综艺三栖，长期活跃于美妆 / 母婴品类种草。粉丝画像以 30-45 女性为主。",
                "台北 / 上海",
                12_400_000L, 18, 6210L,
                List.of(
                        photoMap("p1", placeholderThumb(201), "形象照 · 时尚大片"),
                        photoMap("p2", placeholderThumb(202), "代言海报 · 美妆"),
                        photoMap("p3", placeholderThumb(203), "代言海报 · 母婴"),
                        photoMap("p4", placeholderThumb(204), "活动现场")
                ),
                List.of(
                        videoMap("v1", "代言案例 · 玻尿酸面膜", 60, placeholderThumb(211), placeholderVideo(211), "代言"),
                        videoMap("v2", "形象介绍片", 25, placeholderThumb(212), placeholderVideo(212), "介绍")
                )
        );
        starRepo.save(s2);

        CelebrityStar s3 = buildStar(
                "star-shen-teng", "沈腾", "演员", false,
                "喜剧风格突出，适合搞笑类轻量植入。当前未对您授权，可申请。",
                "¥899起", null, null, null,
                authorization("unauthorized", List.of(), null, 6, null, "/producer/celebrity-zone/star/star-shen-teng/apply"),
                stats(0, "—", "—", "—"),
                List.of(),
                pricingTiers()
        );
        attachV04(s3,
                "喜剧风格突出，电影 / 综艺双栖；适合食品 / 日用 / 服饰品类的轻量植入。",
                "北京",
                25_300_000L, 9, 7450L,
                List.of(
                        photoMap("p1", placeholderThumb(301), "形象照"),
                        photoMap("p2", placeholderThumb(302), "电影剧照"),
                        photoMap("p3", placeholderThumb(303), "综艺片段")
                ),
                List.of(
                        videoMap("v1", "形象介绍片", 30, placeholderThumb(311), placeholderVideo(311), "介绍")
                )
        );
        starRepo.save(s3);

        // ── 授权关系（v0.4 新增表）─────────────────────────────────────────
        // demo-user × 李诞：authorized
        authRepo.save(buildAuth("auth-demo-li", "demo-user", "star-li-dan",
                CelebrityAuthStatus.AUTHORIZED, List.of("带货", "种草"),
                today.plusMonths(6), 5, null, null));
        // demo-user × 伊能静：authorized
        authRepo.save(buildAuth("auth-demo-yi", "demo-user", "star-yi-nengjing",
                CelebrityAuthStatus.AUTHORIZED, List.of("带货", "种草", "测评"),
                today.plusMonths(3), 4, null, null));
        // demo-user × 沈腾：pending（审核中，48h SLA）
        authRepo.save(buildAuth("auth-demo-shen", "demo-user", "star-shen-teng",
                CelebrityAuthStatus.PENDING, List.of(),
                null, 0, "经纪团队复核中（48h SLA）", null));

        // ── Projects (李诞 名下 2 个项目) ────────────────────────────────────
        projectRepo.save(buildProject("proj-001", "Q3 新品种草季", "star-li-dan", "李诞",
                "https://i.pravatar.cc/200?img=12", "进行中", 6,
                "3.2M", "180K", 420, "¥320K", today.minusDays(20),
                "标准版", 6, 50, "demo-user"));

        projectRepo.save(buildProject("proj-002", "双 11 大促", "star-li-dan", "李诞",
                "https://i.pravatar.cc/200?img=12", "筹备中", 0,
                "—", "—", 0, "—", today.minusDays(3),
                "标准版", 0, 50, "demo-user"));

        // ── Project videos ──────────────────────────────────────────────────
        videoRepo.save(buildVideo("vid-001", "proj-001", "Q3 新品种草季",
                "star-li-dan", "李诞", "玻尿酸口红",
                "已发布", "1.2M", 30, "HiGen",
                placeholderThumb(11), placeholderVideo(11), today.minusDays(15)));

        videoRepo.save(buildVideo("vid-002", "proj-001", "Q3 新品种草季",
                "star-li-dan", "李诞", "葡萄气泡苏打",
                "已发布", "850K", 15, "KeLing",
                placeholderThumb(12), placeholderVideo(12), today.minusDays(12)));

        videoRepo.save(buildVideo("vid-003", "proj-001", "Q3 新品种草季",
                "star-li-dan", "李诞", "压缩长袖速干衣",
                "生成中", null, 30, "MiniMax",
                placeholderThumb(13), placeholderVideo(13), today.minusDays(1)));

        // ── Templates (5 个) ─────────────────────────────────────────────────
        templateRepo.save(attachTplV04(buildTemplate("tpl-001", "种草日常 Vlog", "种草安利",
                "轻松日常感，自然推荐商品。",
                "HiGen", "标准", true, "120K", "8.2%",
                "适合美妆 / 食品类",
                List.of(Map.of("thumb", placeholderThumb(21), "videoUrl", placeholderVideo(21)))),
                placeholderThumb(21), placeholderVideo(21), 30));

        templateRepo.save(attachTplV04(buildTemplate("tpl-002", "硬核测评", "硬核测评",
                "专业拆解 + 数据对比，理性人群转化高。",
                "MiniMax", "高级", true, "98K", "11.5%",
                "适合数码 3C / 家电",
                List.of(Map.of("thumb", placeholderThumb(22), "videoUrl", placeholderVideo(22)))),
                placeholderThumb(22), placeholderVideo(22), 60));

        templateRepo.save(attachTplV04(buildTemplate("tpl-003", "轻松开箱", "轻松开箱",
                "节奏明快，画面色彩鲜艳。",
                "HiGen", "标准", false, "76K", "7.0%",
                "适合服饰 / 日用百货",
                List.of(Map.of("thumb", placeholderThumb(23), "videoUrl", placeholderVideo(23)))),
                placeholderThumb(23), placeholderVideo(23), 30));

        templateRepo.save(attachTplV04(buildTemplate("tpl-004", "直播切片精选", "直播切片",
                "模拟直播带货切片，互动感强。",
                "KeLing", "经济", false, "55K", "5.8%",
                "适合食品饮料 / 服饰",
                List.of(Map.of("thumb", placeholderThumb(24), "videoUrl", placeholderVideo(24)))),
                placeholderThumb(24), placeholderVideo(24), 15));

        templateRepo.save(attachTplV04(buildTemplate("tpl-005", "剧情植入短片", "剧情植入",
                "轻剧情包装商品，适合品牌故事。",
                "MiniMax", "高级", false, "42K", "9.1%",
                "适合各品类",
                List.of(Map.of("thumb", placeholderThumb(25), "videoUrl", placeholderVideo(25)))),
                placeholderThumb(25), placeholderVideo(25), 60));

        // ── v0.5：TemplateScript seeds（每个模板 1 份 published 草稿） ────────
        // 移到 v0.5 Initializer 子方法 seedTemplateScripts() 中保持本方法可读
        seedTemplateScripts();
        // v0.5.2：Bot 消息已从"事件 + Notification 表"改为"按需查询用户业务态合成"，
        // 不再需要 seed botId notification。dot 改由 UserBotReadState.lastReadAt + freshness 计算。

        // ── Showcases (template + blindbox 各 3) ────────────────────────────
        for (int i = 1; i <= 3; i++) {
            showcaseRepo.save(buildShowcase("sc-tpl-" + i,
                    "模板案例 #" + i, "HiGen", (200 - i * 20) + "K", "98%",
                    placeholderThumb(30 + i), placeholderVideo(30 + i), "template"));
        }
        for (int i = 1; i <= 3; i++) {
            showcaseRepo.save(buildShowcase("sc-blind-" + i,
                    "盲盒案例 #" + i, "MiniMax", (180 - i * 20) + "K", "95%",
                    placeholderThumb(40 + i), placeholderVideo(40 + i), "blindbox"));
        }

        // ── Products (8 个 demo 商品) ───────────────────────────────────────
        seedProduct("prod-001", "玻尿酸口红 #镜面红", "美妆", "https://example.com/p/lip-001",
                List.of(placeholderThumb(50)),
                "保湿持久不拔干，镜面光泽显白。",
                today);
        seedProduct("prod-002", "葡萄气泡苏打 330ml", "食品饮料", "https://example.com/p/soda-001",
                List.of(placeholderThumb(51)),
                "0 糖 0 卡，葡萄真果汁，气泡细腻。",
                today);
        seedProduct("prod-003", "压缩长袖速干衣", "服饰", "https://example.com/p/cloth-001",
                List.of(placeholderThumb(52)),
                "8 倍压缩出行收纳，速干透气。",
                today);
        seedProduct("prod-004", "降噪入耳式蓝牙耳机", "数码 3C", "https://example.com/p/buds-001",
                List.of(placeholderThumb(53)),
                "AI 主动降噪 35dB，30 小时续航。",
                today);
        seedProduct("prod-005", "深层清洁泥膜", "美妆", null,
                List.of(placeholderThumb(54)),
                "矿物泥 + 透明质酸，清洁不紧绷。",
                today);
        seedProduct("prod-006", "母婴恒温奶瓶", "母婴", "https://example.com/p/bottle-001",
                List.of(placeholderThumb(55)),
                "60 秒恒温，PPSU 防爆抗摔。",
                today);
        seedProduct("prod-007", "运动电解质水 500ml", "运动", "https://example.com/p/sport-001",
                List.of(placeholderThumb(56)),
                "运动后 1 瓶补水，0 糖配方。",
                today);
        seedProduct("prod-008", "厨房纸巾 6 卷装", "日用百货", null,
                List.of(placeholderThumb(57)),
                "加厚不掉屑，吸油吸水。",
                today);
    }

    // ── builders ────────────────────────────────────────────────────────────
    private CelebrityStar buildStar(String id, String name, String category, boolean isHot,
                                     String desc, String startingPrice,
                                     String pricingTier, Integer quotaUsed, Integer quotaTotal,
                                     Map<String, Object> auth,
                                     Map<String, Object> stats,
                                     List<Map<String, Object>> sampleVideos,
                                     List<Map<String, Object>> pricing) {
        return CelebrityStar.builder()
                .id(id).name(name)
                .avatar("https://i.pravatar.cc/200?u=" + id)
                .cover("https://picsum.photos/seed/" + id + "/600/800")
                .category(category)
                .subCategories(new ArrayList<>())
                .isHot(isHot)
                .description(desc)
                .startingPrice(startingPrice)
                .pricingTier(pricingTier)
                .quotaUsed(quotaUsed)
                .quotaTotal(quotaTotal)
                .authorizationJson(toJson(auth))
                .statsJson(toJson(stats))
                .sampleVideosJson(toJson(sampleVideos))
                .pricingJson(toJson(pricing))
                .build();
    }

    private CelebrityProject buildProject(String id, String name, String starId, String starName,
                                           String starAvatar, String status, int videoCount,
                                           String totalPlays, String totalInteractions, int conversions,
                                           String gmv, LocalDate createdAt, String pricingTier,
                                           int quotaUsed, int quotaTotal, String ownerUserId) {
        return CelebrityProject.builder()
                .id(id).name(name)
                .starId(starId).starName(starName).starAvatar(starAvatar)
                .status(status).videoCount(videoCount)
                .totalPlays(totalPlays).totalInteractions(totalInteractions)
                .conversions(conversions).gmv(gmv).createdAt(createdAt)
                .pricingTier(pricingTier)
                .channelsJson(toJson(List.of(
                        Map.of("id", "ch-douyin", "name", "抖音", "connected", true, "publishedCount", 4),
                        Map.of("id", "ch-xhs", "name", "小红书", "connected", true, "publishedCount", 2)
                )))
                .quotaUsed(quotaUsed).quotaTotal(quotaTotal)
                .ownerUserId(ownerUserId)
                .build();
    }

    private CelebrityProjectVideo buildVideo(String id, String projectId, String projectName,
                                              String starId, String starName, String productName,
                                              String status, String plays, int durationSec,
                                              String engine, String thumb, String videoUrl,
                                              LocalDate createdAt) {
        return CelebrityProjectVideo.builder()
                .id(id).projectId(projectId).projectName(projectName)
                .starId(starId).starName(starName).productName(productName)
                .status(status).plays(plays).durationSec(durationSec)
                .engine(engine).thumb(thumb).videoUrl(videoUrl)
                .createdAt(createdAt)
                .build();
    }

    private CelebrityTemplate buildTemplate(String id, String name, String style, String desc,
                                             String engine, String price, boolean isHot,
                                             String plays, String conversionRate, String fitHint,
                                             List<Map<String, Object>> previews) {
        return CelebrityTemplate.builder()
                .id(id).name(name).style(style).description(desc)
                .recommendedEngine(engine).recommendedPrice(price)
                .isHot(isHot).plays(plays).conversionRate(conversionRate)
                .fitHint(fitHint).previewsJson(toJson(previews))
                .build();
    }

    private CelebrityShowcase buildShowcase(String id, String caption, String engine,
                                             String plays, String approval,
                                             String thumb, String videoUrl, String mode) {
        return CelebrityShowcase.builder()
                .id(id).caption(caption).engine(engine).plays(plays)
                .approval(approval).thumb(thumb).videoUrl(videoUrl).mode(mode)
                .build();
    }

    private void seedProduct(String id, String name, String category, String link,
                              List<String> images, String sellingPoints, LocalDate today) {
        productRepo.save(Product.builder()
                .id(id).name(name).category(category).link(link)
                .images(new ArrayList<>(images))
                .sellingPoints(sellingPoints)
                .usageCount(0).source("manual")
                .createdAt(today).updatedAt(today)
                .build());
    }

    // ── nested helpers ──────────────────────────────────────────────────────
    private static Map<String, Object> authorization(String status, List<String> scenes,
                                                      String expireDate, int availableStyles,
                                                      String pendingNote, String applyUrl) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", status);
        m.put("scenes", scenes);
        if (expireDate != null) m.put("expireDate", expireDate);
        m.put("availableStyles", availableStyles);
        if (pendingNote != null) m.put("pendingNote", pendingNote);
        if (applyUrl != null) m.put("applyUrl", applyUrl);
        return m;
    }

    private static Map<String, Object> stats(int totalGenerated, String totalPlays,
                                              String conversionRate, String gmv) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalGenerated", totalGenerated);
        m.put("totalPlays", totalPlays);
        m.put("conversionRate", conversionRate);
        m.put("gmv", gmv);
        return m;
    }

    private static List<Map<String, Object>> pricingTiers() {
        return List.of(
                Map.of("id", "tier-trial", "name", "体验版", "price", "¥299/条",
                        "features", List.of("单次出片", "标准引擎", "无快速通道"),
                        "recommended", false),
                Map.of("id", "tier-std", "name", "标准版", "price", "¥1,999/月",
                        "features", List.of("月配额 50 条", "高级引擎", "次日出片", "数据看板"),
                        "recommended", true),
                Map.of("id", "tier-flag", "name", "旗舰版", "price", "¥9,999/月",
                        "features", List.of("月配额 300 条", "全引擎", "优先排队", "1 对 1 客服", "定制风格"),
                        "recommended", false)
        );
    }

    private static String placeholderThumb(int seed) {
        return "https://picsum.photos/seed/cz-" + seed + "/360/640";
    }

    private static String placeholderVideo(int seed) {
        // Pexels portrait demo（playable mp4）。生产替换为 AI 静态资源。
        return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4#cz-" + seed;
    }

    private static String toJson(Object value) {
        try {
            return OM.writeValueAsString(value);
        } catch (Exception e) {
            return "[]";
        }
    }

    // ── v0.4 helpers ────────────────────────────────────────────────────────

    /** 把 v0.4 详情字段（bio/location/fans/cooperationCount/avgGmv/photos/videos）补到已 build 的 star。 */
    private void attachV04(CelebrityStar s,
                            String bio, String location,
                            Long fans, Integer cooperationCount, Long avgGmv,
                            List<Map<String, Object>> photos,
                            List<Map<String, Object>> videos) {
        s.setBio(bio);
        s.setLocation(location);
        s.setFans(fans);
        s.setCooperationCount(cooperationCount);
        s.setAvgGmv(avgGmv);
        s.setPhotosJson(toJson(photos));
        s.setVideosJson(toJson(videos));
    }

    /** 把 v0.4 模板字段（previewCover/previewVideoUrl/durationSec）补到已 build 的 template。 */
    private CelebrityTemplate attachTplV04(CelebrityTemplate t,
                                            String previewCover, String previewVideoUrl,
                                            int durationSec) {
        t.setPreviewCover(previewCover);
        t.setPreviewVideoUrl(previewVideoUrl);
        t.setDurationSec(durationSec);
        return t;
    }

    private static Map<String, Object> photoMap(String id, String url, String caption) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("url", url);
        m.put("caption", caption);
        return m;
    }

    private static Map<String, Object> videoMap(String id, String title, int durationSec,
                                                 String coverUrl, String playUrl, String tag) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("title", title);
        m.put("durationSec", durationSec);
        m.put("coverUrl", coverUrl);
        m.put("playUrl", playUrl);
        m.put("tag", tag);
        return m;
    }

    private CelebrityStarAuthorization buildAuth(String id, String userId, String starId,
                                                  CelebrityAuthStatus status, List<String> scenes,
                                                  LocalDate expireDate, Integer availableStyles,
                                                  String pendingNote, String applyUrl) {
        Instant now = Instant.now();
        return CelebrityStarAuthorization.builder()
                .id(id)
                .userId(userId)
                .starId(starId)
                .status(status)
                .scenes(new ArrayList<>(scenes))
                .expireDate(expireDate)
                .availableStyles(availableStyles)
                .pendingNote(pendingNote)
                .applyUrl(applyUrl)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    /** 充值套餐种子（idempotent —— 已有数据时跳过）。 */
    private void seedRechargePackages() {
        if (pkgRepo.count() > 0) return;
        // 与 apps/miniprogram/utils/mocks.js WALLET_PACKAGES 完全对齐
        pkgRepo.save(RechargePackage.builder()
                .id("pkg-300").credits(300).priceCents(9900).tag("体验包")
                .recommended(false).bonusCredits(0).sortOrder(10).active(true).build());
        pkgRepo.save(RechargePackage.builder()
                .id("pkg-1000").credits(1000).priceCents(29900).tag("标准包")
                .recommended(true).bonusCredits(100).sortOrder(20).active(true).build());
        pkgRepo.save(RechargePackage.builder()
                .id("pkg-3000").credits(3000).priceCents(79900).tag("热门包")
                .recommended(false).bonusCredits(500).sortOrder(30).active(true).build());
        pkgRepo.save(RechargePackage.builder()
                .id("pkg-10000").credits(10000).priceCents(239900).tag("企业包")
                .recommended(false).bonusCredits(2000).sortOrder(40).active(true).build());
    }

    /**
     * v0.5 §3.2.7：每个 CelebrityTemplate 各 seed 一份 PUBLISHED TemplateScript。
     * 5 个模板：4 个 text 模式（含 ≥3 scene），1 个 video_ref 模式示范。
     * Idempotent：scriptRepo 已有数据时跳过。
     */
    private void seedTemplateScripts() {
        if (scriptRepo.count() > 0) return;
        java.time.Instant now = java.time.Instant.now();

        // 共用：persona / visualStyle / postProcess / safety / engineAdapters / variables
        Map<String, Object> persona = Map.of(
                "voiceTone", "亲切、邻家女孩",
                "speakingStyle", "短句、口语化、带语气词",
                "personality", List.of("温暖", "专业", "亲和"),
                "forbiddenTone", List.of("贵族腔"));
        Map<String, Object> visualStyle = Map.of(
                "lighting", "柔和自然光 + 侧补光",
                "colorPalette", List.of("#fde7e9", "#ffd6a5"),
                "cinematography", "手持小晃动、浅景深");
        Map<String, Object> postProcess = Map.of(
                "subtitleTemplate", "{{starName}} | {{productName}}",
                "watermarkPolicy", "if_unauth",
                "transitionStyle", "硬切");
        Map<String, Object> safety = Map.of(
                "forbiddenWords", List.of("最", "顶级", "国家级"),
                "requiredDisclaimers", List.of("广告"));
        List<Map<String, Object>> variables = List.of(
                Map.of("key", "productName", "label", "商品名", "type", "text", "source", "product", "required", true),
                Map.of("key", "sellingPoints", "label", "卖点", "type", "textArray", "source", "product", "required", false),
                Map.of("key", "starName", "label", "明星名", "type", "text", "source", "star", "required", false));
        Map<String, Object> engineAdapters = Map.of(
                "HiGen", Map.of(
                        "enabled", true,
                        "promptTemplate", "{{systemPrompt}}",
                        "params", Map.of("aspectRatio", "9:16", "fps", 30)),
                "KeLing", Map.of(
                        "enabled", true,
                        "promptTemplate", "{{systemPrompt}}",
                        "params", Map.of("aspectRatio", "9:16", "fps", 24)),
                "MiniMax", Map.of(
                        "enabled", true,
                        "promptTemplate", "{{systemPrompt}}",
                        "params", Map.of("aspectRatio", "9:16", "fps", 30)));

        // 4 个 text 模式
        seedScript("script-tpl-001", "tpl-001", "text", persona, visualStyle, postProcess, safety, variables, engineAdapters,
                "你是「种草日常 Vlog」风格的明星，本次为商品 {{productName}} 拍 30 秒短片。语气亲切日常，让镜头像聊天。"
                        + "确保提及关键卖点 {{sellingPoints[0]}}、{{sellingPoints[1]}} 和 {{sellingPoints[2]}}。视频中必须出现「广告」字样。",
                buildScenesForBroadcast(), 30, now);
        seedScript("script-tpl-002", "tpl-002", "text", persona, visualStyle, postProcess, safety, variables, engineAdapters,
                "你是「硬核测评」风格的明星。把 {{productName}} 与同类品做客观对比，给出 3 条数据洞察。"
                        + "镜头分四段：开场拆箱 / 实测对比 / 数据图卡 / 结论建议。视频结尾必须出现「广告」字样。",
                buildScenesForReview(), 60, now);
        seedScript("script-tpl-003", "tpl-003", "text", persona, visualStyle, postProcess, safety, variables, engineAdapters,
                "你是「轻松开箱」风格的明星。30 秒内打开 {{productName}}、展示亮点、给出一个使用建议。"
                        + "节奏明快，画面色彩鲜艳。视频中必须出现「广告」字样。",
                buildScenesForUnboxing(), 30, now);
        seedScript("script-tpl-004", "tpl-004", "text", persona, visualStyle, postProcess, safety, variables, engineAdapters,
                "你是「直播切片精选」风格的明星。模拟直播带货切片：开场寒暄 / 商品上身 / 限时优惠 / 引导下单。"
                        + "互动感强，15 秒卡点。视频中必须出现「广告」字样。",
                buildScenesForLiveCut(), 15, now);

        // 1 个 video_ref 模式（运营手填 referenceClip + URL，本期默认 reviewStatus=approved）
        Map<String, Object> referenceClip = new java.util.LinkedHashMap<>();
        referenceClip.put("videoUrl", placeholderVideo(99));
        referenceClip.put("thumbUrl", placeholderThumb(99));
        referenceClip.put("durationSec", 45);
        referenceClip.put("meta", Map.of("width", 720, "height", 1280, "fps", 30, "codec", "h264", "sizeBytes", 4_500_000L));
        referenceClip.put("usage", "structure");
        referenceClip.put("influence", 0.7);
        referenceClip.put("license", Map.of("source", "platform_official"));
        referenceClip.put("reviewStatus", "approved");
        seedScriptWithRef("script-tpl-005", "tpl-005", referenceClip, persona, visualStyle, postProcess, safety, variables, engineAdapters,
                "你是「剧情植入短片」风格的明星。参考视频提供分镜节奏，本次商品为 {{productName}}，"
                        + "把广告自然融入剧情。视频中必须出现「广告」字样。",
                60, now);
    }

    private void seedScript(String id, String templateId, String kind,
                             Map<String, Object> persona, Map<String, Object> visualStyle,
                             Map<String, Object> postProcess, Map<String, Object> safety,
                             List<Map<String, Object>> variables, Map<String, Object> engineAdapters,
                             String systemPrompt, List<Map<String, Object>> scenes,
                             int durationSec, java.time.Instant now) {
        List<String> sceneIds = scenes.stream().map(s -> String.valueOf(s.get("id"))).toList();
        Map<String, Object> durationVariants = new java.util.LinkedHashMap<>();
        durationVariants.put(String.valueOf(durationSec),
                Map.of("sceneIds", sceneIds, "cutHint", "硬切"));

        com.aistareco.aep.model.TemplateScript s = com.aistareco.aep.model.TemplateScript.builder()
                .id(id)
                .templateId(templateId)
                .version(1)
                .status(com.aistareco.aep.model.TemplateScriptStatus.PUBLISHED)
                .language("zh-CN")
                .kind(com.aistareco.aep.model.TemplateScriptKind.fromWire(kind))
                .personaJson(toJson(persona))
                .systemPrompt(systemPrompt)
                .scenesJson(toJson(scenes))
                .visualStyleJson(toJson(visualStyle))
                .negativePrompt("低饱和、阴暗光线、AI 痕迹、口型错位、商品 logo 模糊")
                .variablesJson(toJson(variables))
                .engineAdaptersJson(toJson(engineAdapters))
                .durationVariantsJson(toJson(durationVariants))
                .postProcessJson(toJson(postProcess))
                .safetyJson(toJson(safety))
                .createdAt(now)
                .publishedAt(now)
                .publishedBy("seed")
                .build();
        scriptRepo.save(s);
    }

    private void seedScriptWithRef(String id, String templateId,
                                    Map<String, Object> referenceClip,
                                    Map<String, Object> persona, Map<String, Object> visualStyle,
                                    Map<String, Object> postProcess, Map<String, Object> safety,
                                    List<Map<String, Object>> variables, Map<String, Object> engineAdapters,
                                    String systemPrompt, int durationSec, java.time.Instant now) {
        com.aistareco.aep.model.TemplateScript s = com.aistareco.aep.model.TemplateScript.builder()
                .id(id)
                .templateId(templateId)
                .version(1)
                .status(com.aistareco.aep.model.TemplateScriptStatus.PUBLISHED)
                .language("zh-CN")
                .kind(com.aistareco.aep.model.TemplateScriptKind.VIDEO_REF)
                .personaJson(toJson(persona))
                .systemPrompt(systemPrompt)
                .scenesJson(toJson(List.of()))
                .visualStyleJson(toJson(visualStyle))
                .negativePrompt("低饱和、阴暗光线、AI 痕迹")
                .variablesJson(toJson(variables))
                .engineAdaptersJson(toJson(engineAdapters))
                .durationVariantsJson(toJson(Map.of(String.valueOf(durationSec),
                        Map.of("sceneIds", List.of(), "cutHint", "随参考视频"))))
                .postProcessJson(toJson(postProcess))
                .safetyJson(toJson(safety))
                .referenceClipJson(toJson(referenceClip))
                .createdAt(now)
                .publishedAt(now)
                .publishedBy("seed")
                .build();
        scriptRepo.save(s);
    }

    private static List<Map<String, Object>> buildScenesForBroadcast() {
        return List.of(
                buildScene("s1", 0, 8, "近景", "明星左 1/3 站位，商品放右下", "暖色家居",
                        "明星拿起{{productName}}转身展示给镜头", "你们看，{{sellingPoints[0]}}！", "warm",
                        "front", 3, "充满画面 1/3，背景虚化",
                        "暖光，明星正脸近景，商品手持展示，浅景深；4K 质感，皮肤自然，镜头微微推进"),
                buildScene("s2", 1, 14, "中景", "明星正中，商品桌面摆放", "白色简约桌面",
                        "明星抬头看镜头说话", "{{sellingPoints[1]}} 真的是我用过最舒服的", "calm",
                        "side", 4, "侧 45 度展示包装",
                        "中景；明星看镜头说话；商品在桌面侧 45 度可见；色温 4000K；轻微跟焦"),
                buildScene("s3", 2, 8, "特写", "商品满屏 3/4，明星手指点向商品", "暖色背景",
                        "镜头推近商品标签", "限时 ¥{{price|\"99\"}}！", "excited",
                        "in_use", 4, "商品满屏特写、字幕弹出",
                        "特写商品；标签清晰可读；字幕「限时 ¥99」弹出；广告字样常驻右下角"));
    }

    private static List<Map<String, Object>> buildScenesForReview() {
        return List.of(
                buildScene("s1", 0, 12, "远景", "明星 + 桌面铺开三件商品", "评测室",
                        "明星介绍主角商品 {{productName}}", "今天我们对比一下三款产品的实测表现", "professional",
                        "front", 4, "全景平铺",
                        "远景全景；冷色调；明星 + 三件商品并排；手持轻晃动"),
                buildScene("s2", 1, 24, "中景", "数据卡叠加在商品旁", "评测室",
                        "明星指向数据卡讲解", "可以看到，{{productName}} 在 {{sellingPoints[0]}} 上领先 30%", "professional",
                        "side", 6, "数据卡贴边",
                        "中景；数据卡 OSD 叠加在画面右上；明星指向数据卡；色温 4500K；浅景深"),
                buildScene("s3", 2, 16, "特写", "明星正脸 + 商品手持展示", "评测室",
                        "明星对镜结论", "综合来看，{{productName}} 性价比最高。广告。", "calm",
                        "in_use", 6, "正脸+商品双特写",
                        "特写；明星正脸；手持商品标签清晰；广告字幕固定在画面下方"));
    }

    private static List<Map<String, Object>> buildScenesForUnboxing() {
        return List.of(
                buildScene("s1", 0, 6, "近景", "明星打开包装", "明亮简约背景",
                        "明星抽出{{productName}}", "拆开看看", "excited",
                        "front", 3, "包装+商品同框",
                        "近景；明星拆包动作；包装清晰；色彩鲜艳；2.4K 质感"),
                buildScene("s2", 1, 14, "中景", "明星 + 商品对镜展示", "明亮简约背景",
                        "明星说亮点", "亮点是 {{sellingPoints[0]}}，超出预期", "excited",
                        "in_use", 5, "商品中景展示",
                        "中景；商品手持；明星看镜头说话；自然光；轻微跟焦"),
                buildScene("s3", 2, 10, "特写", "商品 LOGO 满屏 + 字幕", "明亮简约背景",
                        "镜头拉到品牌名", "{{productName}} 推荐给你！广告。", "warm",
                        "front", 5, "Logo 满屏",
                        "特写商品 LOGO；字幕「广告」弹出；色彩饱和度提高 10%"));
    }

    private static List<Map<String, Object>> buildScenesForLiveCut() {
        return List.of(
                buildScene("s1", 0, 4, "中景", "直播间布景，明星左 1/3", "直播间",
                        "明星打招呼", "宝宝们今天来看{{productName}}", "excited",
                        "front", 2, "商品手持",
                        "中景；直播间灯条蓝色；明星左侧；商品右侧手持；动态跟随"),
                buildScene("s2", 1, 6, "近景", "明星持商品展示", "直播间",
                        "明星说亮点", "{{sellingPoints[0]}}，限时优惠！", "excited",
                        "in_use", 3, "商品近景",
                        "近景；商品手持展示；字幕「限时」弹跳进入；卡点剪辑"),
                buildScene("s3", 2, 5, "特写", "商品 + 价格字幕", "直播间",
                        "明星推单引导", "现在下单！广告。", "excited",
                        "front", 3, "价格字幕大",
                        "特写商品；大字号价格字幕；广告字样在右下；BPM 卡点 120"));
    }

    private static Map<String, Object> buildScene(String id, int order, int durationSec,
                                                   String shotType, String composition, String setting,
                                                   String action, String dialogue, String voiceEmotion,
                                                   String prodAngle, int prodDuration, String prodFraming,
                                                   String positivePrompt) {
        return Map.ofEntries(
                Map.entry("id", id),
                Map.entry("order", order),
                Map.entry("durationSec", durationSec),
                Map.entry("shotType", shotType),
                Map.entry("composition", composition),
                Map.entry("setting", setting),
                Map.entry("action", action),
                Map.entry("expression", "微笑 + 眼神惊喜"),
                Map.entry("dialogue", dialogue),
                Map.entry("voiceEmotion", voiceEmotion),
                Map.entry("productAppearance", Map.of(
                        "angle", prodAngle,
                        "durationSec", prodDuration,
                        "closeUpFraming", prodFraming)),
                Map.entry("positivePromptFragment", positivePrompt));
    }

    /**
     * v0.5.1：seed demo-user 名下 5 个 Bot 的 Notification（含 dot 未读数）。
     * 与小程序 mocks.BOT_MESSAGES 的 dot 字段（片片 3 / 审审 1 / 数数 2 / Ada 0 / 长长 0）一致。
     * 已有 botId notification 时跳过（idempotent）。
     */
    private void seedDemoUserBotNotifications() {
        if (notificationRepo.findByUserIdAndBotIdOrderByCreatedAtDesc("demo-user", "pian").size() > 0) return;
        java.time.Instant now = java.time.Instant.now();
        // 片片：3 条未读
        seedNotif("ntf-pian-1", "pian", "你的「李某某 · 30s 口播」生成完成，建议加个特写镜头", false, now.minusSeconds(120));
        seedNotif("ntf-pian-2", "pian", "草稿管理：当前 2 条草稿待发布", false, now.minusSeconds(180));
        seedNotif("ntf-pian-3", "pian", "1 条生成失败可重试", false, now.minusSeconds(240));
        // 审审：1 条未读
        seedNotif("ntf-shen-1", "shen", "已通过 1 项明星授权审核：王某某。请尽快开始第一条带货", false, now.minusSeconds(900));
        // 数数：2 条未读
        seedNotif("ntf-shu-1",  "shu", "昨日 12 条视频累计曝光 28.4w，转化率较前日 +12%", false, now.minusSeconds(1800));
        seedNotif("ntf-shu-2",  "shu", "异常提醒：陈某某的视频 ROI 跌到 1.8x", false, now.minusSeconds(1900));
        // Ada / 长长：0 未读（创建一条已读消息作为最近预览）
        seedNotif("ntf-ada-1",   "ada",   "新增 3 位食品类明星可授权，与你的店铺品类相符", true, now.minusSeconds(3600 * 24));
        seedNotif("ntf-zhang-1", "zhang", "本周复盘已生成：建议提升 15s 短视频的占比", true, now.minusSeconds(3600 * 24 + 60));
    }

    private void seedNotif(String id, String botId, String title, boolean read, java.time.Instant createdAt) {
        notificationRepo.save(com.aistareco.aep.model.Notification.builder()
                .id(id)
                .userId("demo-user")
                .type(com.aistareco.aep.model.Notification.NotificationType.SYSTEM)
                .title(title)
                .description(title)
                .botId(botId)
                .read(read)
                .createdAt(createdAt)
                .build());
    }
}
