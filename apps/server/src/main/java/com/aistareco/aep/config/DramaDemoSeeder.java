package com.aistareco.aep.config;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * drama 子产品的演示目录种子（dev/test profile）。
 *
 * 在 {@link DemoCatalogSeeder}（@Order 100）之后运行（@Order 101）。
 * 专门补齐 DemoCatalogSeeder 显式跳过、但 web-drama 页面会读取的领域：
 * drama / movie / ad / voice-work / fan-tier / fan-activity / community-event /
 * fan-growth / distribution-content，外加几条演示短剧脚本（drama_scripts）。
 *
 * 这些领域 USE_MOCK=0 时若不种数据，对应 GET 会返回空列表，
 * web-drama 的项目流水线 / 数据洞察 / 趋势雷达 / 分发中心等页面就拉不到数据。
 *
 * 幂等：每张表独立 count()==0 才插入。
 */
@Component
@Profile({"dev", "test"})
@Order(101)
public class DramaDemoSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DramaDemoSeeder.class);

    private final AepUserRepository userRepo;
    private final DramaRepository dramaRepo;
    private final MovieRepository movieRepo;
    private final AdvertisementRepository adRepo;
    private final VoiceWorkRepository voiceWorkRepo;
    private final FanTierRepository fanTierRepo;
    private final FanActivityRepository fanActivityRepo;
    private final CommunityEventRepository communityEventRepo;
    private final FanGrowthPointRepository fanGrowthRepo;
    private final DistributionContentRepository distributionContentRepo;
    private final DramaScriptRepository dramaScriptRepo;
    private final ObjectMapper om;

    public DramaDemoSeeder(AepUserRepository userRepo,
                           DramaRepository dramaRepo,
                           MovieRepository movieRepo,
                           AdvertisementRepository adRepo,
                           VoiceWorkRepository voiceWorkRepo,
                           FanTierRepository fanTierRepo,
                           FanActivityRepository fanActivityRepo,
                           CommunityEventRepository communityEventRepo,
                           FanGrowthPointRepository fanGrowthRepo,
                           DistributionContentRepository distributionContentRepo,
                           DramaScriptRepository dramaScriptRepo,
                           ObjectMapper om) {
        this.userRepo = userRepo;
        this.dramaRepo = dramaRepo;
        this.movieRepo = movieRepo;
        this.adRepo = adRepo;
        this.voiceWorkRepo = voiceWorkRepo;
        this.fanTierRepo = fanTierRepo;
        this.fanActivityRepo = fanActivityRepo;
        this.communityEventRepo = communityEventRepo;
        this.fanGrowthRepo = fanGrowthRepo;
        this.distributionContentRepo = distributionContentRepo;
        this.dramaScriptRepo = dramaScriptRepo;
        this.om = om;
    }

    @Override
    public void run(String... args) {
        Instant now = Instant.now();
        seedDramas(now);
        seedMovies();
        seedAds();
        seedVoiceWorks();
        seedFanTiers();
        seedFanActivities(now);
        seedCommunityEvents();
        seedFanGrowth();
        seedDistributionContent();

        AepUser studio = userRepo.findAll().stream()
                .filter(u -> u.getKind() == AepUser.AccountKind.STUDIO)
                .findFirst().orElse(null);
        if (studio != null) seedDramaScripts(studio);
    }

    // ── 短剧项目（项目流水线 / 数据洞察 / 总览）──────────────────────────────────

    private void seedDramas(Instant now) {
        if (dramaRepo.count() > 0) return;
        dramaRepo.saveAll(List.of(
                Drama.builder().id("d-001").title("总裁的隐藏身份").genre("都市甜宠")
                        .episodes(24).role("沈律 / 苏念")
                        .status(Drama.DramaStatus.RELEASED)
                        .views(8_620_000L).revenue(326_000L).rating(4.7)
                        .releaseDate(now.minus(40, ChronoUnit.DAYS)).build(),
                Drama.builder().id("d-002").title("重生九零之逆袭人生").genre("逆袭爽剧")
                        .episodes(30).role("林晚")
                        .status(Drama.DramaStatus.POST_PRODUCTION)
                        .views(2_140_000L).revenue(98_000L).rating(4.5)
                        .releaseDate(now.minus(8, ChronoUnit.DAYS)).build(),
                Drama.builder().id("d-003").title("雨夜迷案").genre("悬疑")
                        .episodes(18).role("顾衍 / 江晴")
                        .status(Drama.DramaStatus.FILMING)
                        .views(0L).revenue(0L).rating(0.0)
                        .releaseDate(null).build(),
                Drama.builder().id("d-004").title("古宅惊魂夜").genre("古装")
                        .episodes(20).role("慕容雪")
                        .status(Drama.DramaStatus.CASTING)
                        .views(0L).revenue(0L).rating(0.0)
                        .releaseDate(null).build()
        ));
    }

    private void seedMovies() {
        if (movieRepo.count() > 0) return;
        movieRepo.saveAll(List.of(
                Movie.builder().id("m-001").title("星海回响").genre("科幻")
                        .role(Movie.MovieRole.LEAD).status(Movie.MovieStatus.RELEASED)
                        .boxOffice(126_000_000L).revenue(4_200_000L).rating(4.6).build(),
                Movie.builder().id("m-002").title("长安旧梦").genre("古装")
                        .role(Movie.MovieRole.SUPPORTING).status(Movie.MovieStatus.POST_PRODUCTION)
                        .boxOffice(0L).revenue(0L).rating(0.0).build()
        ));
    }

    private void seedAds() {
        if (adRepo.count() > 0) return;
        adRepo.saveAll(List.of(
                Advertisement.builder().id("ad-001").brand("星澜美妆").product("焕活精华")
                        .type(Advertisement.AdType.DIGITAL).duration(30)
                        .status(Advertisement.AdStatus.COMPLETED).payment(180_000L).views(3_400_000L).build(),
                Advertisement.builder().id("ad-002").brand("云野咖啡").product("冷萃系列")
                        .type(Advertisement.AdType.SOCIAL).duration(15)
                        .status(Advertisement.AdStatus.SHOOTING).payment(96_000L).views(0L).build()
        ));
    }

    private void seedVoiceWorks() {
        if (voiceWorkRepo.count() > 0) return;
        voiceWorkRepo.saveAll(List.of(
                VoiceWork.builder().id("vw-001").project("《山海异闻录》动画配音")
                        .type(VoiceWork.VoiceWorkType.ANIMATION).duration(45)
                        .status(VoiceWork.VoiceWorkStatus.DELIVERED).payment(62_000L).build(),
                VoiceWork.builder().id("vw-002").project("《城市之声》纪录片旁白")
                        .type(VoiceWork.VoiceWorkType.DOCUMENTARY).duration(28)
                        .status(VoiceWork.VoiceWorkStatus.EDITING).payment(38_000L).build()
        ));
    }

    // ── 粉丝运营（趋势雷达 / 社区）────────────────────────────────────────────────

    private void seedFanTiers() {
        if (fanTierRepo.count() > 0) return;
        fanTierRepo.saveAll(List.of(
                FanTier.builder().id("ft-1").name("路人粉").icon("🌱").count(420_000).color("#22c55e").bg("#dcfce7").build(),
                FanTier.builder().id("ft-2").name("真爱粉").icon("💛").count(86_000).color("#eab308").bg("#fef9c3").build(),
                FanTier.builder().id("ft-3").name("铁杆粉").icon("🔥").count(24_000).color("#ef4444").bg("#fee2e2").build(),
                FanTier.builder().id("ft-4").name("挚友会员").icon("👑").count(5_200).color("#a855f7").bg("#f3e8ff").build()
        ));
    }

    private void seedFanActivities(Instant now) {
        if (fanActivityRepo.count() > 0) return;
        fanActivityRepo.saveAll(List.of(
                FanActivity.builder().id("fa-1").userName("夜微凉").avatar("https://i.pravatar.cc/100?u=fa1")
                        .action("在《总裁的隐藏身份》下点赞并评论").type(FanActivity.ActivityType.COMMENT)
                        .createdAt(now.minus(2, ChronoUnit.HOURS)).build(),
                FanActivity.builder().id("fa-2").userName("橙子汽水").avatar("https://i.pravatar.cc/100?u=fa2")
                        .action("打赏了 6 个嘉年华").type(FanActivity.ActivityType.GIFT)
                        .createdAt(now.minus(5, ChronoUnit.HOURS)).build(),
                FanActivity.builder().id("fa-3").userName("阿野").avatar("https://i.pravatar.cc/100?u=fa3")
                        .action("分享了最新短剧到朋友圈").type(FanActivity.ActivityType.SHARE)
                        .createdAt(now.minus(9, ChronoUnit.HOURS)).build(),
                FanActivity.builder().id("fa-4").userName("林深时见鹿").avatar("https://i.pravatar.cc/100?u=fa4")
                        .action("关注了演员「苏念」").type(FanActivity.ActivityType.FOLLOW)
                        .createdAt(now.minus(1, ChronoUnit.DAYS)).build()
        ));
    }

    private void seedCommunityEvents() {
        if (communityEventRepo.count() > 0) return;
        LocalDate today = LocalDate.now();
        communityEventRepo.saveAll(List.of(
                CommunityEvent.builder().id("ce-1").title("新剧《雨夜迷案》首映直播")
                        .type(CommunityEvent.EventType.MEETUP).status(CommunityEvent.EventStatus.UPCOMING)
                        .participants(1_280).eventDate(today.plusDays(5)).build(),
                CommunityEvent.builder().id("ce-2").title("年度最佳短剧人气投票")
                        .type(CommunityEvent.EventType.VOTE).status(CommunityEvent.EventStatus.LIVE)
                        .participants(34_500).eventDate(today.minusDays(2)).build(),
                CommunityEvent.builder().id("ce-3").title("演员出道一周年应援")
                        .type(CommunityEvent.EventType.ANNIVERSARY).status(CommunityEvent.EventStatus.ENDED)
                        .participants(9_800).eventDate(today.minusDays(20)).build()
        ));
    }

    private void seedFanGrowth() {
        if (fanGrowthRepo.count() > 0) return;
        // id 升序即时间顺序（controller 按 id 排序）
        fanGrowthRepo.saveAll(List.of(
                FanGrowthPoint.builder().id("fg-01").dateLabel("1月").fans(180_000L).active(42_000L).build(),
                FanGrowthPoint.builder().id("fg-02").dateLabel("2月").fans(246_000L).active(61_000L).build(),
                FanGrowthPoint.builder().id("fg-03").dateLabel("3月").fans(312_000L).active(88_000L).build(),
                FanGrowthPoint.builder().id("fg-04").dateLabel("4月").fans(404_000L).active(120_000L).build(),
                FanGrowthPoint.builder().id("fg-05").dateLabel("5月").fans(521_000L).active(168_000L).build(),
                FanGrowthPoint.builder().id("fg-06").dateLabel("6月").fans(640_000L).active(205_000L).build()
        ));
    }

    private void seedDistributionContent() {
        if (distributionContentRepo.count() > 0) return;
        LocalDate today = LocalDate.now();
        distributionContentRepo.saveAll(List.of(
                DistributionContent.builder().id("dc-1").title("总裁的隐藏身份 · 合集")
                        .contentType("短剧").status(DistributionContent.ContentStatus.PUBLISHED)
                        .platformCount(4).totalViewsCount(8_620_000L).publishDate(today.minusDays(40)).build(),
                DistributionContent.builder().id("dc-2").title("重生九零 · 先导预告")
                        .contentType("预告片").status(DistributionContent.ContentStatus.DISTRIBUTING)
                        .platformCount(3).totalViewsCount(1_240_000L).publishDate(today.minusDays(6)).build(),
                DistributionContent.builder().id("dc-3").title("雨夜迷案 · 角色花絮")
                        .contentType("花絮").status(DistributionContent.ContentStatus.SCHEDULED)
                        .platformCount(2).totalViewsCount(0L).publishDate(today.plusDays(3)).build()
        ));
    }

    // ── 演示短剧脚本（短剧生成「我的脚本」列表）──────────────────────────────────

    private void seedDramaScripts(AepUser studio) {
        if (dramaScriptRepo.count() > 0) return;
        OffsetDateTime now = OffsetDateTime.now();
        dramaScriptRepo.save(buildDramaScript(studio.getId(), "ds_demo_ceo", "误会重逢", "都市甜宠", 60, now));
        dramaScriptRepo.save(buildDramaScript(studio.getId(), "ds_demo_revenge", "逆风翻盘", "逆袭爽剧", 75, now.minusDays(1)));
        log.info("[drama-seed] seeded demo drama scripts for user={}", studio.getId());
    }

    private DramaScript buildDramaScript(String ownerId, String id, String title, String genre,
                                         int durationSec, OffsetDateTime ts) {
        ObjectNode payload = om.createObjectNode();
        payload.put("id", id);
        payload.put("title", title);
        payload.put("logline", "一句话钩子：" + title + "，节奏快、冲突强、结尾留悬念。");
        payload.put("genre", genre);
        payload.put("theme", title);
        payload.put("duration_sec", durationSec);
        payload.put("aspect_ratio", "9:16");
        payload.put("status", "ready");

        ArrayNode characters = payload.putArray("characters");
        ObjectNode male = characters.addObject();
        male.put("id", "ch_male");
        male.put("name", "男主");
        male.put("role", "male_lead");
        male.put("appearance", "三十岁出头，干练精英气质，深色西装");
        ObjectNode female = characters.addObject();
        female.put("id", "ch_female");
        female.put("name", "女主");
        female.put("role", "female_lead");
        female.put("appearance", "二十多岁，温柔知性，米色风衣");

        ArrayNode scenes = payload.putArray("scenes");
        scenes.add(buildScene("日 · 咖啡馆 · 内", "男女主擦肩，旧情翻涌", "中近景，手持轻微晃动，暖色调",
                "（旁白）有些人一转身，就是一辈子。", 12, "medium", "handheld", true, "ch_male", "ch_female"));
        scenes.add(buildScene("日 · 街头 · 外", "女主追出门，男主已消失在人群", "远景跟拍，冷暖对比",
                "（女主）等一下……", 14, "wide", "pan", true, "ch_female"));
        scenes.add(buildScene("夜 · 公寓 · 内", "男主独自翻看旧照片，神情复杂", "特写，低调布光",
                "（男主）这次，我不会再放手。", 16, "close", "push", true, "ch_male"));
        scenes.add(buildScene("日 · 公司大厅 · 内", "两人再次相遇，身份反转揭晓", "中景双人，明亮高调",
                "（女主）原来……一直是你。", 18, "medium", "static", true, "ch_male", "ch_female"));

        return DramaScript.builder()
                .id(id)
                .ownerUserId(ownerId)
                .title(title)
                .genre(genre)
                .durationSec(durationSec)
                .status("ready")
                .payloadJson(writeJson(payload))
                .createdAt(ts)
                .updatedAt(ts)
                .build();
    }

    private ObjectNode buildScene(String heading, String summary, String shot, String dialogue,
                                  int durationSec, String shotType, String cameraMove, boolean genVoice,
                                  String... characterIds) {
        ObjectNode sc = om.createObjectNode();
        sc.put("heading", heading);
        sc.put("summary", summary);
        sc.put("shot", shot);
        sc.put("dialogue", dialogue);
        sc.put("duration_sec", durationSec);
        sc.put("shot_type", shotType);
        sc.put("camera_move", cameraMove);
        sc.put("gen_voice", genVoice);
        ArrayNode ids = sc.putArray("character_ids");
        for (String cid : characterIds) ids.add(cid);
        return sc;
    }

    private String writeJson(ObjectNode node) {
        try {
            return om.writeValueAsString(node);
        } catch (Exception e) {
            return "{}";
        }
    }
}
