package com.aistareco.aep.config;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

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
public class CelebrityZoneDataInitializer implements CommandLineRunner {

    private static final ObjectMapper OM = new ObjectMapper();

    private final CelebrityStarRepository starRepo;
    private final CelebrityProjectRepository projectRepo;
    private final CelebrityProjectVideoRepository videoRepo;
    private final CelebrityTemplateRepository templateRepo;
    private final CelebrityShowcaseRepository showcaseRepo;
    private final ProductRepository productRepo;

    public CelebrityZoneDataInitializer(CelebrityStarRepository starRepo,
                                         CelebrityProjectRepository projectRepo,
                                         CelebrityProjectVideoRepository videoRepo,
                                         CelebrityTemplateRepository templateRepo,
                                         CelebrityShowcaseRepository showcaseRepo,
                                         ProductRepository productRepo) {
        this.starRepo = starRepo;
        this.projectRepo = projectRepo;
        this.videoRepo = videoRepo;
        this.templateRepo = templateRepo;
        this.showcaseRepo = showcaseRepo;
        this.productRepo = productRepo;
    }

    @Override
    public void run(String... args) {
        if (starRepo.count() > 0) return;

        LocalDate today = LocalDate.now();

        // ── Stars (3 个 demo 明星) ────────────────────────────────────────────
        starRepo.save(buildStar(
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
        ));

        starRepo.save(buildStar(
                "star-yi-nengjing", "伊能静", "歌手", true,
                "气质温婉的资深艺人，适合美妆 / 母婴品类的温情种草。",
                "¥499起", "标准版", 8, 30,
                authorization("authorized", List.of("带货", "种草", "测评"), today.plusMonths(3).toString(), 4, null, null),
                stats(32, "8.7M", "9.5%", "¥2.3M"),
                List.of(
                        Map.of("id", "sv1", "label", "母婴推荐", "category", "母婴", "thumb", placeholderThumb(3), "videoUrl", placeholderVideo(3))
                ),
                pricingTiers()
        ));

        starRepo.save(buildStar(
                "star-shen-teng", "沈腾", "演员", false,
                "喜剧风格突出，适合搞笑类轻量植入。当前未对您授权，可申请。",
                "¥899起", null, null, null,
                authorization("unauthorized", List.of(), null, 6, null, "/producer/celebrity-zone/star/star-shen-teng/apply"),
                stats(0, "—", "—", "—"),
                List.of(),
                pricingTiers()
        ));

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
        templateRepo.save(buildTemplate("tpl-001", "种草日常 Vlog", "种草安利",
                "轻松日常感，自然推荐商品。",
                "HiGen", "标准", true, "120K", "8.2%",
                "适合美妆 / 食品类",
                List.of(Map.of("thumb", placeholderThumb(21), "videoUrl", placeholderVideo(21)))));

        templateRepo.save(buildTemplate("tpl-002", "硬核测评", "硬核测评",
                "专业拆解 + 数据对比，理性人群转化高。",
                "MiniMax", "高级", true, "98K", "11.5%",
                "适合数码 3C / 家电",
                List.of(Map.of("thumb", placeholderThumb(22), "videoUrl", placeholderVideo(22)))));

        templateRepo.save(buildTemplate("tpl-003", "轻松开箱", "轻松开箱",
                "节奏明快，画面色彩鲜艳。",
                "HiGen", "标准", false, "76K", "7.0%",
                "适合服饰 / 日用百货",
                List.of(Map.of("thumb", placeholderThumb(23), "videoUrl", placeholderVideo(23)))));

        templateRepo.save(buildTemplate("tpl-004", "直播切片精选", "直播切片",
                "模拟直播带货切片，互动感强。",
                "KeLing", "经济", false, "55K", "5.8%",
                "适合食品饮料 / 服饰",
                List.of(Map.of("thumb", placeholderThumb(24), "videoUrl", placeholderVideo(24)))));

        templateRepo.save(buildTemplate("tpl-005", "剧情植入短片", "剧情植入",
                "轻剧情包装商品，适合品牌故事。",
                "MiniMax", "高级", false, "42K", "9.1%",
                "适合各品类",
                List.of(Map.of("thumb", placeholderThumb(25), "videoUrl", placeholderVideo(25)))));

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
}
