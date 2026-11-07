/**
 * Single source of truth for the operator console's information architecture:
 * sidebar groups, each page's sub-tabs, and where legacy page ids now live.
 * Every routable page or tab is reachable from the sidebar; ⌘K search is built from this too.
 */
import type { SolutionId } from '../../data/ipPlatform';
import {
  LayoutDashboard, Users, Star, Store, Gauge, TrendingUp, Network,
  Factory, Clapperboard, Scissors, ScanFace, Shuffle, Film, Image as ImageIcon,
  Package, FileText, Shirt,
  Zap, Calendar, Lightbulb, Globe, Link2, Flame, Radio,
  Heart, MessageCircle,
  Wallet, ShoppingBag, Handshake, LineChart, Coins, Percent, BarChart3,
  Shield, FileCheck, ShieldCheck, FileSignature, Copyright, Layers, Search,
  GraduationCap, Settings, User, Key, UsersRound, Bell, Palette, CreditCard, Download,
  type LucideIcon,
} from 'lucide-react';

type LT = { zh: string; en: string };

export interface NavTab { id: string; icon: LucideIcon; zh: string; en: string; keywords?: string[] }
export interface NavPage {
  id: string;
  icon: LucideIcon;
  zh: string;
  en: string;
  desc: LT;
  accent: string;
  tabs?: NavTab[];
  keywords?: string[];
}
export interface NavGroup { title: LT; pages: NavPage[] }

const T = (id: string, icon: LucideIcon, zh: string, en: string, keywords?: string[]): NavTab => ({ id, icon, zh, en, keywords });

export const NAV_GROUPS: NavGroup[] = [
  {
    title: { zh: '工作台', en: 'Workspace' },
    pages: [
      { id: 'overview', icon: LayoutDashboard, zh: '总览', en: 'Overview', accent: '#7c3aed', desc: { zh: '今日待办、关键指标与生产进度', en: 'Today, key metrics and production progress' }, keywords: ['dashboard', '大盘', '工作台'] },
    ],
  },
  {
    title: { zh: '角色 IP', en: 'Role IP' },
    pages: [
      {
        id: 'artist_hub', icon: Users, zh: '角色 IP 中心', en: 'Role IP Center', accent: '#7c3aed',
        desc: { zh: '孵化、签约、估值与成长，管理你的全部角色 IP', en: 'Incubate, sign, value and grow every role IP' },
        keywords: ['艺人', 'artist', '孵化', 'incubate', 'ip'],
        tabs: [
          T('mine', Users, '我的 IP', 'My IPs', ['矩阵', 'matrix']),
          T('celebrity', Star, '明星专区', 'Celebrity Zone', ['签约', 'signing']),
          T('market', Store, 'IP 市场', 'IP Market', ['交易', 'market']),
          T('valuation', Gauge, 'IP 估值', 'IP Valuation', ['估值', 'valuation']),
          T('growth', TrendingUp, '成长档案', 'Growth Tracker', ['成长', 'growth']),
          T('ecosystem', Network, '生态图谱', 'Ecosystem Map', ['生态', 'ecosystem']),
        ],
      },
    ],
  },
  {
    title: { zh: '内容生产', en: 'Production' },
    pages: [
      {
        id: 'production_workshop', icon: Factory, zh: '制作工坊', en: 'Workshop', accent: '#7c3aed',
        desc: { zh: 'AI 创作（AI 导演 / AI 图片 / AI 视频）与批量工具', en: 'AI Create (Director / Image / Video) and batch tools' },
        keywords: ['导演台', 'director', '创作', 'studio', 'AI 创作'],
        tabs: [
          T('director', Clapperboard, 'AI 创作 · 导演', 'AI Create · Director', ['导演', '导演台', 'director', '短剧', '分镜', '项目']),
          T('image', ImageIcon, 'AI 创作 · 图片', 'AI Create · Image', ['图片', '出图', '写真', '表情包', '白底图', 'image', 'AI 图片']),
          T('video', Film, 'AI 创作 · 视频', 'AI Create · Video', ['视频', '口播', '带货', 'video', '场景', 'AI 视频']),
          T('clip', Scissors, '真人切片', 'Clip Studio', ['切片', 'clip']),
          T('digital_person', ScanFace, 'AI 数字人', 'Digital Human', ['数字人']),
          T('batch_mix', Shuffle, '混剪批量', 'Batch Mix', ['混剪', 'mix']),
        ],
      },
      {
        id: 'asset_center', icon: Package, zh: '素材中心', en: 'Asset Center', accent: '#0891b2',
        desc: { zh: '数字资产、文案与形象造型统一管理', en: 'Digital assets, copy and looks in one place' },
        tabs: [
          T('assets', Package, '数字资产库', 'Digital Assets', ['素材', 'asset']),
          T('copy', FileText, '文案库', 'Copy Library', ['文案', 'copy']),
          T('wardrobe', Shirt, '形象衣橱', 'Wardrobe', ['造型', '衣橱', 'style']),
        ],
      },
    ],
  },
  {
    title: { zh: '发布与增长', en: 'Publish & Grow' },
    pages: [
      {
        id: 'publish_center', icon: Zap, zh: '发布中心', en: 'Publish Center', accent: '#0891b2',
        desc: { zh: '从审核排期到全网分发', en: 'From review and scheduling to distribution' },
        tabs: [
          T('pool', Zap, '发布池', 'Publish Pool', ['审核', 'review']),
          T('calendar', Calendar, '内容日历', 'Calendar', ['日历', '排期']),
          T('planning', Lightbulb, 'AI 内容规划', 'AI Planning', ['规划', 'planning', '选题']),
          T('distribution', Globe, '全网分发', 'Distribution', ['分发', 'publish']),
        ],
      },
      { id: 'account_mgmt', icon: Link2, zh: '账号矩阵', en: 'Account Matrix', accent: '#0891b2', desc: { zh: '绑定、报白与账号健康度', en: 'Binding, whitelisting and account health' }, keywords: ['账号', 'account', '报白'] },
      { id: 'traffic_boost', icon: Flame, zh: '投流管理', en: 'Traffic Boost', accent: '#ea580c', desc: { zh: '投放计划、ROI 与授权校验', en: 'Campaigns, ROI and license checks' }, keywords: ['投流', '投放', 'boost', 'roi'] },
      { id: 'live_control', icon: Radio, zh: '直播中控', en: 'Live Control', accent: '#e11d48', desc: { zh: '多直播间实时监控与场控', en: 'Monitor and run every live room' }, keywords: ['直播', 'live', '场控'] },
    ],
  },
  {
    title: { zh: '粉丝运营', en: 'Fans' },
    pages: [
      {
        id: 'fan_operations', icon: Heart, zh: '粉丝运营', en: 'Fan Operations', accent: '#db2777',
        desc: { zh: '公域引流转化，私域沉淀复购', en: 'Convert public traffic, retain in private channels' },
        keywords: ['粉丝', 'fan', '社群', 'community'],
        tabs: [
          T('public', TrendingUp, '公域运营', 'Public Domain', ['引流']),
          T('private', MessageCircle, '私域运营', 'Private Domain', ['社群', 'community', '私域']),
        ],
      },
    ],
  },
  {
    title: { zh: '商业与变现', en: 'Business' },
    pages: [
      {
        id: 'monetization_center', icon: Wallet, zh: '变现中心', en: 'Monetization', accent: '#059669',
        desc: { zh: '变现项目、品牌商务、收益与分成结算', en: 'Projects, brand deals, revenue and payouts' },
        keywords: ['变现', '收益', 'revenue', 'finance'],
        tabs: [
          T('projects', ShoppingBag, '变现项目', 'Projects'),
          T('brand', Handshake, '品牌商务', 'Brand Deals', ['品牌', '代理', 'brand', 'agency']),
          T('revenue', LineChart, '收益概览', 'Revenue', ['财务', 'finance']),
          T('split', Coins, '分成结算', 'Revenue Split', ['分成', '结算', 'split']),
          T('commission', Percent, '佣金配置', 'Commission', ['佣金', 'mcn', 'commission']),
        ],
      },
      { id: 'analytics', icon: BarChart3, zh: '数据看板', en: 'Analytics', accent: '#059669', desc: { zh: '播放、转化与 GMV 全链路数据', en: 'Views, conversion and GMV end to end' }, keywords: ['数据', 'analytics', 'gmv'] },
    ],
  },
  {
    title: { zh: '合规与授权', en: 'Compliance' },
    pages: [
      {
        id: 'compliance_tools', icon: Shield, zh: '授权与审核', en: 'Compliance', accent: '#4f46e5',
        desc: { zh: '授权、合同、版权、审核与侵权保护', en: 'Licenses, contracts, copyright, review and protection' },
        keywords: ['合规', 'compliance', '授权'],
        tabs: [
          T('license', FileCheck, '授权台账', 'Licenses', ['授权', 'license']),
          T('review', ShieldCheck, '内容审核', 'Content Review', ['审核', 'review']),
          T('contract', FileSignature, '合同管理', 'Contracts', ['合同', 'contract']),
          T('copyright', Copyright, '版权登记', 'Copyright', ['版权', 'copyright', '确权']),
          T('watermark', Layers, '水印管理', 'Watermark', ['水印']),
          T('patrol', Search, '侵权巡查', 'Infringement', ['侵权', '巡查']),
        ],
      },
    ],
  },
];

export const FOOTER_PAGES: NavPage[] = [
  { id: 'training', icon: GraduationCap, zh: '培训认证', en: 'Training', accent: '#7c3aed', desc: { zh: '平台课程与运营认证', en: 'Courses and operator certification' }, keywords: ['培训', '课程', 'training'] },
  {
    id: 'settings', icon: Settings, zh: '设置', en: 'Settings', accent: '#475569',
    desc: { zh: '账号、团队权限、通知与订阅账单', en: 'Account, team, notifications and billing' },
    tabs: [
      T('profile', User, '个人资料', 'Profile'),
      T('account', Key, '账号安全', 'Security'),
      T('team', UsersRound, '团队与权限', 'Team & Roles', ['权限', '团队', 'permission']),
      T('notification', Bell, '通知设置', 'Notifications'),
      T('appearance', Palette, '外观与语言', 'Appearance'),
      T('billing', CreditCard, '订阅与账单', 'Billing', ['账单', '套餐', '续费', 'billing']),
      T('data', Download, '数据管理', 'Data'),
    ],
  },
];

/** Reached from the top bar (bell → 查看全部) rather than the sidebar. */
export const UTILITY_PAGES: NavPage[] = [
  { id: 'notifications', icon: Bell, zh: '通知中心', en: 'Notifications', accent: '#475569', desc: { zh: '全部系统与业务通知', en: 'Every system and business notification' }, keywords: ['通知', 'notification'] },
];

const ALL_PAGES = [...NAV_GROUPS.flatMap(g => g.pages), ...FOOTER_PAGES, ...UTILITY_PAGES];

export const findPage = (id: string) => ALL_PAGES.find(p => p.id === id);
export const defaultTab = (id: string) => findPage(id)?.tabs?.[0]?.id;

/** Page ids from before the restructure → the page/tab that now hosts them. */
export const ROUTE_ALIASES: Record<string, string> = {
  asset_vault: 'asset_center/assets',
  copy_vault: 'asset_center/copy',
  wardrobe: 'asset_center/wardrobe',
  ai_video: 'production_workshop/video',
  ai_image: 'production_workshop/image',
  clip_studio: 'production_workshop/clip',
  digital_person: 'production_workshop/digital_person',
  batch_mix: 'production_workshop/batch_mix',
  publish_pool: 'publish_center/pool',
  calendar: 'publish_center/calendar',
  content_planning: 'publish_center/planning',
  distribution: 'publish_center/distribution',
  community: 'fan_operations/private',
  brand_agency: 'monetization_center/brand',
  finance: 'monetization_center/revenue',
  revenue_split: 'monetization_center/split',
  mcn_commission: 'monetization_center/commission',
  license_vault: 'compliance_tools/license',
  content_review: 'compliance_tools/review',
  contract_hub: 'compliance_tools/contract',
  copyright: 'compliance_tools/copyright',
  watermark_center: 'compliance_tools/watermark',
  infringement_patrol: 'compliance_tools/patrol',
  permission_matrix: 'settings/team',
  billing: 'settings/billing',
};

/** Accepts a page id, a legacy alias, or `page/tab`. Unknown ids fall back to the overview. */
export const resolveRoute = (target: string): { page: string; tab?: string } => {
  const [page, tab] = (ROUTE_ALIASES[target] ?? target).split('/');
  const known = findPage(page);
  if (!known) return { page: 'overview' };
  return { page, tab: tab && known.tabs?.some(t => t.id === tab) ? tab : undefined };
};

export interface NavSearchEntry { route: string; icon: LucideIcon; label: LT; desc: LT; keywords: string[] }

/** Every page and every sub-tab, for ⌘K search. */
export const NAV_SEARCH: NavSearchEntry[] = ALL_PAGES.flatMap(p => [
  { route: p.id, icon: p.icon, label: { zh: p.zh, en: p.en }, desc: p.desc, keywords: [p.zh, p.en, ...(p.keywords ?? [])].map(k => k.toLowerCase()) },
  ...(p.tabs ?? []).map(t => ({
    route: `${p.id}/${t.id}`, icon: t.icon,
    label: { zh: t.zh, en: t.en },
    desc: { zh: p.zh, en: p.en },
    keywords: [t.zh, t.en, p.zh, ...(t.keywords ?? [])].map(k => k.toLowerCase()),
  })),
]);

export const tabsOf = (id: string) => findPage(id)?.tabs ?? [];

/** Pages to highlight in the sidebar for the homepage the user came from. */
const RECOMMENDED: Record<string, string[]> = {
  artist: ['artist_hub', 'production_workshop', 'fan_operations'],
  drama: ['production_workshop', 'publish_center', 'analytics'],
  commerce: ['production_workshop', 'traffic_boost', 'live_control'],
  knowledge: ['production_workshop', 'fan_operations', 'monetization_center'],
  brand: ['artist_hub', 'monetization_center', 'compliance_tools'],
  local: ['production_workshop', 'publish_center', 'compliance_tools'],
};
const SOLUTION_FOCUS: Record<SolutionId, keyof typeof RECOMMENDED> = {
  ecosystem: 'artist', 'ai-artist': 'artist', 'virtual-idol': 'artist', 'social-ip': 'artist',
  'ai-drama': 'drama', 'anime-ip': 'drama',
  'story-commerce': 'commerce',
  'digital-founder': 'knowledge', 'education-ip': 'knowledge',
  'brand-ip': 'brand', 'corporate-ip': 'brand',
  'city-ip': 'local', 'culture-ip': 'local',
};
export const recommendedPages = (solution: SolutionId) => new Set(RECOMMENDED[SOLUTION_FOCUS[solution] ?? 'artist']);
