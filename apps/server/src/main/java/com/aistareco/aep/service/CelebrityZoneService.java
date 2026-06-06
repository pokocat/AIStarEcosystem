package com.aistareco.aep.service;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

/**
 * AI 明星专区领域服务（v2.7）。
 * 接口语义对齐前端 apps/web/src/api/celebrity-zone.ts。
 */
@Service
@Transactional
public class CelebrityZoneService {

    private static final Logger log = LoggerFactory.getLogger(CelebrityZoneService.class);
    private static final ObjectMapper OM = new ObjectMapper();

    /** PlatformConfig key. v0.33+ 起整表 JSON 写入此 key；admin PUT 走 upsert。 */
    public static final String ENGINE_PRICING_CONFIG_KEY = "celebrity.engine-pricing";

    /** 缓存 TTL —— 写入后立即失效，平时按这个间隔 lazy refresh。 */
    private static final long PRICING_CACHE_TTL_MS = 60_000L;

    /** 引擎计价表（默认值） — 与前端 ENGINE_META（celebrity-zone-ui.ts）保持一致。 */
    private static final Map<String, EnginePricingDto> ENGINE_PRICING_DEFAULTS = Map.of(
            "KeLing",  new EnginePricingDto(50, 1),
            "HiGen",   new EnginePricingDto(120, 2),
            "MiniMax", new EnginePricingDto(300, 3)
    );

    /**
     * v0.33+: pricing 缓存。
     * 读路径优先从 PlatformConfig 取（key=celebrity.engine-pricing），1min cache 减压；
     * config 不存在 → 退到 ENGINE_PRICING_DEFAULTS。
     * 写路径（admin PUT）直接落 PlatformConfig 并失效本缓存。
     */
    private record PricingCache(Map<String, EnginePricingDto> snapshot, long fetchedAt) {}
    private final AtomicReference<PricingCache> pricingCache = new AtomicReference<>(null);

    private final CelebrityStarRepository starRepo;
    private final CelebrityProjectRepository projectRepo;
    private final CelebrityProjectVideoRepository videoRepo;
    private final CelebrityTemplateRepository templateRepo;
    private final CelebrityShowcaseRepository showcaseRepo;
    private final CelebrityStarAuthorizationRepository authRepo;
    private final CreditService creditService;
    private final PlatformConfigService platformConfig;
    private final OperatorPermissionService operatorPermission;

    public CelebrityZoneService(CelebrityStarRepository starRepo,
                                 CelebrityProjectRepository projectRepo,
                                 CelebrityProjectVideoRepository videoRepo,
                                 CelebrityTemplateRepository templateRepo,
                                 CelebrityShowcaseRepository showcaseRepo,
                                 CelebrityStarAuthorizationRepository authRepo,
                                 CreditService creditService,
                                 PlatformConfigService platformConfig,
                                 OperatorPermissionService operatorPermission) {
        this.starRepo = starRepo;
        this.projectRepo = projectRepo;
        this.videoRepo = videoRepo;
        this.templateRepo = templateRepo;
        this.showcaseRepo = showcaseRepo;
        this.authRepo = authRepo;
        this.creditService = creditService;
        this.platformConfig = platformConfig;
        this.operatorPermission = operatorPermission;
    }

    /** 启动时种子默认 pricing 到 PlatformConfig（首次启动；已存在则 no-op，保留 admin 编辑）。 */
    @PostConstruct
    void seedEnginePricingIfAbsent() {
        try {
            platformConfig.seedIfAbsent(
                    ENGINE_PRICING_CONFIG_KEY,
                    OM.valueToTree(ENGINE_PRICING_DEFAULTS),
                    "AI 明星生成引擎计价（每引擎 creditPrice + quotaCost）"
            );
        } catch (Exception e) {
            log.warn("[celebrity-zone] seed engine-pricing failed: {}", e.getMessage());
        }
    }

    // ── Stars ───────────────────────────────────────────────────────────────
    public List<CelebrityStarDto> listStars(String category, String sort) {
        return listStars(category, sort, null, null);
    }

    /**
     * v0.4：增加 owner / userId 参数。
     *   - owner == "me" && userId 非空：仅返回该用户已授权或审核中的明星，且 authorization 字段
     *     用 CelebrityStarAuthorization 注入（覆盖 star.authorizationJson 默认值）。
     *   - 其他情况：与 v0.3 行为一致。
     */
    public List<CelebrityStarDto> listStars(String category, String sort, String owner, String userId) {
        if ("me".equals(owner) && userId != null && !userId.isBlank()) {
            List<CelebrityStarAuthorization> auths = authRepo.findByUserIdAndStatusIn(
                    userId, List.of(CelebrityAuthStatus.AUTHORIZED, CelebrityAuthStatus.PENDING));
            if (auths.isEmpty()) return List.of();
            // 按 starId 反查 + 注入 auth
            Map<String, CelebrityStarAuthorization> byStarId = new HashMap<>();
            for (CelebrityStarAuthorization a : auths) byStarId.put(a.getStarId(), a);
            List<CelebrityStar> stars = starRepo.findAllById(byStarId.keySet());
            return stars.stream()
                    .map(s -> CelebrityStarDto.from(s, byStarId.get(s.getId())))
                    .toList();
        }

        List<CelebrityStar> rows = (category == null || category.isBlank() || "全部".equals(category))
                ? starRepo.findAll()
                : starRepo.findByCategory(category);
        if ("hot".equals(sort)) {
            rows = new ArrayList<>(rows);
            rows.sort((a, b) -> Boolean.compare(b.isHot(), a.isHot()));
        } else if ("price-asc".equals(sort) || "price-desc".equals(sort)) {
            boolean asc = "price-asc".equals(sort);
            rows = new ArrayList<>(rows);
            rows.sort((a, b) -> {
                int pa = parsePriceLeading(a.getStartingPrice());
                int pb = parsePriceLeading(b.getStartingPrice());
                return asc ? Integer.compare(pa, pb) : Integer.compare(pb, pa);
            });
        }
        // 即使非 owner=me，也按 userId 注入（如果有）
        if (userId != null && !userId.isBlank()) {
            List<CelebrityStarAuthorization> auths = authRepo.findByUserId(userId);
            Map<String, CelebrityStarAuthorization> byStarId = new HashMap<>();
            for (CelebrityStarAuthorization a : auths) byStarId.put(a.getStarId(), a);
            return rows.stream()
                    .map(s -> CelebrityStarDto.from(s, byStarId.get(s.getId())))
                    .toList();
        }
        return rows.stream().map(CelebrityStarDto::from).toList();
    }

    public CelebrityStarDto getStar(String id) {
        return getStar(id, null);
    }

    /**
     * v0.4：userId 非空时，从 CelebrityStarAuthorization 表取该用户对该明星的真实授权关系，
     * 注入 authorization 字段。
     */
    public CelebrityStarDto getStar(String id, String userId) {
        CelebrityStar star = starRepo.findById(id).orElse(null);
        if (star == null) return null;
        if (userId != null && !userId.isBlank()) {
            CelebrityStarAuthorization auth = authRepo.findByUserIdAndStarId(userId, id).orElse(null);
            return CelebrityStarDto.from(star, auth);
        }
        return CelebrityStarDto.from(star);
    }

    public CelebrityStarDto getActiveStar() {
        // 当前活跃明星策略：直接拿第一条已 isHot 的；否则返回任意一条。
        return starRepo.findAll().stream()
                .filter(CelebrityStar::isHot)
                .findFirst()
                .or(() -> starRepo.findAll().stream().findFirst())
                .map(CelebrityStarDto::from)
                .orElse(null);
    }

    // ── Templates / Showcases ───────────────────────────────────────────────

    /**
     * Admin 或无身份调用：返回全部模板（factory + 所有用户私有）。
     * v0.34：保留兼容老调用点。
     */
    public List<CelebrityTemplateDto> listTemplates() {
        return templateRepo.findAll().stream().map(CelebrityTemplateDto::from).toList();
    }

    /**
     * 用户侧调用（v0.34）：只看 factory 模板 + 自己的私有模板。
     * userId 为 null 时只返回 factory（公开 fallback）。
     */
    public List<CelebrityTemplateDto> listTemplatesForUser(String userId) {
        return templateRepo.findAll().stream()
                .filter(t -> t.isFactory() || (userId != null && userId.equals(t.getOwnerUserId())))
                .map(CelebrityTemplateDto::from)
                .toList();
    }

    public List<CelebrityShowcaseDto> listShowcases(String mode) {
        List<CelebrityShowcase> rows = (mode == null || mode.isBlank())
                ? showcaseRepo.findAll()
                : showcaseRepo.findByMode(mode);
        return rows.stream().map(CelebrityShowcaseDto::from).toList();
    }

    // ── Projects ────────────────────────────────────────────────────────────
    public List<CelebrityProjectDto> listProjects(String ownerUserId, String status) {
        List<CelebrityProject> rows = (status == null || status.isBlank() || "全部".equals(status))
                ? projectRepo.findByOwnerUserIdOrderByCreatedAtDesc(ownerUserId)
                : projectRepo.findByOwnerUserIdAndStatusOrderByCreatedAtDesc(ownerUserId, status);
        return rows.stream().map(CelebrityProjectDto::from).toList();
    }

    /** Admin 跨用户聚合：不按 ownerUserId 过滤，仅按 status 过滤。 */
    public List<CelebrityProjectDto> listAllProjects(String status) {
        List<CelebrityProject> rows = projectRepo.findAll();
        if (status != null && !status.isBlank() && !"全部".equals(status)) {
            String s = status;
            rows = rows.stream().filter(p -> s.equals(p.getStatus())).toList();
        }
        return rows.stream().map(CelebrityProjectDto::from).toList();
    }

    public CelebrityProjectDto getProject(String id, String ownerUserId) {
        CelebrityProject p = projectRepo.findById(id).orElse(null);
        if (p == null) return null;
        if (ownerUserId != null && !ownerUserId.equals(p.getOwnerUserId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "PROJECT_FORBIDDEN", "无权访问该项目");
        }
        return CelebrityProjectDto.from(p);
    }

    public CelebrityProjectDto createProject(String ownerUserId, String name, String starId) {
        if (name == null || name.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PROJECT_NAME_REQUIRED", "项目名称不能为空");
        }
        CelebrityStar star = starRepo.findById(starId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STAR_NOT_FOUND", "明星不存在"));
        CelebrityProject p = CelebrityProject.builder()
                .id("proj-" + UUID.randomUUID().toString().substring(0, 8))
                .name(name.trim())
                .starId(star.getId())
                .starName(star.getName())
                .starAvatar(star.getAvatar())
                .status("筹备中")
                .videoCount(0)
                .totalPlays("—")
                .totalInteractions("—")
                .conversions(0)
                .gmv("—")
                .createdAt(LocalDate.now())
                .pricingTier(star.getPricingTier() != null ? star.getPricingTier() : "标准版")
                .channelsJson("[]")
                .quotaUsed(0)
                .quotaTotal(star.getQuotaTotal() != null ? star.getQuotaTotal() : 0)
                .ownerUserId(ownerUserId)
                .build();
        return CelebrityProjectDto.from(projectRepo.save(p));
    }

    public List<CelebrityProjectVideoDto> listProjectVideos(String projectId) {
        return videoRepo.findByProjectIdAndDeletedAtIsNullOrderByCreatedAtDesc(projectId)
                .stream().map(CelebrityProjectVideoDto::from).toList();
    }

    public AsyncJobStartedDto batchDistribute(String projectId, List<String> videoIds, List<String> channels) {
        // 异步分发占位：返回 jobId + 估算耗时。后端真正的分发管道交由 distribution 模块完成。
        return new AsyncJobStartedDto(
                "dist-" + UUID.randomUUID().toString().substring(0, 8),
                "queued",
                "/api/celebrity/jobs/" + projectId,
                3000,
                60
        );
    }

    // ── Videos (cross-project library) ──────────────────────────────────────
    public List<CelebrityProjectVideoDto> listAllVideos(String status, String starId, String projectId, String sort) {
        List<CelebrityProjectVideo> rows = videoRepo.findByDeletedAtIsNullOrderByCreatedAtDesc();
        if (status != null && !status.isBlank() && !"全部".equals(status)) {
            String s = status;
            rows = rows.stream().filter(v -> s.equals(v.getStatus())).toList();
        }
        if (starId != null && !starId.isBlank()) {
            rows = rows.stream().filter(v -> starId.equals(v.getStarId())).toList();
        }
        if (projectId != null && !projectId.isBlank()) {
            rows = rows.stream().filter(v -> projectId.equals(v.getProjectId())).toList();
        }
        if ("playsDesc".equals(sort)) {
            rows = new ArrayList<>(rows);
            rows.sort((a, b) -> Long.compare(parsePlays(b.getPlays()), parsePlays(a.getPlays())));
        }
        return rows.stream().map(CelebrityProjectVideoDto::from).toList();
    }

    public boolean softDeleteVideo(String videoId) {
        if (!operatorPermission.currentUserCanOperate()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "OPERATOR_REQUIRED", "只有运营或超管可以删除视频");
        }
        if (videoId == null || videoId.isBlank()) return false;
        return videoRepo.findById(videoId)
                .filter(v -> v.getDeletedAt() == null)
                .map(v -> {
                    v.setDeletedAt(Instant.now());
                    videoRepo.save(v);
                    log.info("[celebrity-zone] soft-deleted project video {}", videoId);
                    return true;
                })
                .orElse(false);
    }

    // ── Generation ──────────────────────────────────────────────────────────
    public AsyncJobStartedDto startGeneration(Map<String, Object> payload) {
        return startGeneration(payload, null);
    }

    /**
     * v0.33+：服务端重算 creditCost（不再信前端）+ hold 冻结 + 任务完成时 commit。
     *
     * payload 关键字段（与 apps/web/src/types/celebrity-zone.ts CelebrityGenerationRequest 对齐）：
     *   - starId, mode, templateId, engine / engineName, duration / durationSec
     *   - creditCost：v0.33+ 已废弃，前端透传值被忽略；服务端按 engineCode × durationFactor 重算。
     *   - language, keypoints：透传到生成管道（本期不消费）
     *
     * 计费：creditCost = engine.creditPrice × durationFactor。
     *   durationFactor = max(1, ceil(durationSec / 15))  —— 默认 15s 一档。
     * 走 CreditService.hold("celebrity_generation", jobId)；getJobProgress 看到 done 时
     * commit。任务真正失败（接入真后端 pipeline 后）走 releaseHold。
     */
    public AsyncJobStartedDto startGeneration(Map<String, Object> payload, String userId) {
        String engine = firstNonBlank(
                String.valueOf(payload.getOrDefault("engineName", "")),
                String.valueOf(payload.getOrDefault("engine", "HiGen")));
        if (engine == null || engine.isBlank() || "null".equals(engine)) engine = "HiGen";

        String starId = String.valueOf(payload.getOrDefault("starId", ""));
        String templateId = String.valueOf(payload.getOrDefault("templateId", ""));

        // v0.33+: 服务端重算 creditCost（不再信前端）。
        long durationSec = parseLongOrZero(payload.get("durationSec"));
        if (durationSec <= 0) durationSec = parseLongOrZero(payload.get("duration"));
        if (durationSec <= 0) durationSec = 15;
        long durationFactor = Math.max(1, (durationSec + 14) / 15);
        EnginePricingDto pricing = getEnginePricingFor(engine);
        long creditCost = (long) pricing.creditPrice() * durationFactor;

        String jobId = "gen-" + UUID.randomUUID().toString().substring(0, 8);

        // hold 冻结积分（仅当 userId 非空且 cost > 0）。
        // 402 PAYMENT_REQUIRED 由 CreditService 直接抛出，job 不再入 JOBS 表。
        if (userId != null && !userId.isBlank() && creditCost > 0) {
            creditService.hold(
                    userId,
                    creditCost,
                    "celebrity_generation",
                    jobId,
                    "AI 明星视频生成 · " + engine + (templateId.isBlank() ? "" : " · " + templateId)
            );
        }

        int estimatedMinutes = switch (engine) {
            case "KeLing" -> 6;
            case "MiniMax" -> 10;
            default -> 8;
        };
        long totalSec = (long) estimatedMinutes * 60L / 30L; // 演示用：分钟压成秒
        if (totalSec < 8) totalSec = 8;
        JOBS.put(jobId, new JobState(jobId, java.time.Instant.now(), totalSec, engine, userId, creditCost));
        log.info("[celebrity-gen] queued jobId={} user={} engine={} duration={}s factor={} cost={}",
                jobId, userId, engine, durationSec, durationFactor, creditCost);
        return new AsyncJobStartedDto(
                jobId,
                "queued",
                "/api/celebrity/jobs/" + jobId,
                3000,
                estimatedMinutes
        );
    }

    // ── v0.5.1：任务进度跟踪（in-memory） ─────────────────────────────────────

    /**
     * 任务状态。startedAt + totalSec 决定进度；不依赖客户端 setInterval。
     * v0.33+: 加 userId / creditCost，用于进度走到 done 时延迟 commit hold（idempotent）。
     */
    private record JobState(String jobId, java.time.Instant startedAt, long totalSec, String engine,
                             String userId, long creditCost) {}

    private static final java.util.concurrent.ConcurrentHashMap<String, JobState> JOBS =
            new java.util.concurrent.ConcurrentHashMap<>();

    private static final List<String[]> PIPELINE_STEPS = List.of(
            new String[]{"脚本撰写", "AI 正在打磨分镜的台词"},
            new String[]{"分镜画面生成", "渲染关键画面"},
            new String[]{"AI 配音合成", "对齐口型 / 情感"},
            new String[]{"视频合成与渲染", "最终输出"}
    );

    /**
     * GET /celebrity/jobs/{jobId} —— 服务端计算进度。
     * 进度 = elapsed / totalSec，按 4 步均分到 currentStep。
     * 任务不存在时（重启或未提交）回退一个完成态，避免前端轮询失败。
     */
    public GenerationJobProgressDto getJobProgress(String jobId) {
        JobState s = JOBS.get(jobId);
        long elapsed, total;
        boolean exists = s != null;
        if (exists) {
            elapsed = java.time.Duration.between(s.startedAt(), java.time.Instant.now()).toSeconds();
            total = s.totalSec();
        } else {
            elapsed = 1;
            total = 1;
        }
        int progress = (int) Math.min(100, Math.max(0, elapsed * 100 / Math.max(1, total)));
        int stepCount = PIPELINE_STEPS.size();
        int currentStep = (int) Math.min(stepCount - 1, progress * stepCount / 100);
        long etaSec = Math.max(0, total - elapsed);
        String state = progress >= 100 ? "done" : (progress > 0 ? "running" : "queued");

        // v0.33+: 看到 done 状态时，commit 对应 hold（幂等：commitHold 内部检查状态，
        // 已 COMMITTED / RELEASED / 不存在均安全 return）。restart 后 JOBS 为空 → exists=false →
        // 也 short-circuit 不 commit（因为没有 userId 上下文）；那种孤儿 hold 由
        // 启动时的 sweep（@PostConstruct）或运营手动 release 处理。
        if (state.equals("done") && exists && s.userId() != null && !s.userId().isBlank() && s.creditCost() > 0) {
            try {
                creditService.commitHold(
                        "celebrity_generation",
                        jobId,
                        s.creditCost(),
                        "AI 明星视频生成完成 · " + s.engine()
                );
            } catch (Exception e) {
                log.warn("[celebrity-gen] commit hold failed jobId={} err={}", jobId, e.getMessage());
            }
        }

        List<GenerationJobProgressDto.StepDto> steps = new java.util.ArrayList<>();
        for (int i = 0; i < stepCount; i++) {
            String[] meta = PIPELINE_STEPS.get(i);
            String stepState;
            String time;
            if (i < currentStep || progress >= 100) {
                stepState = "done";
                time = "已完成";
            } else if (i == currentStep && progress < 100) {
                stepState = "current";
                time = "进行中";
            } else {
                stepState = "todo";
                time = "—";
            }
            steps.add(new GenerationJobProgressDto.StepDto(meta[0], meta[1], stepState, time));
        }
        return new GenerationJobProgressDto(jobId, progress, currentStep, (int) etaSec, state, steps);
    }

    /** GET /celebrity/dictionaries —— UI 字典（消除小程序硬编码）。 */
    public CelebrityDictionariesDto getDictionaries() {
        return new CelebrityDictionariesDto(
                List.of(15, 30, 60),
                List.of("普通话", "粤语", "英语"),
                List.of("全部", "美食", "美妆", "数码", "服饰", "母婴", "家居"),
                List.of("原料溯源", "无添加", "送礼场景", "性价比", "限时优惠", "工厂直供")
        );
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank() && !"null".equals(v)) return v;
        }
        return null;
    }

    private static long parseLongOrZero(Object v) {
        if (v == null) return 0L;
        if (v instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(v.toString());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    /**
     * v0.33+: 读 PlatformConfig 中的 pricing；1min cache。
     * config 不存在或解析失败 → 退到 ENGINE_PRICING_DEFAULTS（仍可用，但运营修改不生效）。
     */
    public Map<String, EnginePricingDto> getEnginePricing() {
        PricingCache cached = pricingCache.get();
        long now = System.currentTimeMillis();
        if (cached != null && now - cached.fetchedAt() < PRICING_CACHE_TTL_MS) {
            return cached.snapshot();
        }
        Map<String, EnginePricingDto> fresh = loadEnginePricingFromConfig();
        pricingCache.set(new PricingCache(fresh, now));
        return fresh;
    }

    /** 单一引擎价格读取（hold 算 creditCost 时用）。引擎不存在 → 退默认 HiGen。 */
    public EnginePricingDto getEnginePricingFor(String engineCode) {
        Map<String, EnginePricingDto> all = getEnginePricing();
        if (engineCode != null && all.containsKey(engineCode)) return all.get(engineCode);
        // 兜底：用 HiGen 默认（前端 default fallback 一致）
        return all.getOrDefault("HiGen", ENGINE_PRICING_DEFAULTS.get("HiGen"));
    }

    private Map<String, EnginePricingDto> loadEnginePricingFromConfig() {
        try {
            return platformConfig.findByKey(ENGINE_PRICING_CONFIG_KEY)
                    .map(c -> {
                        try {
                            JsonNode node = c.value();
                            if (node == null || !node.isObject()) return ENGINE_PRICING_DEFAULTS;
                            Map<String, EnginePricingDto> parsed = new LinkedHashMap<>();
                            node.fields().forEachRemaining(e -> {
                                JsonNode v = e.getValue();
                                int credit = v.path("creditPrice").asInt();
                                int quota = v.path("quotaCost").asInt();
                                parsed.put(e.getKey(), new EnginePricingDto(credit, quota));
                            });
                            if (parsed.isEmpty()) return ENGINE_PRICING_DEFAULTS;
                            return Collections.unmodifiableMap(parsed);
                        } catch (Exception ex) {
                            log.warn("[celebrity-zone] parse engine-pricing config failed, fallback to defaults: {}", ex.getMessage());
                            return ENGINE_PRICING_DEFAULTS;
                        }
                    })
                    .orElse(ENGINE_PRICING_DEFAULTS);
        } catch (Exception e) {
            log.warn("[celebrity-zone] load engine-pricing failed, fallback to defaults: {}", e.getMessage());
            return ENGINE_PRICING_DEFAULTS;
        }
    }

    // ── Overview (data center) ──────────────────────────────────────────────
    public Map<String, Object> getOverview() {
        // mock overview：与前端 ZONE_OVERVIEW 结构一致；MVP 阶段统计字段先以聚合占位，后续接入真实指标。
        long activeStars = starRepo.count();
        long totalVideos = videoRepo.count();

        Map<String, Object> hero = new LinkedHashMap<>();
        hero.put("totalPlays", "—");
        hero.put("totalConversions", "—");
        hero.put("activeStars", (int) activeStars);

        List<Map<String, Object>> leaderboard = new ArrayList<>();
        for (CelebrityStar s : starRepo.findAll()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("starId", s.getId());
            entry.put("name", s.getName());
            entry.put("avatar", s.getAvatar());
            Map<String, Object> stats = readObj(s.getStatsJson());
            entry.put("plays", stats.getOrDefault("totalPlays", "—"));
            entry.put("gmv", stats.getOrDefault("gmv", "—"));
            entry.put("videoCount", stats.getOrDefault("totalGenerated", 0));
            leaderboard.add(entry);
            if (leaderboard.size() >= 8) break;
        }

        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("hero", hero);
        overview.put("starLeaderboard", leaderboard);
        overview.put("weeklyTrend", List.of());
        overview.put("channelMix", List.of());
        overview.put("_serverGenerated", true);
        overview.put("_totalVideos", totalVideos);
        return overview;
    }

    // ── helpers ─────────────────────────────────────────────────────────────
    private static int parsePriceLeading(String text) {
        if (text == null) return 0;
        StringBuilder sb = new StringBuilder();
        for (char c : text.toCharArray()) {
            if (c >= '0' && c <= '9') sb.append(c);
            else if (sb.length() > 0) break;
        }
        try {
            return sb.length() == 0 ? 0 : Integer.parseInt(sb.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static long parsePlays(String text) {
        if (text == null || text.isBlank()) return 0;
        char last = text.charAt(text.length() - 1);
        long mult = switch (last) {
            case 'K' -> 1_000L;
            case 'M' -> 1_000_000L;
            case 'B' -> 1_000_000_000L;
            default -> 1L;
        };
        String numeric = (mult == 1L ? text : text.substring(0, text.length() - 1));
        try {
            return (long) (Double.parseDouble(numeric) * mult);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    // ── Admin 写操作（v0.5 新增）─────────────────────────────────────────────
    // 严格 @Transactional；photos/videos 的 append/remove 走悲观锁避免并发丢数据。

    /** admin POST /stars — 创建明星。 */
    public CelebrityStarDto adminCreateStar(AdminCelebrityStarUpsertDto req) {
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "STAR_NAME_REQUIRED", "明星 name 不能为空");
        }
        String id = (req.id() != null && !req.id().isBlank())
                ? req.id()
                : "star-" + UUID.randomUUID().toString().substring(0, 8);
        if (starRepo.existsById(id)) {
            throw new BusinessException(HttpStatus.CONFLICT, "STAR_DUPLICATE", "明星 id 已存在: " + id);
        }
        CelebrityStar entity = applyStarUpsert(new CelebrityStar(), req);
        entity.setId(id);
        return CelebrityStarDto.from(starRepo.save(entity));
    }

    /** admin PUT /stars/{id} — 整体替换（不含 photos/videos）。 */
    public CelebrityStarDto adminUpdateStar(String id, AdminCelebrityStarUpsertDto req) {
        CelebrityStar entity = starRepo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STAR_NOT_FOUND", "明星不存在"));
        applyStarUpsert(entity, req);
        return CelebrityStarDto.from(starRepo.save(entity));
    }

    /** admin DELETE /stars/{id}。 */
    public void adminDeleteStar(String id) {
        if (!starRepo.existsById(id)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "STAR_NOT_FOUND", "明星不存在");
        }
        // 关联的 CelebrityStarAuthorization / 项目暂不级联；后续在 service 层补软删
        starRepo.deleteById(id);
    }

    /** admin POST /stars/{id}/photos — 追加单条 photo（并发安全）。 */
    public CelebrityStarDto adminAppendStarPhoto(String starId, AdminCelebrityStarPhotoUpsertDto req) {
        if (req == null || req.url() == null || req.url().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PHOTO_URL_REQUIRED", "url 不能为空");
        }
        CelebrityStar star = starRepo.findById(starId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STAR_NOT_FOUND", "明星不存在"));
        List<Map<String, Object>> list = readArr(star.getPhotosJson());
        Map<String, Object> photo = new LinkedHashMap<>();
        String id = (req.id() != null && !req.id().isBlank())
                ? req.id()
                : "p-" + UUID.randomUUID().toString().substring(0, 8);
        if (list.stream().anyMatch(p -> id.equals(p.get("id")))) {
            throw new BusinessException(HttpStatus.CONFLICT, "PHOTO_DUPLICATE", "photo id 已存在: " + id);
        }
        photo.put("id", id);
        photo.put("url", req.url());
        if (req.caption() != null) photo.put("caption", req.caption());
        list.add(photo);
        star.setPhotosJson(toJson(list));
        return CelebrityStarDto.from(starRepo.save(star));
    }

    /** admin DELETE /stars/{starId}/photos/{photoId}。 */
    public CelebrityStarDto adminRemoveStarPhoto(String starId, String photoId) {
        CelebrityStar star = starRepo.findById(starId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STAR_NOT_FOUND", "明星不存在"));
        List<Map<String, Object>> list = new ArrayList<>(readArr(star.getPhotosJson()));
        boolean removed = list.removeIf(p -> photoId.equals(p.get("id")));
        if (!removed) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "PHOTO_NOT_FOUND", "photo 不存在");
        }
        star.setPhotosJson(toJson(list));
        return CelebrityStarDto.from(starRepo.save(star));
    }

    /** admin POST /stars/{id}/videos — 追加单条 video。 */
    public CelebrityStarDto adminAppendStarVideo(String starId, AdminCelebrityStarVideoUpsertDto req) {
        if (req == null || req.title() == null || req.title().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "VIDEO_TITLE_REQUIRED", "title 不能为空");
        }
        CelebrityStar star = starRepo.findById(starId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STAR_NOT_FOUND", "明星不存在"));
        List<Map<String, Object>> list = new ArrayList<>(readArr(star.getVideosJson()));
        Map<String, Object> v = new LinkedHashMap<>();
        String id = (req.id() != null && !req.id().isBlank())
                ? req.id()
                : "v-" + UUID.randomUUID().toString().substring(0, 8);
        if (list.stream().anyMatch(x -> id.equals(x.get("id")))) {
            throw new BusinessException(HttpStatus.CONFLICT, "VIDEO_DUPLICATE", "video id 已存在: " + id);
        }
        v.put("id", id);
        v.put("title", req.title());
        v.put("durationSec", req.durationSec() != null ? req.durationSec() : 0);
        if (req.coverUrl() != null) v.put("coverUrl", req.coverUrl());
        if (req.playUrl() != null) v.put("playUrl", req.playUrl());
        if (req.tag() != null) v.put("tag", req.tag());
        list.add(v);
        star.setVideosJson(toJson(list));
        return CelebrityStarDto.from(starRepo.save(star));
    }

    /** admin DELETE /stars/{starId}/videos/{videoId}。 */
    public CelebrityStarDto adminRemoveStarVideo(String starId, String videoId) {
        CelebrityStar star = starRepo.findById(starId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STAR_NOT_FOUND", "明星不存在"));
        List<Map<String, Object>> list = new ArrayList<>(readArr(star.getVideosJson()));
        boolean removed = list.removeIf(x -> videoId.equals(x.get("id")));
        if (!removed) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "VIDEO_NOT_FOUND", "video 不存在");
        }
        star.setVideosJson(toJson(list));
        return CelebrityStarDto.from(starRepo.save(star));
    }

    /** admin POST /templates — 创建模板。 */
    public CelebrityTemplateDto adminCreateTemplate(AdminCelebrityTemplateUpsertDto req) {
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "TEMPLATE_NAME_REQUIRED", "模板 name 不能为空");
        }
        String id = (req.id() != null && !req.id().isBlank())
                ? req.id()
                : "tpl-" + UUID.randomUUID().toString().substring(0, 8);
        if (templateRepo.existsById(id)) {
            throw new BusinessException(HttpStatus.CONFLICT, "TEMPLATE_DUPLICATE", "模板 id 已存在: " + id);
        }
        CelebrityTemplate entity = applyTemplateUpsert(new CelebrityTemplate(), req);
        entity.setId(id);
        return CelebrityTemplateDto.from(templateRepo.save(entity));
    }

    public CelebrityTemplateDto adminUpdateTemplate(String id, AdminCelebrityTemplateUpsertDto req) {
        CelebrityTemplate entity = templateRepo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "TEMPLATE_NOT_FOUND", "模板不存在"));
        applyTemplateUpsert(entity, req);
        return CelebrityTemplateDto.from(templateRepo.save(entity));
    }

    public void adminDeleteTemplate(String id) {
        if (!templateRepo.existsById(id)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "TEMPLATE_NOT_FOUND", "模板不存在");
        }
        templateRepo.deleteById(id);
    }

    /** admin PUT /templates/{id}/preview — 仅更新预览字段。 */
    public CelebrityTemplateDto adminSetTemplatePreview(String id, AdminCelebrityTemplatePreviewUpsertDto req) {
        CelebrityTemplate entity = templateRepo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "TEMPLATE_NOT_FOUND", "模板不存在"));
        if (req != null) {
            if (req.previewCover() != null) entity.setPreviewCover(req.previewCover());
            if (req.previewVideoUrl() != null) entity.setPreviewVideoUrl(req.previewVideoUrl());
            if (req.durationSec() != null) entity.setDurationSec(req.durationSec());
        }
        return CelebrityTemplateDto.from(templateRepo.save(entity));
    }

    /**
     * PUT /admin/celebrity/engine-pricing — 整表替换，落 PlatformConfig（key=celebrity.engine-pricing）。
     * v0.33+: 重启不丢；上层 admin 路由仍可继续调用，行为对前端透明。
     */
    public Map<String, EnginePricingDto> adminReplaceEnginePricing(Map<String, EnginePricingDto> next) {
        if (next == null || next.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PRICING_EMPTY", "pricing 不能为空");
        }
        JsonNode payload = OM.valueToTree(next);
        platformConfig.upsert(
                ENGINE_PRICING_CONFIG_KEY,
                payload,
                "AI 明星生成引擎计价（每引擎 creditPrice + quotaCost）",
                "admin"
        );
        // 立即让缓存失效，下一次 read 拿到新值
        pricingCache.set(new PricingCache(Collections.unmodifiableMap(new LinkedHashMap<>(next)), System.currentTimeMillis()));
        return Collections.unmodifiableMap(new LinkedHashMap<>(next));
    }

    // ── 内部工具 ─────────────────────────────────────────────────────────────

    private CelebrityStar applyStarUpsert(CelebrityStar entity, AdminCelebrityStarUpsertDto req) {
        if (req.name() != null) entity.setName(req.name());
        if (req.avatar() != null) entity.setAvatar(req.avatar());
        if (req.cover() != null) entity.setCover(req.cover());
        if (req.category() != null) entity.setCategory(req.category());
        if (req.subCategories() != null) entity.setSubCategories(new ArrayList<>(req.subCategories()));
        if (req.isHot() != null) entity.setHot(req.isHot());
        if (req.description() != null) entity.setDescription(req.description());
        if (req.startingPrice() != null) entity.setStartingPrice(req.startingPrice());
        if (req.pricingTier() != null) entity.setPricingTier(req.pricingTier());
        if (req.quotaUsed() != null) entity.setQuotaUsed(req.quotaUsed());
        if (req.quotaTotal() != null) entity.setQuotaTotal(req.quotaTotal());
        if (req.authorization() != null) entity.setAuthorizationJson(toJson(req.authorization()));
        if (req.stats() != null) entity.setStatsJson(toJson(req.stats()));
        if (req.sampleVideos() != null) entity.setSampleVideosJson(toJson(req.sampleVideos()));
        if (req.pricing() != null) entity.setPricingJson(toJson(req.pricing()));
        if (req.bio() != null) entity.setBio(req.bio());
        if (req.location() != null) entity.setLocation(req.location());
        if (req.fans() != null) entity.setFans(req.fans());
        if (req.cooperationCount() != null) entity.setCooperationCount(req.cooperationCount());
        if (req.avgGmv() != null) entity.setAvgGmv(req.avgGmv());
        // 必填项兜底：avatar / cover / category 在 entity 级别 nullable=false
        if (entity.getAvatar() == null) entity.setAvatar("");
        if (entity.getCover() == null) entity.setCover("");
        if (entity.getCategory() == null) entity.setCategory("综艺");
        if (entity.getStartingPrice() == null) entity.setStartingPrice("¥0起");
        if (entity.getDescription() == null) entity.setDescription("");
        // v0.34+ 修复：admin 新建明星时 authorization JSON 默认给「未授权」陈列态，
        // 否则前端 CelebrityStarCard 读 auth.icon 时 undefined → TypeError。
        if (entity.getAuthorizationJson() == null || entity.getAuthorizationJson().isBlank()) {
            entity.setAuthorizationJson(
                    "{\"status\":\"unauthorized\",\"scenes\":[],\"pendingNote\":null,\"expireDate\":null}");
        }
        if (entity.getStatsJson() == null || entity.getStatsJson().isBlank()) {
            entity.setStatsJson(
                    "{\"totalGenerated\":0,\"totalPlays\":\"—\",\"gmv\":\"—\"}");
        }
        return entity;
    }

    private CelebrityTemplate applyTemplateUpsert(CelebrityTemplate entity, AdminCelebrityTemplateUpsertDto req) {
        if (req.name() != null) entity.setName(req.name());
        if (req.style() != null) entity.setStyle(req.style());
        if (req.description() != null) entity.setDescription(req.description());
        if (req.recommendedEngine() != null) entity.setRecommendedEngine(req.recommendedEngine());
        if (req.recommendedPrice() != null) entity.setRecommendedPrice(req.recommendedPrice());
        if (req.isHot() != null) entity.setHot(req.isHot());
        if (req.plays() != null) entity.setPlays(req.plays());
        if (req.conversionRate() != null) entity.setConversionRate(req.conversionRate());
        if (req.fitHint() != null) entity.setFitHint(req.fitHint());
        if (req.previews() != null) entity.setPreviewsJson(toJson(req.previews()));
        if (req.previewCover() != null) entity.setPreviewCover(req.previewCover());
        if (req.previewVideoUrl() != null) entity.setPreviewVideoUrl(req.previewVideoUrl());
        if (req.durationSec() != null) entity.setDurationSec(req.durationSec());
        // v0.34 工厂/用户归属
        if (req.isFactory() != null) entity.setFactory(req.isFactory());
        if (req.ownerScope() != null) entity.setOwnerScope(req.ownerScope());
        if (req.ownerUserId() != null) entity.setOwnerUserId(req.ownerUserId());
        // 必填兜底
        if (entity.getStyle() == null) entity.setStyle("种草安利");
        if (entity.getRecommendedEngine() == null) entity.setRecommendedEngine("HiGen");
        if (entity.getRecommendedPrice() == null) entity.setRecommendedPrice("标准");
        if (entity.getOwnerScope() == null || entity.getOwnerScope().isBlank()) {
            // admin 走 controller 不显式传时默认建为 factory
            entity.setOwnerScope("factory");
            entity.setFactory(true);
        }
        return entity;
    }

    private static String toJson(Object value) {
        try {
            return OM.writeValueAsString(value);
        } catch (Exception e) {
            return "[]";
        }
    }

    private static List<Map<String, Object>> readArr(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return OM.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private static Map<String, Object> readObj(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return OM.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}
