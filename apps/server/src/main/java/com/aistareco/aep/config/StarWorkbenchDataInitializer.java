package com.aistareco.aep.config;

import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * 明星商务工作台（web-star，v0.60）seed。
 *
 * 独立 runner（@Order(3)），跑在 CelebrityZoneDataInitializer（@Order(2)）之后：
 * 种子明星账号 {@code star_shenteng / star123} 绑定 celebrity 域已 seed 的
 * {@code star-shen-teng}（沈腾）—— celebrity 端 demo-user 对沈腾的 PENDING 授权
 * 申请会直接出现在明星端「带货授权」审批队列，开箱即可演示双端打通。
 */
@Component
@Order(3)
@ConditionalOnProperty(name = "aep.seed.dev-data.enabled", havingValue = "true", matchIfMissing = true)
public class StarWorkbenchDataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(StarWorkbenchDataInitializer.class);

    private static final String STAR_ID = "star-shen-teng";
    private static final String USERNAME = "star_shenteng";

    private final AepUserRepository userRepo;
    private final CelebrityStarRepository starRepo;
    private final StarAccountRepository accountRepo;
    private final StarIpAssetRepository ipAssetRepo;
    private final StarWhitelistRequestRepository whitelistRepo;
    private final StarDigitalHumanRequestRepository dhRepo;
    private final StarAiLikenessRequestRepository aiRepo;
    private final StarContentReviewRepository contentRepo;
    private final StarProductOnboardRepository onboardRepo;
    private final StarBrandAuthRequestRepository brandRepo;
    private final StarContentRuleRepository ruleRepo;
    private final StarInfringementCaseRepository infringementRepo;
    private final StarContractRepository contractRepo;
    private final StarRevenueMonthRepository revenueRepo;
    private final PasswordEncoder passwordEncoder;

    public StarWorkbenchDataInitializer(AepUserRepository userRepo,
                                        CelebrityStarRepository starRepo,
                                        StarAccountRepository accountRepo,
                                        StarIpAssetRepository ipAssetRepo,
                                        StarWhitelistRequestRepository whitelistRepo,
                                        StarDigitalHumanRequestRepository dhRepo,
                                        StarAiLikenessRequestRepository aiRepo,
                                        StarContentReviewRepository contentRepo,
                                        StarProductOnboardRepository onboardRepo,
                                        StarBrandAuthRequestRepository brandRepo,
                                        StarContentRuleRepository ruleRepo,
                                        StarInfringementCaseRepository infringementRepo,
                                        StarContractRepository contractRepo,
                                        StarRevenueMonthRepository revenueRepo,
                                        PasswordEncoder passwordEncoder) {
        this.userRepo = userRepo;
        this.starRepo = starRepo;
        this.accountRepo = accountRepo;
        this.ipAssetRepo = ipAssetRepo;
        this.whitelistRepo = whitelistRepo;
        this.dhRepo = dhRepo;
        this.aiRepo = aiRepo;
        this.contentRepo = contentRepo;
        this.onboardRepo = onboardRepo;
        this.brandRepo = brandRepo;
        this.ruleRepo = ruleRepo;
        this.infringementRepo = infringementRepo;
        this.contractRepo = contractRepo;
        this.revenueRepo = revenueRepo;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        // 账号幂等：星动账号已存在即认为 seed 过
        AepUser user = userRepo.findByUsername(USERNAME).orElse(null);
        if (user == null) {
            user = AepUser.builder()
                    .id(UUID.randomUUID().toString())
                    .username(USERNAME)
                    .passwordHash(passwordEncoder.encode("star123"))
                    .phone("13900002222")
                    .email("shenteng-studio@aistareco.com")
                    .displayName("沈腾经纪工作室")
                    .kind(AepUser.AccountKind.STUDIO)
                    .status(AepUser.UserStatus.ACTIVE)
                    .platforms("star")
                    .emailVerified(true)
                    .phoneVerified(true)
                    .langPreference("zh")
                    .createdAt(Instant.now().minus(30, ChronoUnit.DAYS))
                    .updatedAt(Instant.now())
                    .build();
            userRepo.save(user);
        }

        if (accountRepo.findByUserId(user.getId()).isPresent()) return;
        if (starRepo.findById(STAR_ID).isEmpty()) {
            log.warn("[star-seed] {} 不存在（celebrity seed 未跑？），跳过明星端 seed", STAR_ID);
            return;
        }

        accountRepo.save(StarAccount.builder()
                .id("sa-shenteng")
                .userId(user.getId())
                .starId(STAR_ID)
                .agentView(true)
                .createdAt(Instant.now().minus(30, ChronoUnit.DAYS))
                .build());

        seedIpAssets();
        seedWhitelist();
        seedDigitalHuman();
        seedAiLikeness();
        seedContent();
        seedProducts();
        seedBrandAuths();
        seedRules();
        seedInfringements();
        seedContracts();
        seedRevenue();

        log.info("[star-seed] 明星商务工作台 seed 完成：{} ↔ {}（star_shenteng / star123）", USERNAME, STAR_ID);
    }

    private static OffsetDateTime at(String iso) {
        return OffsetDateTime.of(LocalDate.parse(iso.substring(0, 10)),
                java.time.LocalTime.parse(iso.length() > 10 ? iso.substring(11) : "10:00"),
                ZoneOffset.ofHours(8));
    }

    private void seedIpAssets() {
        ipAssetRepo.save(StarIpAsset.builder()
                .id("ip-" + STAR_ID + "-portrait").starId(STAR_ID)
                .type(StarIpAsset.AssetType.PORTRAIT).status(StarIpAsset.AssetStatus.ACTIVE)
                .techCompany("数字孪生科技（北京）").volcanoProjectId("VK-PRT-2026-001")
                .filesCount(35).requiredFiles(32)
                .uploadedAt(LocalDate.parse("2026-04-10")).activatedAt(LocalDate.parse("2026-04-15"))
                .note("已含人脸扫描数据包及生物特征协议").build());
        ipAssetRepo.save(StarIpAsset.builder()
                .id("ip-" + STAR_ID + "-clip").starId(STAR_ID)
                .type(StarIpAsset.AssetType.CLIP).status(StarIpAsset.AssetStatus.ACTIVE)
                .techCompany("数字孪生科技（北京）").volcanoProjectId("VK-CLP-2026-001")
                .filesCount(120).requiredFiles(50)
                .uploadedAt(LocalDate.parse("2026-04-12")).activatedAt(LocalDate.parse("2026-04-17")).build());
        ipAssetRepo.save(StarIpAsset.builder()
                .id("ip-" + STAR_ID + "-digitalHuman").starId(STAR_ID)
                .type(StarIpAsset.AssetType.DIGITAL_HUMAN).status(StarIpAsset.AssetStatus.VOLCANO_SYNC)
                .techCompany("灵镜AI Lab").volcanoProjectId("VK-DH-2026-001")
                .filesCount(8).requiredFiles(10)
                .uploadedAt(LocalDate.parse("2026-05-01"))
                .note("模型训练中，预计3-5个工作日完成").build());
        ipAssetRepo.save(StarIpAsset.builder()
                .id("ip-" + STAR_ID + "-documents").starId(STAR_ID)
                .type(StarIpAsset.AssetType.DOCUMENTS).status(StarIpAsset.AssetStatus.TECH_RECEIVED)
                .techCompany("法务合规中心").volcanoProjectId("VK-DOC-2026-001")
                .filesCount(4).requiredFiles(4)
                .uploadedAt(LocalDate.parse("2026-04-20"))
                .note("文件已由技术公司接收，待同步至火山引擎").build());
    }

    private void seedWhitelist() {
        whitelistRepo.save(StarWhitelistRequest.builder()
                .id("wl-r1").starId(STAR_ID).mcnName("AI Star MCN")
                .accountHandle("@neon_v_official").accountId("neonv2024")
                .phone("138****8812").uid("94728163501").platform("抖音")
                .fans(1_284_000).accountAgeMonths(27).mcnLevel("金牌")
                .requestedAt(at("2026-05-06T14:30")).status(StarWhitelistRequest.Status.PENDING)
                .whitelistStep(StarWhitelistRequest.Step.RECEIVED)
                .recentVideos(24).avgViews(280_000).creditScore(92).build());
        whitelistRepo.save(StarWhitelistRequest.builder()
                .id("wl-r2").starId(STAR_ID).mcnName("AI Star MCN")
                .accountHandle("@neon_v_channel").accountId("neon_channel")
                .phone("138****8812").uid("wx_82749163").platform("视频号")
                .fans(436_000).accountAgeMonths(13).mcnLevel("金牌")
                .requestedAt(at("2026-05-06T14:32")).status(StarWhitelistRequest.Status.PENDING)
                .whitelistStep(StarWhitelistRequest.Step.CONTACTING)
                .recentVideos(18).avgViews(210_000).creditScore(90).build());
        whitelistRepo.save(StarWhitelistRequest.builder()
                .id("wl-r3").starId(STAR_ID).mcnName("HypeStar Studio")
                .accountHandle("@luna_soft_ks").accountId("lunasoft2023")
                .phone("156****2247").uid("38821047295").platform("快手")
                .fans(562_000).accountAgeMonths(20).mcnLevel("银牌")
                .requestedAt(at("2026-05-05T10:15")).status(StarWhitelistRequest.Status.PENDING)
                .whitelistStep(StarWhitelistRequest.Step.SMS)
                .recentVideos(18).avgViews(120_000).creditScore(78).build());
        whitelistRepo.save(StarWhitelistRequest.builder()
                .id("wl-r5").starId(STAR_ID).mcnName("TopCreator MCN")
                .accountHandle("@topstar_douyin").accountId("topstar_tc")
                .phone("139****0055").uid("71039284651").platform("抖音")
                .fans(3_420_000).accountAgeMonths(41).mcnLevel("钻石")
                .requestedAt(at("2026-04-28T09:00")).status(StarWhitelistRequest.Status.APPROVED)
                .whitelistStep(StarWhitelistRequest.Step.AUTHORIZED)
                .recentVideos(48).avgViews(860_000).creditScore(98).build());
    }

    private void seedDigitalHuman() {
        dhRepo.save(StarDigitalHumanRequest.builder()
                .id("dh1").starId(STAR_ID).mcnName("AI Star MCN")
                .usageType(StarDigitalHumanRequest.UsageType.LIVE)
                .platforms(List.of("抖音", "淘宝直播"))
                .purpose("电商直播带货，AI数字人主播替换真人上播").durationMonths(12)
                .requestedAt(at("2026-05-07T10:00")).status(StarReviewStatus.PENDING).build());
        dhRepo.save(StarDigitalHumanRequest.builder()
                .id("dh2").starId(STAR_ID).mcnName("TopCreator MCN")
                .usageType(StarDigitalHumanRequest.UsageType.SHORT_VIDEO)
                .platforms(List.of("抖音", "快手"))
                .purpose("短视频宣传片，艺人数字人口播介绍产品").durationMonths(6)
                .requestedAt(at("2026-05-06T15:30")).status(StarReviewStatus.PENDING)
                .riskNote("需确认数字人形象相似度合规，建议第三方鉴定").build());
    }

    private void seedAiLikeness() {
        aiRepo.save(StarAiLikenessRequest.builder()
                .id("ai1").starId(STAR_ID).mcnName("AI Star MCN")
                .modelType(StarAiLikenessRequest.ModelType.VOICE)
                .riskLevel(StarAiLikenessRequest.RiskLevel.LOW)
                .platforms(List.of("抖音"))
                .purpose("AI语音合成用于视频配音，相似度≤75%")
                .requestedAt(at("2026-05-07T11:00")).status(StarReviewStatus.PENDING)
                .aiVendor("ElevenLabs").build());
        aiRepo.save(StarAiLikenessRequest.builder()
                .id("ai2").starId(STAR_ID).mcnName("CyberMCN")
                .modelType(StarAiLikenessRequest.ModelType.FACE)
                .riskLevel(StarAiLikenessRequest.RiskLevel.HIGH)
                .platforms(List.of("抖音", "微博"))
                .purpose("AI换脸用于品牌宣传短片")
                .requestedAt(at("2026-05-06T14:00")).status(StarReviewStatus.PENDING)
                .aiVendor("FaceSwap Pro").build());
    }

    private void seedContent() {
        contentRepo.save(StarContentReview.builder()
                .id("cv1").starId(STAR_ID).title("沈腾×泡泡玛特联名开箱视频")
                .type(StarContentReview.ContentType.CLIP).uploader("@neon_v_official").mcnName("AI Star MCN")
                .durationSec(208).submittedAt(at("2026-05-07T09:00"))
                .status(StarContentReview.Status.PENDING).platform("抖音").build());
        contentRepo.save(StarContentReview.builder()
                .id("cv2").starId(STAR_ID).title("AI数字人带货直播高光片段")
                .type(StarContentReview.ContentType.DIGITAL_HUMAN).uploader("@topstar_douyin").mcnName("TopCreator MCN")
                .durationSec(75).submittedAt(at("2026-05-07T11:30"))
                .status(StarContentReview.Status.PENDING).platform("抖音").build());
        contentRepo.save(StarContentReview.builder()
                .id("cv3").starId(STAR_ID).title("沈腾AI声音配音护肤品种草")
                .type(StarContentReview.ContentType.AI_LIKENESS).uploader("@luna_soft_ks").mcnName("HypeStar Studio")
                .durationSec(58).submittedAt(at("2026-05-06T20:00"))
                .status(StarContentReview.Status.REVISION).platform("快手")
                .revisionNote("AI 声音相似度超出协议上限，请替换配音轨后重新提交").build());
        contentRepo.save(StarContentReview.builder()
                .id("cv4").starId(STAR_ID).title("小品名场面回顾混剪合集")
                .type(StarContentReview.ContentType.CLIP).uploader("@neon_v_channel").mcnName("AI Star MCN")
                .durationSec(340).submittedAt(at("2026-05-06T15:00"))
                .status(StarContentReview.Status.APPROVED).platform("视频号").views(243_000L).build());
    }

    private void seedProducts() {
        onboardRepo.save(StarProductOnboard.builder()
                .id("po1").starId(STAR_ID).productName("次世代智能护肤精华").brand("CyberGlow")
                .category("美妆护肤").priceCents(39_800).source(StarProductOnboard.Source.PLATFORM)
                .submittedBy("平台运营组").step(2)
                .submittedAt(at("2026-05-07T10:00"))
                .platformNote("平台已审核，适合AI带货场景").build());
        onboardRepo.save(StarProductOnboard.builder()
                .id("po2").starId(STAR_ID).productName("赛博朋克联名耳机").brand("NeonSound")
                .category("数码配件").priceCents(129_900).source(StarProductOnboard.Source.CREATOR)
                .submittedBy("@neon_v_official").mcnName("AI Star MCN").step(4)
                .platformSample(StarSampleStatus.DELIVERED).celebSample(StarSampleStatus.DELIVERED)
                .submittedAt(at("2026-05-05T10:00"))
                .trackingPlatform("SF1234567890").trackingCeleb("JD9876543210").build());
        onboardRepo.save(StarProductOnboard.builder()
                .id("po3").starId(STAR_ID).productName("智能健康监测手环").brand("VitalTech")
                .category("智能穿戴").priceCents(59_900).source(StarProductOnboard.Source.CREATOR)
                .submittedBy("@topstar_douyin").mcnName("TopCreator MCN").step(2)
                .submittedAt(at("2026-05-06T10:00"))
                .platformNote("平台已通过初审，待明星确认").build());
        onboardRepo.save(StarProductOnboard.builder()
                .id("po4").starId(STAR_ID).productName("限量版联名运动鞋").brand("HyperStep")
                .category("运动服饰").priceCents(219_900).source(StarProductOnboard.Source.BRAND)
                .submittedBy("HyperStep官方").step(1)
                .submittedAt(at("2026-05-07T10:00")).build());
        // po5 = 商品库条目 pl1（已入库）
        onboardRepo.save(StarProductOnboard.builder()
                .id("po5").starId(STAR_ID).productName("AI香薰智能音箱").brand("ScentAI")
                .category("家居生活").priceCents(89_900).source(StarProductOnboard.Source.PLATFORM)
                .submittedBy("平台运营组").mcnName("AI Star MCN").step(5)
                .platformSample(StarSampleStatus.APPROVED).celebSample(StarSampleStatus.APPROVED)
                .submittedAt(at("2026-04-28T10:00"))
                .libraryAt(LocalDate.parse("2026-05-06")).salesCount(342).build());
        onboardRepo.save(StarProductOnboard.builder()
                .id("po6").starId(STAR_ID).productName("数字游民背包").brand("NomadGear")
                .category("箱包").priceCents(78_900).source(StarProductOnboard.Source.CREATOR)
                .submittedBy("@luna_soft_ks").mcnName("HypeStar Studio").step(3)
                .platformSample(StarSampleStatus.SHIPPING).celebSample(StarSampleStatus.SHIPPING)
                .submittedAt(at("2026-05-04T10:00"))
                .trackingPlatform("YT5566778899").trackingCeleb("SF6677889900").build());
        // 商品库存量条目（step=5）
        onboardRepo.save(StarProductOnboard.builder()
                .id("po-lib2").starId(STAR_ID).productName("次世代护肤套装").brand("CyberGlow")
                .category("美妆护肤").priceCents(118_000).source(StarProductOnboard.Source.PLATFORM)
                .submittedBy("平台运营组").mcnName("AI Star MCN").step(5)
                .platformSample(StarSampleStatus.APPROVED).celebSample(StarSampleStatus.APPROVED)
                .submittedAt(at("2026-04-15T10:00"))
                .libraryAt(LocalDate.parse("2026-04-20")).salesCount(891).build());
        onboardRepo.save(StarProductOnboard.builder()
                .id("po-lib3").starId(STAR_ID).productName("赤红联名手表").brand("CrimsonTime")
                .category("配饰").priceCents(329_900).source(StarProductOnboard.Source.BRAND)
                .submittedBy("CrimsonTime官方").mcnName("TopCreator MCN").step(5)
                .platformSample(StarSampleStatus.APPROVED).celebSample(StarSampleStatus.APPROVED)
                .submittedAt(at("2026-04-10T10:00"))
                .libraryAt(LocalDate.parse("2026-04-15")).salesCount(128).build());
        onboardRepo.save(StarProductOnboard.builder()
                .id("po-lib4").starId(STAR_ID).productName("轻薄防晒外套").brand("CoolShade")
                .category("运动服饰").priceCents(45_900).source(StarProductOnboard.Source.CREATOR)
                .submittedBy("@neon_v_official").mcnName("AI Star MCN").step(5)
                .platformSample(StarSampleStatus.APPROVED).celebSample(StarSampleStatus.APPROVED)
                .submittedAt(at("2026-03-25T10:00"))
                .libraryAt(LocalDate.parse("2026-03-30")).salesCount(2341).build());
    }

    private void seedBrandAuths() {
        brandRepo.save(StarBrandAuthRequest.builder()
                .id("ba1").starId(STAR_ID).brandName("安踏运动")
                .authTypes(List.of("人像授权", "代言授权"))
                .purpose("2026秋冬系列运动服装代言，线上线下全渠道")
                .durationMonths(24).amountCents(580_000_000L)
                .platforms(List.of("抖音", "微博", "小红书", "线下广告"))
                .status(StarBrandAuthRequest.Status.SAMPLE_STAGE)
                .platformSample(StarSampleStatus.APPROVED).celebSample(StarSampleStatus.SHIPPING)
                .submittedAt(at("2026-05-02T10:00")).build());
        brandRepo.save(StarBrandAuthRequest.builder()
                .id("ba2").starId(STAR_ID).brandName("CyberGlow护肤")
                .authTypes(List.of("人像授权", "联名授权"))
                .purpose("与艺人共同推出限量联名护肤产品线")
                .durationMonths(12).amountCents(120_000_000L)
                .platforms(List.of("抖音", "小红书", "天猫"))
                .status(StarBrandAuthRequest.Status.CELEB_REVIEW)
                .platformSample(StarSampleStatus.APPROVED).celebSample(StarSampleStatus.NOT_SENT)
                .submittedAt(at("2026-05-05T10:00"))
                .platformNote("平台已审核合规，建议明星同意，品牌调性匹配").build());
        brandRepo.save(StarBrandAuthRequest.builder()
                .id("ba3").starId(STAR_ID).brandName("NeonSound音频")
                .authTypes(List.of("AI声音授权"))
                .purpose("AI语音合成用于品牌广告音频")
                .durationMonths(6).amountCents(45_000_000L)
                .platforms(List.of("抖音", "网易云音乐"))
                .status(StarBrandAuthRequest.Status.APPROVED)
                .platformSample(StarSampleStatus.APPROVED).celebSample(StarSampleStatus.APPROVED)
                .submittedAt(at("2026-04-20T10:00")).build());
    }

    private void seedRules() {
        record Tpl(String name, StarContentRule.Zone zone, boolean enabled, String desc) {}
        List<Tpl> tpls = List.of(
                new Tpl("官方切片直接使用", StarContentRule.Zone.GREEN, true, "经纪方认证的官方切片素材可直接使用，无需额外申请"),
                new Tpl("允许AI字幕与剪辑重组", StarContentRule.Zone.YELLOW, true, "可对视频添加AI字幕、合规剪辑，发布时须声明AI辅助"),
                new Tpl("AI语音合成（有限制）", StarContentRule.Zone.ORANGE, false, "需另签AI声音授权协议，相似度须控制在80%以下"),
                new Tpl("AI形象虚拟创作", StarContentRule.Zone.RED, false, "完全禁用，需持有专属AI形象授权包方可开启")
        );
        int order = 0;
        for (Tpl t : tpls) {
            ruleRepo.save(StarContentRule.builder()
                    .id("cr-" + STAR_ID + "-" + (++order)).starId(STAR_ID)
                    .name(t.name()).zone(t.zone()).enabled(t.enabled())
                    .description(t.desc()).sortOrder(order).build());
        }
    }

    private void seedInfringements() {
        infringementRepo.save(StarInfringementCase.builder()
                .id("INF-001").starId(STAR_ID).platform("YouTube")
                .url("https://youtube.com/watch?v=demo-001").ipName("沈腾声线")
                .severity(StarInfringementCase.Severity.HIGH).status(StarInfringementCase.Status.PENDING)
                .reportedBy("粉丝举报").reportedAt(at("2026-06-05T14:30"))
                .description("发现未经授权使用沈腾声线制作配音视频，已获得大量播放").build());
        infringementRepo.save(StarInfringementCase.builder()
                .id("INF-002").starId(STAR_ID).platform("Bilibili")
                .url("https://bilibili.com/video/demo-002").ipName("沈腾形象")
                .severity(StarInfringementCase.Severity.MEDIUM).status(StarInfringementCase.Status.INVESTIGATING)
                .reportedBy("自动监测").reportedAt(at("2026-06-04T09:15"))
                .description("疑似使用沈腾数字形象进行商业直播").build());
        infringementRepo.save(StarInfringementCase.builder()
                .id("INF-003").starId(STAR_ID).platform("TikTok")
                .url("https://tiktok.com/@demo-003").ipName("沈腾声线")
                .severity(StarInfringementCase.Severity.LOW).status(StarInfringementCase.Status.CONFIRMED)
                .reportedBy("用户投诉").reportedAt(at("2026-06-03T16:45"))
                .description("使用沈腾声线制作短视频片段").build());
        infringementRepo.save(StarInfringementCase.builder()
                .id("INF-004").starId(STAR_ID).platform("抖音")
                .url("https://douyin.com/demo-004").ipName("沈腾形象")
                .severity(StarInfringementCase.Severity.HIGH).status(StarInfringementCase.Status.RESOLVED)
                .reportedBy("粉丝举报").reportedAt(at("2026-06-02T11:20"))
                .description("未经授权使用沈腾数字人形象带货，已下架处理").build());
        infringementRepo.save(StarInfringementCase.builder()
                .id("INF-005").starId(STAR_ID).platform("微博")
                .url("https://weibo.com/demo-005").ipName("沈腾形象")
                .severity(StarInfringementCase.Severity.MEDIUM).status(StarInfringementCase.Status.INVESTIGATING)
                .reportedBy("自动监测").reportedAt(at("2026-06-01T08:00"))
                .description("疑似盗用官方宣传图片用于商业推广").build());
    }

    private void seedContracts() {
        contractRepo.save(StarContract.builder()
                .id("CON-2026-001").starId(STAR_ID).title("切片素材授权合同")
                .type(StarContract.ContractType.AUTHORIZATION).mcnName("AI Star MCN").ipName("沈腾切片库")
                .signDate(LocalDate.parse("2026-01-15")).startDate(LocalDate.parse("2026-01-20"))
                .endDate(LocalDate.parse("2027-01-19")).amountCents(50_000_000L)
                .status(StarContract.Status.ACTIVE).build());
        contractRepo.save(StarContract.builder()
                .id("CON-2026-002").starId(STAR_ID).title("数字人形象授权合同")
                .type(StarContract.ContractType.AUTHORIZATION).mcnName("TopCreator MCN").ipName("沈腾数字人")
                .signDate(LocalDate.parse("2026-02-10")).startDate(LocalDate.parse("2026-02-15"))
                .endDate(LocalDate.parse("2027-02-14")).amountCents(80_000_000L)
                .status(StarContract.Status.ACTIVE).build());
        contractRepo.save(StarContract.builder()
                .id("AMD-2026-001").starId(STAR_ID).title("切片授权范围补充协议")
                .type(StarContract.ContractType.AMENDMENT).mcnName("AI Star MCN").ipName("沈腾切片库")
                .signDate(LocalDate.parse("2026-03-01")).startDate(LocalDate.parse("2026-03-01"))
                .endDate(LocalDate.parse("2027-01-19")).amountCents(15_000_000L)
                .status(StarContract.Status.ACTIVE).build());
        contractRepo.save(StarContract.builder()
                .id("SET-2026-001").starId(STAR_ID).title("2026年Q1结算单")
                .type(StarContract.ContractType.SETTLEMENT).mcnName("AI Star MCN").ipName("沈腾切片库")
                .signDate(LocalDate.parse("2026-04-05")).startDate(LocalDate.parse("2026-01-01"))
                .endDate(LocalDate.parse("2026-03-31")).amountCents(12_560_000L)
                .status(StarContract.Status.ACTIVE).build());
        contractRepo.save(StarContract.builder()
                .id("CON-2025-005").starId(STAR_ID).title("AI声音授权合同")
                .type(StarContract.ContractType.AUTHORIZATION).mcnName("HypeStar Studio").ipName("沈腾声线")
                .signDate(LocalDate.parse("2025-06-10")).startDate(LocalDate.parse("2025-06-15"))
                .endDate(LocalDate.parse("2026-06-14")).amountCents(60_000_000L)
                .status(StarContract.Status.EXPIRED).build());
        contractRepo.save(StarContract.builder()
                .id("CON-2026-003").starId(STAR_ID).title("全身形象授权合同")
                .type(StarContract.ContractType.AUTHORIZATION).mcnName("CyberMCN").ipName("沈腾形象")
                .signDate(LocalDate.parse("2026-03-20")).startDate(LocalDate.parse("2026-04-01"))
                .endDate(LocalDate.parse("2027-03-31")).amountCents(70_000_000L)
                .status(StarContract.Status.PENDING).build());
    }

    private void seedRevenue() {
        record Row(String month, long gmv, long amount, StarRevenueMonth.Status status) {}
        List<Row> rows = List.of(
                new Row("2026-01", 0, 0, StarRevenueMonth.Status.PAID),
                new Row("2026-02", 0, 0, StarRevenueMonth.Status.PAID),
                new Row("2026-03", 8_400_000L, 840_000L, StarRevenueMonth.Status.PAID),
                new Row("2026-04", 21_800_000L, 2_180_000L, StarRevenueMonth.Status.PAID),
                new Row("2026-05", 16_200_000L, 1_620_000L, StarRevenueMonth.Status.PROCESSING)
        );
        for (Row r : rows) {
            revenueRepo.save(StarRevenueMonth.builder()
                    .id("rev-" + STAR_ID + "-" + r.month()).starId(STAR_ID)
                    .month(r.month()).gmvCents(r.gmv()).sharePercent(10)
                    .amountCents(r.amount()).status(r.status()).build());
        }
    }
}
