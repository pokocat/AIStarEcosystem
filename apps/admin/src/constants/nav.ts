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
  /** v0.5：sidebar 过滤；false 时不在导航中展示（URL 直访仍可用）。默认 true。 */
  enabled?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /** v0.5：整组隐藏（不展示该 group 标题）。默认 true。 */
  enabled?: boolean;
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
  // v0.5：明星带货线（重点）— 提到上面，加新条目
  {
    label: "明星带货",
    items: [
      { href: "/celebrity/stars",                label: "明星档案",     icon: Megaphone, description: "AI 明星专区市场可见的明星（CRUD）" },
      { href: "/celebrity/templates",            label: "模板",         icon: Sparkles,  description: "模板卡片元信息 + previewVideoUrl" },
      { href: "/celebrity/template-scripts",     label: "模板脚本",     icon: Sparkles,  description: "v0.5 §3.2.7：每个模板的 prompt 集合 / 视频参考" },
      { href: "/celebrity/star-authorizations",  label: "授权关系",     icon: ShieldCheck, description: "用户 × 明星授权状态机" },
      { href: "/celebrity/engine-pricing",       label: "引擎价格",     icon: Coins,     description: "KeLing / HiGen / MiniMax 计价" },
      { href: "/celebrity/projects",             label: "带货项目",     icon: Briefcase, description: "用户在某个明星下创建的带货项目" },
      { href: "/celebrity/products",             label: "商品库",       icon: Package,   description: "用户上传 / 自动落库的商品档案" },
    ],
  },
  // v0.5：财务（钱包 + 套餐）保留启用
  {
    label: "财务",
    items: [
      { href: "/finance/ledger",            label: "结算中心",   icon: Wallet,        badgeKey: "txn_actionable", description: "钱包 / 流水 / 复核" },
      { href: "/finance/recharge-packages", label: "充值套餐",   icon: Gift,          description: "v0.5：积分充值套餐 CRUD（软删）" },
      { href: "/finance/risk",              label: "异常风控",   icon: AlertTriangle, description: "异常打赏与提现" },
    ],
  },
  // v0.5：本期隐藏数字人/数字IP 内容线（保留源码，sidebar 不展示）
  {
    label: "AI 作品（数字人产品线）",
    enabled: false,
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
    label: "分发",
    items: [
      { href: "/distribution/platforms",       label: "分发渠道", icon: Radio, badgeKey: "platform_pending", description: "平台接入审核" },
      { href: "/distribution/queue",           label: "发行队列", icon: Send,  badgeKey: "dist_reviewing",   description: "待审核内容分发" },
      { href: "/distribution/social-accounts", label: "社交账号", icon: Radio, description: "sau 绑定的第三方账号" },
      { href: "/distribution/jobs",            label: "发布任务", icon: Send,  description: "sau 发布任务与事件流" },
    ],
  },
  // v0.5：本期隐藏 NFT / 社群（产品线分叉）
  {
    label: "变现 / 社群（数字人产品线）",
    enabled: false,
    items: [
      { href: "/monetization/nft",     label: "数字藏品", icon: Gift,        description: "收藏品上架与复核" },
      { href: "/community/events",     label: "社群活动", icon: PartyPopper, badgeKey: "event_upcoming", description: "投票 / 见面会 / 挑战赛" },
      { href: "/community/moderation", label: "互动审核", icon: Heart,       description: "动态与打赏审核" },
    ],
  },
  {
    label: "基础数据",
    items: [
      { href: "/base/genres",       label: "曲风 / 领域",       icon: Tags,           enabled: false, description: "基础分类维护（数字人产品线）" },
      { href: "/base/wardrobe",     label: "造型库",            icon: Shirt,          enabled: false, description: "服装与道具（数字人产品线）" },
      { href: "/base/pose",         label: "动作与表情",        icon: PersonStanding, enabled: false, description: "动作 / 表情 / 手势库（数字人产品线）" },
      { href: "/base/credit-packs", label: "积分包",            icon: Coins,          description: "积分售卖规格" },
      { href: "/base/presets",      label: "孵化 / 锻造炉 预设", icon: Sparkles,       enabled: false, description: "数字人形象工坊 预设列表" },
    ],
  },
  {
    label: "平台与配置",
    items: [
      { href: "/platform/ai-models",  label: "AI 模型",  icon: Sparkles, description: "v0.5：接入 OpenAI 兼容 API token，driver template-scripts 与脚本起草" },
      { href: "/platform/llm-keys",   label: "LLM 网关 Key", icon: KeySquare, description: "v0.6：业务侧调 llm-gateway 的 sk-aep-* key，按 token 计费回写 ledger" },
      { href: "/platform/config",     label: "平台配置", icon: KeySquare, description: "全站开关与文案" },
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

/** v0.5：取启用的 NavGroups（filter group.enabled !== false 且至少有一个 enabled !== false 的 item）。 */
export function visibleNavGroups(): NavGroup[] {
  return NAV_GROUPS
    .filter((g) => g.enabled !== false)
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => it.enabled !== false),
    }))
    .filter((g) => g.items.length > 0);
}
