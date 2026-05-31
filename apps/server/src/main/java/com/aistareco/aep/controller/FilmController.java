package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdvertisementDto;
import com.aistareco.aep.dto.DramaDto;
import com.aistareco.aep.dto.MovieDto;
import com.aistareco.aep.dto.VoiceWorkDto;
import com.aistareco.aep.model.Drama;
import com.aistareco.aep.repository.AdvertisementRepository;
import com.aistareco.aep.repository.DramaRepository;
import com.aistareco.aep.repository.MovieRepository;
import com.aistareco.aep.repository.VoiceWorkRepository;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 用户侧影视业务视图：/api/film/*。
 *
 * Drama（短剧项目）支持完整 CRUD（v0.45）：项目流水线 /projects 增删改 + 短剧成片归入项目。
 * Movie / Ad / VoiceWork 仍只读。管理后台批量写入仍走 {@link AdminFilmController}。
 *
 * ⚠️ /api/film/** 当前在 AepSecurityConfig 下 permitAll（无 owner 隔离）——
 * 沿用现有 demo 姿态；生产硬化时应迁到 /api/me/film 并按 principal 过滤。
 */
@RestController
@RequestMapping("/api/film")
public class FilmController {

    private final DramaRepository dramaRepo;
    private final MovieRepository movieRepo;
    private final AdvertisementRepository adRepo;
    private final VoiceWorkRepository voiceWorkRepo;

    public FilmController(DramaRepository dramaRepo,
                          MovieRepository movieRepo,
                          AdvertisementRepository adRepo,
                          VoiceWorkRepository voiceWorkRepo) {
        this.dramaRepo = dramaRepo;
        this.movieRepo = movieRepo;
        this.adRepo = adRepo;
        this.voiceWorkRepo = voiceWorkRepo;
    }

    // ── Drama（短剧项目）CRUD ─────────────────────────────────────────────────

    @GetMapping("/dramas")
    public ApiResponse<List<DramaDto>> dramas() {
        return ApiResponse.of(dramaRepo.findAll(Sort.by("id").ascending())
                .stream().map(DramaDto::from).toList());
    }

    @GetMapping("/dramas/{id}")
    public ApiResponse<DramaDto> drama(@PathVariable String id) {
        return ApiResponse.of(DramaDto.from(requireDrama(id)));
    }

    @PostMapping("/dramas")
    public ApiResponse<DramaDto> createDrama(@RequestBody Map<String, Object> body) {
        String title = str(body, "title");
        if (title == null || title.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_TITLE_REQUIRED", "短剧标题必填");
        }
        Drama drama = Drama.builder()
                .id("d-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10))
                .title(title)
                .genre(str(body, "genre"))
                .episodes(intOr(body, "episodes", 0))
                .role(str(body, "role"))
                .status(parseStatus(str(body, "status"), Drama.DramaStatus.CASTING))
                .views(longOr(body, "views", 0))
                .revenue(longOr(body, "revenue", 0))
                .rating(doubleOr(body, "rating", 0))
                .releaseDate(parseInstant(str(body, "releaseDate")))
                .build();
        dramaRepo.save(drama);
        return ApiResponse.of(DramaDto.from(drama));
    }

    @PatchMapping("/dramas/{id}/status")
    public ApiResponse<DramaDto> updateDramaStatus(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Drama drama = requireDrama(id);
        drama.setStatus(parseStatus(str(body, "status"), drama.getStatus()));
        dramaRepo.save(drama);
        return ApiResponse.of(DramaDto.from(drama));
    }

    @PatchMapping("/dramas/{id}")
    public ApiResponse<DramaDto> patchDrama(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Drama drama = requireDrama(id);
        if (body.containsKey("title")) drama.setTitle(str(body, "title"));
        if (body.containsKey("genre")) drama.setGenre(str(body, "genre"));
        if (body.containsKey("episodes")) drama.setEpisodes(intOr(body, "episodes", drama.getEpisodes()));
        if (body.containsKey("role")) drama.setRole(str(body, "role"));
        if (body.containsKey("status")) drama.setStatus(parseStatus(str(body, "status"), drama.getStatus()));
        if (body.containsKey("views")) drama.setViews(longOr(body, "views", drama.getViews()));
        if (body.containsKey("revenue")) drama.setRevenue(longOr(body, "revenue", drama.getRevenue()));
        if (body.containsKey("rating")) drama.setRating(doubleOr(body, "rating", drama.getRating()));
        if (body.containsKey("releaseDate")) drama.setReleaseDate(parseInstant(str(body, "releaseDate")));
        dramaRepo.save(drama);
        return ApiResponse.of(DramaDto.from(drama));
    }

    @DeleteMapping("/dramas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDrama(@PathVariable String id) {
        dramaRepo.deleteById(id);
    }

    // ── Movie / Ad / Voice（只读）────────────────────────────────────────────

    @GetMapping("/movies")
    public ApiResponse<List<MovieDto>> movies() {
        return ApiResponse.of(movieRepo.findAll(Sort.by("id").ascending())
                .stream().map(MovieDto::from).toList());
    }

    @GetMapping("/ads")
    public ApiResponse<List<AdvertisementDto>> ads() {
        return ApiResponse.of(adRepo.findAll(Sort.by("id").ascending())
                .stream().map(AdvertisementDto::from).toList());
    }

    @GetMapping("/voice-works")
    public ApiResponse<List<VoiceWorkDto>> voiceWorks() {
        return ApiResponse.of(voiceWorkRepo.findAll(Sort.by("id").ascending())
                .stream().map(VoiceWorkDto::from).toList());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Drama requireDrama(String id) {
        return dramaRepo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_NOT_FOUND", "短剧项目不存在"));
    }

    private static Drama.DramaStatus parseStatus(String wire, Drama.DramaStatus fallback) {
        if (wire == null || wire.isBlank()) return fallback;
        for (Drama.DramaStatus s : Drama.DramaStatus.values()) {
            if (s.getWire().equalsIgnoreCase(wire) || s.name().equalsIgnoreCase(wire)) return s;
        }
        return fallback;
    }

    private static Instant parseInstant(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return Instant.parse(iso);
        } catch (Exception e) {
            try {
                return java.time.LocalDate.parse(iso).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
            } catch (Exception ignore) {
                return null;
            }
        }
    }

    private static String str(Map<String, Object> body, String key) {
        Object v = body == null ? null : body.get(key);
        return v == null ? null : v.toString();
    }

    private static int intOr(Map<String, Object> body, String key, int dft) {
        Object v = body == null ? null : body.get(key);
        if (v instanceof Number n) return n.intValue();
        try { return v == null ? dft : Integer.parseInt(v.toString()); } catch (Exception e) { return dft; }
    }

    private static long longOr(Map<String, Object> body, String key, long dft) {
        Object v = body == null ? null : body.get(key);
        if (v instanceof Number n) return n.longValue();
        try { return v == null ? dft : Long.parseLong(v.toString()); } catch (Exception e) { return dft; }
    }

    private static double doubleOr(Map<String, Object> body, String key, double dft) {
        Object v = body == null ? null : body.get(key);
        if (v instanceof Number n) return n.doubleValue();
        try { return v == null ? dft : Double.parseDouble(v.toString()); } catch (Exception e) { return dft; }
    }
}
