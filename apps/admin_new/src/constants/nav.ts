// ─────────────────────────────────────────────────────────────────────────────
// nav.ts — 管理后台侧栏分组。
// 主链：平台账户 → AI 经纪公司 → AI 艺人 → AI 作品 → 分发 → 收益 → 社群 → 基础数据。
// 见 product_spec.md §9「Admin Console 产品功能逻辑」。
// ─────────────────────────────────────────────────────────────────────────────

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Building2,
  KeySquare,
  Settings2,
  Sparkles,
  UserCircle2,
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
  subtitle: "运营控制台 v2",
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "全局",
    items: [
      { href: "/", label: "运营总览", icon: LayoutDashboard, description: "平台 KPI 与待办" },
    ],
  },
  {
    label: "平台账户",
    items: [
      { href: "/platform/accounts", label: "账号",         icon: Users,     badgeKey: "account_suspended", description: "AepUser 账号与状态" },
      { href: "/platform/studios",  label: "经纪公司",     icon: Building2, description: "工作室 / 经纪公司档案" },
      { href: "/platform/licenses", label: "秘钥批次",     icon: KeySquare, badgeKey: "license_low",       description: "License 批次与核销" },
      { href: "/platform/config",   label: "平台配置",     icon: Settings2, description: "运营参数 / 工作流计费 / 灰度" },
    ],
  },
  {
    label: "AI 艺人",
    items: [
      { href: "/artists/lifecycle", label: "艺人生命周期", icon: Sparkles,     badgeKey: "artist_trainee", description: "练习生 → 出道 → 活跃" },
      { href: "/artists/roster",    label: "艺人档案",     icon: UserCircle2,  description: "全站艺人档案与属主 Studio" },
    ],
  },
  {
    label: "AI 作品",
    items: [
      { href: "/content/songs",     label: "歌曲",     icon: Music2,       badgeKey: "songs_review",      description: "待发行单曲复核" },
      { href: "/content/albums",    label: "专辑",     icon: Disc3,        description: "专辑 / 歌单" },
      { href: "/content/concerts",  label: "演唱会",   icon: Mic2,         badgeKey: "concert_selling",   description: "线上直播活动" },
      { href: "/content/dramas",    label: "短剧",     icon: Clapperboard, description: "虚拟演员短剧项目" },
      { href: "/content/movies",    label: "电影",     icon: Film,         description: "电影角色与后期" },
      { href: "/content/ads",       label: "商业广告", icon: Megaphone,    description: "品牌代言 / TVC / 数字广告" },
      { href: "/content/voice",     label: "配音作品", icon: AudioLines,   description: "动画 / 纪录片 / 有声书 / 游戏" },
      { href: "/content/copyright", label: "版权核验", icon: ShieldCheck,  badgeKey: "copyright_pending", description: "待核验版权登记" },
    ],
  },
  {
    label: "分发与变现",
    items: [
      { href: "/distribution/platforms", label: "分发渠道", icon: Radio,         badgeKey: "platform_pending", description: "第三方平台接入" },
      { href: "/distribution/queue",     label: "发行队列", icon: Send,          badgeKey: "dist_reviewing",   description: "待审内容分发" },
      { href: "/monetization/nft",       label: "数字藏品", icon: Gift,          description: "收藏品上架与复核" },
      { href: "/finance/ledger",         label: "结算中心", icon: Wallet,        badgeKey: "txn_actionable",   description: "钱包 / 积分流水" },
      { href: "/finance/risk",           label: "异常风控", icon: AlertTriangle, description: "异常打赏与提现" },
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
      { href: "/base/genres",       label: "曲风 / 领域",        icon: Tags,           description: "基础分类维护" },
      { href: "/base/wardrobe",     label: "造型库",             icon: Shirt,          description: "服装与道具" },
      { href: "/base/pose",         label: "动作与表情",         icon: PersonStanding, description: "动作 / 表情 / 手势库" },
      { href: "/base/credit-packs", label: "积分包",             icon: Coins,          description: "积分售卖规格" },
      { href: "/base/presets",      label: "孵化 / 锻造炉预设",   icon: Sparkles,       description: "面部风格 / 发型 / 瞳色 预设" },
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

/** 根据路径名查找匹配的导航项（用于 Topbar 面包屑 / 页标题）。 */
export function findNavItemByPath(pathname: string): { group: string; item: NavItem } | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/")) {
        return { group: group.label, item };
      }
    }
  }
  return null;
}
