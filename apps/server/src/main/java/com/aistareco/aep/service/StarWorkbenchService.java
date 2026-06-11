package com.aistareco.aep.service;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 明星商务工作台（web-star，v0.60）核心服务。
 *
 * 职责：
 * <ul>
 *   <li>入驻（onboard）：创建 celebrity 域 {@link CelebrityStar} 档案 + 账号绑定 +
 *       初始化 4 类 IP 资产与默认内容规则 —— 明星随即出现在 web-celebrity 明星市场。</li>
 *   <li>带货授权（cooperation）：审批 web-celebrity 创作者发起的
 *       {@link CelebrityStarAuthorization}（pending → authorized / unauthorized）。</li>
 *   <li>商品报备（filing）：web-celebrity 公共商品池 → {@link StarProductOnboard}
 *       6 步入库流程；step=5 即「商品库」。</li>
 *   <li>其余模块（IP 资产 / 报白 / 数字人 / AI 形象 / 内容 / 品牌 / 规则 / 侵权 /
 *       合同 / 收益）的列表与状态机操作。</li>
 * </ul>
 *
 * 所有状态机「只前进不回退」；驳回 / 回改是终态分支，需重新发起单据（审计链完整）。
 */
@Service
public class StarWorkbenchService {

    private static final Logger log = LoggerFactory.getLogger(StarWorkbenchService.class);

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
    private final CelebrityStarRepository starRepo;
    private final CelebrityStarAuthorizationRepository celebrityAuthRepo;
    private final ProductRepository productRepo;
    private final AepUserRepository userRepo;
    private final NotificationPublisher notificationPublisher;
    private final ObjectMapper objectMapper;

    public StarWorkbenchService(StarAccountRepository accountRepo,
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
                                CelebrityStarRepository starRepo,
                                CelebrityStarAuthorizationRepository celebrityAuthRepo,
                                ProductRepository productRepo,
                                AepUserRepository userRepo,
                                NotificationPublisher notificationPublisher,
                                ObjectMapper objectMapper) {
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
        this.starRepo = starRepo;
        this.celebrityAuthRepo = celebrityAuthRepo;
        this.productRepo = productRepo;
        this.userRepo = userRepo;
        this.notificationPublisher = notificationPublisher;
        this.objectMapper = objectMapper;
    }

    // ── 账号绑定 / 档案 ──────────────────────────────────────────────────────

    /** 解析当前账号绑定的明星；未入驻 → 404 STAR_NOT_ONBOARDED（前端跳 /onboard）。 */
    public StarAccount requireAccount(String userId) {
        return accountRepo.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STAR_NOT_ONBOARDED",
                        "当前账号尚未绑定明星档案，请先完成入驻"));
    }

    /** 档案；未入驻返回 null（前端据此引导入驻，而非报错）。 */
    public StarProfileDto getProfile(String userId) {
        StarAccount account = accountRepo.findByUserId(userId).orElse(null);
        if (account == null) return null;
        CelebrityStar star = starRepo.findById(account.getStarId()).orElse(null);
        if (star == null) {
            log.warn("[star] dangling binding userId={} starId={}", userId, account.getStarId());
            return null;
        }
        return toProfile(account, star);
    }

    private StarProfileDto toProfile(StarAccount account, CelebrityStar star) {
        long fans = star.getFans() != null ? star.getFans() : 0;
        return new StarProfileDto(
                star.getId(),
                star.getName(),
                star.getAvatar(),
                star.getCategory(),
                tierLabel(fans),
                fans,
                account.isAgentView(),
                account.getCreatedAt() != null ? account.getCreatedAt().toString() : null,
                star.getCover(),
                star.getDescription(),
                star.getBio(),
                star.getLocation()
        );
    }

    /**
     * 档案编辑（v0.62：从 admin PUT /admin/celebrity/stars/{id} 移入 star 端）。
     * 仅开放营销 / 展示字段；平台运营字段（isHot / pricingTier / quota / pricing）
     * 不在此接口范围。avatar / cover 留空 = 不变更。
     */
    @Transactional
    public StarProfileDto updateProfile(String userId, StarProfileUpdateRequestDto req) {
        StarAccount account = requireAccount(userId);
        CelebrityStar star = starRepo.findById(account.getStarId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STAR_NOT_FOUND", "明星档案不存在"));
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw BusinessException.badRequest("STAR_NAME_REQUIRED", "请填写艺名 / 姓名");
        }
        if (req.description() == null || req.description().isBlank()) {
            throw BusinessException.badRequest("STAR_DESCRIPTION_REQUIRED", "请填写一句话定位");
        }
        star.setName(req.name().trim());
        star.setDescription(req.description().trim());
        if (req.category() != null && !req.category().isBlank()) {
            star.setCategory(req.category().trim());
        }
        if (req.fans() != null) {
            star.setFans(Math.max(0, req.fans()));
        }
        if (req.bio() != null) {
            star.setBio(req.bio().isBlank() ? null : req.bio().trim());
        }
        if (req.location() != null) {
            star.setLocation(req.location().isBlank() ? null : req.location().trim());
        }
        if (req.avatar() != null && !req.avatar().isBlank()) {
            star.setAvatar(req.avatar().trim());
        }
        if (req.cover() != null && !req.cover().isBlank()) {
            star.setCover(req.cover().trim());
        }
        starRepo.save(star);
        log.info("[star] profile updated userId={} starId={}", userId, star.getId());
        return toProfile(account, star);
    }

    /** 艺人分级（展示用）：S级 ≥ 1000万粉，A级 ≥ 100万粉，其余「新晋」。 */
    private static String tierLabel(long fans) {
        if (fans >= 10_000_000) return "S级";
        if (fans >= 1_000_000) return "A级";
        return "新晋";
    }

    /**
     * 明星入驻：创建 CelebrityStar（celebrity 市场立即可见）+ 账号绑定 +
     * 4 类 IP 资产（notStarted）+ 默认四区内容规则。
     */
    @Transactional
    public StarProfileDto onboard(String userId, StarOnboardRequestDto req) {
        if (accountRepo.findByUserId(userId).isPresent()) {
            throw new BusinessException(HttpStatus.CONFLICT, "STAR_ALREADY_ONBOARDED", "当前账号已绑定明星档案");
        }
        if (req.name() == null || req.name().isBlank()) {
            throw BusinessException.badRequest("STAR_NAME_REQUIRED", "请填写艺名 / 姓名");
        }
        if (req.description() == null || req.description().isBlank()) {
            throw BusinessException.badRequest("STAR_DESCRIPTION_REQUIRED", "请填写一句话定位");
        }
        long fans = req.fans() != null ? Math.max(0, req.fans()) : 0;
        int priceCents = req.startingPriceCents() != null ? Math.max(0, req.startingPriceCents()) : 29_900;
        String category = req.category() != null && !req.category().isBlank() ? req.category() : "演员";

        String starId = "star-" + UUID.randomUUID().toString().substring(0, 8);
        CelebrityStar star = CelebrityStar.builder()
                .id(starId)
                .name(req.name().trim())
                .avatar("https://i.pravatar.cc/200?u=" + starId)
                .cover("https://picsum.photos/seed/" + starId + "/600/800")
                .category(category)
                .subCategories(new ArrayList<>())
                .isHot(false)
                .description(req.description().trim())
                .startingPrice("¥" + (priceCents / 100) + "起")
                .authorizationJson(toJson(Map.of(
                        "status", "unauthorized",
                        "scenes", List.of(),
                        "availableStyles", 4,
                        "applyUrl", "/star/" + starId + "/apply"
                )))
                .statsJson(toJson(Map.of(
                        "totalGenerated", 0,
                        "totalPlays", "—",
                        "conversionRate", "—",
                        "gmv", "—"
                )))
                .sampleVideosJson(toJson(List.of()))
                .pricingJson(toJson(List.of(
                        Map.of("name", "体验版", "price", "¥" + (priceCents / 100), "quota", 10, "perks", List.of("10 条生成额度", "基础风格")),
                        Map.of("name", "标准版", "price", "¥" + (priceCents / 100 * 3), "quota", 50, "perks", List.of("50 条生成额度", "全部风格", "优先审核")),
                        Map.of("name", "旗舰版", "price", "议价", "quota", 200, "perks", List.of("200 条生成额度", "专属经纪对接", "定制场景"))
                )))
                .bio(req.bio())
                .location(req.location())
                .fans(fans)
                .cooperationCount(0)
                .build();
        starRepo.save(star);

        StarAccount account = StarAccount.builder()
                .id("sa-" + UUID.randomUUID().toString().substring(0, 8))
                .userId(userId)
                .starId(starId)
                .agentView(Boolean.TRUE.equals(req.agentView()))
                .createdAt(Instant.now())
                .build();
        accountRepo.save(account);

        seedDefaultIpAssets(starId);
        seedDefaultRules(starId);

        notificationPublisher.notifyAdmins(Notification.NotificationType.SYSTEM,
                "新明星入驻", "明星「" + star.getName() + "」已通过明星商务工作台入驻，档案已上架明星市场", userId);
        log.info("[star] onboarded userId={} starId={} name={}", userId, starId, star.getName());
        return toProfile(account, star);
    }

    private void seedDefaultIpAssets(String starId) {
        record Tpl(StarIpAsset.AssetType type, String techCompany, int requiredFiles) {}
        List<Tpl> tpls = List.of(
                new Tpl(StarIpAsset.AssetType.PORTRAIT, "数字孪生科技（北京）", 32),
                new Tpl(StarIpAsset.AssetType.CLIP, "数字孪生科技（北京）", 50),
                new Tpl(StarIpAsset.AssetType.DIGITAL_HUMAN, "灵镜AI Lab", 10),
                new Tpl(StarIpAsset.AssetType.DOCUMENTS, "法务合规中心", 4)
        );
        for (Tpl t : tpls) {
            ipAssetRepo.save(StarIpAsset.builder()
                    .id("ip-" + starId + "-" + t.type().wire())
                    .starId(starId)
                    .type(t.type())
                    .status(StarIpAsset.AssetStatus.NOT_STARTED)
                    .techCompany(t.techCompany())
                    .filesCount(0)
                    .requiredFiles(t.requiredFiles())
                    .build());
        }
    }

    private void seedDefaultRules(String starId) {
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
                    .id("cr-" + starId + "-" + (++order))
                    .starId(starId)
                    .name(t.name())
                    .zone(t.zone())
                    .enabled(t.enabled())
                    .description(t.desc())
                    .sortOrder(order)
                    .build());
        }
    }

    // ── 总览 ─────────────────────────────────────────────────────────────────

    public StarOverviewDto getOverview(String userId) {
        StarAccount account = requireAccount(userId);
        String starId = account.getStarId();

        int pendingIp = (int) ipAssetRepo.findByStarIdOrderByTypeAsc(starId).stream()
                .filter(a -> a.getStatus() != StarIpAsset.AssetStatus.ACTIVE).count();
        int pendingCoop = (int) celebrityAuthRepo.findByStarIdOrderByCreatedAtDesc(starId).stream()
                .filter(a -> a.getStatus() == CelebrityAuthStatus.PENDING).count();
        int pendingWl = (int) whitelistRepo.findByStarIdOrderByRequestedAtDesc(starId).stream()
                .filter(r -> r.getStatus() == StarWhitelistRequest.Status.PENDING).count();
        int pendingDh = (int) dhRepo.findByStarIdOrderByRequestedAtDesc(starId).stream()
                .filter(r -> r.getStatus() == StarReviewStatus.PENDING).count();
        int pendingAi = (int) aiRepo.findByStarIdOrderByRequestedAtDesc(starId).stream()
                .filter(r -> r.getStatus() == StarReviewStatus.PENDING).count();
        int pendingContent = (int) contentRepo.findByStarIdOrderBySubmittedAtDesc(starId).stream()
                .filter(r -> r.getStatus() == StarContentReview.Status.PENDING).count();
        List<StarProductOnboard> onboards = onboardRepo.findByStarIdOrderBySubmittedAtDesc(starId);
        int pendingProduct = (int) onboards.stream().filter(p ->
                p.getStep() == 2
                        || (p.getStep() == 3 && p.getCelebSample() == StarSampleStatus.SHIPPING)
                        || (p.getStep() == 4 && p.getCelebSample() == StarSampleStatus.DELIVERED)).count();
        List<StarBrandAuthRequest> brands = brandRepo.findByStarIdOrderBySubmittedAtDesc(starId);
        int pendingBrand = (int) brands.stream().filter(b ->
                b.getStatus() == StarBrandAuthRequest.Status.CELEB_REVIEW
                        || (b.getStatus() == StarBrandAuthRequest.Status.SAMPLE_STAGE
                            && (b.getCelebSample() == StarSampleStatus.SHIPPING || b.getCelebSample() == StarSampleStatus.DELIVERED))).count();

        int ipTotal = ipAssetRepo.findByStarIdOrderByTypeAsc(starId).size();
        int productLib = (int) onboards.stream().filter(p -> p.getStep() == 5).count();
        int activeBrand = (int) brands.stream().filter(b -> b.getStatus() == StarBrandAuthRequest.Status.APPROVED).count();

        List<StarRevenueMonth> months = revenueRepo.findByStarIdOrderByMonthAsc(starId);
        String currentMonth = LocalDate.now().toString().substring(0, 7);
        StarRevenueMonth cur = months.stream().filter(m -> m.getMonth().equals(currentMonth)).findFirst()
                .orElse(months.isEmpty() ? null : months.get(months.size() - 1));
        StarRevenueMonth prev = null;
        if (cur != null) {
            int idx = months.indexOf(cur);
            if (idx > 0) prev = months.get(idx - 1);
        }
        long monthGmv = cur != null ? cur.getGmvCents() : 0;
        int delta = (prev != null && prev.getGmvCents() > 0)
                ? (int) Math.round((monthGmv - prev.getGmvCents()) * 100.0 / prev.getGmvCents())
                : 0;
        long monthRevenue = cur != null ? cur.getAmountCents() : 0;

        int total = pendingIp + pendingCoop + pendingWl + pendingDh + pendingAi + pendingContent + pendingProduct + pendingBrand;
        return new StarOverviewDto(
                ipTotal - pendingIp, ipTotal, total, productLib, activeBrand,
                monthGmv, delta, monthRevenue,
                List.of(
                        new StarOverviewDto.StarPendingModuleDto("ipAuth", pendingIp),
                        new StarOverviewDto.StarPendingModuleDto("cooperation", pendingCoop),
                        new StarOverviewDto.StarPendingModuleDto("whitelist", pendingWl),
                        new StarOverviewDto.StarPendingModuleDto("digitalHuman", pendingDh),
                        new StarOverviewDto.StarPendingModuleDto("aiLikeness", pendingAi),
                        new StarOverviewDto.StarPendingModuleDto("contentReview", pendingContent),
                        new StarOverviewDto.StarPendingModuleDto("productOnboard", pendingProduct),
                        new StarOverviewDto.StarPendingModuleDto("brandAuth", pendingBrand)
                )
        );
    }

    // ── IP 授权中心 ──────────────────────────────────────────────────────────

    public List<StarIpAssetDto> listIpAssets(String userId) {
        StarAccount account = requireAccount(userId);
        return ipAssetRepo.findByStarIdOrderByTypeAsc(account.getStarId()).stream()
                .map(StarIpAssetDto::from).toList();
    }

    @Transactional
    public StarIpAssetDto advanceIpAsset(String userId, String typeWire) {
        StarAccount account = requireAccount(userId);
        StarIpAsset.AssetType type = StarIpAsset.AssetType.fromWire(typeWire);
        StarIpAsset asset = ipAssetRepo.findByStarIdAndType(account.getStarId(), type)
                .orElseThrow(() -> BusinessException.notFound("IP_ASSET_NOT_FOUND", "IP 资产不存在"));
        if (asset.getStatus() == StarIpAsset.AssetStatus.ACTIVE) {
            return StarIpAssetDto.from(asset);
        }
        StarIpAsset.AssetStatus next = asset.getStatus().next();
        asset.setStatus(next);
        if (next == StarIpAsset.AssetStatus.UPLOADED) {
            if (asset.getUploadedAt() == null) asset.setUploadedAt(LocalDate.now());
            // 上传完成视为文件齐备
            asset.setFilesCount(Math.max(asset.getFilesCount(), asset.getRequiredFiles()));
        }
        if (next == StarIpAsset.AssetStatus.TECH_RECEIVED && asset.getVolcanoProjectId() == null) {
            asset.setVolcanoProjectId("VK-" + type.name().substring(0, Math.min(3, type.name().length()))
                    + "-" + LocalDate.now().getYear() + "-" + String.format("%03d", ThreadLocalRandom.current().nextInt(1, 999)));
        }
        if (next == StarIpAsset.AssetStatus.ACTIVE && asset.getActivatedAt() == null) {
            asset.setActivatedAt(LocalDate.now());
        }
        ipAssetRepo.save(asset);
        return StarIpAssetDto.from(asset);
    }

    // ── 带货授权（celebrity ↔ star 打通核心） ────────────────────────────────

    public List<StarCooperationRequestDto> listCooperations(String userId, String status) {
        StarAccount account = requireAccount(userId);
        return celebrityAuthRepo.findByStarIdOrderByCreatedAtDesc(account.getStarId()).stream()
                .filter(a -> status == null || status.isBlank() || a.getStatus().wire().equals(status))
                .map(a -> StarCooperationRequestDto.from(a, applicantName(a.getUserId())))
                .toList();
    }

    private String applicantName(String userId) {
        return userRepo.findById(userId)
                .map(u -> u.getDisplayName() != null && !u.getDisplayName().isBlank() ? u.getDisplayName() : u.getUsername())
                .orElse(userId);
    }

    @Transactional
    public StarCooperationRequestDto approveCooperation(String userId, String id, StarCooperationDecisionDto decision) {
        StarAccount account = requireAccount(userId);
        CelebrityStarAuthorization auth = requireOwnCooperation(account, id);
        if (auth.getStatus() != CelebrityAuthStatus.PENDING) {
            throw BusinessException.badRequest("COOPERATION_NOT_PENDING", "该申请已处理，不能重复审批");
        }
        List<String> scenes = decision != null && decision.scenes() != null && !decision.scenes().isEmpty()
                ? decision.scenes()
                : (auth.getScenes() != null && !auth.getScenes().isEmpty() ? auth.getScenes() : List.of("带货"));
        int months = decision != null && decision.expireMonths() != null ? Math.max(1, decision.expireMonths()) : 6;
        int styles = decision != null && decision.availableStyles() != null ? Math.max(1, decision.availableStyles()) : 4;
        auth.setStatus(CelebrityAuthStatus.AUTHORIZED);
        auth.setScenes(new ArrayList<>(scenes));
        auth.setExpireDate(LocalDate.now().plusMonths(months));
        auth.setAvailableStyles(styles);
        auth.setPendingNote(null);
        celebrityAuthRepo.save(auth);

        String starName = starRepo.findById(account.getStarId()).map(CelebrityStar::getName).orElse("明星");
        notificationPublisher.notifyUser(auth.getUserId(), Notification.NotificationType.SYSTEM,
                "明星授权已批准",
                "「" + starName + "」已批准你的带货授权（" + String.join("、", scenes) + "），有效期至 " + auth.getExpireDate());
        log.info("[star] cooperation approved id={} star={} applicant={}", id, account.getStarId(), auth.getUserId());
        return StarCooperationRequestDto.from(auth, applicantName(auth.getUserId()));
    }

    @Transactional
    public StarCooperationRequestDto rejectCooperation(String userId, String id, String reason) {
        StarAccount account = requireAccount(userId);
        CelebrityStarAuthorization auth = requireOwnCooperation(account, id);
        if (auth.getStatus() != CelebrityAuthStatus.PENDING) {
            throw BusinessException.badRequest("COOPERATION_NOT_PENDING", "该申请已处理，不能重复审批");
        }
        auth.setStatus(CelebrityAuthStatus.UNAUTHORIZED);
        auth.setScenes(new ArrayList<>());
        auth.setExpireDate(null);
        auth.setAvailableStyles(0);
        auth.setPendingNote(null);
        auth.setApplyUrl("/star/" + account.getStarId() + "/apply");
        if (reason != null && !reason.isBlank()) {
            auth.setApplicantNote(reason.trim());
        }
        celebrityAuthRepo.save(auth);

        String starName = starRepo.findById(account.getStarId()).map(CelebrityStar::getName).orElse("明星");
        notificationPublisher.notifyUser(auth.getUserId(), Notification.NotificationType.SYSTEM,
                "明星授权未通过",
                "「" + starName + "」暂未通过你的带货授权申请" + (reason != null && !reason.isBlank() ? "：" + reason : "，可调整方案后重新申请"));
        return StarCooperationRequestDto.from(auth, applicantName(auth.getUserId()));
    }

    private CelebrityStarAuthorization requireOwnCooperation(StarAccount account, String id) {
        CelebrityStarAuthorization auth = celebrityAuthRepo.findById(id)
                .orElseThrow(() -> BusinessException.notFound("COOPERATION_NOT_FOUND", "授权申请不存在"));
        if (!account.getStarId().equals(auth.getStarId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "FORBIDDEN", "无权操作其他明星的授权申请");
        }
        return auth;
    }

    /**
     * web-celebrity 创作者申请明星带货授权（打通入口，celebrity 端调用）。
     * upsert 至 PENDING；已 PENDING / AUTHORIZED 时幂等返回并报错提示。
     */
    @Transactional
    public CelebrityStarAuthorization applyAuthorization(String applicantUserId, String starId, CelebrityAuthApplyDto req) {
        CelebrityStar star = starRepo.findById(starId)
                .orElseThrow(() -> BusinessException.notFound("STAR_NOT_FOUND", "明星不存在"));
        CelebrityStarAuthorization auth = celebrityAuthRepo.findByUserIdAndStarId(applicantUserId, starId).orElse(null);
        if (auth != null && auth.getStatus() == CelebrityAuthStatus.PENDING) {
            throw new BusinessException(HttpStatus.CONFLICT, "AUTH_ALREADY_PENDING", "你已提交过申请，正在等待经纪团队复核");
        }
        if (auth != null && auth.getStatus() == CelebrityAuthStatus.AUTHORIZED) {
            throw new BusinessException(HttpStatus.CONFLICT, "AUTH_ALREADY_AUTHORIZED", "你已持有该明星的有效授权");
        }
        List<String> scenes = req != null && req.scenes() != null ? req.scenes() : List.of();
        if (auth == null) {
            auth = CelebrityStarAuthorization.builder()
                    .id("auth-" + UUID.randomUUID().toString().substring(0, 8))
                    .userId(applicantUserId)
                    .starId(starId)
                    .status(CelebrityAuthStatus.PENDING)
                    .scenes(new ArrayList<>(scenes))
                    .availableStyles(0)
                    .pendingNote("经纪团队复核中（48h SLA）")
                    .applicantNote(req != null ? req.note() : null)
                    .build();
        } else {
            auth.setStatus(CelebrityAuthStatus.PENDING);
            auth.setScenes(new ArrayList<>(scenes));
            auth.setExpireDate(null);
            auth.setPendingNote("经纪团队复核中（48h SLA）");
            auth.setApplicantNote(req != null ? req.note() : null);
        }
        celebrityAuthRepo.save(auth);
        log.info("[star] authorization applied applicant={} star={} scenes={}", applicantUserId, starId, scenes);
        notificationPublisher.notifyAdmins(Notification.NotificationType.SYSTEM,
                "新带货授权申请", "用户向明星「" + star.getName() + "」发起带货授权申请，等待明星端审批", applicantUserId);
        return auth;
    }

    // ── 报白 ─────────────────────────────────────────────────────────────────

    public List<StarWhitelistRequestDto> listWhitelist(String userId) {
        StarAccount account = requireAccount(userId);
        return whitelistRepo.findByStarIdOrderByRequestedAtDesc(account.getStarId()).stream()
                .map(StarWhitelistRequestDto::from).toList();
    }

    @Transactional
    public StarWhitelistRequestDto advanceWhitelist(String userId, String id) {
        StarWhitelistRequest req = requireOwn(whitelistRepo.findById(id), userId, StarWhitelistRequest::getStarId,
                "WHITELIST_NOT_FOUND", "报白申请不存在");
        if (req.getStatus() != StarWhitelistRequest.Status.PENDING) {
            throw BusinessException.badRequest("WHITELIST_NOT_PENDING", "该申请已结束流程");
        }
        StarWhitelistRequest.Step next = req.getWhitelistStep().next();
        req.setWhitelistStep(next);
        if (next == StarWhitelistRequest.Step.AUTHORIZED) {
            req.setStatus(StarWhitelistRequest.Status.APPROVED);
        }
        whitelistRepo.save(req);
        return StarWhitelistRequestDto.from(req);
    }

    @Transactional
    public StarWhitelistRequestDto rejectWhitelist(String userId, String id) {
        StarWhitelistRequest req = requireOwn(whitelistRepo.findById(id), userId, StarWhitelistRequest::getStarId,
                "WHITELIST_NOT_FOUND", "报白申请不存在");
        req.setStatus(StarWhitelistRequest.Status.REJECTED);
        whitelistRepo.save(req);
        return StarWhitelistRequestDto.from(req);
    }

    // ── 数字人 / AI 形象 ─────────────────────────────────────────────────────

    public List<StarDigitalHumanRequestDto> listDigitalHuman(String userId) {
        StarAccount account = requireAccount(userId);
        return dhRepo.findByStarIdOrderByRequestedAtDesc(account.getStarId()).stream()
                .map(StarDigitalHumanRequestDto::from).toList();
    }

    @Transactional
    public StarDigitalHumanRequestDto decideDigitalHuman(String userId, String id, boolean approve) {
        StarDigitalHumanRequest req = requireOwn(dhRepo.findById(id), userId, StarDigitalHumanRequest::getStarId,
                "DH_REQUEST_NOT_FOUND", "数字人申请不存在");
        if (req.getStatus() != StarReviewStatus.PENDING) {
            throw BusinessException.badRequest("DH_REQUEST_NOT_PENDING", "该申请已处理");
        }
        req.setStatus(approve ? StarReviewStatus.APPROVED : StarReviewStatus.REJECTED);
        dhRepo.save(req);
        return StarDigitalHumanRequestDto.from(req);
    }

    public List<StarAiLikenessRequestDto> listAiLikeness(String userId) {
        StarAccount account = requireAccount(userId);
        return aiRepo.findByStarIdOrderByRequestedAtDesc(account.getStarId()).stream()
                .map(StarAiLikenessRequestDto::from).toList();
    }

    @Transactional
    public StarAiLikenessRequestDto decideAiLikeness(String userId, String id, boolean approve) {
        StarAiLikenessRequest req = requireOwn(aiRepo.findById(id), userId, StarAiLikenessRequest::getStarId,
                "AI_REQUEST_NOT_FOUND", "AI 形象申请不存在");
        if (req.getStatus() != StarReviewStatus.PENDING) {
            throw BusinessException.badRequest("AI_REQUEST_NOT_PENDING", "该申请已处理");
        }
        req.setStatus(approve ? StarReviewStatus.APPROVED : StarReviewStatus.REJECTED);
        aiRepo.save(req);
        return StarAiLikenessRequestDto.from(req);
    }

    // ── 内容审核 ─────────────────────────────────────────────────────────────

    public List<StarContentReviewDto> listContentReviews(String userId) {
        StarAccount account = requireAccount(userId);
        return contentRepo.findByStarIdOrderBySubmittedAtDesc(account.getStarId()).stream()
                .map(StarContentReviewDto::from).toList();
    }

    @Transactional
    public StarContentReviewDto decideContent(String userId, String id, StarContentReview.Status target, String note) {
        StarContentReview item = requireOwn(contentRepo.findById(id), userId, StarContentReview::getStarId,
                "CONTENT_NOT_FOUND", "内容不存在");
        if (item.getStatus() != StarContentReview.Status.PENDING) {
            throw BusinessException.badRequest("CONTENT_NOT_PENDING", "该内容已审核");
        }
        item.setStatus(target);
        if (target == StarContentReview.Status.REVISION) {
            item.setRevisionNote(note != null && !note.isBlank() ? note.trim() : "请按授权规则调整后重新提交");
        }
        contentRepo.save(item);
        return StarContentReviewDto.from(item);
    }

    // ── 商品入库（6 步 + 双路寄样） ──────────────────────────────────────────

    public List<StarProductOnboardDto> listProductOnboards(String userId) {
        StarAccount account = requireAccount(userId);
        return onboardRepo.findByStarIdOrderBySubmittedAtDesc(account.getStarId()).stream()
                .map(StarProductOnboardDto::from).toList();
    }

    /** 明星审核通过（step 2 → 3）：平台路样品默认验收，明星路开始寄样。 */
    @Transactional
    public StarProductOnboardDto approveProductOnboard(String userId, String id) {
        StarProductOnboard item = requireOwn(onboardRepo.findById(id), userId, StarProductOnboard::getStarId,
                "ONBOARD_NOT_FOUND", "入库单不存在");
        if (item.getStep() != 2) {
            throw BusinessException.badRequest("ONBOARD_NOT_AT_CELEB_REVIEW", "该入库单当前不在明星审核节点");
        }
        item.setStep(3);
        if (item.getPlatformSample() == StarSampleStatus.NOT_SENT) {
            item.setPlatformSample(StarSampleStatus.APPROVED);
        }
        if (item.getCelebSample() == StarSampleStatus.NOT_SENT) {
            item.setCelebSample(StarSampleStatus.SHIPPING);
            item.setTrackingCeleb("SF" + (1_000_000_000L + ThreadLocalRandom.current().nextLong(9_000_000_000L)));
        }
        onboardRepo.save(item);
        return StarProductOnboardDto.from(item);
    }

    @Transactional
    public StarProductOnboardDto rejectProductOnboard(String userId, String id) {
        StarProductOnboard item = requireOwn(onboardRepo.findById(id), userId, StarProductOnboard::getStarId,
                "ONBOARD_NOT_FOUND", "入库单不存在");
        if (item.getStep() >= 5) {
            throw BusinessException.badRequest("ONBOARD_ALREADY_FINAL", "该入库单已完结");
        }
        item.setStep(6);
        onboardRepo.save(item);
        notifyFilingProgress(item, "商品报备被驳回", "你报备的商品「" + item.getProductName() + "」未通过明星审核");
        return StarProductOnboardDto.from(item);
    }

    /** 明星样品签收（shipping → delivered；step 3 → 4）。 */
    @Transactional
    public StarProductOnboardDto receiveProductSample(String userId, String id) {
        StarProductOnboard item = requireOwn(onboardRepo.findById(id), userId, StarProductOnboard::getStarId,
                "ONBOARD_NOT_FOUND", "入库单不存在");
        if (item.getCelebSample() != StarSampleStatus.SHIPPING) {
            throw BusinessException.badRequest("SAMPLE_NOT_SHIPPING", "样品当前不在运输中");
        }
        item.setCelebSample(StarSampleStatus.DELIVERED);
        if (item.getStep() == 3) item.setStep(4);
        onboardRepo.save(item);
        return StarProductOnboardDto.from(item);
    }

    /** 明星样品确认（delivered → approved）；双路 approved → step 5 入库。 */
    @Transactional
    public StarProductOnboardDto confirmProductSample(String userId, String id) {
        StarProductOnboard item = requireOwn(onboardRepo.findById(id), userId, StarProductOnboard::getStarId,
                "ONBOARD_NOT_FOUND", "入库单不存在");
        if (item.getCelebSample() != StarSampleStatus.DELIVERED) {
            throw BusinessException.badRequest("SAMPLE_NOT_DELIVERED", "样品尚未签收，无法确认");
        }
        item.setCelebSample(StarSampleStatus.APPROVED);
        if (item.getPlatformSample() == StarSampleStatus.APPROVED) {
            item.setStep(5);
            item.setLibraryAt(LocalDate.now());
            notifyFilingProgress(item, "商品报备已入库",
                    "你报备的商品「" + item.getProductName() + "」已通过双路样品验收，正式进入明星商品库，可开始带货创作");
        }
        onboardRepo.save(item);
        return StarProductOnboardDto.from(item);
    }

    /** 报备进度站内通知（仅 celebrity 报备来源有报备人）。 */
    private void notifyFilingProgress(StarProductOnboard item, String title, String description) {
        if (item.getSubmittedByUserId() == null || item.getSubmittedByUserId().isBlank()) return;
        notificationPublisher.notifyUser(item.getSubmittedByUserId(), Notification.NotificationType.SYSTEM, title, description);
    }

    public List<StarProductLibItemDto> listProductLibrary(String userId) {
        StarAccount account = requireAccount(userId);
        return onboardRepo.findByStarIdAndStepOrderByLibraryAtDesc(account.getStarId(), 5).stream()
                .map(StarProductLibItemDto::from).toList();
    }

    // ── 商品报备（celebrity 端调用，打通入口） ────────────────────────────────

    /**
     * web-celebrity 创作者把公共商品池商品报备给明星。
     * 平台公共商品池本身已经运营审核 → 报备单直接落在 step=2（明星审核），
     * platformNote 标记来源；同一商品 × 同一明星存在未完结单时拒绝重复报备。
     */
    @Transactional
    public StarProductFilingDto fileProductToStar(String applicantUserId, String productId, String starId) {
        Product product = productRepo.findById(productId)
                .orElseThrow(() -> BusinessException.notFound("PRODUCT_NOT_FOUND", "商品不存在"));
        CelebrityStar star = starRepo.findById(starId)
                .orElseThrow(() -> BusinessException.notFound("STAR_NOT_FOUND", "明星不存在"));
        boolean hasActive = onboardRepo.findByProductIdAndStarId(productId, starId).stream()
                .anyMatch(p -> p.getStep() < 6 || p.getStep() == 5);
        if (hasActive) {
            throw new BusinessException(HttpStatus.CONFLICT, "FILING_ALREADY_EXISTS", "该商品已报备给这位明星，请勿重复报备");
        }
        String applicant = applicantName(applicantUserId);
        StarProductOnboard item = StarProductOnboard.builder()
                .id("po-" + UUID.randomUUID().toString().substring(0, 8))
                .starId(starId)
                .productId(productId)
                .submittedByUserId(applicantUserId)
                .productName(product.getName())
                .brand("")
                .category(product.getCategory())
                .priceCents(product.getPriceCents() != null ? product.getPriceCents() : 0)
                .source(StarProductOnboard.Source.CREATOR)
                .submittedBy(applicant)
                .mcnName(applicant)
                .step(2)
                .platformSample(StarSampleStatus.NOT_SENT)
                .celebSample(StarSampleStatus.NOT_SENT)
                .submittedAt(OffsetDateTime.now(ZoneOffset.ofHours(8)))
                .platformNote("商品来自公共商品池，平台已初审通过")
                .build();
        onboardRepo.save(item);
        log.info("[star] product filed applicant={} product={} star={}", applicantUserId, productId, starId);
        return StarProductFilingDto.from(item, star.getName());
    }

    /** celebrity 端回查：我报备的商品（可按 productId / starId 过滤）。 */
    public List<StarProductFilingDto> listFilings(String applicantUserId, String productId, String starId) {
        Map<String, String> starNames = new HashMap<>();
        return onboardRepo.findBySubmittedByUserIdOrderBySubmittedAtDesc(applicantUserId).stream()
                .filter(p -> productId == null || productId.equals(p.getProductId()))
                .filter(p -> starId == null || starId.equals(p.getStarId()))
                .map(p -> StarProductFilingDto.from(p, starNames.computeIfAbsent(p.getStarId(),
                        sid -> starRepo.findById(sid).map(CelebrityStar::getName).orElse(sid))))
                .toList();
    }

    // ── 品牌授权 ─────────────────────────────────────────────────────────────

    public List<StarBrandAuthRequestDto> listBrandAuths(String userId) {
        StarAccount account = requireAccount(userId);
        return brandRepo.findByStarIdOrderBySubmittedAtDesc(account.getStarId()).stream()
                .map(StarBrandAuthRequestDto::from).toList();
    }

    /** 明星批准（celebReview → sampleStage）：开始寄样验收。 */
    @Transactional
    public StarBrandAuthRequestDto approveBrandAuth(String userId, String id) {
        StarBrandAuthRequest item = requireOwn(brandRepo.findById(id), userId, StarBrandAuthRequest::getStarId,
                "BRAND_AUTH_NOT_FOUND", "品牌授权不存在");
        if (item.getStatus() != StarBrandAuthRequest.Status.CELEB_REVIEW) {
            throw BusinessException.badRequest("BRAND_AUTH_NOT_AT_CELEB_REVIEW", "该申请当前不在明星审核节点");
        }
        item.setStatus(StarBrandAuthRequest.Status.SAMPLE_STAGE);
        if (item.getCelebSample() == StarSampleStatus.NOT_SENT) {
            item.setCelebSample(StarSampleStatus.SHIPPING);
        }
        brandRepo.save(item);
        return StarBrandAuthRequestDto.from(item);
    }

    @Transactional
    public StarBrandAuthRequestDto rejectBrandAuth(String userId, String id) {
        StarBrandAuthRequest item = requireOwn(brandRepo.findById(id), userId, StarBrandAuthRequest::getStarId,
                "BRAND_AUTH_NOT_FOUND", "品牌授权不存在");
        if (item.getStatus() == StarBrandAuthRequest.Status.APPROVED || item.getStatus() == StarBrandAuthRequest.Status.REJECTED) {
            throw BusinessException.badRequest("BRAND_AUTH_ALREADY_FINAL", "该申请已完结");
        }
        item.setStatus(StarBrandAuthRequest.Status.REJECTED);
        brandRepo.save(item);
        return StarBrandAuthRequestDto.from(item);
    }

    @Transactional
    public StarBrandAuthRequestDto receiveBrandSample(String userId, String id) {
        StarBrandAuthRequest item = requireOwn(brandRepo.findById(id), userId, StarBrandAuthRequest::getStarId,
                "BRAND_AUTH_NOT_FOUND", "品牌授权不存在");
        if (item.getCelebSample() != StarSampleStatus.SHIPPING) {
            throw BusinessException.badRequest("SAMPLE_NOT_SHIPPING", "样品当前不在运输中");
        }
        item.setCelebSample(StarSampleStatus.DELIVERED);
        brandRepo.save(item);
        return StarBrandAuthRequestDto.from(item);
    }

    /** 样品确认；双路 approved → 授权激活。 */
    @Transactional
    public StarBrandAuthRequestDto confirmBrandSample(String userId, String id) {
        StarBrandAuthRequest item = requireOwn(brandRepo.findById(id), userId, StarBrandAuthRequest::getStarId,
                "BRAND_AUTH_NOT_FOUND", "品牌授权不存在");
        if (item.getCelebSample() != StarSampleStatus.DELIVERED) {
            throw BusinessException.badRequest("SAMPLE_NOT_DELIVERED", "样品尚未签收，无法确认");
        }
        item.setCelebSample(StarSampleStatus.APPROVED);
        if (item.getPlatformSample() == StarSampleStatus.APPROVED) {
            item.setStatus(StarBrandAuthRequest.Status.APPROVED);
        }
        brandRepo.save(item);
        return StarBrandAuthRequestDto.from(item);
    }

    // ── 收益 / 规则 / 侵权 / 合同 ────────────────────────────────────────────

    public StarRevenueSummaryDto getRevenue(String userId) {
        StarAccount account = requireAccount(userId);
        List<StarRevenueMonth> months = revenueRepo.findByStarIdOrderByMonthAsc(account.getStarId());
        long total = months.stream().mapToLong(StarRevenueMonth::getGmvCents).sum();
        long pending = months.stream().filter(m -> m.getStatus() == StarRevenueMonth.Status.PROCESSING)
                .mapToLong(StarRevenueMonth::getAmountCents).sum();
        long paid = months.stream().filter(m -> m.getStatus() == StarRevenueMonth.Status.PAID)
                .mapToLong(StarRevenueMonth::getAmountCents).sum();
        long monthGmv = months.isEmpty() ? 0 : months.get(months.size() - 1).getGmvCents();
        return new StarRevenueSummaryDto(total, monthGmv, pending, paid,
                months.stream().map(StarRevenueSummaryDto.StarRevenueMonthDto::from).toList());
    }

    public List<StarContentRuleDto> listContentRules(String userId) {
        StarAccount account = requireAccount(userId);
        return ruleRepo.findByStarIdOrderBySortOrderAsc(account.getStarId()).stream()
                .map(StarContentRuleDto::from).toList();
    }

    @Transactional
    public StarContentRuleDto toggleContentRule(String userId, String id) {
        StarContentRule rule = requireOwn(ruleRepo.findById(id), userId, StarContentRule::getStarId,
                "RULE_NOT_FOUND", "规则不存在");
        rule.setEnabled(!rule.isEnabled());
        ruleRepo.save(rule);
        return StarContentRuleDto.from(rule);
    }

    public List<StarInfringementCaseDto> listInfringements(String userId) {
        StarAccount account = requireAccount(userId);
        return infringementRepo.findByStarIdOrderByReportedAtDesc(account.getStarId()).stream()
                .map(StarInfringementCaseDto::from).toList();
    }

    @Transactional
    public StarInfringementCaseDto transitionInfringement(String userId, String id, StarInfringementTransitionDto req) {
        StarInfringementCase item = requireOwn(infringementRepo.findById(id), userId, StarInfringementCase::getStarId,
                "INFRINGEMENT_NOT_FOUND", "侵权案例不存在");
        String action = req != null && req.action() != null ? req.action() : "";
        switch (action) {
            case "investigate" -> {
                if (item.getStatus() != StarInfringementCase.Status.PENDING) {
                    throw BusinessException.badRequest("INFRINGEMENT_NOT_PENDING", "仅待处理案例可开始调查");
                }
                item.setStatus(StarInfringementCase.Status.INVESTIGATING);
            }
            case "confirm" -> {
                if (item.getStatus() != StarInfringementCase.Status.INVESTIGATING) {
                    throw BusinessException.badRequest("INFRINGEMENT_NOT_INVESTIGATING", "仅调查中案例可确认侵权");
                }
                item.setStatus(StarInfringementCase.Status.CONFIRMED);
            }
            case "resolve" -> item.setStatus(StarInfringementCase.Status.RESOLVED);
            case "dismiss" -> {
                item.setStatus(StarInfringementCase.Status.RESOLVED);
                if (req == null || req.note() == null || req.note().isBlank()) {
                    item.setActionNote("经核实为误报，已驳回");
                }
            }
            default -> throw BusinessException.badRequest("INFRINGEMENT_ACTION_INVALID", "未知处置动作：" + action);
        }
        if (req != null && req.note() != null && !req.note().isBlank()) {
            item.setActionNote(req.note().trim());
        }
        infringementRepo.save(item);
        return StarInfringementCaseDto.from(item);
    }

    public List<StarContractDto> listContracts(String userId) {
        StarAccount account = requireAccount(userId);
        return contractRepo.findByStarIdOrderBySignDateDesc(account.getStarId()).stream()
                .map(StarContractDto::from).toList();
    }

    // ── 工具 ─────────────────────────────────────────────────────────────────

    /** 取单据并校验归属（starId 必须 = 当前账号绑定的明星）。 */
    private <T> T requireOwn(Optional<T> found, String userId, java.util.function.Function<T, String> starIdOf,
                             String notFoundCode, String notFoundMessage) {
        StarAccount account = requireAccount(userId);
        T item = found.orElseThrow(() -> BusinessException.notFound(notFoundCode, notFoundMessage));
        if (!account.getStarId().equals(starIdOf.apply(item))) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "FORBIDDEN", "无权操作其他明星的数据");
        }
        return item;
    }

    private String toJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException("JSON 序列化失败", e);
        }
    }
}
