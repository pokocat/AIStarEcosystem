package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.CopyrightItem;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.repository.CopyrightItemRepository;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.DistributionQueueItemRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.SignedArtistRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

/**
 * 用户侧经纪人（Coach）后台只读视图：/api/coach/*。
 * 管理写入仍走 {@link AdminCoachController}。
 */
@RestController
@RequestMapping("/api/coach")
public class CoachController {

    private static final ZoneId TZ = ZoneId.of("Asia/Shanghai");
    private static final String[] CATEGORY_COLORS = {
            "#06b6d4", "#a855f7", "#f59e0b", "#10b981",
            "#ec4899", "#6366f1", "#ef4444"
    };

    private final SignedArtistRepository signedArtistRepo;
    private final DistributionQueueItemRepository distributionQueueRepo;
    private final CopyrightItemRepository copyrightRepo;
    private final LedgerEntryRepository ledgerRepo;
    private final DigitalIpRepository digitalIpRepo;

    public CoachController(SignedArtistRepository signedArtistRepo,
                           DistributionQueueItemRepository distributionQueueRepo,
                           CopyrightItemRepository copyrightRepo,
                           LedgerEntryRepository ledgerRepo,
                           DigitalIpRepository digitalIpRepo) {
        this.signedArtistRepo = signedArtistRepo;
        this.distributionQueueRepo = distributionQueueRepo;
        this.copyrightRepo = copyrightRepo;
        this.ledgerRepo = ledgerRepo;
        this.digitalIpRepo = digitalIpRepo;
    }

    @GetMapping("/artists")
    public ApiResponse<List<SignedArtistDto>> listArtists() {
        return ApiResponse.of(signedArtistRepo.findAll(Sort.by("id").ascending())
                .stream().map(SignedArtistDto::from).toList());
    }

    /**
     * 近 12 个月、按 referenceType 分四桶（streaming / endorsement / nft / live）的月度营收。
     * referenceType 缺失时归入 streaming 作为默认。
     */
    @GetMapping("/revenue")
    public ApiResponse<List<CoachRevenuePointDto>> revenue(Principal principal) {
        Instant since = LocalDate.now(TZ).withDayOfMonth(1).minusMonths(11)
                .atStartOfDay(TZ).toInstant();
        List<LedgerEntry> entries = ledgerRepo.findPositiveSince(principal.getName(), since);

        // 预填 12 个月
        Map<String, long[]> bucket = new LinkedHashMap<>();
        LocalDate cursor = LocalDate.now(TZ).withDayOfMonth(1).minusMonths(11);
        for (int i = 0; i < 12; i++) {
            bucket.put(monthKey(cursor), new long[4]); // [streaming, endorsement, nft, live]
            cursor = cursor.plusMonths(1);
        }
        for (LedgerEntry e : entries) {
            String key = monthKey(LocalDate.ofInstant(e.getCreatedAt(), TZ));
            long[] row = bucket.get(key);
            if (row == null) continue;
            int idx = revenueBucketIndex(e.getReferenceType());
            row[idx] += e.getAmount();
        }
        List<CoachRevenuePointDto> out = new ArrayList<>();
        for (Map.Entry<String, long[]> en : bucket.entrySet()) {
            long[] r = en.getValue();
            out.add(new CoachRevenuePointDto(displayMonth(en.getKey()), r[0], r[1], r[2], r[3]));
        }
        return ApiResponse.of(out);
    }

    @GetMapping("/distribution-queue")
    public ApiResponse<List<DistributionQueueItemDto>> distributionQueue() {
        return ApiResponse.of(distributionQueueRepo.findAll(Sort.by("id").ascending())
                .stream().map(DistributionQueueItemDto::from).toList());
    }

    @GetMapping("/copyright/pending")
    public ApiResponse<List<CopyrightItemDto>> pendingCopyrights() {
        return ApiResponse.of(copyrightRepo
                .findByStatus(CopyrightItem.CopyrightStatus.PENDING)
                .stream().map(CopyrightItemDto::from).toList());
    }

    /**
     * 全库 Digital IP 按 kind 分类占比（百分比 0–100）。
     */
    @GetMapping("/category-distribution")
    public ApiResponse<List<CoachCategoryDistributionDto>> categoryDistribution() {
        List<DigitalIp> all = digitalIpRepo.findAll();
        if (all.isEmpty()) return ApiResponse.of(List.of());
        Map<DigitalIp.DigitalIpKind, Long> counts = new EnumMap<>(DigitalIp.DigitalIpKind.class);
        for (DigitalIp ip : all) {
            if (ip.getKind() == null) continue;
            counts.merge(ip.getKind(), 1L, Long::sum);
        }
        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        if (total <= 0) return ApiResponse.of(List.of());

        List<CoachCategoryDistributionDto> out = new ArrayList<>();
        int i = 0;
        for (Map.Entry<DigitalIp.DigitalIpKind, Long> e : counts.entrySet()) {
            int pct = (int) Math.round(e.getValue() * 100.0 / total);
            out.add(new CoachCategoryDistributionDto(
                    kindLabel(e.getKey()), pct,
                    CATEGORY_COLORS[i % CATEGORY_COLORS.length]
            ));
            i++;
        }
        return ApiResponse.of(out);
    }

    /**
     * 用户提交版权登记。
     */
    @PostMapping("/copyright")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CopyrightItemDto> submitCopyright(Principal principal,
                                                          @RequestBody Map<String, Object> body) {
        String title = str(body.get("title"));
        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title 必填");
        }
        CopyrightItem item = CopyrightItem.builder()
                .id(UUID.randomUUID().toString())
                .title(title)
                .artistName(str(body.get("artist")))
                .contentType(str(body.get("type")))
                .submittedDate(LocalDate.now(TZ))
                .submittedByUserId(principal.getName())
                .status(CopyrightItem.CopyrightStatus.PENDING)
                .build();
        copyrightRepo.save(item);
        return ApiResponse.of(CopyrightItemDto.from(item));
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static int revenueBucketIndex(String refType) {
        if (refType == null) return 0;
        String r = refType.toLowerCase(Locale.ROOT);
        if (r.contains("endors") || r.contains("ad")) return 1;
        if (r.contains("nft")) return 2;
        if (r.contains("live") || r.contains("concert")) return 3;
        return 0; // streaming default
    }

    private static String monthKey(LocalDate d) {
        return String.format(Locale.ROOT, "%04d-%02d", d.getYear(), d.getMonthValue());
    }

    private static String displayMonth(String key) {
        int m = Integer.parseInt(key.substring(5));
        return m + "月";
    }

    private static String kindLabel(DigitalIp.DigitalIpKind k) {
        return switch (k) {
            case SINGER -> "歌手";
            case ACTOR -> "演员";
            case ENTERTAINER -> "综艺";
            case DANCER -> "舞者";
            case HOST -> "主持";
            case ALL_ROUNDER -> "全能";
            case IDOL -> "偶像";
        };
    }

    private static String str(Object v) {
        return v == null ? null : v.toString();
    }
}
