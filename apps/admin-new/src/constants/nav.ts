import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Music2,
  Disc3,
  Film,
  Mic2,
  ShieldCheck,
  Users,
  UserCog,
  Handshake,
  Send,
  Radio,
  Wallet,
  AlertTriangle,
  Heart,
  Gift,
  PartyPopper,
  Shirt,
  PersonStanding,
  Tags,
  Bell,
  History,
  Settings2,
  Sparkles,
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

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "全局",
    items: [
      { href: "/", label: "运营总览", icon: LayoutDashboard, description: "平台 KPI 与待办队列" },
    ],
  },
  {
    label: "内容审核",
    items: [
      { href: "/content/songs", label: "歌曲审核", icon: Music2, badgeKey: "songs_review", description: "混音完成待发行的单曲" },
      { href: "/content/albums", label: "专辑审核", icon: Disc3, description: "专辑排期与发行" },
      { href: "/content/concerts", label: "演出管理", icon: Mic2, badgeKey: "concert_selling", description: "售票中的演出" },
      { href: "/content/film", label: "影视 / MV", icon: Film, badgeKey: "film_post", description: "后期制作 & 上线审核" },
      { href: "/content/copyright", label: "版权核验", icon: ShieldCheck, badgeKey: "copyright_pending", description: "待核验版权登记" },
    ],
  },
  {
    label: "艺人与经纪",
    items: [
      { href: "/artists/lifecycle", label: "艺人生命周期", icon: Sparkles, badgeKey: "artist_trainee", description: "练习生→出道→活跃" },
      { href: "/artists/roster", label: "艺人档案", icon: Users, description: "全站艺人档案" },
      { href: "/coach/contracts", label: "合约管理", icon: Handshake, badgeKey: "contract_expiring", description: "MCN 签约与续约" },
      { href: "/coach/mcn", label: "MCN 机构", icon: UserCog, description: "机构与分成" },
    ],
  },
  {
    label: "分发与变现",
    items: [
      { href: "/distribution/platforms", label: "分发渠道", icon: Radio, badgeKey: "platform_pending", description: "平台接入审核" },
      { href: "/distribution/queue", label: "发行队列", icon: Send, badgeKey: "dist_reviewing", description: "待审核内容分发" },
      { href: "/finance/settlement", label: "结算中心", icon: Wallet, badgeKey: "txn_actionable", description: "待复核与处理中流水" },
      { href: "/finance/risk", label: "异常风控", icon: AlertTriangle, description: "异常打赏与提现" },
    ],
  },
  {
    label: "社群与粉丝",
    items: [
      { href: "/community/events", label: "活动管理", icon: PartyPopper, badgeKey: "event_upcoming", description: "投票 / 见面会 / 挑战赛" },
      { href: "/community/moderation", label: "互动审核", icon: Heart, description: "动态与打赏审核" },
      { href: "/fan/nft-market", label: "NFT 市场", icon: Gift, description: "收藏品上架与复核" },
    ],
  },
  {
    label: "运营基础数据",
    items: [
      { href: "/base/genres", label: "曲风 / 领域", icon: Tags, description: "基础分类维护" },
      { href: "/base/wardrobe", label: "造型库", icon: Shirt, description: "服装与道具" },
      { href: "/base/pose", label: "动作与表情", icon: PersonStanding, description: "动作 / 表情 / 手势库" },
      { href: "/base/plans", label: "订阅套餐", icon: Settings2, description: "Free / Pro / Enterprise" },
    ],
  },
  {
    label: "消息与日志",
    items: [
      { href: "/notifications", label: "消息中心", icon: Bell, description: "运营推送与告警" },
      { href: "/audit", label: "审计日志", icon: History, description: "所有人工介入记录" },
    ],
  },
];

export const ADMIN_BRAND = {
  title: "AI Star Eco",
  subtitle: "运营工作台",
};
