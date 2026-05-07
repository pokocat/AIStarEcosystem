package com.aistareco.aep.controller;

import com.aistareco.aep.dto.DigitalIpDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.MeDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.RechargePackageDto;
import com.aistareco.aep.dto.RechargeRequestDto;
import com.aistareco.aep.dto.RechargeResponseDto;
import com.aistareco.aep.dto.SongDto;
import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.model.Song;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.SongRepository;
import com.aistareco.aep.service.AccountSelfService;
import com.aistareco.aep.service.DigitalIpService;
import com.aistareco.aep.service.RechargeService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/me")
public class AccountController {

    private final AccountSelfService accountSelfService;
    private final DigitalIpService digitalIpService;
    private final SongRepository songRepo;
    private final DigitalIpRepository digitalIpRepo;
    private final RechargeService rechargeService;

    public AccountController(AccountSelfService accountSelfService,
                             DigitalIpService digitalIpService,
                             SongRepository songRepo,
                             DigitalIpRepository digitalIpRepo,
                             RechargeService rechargeService) {
        this.accountSelfService = accountSelfService;
        this.digitalIpService = digitalIpService;
        this.songRepo = songRepo;
        this.digitalIpRepo = digitalIpRepo;
        this.rechargeService = rechargeService;
    }

    @GetMapping
    public ApiResponse<MeDto> me(Principal principal) {
        return ApiResponse.of(accountSelfService.getCurrentMe(principal.getName()));
    }

    @PatchMapping
    public ApiResponse<MeDto> updateMe(Principal principal, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(accountSelfService.updateCurrentUser(principal.getName(), body));
    }

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
     * v0.4：充值落账。
     * mock：直接落账。线上接 wx.requestPayment 回调成功后调用。
     */
    @PostMapping("/wallet/recharge")
    public ApiResponse<RechargeResponseDto> walletRecharge(Principal principal,
                                                            @RequestBody RechargeRequestDto req) {
        if (req == null || req.packageId() == null || req.packageId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "packageId 必填");
        }
        return ApiResponse.of(rechargeService.recharge(principal.getName(), req.packageId()));
    }

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
