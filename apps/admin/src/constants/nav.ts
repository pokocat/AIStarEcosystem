// ─────────────────────────────────────────────────────────────────────────────
// nav.ts — 管理后台侧栏分组。
// 主链：平台账户 → AI 经纪公司 → AI 艺人 → AI 作品 → 分发 → 收益。
// 见 product_spec.md §9「Admin Console 产品功能逻辑」。
// ─────────────────────────────────────────────────────────────────────────────

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  KeySquare,
  Sparkles,
  Music2,
  Disc3,
  Mic2,
  Clapperboard,
  Film,
  Megaphone,
  AudioLines,
  ShieldCheck,
  Radio,
  Send,
  Gift,
  Wallet,
  AlertTriangle,
  PartyPopper,
  Heart,
  Tags,
  Shirt,
  PersonStanding,
  Coins,
  Bell,
  History,
  Package,
  Briefcase,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: string;
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const ADMIN_BRAND = {
  title: "AI Star Eco",
  subtitle: "运营工作台",
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "全局",
    items: [
      { href: "/", label: "运营总览", icon: LayoutDashboard, description: "平台 KPI 与待办队列" },
    ],
  },
  {
    label: "平台账户",
    items: [
      { href: "/platform/accounts", label: "账号 & 经纪公司", icon: Users,     badgeKey: "account_suspended", description: "AepUser ↔ Studio 1:1，账号/主体状态" },
      { href: "/platform/licenses", label: "秘钥批次",        icon: KeySquare, badgeKey: "license_low",       description: "批次 / 秘钥 / 核销" },
    ],
  },
  {
    label: "AI 艺人",
    items: [
      { href: "/artists/lifecycle", label: "艺人生命周期", icon: Sparkles, badgeKey: "artist_trainee", description: "练习生 → 出道 → 活跃" },
      { href: "/artists/roster",    label: "艺人档案",     icon: Users,    description: "全站艺人档案与属主 Studio" },
    ],
  },
  {
    label: "AI 作品",
    items: [
      { href: "/content/songs",     label: "歌曲",      icon: Music2,       badgeKey: "songs_review",      description: "混音完成待发行的单曲" },
      { href: "/content/albums",    label: "专辑",      icon: Disc3,        description: "专辑排期与发行" },
      { href: "/content/concerts",  label: "演唱会",    icon: Mic2,         badgeKey: "concert_selling",   description: "售票中的线上/线下演唱会" },
      { href: "/content/dramas",    label: "短剧",      icon: Clapperboard, description: "虚拟演员短剧项目" },
      { href: "/content/movies",    label: "电影",      icon: Film,         description: "电影角色与后期" },
      { href: "/content/ads",       label: "商业广告",  icon: Megaphone,    description: "品牌代言 / TVC / 数字广告" },
      { href: "/content/voice",     label: "配音作品",  icon: AudioLines,   description: "动画 / 纪录片 / 有声书 / 游戏配音" },
      { href: "/content/copyright", label: "版权核验",  icon: ShieldCheck,  badgeKey: "copyright_pending", description: "待核验版权登记" },
    ],
  },
  {
    label: "分发与变现",
    items: [
      { href: "/distribution/platforms", label: "分发渠道",  icon: Radio,        badgeKey: "platform_pending", description: "平台接入审核" },
      { href: "/distribution/queue",     label: "发行队列",  icon: Send,         badgeKey: "dist_reviewing",   description: "待审核内容分发" },
      { href: "/monetization/nft",       label: "数字藏品",  icon: Gift,         description: "收藏品上架与复核" },
      { href: "/finance/ledger",         label: "结算中心",  icon: Wallet,       badgeKey: "txn_actionable",   description: "钱包 / 流水 / 复核（积分）" },
      { href: "/finance/risk",           label: "异常风控",  icon: AlertTriangle, description: "异常打赏与提现" },
    ],
  },
  {
    label: "明星带货",
    items: [
      { href: "/celebrity/stars",    label: "明星档案", icon: Megaphone, description: "AI 明星专区市场可见的明星" },
      { href: "/celebrity/projects", label: "带货项目", icon: Briefcase, description: "用户在某个明星下创建的带货项目" },
      { href: "/celebrity/products", label: "商品库",   icon: Package,   description: "用户上传 / 自动落库的商品档案" },
    ],
  },
  {
    label: "社群",
    items: [
      { href: "/community/events",     label: "社群活动", icon: PartyPopper, badgeKey: "event_upcoming", description: "投票 / 见面会 / 挑战赛" },
      { href: "/community/moderation", label: "互动审核", icon: Heart,       description: "动态与打赏审核" },
    ],
  },
  {
    label: "基础数据",
    items: [
      { href: "/base/genres",       label: "曲风 / 领域",       icon: Tags,           description: "基础分类维护" },
      { href: "/base/wardrobe",     label: "造型库",            icon: Shirt,          description: "服装与道具" },
      { href: "/base/pose",         label: "动作与表情",        icon: PersonStanding, description: "动作 / 表情 / 手势库" },
      { href: "/base/credit-packs", label: "积分包",            icon: Coins,          description: "积分售卖规格（替代原订阅）" },
      { href: "/base/presets",      label: "孵化 / 锻造炉 预设", icon: Sparkles,       description: "面部风格 / 发型 / 瞳色 / 推荐标签 等预设列表" },
    ],
  },
  {
    label: "消息与日志",
    items: [
      { href: "/notifications", label: "消息中心", icon: Bell,    description: "运营推送与告警" },
      { href: "/audit",         label: "审计日志", icon: History, description: "所有人工介入记录" },
    ],
  },
];
