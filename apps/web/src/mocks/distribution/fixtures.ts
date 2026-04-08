export const distributionChannelFixtures = [
  {
    id: "domestic",
    name: "国内AI专属通道",
    nameEn: "Domestic AI Channel",
    description: "腾讯音乐人 / 网易云音乐人",
    iconKey: "domestic" as const,
    iconBg: "from-cyan-500 to-blue-600",
    requiredAccounts: ["tencent_music", "netease_music"],
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
    coverageCount: 4
  },
  {
    id: "global",
    name: "全球流媒体发行",
    nameEn: "Global DSPs",
    description: "DistroKid / TuneCore / CD Baby",
    iconKey: "global" as const,
    iconBg: "from-emerald-500 to-teal-600",
    requiredAccounts: ["distrokid", "spotify_artists"],
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
    coverageCount: 150
  },
  {
    id: "shortVideo",
    name: "短视频矩阵打歌",
    nameEn: "Short Video Matrix",
    description: "抖音 / TikTok / 快手 / Reels",
    iconKey: "shortVideo" as const,
    iconBg: "from-pink-500 to-rose-600",
    requiredAccounts: ["douyin_creator", "tiktok_business"],
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
    coverageCount: 6
  }
];

export const distributionAccountFixtures = [
  { id: "distrokid", labelZh: "DistroKid", labelEn: "DistroKid", connected: true, email: "artist@demo.com" },
  { id: "tencent_music", labelZh: "腾讯音乐人", labelEn: "Tencent Music", connected: false },
  { id: "netease_music", labelZh: "网易云音乐人", labelEn: "NetEase Music", connected: false },
  { id: "spotify_artists", labelZh: "Spotify for Artists", labelEn: "Spotify for Artists", connected: false },
  { id: "douyin_creator", labelZh: "抖音创作者平台", labelEn: "Douyin Creator", connected: false },
  { id: "tiktok_business", labelZh: "TikTok for Business", labelEn: "TikTok Business", connected: false }
];
