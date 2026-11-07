/**
 * 总览的演示数据：按首页方案切换的关键指标、固定待办与收益趋势。
 * 生产进度和发布池待审等动态内容由 OverviewDashboard 从本地存储实时读取。
 */
import {
  Play, Users, Wallet, Gauge, Clapperboard, Percent, Coins, ShoppingBag, Flame, Radio,
  GraduationCap, BookOpen, Eye, MousePointerClick, FileCheck, Handshake,
  type LucideIcon,
} from 'lucide-react';
import type { SolutionId } from '../../data/ipPlatform';

type LT = { zh: string; en: string };

export interface Kpi { icon: LucideIcon; label: LT; value: string; delta: string; route: string }

const K = (icon: LucideIcon, zh: string, en: string, value: string, delta: string, route: string): Kpi =>
  ({ icon, label: { zh, en }, value, delta, route });

type KpiFocus = 'star' | 'drama' | 'commerce' | 'education' | 'culture';

const KPI_SETS: Record<KpiFocus, { focus: LT; kpis: Kpi[] }> = {
  star: {
    focus: { zh: '艺人影响力', en: 'Artist reach' },
    kpis: [
      K(Play, '总播放', 'Total plays', '5.8M', '+1.2M', 'analytics'),
      K(Users, '粉丝总数', 'Fans', '162K', '+8.4K', 'fan_operations'),
      K(Wallet, '本月收益', 'Revenue this month', '¥45.2K', '+12.3%', 'monetization_center/revenue'),
      K(Gauge, 'IP 生态估值', 'IP valuation', '¥2.4M', '+18.5%', 'artist_hub/valuation'),
    ],
  },
  drama: {
    focus: { zh: '剧集表现', en: 'Series performance' },
    kpis: [
      K(Play, '剧集播放', 'Episode plays', '4.6M', '+860K', 'analytics'),
      K(Percent, '完播率', 'Completion', '38.2%', '+2.1pt', 'analytics'),
      K(Coins, '平台分账', 'Platform share', '¥86.4K', '+9.8%', 'monetization_center/revenue'),
      K(Clapperboard, '在更剧集', 'Series in production', '3', '+1', 'production_workshop'),
    ],
  },
  commerce: {
    focus: { zh: '带货转化', en: 'Commerce conversion' },
    kpis: [
      K(ShoppingBag, '本月 GMV', 'GMV this month', '¥1.28M', '+21.6%', 'analytics'),
      K(Flame, '投流 ROI', 'Boost ROI', '3.4', '+0.3', 'traffic_boost'),
      K(MousePointerClick, '内容转化率', 'Content conversion', '4.7%', '+0.6pt', 'analytics'),
      K(Radio, '本周直播', 'Lives this week', '6', '+2', 'live_control'),
    ],
  },
  education: {
    focus: { zh: '课程与学员', en: 'Courses and learners' },
    kpis: [
      K(GraduationCap, '学员数', 'Learners', '12.6K', '+1.1K', 'fan_operations'),
      K(Percent, '课程完播率', 'Course completion', '61%', '+4pt', 'analytics'),
      K(Wallet, '知识付费收入', 'Course revenue', '¥62.8K', '+15.2%', 'monetization_center/revenue'),
      K(BookOpen, '在售课程', 'Courses on sale', '8', '+1', 'monetization_center/projects'),
    ],
  },
  culture: {
    focus: { zh: '品牌与授权', en: 'Brand and licensing' },
    kpis: [
      K(Eye, '品牌曝光', 'Impressions', '8.9M', '+1.6M', 'analytics'),
      K(MousePointerClick, '互动率', 'Engagement', '6.3%', '+0.8pt', 'analytics'),
      K(FileCheck, '授权收入', 'Licensing revenue', '¥38.5K', '+11.4%', 'compliance_tools/license'),
      K(Handshake, '合作项目', 'Partnerships', '5', '+2', 'monetization_center/brand'),
    ],
  },
};

const FOCUS_BY_SOLUTION: Record<SolutionId, KpiFocus> = {
  ecosystem: 'star',
  'ai-artist': 'star',
  'virtual-idol': 'star',
  'social-ip': 'star',
  'ai-drama': 'drama',
  'anime-ip': 'drama',
  'story-commerce': 'commerce',
  'brand-ip': 'commerce',
  'digital-founder': 'commerce',
  'education-ip': 'education',
  'corporate-ip': 'culture',
  'city-ip': 'culture',
  'culture-ip': 'culture',
};

export const kpisFor = (solution: SolutionId) => KPI_SETS[FOCUS_BY_SOLUTION[solution] ?? 'star'];

export type TodoTone = 'urgent' | 'today' | 'chance' | 'notice';
export const TODO_TONES: Record<TodoTone, { color: string; label: LT }> = {
  urgent: { color: '#ef4444', label: { zh: '紧急', en: 'Urgent' } },
  today: { color: '#f59e0b', label: { zh: '今日', en: 'Today' } },
  chance: { color: '#22c55e', label: { zh: '机会', en: 'Opportunity' } },
  notice: { color: '#3b82f6', label: { zh: '提醒', en: 'Reminder' } },
};
export const TONE_ORDER: TodoTone[] = ['urgent', 'today', 'chance', 'notice'];

/** Business to-dos that do not come from the AI 导演台 or the publish pool. */
export const STANDING_TODOS: Array<{ tone: TodoTone; text: LT; route: string }> = [
  { tone: 'urgent', text: { zh: '2 个报白账号待补充材料', en: '2 whitelist accounts need documents' }, route: 'account_mgmt' },
  { tone: 'today', text: { zh: '苏念的橙区内容待合规复核', en: "Su Nian's orange-zone content needs review" }, route: 'compliance_tools/review' },
  { tone: 'chance', text: { zh: '平台扶持投流：1 个视频可申请', en: 'Platform boost grant: 1 video eligible' }, route: 'traffic_boost' },
  { tone: 'notice', text: { zh: 'Pro 套餐 15 天后到期', en: 'Pro plan renews in 15 days' }, route: 'settings/billing' },
];

export const REVENUE_SERIES = [
  { key: 'content', color: '#7c3aed', label: { zh: '内容分账', en: 'Content share' } },
  { key: 'brand', color: '#0891b2', label: { zh: '商务合作', en: 'Brand deals' } },
  { key: 'fans', color: '#db2777', label: { zh: '粉丝付费', en: 'Fan spending' } },
] as const;

export const REVENUE_TREND = [
  { month: { zh: '1月', en: 'Jan' }, content: 4000, brand: 2400, fans: 1200 },
  { month: { zh: '2月', en: 'Feb' }, content: 3000, brand: 1398, fans: 800 },
  { month: { zh: '3月', en: 'Mar' }, content: 5200, brand: 3800, fans: 2100 },
  { month: { zh: '4月', en: 'Apr' }, content: 2780, brand: 3908, fans: 1500 },
  { month: { zh: '5月', en: 'May' }, content: 6890, brand: 4800, fans: 3200 },
  { month: { zh: '6月', en: 'Jun' }, content: 8390, brand: 6300, fans: 4100 },
];
