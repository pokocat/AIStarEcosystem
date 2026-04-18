package com.aistareco.aep.controller;

import com.aistareco.aep.dto.FanArtistDto;
import com.aistareco.aep.dto.FanProfileDto;
import com.aistareco.aep.dto.NFTItemDto;
import com.aistareco.aep.dto.TrackItemDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.model.Song;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.SongRepository;
import com.aistareco.common.ApiResponse;
import com.aistareco.model.NftCollection;
import com.aistareco.repository.NftCollectionRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;
import java.util.Locale;

/**
 * 粉丝端：/api/fan/*。
 * 列表端点均为"从已有实体投影"——无独立 fan 表。
 * like / follow 本期未落库：见 {@code api/fan.ts} TODO 与 FanApp.tsx 顶部 Banner。
 */
@RestController
@RequestMapping("/api/fan")
public class FanController {

    private final DigitalIpRepository ipRepo;
    private final SongRepository songRepo;
    private final NftCollectionRepository nftRepo;
    private final AepUserRepository userRepo;

    public FanController(DigitalIpRepository ipRepo,
                         SongRepository songRepo,
                         NftCollectionRepository nftRepo,
                         AepUserRepository userRepo) {
        this.ipRepo = ipRepo;
        this.songRepo = songRepo;
        this.nftRepo = nftRepo;
        this.userRepo = userRepo;
    }

    @GetMapping("/trending-artists")
    public ApiResponse<List<FanArtistDto>> trendingArtists() {
        List<DigitalIp> top = ipRepo.findAll(
                PageRequest.of(0, 20, Sort.by("statFans").descending())).getContent();
        List<FanArtistDto> out = top.stream()
                .map(ip -> new FanArtistDto(
                        ip.getId(),
                        ip.getName(),
                        kindIcon(ip.getKind()),
                        ip.getAvatarUrl(),
                        formatCompact(ip.getStatFans()),
                        ip.getStatPopularity() >= 70,
                        List.of()
                )).toList();
        return ApiResponse.of(out);
    }

    @GetMapping("/hot-tracks")
    public ApiResponse<List<TrackItemDto>> hotTracks() {
        List<Song> top = songRepo.findAll(Sort.by("plays").descending())
                .stream().limit(50).toList();
        List<TrackItemDto> out = top.stream()
                .map(s -> new TrackItemDto(
                        s.getId(), s.getTitle(), "", "🎵",
                        formatCompact(s.getPlays()),
                        formatDuration(s.getDuration()),
                        false
                )).toList();
        return ApiResponse.of(out);
    }

    @GetMapping("/nft-market")
    public ApiResponse<List<NFTItemDto>> nftMarket() {
        List<NFTItemDto> out = nftRepo.findAll().stream()
                .map(FanController::projectNft).toList();
        return ApiResponse.of(out);
    }

    @GetMapping("/me")
    public ApiResponse<FanProfileDto> me(Principal principal) {
        AepUser user = userRepo.findById(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));
        FanProfileDto out = new FanProfileDto(
                user.getDisplayName() != null ? user.getDisplayName() : user.getUsername(),
                1, 0, 100,
                0, 0, 0,
                "0",
                user.getCreatedAt() != null ? user.getCreatedAt().toString().substring(0, 10) : ""
        );
        return ApiResponse.of(out);
    }

    /** 本期未落库；fan_likes 建表后实现。 */
    @GetMapping("/me/liked-tracks")
    public ApiResponse<List<String>> likedTracks(Principal principal) {
        return ApiResponse.of(List.of());
    }

    /** 本期未落库；fan_follows 建表后实现。 */
    @GetMapping("/me/followed-artists")
    public ApiResponse<List<String>> followedArtists(Principal principal) {
        return ApiResponse.of(List.of());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static NFTItemDto projectNft(NftCollection c) {
        return new NFTItemDto(
                c.getId(), c.getName(), "",
                "🎨", c.getPriceLabel(),
                c.getRarity() != null ? c.getRarity().toLowerCase(Locale.ROOT) : "common",
                c.getRemaining()
        );
    }

    private static String kindIcon(DigitalIp.DigitalIpKind k) {
        if (k == null) return "🎤";
        return switch (k) {
            case SINGER -> "🎤";
            case ACTOR -> "🎭";
            case ENTERTAINER -> "🎪";
            case DANCER -> "💃";
            case HOST -> "🎙";
            case ALL_ROUNDER -> "⭐";
            case IDOL -> "🌟";
        };
    }

    private static String formatCompact(long n) {
        if (n >= 1_000_000) return String.format("%.1fM", n / 1_000_000.0);
        if (n >= 1_000) return String.format("%.1fK", n / 1_000.0);
        return String.valueOf(n);
    }

    private static String formatDuration(int seconds) {
        int m = seconds / 60;
        int s = seconds % 60;
        return String.format("%d:%02d", m, s);
    }
}
