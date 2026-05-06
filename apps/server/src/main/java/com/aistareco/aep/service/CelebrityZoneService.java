package com.aistareco.aep.service;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/**
 * AI 明星专区领域服务（v2.7）。
 * 接口语义对齐前端 apps/web/src/api/celebrity-zone.ts。
 */
@Service
@Transactional
public class CelebrityZoneService {

    private static final ObjectMapper OM = new ObjectMapper();

    /** 引擎计价表 — 与前端 ENGINE_META（celebrity-zone-ui.ts）保持一致。 */
    private static final Map<String, EnginePricingDto> ENGINE_PRICING = Map.of(
            "KeLing",  new EnginePricingDto(50, 1),
            "HiGen",   new EnginePricingDto(120, 2),
            "MiniMax", new EnginePricingDto(300, 3)
    );

    private final CelebrityStarRepository starRepo;
    private final CelebrityProjectRepository projectRepo;
    private final CelebrityProjectVideoRepository videoRepo;
    private final CelebrityTemplateRepository templateRepo;
    private final CelebrityShowcaseRepository showcaseRepo;

    public CelebrityZoneService(CelebrityStarRepository starRepo,
                                 CelebrityProjectRepository projectRepo,
                                 CelebrityProjectVideoRepository videoRepo,
                                 CelebrityTemplateRepository templateRepo,
                                 CelebrityShowcaseRepository showcaseRepo) {
        this.starRepo = starRepo;
        this.projectRepo = projectRepo;
        this.videoRepo = videoRepo;
        this.templateRepo = templateRepo;
        this.showcaseRepo = showcaseRepo;
    }

    // ── Stars ───────────────────────────────────────────────────────────────
    public List<CelebrityStarDto> listStars(String category, String sort) {
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
        return rows.stream().map(CelebrityStarDto::from).toList();
    }

    public CelebrityStarDto getStar(String id) {
        return starRepo.findById(id).map(CelebrityStarDto::from).orElse(null);
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
    public List<CelebrityTemplateDto> listTemplates() {
        return templateRepo.findAll().stream().map(CelebrityTemplateDto::from).toList();
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
        return videoRepo.findByProjectIdOrderByCreatedAtDesc(projectId)
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
        List<CelebrityProjectVideo> rows = videoRepo.findAllByOrderByCreatedAtDesc();
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

    // ── Generation ──────────────────────────────────────────────────────────
    public AsyncJobStartedDto startGeneration(Map<String, Object> payload) {
        String engine = String.valueOf(payload.getOrDefault("engine", "HiGen"));
        EnginePricingDto pricing = ENGINE_PRICING.getOrDefault(engine, ENGINE_PRICING.get("HiGen"));
        int estimated = switch (engine) {
            case "KeLing" -> 6;
            case "MiniMax" -> 10;
            default -> 8;
        };
        return new AsyncJobStartedDto(
                "gen-" + UUID.randomUUID().toString().substring(0, 8),
                "queued",
                "/api/celebrity/jobs/mock",
                3000,
                estimated
        );
    }

    public Map<String, EnginePricingDto> getEnginePricing() {
        return ENGINE_PRICING;
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

    private static Map<String, Object> readObj(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return OM.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}
