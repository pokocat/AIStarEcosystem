package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AlbumDto;
import com.aistareco.aep.dto.ConcertDto;
import com.aistareco.aep.dto.DigitalIpDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.MeDto;
import com.aistareco.aep.dto.MessagesOverviewDto;
import com.aistareco.aep.dto.MusicTrendPointDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.dto.RechargePackageDto;
import com.aistareco.aep.dto.SongDto;
import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.dto.TransactionDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.model.Song;
import com.aistareco.aep.repository.AlbumRepository;
import com.aistareco.aep.repository.ConcertRepository;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.SongRepository;
import com.aistareco.aep.service.AccountSelfService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.DigitalIpService;
import com.aistareco.aep.service.NotificationService;
import com.aistareco.aep.service.RechargeService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/me")
public class AccountController {

    private final AccountSelfService accountSelfService;
    private final DigitalIpService digitalIpService;
    private final SongRepository songRepo;
    private final AlbumRepository albumRepo;
    private final ConcertRepository concertRepo;
    private final DigitalIpRepository digitalIpRepo;
    private final RechargeService rechargeService;
    private final NotificationService notificationService;
    private final CreditService creditService;

    public AccountController(AccountSelfService accountSelfService,
                             DigitalIpService digitalIpService,
                             SongRepository songRepo,
                             AlbumRepository albumRepo,
                             ConcertRepository concertRepo,
                             DigitalIpRepository digitalIpRepo,
                             RechargeService rechargeService,
                             NotificationService notificationService,
                             CreditService creditService) {
        this.accountSelfService = accountSelfService;
        this.digitalIpService = digitalIpService;
        this.songRepo = songRepo;
        this.albumRepo = albumRepo;
        this.concertRepo = concertRepo;
        this.digitalIpRepo = digitalIpRepo;
        this.rechargeService = rechargeService;
        this.notificationService = notificationService;
        this.creditService = creditService;
    }

    /**
     * v0.5.1：消息首页聚合 = 待办中心 + Bot 同事会话预览。
     * 替代之前 GET /notifications 的 List shape，与小程序 messages 页期望一致。
     */
    @GetMapping("/messages-overview")
    public ApiResponse<MessagesOverviewDto> messagesOverview(Principal principal) {
        String uid = principal != null ? principal.getName() : "demo-user";
        return ApiResponse.of(notificationService.getMessagesOverview(uid));
    }

    @GetMapping
    public ApiResponse<MeDto> me(Principal principal) {
        return ApiResponse.of(accountSelfService.getCurrentMe(principal.getName()));
    }

    @PatchMapping
    public ApiResponse<MeDto> updateMe(Principal principal, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(accountSelfService.updateCurrentUser(principal.getName(), body));
    }

    @PostMapping("/password")
    public ApiResponse<Map<String, Object>> changePassword(Principal principal,
                                                           @RequestBody(required = false) ChangePasswordRequest body) {
        return ApiResponse.of(accountSelfService.changePassword(
                principal.getName(),
                body == null ? null : body.currentPassword(),
                body == null ? null : body.newPassword()
        ));
    }

    public record ChangePasswordRequest(String currentPassword, String newPassword) {}

    @GetMapping("/tenants")
    public ApiResponse<List<TenantDto>> tenants(Principal principal) {
        return ApiResponse.of(accountSelfService.listCurrentTenants(principal.getName()));
    }

    @GetMapping("/wallet")
    public ApiResponse<WalletDto> wallet(Principal principal) {
        return ApiResponse.of(accountSelfService.getWallet(principal.getName()));
    }

    /** v0.4：与 /me/wallet 同 shape 的语义别名，小程序"我的"页消费。 */
    @GetMapping("/wallet/credits")
    public ApiResponse<WalletDto> walletCredits(Principal principal) {
        return ApiResponse.of(accountSelfService.getWallet(principal.getName()));
    }

    /** v0.4：充值套餐列表。 */
    @GetMapping("/wallet/packages")
    public ApiResponse<List<RechargePackageDto>> walletPackages() {
        return ApiResponse.of(rechargeService.listPackages());
    }

    /**
     * v0.56：充值下单（不再直接入账）。
     * 生成一张待确认账单（PENDING）；平台运营在 admin 后台线下收款后 approve 才经账本入账。
     */
    @PostMapping("/wallet/recharge")
    public ApiResponse<RechargeOrderDto> createRechargeOrder(Principal principal,
                                                             @RequestBody(required = false) RechargeOrderRequest req) {
        String packageId = req == null ? null : req.packageId();
        String note = req == null ? null : req.note();
        return ApiResponse.of(rechargeService.createOrder(principal.getName(), packageId, note));
    }

    /** v0.56：我的充值订单（含待确认 / 已到账 / 已驳回 / 已取消）。 */
    @GetMapping("/wallet/recharge/orders")
    public ApiResponse<List<RechargeOrderDto>> listRechargeOrders(Principal principal) {
        return ApiResponse.of(rechargeService.listMyOrders(principal.getName()));
    }

    /** v0.56：取消自己的待确认充值订单。 */
    @PostMapping("/wallet/recharge/orders/{orderId}/cancel")
    public ApiResponse<RechargeOrderDto> cancelRechargeOrder(Principal principal, @PathVariable String orderId) {
        return ApiResponse.of(rechargeService.cancelOrder(principal.getName(), orderId));
    }

    public record RechargeOrderRequest(String packageId, String note) {}

    /**
     * v0.65：提现（drama 财务页）。账本侧原子扣减 + WITHDRAW 流水；真实打款由运营线下处理。
     * body: { amount, bankCard? } → Transaction（status=processing，与 /finance/transactions 同 shape）。
     */
    @PostMapping("/wallet/withdraw")
    public ApiResponse<TransactionDto> withdraw(Principal principal, @RequestBody WithdrawRequest req) {
        long amount = req == null ? 0 : req.amount();
        String card = req == null || req.bankCard() == null ? "" : req.bankCard();
        String cardTail = card.length() >= 4 ? card.substring(card.length() - 4) : card;
        LedgerEntryDto entry = creditService.withdraw(principal.getName(), amount,
                "提现至银行卡" + (cardTail.isBlank() ? "" : "（尾号 " + cardTail + "）"));
        return ApiResponse.of(new TransactionDto(
                entry.id(),
                entry.description(),
                entry.amount(),
                entry.createdAt() == null ? "" : entry.createdAt().toString().substring(0, 10),
                entry.createdAt(),
                "processing",
                "withdrawal",
                principal.getName(),
                null,
                null));
    }

    public record WithdrawRequest(long amount, String bankCard) {}

    @GetMapping("/ledger")
    public PageEnvelope<LedgerEntryDto> ledger(
            Principal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return PageEnvelope.from(accountSelfService.listLedger(principal.getName(), pageable));
    }

    /**
     * 当前用户可见的 Digital IP 列表 = ownerUserId == me ∪ studioId == myStudio.id。
     * 与 admin 侧按 studioId 过滤艺人保持对齐（经纪公司账户可看到挂在其 studio 下的全部艺人）。
     * 直接返回 List（非分页）——当前 MVP 单工作室艺人数量不大；后续需要分页再切 Page。
     */
    @GetMapping("/digital-ips")
    public ApiResponse<List<DigitalIpDto>> listDigitalIps(Principal principal) {
        return ApiResponse.of(digitalIpService.listForUser(principal.getName()));
    }

    @GetMapping("/digital-ips/{id}")
    public ApiResponse<DigitalIpDto> getDigitalIp(Principal principal, @PathVariable String id) {
        return ApiResponse.of(digitalIpService.findOwnedById(id, principal.getName()));
    }

    @PostMapping("/digital-ips")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<DigitalIpDto> createDigitalIp(Principal principal, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(digitalIpService.create(body, principal.getName()));
    }

    /**
     * v0.60 收敛：从 AiAvatar 引入数字人为艺人（引用不复制，不扣孵化积分）。
     * body: { dapAvatarId 必填, type?, name?, dapDisplayRef?("look:<id>"|"deriv:<id>"), bio? }
     */
    @PostMapping("/digital-ips/import-avatar")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<DigitalIpDto> importDigitalIpFromAvatar(Principal principal,
                                                                @RequestBody Map<String, Object> body) {
        return ApiResponse.of(digitalIpService.importFromAvatar(body, principal.getName()));
    }

    @PutMapping("/digital-ips/{id}")
    public ApiResponse<DigitalIpDto> updateDigitalIp(Principal principal,
                                                      @PathVariable String id,
                                                      @RequestBody Map<String, Object> body) {
        return ApiResponse.of(digitalIpService.updateOwned(id, principal.getName(), body));
    }

    @PatchMapping("/digital-ips/{id}")
    public ApiResponse<DigitalIpDto> patchDigitalIp(Principal principal,
                                                     @PathVariable String id,
                                                     @RequestBody Map<String, Object> body) {
        return ApiResponse.of(digitalIpService.updateOwned(id, principal.getName(), body));
    }

    @DeleteMapping("/digital-ips/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDigitalIp(Principal principal, @PathVariable String id) {
        digitalIpService.deleteOwned(id, principal.getName());
    }

    // ── 音乐工坊（product_spec.md §10） ──────────────────────────────────────

    /**
     * 列出当前用户名下所有 AI 艺人的歌曲（按创建倒序）。
     * 可选 {@code ?artistId=} 过滤单艺人；若该 artistId 不属于当前用户则 403。
     */
    @GetMapping("/songs")
    public ApiResponse<List<SongDto>> listMySongs(Principal principal,
                                                   @RequestParam(required = false) String artistId) {
        if (artistId != null && !artistId.isBlank()) {
            DigitalIp artist = digitalIpRepo.findById(artistId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "艺人不存在"));
            if (!principal.getName().equals(artist.getOwnerUserId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该艺人不属于当前用户");
            }
            List<SongDto> songs = songRepo.findByArtistIdOrderByCreatedAtDesc(artistId).stream()
                    .map(SongDto::from)
                    .toList();
            return ApiResponse.of(songs);
        }
        List<String> ownedArtistIds = digitalIpRepo
                .findByOwnerUserId(principal.getName())
                .stream()
                .map(DigitalIp::getId)
                .toList();
        if (ownedArtistIds.isEmpty()) {
            return ApiResponse.of(List.of());
        }
        List<SongDto> songs = ownedArtistIds.stream()
                .flatMap(id -> songRepo
                        .findByArtistIdOrderByCreatedAtDesc(id).stream())
                .map(SongDto::from)
                .toList();
        return ApiResponse.of(songs);
    }

    /** 更新歌曲（标题 / 曲风 / 封面 / 歌词 / 时长）。ownership 走 artistId 反查。 */
    @PatchMapping("/songs/{id}")
    public ApiResponse<SongDto> patchSong(Principal principal,
                                           @PathVariable String id,
                                           @RequestBody Map<String, Object> body) {
        Song existing = songRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        String artistId = existing.getArtistId();
        if (artistId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "歌曲缺少艺人归属");
        }
        DigitalIp artist = digitalIpRepo.findById(artistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "艺人不存在"));
        if (!principal.getName().equals(artist.getOwnerUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该歌曲不属于当前用户");
        }

        if (body.containsKey("title"))       existing.setTitle(strOr(body.get("title"), existing.getTitle()));
        if (body.containsKey("genre"))       existing.setGenre(str(body.get("genre")));
        if (body.containsKey("coverUrl"))    existing.setCoverUrl(str(body.get("coverUrl")));
        if (body.containsKey("lyrics"))      existing.setLyrics(str(body.get("lyrics")));
        if (body.containsKey("duration"))    existing.setDuration(intOr(body.get("duration"), existing.getDuration()));
        Song saved = songRepo.save(existing);
        return ApiResponse.of(SongDto.from(saved));
    }

    /**
     * 创建 AI 歌曲。artistId 必填；按 (modelVersion, thinkDepth) 扣 credits。
     * MVP 扣费策略为占位随机值；正式策略见 product_spec.md §10.3。
     */
    @PostMapping("/songs")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SongDto> createSong(Principal principal,
                                            @RequestBody Map<String, Object> body) {
        String artistId = str(body.get("artistId"));
        if (artistId == null || artistId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "artistId 必填");
        }
        DigitalIp artist = digitalIpRepo.findById(artistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "艺人不存在"));
        if (!principal.getName().equals(artist.getOwnerUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该艺人不属于当前用户");
        }

        String modelVersion = str(body.get("modelVersion"));
        String thinkDepth = str(body.get("thinkDepth"));
        long creditsSpent = mockCreditsFor(modelVersion, thinkDepth);

        Song song = Song.builder()
                .id("s-" + UUID.randomUUID().toString().substring(0, 8))
                .title(strOr(body.get("title"), "未命名作品"))
                .genre(strOr(body.get("genre"), "Pop"))
                .duration(intOr(body.get("duration"), 180))
                .status(Song.SongStatus.RECORDING)
                .plays(0)
                .revenue(0)
                .rating(0)
                .artistId(artistId)
                .audioUrl("https://cdn.placeholder.local/mock/audio.mp3")
                .lyrics(str(body.get("lyrics")))
                .modelVersion(modelVersion)
                .thinkDepth(thinkDepth)
                .creditsSpent(creditsSpent)
                .createdAt(Instant.now())
                .build();
        Song saved = songRepo.save(song);
        return ApiResponse.of(SongDto.from(saved));
    }

    /**
     * 推进歌曲状态机：recording → mixing → released（POST /me/songs/{id}/advance）。
     * body: {@code { "status": "mixing" | "released" }}（wire 小写）。释放时落 releaseDate。
     */
    @PostMapping("/songs/{id}/advance")
    public ApiResponse<SongDto> advanceSong(Principal principal,
                                            @PathVariable String id,
                                            @RequestBody Map<String, Object> body) {
        Song existing = songRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        requireSongOwnership(principal, existing);

        String next = str(body.get("status"));
        if (next == null || next.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status 必填");
        }
        Song.SongStatus target;
        try {
            target = Song.SongStatus.valueOf(next.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "非法状态：" + next);
        }
        existing.setStatus(target);
        if (target == Song.SongStatus.RELEASED && existing.getReleaseDate() == null) {
            existing.setReleaseDate(Instant.now());
        }
        return ApiResponse.of(SongDto.from(songRepo.save(existing)));
    }

    /** 当前用户名下所有 AI 艺人的专辑（按创建倒序）。 */
    @GetMapping("/albums")
    public ApiResponse<List<AlbumDto>> listMyAlbums(Principal principal) {
        Set<String> owned = ownedArtistIds(principal);
        if (owned.isEmpty()) return ApiResponse.of(List.of());
        List<AlbumDto> albums = albumRepo.findAll().stream()
                .filter(a -> a.getArtistId() != null && owned.contains(a.getArtistId()))
                .sorted((a, b) -> nullSafeCompareDesc(a.getCreatedAt(), b.getCreatedAt()))
                .map(AlbumDto::from)
                .toList();
        return ApiResponse.of(albums);
    }

    /** 当前用户名下所有 AI 艺人的演唱会（artistIds 命中任一即归属）。 */
    @GetMapping("/concerts")
    public ApiResponse<List<ConcertDto>> listMyConcerts(Principal principal) {
        Set<String> owned = ownedArtistIds(principal);
        if (owned.isEmpty()) return ApiResponse.of(List.of());
        List<ConcertDto> concerts = concertRepo.findAll().stream()
                .filter(c -> c.getArtistIds() != null
                        && c.getArtistIds().stream().anyMatch(owned::contains))
                .sorted((a, b) -> nullSafeCompareDesc(a.getDate(), b.getDate()))
                .map(ConcertDto::from)
                .toList();
        return ApiResponse.of(concerts);
    }

    /**
     * 近 N 天音乐业务趋势（GET /me/music/trends?range=30d）。
     * 当前无逐日播放史表，按用户歌曲的播放/收入总量派生一条确定性的累计曲线
     * （线性铺到 [range] 天，末日 = 当前总量）。接入真实埋点后替换为日维聚合。
     */
    @GetMapping("/music/trends")
    public ApiResponse<List<MusicTrendPointDto>> musicTrends(Principal principal,
                                                             @RequestParam(required = false, defaultValue = "30d") String range) {
        int days = parseRangeDays(range);
        Set<String> owned = ownedArtistIds(principal);

        long totalPlays = 0L;
        long totalRevenue = 0L;
        if (!owned.isEmpty()) {
            List<Song> songs = owned.stream()
                    .flatMap(aid -> songRepo.findByArtistIdOrderByCreatedAtDesc(aid).stream())
                    .toList();
            for (Song s : songs) {
                totalPlays += Math.max(0, s.getPlays());
                totalRevenue += Math.max(0, s.getRevenue());
            }
        }

        List<MusicTrendPointDto> series = new ArrayList<>(days);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        for (int i = days - 1; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            // 累计曲线：第 k 天（1..days）持有 k/days 的总量，确定性、单调不减。
            double ratio = (double) (days - i) / days;
            long plays = Math.round(totalPlays * ratio);
            long revenue = Math.round(totalRevenue * ratio);
            series.add(new MusicTrendPointDto(d.toString(), plays, revenue));
        }
        return ApiResponse.of(series);
    }

    // ── 内部工具 ────────────────────────────────────────────────────────────
    private Set<String> ownedArtistIds(Principal principal) {
        return digitalIpRepo.findByOwnerUserId(principal.getName()).stream()
                .map(DigitalIp::getId)
                .collect(Collectors.toSet());
    }

    private void requireSongOwnership(Principal principal, Song song) {
        String artistId = song.getArtistId();
        if (artistId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "歌曲缺少艺人归属");
        }
        DigitalIp artist = digitalIpRepo.findById(artistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "艺人不存在"));
        if (!principal.getName().equals(artist.getOwnerUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该歌曲不属于当前用户");
        }
    }

    private static int parseRangeDays(String range) {
        if (range == null) return 30;
        String digits = range.replaceAll("[^0-9]", "");
        if (digits.isBlank()) return 30;
        int n = Integer.parseInt(digits);
        return Math.min(Math.max(n, 1), 365);
    }

    private static int nullSafeCompareDesc(Instant a, Instant b) {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return b.compareTo(a);
    }

    private static long mockCreditsFor(String modelVersion, String thinkDepth) {
        long base = modelVersion != null && modelVersion.contains("deep") ? 120 : 60;
        double mult = "deep".equalsIgnoreCase(thinkDepth) ? 2.0
                : "standard".equalsIgnoreCase(thinkDepth) ? 1.3
                : 1.0;
        return Math.round(base * mult + Math.random() * 40);
    }

    private static String str(Object v) {
        return v == null ? null : v.toString();
    }

    private static String strOr(Object v, String fallback) {
        String s = str(v);
        return (s == null || s.isBlank()) ? fallback : s;
    }

    private static int intOr(Object v, int fallback) {
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s) {
            try { return Integer.parseInt(s.trim()); } catch (NumberFormatException ignored) {}
        }
        return fallback;
    }

    @SuppressWarnings("unused")
    private static String lowerOrNull(String s) {
        return s == null ? null : s.toLowerCase(Locale.ROOT);
    }
}
