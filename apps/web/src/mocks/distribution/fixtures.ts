import type { DistributionChannel, PlatformAccount } from "@/types/contracts/distribution";

export const distributionChannelFixtures: DistributionChannel[] = [
  {
    id: "domestic",
    name: "国内AI专属通道",
    nameEn: "Domestic AI Channel",
    description: "腾讯音乐人 / 网易云音乐人",
    requiredAccounts: ["tencentMusic", "neteaseMusic"],
    benefits: [
      "✓ 自动标记 AI 创作标签",
      "✓ QQ音乐、酷狗、酷我同步上架",
      "✓ 支持纯 AI 生成作品发行"
    ],
    benefitsEn: [
      "✓ Auto-tag AI Created",
      "✓ QQ Music, Kugou, Kuwo sync",
      "✓ Pure AI works supported"
    ],
    platformCount: 4,
    isActive: true
  },
  {
    id: "global",
    name: "全球流媒体发行",
    nameEn: "Global DSPs",
    description: "DistroKid / TuneCore / CD Baby",
    requiredAccounts: ["distrokid", "spotifyArtists"],
    benefits: [
      "✓ Spotify, Apple Music, YouTube Music, Amazon",
      "✓ 150+ 平台同步发行",
      "✓ 支持 ISRC 与 UPC 国际标准码"
    ],
    benefitsEn: [
      "✓ Spotify, Apple Music, YouTube Music, Amazon",
      "✓ 150+ platforms sync",
      "✓ ISRC & UPC support"
    ],
    platformCount: 150,
    isActive: true
  },
  {
    id: "shortVideo",
    name: "短视频矩阵打歌",
    nameEn: "Short Video Matrix",
    description: "抖音 / TikTok / 快手 / Reels",
    requiredAccounts: ["douyinCreator", "tiktokBusiness"],
    benefits: [
      "✓ 自动生成 15s/30s/60s 竖屏切片",
      "✓ 批量发布至多平台矩阵账号",
      "✓ 引流至完整版与 NFT 购买页"
    ],
    benefitsEn: [
      "✓ Auto-generate vertical clips",
      "✓ Batch post to matrix accounts",
      "✓ Drive traffic to full version & NFT"
    ],
    platformCount: 6,
    isActive: true
  }
];

export const distributionAccountFixtures: PlatformAccount[] = [
  {
    id: "acct-1",
    userId: "user-demo",
    platformKey: "distrokid",
    connected: true,
    email: "artist@demo.com",
    connectedAt: "2026-01-10T08:00:00Z",
    updatedAt: "2026-01-10T08:00:00Z"
  },
  {
    id: "acct-2",
    userId: "user-demo",
    platformKey: "tencentMusic",
    connected: false,
    email: null,
    connectedAt: null,
    updatedAt: "2026-01-01T00:00:00Z"
  },
  {
    id: "acct-3",
    userId: "user-demo",
    platformKey: "neteaseMusic",
    connected: false,
    email: null,
    connectedAt: null,
    updatedAt: "2026-01-01T00:00:00Z"
  },
  {
    id: "acct-4",
    userId: "user-demo",
    platformKey: "spotifyArtists",
    connected: false,
    email: null,
    connectedAt: null,
    updatedAt: "2026-01-01T00:00:00Z"
  },
  {
    id: "acct-5",
    userId: "user-demo",
    platformKey: "douyinCreator",
    connected: false,
    email: null,
    connectedAt: null,
    updatedAt: "2026-01-01T00:00:00Z"
  },
  {
    id: "acct-6",
    userId: "user-demo",
    platformKey: "tiktokBusiness",
    connected: false,
    email: null,
    connectedAt: null,
    updatedAt: "2026-01-01T00:00:00Z"
  }
];
