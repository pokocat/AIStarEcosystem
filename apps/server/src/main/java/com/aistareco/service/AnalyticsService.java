package com.aistareco.service;

import com.aistareco.dto.AnalyticsDashboardPayload;
import com.aistareco.dto.MarketplaceListingDto;
import com.aistareco.repository.MarketplaceListingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final MarketplaceListingRepository listingRepo;

    public AnalyticsDashboardPayload getDashboard() {
        List<MarketplaceListingDto> listings = listingRepo.findAll().stream()
                .map(l -> new MarketplaceListingDto(
                        l.getId(), l.getArtistId(), l.getName(), l.getStyle(),
                        l.getAvatarUrl(), l.getPriceLabel(), l.getOwner(),
                        l.getSongs(), l.getFollowersLabel(), l.getDescription(),
                        l.isAutoReplyEnabled() ? true : null))
                .toList();
        return new AnalyticsDashboardPayload(
                producerMetrics(), coachMetrics(), earningsSeries(),
                transactions(), listings, coachTrainees(), distribution()
        );
    }

    private Map<String, Object> producerMetrics() {
        return Map.of("artistCount", 4, "totalPlays", 4200000, "marketSignings", 3,
                "revenueCny", 45000, "newSongs", 142, "successRate", 85, "pendingReviews", 12);
    }

    private Map<String, Object> coachMetrics() {
        return Map.of("artistCount", 4, "totalPlays", 4200000, "marketSignings", 3,
                "revenueCny", 458290, "newSongs", 142, "successRate", 85, "pendingReviews", 12);
    }

    private List<Map<String, Object>> earningsSeries() {
        return List.of(
                Map.of("name", "1", "song", 4000, "badge", 2400),
                Map.of("name", "2", "song", 3000, "badge", 1398),
                Map.of("name", "3", "song", 2000, "badge", 9800),
                Map.of("name", "4", "song", 2780, "badge", 3908),
                Map.of("name", "5", "song", 1890, "badge", 4800),
                Map.of("name", "6", "song", 2390, "badge", 3800),
                Map.of("name", "7", "song", 3490, "badge", 4300)
        );
    }

    private List<Map<String, Object>> transactions() {
        return List.of(
                Map.of("id", "txn-1", "date", "2026-03-15", "description", "Royalty Payout - Feb 2026",       "amountLabel", "+ ¥12,450", "status", "Completed"),
                Map.of("id", "txn-2", "date", "2026-03-14", "description", "Mint Revenue - Genesis Badge",    "amountLabel", "+ ¥8,920",  "status", "Completed"),
                Map.of("id", "txn-3", "date", "2026-03-12", "description", "AI Service Fee (Suno API)",       "amountLabel", "- ¥200",    "status", "Completed"),
                Map.of("id", "txn-4", "date", "2026-03-10", "description", "Withdrawal to Wallet (0x8...2a)","amountLabel", "- ¥5,000",  "status", "Processing")
        );
    }

    private List<Map<String, Object>> coachTrainees() {
        return List.of(
                Map.of("id", "coach-1", "name", "Alex Chen", "status", "On Track", "progress", 75,  "revenue", 1200, "lastActive", "2h ago",  "avatarUrl", "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100", "latestSubmissionTitle", "Neon Nights.mp3"),
                Map.of("id", "coach-2", "name", "Sarah V",   "status", "Warning",  "progress", 30,  "revenue", 450,  "lastActive", "3d ago",  "avatarUrl", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", "latestSubmissionTitle", "Skyline Dusk.mp3"),
                Map.of("id", "coach-3", "name", "Mike D",    "status", "On Track", "progress", 88,  "revenue", 3400, "lastActive", "15m ago", "avatarUrl", "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100", "latestSubmissionTitle", "Arc Reactor.mp3"),
                Map.of("id", "coach-4", "name", "Emma W",    "status", "Star",     "progress", 95,  "revenue", 8900, "lastActive", "Just now","avatarUrl", "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100", "latestSubmissionTitle", "Aurora Bloom.mp3")
        );
    }

    private Map<String, Object> distribution() {
        return Map.of(
                "channels", List.of(
                        Map.of("id", "domestic",   "name", "国内AI专属通道", "nameEn", "Domestic AI Channel",
                                "description", "腾讯音乐人 / 网易云音乐人", "iconKey", "domestic",
                                "iconBg", "from-cyan-500 to-blue-600",
                                "requiredAccounts", List.of("tencent_music", "netease_music"),
                                "benefits",   List.of("✓ 自动标记 AI 创作标签", "✓ QQ音乐、酷狗、酷我同步上架", "✓ 支持纯 AI 生成作品发行"),
                                "benefitsEn", List.of("✓ Auto-tag AI Created", "✓ QQ Music, Kugou, Kuwo sync", "✓ Pure AI works supported"),
                                "coverageCount", 4),
                        Map.of("id", "global",     "name", "全球流媒体发行", "nameEn", "Global DSPs",
                                "description", "DistroKid / TuneCore / CD Baby", "iconKey", "global",
                                "iconBg", "from-emerald-500 to-teal-600",
                                "requiredAccounts", List.of("distrokid", "spotify_artists"),
                                "benefits",   List.of("✓ Spotify, Apple Music, YouTube Music, Amazon", "✓ 150+ 平台同步发行", "✓ 支持 ISRC 与 UPC 国际标准码"),
                                "benefitsEn", List.of("✓ Spotify, Apple Music, YouTube Music, Amazon", "✓ 150+ platforms sync", "✓ ISRC & UPC support"),
                                "coverageCount", 150),
                        Map.of("id", "shortVideo", "name", "短视频矩阵打歌", "nameEn", "Short Video Matrix",
                                "description", "抖音 / TikTok / 快手 / Reels", "iconKey", "shortVideo",
                                "iconBg", "from-pink-500 to-rose-600",
                                "requiredAccounts", List.of("douyin_creator", "tiktok_business"),
                                "benefits",   List.of("✓ 自动生成 15s/30s/60s 竖屏切片", "✓ 批量发布至多平台矩阵账号", "✓ 引流至完整版与 NFT 购买页"),
                                "benefitsEn", List.of("✓ Auto-generate vertical clips", "✓ Batch post to matrix accounts", "✓ Drive traffic to full version & NFT"),
                                "coverageCount", 6)
                ),
                "accountBindings", List.of(
                        Map.of("id", "distrokid",       "labelZh", "DistroKid",            "labelEn", "DistroKid",            "connected", true,  "email", "artist@demo.com"),
                        Map.of("id", "tencent_music",   "labelZh", "腾讯音乐人",             "labelEn", "Tencent Music",        "connected", false),
                        Map.of("id", "netease_music",   "labelZh", "网易云音乐人",            "labelEn", "NetEase Music",        "connected", false),
                        Map.of("id", "spotify_artists", "labelZh", "Spotify for Artists",   "labelEn", "Spotify for Artists",  "connected", false),
                        Map.of("id", "douyin_creator",  "labelZh", "抖音创作者平台",          "labelEn", "Douyin Creator",       "connected", false),
                        Map.of("id", "tiktok_business", "labelZh", "TikTok for Business",   "labelEn", "TikTok Business",      "connected", false)
                )
        );
    }
}
