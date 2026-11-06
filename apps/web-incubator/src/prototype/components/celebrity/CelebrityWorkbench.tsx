/**
 * 明星端审核工作台 v3.0
 * IP授权中心 · 商品入库全流程 · 品牌授权 · 报白/数字人/AI形象/内容审核/分成
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Star, CheckCircle2, XCircle, Clock, Shield, Coins, TrendingUp, Users,
  ChevronRight, AlertCircle, BadgeCheck, Bell, Phone, Hash, Fingerprint,
  Send, RefreshCw, Copy, CheckCheck, Filter, Bot, Sparkles, Package,
  ShoppingBag, Video, Truck, LayoutDashboard, Scissors, Database, Building2,
  Eye, RotateCcw, Zap, Film, Camera, Upload, FileText, CloudUpload, Server,
  Key, Lock, Globe, Layers
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Lang } from '../../translations';
import { InfringementPatrol } from './InfringementPatrol';
import { ContractCenter } from './ContractCenter';

// ── Types ─────────────────────────────────────────────────────────────────────
type NavSection = 'overview' | 'ipAuth' | 'whitelist' | 'digitalHuman' | 'aiLikeness' | 'contentReview' | 'productOnboard' | 'productLib' | 'brandAuth' | 'revenue' | 'rules' | 'infringement' | 'contracts';
type WhitelistRequestStatus = 'pending' | 'approved' | 'rejected' | 'info_required';
type WhitelistStep = 'received' | 'contacting' | 'sms' | 'processing' | 'authorized';
type IPAuthStatus = 'notStarted' | 'preparing' | 'uploaded' | 'techReceived' | 'volcanoSync' | 'active';
type IPAuthType = 'portrait' | 'clip' | 'digitalHuman' | 'documents';
type ProductSource = 'platform' | 'creator' | 'brand';
type SampleStatus = 'notSent' | 'shipping' | 'delivered' | 'approved' | 'rejected';

interface WhitelistRequest {
  id: string; mcnName: string; accountHandle: string; accountId: string;
  phone: string; uid: string; platform: '抖音' | '视频号' | '快手' | '小红书';
  fans: string; accountAge: string; mcnLevel: string; requestedAt: string;
  status: WhitelistRequestStatus; whitelistStep: WhitelistStep;
  message?: string; recentVideos: number; avgViews: string; creditScore: number;
}
interface DigitalHumanRequest {
  id: string; mcnName: string; usageType: 'live' | 'shortVideo' | 'ads';
  platforms: string[]; purpose: string; duration: string;
  requestedAt: string; status: 'pending' | 'approved' | 'rejected'; riskNote?: string;
}
interface AILikenessRequest {
  id: string; mcnName: string; modelType: 'voice' | 'face' | 'fullBody';
  riskLevel: 'low' | 'medium' | 'high'; platforms: string[]; purpose: string;
  requestedAt: string; status: 'pending' | 'approved' | 'rejected'; aiVendor: string;
}
interface ContentReviewItem {
  id: string; title: string; type: 'clip' | 'digitalHuman' | 'aiLikeness';
  uploader: string; mcnName: string; duration: string; submittedAt: string;
  status: 'pending' | 'approved' | 'revision' | 'rejected'; platform: string; views?: string;
}
interface IPAuthRecord {
  type: IPAuthType; status: IPAuthStatus; techCompany: string;
  volcanoProjectId?: string; filesCount: number; requiredFiles: number;
  uploadedAt?: string; activatedAt?: string; note?: string;
}
interface ProductOnboardItem {
  id: string; productName: string; brand: string; category: string; price: string;
  source: ProductSource; submittedBy: string; mcnName?: string;
  step: number; // 0=submitted 1=platformReview 2=celebReview 3=sampleShipping 4=sampleConfirm 5=inLibrary 6=rejected
  platformSample: SampleStatus; celebSample: SampleStatus;
  submittedAt: string; trackingPlatform?: string; trackingCeleb?: string;
  platformNote?: string;
}
interface BrandAuthRequest {
  id: string; brandName: string;
  authTypes: string[]; purpose: string; duration: string; amount: string;
  platforms: string[]; status: 'pending' | 'platformReview' | 'celebReview' | 'sampleStage' | 'approved' | 'rejected';
  platformSample: SampleStatus; celebSample: SampleStatus;
  submittedAt: string; platformNote?: string;
}
interface ProductLibItem {
  id: string; productName: string; brand: string; category: string;
  approvedAt: string; price: string; mcnName: string; salesCount: number;
}
interface ContentRule {
  id: string; name: string; zone: 'green' | 'yellow' | 'orange' | 'red'; enabled: boolean; description: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const WL_STATUS: Record<WhitelistRequestStatus, { zh: string; en: string; color: string; bg: string; icon: any }> = {
  pending:       { zh: '待审核',   en: 'Pending',    color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25',  icon: Clock },
  approved:      { zh: '已通过',   en: 'Approved',   color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/25',  icon: CheckCircle2 },
  rejected:      { zh: '已驳回',   en: 'Rejected',   color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25',      icon: XCircle },
  info_required: { zh: '需补材料', en: 'Info Needed', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25', icon: AlertCircle },
};
const ZONE_COLORS = { green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444' };
const ZONE_LABELS = { green: { zh: '绿区', en: 'Green' }, yellow: { zh: '黄区', en: 'Yellow' }, orange: { zh: '橙区', en: 'Orange' }, red: { zh: '红区', en: 'Red' } };
const PLATFORMS = [
  { id: 'all', zh: '全部', en: 'All', color: '#6b7280' },
  { id: '抖音', zh: '抖音', en: 'Douyin', color: '#fe2c55' },
  { id: '视频号', zh: '视频号', en: 'Channels', color: '#07c160' },
  { id: '快手', zh: '快手', en: 'Kuaishou', color: '#ff6200' },
  { id: '小红书', zh: '小红书', en: 'Xiaohongshu', color: '#ff2442' },
] as const;
const STATUS_FILTERS = [
  { id: 'all', zh: '全部状态', en: 'All', color: '#6b7280', icon: Filter },
  { id: 'pending', zh: '待审核', en: 'Pending', color: '#f59e0b', icon: Clock },
  { id: 'approved', zh: '已通过', en: 'Approved', color: '#22c55e', icon: CheckCircle2 },
  { id: 'rejected', zh: '已驳回', en: 'Rejected', color: '#ef4444', icon: XCircle },
  { id: 'info_required', zh: '需补材料', en: 'Info Needed', color: '#f97316', icon: AlertCircle },
] as const;

const IP_AUTH_META: Record<IPAuthType, { zh: string; en: string; color: string; icon: any; desc: { zh: string; en: string }; files: string[] }> = {
  portrait:     { zh: '人像授权', en: 'Portrait Auth',   color: '#f59e0b', icon: Camera,   desc: { zh: '高清人像照片 + 人脸特征数据，AI形象训练全套', en: 'HD portraits + face scan data for AI training' }, files: ['授权协议.pdf', '正面照片×20', '侧面照片×10', '全身照片×5', '人脸扫描数据包', '生物特征协议.pdf', '表情数据集'] },
  clip:         { zh: '切片授权', en: 'Clip Auth',        color: '#06b6d4', icon: Scissors, desc: { zh: '视频素材授权，用于AI切片生成', en: 'Video material for AI clip generation' },                   files: ['切片使用协议.pdf', '视频素材包×50+'] },
  digitalHuman: { zh: '数字人授权', en: 'Digital Human',  color: '#a855f7', icon: Bot,      desc: { zh: '数字人形象数据，用于虚拟主播直播', en: 'Digital human data for virtual presenter' },              files: ['数字人协议.pdf', '360°扫描数据', '语音样本×30分钟', '动作捕捉数据'] },
  documents:    { zh: '授权文件', en: 'Legal Documents',  color: '#22c55e', icon: FileText, desc: { zh: '法律授权文件和知情同意书', en: 'Legal authorization and consent documents' },                    files: ['总授权协议.pdf', '隐私政策同意书.pdf', '商业使用授权书.pdf', '技术许可证.pdf'] },
};

const IP_STATUS_CFG: Record<IPAuthStatus, { zh: string; en: string; color: string; icon: any }> = {
  notStarted:   { zh: '未开始',    en: 'Not Started',    color: '#4b5563', icon: Lock },
  preparing:    { zh: '准备中',    en: 'Preparing',      color: '#6366f1', icon: Upload },
  uploaded:     { zh: '已上传',    en: 'Uploaded',       color: '#06b6d4', icon: CheckCircle2 },
  techReceived: { zh: '技术公司已收', en: 'Tech Received',  color: '#a855f7', icon: Server },
  volcanoSync:  { zh: '火山引擎同步中', en: 'Volcano Syncing', color: '#f59e0b', icon: CloudUpload },
  active:       { zh: '已激活',    en: 'Active',         color: '#22c55e', icon: Zap },
};

const PRODUCT_STEPS: { zh: string; en: string; color: string }[] = [
  { zh: '已提交',   en: 'Submitted',    color: '#6b7280' },
  { zh: '平台初审', en: 'Plat Review',  color: '#06b6d4' },
  { zh: '明星审核', en: 'Celeb Review', color: '#f59e0b' },
  { zh: '样品寄送', en: 'Samples Sent', color: '#a855f7' },
  { zh: '样品确认', en: 'Sample OK',    color: '#ec4899' },
  { zh: '已入库',   en: 'In Library',   color: '#22c55e' },
];
const SAMPLE_STATUS_CFG: Record<SampleStatus, { zh: string; en: string; color: string; icon: any }> = {
  notSent:   { zh: '待寄送', en: 'Not Sent',  color: '#6b7280', icon: Package },
  shipping:  { zh: '运输中', en: 'Shipping',  color: '#06b6d4', icon: Truck },
  delivered: { zh: '已签收', en: 'Delivered', color: '#f59e0b', icon: CheckCircle2 },
  approved:  { zh: '审核通过', en: 'Approved',  color: '#22c55e', icon: CheckCheck },
  rejected:  { zh: '已驳回', en: 'Rejected',  color: '#ef4444', icon: XCircle },
};

// ── Mock Data ──────────────────────────────────────────────────────────────────
const MOCK_REQUESTS: WhitelistRequest[] = [
  { id: 'r1', mcnName: 'AI Star MCN', accountHandle: '@neon_v_official', accountId: 'neonv2024', phone: '138****8812', uid: '94728163501', platform: '抖音', fans: '128.4万', accountAge: '2年3个月', mcnLevel: '金牌', requestedAt: '2026-05-06 14:30', status: 'pending', whitelistStep: 'received', recentVideos: 24, avgViews: '28万', creditScore: 92 },
  { id: 'r2', mcnName: 'AI Star MCN', accountHandle: '@neon_v_channel', accountId: 'neon_channel', phone: '138****8812', uid: 'wx_82749163', platform: '视频号', fans: '43.6万', accountAge: '1年1个月', mcnLevel: '金牌', requestedAt: '2026-05-06 14:32', status: 'pending', whitelistStep: 'contacting', recentVideos: 18, avgViews: '21万', creditScore: 90 },
  { id: 'r3', mcnName: 'HypeStar Studio', accountHandle: '@luna_soft_ks', accountId: 'lunasoft2023', phone: '156****2247', uid: '38821047295', platform: '快手', fans: '56.2万', accountAge: '1年8个月', mcnLevel: '银牌', requestedAt: '2026-05-05 10:15', status: 'pending', whitelistStep: 'sms', recentVideos: 18, avgViews: '12万', creditScore: 78 },
  { id: 'r5', mcnName: 'TopCreator MCN', accountHandle: '@topstar_douyin', accountId: 'topstar_tc', phone: '139****0055', uid: '71039284651', platform: '抖音', fans: '342万', accountAge: '3年5个月', mcnLevel: '钻石', requestedAt: '2026-04-28', status: 'approved', whitelistStep: 'authorized', recentVideos: 48, avgViews: '86万', creditScore: 98 },
];
const MOCK_DH_REQUESTS: DigitalHumanRequest[] = [
  { id: 'dh1', mcnName: 'AI Star MCN', usageType: 'live', platforms: ['抖音', '淘宝直播'], purpose: '电商直播带货，AI数字人主播替换真人上播', duration: '12个月', requestedAt: '2026-05-07 10:00', status: 'pending' },
  { id: 'dh2', mcnName: 'TopCreator MCN', usageType: 'shortVideo', platforms: ['抖音', '快手'], purpose: '短视频宣传片，艺人数字人口播介绍产品', duration: '6个月', requestedAt: '2026-05-06 15:30', status: 'pending', riskNote: '需确认数字人形象相似度合规，建议第三方鉴定' },
];
const MOCK_AI_REQUESTS: AILikenessRequest[] = [
  { id: 'ai1', mcnName: 'AI Star MCN', modelType: 'voice', riskLevel: 'low', platforms: ['抖音'], purpose: 'AI语音合成用于视频配音，相似度≤75%', requestedAt: '2026-05-07 11:00', status: 'pending', aiVendor: 'ElevenLabs' },
  { id: 'ai2', mcnName: 'CyberMCN', modelType: 'face', riskLevel: 'high', platforms: ['抖音', '微博'], purpose: 'AI换脸用于品牌宣传短片', requestedAt: '2026-05-06 14:00', status: 'pending', aiVendor: 'FaceSwap Pro' },
];
const MOCK_CONTENT_REVIEWS: ContentReviewItem[] = [
  { id: 'cv1', title: '于震×泡泡玛特联名开箱视频', type: 'clip', uploader: '@neon_v_official', mcnName: 'AI Star MCN', duration: '3分28秒', submittedAt: '2026-05-07 09:00', status: 'pending', platform: '抖音' },
  { id: 'cv2', title: 'AI数字人带货直播高光片段', type: 'digitalHuman', uploader: '@topstar_douyin', mcnName: 'TopCreator MCN', duration: '1分15秒', submittedAt: '2026-05-07 11:30', status: 'pending', platform: '抖音' },
  { id: 'cv3', title: '于震AI声音配音护肤品种草', type: 'aiLikeness', uploader: '@luna_soft_ks', mcnName: 'HypeStar Studio', duration: '0分58秒', submittedAt: '2026-05-06 20:00', status: 'revision', platform: '快手' },
  { id: 'cv4', title: '演唱会回顾混剪合集', type: 'clip', uploader: '@neon_v_channel', mcnName: 'AI Star MCN', duration: '5分40秒', submittedAt: '2026-05-06 15:00', status: 'approved', platform: '视频号', views: '24.3万' },
];
const INIT_IP_AUTH: IPAuthRecord[] = [
  { type: 'portrait',     status: 'active',       techCompany: '数字孪生科技（北京）', volcanoProjectId: 'VK-PRT-2024-001', filesCount: 35, requiredFiles: 32, uploadedAt: '2026-04-10', activatedAt: '2026-04-15', note: '已含人脸扫描数据包及生物特征协议' },
  { type: 'clip',         status: 'active',       techCompany: '数字孪生科技（北京）', volcanoProjectId: 'VK-CLP-2024-001', filesCount: 120, requiredFiles: 50, uploadedAt: '2026-04-12', activatedAt: '2026-04-17' },
  { type: 'digitalHuman', status: 'volcanoSync',  techCompany: '灵镜AI Lab',           volcanoProjectId: 'VK-DH-2026-001',  filesCount: 8,  requiredFiles: 10, uploadedAt: '2026-05-01', note: '模型训练中，预计3-5个工作日完成' },
  { type: 'documents',    status: 'techReceived', techCompany: '法务合规中心',         volcanoProjectId: 'VK-DOC-2026-001', filesCount: 4,  requiredFiles: 4,  uploadedAt: '2026-04-20', note: '文件已由技术公司接收，待同步至火山引擎' },
];
const INIT_PRODUCT_ONBOARD: ProductOnboardItem[] = [
  { id: 'po1', productName: '次世代智能护肤精华',  brand: 'CyberGlow',   category: '美妆护肤', price: '¥398',  source: 'platform', submittedBy: '平台运营组', step: 2, platformSample: 'notSent', celebSample: 'notSent', submittedAt: '2026-05-07', platformNote: '平台已审核，适合AI带货场景' },
  { id: 'po2', productName: '赛博朋克联名耳机',    brand: 'NeonSound',  category: '数码配件', price: '¥1299', source: 'creator',  submittedBy: '@neon_v_official', mcnName: 'AI Star MCN', step: 4, platformSample: 'delivered', celebSample: 'shipping', submittedAt: '2026-05-05', trackingPlatform: 'SF1234567890', trackingCeleb: 'JD9876543210' },
  { id: 'po3', productName: '智能健康监测手环',    brand: 'VitalTech',  category: '智能穿戴', price: '¥599',  source: 'creator',  submittedBy: '@topstar_douyin', mcnName: 'TopCreator MCN', step: 2, platformSample: 'notSent', celebSample: 'notSent', submittedAt: '2026-05-06', platformNote: '平台已通过初审，待明星确认' },
  { id: 'po4', productName: '限量版联名运动鞋',    brand: 'HyperStep',  category: '运动服饰', price: '¥2199', source: 'brand',    submittedBy: 'HyperStep官方', step: 1, platformSample: 'notSent', celebSample: 'notSent', submittedAt: '2026-05-07', platformNote: '' },
  { id: 'po5', productName: 'AI香薰智能音箱',     brand: 'ScentAI',    category: '家居生活', price: '¥899',  source: 'platform', submittedBy: '平台运营组', step: 5, platformSample: 'approved', celebSample: 'approved', submittedAt: '2026-04-28' },
  { id: 'po6', productName: '数字游民背包',        brand: 'NomadGear',  category: '箱包',     price: '¥789',  source: 'creator',  submittedBy: '@luna_soft_ks', mcnName: 'HypeStar Studio', step: 3, platformSample: 'shipping', celebSample: 'notSent', submittedAt: '2026-05-04', trackingPlatform: 'YT5566778899' },
];
const INIT_BRAND_AUTH: BrandAuthRequest[] = [
  { id: 'ba1', brandName: '安踏运动', authTypes: ['人像授权', '代言授权'], purpose: '2026秋冬系列运动服装代言，线上线下全渠道', duration: '24个月', amount: '¥580万', platforms: ['抖音', '微博', '小红书', '线下广告'], status: 'sampleStage', platformSample: 'approved', celebSample: 'shipping', submittedAt: '2026-05-02' },
  { id: 'ba2', brandName: 'CyberGlow护肤', authTypes: ['人像授权', '联名授权'], purpose: '与艺人共同推出限量联名护肤产品线', duration: '12个月', amount: '¥120万', platforms: ['抖音', '小红书', '天猫'], status: 'celebReview', platformSample: 'approved', celebSample: 'notSent', submittedAt: '2026-05-05', platformNote: '平台已审核合规，建议明星同意，品牌调性匹配' },
  { id: 'ba3', brandName: 'NeonSound音频', authTypes: ['AI声音授权'], purpose: 'AI语音合成用于品牌广告音频', duration: '6个月', amount: '¥45万', platforms: ['抖音', '网易云音乐'], status: 'approved', platformSample: 'approved', celebSample: 'approved', submittedAt: '2026-04-20' },
];
const MOCK_PRODUCT_LIB: ProductLibItem[] = [
  { id: 'pl1', productName: 'AI香薰智能音箱',   brand: 'ScentAI',     category: '家居生活', approvedAt: '2026-05-06', price: '¥899',  mcnName: 'AI Star MCN',     salesCount: 342 },
  { id: 'pl2', productName: '次世代护肤套装',   brand: 'CyberGlow',   category: '美妆护肤', approvedAt: '2026-04-20', price: '¥1180', mcnName: 'AI Star MCN',     salesCount: 891 },
  { id: 'pl3', productName: '赤红联名手表',     brand: 'CrimsonTime', category: '配饰',     approvedAt: '2026-04-15', price: '¥3299', mcnName: 'TopCreator MCN',  salesCount: 128 },
  { id: 'pl4', productName: '轻薄防晒外套',     brand: 'CoolShade',   category: '运动服饰', approvedAt: '2026-03-30', price: '¥459',  mcnName: 'AI Star MCN',     salesCount: 2341 },
];
const MOCK_RULES: ContentRule[] = [
  { id: 'cr1', name: '官方切片直接使用', zone: 'green', enabled: true, description: '经纪方认证的官方切片素材可直接使用，无需额外申请' },
  { id: 'cr2', name: '允许AI字幕与剪辑重组', zone: 'yellow', enabled: true, description: '可对视频添加AI字幕、合规剪辑，发布时须声明AI辅助' },
  { id: 'cr3', name: 'AI语音合成（有限制）', zone: 'orange', enabled: false, description: '需另签AI声音授权协议，相似度须控制在80%以下' },
  { id: 'cr4', name: 'AI形象虚拟创作', zone: 'red', enabled: false, description: '完全禁用，需持有专属AI形象授权包方可开启' },
];
const GMV_DATA = [{ month: '1月', gmv: 0 }, { month: '2月', gmv: 0 }, { month: '3月', gmv: 84000 }, { month: '4月', gmv: 218000 }, { month: '5月', gmv: 162000 }];

// ── Helpers ───────────────────────────────────────────────────────────────────
const getPlatformAbbr = (p: string) => p === '抖音' ? 'DY' : p === '视频号' ? 'VCH' : p === '快手' ? 'KS' : 'XHS';
const getPlatformColor = (p: string) => p === '抖音' ? '#fe2c55' : p === '视频号' ? '#07c160' : p === '快手' ? '#ff6200' : '#ff2442';
const WL_STEPS: { id: WhitelistStep; zh: string; en: string; color: string; actionZh: string; actionEn: string }[] = [
  { id: 'received',   zh: '收到申请',   en: 'Received',   color: '#6b7280', actionZh: '开始联系平台', actionEn: 'Contact Platform' },
  { id: 'contacting', zh: '联系平台',   en: 'Contacting', color: '#06b6d4', actionZh: '等待验证码',   actionEn: 'Await SMS Code' },
  { id: 'sms',        zh: '验证码确认', en: 'SMS Verify',  color: '#a855f7', actionZh: '达人已确认',   actionEn: 'Creator Confirmed' },
  { id: 'processing', zh: '报白进行中', en: 'Processing',  color: '#f59e0b', actionZh: '确认授权成功', actionEn: 'Confirm Authorized' },
  { id: 'authorized', zh: '授权成功',   en: 'Authorized',  color: '#22c55e', actionZh: '已完成',       actionEn: 'Done' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export const CelebrityWorkbench = ({ lang, onBack }: { lang: Lang; onBack: () => void }) => {
  const zh = lang === 'zh';
  const [navSection, setNavSection] = useState<NavSection>('overview');
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [dhRequests, setDhRequests] = useState(MOCK_DH_REQUESTS);
  const [aiRequests, setAiRequests] = useState(MOCK_AI_REQUESTS);
  const [contentReviews, setContentReviews] = useState(MOCK_CONTENT_REVIEWS);
  const [ipAuth, setIpAuth] = useState(INIT_IP_AUTH);
  const [productOnboard, setProductOnboard] = useState(INIT_PRODUCT_ONBOARD);
  const [brandAuth, setBrandAuth] = useState(INIT_BRAND_AUTH);
  const [productLib, setProductLib] = useState(MOCK_PRODUCT_LIB);
  const [rules, setRules] = useState(MOCK_RULES);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [autoCopied, setAutoCopied] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');
  const [productSourceFilter, setProductSourceFilter] = useState<string>('all');
  const [expandedIPType, setExpandedIPType] = useState<IPAuthType | null>(null);

  // Computed
  const pendingWL      = requests.filter(r => r.status === 'pending').length;
  const pendingDH      = dhRequests.filter(r => r.status === 'pending').length;
  const pendingAI      = aiRequests.filter(r => r.status === 'pending').length;
  const pendingContent = contentReviews.filter(r => r.status === 'pending').length;
  const pendingIPAuth  = ipAuth.filter(a => a.status !== 'active').length;
  const pendingProductOnboard = productOnboard.filter(p => p.step === 2 || (p.step === 4 && p.celebSample === 'delivered')).length;
  const pendingBrandAuth = brandAuth.filter(b => b.status === 'celebReview' || (b.status === 'sampleStage' && b.celebSample === 'delivered')).length;
  const totalPending = pendingWL + pendingDH + pendingAI + pendingContent + pendingProductOnboard + pendingBrandAuth;

  const filteredRequests = requests.filter(r => platformFilter === 'all' || r.platform === platformFilter).filter(r => statusFilter === 'all' || r.status === statusFilter);
  const filteredContent  = contentReviews.filter(c => contentTypeFilter === 'all' || c.type === contentTypeFilter);
  const filteredOnboard  = productOnboard.filter(p => productSourceFilter === 'all' || p.source === productSourceFilter);

  // Handlers
  const advanceWLStep = (id: string) => {
    const order: WhitelistStep[] = ['received', 'contacting', 'sms', 'processing', 'authorized'];
    setRequests(p => p.map(r => { if (r.id !== id) return r; const next = order[Math.min(order.indexOf(r.whitelistStep)+1,4)]; return { ...r, whitelistStep: next, status: next==='authorized'?'approved':r.status }; }));
  };
  const rejectWL    = (id: string) => setRequests(p => p.map(r => r.id===id?{...r,status:'rejected'}:r));
  const approveDH   = (id: string) => setDhRequests(p => p.map(r => r.id===id?{...r,status:'approved'}:r));
  const rejectDH    = (id: string) => setDhRequests(p => p.map(r => r.id===id?{...r,status:'rejected'}:r));
  const approveAI   = (id: string) => setAiRequests(p => p.map(r => r.id===id?{...r,status:'approved'}:r));
  const rejectAI    = (id: string) => setAiRequests(p => p.map(r => r.id===id?{...r,status:'rejected'}:r));
  const approveContent = (id: string) => setContentReviews(p => p.map(r => r.id===id?{...r,status:'approved'}:r));
  const reviseContent  = (id: string) => setContentReviews(p => p.map(r => r.id===id?{...r,status:'revision'}:r));
  const rejectContent  = (id: string) => setContentReviews(p => p.map(r => r.id===id?{...r,status:'rejected'}:r));
  const toggleRule     = (id: string) => setRules(p => p.map(r => r.id===id?{...r,enabled:!r.enabled}:r));

  const simulateIPUpload = (type: IPAuthType) => {
    setIpAuth(p => p.map(a => a.type===type ? { ...a, status: a.status==='notStarted'?'preparing': a.status==='preparing'?'uploaded': a.status==='uploaded'?'techReceived': a.status==='techReceived'?'volcanoSync':'active', uploadedAt: a.uploadedAt??new Date().toISOString().slice(0,10) } : a));
  };

  const approveCelebProduct = (id: string) => setProductOnboard(p => p.map(x => x.id===id ? {...x, step: x.step===2?3:x.step} : x));
  const rejectProduct = (id: string) => setProductOnboard(p => p.map(x => x.id===id ? {...x, step:6} : x));
  const confirmCelebSample = (id: string) => setProductOnboard(p => p.map(x => {
    if (x.id!==id) return x;
    const newCeleb: SampleStatus = 'approved';
    const bothApproved = newCeleb==='approved' && x.platformSample==='approved';
    if (bothApproved) {
      setProductLib(prev => [{id:`pl-${id}`, productName:x.productName, brand:x.brand, category:x.category, approvedAt:new Date().toISOString().slice(0,10), price:x.price, mcnName:x.submittedBy, salesCount:0},...prev]);
    }
    return { ...x, celebSample: newCeleb, step: bothApproved ? 5 : 4 };
  }));

  const approveBrand = (id: string) => setBrandAuth(p => p.map(b => b.id===id?{...b,status:'approved'}:b));
  const rejectBrand  = (id: string) => setBrandAuth(p => p.map(b => b.id===id?{...b,status:'rejected'}:b));
  const confirmBrandSample = (id: string) => setBrandAuth(p => p.map(b => b.id===id?{...b,celebSample:'approved'}:b));

  const copyToClipboard = (text: string, id: string) => { navigator.clipboard.writeText(text).catch(()=>{}); setCopiedId(id); setTimeout(()=>setCopiedId(null),1500); };
  const copyAllParamsForReq = (req: WhitelistRequest) => { navigator.clipboard.writeText(`【${req.platform} 报白参数】\n账号ID：${req.accountId}\n手机号：${req.phone}\nUID：${req.uid}`).catch(()=>{}); setAutoCopied(req.id); setTimeout(()=>setAutoCopied(null),3000); };

  // Nav
  const NAV_GROUPS = [
    { label: { zh: 'IP授权', en: 'IP Auth' }, items: [
      { id: 'overview'   as NavSection, icon: LayoutDashboard, zh: '工作台总览', en: 'Overview',      color: '#f59e0b', badge: 0 },
      { id: 'ipAuth'     as NavSection, icon: Key,             zh: 'IP授权中心', en: 'IP Auth Center', color: '#6366f1', badge: pendingIPAuth },
    ]},
    { label: { zh: '账号授权', en: 'Account Auth' }, items: [
      { id: 'whitelist'    as NavSection, icon: BadgeCheck, zh: '报白账号',   en: 'Whitelist',      color: '#06b6d4', badge: pendingWL },
      { id: 'digitalHuman' as NavSection, icon: Bot,        zh: '数字人授权', en: 'Digital Human',  color: '#a855f7', badge: pendingDH },
      { id: 'aiLikeness'   as NavSection, icon: Sparkles,   zh: 'AI形象授权', en: 'AI Likeness',    color: '#ec4899', badge: pendingAI },
    ]},
    { label: { zh: '内容管理', en: 'Content' }, items: [
      { id: 'contentReview' as NavSection, icon: Film, zh: '内容审核', en: 'Content Review', color: '#f97316', badge: pendingContent },
    ]},
    { label: { zh: '商品管理', en: 'Products' }, items: [
      { id: 'productOnboard' as NavSection, icon: Layers,   zh: '商品入库',  en: 'Product Onboard', color: '#22c55e', badge: pendingProductOnboard },
      { id: 'productLib'     as NavSection, icon: Database, zh: '商品库',    en: 'Product Library', color: '#14b8a6', badge: 0 },
    ]},
    { label: { zh: '品牌合作', en: 'Brand' }, items: [
      { id: 'brandAuth' as NavSection, icon: Building2, zh: '品牌授权',  en: 'Brand Auth', color: '#3b82f6', badge: pendingBrandAuth },
    ]},
    { label: { zh: '财务设置', en: 'Finance' }, items: [
      { id: 'revenue' as NavSection, icon: Coins,  zh: '分成收益', en: 'Revenue',    color: '#eab308', badge: 0 },
      { id: 'rules'   as NavSection, icon: Shield, zh: '授权规则', en: 'Auth Rules', color: '#6b7280', badge: 0 },
    ]},
    { label: { zh: '法务管理', en: 'Legal' }, items: [
      { id: 'infringement' as NavSection, icon: AlertCircle, zh: '侵权巡查', en: 'Infringement', color: '#ef4444', badge: 0 },
      { id: 'contracts'    as NavSection, icon: FileText,    zh: '合同中心', en: 'Contracts',    color: '#10b981', badge: 0 },
    ]},
  ];

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-3 md:px-5 py-3 md:py-4 border-b border-white/5 bg-black/80 backdrop-blur-lg sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-white transition whitespace-nowrap shrink-0">← {zh?'返回':'Back'}<span className="hidden md:inline">{zh?'运营端':''}</span></button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center"><Star className="w-4 h-4 text-white" /></div>
            <div><div className="text-sm font-bold text-white">{zh?'明星端工作台':'Celebrity Workbench'}</div><div className="text-[9px] text-amber-400">✦ {zh?'于震 · 经纪人视角':'Yu Zhen · Agent View'}</div></div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative"><Bell className="w-5 h-5 text-gray-400" />{totalPending>0&&<div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[8px] font-black">{totalPending}</div>}</div>
          <div className="hidden md:block text-xs text-amber-400 border border-amber-500/30 rounded-full px-3 py-1">S级 · {zh?'4,530万粉':'45.3M followers'}</div>
        </div>
      </div>

      {/* ── Layout ── */}
      <div className="flex flex-col md:flex-row" style={{ minHeight: 'calc(100vh - 57px)' }}>
        {/* Sidebar */}
        <aside className="w-full md:w-[196px] shrink-0 border-b md:border-b-0 md:border-r border-white/5 flex flex-col sticky top-[57px] z-10 md:h-[calc(100vh-57px)] overflow-x-auto md:overflow-x-hidden md:overflow-y-auto" style={{ background:'#ffffff' }}>
          <div className="hidden md:block p-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.12)' }}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center shrink-0"><Star className="w-4 h-4 text-white" /></div>
              <div className="min-w-0"><div className="text-xs font-black text-white truncate">于震</div><div className="text-[9px] text-amber-400">S级艺人 · 4530万粉</div></div>
            </div>
          </div>
          <div className="flex md:block gap-1 md:flex-1 p-2 md:pb-3">
            {NAV_GROUPS.map(group => (
              <div key={group.label.zh} className="flex md:block gap-1 shrink-0 md:mb-1">
                <div className="hidden md:block px-2 pt-4 pb-1 text-[9px] font-black text-gray-700 uppercase tracking-widest">{zh?group.label.zh:group.label.en}</div>
                {group.items.map(item => {
                  const active = navSection===item.id; const Icon=item.icon;
                  return (
                    <motion.button key={item.id} onClick={()=>setNavSection(item.id)} whileTap={{scale:0.97}}
                      className="md:w-full shrink-0 whitespace-nowrap flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left md:mb-0.5 transition-all relative overflow-hidden"
                      style={active?{background:`${item.color}10`,border:`1px solid ${item.color}22`}:{background:'transparent',border:'1px solid transparent'}}>
                      {active&&<div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full" style={{background:item.color}} />}
                      <Icon className="w-3.5 h-3.5 shrink-0" style={{color:active?item.color:'#4b5563'}} />
                      <span className="text-xs font-semibold flex-1 truncate" style={{color:active?'#fff':'#6b7280'}}>{zh?item.zh:item.en}</span>
                      {item.badge>0&&<span className="shrink-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black px-1" style={{background:`${item.color}22`,color:item.color,border:`1px solid ${item.color}35`}}>{item.badge}</span>}
                    </motion.button>
                  );
                })}
              </div>
            ))}
          </div>
          {totalPending>0&&<div className="hidden md:block p-3 border-t border-white/[0.04]"><div className="flex items-center gap-2 text-[10px] rounded-lg p-2.5" style={{background:'rgba(245,158,11,0.08)',color:'#f59e0b'}}><AlertCircle className="w-3 h-3 shrink-0" /><span className="font-semibold">{zh?`${totalPending} 项待处理`:`${totalPending} pending`}</span></div></div>}
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-y-auto">

          {/* ── OVERVIEW ── */}
          {navSection==='overview'&&(
            <div className="p-5 space-y-5 max-w-4xl">
              <div><h2 className="text-base font-black text-white">{zh?'工作台总览':'Dashboard'}</h2><p className="text-[11px] text-gray-500 mt-0.5">{zh?'明星IP授权与商业运营全景':'Celebrity IP authorization & business operations'}</p></div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label:{zh:'IP授权进度',en:'IP Auth'},     value:`${ipAuth.filter(a=>a.status==='active').length}/5`, color:'#6366f1', icon:Key,         sub:{zh:'项已激活',en:'types active'} },
                  { label:{zh:'待处理授权',en:'Pending Auth'}, value:totalPending,                                       color:'#f59e0b', icon:Clock,        sub:{zh:'跨所有模块',en:'across all modules'} },
                  { label:{zh:'商品库数量',en:'Products'},     value:productLib.length,                                  color:'#22c55e', icon:Database,     sub:{zh:'件可带货',en:'ready for sales'} },
                  { label:{zh:'品牌合作',en:'Brand Deals'},    value:brandAuth.filter(b=>b.status==='approved').length,  color:'#3b82f6', icon:Building2,    sub:{zh:'已激活授权',en:'active deals'} },
                  { label:{zh:'本月GMV',en:'Monthly GMV'},    value:'¥16.2万',                                          color:'#ec4899', icon:TrendingUp,   sub:{zh:'环比+18%',en:'+18% MoM'} },
                  { label:{zh:'分成收益',en:'Revenue'},        value:'¥2.4万',                                           color:'#eab308', icon:Coins,        sub:{zh:'本月已到账',en:'paid this month'} },
                ].map((k,i)=>{const KIcon=k.icon;return(
                  <motion.div key={i} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
                    className="rounded-xl px-4 py-3 border cursor-pointer hover:border-white/10 transition flex items-center gap-3" style={{background:`${k.color}08`,borderColor:`${k.color}18`}}>
                    <KIcon className="w-4 h-4 shrink-0" style={{color:k.color}} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-500 truncate">{zh?k.label.zh:k.label.en}</div>
                      <div className="text-[9px] text-gray-600 truncate">{zh?k.sub.zh:k.sub.en}</div>
                    </div>
                    <div className="text-lg font-black shrink-0" style={{color:k.color}}>{k.value}</div>
                  </motion.div>
                );})}

              </div>
              {/* IP授权全链路 summary */}
              <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/3 p-4">
                <div className="flex items-center gap-2 mb-3"><Key className="w-4 h-4 text-indigo-400" /><span className="text-sm font-bold text-white">{zh?'IP授权链路状态':'IP Authorization Chain'}</span></div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {(['portrait','clip','digitalHuman','documents'] as IPAuthType[]).map((type,i)=>{
                    const auth = ipAuth.find(a=>a.type===type)!;
                    const meta = IP_AUTH_META[type];
                    const sc = IP_STATUS_CFG[auth.status];
                    const Icon = meta.icon;
                    return (
                      <React.Fragment key={type}>
                        <motion.button onClick={()=>setNavSection('ipAuth')}
                          className="flex flex-col items-center gap-1 p-2.5 rounded-xl shrink-0 min-w-[80px] transition hover:brightness-110"
                          style={{background:`${meta.color}10`,border:`1px solid ${auth.status==='active'?meta.color+'40':meta.color+'15'}`}}>
                          <Icon className="w-5 h-5" style={{color:meta.color}} />
                          <span className="text-[9px] font-bold text-white">{zh?meta.zh:meta.en}</span>
                          <span className="text-[8px] font-bold" style={{color:sc.color}}>{zh?sc.zh:sc.en}</span>
                        </motion.button>
                        {i<4&&<ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />}
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[9px] text-gray-500">
                  <Globe className="w-3 h-3 text-indigo-400" />
                  <span>{zh?'授权链：明星录入 → 技术公司接收 → 火山引擎部署 → AI系统激活':'Chain: Celebrity → Tech Company → Volcano Engine → AI System Active'}</span>
                </div>
              </div>
              {/* Quick actions */}
              {totalPending>0&&(
                <div className="rounded-2xl border border-white/5 bg-white/[0.015] p-4">
                  <div className="flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-amber-400" /><span className="text-sm font-bold text-white">{zh?'待处理事项':'Action Required'}</span></div>
                  <div className="space-y-2">
                    {[
                      {count:pendingIPAuth,      nav:'ipAuth'          as NavSection, color:'#6366f1', icon:Key,        zh:'项IP授权待推进', en:'IP auth types pending'},
                      {count:pendingWL,           nav:'whitelist'       as NavSection, color:'#06b6d4', icon:BadgeCheck, zh:'个报白账号待审',  en:'whitelist requests'},
                      {count:pendingDH+pendingAI, nav:'digitalHuman'    as NavSection, color:'#a855f7', icon:Bot,        zh:'个数字/AI授权待审',en:'AI auth requests'},
                      {count:pendingContent,      nav:'contentReview'   as NavSection, color:'#f97316', icon:Film,       zh:'条内容待审核',    en:'content pending'},
                      {count:pendingProductOnboard,nav:'productOnboard' as NavSection, color:'#22c55e', icon:Layers,     zh:'件商品待明星审核',en:'products need review'},
                      {count:pendingBrandAuth,    nav:'brandAuth'       as NavSection, color:'#3b82f6', icon:Building2,  zh:'个品牌授权待处理',en:'brand auth pending'},
                    ].filter(x=>x.count>0).map((x,i)=>{const XIc=x.icon;return(
                      <motion.button key={i} onClick={()=>setNavSection(x.nav)} whileHover={{x:4}} className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-white/[0.04] transition">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{background:`${x.color}18`}}><XIc className="w-3.5 h-3.5" style={{color:x.color}} /></div>
                        <span className="text-xs text-gray-400 flex-1"><span className="font-black" style={{color:x.color}}>{x.count} </span>{zh?x.zh:x.en}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-700" />
                      </motion.button>
                    );})}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── IP AUTH CENTER ── */}
          {navSection==='ipAuth'&&(
            <div className="p-5 space-y-5 max-w-4xl">
              <div><h2 className="text-base font-black text-white">{zh?'IP授权中心':'IP Authorization Center'}</h2><p className="text-[11px] text-gray-500 mt-0.5">{zh?'管理人像、切片、数字人等授权，传递至技术公司和火山引擎':'Manage portrait, clip, digital human auth → Tech Company → Volcano Engine'}</p></div>

              {/* Volcano Engine flow bar */}
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/4 p-4">
                <div className="flex items-center gap-1.5 mb-3"><Globe className="w-4 h-4 text-indigo-400" /><span className="text-sm font-bold text-white">{zh?'授权传递链路':'Authorization Relay Chain'}</span></div>
                <div className="flex items-center gap-2 overflow-x-auto">
                  {[
                    { icon: Star,        label:{zh:'明星录入',en:'Celebrity Input'},   color:'#f59e0b', desc:{zh:'上传授权文件/素材',en:'Upload auth files & data'} },
                    { icon: Server,      label:{zh:'技术公司接收',en:'Tech Company'},  color:'#6366f1', desc:{zh:'核验并处理数据包',en:'Verify & process data'} },
                    { icon: CloudUpload, label:{zh:'火山引擎部署',en:'Volcano Engine'}, color:'#a855f7', desc:{zh:'部署AI模型至云端',en:'Deploy AI model to cloud'} },
                    { icon: Zap,         label:{zh:'系统激活',en:'System Active'},     color:'#22c55e', desc:{zh:'MCN可开始带货创作',en:'MCN can start content'} },
                  ].map((step,i)=>{const StepIc=step.icon;return(
                    <React.Fragment key={i}>
                      <div className="flex flex-col items-center text-center gap-1.5 shrink-0 min-w-[90px]">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:`${step.color}15`,border:`1px solid ${step.color}30`}}>
                          <StepIc className="w-5 h-5" style={{color:step.color}} />
                        </div>
                        <span className="text-[10px] font-bold text-white">{zh?step.label.zh:step.label.en}</span>
                        <span className="text-[8px] text-gray-500">{zh?step.desc.zh:step.desc.en}</span>
                      </div>
                      {i<3&&<div className="flex-1 min-w-[20px] h-px border-t border-dashed border-white/10 mt-[-18px]" />}
                    </React.Fragment>
                  );})}

                </div>
              </div>

              {/* 4 Auth Type Cards — grid row */}
              {(() => {
                const TYPES: IPAuthType[] = ['portrait','clip','digitalHuman','documents'];
                const nextActionLabel: Record<IPAuthStatus, {zh:string;en:string}> = {
                  notStarted:   {zh:'开始准备文件',en:'Start Preparing'},
                  preparing:    {zh:'上传授权文件',en:'Upload Files'},
                  uploaded:     {zh:'通知技术公司',en:'Notify Tech Co.'},
                  techReceived: {zh:'推送至火山引擎',en:'Push to Volcano'},
                  volcanoSync:  {zh:'确认部署完成',en:'Confirm Deploy'},
                  active:       {zh:'已激活',en:'Active'},
                };
                const expandedAuth = expandedIPType ? ipAuth.find(a=>a.type===expandedIPType) : null;
                const expandedMeta = expandedIPType ? IP_AUTH_META[expandedIPType] : null;
                const expandedSc   = expandedAuth  ? IP_STATUS_CFG[expandedAuth.status] : null;
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {TYPES.map((type,i)=>{
                        const auth = ipAuth.find(a=>a.type===type)!;
                        const meta = IP_AUTH_META[type];
                        const Icon = meta.icon;
                        const sc = IP_STATUS_CFG[auth.status];
                        const StatusIcon = sc.icon;
                        const expanded = expandedIPType===type;
                        const isActive = auth.status==='active';
                        const canAdvance = auth.status!=='active';
                        return (
                          <motion.div key={type} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}
                            className="rounded-2xl border overflow-hidden cursor-pointer"
                            style={{borderColor:expanded?`${meta.color}50`:isActive?`${meta.color}30`:`${meta.color}15`,background:expanded?`${meta.color}08`:isActive?`${meta.color}05`:'rgba(17,17,17,0.6)'}}>
                            <div role="button" tabIndex={0} onClick={()=>setExpandedIPType(expanded?null:type)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setExpandedIPType(expanded?null:type);}}}
                              className="w-full flex flex-col items-center gap-2 p-4 pb-3 hover:bg-white/[0.02] transition text-center relative">
                              <ChevronRight className={`absolute top-2 right-2 w-3 h-3 transition-transform ${expanded?'rotate-90 text-white/40':'text-gray-700'}`} />
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center mt-1"
                                style={{background:`${meta.color}12`,border:`1px solid ${meta.color}${expanded?'40':'25'}`}}>
                                <Icon className="w-5 h-5" style={{color:meta.color}} />
                              </div>
                              <div className="text-[11px] font-bold text-white leading-tight">{zh?meta.zh:meta.en}</div>
                              <span className="inline-flex items-center gap-1 text-[8px] font-bold px-2 py-0.5 rounded-full"
                                style={{background:`${sc.color}18`,color:sc.color,border:`1px solid ${sc.color}30`}}>
                                <StatusIcon className="w-2 h-2" />{zh?sc.zh:sc.en}
                              </span>
                              {/* 6-step mini progress */}
                              <div className="w-full flex items-center gap-0.5 px-1">
                                {['notStarted','preparing','uploaded','techReceived','volcanoSync','active'].map((s,si)=>{
                                  const curIdx = ['notStarted','preparing','uploaded','techReceived','volcanoSync','active'].indexOf(auth.status);
                                  const stepColors = ['#4b5563','#6366f1','#06b6d4','#a855f7','#f59e0b','#22c55e'];
                                  return <div key={s} className="flex-1 h-1 rounded-full" style={{background:si<=curIdx?stepColors[si]:'rgba(255,255,255,0.06)'}} />;
                                })}
                              </div>
                              <div className="text-[8px] text-gray-600">{auth.filesCount}/{auth.requiredFiles} {zh?'份文件':'files'}</div>
                              {canAdvance&&(
                                <button onClick={e=>{e.stopPropagation();simulateIPUpload(type);}}
                                  className="w-full mt-0.5 py-1.5 rounded-lg text-[9px] font-bold text-white transition"
                                  style={{background:`linear-gradient(135deg,${meta.color}cc,${meta.color}66)`}}>
                                  {zh?nextActionLabel[auth.status].zh:nextActionLabel[auth.status].en}
                                </button>
                              )}
                              {isActive&&(
                                <div className="w-full mt-0.5 py-1.5 rounded-lg text-[9px] font-bold"
                                  style={{background:`${meta.color}12`,color:meta.color}}>
                                  ✓ {zh?'已激活':'Active'}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Expanded detail panel — full width below grid */}
                    <AnimatePresence>
                      {expandedIPType&&expandedAuth&&expandedMeta&&expandedSc&&(
                        <motion.div key={expandedIPType}
                          initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                          transition={{duration:0.2}}
                          className="rounded-2xl border overflow-hidden"
                          style={{borderColor:`${expandedMeta.color}25`,background:`${expandedMeta.color}04`}}>
                          <div className="px-4 py-4 space-y-3">
                            {/* Detail header */}
                            <div className="flex items-center gap-2">
                              {(()=>{const EMIc=expandedMeta.icon;return <EMIc className="w-4 h-4" style={{color:expandedMeta.color}} />;})()}
                              <span className="text-sm font-bold text-white">{zh?expandedMeta.zh:expandedMeta.en}</span>
                              {expandedAuth.volcanoProjectId&&<span className="text-[8px] font-mono text-gray-600 ml-auto">{expandedAuth.volcanoProjectId}</span>}
                            </div>
                            {expandedAuth.note&&<div className="flex items-start gap-2 text-[9px] rounded-lg p-2.5" style={{background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.18)',color:'#f59e0b'}}><AlertCircle className="w-3 h-3 shrink-0 mt-px" />{expandedAuth.note}</div>}
                            <div className="grid grid-cols-2 gap-3">
                              {/* Required files */}
                              <div className="rounded-xl p-3" style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)'}}>
                                <div className="text-[10px] font-bold text-gray-400 mb-2 flex items-center gap-1"><FileText className="w-3 h-3" />{zh?'所需文件':'Required Files'}</div>
                                <div className="space-y-1.5">
                                  {expandedMeta.files.map((f,fi)=>(
                                    <div key={fi} className="flex items-center gap-1.5 text-[9px]">
                                      <div className={`w-2 h-2 rounded-full ${fi<expandedAuth.filesCount?'bg-green-400':'bg-white/10'}`} />
                                      <span className={fi<expandedAuth.filesCount?'text-gray-300':'text-gray-600'}>{f}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {/* Tech & Volcano status */}
                              <div className="rounded-xl p-3 space-y-2.5" style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)'}}>
                                <div>
                                  <div className="text-[9px] text-gray-600 mb-1 flex items-center gap-1"><Server className="w-2.5 h-2.5" />{zh?'技术公司':'Tech Company'}</div>
                                  <div className="text-[10px] font-semibold text-white">{expandedAuth.techCompany}</div>
                                  <div className="text-[8px] mt-0.5" style={{color:['techReceived','volcanoSync','active'].includes(expandedAuth.status)?'#22c55e':'#4b5563'}}>{['techReceived','volcanoSync','active'].includes(expandedAuth.status)?(zh?'✓ 已接收':'✓ Received'):(zh?'○ 未接收':'○ Not received')}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] text-gray-600 mb-1 flex items-center gap-1"><CloudUpload className="w-2.5 h-2.5" />{zh?'火山引擎':'Volcano Engine'}</div>
                                  {expandedAuth.volcanoProjectId?<div className="text-[9px] font-mono text-purple-300">{expandedAuth.volcanoProjectId}</div>:<div className="text-[9px] text-gray-700">{zh?'待部署':'Pending deploy'}</div>}
                                  <div className="text-[8px] mt-0.5" style={{color:expandedAuth.status==='active'?'#22c55e':expandedAuth.status==='volcanoSync'?'#f59e0b':'#4b5563'}}>{expandedAuth.status==='active'?(zh?'— 已激活':'— Active'):expandedAuth.status==='volcanoSync'?(zh?'— 同步中':'— Syncing'):(zh?'— 待推送':'— Not deployed')}</div>
                                </div>
                                {expandedAuth.uploadedAt&&<div className="text-[8px] text-gray-700">{zh?'上传：':'Uploaded: '}{expandedAuth.uploadedAt}{expandedAuth.activatedAt&&` · ${zh?'激活：':'Activated: '}${expandedAuth.activatedAt}`}</div>}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                );
              })()}
            </div>
          )}

          {/* ── WHITELIST ── */}
          {navSection==='whitelist'&&(
            <div className="p-5 space-y-3 max-w-4xl">
              <div><h2 className="text-base font-black text-white">{zh?'报白账号授权':'Whitelist Authorization'}</h2><p className="text-[11px] text-gray-500 mt-0.5">{zh?'审核MCN提交的切片账号报白申请':'Review MCN whitelist applications'}</p></div>
              {/* Dual filter bar */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-gray-600 shrink-0 w-12">{zh?'平台':'Platform'}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PLATFORMS.map(p=>{const count=p.id==='all'?requests.length:requests.filter(r=>r.platform===p.id).length;const active=platformFilter===p.id;return(
                      <motion.button key={p.id} onClick={()=>setPlatformFilter(p.id)} whileTap={{scale:0.93}} className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                        style={active?{background:`${p.color}20`,border:`1px solid ${p.color}55`,color:p.color,boxShadow:`0 0 10px ${p.color}25`}:{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',color:'#6b7280'}}>
                        <span>{zh?p.zh:p.en}</span>
                        <span className="px-1 rounded text-[9px] font-black" style={active?{background:`${p.color}30`,color:p.color}:{background:'rgba(255,255,255,0.05)',color:'#4b5563'}}>{count}</span>
                        {active&&<motion.div layoutId="pGlow" className="absolute inset-x-2 -bottom-px h-px rounded-full" style={{background:p.color}} />}
                      </motion.button>
                    );})}
                  </div>
                </div>
                <div className="h-px bg-white/[0.04]" />
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-gray-600 shrink-0 w-12">{zh?'状态':'Status'}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {STATUS_FILTERS.map(s=>{const count=s.id==='all'?requests.length:requests.filter(r=>r.status===s.id).length;const active=statusFilter===s.id;const Icon=s.icon;return(
                      <motion.button key={s.id} onClick={()=>setStatusFilter(s.id)} whileTap={{scale:0.93}} className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                        style={active?{background:`${s.color}20`,border:`1px solid ${s.color}55`,color:s.color}:{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',color:'#6b7280'}}>
                        <Icon className="w-3 h-3" /><span>{zh?s.zh:s.en}</span>
                        <span className="px-1 rounded text-[9px] font-black" style={active?{background:`${s.color}30`,color:s.color}:{background:'rgba(255,255,255,0.05)',color:'#4b5563'}}>{count}</span>
                        {active&&<motion.div layoutId="sGlow" className="absolute inset-x-2 -bottom-px h-px rounded-full" style={{background:s.color}} />}
                      </motion.button>
                    );})}
                  </div>
                </div>
              </div>
              {/* Flow legend */}
              <div className="flex items-center gap-2 px-1 overflow-x-auto pb-1">
                {WL_STEPS.map((step,i)=>(
                  <React.Fragment key={step.id}>
                    <div className="flex items-center gap-1.5 shrink-0"><div className="w-2 h-2 rounded-full" style={{background:step.color}} /><span className="text-[10px]" style={{color:step.color}}>{zh?step.zh:step.en}</span></div>
                    {i<WL_STEPS.length-1&&<ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />}
                  </React.Fragment>
                ))}
              </div>
              {filteredRequests.map((req,i)=>{
                const cfg=WL_STATUS[req.status];const stepCfg=WL_STEPS.find(s=>s.id===req.whitelistStep)!;const stepIdx=WL_STEPS.findIndex(s=>s.id===req.whitelistStep);const CfgIcon=cfg?.icon??Clock;
                const isPending=req.status==='pending';const isAuthorized=req.whitelistStep==='authorized';
                const pAbbr=getPlatformAbbr(req.platform);const pColor=getPlatformColor(req.platform);
                return(
                  <motion.div key={req.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
                    className={`rounded-2xl border transition ${isPending?'border-amber-500/15 bg-amber-500/3':isAuthorized?'border-green-500/15 bg-green-500/3':req.status==='rejected'?'border-red-500/10 bg-gray-900/30':'border-white/5 bg-gray-900/40'}`}>
                    <div className="flex items-start gap-3 p-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/8" style={{background:`${pColor}12`}}>
                        <span className="text-[10px] font-black" style={{color:pColor}}>{pAbbr}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{req.accountHandle}</span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{background:`${pColor}18`,color:pColor}}>{req.platform}</span>
                          <span className="text-[9px] text-gray-600">{req.mcnName}</span>
                        </div>
                        <div className={`mt-1.5 rounded-lg ${isPending&&stepIdx===0?'p-2 -mx-2':''}`} style={isPending&&stepIdx===0?{background:'rgba(6,182,212,0.05)',border:'1px solid rgba(6,182,212,0.18)'}:{}}>
                          {isPending&&stepIdx===0&&<div className="flex items-center justify-between mb-1.5"><span className="text-[9px] text-cyan-500 flex items-center gap-1"><Send className="w-2.5 h-2.5" />{zh?'点击「联系平台」时自动复制以下参数':'Auto-copied on "Contact Platform"'}</span><button onClick={e=>{e.stopPropagation();copyAllParamsForReq(req);}} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold" style={{background:'rgba(6,182,212,0.12)',color:'#06b6d4',border:'1px solid rgba(6,182,212,0.25)'}}><Copy className="w-2.5 h-2.5" />{zh?'一键全复制':'Copy All'}</button></div>}
                          <AnimatePresence>{autoCopied===req.id&&<motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="flex items-center gap-1.5 mb-1.5 text-[9px] font-bold text-green-400"><CheckCheck className="w-3 h-3" />{zh?'已复制':'Copied'}</motion.div>}</AnimatePresence>
                          <div className="flex items-center gap-3 flex-wrap">
                            {[{icon:Hash,label:zh?'账号ID':'ID',value:req.accountId,ck:`id-${req.id}`},{icon:Phone,label:zh?'手机号':'Phone',value:req.phone,ck:`ph-${req.id}`},{icon:Fingerprint,label:'UID',value:req.uid,ck:`uid-${req.id}`}].map(({icon:Icon,label,value,ck})=>(
                              <button key={ck} onClick={e=>{e.stopPropagation();copyToClipboard(value,ck);}} className="flex items-center gap-1 group hover:opacity-80 transition">
                                <Icon className="w-2.5 h-2.5 text-gray-600" /><span className="text-[9px] text-gray-600">{label}:</span>
                                <span className={`text-[9px] font-mono ${isPending&&stepIdx===0?'text-cyan-200':'text-gray-300'}`}>{value}</span>
                                {copiedId===ck?<CheckCheck className="w-2.5 h-2.5 text-green-400" />:<Copy className="w-2 h-2 text-gray-700" />}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                          <span><Users className="w-2.5 h-2.5 inline mr-0.5" />{req.fans}</span><span>{zh?'账号龄：':'Age: '}{req.accountAge}</span><span>{zh?'均播：':'Avg: '}{req.avgViews}</span>
                        </div>
                        {(isPending||isAuthorized)&&(
                          <div className="mt-2.5 flex gap-1 items-center">
                            {WL_STEPS.map((step,si)=>{const done=si<stepIdx||isAuthorized;const current=si===stepIdx&&!isAuthorized;return(
                              <React.Fragment key={step.id}><div className="flex flex-col items-center gap-0.5 flex-1">
                                <div className="w-full h-1 rounded-full" style={done||isAuthorized?{background:step.color}:current?{background:`${step.color}80`}:{background:'rgba(255,255,255,0.06)'}} />
                                <span className="text-[7px] text-center truncate w-full" style={(done||isAuthorized)?{color:step.color}:current?{color:'#fff'}:{color:'#374151'}}>{zh?step.zh:step.en}</span>
                              </div>{si<WL_STEPS.length-1&&<div className="w-1.5 h-px bg-white/5 shrink-0 mb-2" />}</React.Fragment>
                            );})}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {isAuthorized?<span className="text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 bg-green-500/10 border-green-500/25 text-green-400"><CheckCircle2 className="w-3 h-3" />{zh?'授权成功':'Authorized'}</span>:<span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${cfg.bg} ${cfg.color}`}><CfgIcon className="w-3 h-3" />{zh?cfg.zh:cfg.en}</span>}
                        {isPending&&<div className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{background:`${stepCfg.color}15`,color:stepCfg.color}}>{zh?stepCfg.zh:stepCfg.en}</div>}
                      </div>
                    </div>
                    {isPending&&(
                      <div className="flex items-center gap-2 px-4 pb-3 border-t border-white/[0.04] pt-3">
                        <div className="flex-1 text-[10px] text-gray-600">{stepIdx===0&&(zh?'参数将自动复制':'Params auto-copied')}{stepIdx===1&&(zh?'等待验证码':'Awaiting SMS')}{stepIdx===2&&(zh?'等待达人确认':'Awaiting confirmation')}{stepIdx===3&&(zh?'报白审核中':'Under review')}</div>
                        <button onClick={()=>rejectWL(req.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/8 text-red-400 border border-red-500/20 hover:bg-red-500/15 transition">{zh?'驳回':'Reject'}</button>
                        <button onClick={()=>{if(stepIdx===0)copyAllParamsForReq(req);advanceWLStep(req.id);}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition" style={{background:`linear-gradient(135deg,${stepCfg.color}cc,${stepCfg.color}88)`}}>
                          {stepIdx===0&&<Send className="w-3 h-3" />}{stepIdx===1&&<RefreshCw className="w-3 h-3" />}{stepIdx===2&&<Phone className="w-3 h-3" />}{stepIdx===3&&<CheckCheck className="w-3 h-3" />}
                          {zh?stepCfg.actionZh:stepCfg.actionEn}
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── DIGITAL HUMAN ── */}
          {navSection==='digitalHuman'&&(
            <div className="p-5 space-y-4 max-w-4xl">
              <div><h2 className="text-base font-black text-white">{zh?'数字人授权管理':'Digital Human Authorization'}</h2><p className="text-[11px] text-gray-500 mt-0.5">{zh?'审核MCN申请使用你的数字人形象':'Review MCN requests to use your digital human likeness'}</p></div>
              {dhRequests.map((req,i)=>{
                const typeColors:Record<string,string>={live:'#fe2c55',shortVideo:'#a855f7',ads:'#f59e0b'};
                const typeLabels:Record<string,{zh:string;en:string}>={live:{zh:'直播带货',en:'Live'},shortVideo:{zh:'短视频',en:'Video'},ads:{zh:'广告',en:'Ads'}};
                const tc=typeColors[req.usageType];const tl=typeLabels[req.usageType];const isPending=req.status==='pending';
                return(
                  <motion.div key={req.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
                    className={`rounded-2xl border overflow-hidden ${isPending?'border-purple-500/20 bg-purple-500/3':req.status==='approved'?'border-green-500/15 bg-green-500/3':'border-red-500/10 bg-gray-900/30'}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(168,85,247,0.12)',border:'1px solid rgba(168,85,247,0.2)'}}><Bot className="w-5 h-5 text-purple-400" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">{req.mcnName}</span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{background:`${tc}18`,color:tc}}>{zh?tl.zh:tl.en}</span>
                            {req.status==='approved'&&<span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-500/12 text-green-400">{zh?'已批准':'Approved'}</span>}
                            {req.status==='rejected'&&<span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/12 text-red-400">{zh?'已驳回':'Rejected'}</span>}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1.5">{req.purpose}</p>
                          <div className="flex items-center gap-4 mt-1.5 text-[9px] text-gray-500 flex-wrap"><span>{zh?'平台：':'Platforms: '}{req.platforms.join('、')}</span><span>{zh?'授权期：':'Duration: '}{req.duration}</span><span>{req.requestedAt}</span></div>
                        </div>
                      </div>
                      {req.riskNote&&<div className="mt-3 flex items-start gap-2 text-[9px] rounded-lg px-3 py-2" style={{background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.18)',color:'#f59e0b'}}><AlertCircle className="w-3 h-3 shrink-0 mt-px" />{req.riskNote}</div>}
                    </div>
                    {isPending&&<div className="flex justify-end gap-2 px-4 pb-3 pt-2 border-t border-white/[0.04]">
                      <button onClick={()=>rejectDH(req.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/8 text-red-400 border border-red-500/20 hover:bg-red-500/15 transition">{zh?'驳回':'Reject'}</button>
                      <button onClick={()=>approveDH(req.id)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold text-white transition" style={{background:'linear-gradient(135deg,#a855f7cc,#a855f788)'}}><CheckCheck className="w-3 h-3" />{zh?'批准授权':'Approve'}</button>
                    </div>}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── AI LIKENESS ── */}
          {navSection==='aiLikeness'&&(
            <div className="p-5 space-y-4 max-w-4xl">
              <div><h2 className="text-base font-black text-white">{zh?'AI形象授权管理':'AI Likeness Authorization'}</h2><p className="text-[11px] text-gray-500 mt-0.5">{zh?'审核AI声音/人脸/全身形象申请':'Review AI voice/face/body likeness requests'}</p></div>
              <div className="flex items-center gap-2 p-3 rounded-xl text-[10px]" style={{background:'rgba(236,72,153,0.06)',border:'1px solid rgba(236,72,153,0.18)',color:'#ec4899'}}><AlertCircle className="w-4 h-4 shrink-0" />{zh?'AI形象授权为高敏感业务，高风险申请建议咨询法律顾问后决策':'AI likeness is high-sensitivity — consult legal for high-risk requests'}</div>
              {aiRequests.map((req,i)=>{
                const riskCfg={low:{label:{zh:'低风险',en:'Low'},color:'#22c55e'},medium:{label:{zh:'中风险',en:'Medium'},color:'#f59e0b'},high:{label:{zh:'高风险',en:'High'},color:'#ef4444'}}[req.riskLevel];
                const modelCfg={voice:{label:{zh:'声音合成',en:'Voice'},icon:'MIC',color:'#a855f7'},face:{label:{zh:'人脸换脸',en:'Face'},icon:'FAC',color:'#ec4899'},fullBody:{label:{zh:'全身形象',en:'Full Body'},icon:'BDY',color:'#f97316'}}[req.modelType];
                const isPending=req.status==='pending';
                return(
                  <motion.div key={req.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
                    className={`rounded-2xl border overflow-hidden ${isPending?'border-pink-500/20 bg-pink-500/3':req.status==='approved'?'border-green-500/15 bg-green-500/3':'border-red-500/10 bg-gray-900/30'}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{background:`${modelCfg.color}12`,border:`1px solid ${modelCfg.color}25`}}>{modelCfg.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">{req.mcnName}</span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{background:`${modelCfg.color}18`,color:modelCfg.color}}>{zh?modelCfg.label.zh:modelCfg.label.en}</span>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{background:`${riskCfg.color}18`,color:riskCfg.color}}>{zh?riskCfg.label.zh:riskCfg.label.en}</span>
                            {req.status==='approved'&&<span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/12 text-green-400 font-bold">{zh?'已批准':'Approved'}</span>}
                            {req.status==='rejected'&&<span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/12 text-red-400 font-bold">{zh?'已驳回':'Rejected'}</span>}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1.5">{req.purpose}</p>
                          <div className="flex items-center gap-4 mt-1.5 text-[9px] text-gray-500 flex-wrap"><span>AI: {req.aiVendor}</span><span>{req.platforms.join('、')}</span><span>{req.requestedAt}</span></div>
                        </div>
                      </div>
                      {req.riskLevel==='high'&&isPending&&<div className="mt-3 flex items-start gap-2 text-[9px] rounded-lg px-3 py-2" style={{background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.2)',color:'#ef4444'}}><AlertCircle className="w-3 h-3 shrink-0 mt-px" />{zh?'⚠ 高风险：建议驳回或要求签署专项协议':'⚠ High-risk: Recommend reject or require special agreement'}</div>}
                    </div>
                    {isPending&&<div className="flex justify-end gap-2 px-4 pb-3 pt-2 border-t border-white/[0.04]">
                      <button onClick={()=>rejectAI(req.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/8 text-red-400 border border-red-500/20 hover:bg-red-500/15 transition">{zh?'驳回':'Reject'}</button>
                      <button onClick={()=>approveAI(req.id)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold text-white transition" style={{background:req.riskLevel==='high'?'linear-gradient(135deg,#ef4444aa,#ef444466)':'linear-gradient(135deg,#ec4899cc,#ec489988)'}}><CheckCheck className="w-3 h-3" />{zh?(req.riskLevel==='high'?'强制批准（慎）':'批准授权'):(req.riskLevel==='high'?'Force Approve':'Approve')}</button>
                    </div>}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── CONTENT REVIEW ── */}
          {navSection==='contentReview'&&(
            <div className="p-5 space-y-4 max-w-4xl">
              <div><h2 className="text-base font-black text-white">{zh?'内容审核':'Content Review'}</h2><p className="text-[11px] text-gray-500 mt-0.5">{zh?'审核MCN制作的切片、数字人、AI形象视频':'Review clip, digital human, and AI likeness videos'}</p></div>
              <div className="flex items-center gap-2 flex-wrap">
                {[{id:'all',zh:'全部',en:'All',icon:Video,color:'#6b7280'},{id:'clip',zh:'切片',en:'Clip',icon:Scissors,color:'#06b6d4'},{id:'digitalHuman',zh:'数字人',en:'Digital Human',icon:Bot,color:'#a855f7'},{id:'aiLikeness',zh:'AI形象',en:'AI Likeness',icon:Sparkles,color:'#ec4899'}].map(f=>{
                  const count=f.id==='all'?contentReviews.length:contentReviews.filter(c=>c.type===f.id).length;const active=contentTypeFilter===f.id;const Icon=f.icon;
                  return(<motion.button key={f.id} onClick={()=>setContentTypeFilter(f.id)} whileTap={{scale:0.93}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all" style={active?{background:`${f.color}18`,border:`1px solid ${f.color}40`,color:f.color}:{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',color:'#6b7280'}}>
                    <Icon className="w-3.5 h-3.5" /><span>{zh?f.zh:f.en}</span><span className="px-1 rounded text-[9px] font-black" style={active?{background:`${f.color}28`,color:f.color}:{background:'rgba(255,255,255,0.05)',color:'#4b5563'}}>{count}</span>
                  </motion.button>);
                })}
              </div>
              {filteredContent.map((item,i)=>{
                const typeColor=item.type==='clip'?'#06b6d4':item.type==='digitalHuman'?'#a855f7':'#ec4899';
                const typeLabel=item.type==='clip'?{zh:'切片',en:'Clip'}:item.type==='digitalHuman'?{zh:'数字人',en:'Digital Human'}:{zh:'AI形象',en:'AI'};
                const TypeIcon=item.type==='clip'?Scissors:item.type==='digitalHuman'?Bot:Sparkles;
                const pColor=getPlatformColor(item.platform);const pAbbr=getPlatformAbbr(item.platform);
                const sCfg={pending:{zh:'待审核',en:'Pending',color:'#f59e0b'},approved:{zh:'已通过',en:'Approved',color:'#22c55e'},revision:{zh:'需修改',en:'Revision',color:'#f97316'},rejected:{zh:'已驳回',en:'Rejected',color:'#ef4444'}}[item.status];
                return(
                  <motion.div key={item.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}} className="rounded-2xl border bg-gray-900/40 hover:border-white/10 transition" style={{borderColor:'rgba(255,255,255,0.06)'}}>
                    <div className="flex items-start gap-3 p-4">
                      <div className="w-20 h-14 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden" style={{background:`${typeColor}10`,border:`1px solid ${typeColor}20`}}>
                        <TypeIcon className="w-6 h-6 opacity-30" style={{color:typeColor}} />
                        <div className="absolute bottom-1 right-1 text-[8px] font-bold px-1.5 py-0.5 rounded" style={{background:'rgba(0,0,0,0.7)',color:'#ccc'}}>{item.duration}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-white">{item.title}</div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{background:`${typeColor}15`,color:typeColor}}>{zh?typeLabel.zh:typeLabel.en}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{background:`${pColor}15`,color:pColor}}>{item.platform}</span>
                              {item.views&&<span className="text-[9px] text-gray-500"><Eye className="w-2.5 h-2.5 inline mr-0.5" />{item.views}</span>}
                            </div>
                          </div>
                          <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg border shrink-0" style={{background:`${sCfg.color}12`,borderColor:`${sCfg.color}30`,color:sCfg.color}}>{zh?sCfg.zh:sCfg.en}</span>
                        </div>
                        <div className="text-[9px] text-gray-500 mt-1">{item.uploader} · {item.mcnName} · {item.submittedAt}</div>
                      </div>
                    </div>
                    {item.status==='pending'&&<div className="flex justify-end gap-2 px-4 pb-3 pt-2 border-t border-white/[0.04]">
                      <button onClick={()=>rejectContent(item.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/8 text-red-400 border border-red-500/20 hover:bg-red-500/15 transition">{zh?'驳回':'Reject'}</button>
                      <button onClick={()=>reviseContent(item.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-orange-500/8 text-orange-400 border border-orange-500/20 hover:bg-orange-500/15 transition"><RotateCcw className="w-3 h-3" />{zh?'要求修改':'Revision'}</button>
                      <button onClick={()=>approveContent(item.id)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold text-white transition" style={{background:'linear-gradient(135deg,#22c55ecc,#22c55e88)'}}><CheckCheck className="w-3 h-3" />{zh?'通过':'Approve'}</button>
                    </div>}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── PRODUCT ONBOARD ── */}
          {navSection==='productOnboard'&&(
            <div className="p-5 space-y-4 max-w-4xl">
              <div><h2 className="text-base font-black text-white">{zh?'商品入库管理':'Product Onboarding'}</h2><p className="text-[11px] text-gray-500 mt-0.5">{zh?'平台发起 · 达人选品 · 品牌申请 三条入库路径，平台+明星均需收样审核':'3 paths: Platform / Creator / Brand — both platform & celebrity need samples'}</p></div>

              {/* Source filter */}
              <div className="flex items-center gap-2 flex-wrap">
                {[{id:'all',zh:'全部来源',en:'All',color:'#6b7280'},{id:'platform',zh:'平台发起',en:'Platform',color:'#06b6d4'},{id:'creator',zh:'达人选品',en:'Creator',color:'#a855f7'},{id:'brand',zh:'品牌申请',en:'Brand',color:'#3b82f6'}].map(f=>{
                  const count=f.id==='all'?productOnboard.length:productOnboard.filter(p=>p.source===f.id).length;const active=productSourceFilter===f.id;
                  return(<motion.button key={f.id} onClick={()=>setProductSourceFilter(f.id)} whileTap={{scale:0.93}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all" style={active?{background:`${f.color}18`,border:`1px solid ${f.color}40`,color:f.color}:{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',color:'#6b7280'}}>
                    <span>{zh?f.zh:f.en}</span><span className="px-1 rounded text-[9px] font-black" style={active?{background:`${f.color}28`,color:f.color}:{background:'rgba(255,255,255,0.05)',color:'#4b5563'}}>{count}</span>
                  </motion.button>);
                })}
              </div>

              {/* Step legend */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {PRODUCT_STEPS.map((step,i)=>(
                  <React.Fragment key={i}><div className="flex items-center gap-1 shrink-0"><div className="w-2 h-2 rounded-full" style={{background:step.color}} /><span className="text-[9px]" style={{color:step.color}}>{zh?step.zh:step.en}</span></div>{i<PRODUCT_STEPS.length-1&&<ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />}</React.Fragment>
                ))}
                <span className="text-[9px] text-gray-600 ml-2 shrink-0">= {zh?'商品入库流程':'Product onboarding flow'}</span>
              </div>

              {filteredOnboard.map((item,i)=>{
                const sourceColor={platform:'#06b6d4',creator:'#a855f7',brand:'#3b82f6'}[item.source];
                const sourceLabel={platform:{zh:'平台发起',en:'Platform'},creator:{zh:'达人选品',en:'Creator'},brand:{zh:'品牌申请',en:'Brand'}}[item.source];
                const needsCelebReview = item.step===2;
                const needsCelebSample = item.step===4 && item.celebSample==='delivered';
                const isRejected = item.step===6;
                const isInLibrary = item.step===5;
                return(
                  <motion.div key={item.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
                    className={`rounded-2xl border overflow-hidden transition ${isInLibrary?'border-green-500/15 bg-green-500/3':isRejected?'border-red-500/10 bg-gray-900/30':needsCelebReview||needsCelebSample?'border-amber-500/15 bg-amber-500/3':'border-white/5 bg-gray-900/40'}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Left: product image placeholder */}
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-gray-100 border border-gray-200">
                          <ShoppingBag className="w-6 h-6 text-gray-400" />
                        </div>

                        {/* Center: info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-gray-900">{item.productName}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{background:`${sourceColor}15`,color:sourceColor}}>{zh?sourceLabel.zh:sourceLabel.en}</span>
                            {isInLibrary&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">{zh?'✓ 已入库':'✓ In Library'}</span>}
                            {isRejected&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">{zh?'已驳回':'Rejected'}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500 flex-wrap">
                            <span className="text-amber-500 font-black">{item.price}</span>
                            <span className="text-gray-700 font-medium">{item.brand}</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">{item.category}</span>
                          </div>
                          <div className="mt-0.5 text-[9px] text-gray-400">
                            {zh?'提交方：':'By: '}{item.submittedBy}{item.mcnName&&<span> · {item.mcnName}</span>}
                          </div>
                          {/* Platform note */}
                          {item.platformNote&&<div className="mt-1.5 text-[9px] text-sky-500 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" />{item.platformNote}</div>}
                          {/* Sample status */}
                          {item.step>=3&&!isRejected&&(
                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                              {[{who:{zh:'平台样品',en:'Platform'},status:item.platformSample,tracking:item.trackingPlatform},{who:{zh:'明星样品',en:'My Sample'},status:item.celebSample,tracking:item.trackingCeleb}].map((track,ti)=>{
                                const ss=SAMPLE_STATUS_CFG[track.status];const Icon=ss.icon;
                                return(
                                  <div key={ti} className="rounded-lg p-2 bg-gray-50 border border-gray-100">
                                    <div className="text-[8px] text-gray-400 mb-1">{zh?track.who.zh:track.who.en}</div>
                                    <div className="flex items-center gap-1"><Icon className="w-3 h-3 shrink-0" style={{color:ss.color}} /><span className="text-[9px] font-bold" style={{color:ss.color}}>{zh?ss.zh:ss.en}</span></div>
                                    {track.tracking&&<div className="text-[8px] font-mono text-gray-400 mt-0.5 truncate">{track.tracking}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Right: vertical step progress */}
                        {!isRejected&&(
                          <div className="flex flex-col items-center gap-0 shrink-0 w-[52px]">
                            {PRODUCT_STEPS.map((step,si)=>{
                              const skipStep = item.source==='platform'&&si===1;
                              const done = item.step>si||(item.step===5);
                              const current = item.step===si&&!isInLibrary;
                              return(
                                <div key={si} className="flex items-center w-full gap-1.5">
                                  {/* dot + line */}
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className="w-2 h-2 rounded-full border-2 shrink-0" style={skipStep?{borderColor:'#e5e7eb',background:'#f9fafb'}:done?{borderColor:step.color,background:step.color}:current?{borderColor:step.color,background:'#fff'}:{borderColor:'#e5e7eb',background:'#f9fafb'}} />
                                    {si<PRODUCT_STEPS.length-1&&<div className="w-px flex-1 min-h-[10px]" style={{background:done&&!skipStep?step.color:'#e5e7eb'}} />}
                                  </div>
                                  <span className="text-[7px] leading-tight truncate" style={skipStep?{color:'#d1d5db'}:done?{color:step.color}:current?{color:'#111827',fontWeight:700}:{color:'#9ca3af'}}>{skipStep?'—':zh?step.zh:step.en}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Action bar */}
                    {(needsCelebReview||needsCelebSample)&&(
                      <div className="flex items-center gap-2 px-4 pb-3 pt-2 border-t border-white/[0.04]">
                        <div className="flex-1 text-[10px] text-amber-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{needsCelebReview?(zh?'需要你审核这款商品':'Your review required'):zh?'样品已到，请确认质量':'Sample delivered — confirm quality'}</div>
                        <button onClick={()=>rejectProduct(item.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/8 text-red-400 border border-red-500/20 hover:bg-red-500/15 transition">{zh?'驳回':'Reject'}</button>
                        {needsCelebReview&&<button onClick={()=>approveCelebProduct(item.id)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold text-white transition" style={{background:'linear-gradient(135deg,#22c55ecc,#22c55e88)'}}><CheckCheck className="w-3 h-3" />{zh?'审核通过，待收样':'Approve — request sample'}</button>}
                        {needsCelebSample&&<button onClick={()=>confirmCelebSample(item.id)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold text-white transition" style={{background:'linear-gradient(135deg,#22c55ecc,#22c55e88)'}}><Package className="w-3 h-3" />{zh?'样品通过，申请入库':'Sample OK — add to library'}</button>}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── PRODUCT LIBRARY ── */}
          {navSection==='productLib'&&(
            <div className="p-5 space-y-4 max-w-4xl">
              <div className="flex items-center justify-between"><div><h2 className="text-base font-black text-white">{zh?'商品库':'Product Library'}</h2><p className="text-[11px] text-gray-500 mt-0.5">{zh?`共 ${productLib.length} 件已审核入库商品，达人可带货创作`:`${productLib.length} approved products — creators can promote`}</p></div><div className="text-[10px] text-teal-400 border border-teal-500/30 rounded-full px-3 py-1">{zh?'达人可带货':'Available'}</div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {productLib.map((item,i)=>(
                  <motion.div key={item.id} initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}} transition={{delay:i*0.05}} className="rounded-2xl border border-white/5 bg-gray-900/50 p-4 hover:border-teal-500/20 transition">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center border border-white/8 bg-white/[0.03] shrink-0">
                        <Package className="w-6 h-6 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{item.productName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[9px]"><span className="text-amber-400 font-black">{item.price}</span><span className="text-gray-500">{item.brand}</span><span className="px-1.5 py-0.5 rounded text-gray-400" style={{background:'rgba(255,255,255,0.05)'}}>{item.category}</span></div>
                        <div className="text-[9px] text-gray-600 mt-1">{item.mcnName} · {zh?'入库：':'Added: '}{item.approvedAt}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden"><motion.div className="h-full rounded-full" style={{background:'#14b8a6'}} initial={{width:0}} animate={{width:`${Math.min((item.salesCount/3000)*100,100)}%`}} transition={{delay:i*0.05+0.3,duration:0.8}} /></div>
                          <span className="text-[9px] text-teal-400 font-semibold shrink-0">{item.salesCount.toLocaleString()} {zh?'销量':'sold'}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ── BRAND AUTH ── */}
          {navSection==='brandAuth'&&(
            <div className="p-5 space-y-4 max-w-4xl">
              <div><h2 className="text-base font-black text-white">{zh?'品牌授权管理':'Brand Authorization'}</h2><p className="text-[11px] text-gray-500 mt-0.5">{zh?'品牌方向明星申请形象授权，平台+明星双层审核，均需收到样品后才可激活':'Brands apply for celebrity authorization — dual review by platform + celebrity, samples required'}</p></div>

              {/* Review chain explanation */}
              <div className="rounded-xl border border-blue-500/15 bg-blue-500/3 p-3">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {[{icon:Building2,label:{zh:'品牌申请',en:'Brand Applies'},color:'#3b82f6'},{icon:CheckCircle2,label:{zh:'平台预审',en:'Platform Review'},color:'#06b6d4'},{icon:Truck,label:{zh:'寄样（双线）',en:'Samples (Both)'},color:'#a855f7'},{icon:Star,label:{zh:'明星审核',en:'Celeb Review'},color:'#f59e0b'},{icon:Zap,label:{zh:'授权激活',en:'Authorized'},color:'#22c55e'}].map((s,si)=>{
                    const SIcon = s.icon;
                    return (
                    <React.Fragment key={si}>
                      <div className="flex flex-col items-center text-center gap-1 shrink-0 min-w-[68px]">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:`${s.color}15`,border:`1px solid ${s.color}25`}}><SIcon className="w-4 h-4" style={{color:s.color}} /></div>
                        <span className="text-[8px] text-gray-400">{zh?s.label.zh:s.label.en}</span>
                      </div>
                      {si<4&&<ChevronRight className="w-3 h-3 text-gray-700 shrink-0 mt-[-8px]" />}
                    </React.Fragment>
                  );
                  })}
                </div>
              </div>

              {brandAuth.map((req,i)=>{
                const isCelebReview = req.status==='celebReview';
                const isSampleStage = req.status==='sampleStage';
                const needsCelebSample = isSampleStage && req.celebSample==='delivered';
                const isApproved = req.status==='approved';
                const isRejected = req.status==='rejected';
                return(
                  <motion.div key={req.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}
                    className={`rounded-2xl border overflow-hidden ${isCelebReview||needsCelebSample?'border-amber-500/15 bg-amber-500/3':isApproved?'border-green-500/15 bg-green-500/3':isRejected?'border-red-500/10 bg-gray-900/30':'border-white/5 bg-gray-900/40'}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/8" style={{background:'rgba(59,130,246,0.1)'}}>
                          <Building2 className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">{req.brandName}</span>
                            {req.authTypes.map(t=><span key={t} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/12 text-blue-400 border border-blue-500/20">{t}</span>)}
                            {isApproved&&<span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-500/12 text-green-400">{zh?'已授权':'Authorized'}</span>}
                            {isRejected&&<span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/12 text-red-400">{zh?'已驳回':'Rejected'}</span>}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1.5">{req.purpose}</p>
                          <div className="flex items-center gap-4 mt-1.5 text-[9px] text-gray-500 flex-wrap">
                            <span className="text-amber-400 font-black">{req.amount}</span>
                            <span>{zh?'授权期：':'Duration: '}{req.duration}</span>
                            <span>{req.platforms.join('、')}</span>
                            <span>{req.submittedAt}</span>
                          </div>
                          {req.platformNote&&<div className="mt-2 text-[9px] text-cyan-400 flex items-start gap-1"><CheckCircle2 className="w-2.5 h-2.5 shrink-0 mt-px" />{zh?'平台建议：':'Platform note: '}{req.platformNote}</div>}
                          {/* Sample tracks */}
                          {req.status!=='pending'&&req.status!=='platformReview'&&(
                            <div className="mt-2.5 grid grid-cols-2 gap-2">
                              {[{who:{zh:'平台收样',en:'Platform Sample'},status:req.platformSample},{who:{zh:'明星收样',en:'My Sample'},status:req.celebSample}].map((track,ti)=>{
                                const ss=SAMPLE_STATUS_CFG[track.status];const Icon=ss.icon;
                                return(
                                  <div key={ti} className="rounded-lg p-2" style={{background:'rgba(255,255,255,0.02)',border:`1px solid ${ss.color}20`}}>
                                    <div className="text-[8px] text-gray-600 mb-1">{zh?track.who.zh:track.who.en}</div>
                                    <div className="flex items-center gap-1"><Icon className="w-3 h-3" style={{color:ss.color}} /><span className="text-[9px] font-bold" style={{color:ss.color}}>{zh?ss.zh:ss.en}</span></div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {(isCelebReview||needsCelebSample)&&(
                      <div className="flex items-center gap-2 px-4 pb-3 pt-2 border-t border-white/[0.04]">
                        <div className="flex-1 text-[10px] text-amber-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{isCelebReview?(zh?'平台已审核，等待你的决定':'Platform approved — your decision needed'):zh?'样品已到，确认后即可授权激活':'Sample arrived — confirm to activate authorization'}</div>
                        <button onClick={()=>rejectBrand(req.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/8 text-red-400 border border-red-500/20 hover:bg-red-500/15 transition">{zh?'驳回':'Reject'}</button>
                        {isCelebReview&&<button onClick={()=>approveBrand(req.id)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold text-white transition" style={{background:'linear-gradient(135deg,#3b82f6cc,#3b82f688)'}}><CheckCheck className="w-3 h-3" />{zh?'批准授权':'Approve'}</button>}
                        {needsCelebSample&&<button onClick={()=>confirmBrandSample(req.id)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold text-white transition" style={{background:'linear-gradient(135deg,#22c55ecc,#22c55e88)'}}><Package className="w-3 h-3" />{zh?'样品确认，激活授权':'Sample OK — activate'}</button>}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── REVENUE ── */}
          {navSection==='revenue'&&(
            <div className="p-5 space-y-5 max-w-4xl">
              <div><h2 className="text-base font-black text-white">{zh?'分成收益':'Revenue Share'}</h2></div>
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4">{zh?'GMV带货趋势':'GMV Trend'}</h3>
                <div className="h-40"><ResponsiveContainer width="100%" height="100%"><AreaChart data={GMV_DATA}><defs key="defs"><linearGradient id="celGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs><CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis key="x" dataKey="month" tick={{fill:'#6b7280',fontSize:10}} axisLine={false} tickLine={false} /><YAxis key="y" tick={{fill:'#6b7280',fontSize:10}} axisLine={false} tickLine={false} width={50} /><Tooltip key="tip" contentStyle={{background:'#030712',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,fontSize:11}} /><Area key="gmv" type="monotone" dataKey="gmv" stroke="#f59e0b" fill="url(#celGrad)" strokeWidth={2} dot={false} name="GMV" /></AreaChart></ResponsiveContainer></div>
              </div>
              <div className="space-y-2">
                {[{month:'2026-05',gmv:162000,myShare:10,amount:16200,status:'processing'},{month:'2026-04',gmv:218000,myShare:10,amount:21800,status:'paid'},{month:'2026-03',gmv:84000,myShare:10,amount:8400,status:'paid'}].map((item,i)=>(
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-900/50 border border-white/5 rounded-xl">
                    <div><div className="text-sm font-semibold text-white">{item.month}</div><div className="text-[10px] text-gray-500 mt-0.5">GMV ¥{(item.gmv/10000).toFixed(1)}万 × {item.myShare}%</div></div>
                    <div className="text-right"><div className="text-base font-black text-amber-400">¥{item.amount.toLocaleString()}</div><div className={`text-[9px] mt-0.5 ${item.status==='paid'?'text-green-400':'text-blue-400'}`}>{item.status==='paid'?(zh?'已到账':'Paid'):(zh?'结算中':'Processing')}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── INFRINGEMENT PATROL ── */}
          {navSection==='infringement'&&(
            <div className="p-5 max-w-7xl">
              <InfringementPatrol lang={lang} />
            </div>
          )}

          {/* ── CONTRACTS CENTER ── */}
          {navSection==='contracts'&&(
            <div className="p-5 max-w-7xl">
              <ContractCenter lang={lang} />
            </div>
          )}

          {/* ── RULES ── */}
          {navSection==='rules'&&(
            <div className="p-5 space-y-4 max-w-4xl">
              <div><h2 className="text-base font-black text-white">{zh?'内容授权规则':'Content Auth Rules'}</h2></div>
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-400">{zh?'⚠ 以下规则将应用于所有持有你授权协议的MCN账号。修改后立即生效。':'⚠ Rules apply to all MCN accounts with your authorization. Changes take effect immediately.'}</div>
              <div className="space-y-3">
                {rules.map(rule=>{const zc=ZONE_COLORS[rule.zone];const zl=ZONE_LABELS[rule.zone];return(
                  <div key={rule.id} className="flex items-center gap-4 p-4 bg-gray-900/50 border border-white/5 rounded-xl">
                    <div className="w-2 h-12 rounded-full shrink-0" style={{background:zc}} />
                    <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-semibold text-white">{rule.name}</span><span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{background:`${zc}15`,color:zc}}>{zh?zl.zh:zl.en}</span></div><div className="text-[10px] text-gray-500 mt-0.5">{rule.description}</div></div>
                    <button onClick={()=>toggleRule(rule.id)} className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${rule.enabled?'bg-green-500':'bg-white/10'}`}>
                      <motion.div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow" animate={{left:rule.enabled?'22px':'2px'}} transition={{type:'spring',stiffness:500,damping:30}} />
                    </button>
                  </div>
                );})}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default CelebrityWorkbench;
