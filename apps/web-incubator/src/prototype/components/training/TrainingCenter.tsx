/**
 * 培训认证中心
 *
 * 三条认证路径：
 *   基础合规认证  ¥980  → 1个月Lite授权 + 绿区资格
 *   带货运营认证  ¥1,480 → 1个月Pro授权 + ⬡500星币
 *   AI创作认证   ¥1,980 → 1.5个月Pro授权 + ⬡1000星币 + 红区AI资格
 *
 * 流程：购买课程 → 学习章节 → 结业考试(≥80分) → 颁发证书 → 解锁授权
 */

import React, { useState, useCallback } from 'react';
import {
  GraduationCap, BookOpen, Play, CheckCircle2, Lock, ChevronRight,
  ChevronDown, Clock, Award, Zap, Shield, Coins, Star, ArrowRight,
  RefreshCw, Check, X, AlertTriangle, BadgeCheck, Sparkles,
  BarChart3, Crown, Package, Video, FileText, Mic2, Volume2, Brain,
  TrendingUp, ShoppingBag, Target, Flame, Trophy, XCircle, Info,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/button';
import type { Lang } from '../../translations';

// ─── Types ────────────────────────────────────────────────────────────────────

type CertLevel = 'basic' | 'commerce' | 'ai';
type LessonStatus = 'locked' | 'unlocked' | 'completed';
type CourseView = 'catalog' | 'course' | 'exam' | 'certificate';

interface Lesson {
  id: string;
  title: { zh: string; en: string };
  duration: string;
  type: 'video' | 'reading' | 'practice';
  status: LessonStatus;
}

interface Chapter {
  id: string;
  title: { zh: string; en: string };
  lessons: Lesson[];
}

interface ExamQuestion {
  id: string;
  question: { zh: string; en: string };
  options: { zh: string; en: string }[];
  correct: number;
  explanation: { zh: string; en: string };
}

interface Certificate {
  level: CertLevel;
  name: { zh: string; en: string };
  icon: string;
  price: number;
  duration: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  gradientFrom: string;
  gradientTo: string;
  reward: {
    authTier: 'lite' | 'pro';
    authMonths: number;
    starCoins: number;
    zoneBadge?: { zh: string; en: string; color: string };
  };
  tagline: { zh: string; en: string };
  chapters: Chapter[];
  exam: ExamQuestion[];
}

// ─── Course Data ──────────────────────────────────────────────────────────────

const CERTIFICATES: Certificate[] = [
  {
    level: 'basic',
    name: { zh: '基础合规认证', en: 'Compliance Basics' },
    icon: 'SHD',
    price: 980,
    duration: '约 3 小时',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/8',
    border: 'border-cyan-500/30',
    glow: 'rgba(6,182,212,0.2)',
    gradientFrom: '#06b6d4',
    gradientTo: '#0891b2',
    reward: {
      authTier: 'lite',
      authMonths: 1,
      starCoins: 0,
      zoneBadge: { zh: '绿区操作资格', en: 'Green Zone License', color: 'text-green-400' },
    },
    tagline: { zh: '掌握四色边界线体系，安全合规运营第一步', en: 'Master the 4-zone boundary system for safe operations' },
    chapters: [
      {
        id: 'c1', title: { zh: '第一章：四色边界线体系', en: 'Ch1: 4-Zone Boundary System' },
        lessons: [
          { id: 'l1', title: { zh: '绿区—可直接发布的内容标准', en: 'Green Zone — Directly publishable content' }, duration: '12分钟', type: 'video', status: 'unlocked' },
          { id: 'l2', title: { zh: '黄区—需确认授权范围的内容', en: 'Yellow Zone — Content requiring confirmation' }, duration: '15分钟', type: 'video', status: 'locked' },
          { id: 'l3', title: { zh: '红区与禁区—高风险行为解析', en: 'Red/Forbidden Zones — High risk behaviors' }, duration: '18分钟', type: 'video', status: 'locked' },
        ],
      },
      {
        id: 'c2', title: { zh: '第二章：账号报白完整流程', en: 'Ch2: Account Whitelist Process' },
        lessons: [
          { id: 'l4', title: { zh: '抖音/视频号报白所需材料清单', en: 'Required docs for Douyin/WeChat Video whitelist' }, duration: '10分钟', type: 'reading', status: 'locked' },
          { id: 'l5', title: { zh: '审核周期与常见拒审原因', en: 'Review timelines and common rejection reasons' }, duration: '8分钟', type: 'reading', status: 'locked' },
        ],
      },
      {
        id: 'c3', title: { zh: '第三章：切片素材使用规范', en: 'Ch3: Clip Material Usage Rules' },
        lessons: [
          { id: 'l6', title: { zh: '官方切片的合法剪辑边界', en: 'Legal editing boundaries for official clips' }, duration: '14分钟', type: 'video', status: 'locked' },
          { id: 'l7', title: { zh: '二次创作的授权逻辑', en: 'Authorization logic for derivative content' }, duration: '11分钟', type: 'practice', status: 'locked' },
        ],
      },
      {
        id: 'c4', title: { zh: '第四章：违规案例实战分析', en: 'Ch4: Real Violation Case Studies' },
        lessons: [
          { id: 'l8', title: { zh: '10个真实违规案例复盘', en: '10 real violation case reviews' }, duration: '20分钟', type: 'reading', status: 'locked' },
        ],
      },
    ],
    exam: [
      {
        id: 'q1',
        question: { zh: '以下哪种内容属于"绿区"，可以直接发布？', en: 'Which content type falls in the "Green Zone" and can be published directly?' },
        options: [
          { zh: '使用AI技术模拟明星声音生成的广告口播', en: "AI-generated audio simulating a celebrity's voice" },
          { zh: '官方授权切片直接添加商品链接字幕', en: 'Official licensed clip with product link subtitles added' },
          { zh: '自制剪辑添加明星face swap效果', en: 'DIY edit with celebrity face swap effect' },
          { zh: '未报白账号发布明星相关内容', en: 'Posting celebrity content from a non-whitelisted account' },
        ],
        correct: 1,
        explanation: { zh: '官方授权切片添加商品链接字幕是典型绿区操作，直接使用平台提供的素材并叠加非虚假商业信息。', en: 'Adding product link subtitles to officially licensed clips is a classic green zone operation.' },
      },
      {
        id: 'q2',
        question: { zh: 'AI声音配音（用明星声音生成全新内容）属于哪个边界区？', en: 'AI voice synthesis using a celebrity\'s voice falls under which zone?' },
        options: [
          { zh: '绿区——可直接使用', en: 'Green Zone — freely usable' },
          { zh: '黄区——需额外确认', en: 'Yellow Zone — needs additional confirmation' },
          { zh: '红区——需专项授权包', en: 'Red Zone — requires special authorization package' },
          { zh: '禁区——绝对不可执行', en: 'Forbidden — absolutely prohibited' },
        ],
        correct: 2,
        explanation: { zh: 'AI声音属于红区，需要购买专项「AI声音授权包」，不能仅凭基础套餐使用。', en: 'AI voice synthesis is Red Zone — a dedicated AI Voice Authorization Package is required.' },
      },
      {
        id: 'q3',
        question: { zh: '账号报白申请时，以下哪项不是必须提供的材料？', en: 'When applying for account whitelist, which of the following is NOT required?' },
        options: [
          { zh: '经营者营业执照或个人身份证', en: 'Business license or personal ID of account operator' },
          { zh: '明星方签发的授权委托书', en: "Celebrity's signed authorization certificate" },
          { zh: '账号的粉丝数据截图', en: 'Screenshot of account follower statistics' },
          { zh: '待发布商品的品牌授权文件', en: "Brand authorization document for products to be promoted" },
        ],
        correct: 2,
        explanation: { zh: '粉丝数量截图不是报白必需材料，粉丝多少不影响报白资格审核。关键材料是授权委托书、营业证件和商品品牌授权。', en: 'Follower count screenshots are not required for whitelist applications — authorization certificates and licenses are the key documents.' },
      },
      {
        id: 'q4',
        question: { zh: '下列哪种行为属于绝对禁止的"禁区"操作？', en: 'Which action falls in the absolutely forbidden zone?' },
        options: [
          { zh: '在官方素材上添加价格字幕', en: 'Adding price captions to official materials' },
          { zh: '把明星与竞品品牌做视觉关联', en: 'Visually associating the celebrity with a competing brand' },
          { zh: '在黄区内容下方展示产品', en: 'Displaying products under yellow zone content' },
          { zh: '申请追加1个报白账号名额', en: 'Applying for an additional whitelist account slot' },
        ],
        correct: 1,
        explanation: { zh: '将明星与竞品品牌做任何视觉或文案关联是绝对禁区，可导致合同立即终止并承担连带法律责任。', en: 'Visually associating celebrities with competing brands is absolutely forbidden and can immediately terminate contracts with legal liability.' },
      },
      {
        id: 'q5',
        question: { zh: '对"黄区"内容发布前需要做什么？', en: 'What must be done before publishing "Yellow Zone" content?' },
        options: [
          { zh: '无需任何额外操作，直接发布即可', en: 'No extra steps required, publish directly' },
          { zh: '在平台签署黄区内容确认书并完成合规检查', en: 'Sign the Yellow Zone acknowledgment and complete compliance check on the platform' },
          { zh: '联系明星本人进行实时确认', en: "Contact the celebrity directly for real-time confirmation" },
          { zh: '升级到Elite旗舰套餐', en: 'Upgrade to Elite package first' },
        ],
        correct: 1,
        explanation: { zh: '黄区内容需要在平台内完成「黄区内容确认书」签署，承诺内容符合授权范围且完成了合规自查。', en: 'Yellow Zone content requires signing the Yellow Zone Acknowledgment on the platform, confirming the content is within authorization scope.' },
      },
    ],
  },

  {
    level: 'commerce',
    name: { zh: '带货运营认证', en: 'Commerce Operations' },
    icon: 'RKT',
    price: 1480,
    duration: '约 5 小时',
    color: 'text-purple-400',
    bg: 'bg-purple-500/8',
    border: 'border-purple-500/30',
    glow: 'rgba(168,85,247,0.2)',
    gradientFrom: '#a855f7',
    gradientTo: '#7c3aed',
    reward: {
      authTier: 'pro',
      authMonths: 1,
      starCoins: 500,
      zoneBadge: { zh: '黄区运营资格', en: 'Yellow Zone License', color: 'text-amber-400' },
    },
    tagline: { zh: '掌握明星带货选品、脚本创作与GMV提升核心策略', en: 'Master celebrity product selection, scripting & GMV growth' },
    chapters: [
      {
        id: 'c1', title: { zh: '第一章：明星带货选品逻辑', en: 'Ch1: Celebrity Product Selection Logic' },
        lessons: [
          { id: 'l1', title: { zh: '明星人设与商品类目匹配方法论', en: "Matching celebrity persona with product categories" }, duration: '16分钟', type: 'video', status: 'unlocked' },
          { id: 'l2', title: { zh: '客单价与粉丝画像的关联分析', en: 'Correlation analysis: unit price vs fan demographics' }, duration: '14分钟', type: 'reading', status: 'locked' },
          { id: 'l3', title: { zh: '禁忌品类清单与合规备案要求', en: 'Prohibited product categories & compliance requirements' }, duration: '10分钟', type: 'reading', status: 'locked' },
        ],
      },
      {
        id: 'c2', title: { zh: '第二章：爆款脚本创作技巧', en: 'Ch2: High-Converting Script Writing' },
        lessons: [
          { id: 'l4', title: { zh: '3-7-15秒短视频脚本黄金结构', en: '3-7-15 second short video golden script structure' }, duration: '20分钟', type: 'video', status: 'locked' },
          { id: 'l5', title: { zh: '明星专属话术：人设语气保持技巧', en: "Maintaining celebrity persona in scripts" }, duration: '18分钟', type: 'practice', status: 'locked' },
          { id: 'l6', title: { zh: '禁止使用的广告词汇红线清单', en: 'Red-line advertising terms forbidden in scripts' }, duration: '12分钟', type: 'reading', status: 'locked' },
        ],
      },
      {
        id: 'c3', title: { zh: '第三章：数据复盘与优化', en: 'Ch3: Data Review & Optimization' },
        lessons: [
          { id: 'l7', title: { zh: 'GMV关键指标：转化率 · 客单 · ROI', en: 'Key GMV metrics: conversion · AOV · ROI' }, duration: '15分钟', type: 'video', status: 'locked' },
          { id: 'l8', title: { zh: 'A/B测试：标题 · 封面 · 挂车时机', en: 'A/B testing: title · thumbnail · cart timing' }, duration: '13分钟', type: 'practice', status: 'locked' },
        ],
      },
      {
        id: 'c4', title: { zh: '第四章：高GMV账号运营策略', en: 'Ch4: High-GMV Account Strategy' },
        lessons: [
          { id: 'l9', title: { zh: '矩阵账号协同发布的流量策略', en: 'Traffic strategy for coordinated matrix account publishing' }, duration: '17分钟', type: 'video', status: 'locked' },
          { id: 'l10', title: { zh: '直播间带货与短视频引流联动', en: 'Synergy between live streaming commerce & short video traffic' }, duration: '19分钟', type: 'video', status: 'locked' },
        ],
      },
    ],
    exam: [
      {
        id: 'q1',
        question: { zh: '在带货脚本中，下列哪个表述属于"广告词汇红线"，需要避免使用？', en: 'Which expression is a "red line" forbidden term in commerce scripts?' },
        options: [
          { zh: '"限时特惠，数量有限"', en: '"Limited time offer, while supplies last"' },
          { zh: '"使用后可治愈多种慢性疾病"', en: '"Can cure multiple chronic diseases after use"' },
          { zh: '"明星同款，品质保证"', en: '"Celebrity\'s favorite, quality guaranteed"' },
          { zh: '"顾客好评率98%"', en: '"98% customer satisfaction rate"' },
        ],
        correct: 1,
        explanation: { zh: '"治愈疾病"属于绝对化医疗功效声称，违反广告法，是最典型的红线词汇。', en: '"Cure diseases" is an absolute medical efficacy claim that violates advertising law.' },
      },
      {
        id: 'q2',
        question: { zh: '短视频"黄金7秒"理论是指？', en: 'The "Golden 7 Seconds" theory refers to?' },
        options: [
          { zh: '视频前7秒需要展示价格和折扣信息', en: 'The first 7 seconds should display price and discount info' },
          { zh: '视频第7秒时放置购物车按钮效果最佳', en: 'Cart button placement at second 7 has the best effect' },
          { zh: '前7秒必须完成钩子设置（痛点/悬念/好奇）以留住用户', en: 'First 7 seconds must set a hook (pain point/suspense/curiosity) to retain viewers' },
          { zh: '7秒以上的视频才有资格参与平台流量扶持', en: 'Only videos over 7 seconds qualify for platform traffic support' },
        ],
        correct: 2,
        explanation: { zh: '黄金7秒指用钩子策略（痛点共鸣、悬念设置、好奇心激发）在开头7秒内留住用户，是转化率的关键决定因素。', en: 'The Golden 7 Seconds means using hook strategies in the opening 7 seconds to retain viewers, a key determinant of conversion.' },
      },
      {
        id: 'q3',
        question: { zh: '矩阵账号协同带货时，最优的发布节奏是？', en: 'What is the optimal publishing rhythm for coordinated matrix accounts?' },
        options: [
          { zh: '所有账号同时发布，最大化曝光', en: 'All accounts post simultaneously for maximum exposure' },
          { zh: '错峰发布，每隔2-4小时阶梯式发布，制造持续流量', en: 'Staggered posting every 2-4 hours in a cascading pattern for sustained traffic' },
          { zh: '先由粉丝最多的账号发，再由小账号跟进', en: 'Largest account posts first, smaller accounts follow up' },
          { zh: '随机发布即可，平台算法自动优化', en: 'Random posting is fine, the platform algorithm auto-optimizes' },
        ],
        correct: 1,
        explanation: { zh: '错峰2-4小时阶梯发布能制造持续话题热度，避免平台将相似内容判定为重复降权，同时实现全天候流量覆盖。', en: 'Staggered posting every 2-4 hours maintains sustained momentum and avoids duplicate content penalties while achieving all-day coverage.' },
      },
      {
        id: 'q4',
        question: { zh: '带货内容中"明星人设一致性"最重要的原因是？', en: 'Why is "celebrity persona consistency" most critical in commerce content?' },
        options: [
          { zh: '避免明星方提出版权异议', en: 'Avoids copyright objections from the celebrity party' },
          { zh: '人设崩塌会导致粉丝信任损失，直接影响转化率和复购率', en: 'Persona collapse destroys fan trust, directly impacting conversion and repeat purchase rates' },
          { zh: '平台会对人设不一致的内容进行流量限制', en: 'Platforms restrict traffic for persona-inconsistent content' },
          { zh: '这是合同的硬性要求', en: 'This is a hard contractual requirement' },
        ],
        correct: 1,
        explanation: { zh: '粉丝购买决策很大程度上基于对明星人设的信任。人设一致的内容能强化"明星背书"效应，提高转化率和品牌忠诚度。', en: "Fan purchasing decisions are largely based on trust in the celebrity's persona. Persona consistency reinforces the endorsement effect." },
      },
      {
        id: 'q5',
        question: { zh: '以下哪个GMV优化指标应该最优先关注？', en: 'Which GMV optimization metric should receive the highest priority?' },
        options: [
          { zh: '视频播放量', en: 'Video view count' },
          { zh: '点击商品详情页的CTR（点击率）', en: 'Product detail page CTR (click-through rate)' },
          { zh: '加购转化率（看→加购→下单的漏斗转化）', en: 'Add-to-cart conversion rate (view → cart → purchase funnel)' },
          { zh: '粉丝增长数量', en: 'Follower growth count' },
        ],
        correct: 2,
        explanation: { zh: '加购转化率代表完整购买漏斗的效率，直接决定GMV产出，是最核心的优化指标。播放量和粉丝增长是虚荣指标。', en: 'Add-to-cart conversion represents the full purchase funnel efficiency and directly determines GMV — it\'s the core metric to optimize.' },
      },
      {
        id: 'q6',
        question: { zh: '明星带货选品时，哪类商品需要额外合规备案？', en: 'Which product category requires additional compliance registration for celebrity promotions?' },
        options: [
          { zh: '服装鞋包类', en: 'Clothing and accessories' },
          { zh: '食品（特别是有健康声称的）和保健品', en: 'Food (especially with health claims) and health supplements' },
          { zh: '数码电子产品', en: 'Digital electronics' },
          { zh: '家居装饰品', en: 'Home decorations' },
        ],
        correct: 1,
        explanation: { zh: '食品（尤其有健康功效声称的）和保健品受《食品安全法》《广告法》双重监管，明星代言必须提供产品资质证明并备案审查。', en: 'Food with health claims and supplements are dual-regulated; celebrity endorsements require product qualification certificates and compliance registration.' },
      },
    ],
  },

  {
    level: 'ai',
    name: { zh: 'AI创作认证', en: 'AI Creation Cert' },
    icon: 'SPK',
    price: 1980,
    duration: '约 6 小时',
    color: 'text-amber-400',
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/25',
    glow: 'rgba(245,158,11,0.22)',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    reward: {
      authTier: 'pro',
      authMonths: 2,
      starCoins: 1000,
      zoneBadge: { zh: '红区AI创作资格', en: 'Red Zone AI License', color: 'text-red-400' },
    },
    tagline: { zh: '解锁AI声音·形象·视频全链路创作能力，开启红区权限', en: 'Unlock full AI voice · avatar · video creation pipeline with Red Zone access' },
    chapters: [
      {
        id: 'c1', title: { zh: '第一章：AI工具体系全览', en: 'Ch1: AI Tool Ecosystem Overview' },
        lessons: [
          { id: 'l1', title: { zh: '平台AI工具矩阵：脚本·配音·形象·视频', en: 'Platform AI tools: script · voice · avatar · video' }, duration: '15分钟', type: 'video', status: 'unlocked' },
          { id: 'l2', title: { zh: '星币算力体系：如何合理规划使用预算', en: 'Star coin compute system: planning your budget' }, duration: '10分钟', type: 'reading', status: 'locked' },
          { id: 'l3', title: { zh: 'AI工具与人工创作的协同工作流', en: 'AI tools + human creation collaborative workflow' }, duration: '14分钟', type: 'video', status: 'locked' },
        ],
      },
      {
        id: 'c2', title: { zh: '第二章：AI声音与形象创作规范', en: 'Ch2: AI Voice & Avatar Creation Rules' },
        lessons: [
          { id: 'l4', title: { zh: 'AI声音授权包的使用边界与许可范围', en: 'AI voice authorization scope and usage boundaries' }, duration: '18分钟', type: 'video', status: 'locked' },
          { id: 'l5', title: { zh: 'AI形象生成：官方素材的合规使用方式', en: 'AI avatar generation: compliant use of official materials' }, duration: '20分钟', type: 'video', status: 'locked' },
          { id: 'l6', title: { zh: 'AI内容的版权归属与平台规则', en: 'Copyright ownership of AI content and platform rules' }, duration: '13分钟', type: 'reading', status: 'locked' },
        ],
      },
      {
        id: 'c3', title: { zh: '第三章：AI内容合规深度解析', en: 'Ch3: AI Content Compliance In Depth' },
        lessons: [
          { id: 'l7', title: { zh: 'AI生成内容的强制标注要求', en: 'Mandatory labeling requirements for AI-generated content' }, duration: '12分钟', type: 'reading', status: 'locked' },
          { id: 'l8', title: { zh: 'Deepfake边界：哪些场景绝对禁止', en: 'Deepfake boundaries: absolutely prohibited scenarios' }, duration: '16分钟', type: 'video', status: 'locked' },
        ],
      },
      {
        id: 'c4', title: { zh: '第四章：高效AI创作工作流实战', en: 'Ch4: High-Efficiency AI Creation Workflow' },
        lessons: [
          { id: 'l9', title: { zh: '一键生成到审核发布的全链路操作', en: 'Full pipeline: one-click generation to review and publish' }, duration: '22分钟', type: 'practice', status: 'locked' },
          { id: 'l10', title: { zh: '批量生成与差异化分发策略', en: 'Batch generation and differentiated distribution strategy' }, duration: '19分钟', type: 'practice', status: 'locked' },
        ],
      },
    ],
    exam: [
      {
        id: 'q1',
        question: { zh: '使用AI生成含明星声音的商业推广内容，必须满足哪个前提条件？', en: 'What is the prerequisite for using AI to generate commercial content featuring a celebrity\'s voice?' },
        options: [
          { zh: '账号粉丝数超过10万', en: 'Account has more than 100,000 followers' },
          { zh: '已购买「AI声音授权包」专项许可', en: "Purchased the dedicated 'AI Voice Authorization Package'" },
          { zh: '已完成基础合规认证', en: 'Completed the Basic Compliance Certification' },
          { zh: '使用Pro套餐及以上', en: 'Using the Pro package or above' },
        ],
        correct: 1,
        explanation: { zh: 'AI声音创作属于红区，必须单独购买「AI声音授权包」，这与套餐等级无关，是专项许可。', en: 'AI voice creation is Red Zone and requires separately purchasing the AI Voice Authorization Package, independent of subscription tier.' },
      },
      {
        id: 'q2',
        question: { zh: '根据中国《互联网信息服务深度合成管理规定》，AI生成内容必须如何标注？', en: 'Under China\'s "Deep Synthesis Management Regulations", how must AI-generated content be labeled?' },
        options: [
          { zh: '无需标注，平台自动识别', en: 'No labeling required, platform auto-identifies' },
          { zh: '只需在发布平台后台备注即可', en: 'Only needs a note in the backend of the publishing platform' },
          { zh: '需在内容中显著添加"AI生成"或类似标识，告知受众', en: 'Must prominently add "AI-generated" or similar labels visible to audiences' },
          { zh: '仅视频结尾添加字幕说明即可', en: 'Only needs a caption note at the end of the video' },
        ],
        correct: 2,
        explanation: { zh: '《深度合成管理规定》要求AI生成内容在显著位置标注，且标注需对受众清晰可见，违规将面临处罚。', en: 'The Deep Synthesis Regulations require prominent, audience-visible labeling of AI-generated content, with penalties for violations.' },
      },
      {
        id: 'q3',
        question: { zh: '以下哪种AI使用场景属于绝对禁区（Deepfake禁区）？', en: 'Which AI usage scenario falls in the absolutely forbidden Deepfake zone?' },
        options: [
          { zh: '用AI为明星官方视频添加商品介绍字幕', en: "Using AI to add product subtitle captions to a celebrity's official video" },
          { zh: '使用AI声音包生成官方授权的带货话术', en: 'Using the AI voice pack to generate officially authorized commerce scripts' },
          { zh: '伪造明星参与政治事件或发表争议言论', en: 'Fabricating the celebrity participating in political events or making controversial statements' },
          { zh: '用AI生成明星卡通形象用于商品封面', en: "Using AI to generate a cartoon version of the celebrity's image for product covers" },
        ],
        correct: 2,
        explanation: { zh: '伪造明星政治立场或争议言论是最严重的禁区行为，不仅违反合同，还可能构成名誉侵权和虚假信息传播罪。', en: "Fabricating a celebrity's political stance or controversial statements is the most severe forbidden action, constituting defamation and misinformation." },
      },
      {
        id: 'q4',
        question: { zh: '在星币算力规划时，哪种方式最节省成本？', en: 'Which approach is most cost-efficient in star coin budget planning?' },
        options: [
          { zh: '每次需要时单独充值100元小包', en: 'Top up ¥100 in small batches each time you need coins' },
          { zh: '先用AI生成多个版本，再筛选最优一个发布', en: 'Use AI to generate multiple versions first, then select the best one to publish' },
          { zh: '月初大额充值获得赠币，批量生成素材后复用剪辑', en: 'Large top-up at month start for bonus coins, batch-generate then reuse clips through editing' },
          { zh: '只使用脚本功能，其他AI功能不用', en: 'Only use the script function, skip other AI features' },
        ],
        correct: 2,
        explanation: { zh: '月初大额充值（¥1000+）获得20%赠币，再通过批量生成+切片复用的方式，可将单次内容成本降低60-70%。', en: 'Large monthly top-ups (¥1000+) earn 20% bonus coins, and batch generation + clip reuse reduces per-content cost by 60-70%.' },
      },
      {
        id: 'q5',
        question: { zh: 'AI形象视频中，以下哪个使用场景在获得专项授权后是被允许的？', en: 'Which AI avatar video usage is permitted after obtaining specific authorization?' },
        options: [
          { zh: '用明星形象为竞争对手的品牌做代言', en: "Using the celebrity's likeness to endorse a competing brand" },
          { zh: '在官方商品页面生成明星推荐场景视频', en: "Generating celebrity recommendation scene videos for official product pages" },
          { zh: '制作明星的政治类表态内容', en: "Creating content showing the celebrity's political stance" },
          { zh: '未经授权修改明星外貌特征', en: "Modifying the celebrity's appearance without authorization" },
        ],
        correct: 1,
        explanation: { zh: '官方商品页面的明星推荐场景视频属于「红区+专项授权」可解锁的典型用途，需在AI创作工坊通过合规流程生成。', en: 'Celebrity recommendation videos for official product pages are a typical Red Zone + special authorization use case, generated through the compliance workflow in AI Creation Studio.' },
      },
      {
        id: 'q6',
        question: { zh: 'AI生成内容的版权归属，以下说法正确的是？', en: 'Regarding copyright ownership of AI-generated content, which statement is correct?' },
        options: [
          { zh: 'AI生成内容版权归AI工具厂商所有', en: 'AI-generated content copyright belongs to the AI tool vendor' },
          { zh: '完全由用户输入生成的内容版权归用户', en: 'Content fully generated from user prompts belongs to the user' },
          { zh: '含明星形象的AI内容，形象权益归明星方，创意组合权益归MCN', en: "For AI content containing celebrity likenesses, image rights belong to the celebrity; creative combination rights belong to the MCN" },
          { zh: 'AI生成内容不受版权法保护', en: 'AI-generated content is not protected by copyright law' },
        ],
        correct: 2,
        explanation: { zh: '含明星形象的AI内容存在双层权益：明星的肖像权/声音权归明星方，MCN在授权范围内的创意表达享有组合版权。两者均需在合同中明确约定。', en: "AI content with celebrity likenesses has dual rights: the celebrity's image/voice rights belong to them; the MCN's creative expression within the authorized scope enjoys compilation copyright." },
      },
    ],
  },
];

// ─── Lesson Type Icon ─────────────────────────────────────────────────────────

const LessonTypeIcon = ({ type, size = 'sm' }: { type: Lesson['type']; size?: 'sm' | 'md' }) => {
  const cls = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  if (type === 'video') return <Video className={cls} />;
  if (type === 'reading') return <FileText className={cls} />;
  return <Brain className={cls} />;
};

// ─── Certificate Badge ────────────────────────────────────────────────────────

const CertBadge = ({ cert, earned }: { cert: Certificate; earned: boolean }) => (
  <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl overflow-hidden ${cert.bg} border ${cert.border}`}
    style={earned ? { boxShadow: `0 0 20px ${cert.glow}` } : {}}>
    {cert.icon}
    {earned && (
      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-gray-950 flex items-center justify-center">
        <Check className="w-2.5 h-2.5 text-white" />
      </div>
    )}
  </div>
);

// ─── Certificate Card (catalog) ───────────────────────────────────────────────

const CertCard = ({
  cert, progress, purchased, earned, zh,
  onStart, onBuy,
}: {
  cert: Certificate; progress: number; purchased: boolean; earned: boolean; zh: boolean;
  onStart: () => void; onBuy: () => void;
}) => {
  const totalLessons = cert.chapters.reduce((s, c) => s + c.lessons.length, 0);

  return (
    <motion.div whileHover={{ y: -3 }} className={`relative bg-gray-900/60 border ${cert.border} rounded-2xl p-5 flex flex-col gap-4 overflow-hidden`}
      style={earned ? { boxShadow: `0 10px 40px ${cert.glow}` } : {}}>

      {/* Glow bg */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ background: cert.gradientFrom, transform: 'translate(30%, -30%)' }} />

      {/* Earned overlay */}
      {earned && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-400">
          <Trophy className="w-2.5 h-2.5" />{zh ? '已获证' : 'CERTIFIED'}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <CertBadge cert={cert} earned={earned} />
        <div className="flex-1">
          <div className={`text-sm font-bold ${cert.color}`}>{zh ? cert.name.zh : cert.name.en}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{zh ? cert.tagline.zh : cert.tagline.en}</div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[9px] text-gray-600 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{cert.duration}</span>
            <span className="text-[9px] text-gray-600 flex items-center gap-1"><BookOpen className="w-2.5 h-2.5" />{totalLessons}{zh ? '课' : ' lessons'}</span>
          </div>
        </div>
      </div>

      {/* Reward summary */}
      <div className={`${cert.bg} border ${cert.border} rounded-xl p-3 space-y-1.5`}>
        <div className="text-[9px] text-gray-500 uppercase tracking-widest">{zh ? '毕业奖励' : 'GRADUATION REWARDS'}</div>
        <div className="flex flex-wrap gap-2">
          <div className={`flex items-center gap-1 text-[10px] font-semibold ${cert.color}`}>
            <Package className="w-3 h-3" />
            {cert.reward.authMonths}{zh ? '个月' : ' mo'} {cert.reward.authTier === 'lite' ? 'Lite' : 'Pro'} {zh ? '授权' : 'auth'}
          </div>
          {cert.reward.starCoins > 0 && (
            <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-400">
              <Coins className="w-3 h-3" />⬡ {cert.reward.starCoins.toLocaleString()}
            </div>
          )}
          {cert.reward.zoneBadge && (
            <div className={`flex items-center gap-1 text-[10px] font-semibold ${cert.reward.zoneBadge.color}`}>
              <Shield className="w-3 h-3" />{zh ? cert.reward.zoneBadge.zh : cert.reward.zoneBadge.en}
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      {purchased && !earned && (
        <div>
          <div className="flex justify-between text-[9px] mb-1">
            <span className="text-gray-500">{zh ? '学习进度' : 'Progress'}</span>
            <span className={cert.color}>{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full" animate={{ width: `${progress}%` }}
              style={{ background: `linear-gradient(90deg, ${cert.gradientFrom}, ${cert.gradientTo})` }}
              transition={{ duration: 0.6 }} />
          </div>
        </div>
      )}

      {/* Price + CTA */}
      <div className="flex items-center justify-between mt-auto">
        <div>
          <div className="text-xl font-black text-white">¥{cert.price.toLocaleString()}</div>
          <div className="text-[9px] text-gray-600">{zh ? '一次付清，终身有效' : 'One-time · Lifetime access'}</div>
        </div>
        {earned ? (
          <button onClick={onStart}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl ${cert.bg} border ${cert.border} ${cert.color} hover:opacity-80 transition`}>
            <Award className="w-3.5 h-3.5" />{zh ? '查看证书' : 'View Cert'}
          </button>
        ) : purchased ? (
          <button onClick={onStart}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl text-white border-0 hover:opacity-90 transition"
            style={{ background: `linear-gradient(135deg, ${cert.gradientFrom}, ${cert.gradientTo})` }}>
            <Play className="w-3.5 h-3.5" />{progress > 0 ? (zh ? '继续学习' : 'Continue') : (zh ? '开始学习' : 'Start')}
          </button>
        ) : (
          <button onClick={onBuy}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl text-white border-0 hover:opacity-90 transition"
            style={{ background: `linear-gradient(135deg, ${cert.gradientFrom}, ${cert.gradientTo})` }}>
            {zh ? '购买课程' : 'Buy Course'} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ─── Exam Component ───────────────────────────────────────────────────────────

const ExamView = ({
  cert, zh, onComplete, onBack,
}: {
  cert: Certificate; zh: boolean; onComplete: (score: number) => void; onBack: () => void;
}) => {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(cert.exam.length).fill(null));
  const [showResult, setShowResult] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const q = cert.exam[current];
  const selected = answers[current];
  const isLast = current === cert.exam.length - 1;
  const score = Math.round(answers.filter((a, i) => a === cert.exam[i].correct).length / cert.exam.length * 100);
  const passed = score >= 80;

  const handleSelect = (idx: number) => {
    if (confirmed) return;
    setAnswers(prev => { const n = [...prev]; n[current] = idx; return n; });
  };

  const handleConfirm = () => {
    if (selected === null) return;
    setConfirmed(true);
    setShowExplanation(true);
  };

  const handleNext = () => {
    setShowExplanation(false);
    setConfirmed(false);
    if (isLast) {
      setShowResult(true);
    } else {
      setCurrent(c => c + 1);
    }
  };

  if (showResult) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 py-8">
        {passed ? (
          <>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}
              className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-green-400" />
            </motion.div>
            <div className="text-center">
              <div className="text-4xl font-black text-green-400">{score}{zh ? '分' : ' pts'}</div>
              <div className="text-lg font-bold text-white mt-1">{zh ? '恭喜通过结业考试！' : 'Congratulations! Exam Passed!'}</div>
              <div className="text-sm text-gray-500 mt-1">{zh ? `正确率 ${score}%，达到结业标准（80分）` : `${score}% correct — met the 80% graduation requirement`}</div>
            </div>
            <Button onClick={() => onComplete(score)}
              className="h-12 px-8 text-sm border-0 text-white font-bold"
              style={{ background: `linear-gradient(135deg, ${cert.gradientFrom}, ${cert.gradientTo})` }}>
              <Award className="w-4 h-4 mr-2" />{zh ? '领取证书与奖励' : 'Claim Certificate & Rewards'}
            </Button>
          </>
        ) : (
          <>
            <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-red-400">{score}{zh ? '分' : ' pts'}</div>
              <div className="text-lg font-bold text-white mt-1">{zh ? '差一点点，再试一次！' : 'So close! Try again!'}</div>
              <div className="text-sm text-gray-500 mt-1">{zh ? `需要80分才能结业，本次得分${score}分` : `Need 80% to graduate — you scored ${score}%`}</div>
              <div className="text-[11px] text-gray-600 mt-2">{zh ? '建议复习答错的章节后重新作答' : 'Review chapters where you made mistakes before retrying'}</div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack} className="h-10 border-white/15 text-gray-400">
                <ChevronLeft className="w-4 h-4 mr-1" />{zh ? '回到课程' : 'Back to Course'}
              </Button>
              <Button onClick={() => {
                setAnswers(Array(cert.exam.length).fill(null));
                setCurrent(0); setShowResult(false); setConfirmed(false); setShowExplanation(false);
              }} className="h-10 px-6 border-0 text-white"
                style={{ background: `linear-gradient(135deg, ${cert.gradientFrom}, ${cert.gradientTo})` }}>
                <RefreshCw className="w-4 h-4 mr-2" />{zh ? '重新作答' : 'Retake'}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Exam header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition">
          <ChevronLeft className="w-3.5 h-3.5" />{zh ? '返回课程' : 'Back'}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{current + 1} / {cert.exam.length}</span>
          <div className="flex gap-1">
            {cert.exam.map((_, i) => (
              <div key={i} className={`w-5 h-1.5 rounded-full transition ${i < current ? 'bg-green-500' : i === current ? cert.color.replace('text-', 'bg-') : 'bg-white/10'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div key={current} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
          className="space-y-4">
          <div className={`p-4 ${cert.bg} border ${cert.border} rounded-xl`}>
            <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">{zh ? `第 ${current + 1} 题` : `Question ${current + 1}`}</div>
            <div className="text-sm font-semibold text-white leading-relaxed">{zh ? q.question.zh : q.question.en}</div>
          </div>

          <div className="space-y-2">
            {q.options.map((opt, i) => {
              let state: 'default' | 'selected' | 'correct' | 'wrong' = 'default';
              if (confirmed) {
                if (i === q.correct) state = 'correct';
                else if (i === selected) state = 'wrong';
              } else if (selected === i) state = 'selected';

              return (
                <motion.button key={i} onClick={() => handleSelect(i)} whileHover={!confirmed ? { x: 2 } : {}}
                  className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition ${
                    state === 'correct' ? 'border-green-500/50 bg-green-500/10' :
                    state === 'wrong' ? 'border-red-500/40 bg-red-500/8' :
                    state === 'selected' ? `${cert.border} ${cert.bg}` :
                    'border-white/8 bg-white/[0.02] hover:border-white/15'
                  }`}>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5 ${
                    state === 'correct' ? 'border-green-500 bg-green-500 text-white' :
                    state === 'wrong' ? 'border-red-500 bg-red-500 text-white' :
                    state === 'selected' ? `${cert.border} ${cert.color}` :
                    'border-white/20 text-gray-500'
                  }`}>
                    {state === 'correct' ? <Check className="w-2.5 h-2.5" /> : state === 'wrong' ? <X className="w-2.5 h-2.5" /> : ['A', 'B', 'C', 'D'][i]}
                  </div>
                  <span className={`text-xs leading-relaxed ${state === 'correct' ? 'text-green-300' : state === 'wrong' ? 'text-red-300' : state === 'selected' ? 'text-white' : 'text-gray-300'}`}>
                    {zh ? opt.zh : opt.en}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Explanation */}
          <AnimatePresence>
            {showExplanation && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className={`overflow-hidden`}>
                <div className={`p-3.5 rounded-xl border ${selected === q.correct ? 'border-green-500/30 bg-green-500/8' : 'border-amber-500/25 bg-amber-500/6'}`}>
                  <div className={`text-[10px] font-semibold mb-1 flex items-center gap-1.5 ${selected === q.correct ? 'text-green-400' : 'text-amber-400'}`}>
                    <Info className="w-3 h-3" />{zh ? '解析' : 'Explanation'}
                  </div>
                  <div className="text-[11px] text-gray-300 leading-relaxed">{zh ? q.explanation.zh : q.explanation.en}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action button */}
          <div className="flex justify-end">
            {!confirmed ? (
              <Button onClick={handleConfirm} disabled={selected === null}
                className="h-9 px-5 text-xs border-0 text-white"
                style={{ background: `linear-gradient(135deg, ${cert.gradientFrom}, ${cert.gradientTo})` }}>
                {zh ? '确认答案' : 'Confirm'}
              </Button>
            ) : (
              <Button onClick={handleNext}
                className="h-9 px-5 text-xs border-0 text-white"
                style={{ background: `linear-gradient(135deg, ${cert.gradientFrom}, ${cert.gradientTo})` }}>
                {isLast ? (zh ? '查看结果' : 'See Results') : (zh ? '下一题' : 'Next')} <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Certificate Modal ────────────────────────────────────────────────────────

const CertificateModal = ({
  cert, zh, score, onClose,
}: {
  cert: Certificate; zh: boolean; score: number; onClose: () => void;
}) => {
  const today = new Date().toLocaleDateString(zh ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="relative w-full max-w-lg">

        {/* Certificate card */}
        <div className="relative rounded-3xl border-2 overflow-hidden p-8 text-center"
          style={{
            borderColor: cert.gradientFrom,
            background: `linear-gradient(135deg, #0a0a0f, #111118)`,
            boxShadow: `0 0 60px ${cert.glow}, 0 0 120px ${cert.glow.replace('0.2', '0.08')}`,
          }}>

          {/* Corner ornaments */}
          {['top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3'].map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-6 h-6`}>
              <div className="w-full h-full rounded-sm" style={{ border: `1.5px solid ${cert.gradientFrom}40` }} />
            </div>
          ))}

          {/* Glow circle */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-15"
              style={{ background: cert.gradientFrom }} />
          </div>

          {/* Content */}
          <div className="relative z-10 space-y-4">
            <div className="flex justify-center">
              <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 15, delay: 0.2 }}
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl border-2"
                style={{ background: `linear-gradient(135deg, ${cert.gradientFrom}30, ${cert.gradientTo}20)`, borderColor: `${cert.gradientFrom}60` }}>
                {cert.icon}
              </motion.div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-1">AI STAR ECO PLATFORM</div>
              <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', background: `linear-gradient(135deg, ${cert.gradientFrom}, ${cert.gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {zh ? cert.name.zh : cert.name.en}
              </div>
              <div className="text-xs text-gray-500 mt-1">{zh ? '结业证书' : 'Graduation Certificate'}</div>
            </div>

            <div className="text-sm text-gray-300">{zh ? '恭喜完成课程学习并通过结业考核' : 'Congratulations on completing the course and graduation exam'}</div>
            <div className="text-3xl font-black" style={{ color: cert.gradientFrom }}>
              {score}{zh ? '分' : ' pts'}
            </div>
            <div className="text-xs text-gray-600">{today}</div>

            {/* Rewards */}
            <div className="bg-white/[0.03] border rounded-xl p-3 space-y-2" style={{ borderColor: `${cert.gradientFrom}25` }}>
              <div className="text-[9px] uppercase tracking-widest text-gray-600">{zh ? '已解锁奖励' : 'UNLOCKED REWARDS'}</div>
              <div className="flex flex-wrap justify-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: cert.gradientFrom }}>
                  <Package className="w-3.5 h-3.5" />
                  {cert.reward.authMonths}{zh ? '个月' : 'mo'} {cert.reward.authTier === 'lite' ? 'Lite' : 'Pro'} {zh ? '授权' : 'Access'}
                </div>
                {cert.reward.starCoins > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <Coins className="w-3.5 h-3.5" />⬡ +{cert.reward.starCoins.toLocaleString()}
                  </div>
                )}
                {cert.reward.zoneBadge && (
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${cert.reward.zoneBadge.color}`}>
                    <Shield className="w-3.5 h-3.5" />{zh ? cert.reward.zoneBadge.zh : cert.reward.zoneBadge.en}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-white/10 text-gray-400 text-sm hover:border-white/20 hover:text-white transition">
            {zh ? '关闭' : 'Close'}
          </button>
          <button className="flex-1 h-10 rounded-xl text-black text-sm font-bold hover:opacity-90 transition"
            style={{ background: `linear-gradient(135deg, ${cert.gradientFrom}, ${cert.gradientTo})` }}>
            <Sparkles className="w-4 h-4 inline mr-1.5" />{zh ? '分享证书' : 'Share'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Course Detail View ───────────────────────────────────────────────────────

const CourseView = ({
  cert, zh, initialProgress, onBack, onStartExam, onLessonComplete,
}: {
  cert: Certificate; zh: boolean; initialProgress: number;
  onBack: () => void; onStartExam: () => void; onLessonComplete: (lesson: string) => void;
}) => {
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [expandedChapter, setExpandedChapter] = useState<string>('c1');
  const [playingLesson, setPlayingLesson] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const totalLessons = cert.chapters.reduce((s, c) => s + c.lessons.length, 0);
  const progress = Math.round(completedLessons.size / totalLessons * 100);
  const allComplete = completedLessons.size === totalLessons;

  const handlePlayLesson = (lessonId: string) => {
    setPlayingLesson(lessonId);
    setPlaying(true);
    // Simulate lesson completion after 2 seconds
    setTimeout(() => {
      setPlaying(false);
      setCompletedLessons(prev => new Set([...prev, lessonId]));
      onLessonComplete(lessonId);
    }, 2000);
  };

  // Lesson is unlocked if it's the first, or previous lesson is completed
  const isUnlocked = (chapterIdx: number, lessonIdx: number) => {
    if (chapterIdx === 0 && lessonIdx === 0) return true;
    const allLessons = cert.chapters.flatMap(c => c.lessons);
    const currentIdx = cert.chapters.slice(0, chapterIdx).reduce((s, c) => s + c.lessons.length, 0) + lessonIdx;
    if (currentIdx === 0) return true;
    return completedLessons.has(allLessons[currentIdx - 1].id);
  };

  return (
    <div className="space-y-4">
      {/* Back + title */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition">
          <ChevronLeft className="w-3.5 h-3.5" />{zh ? '返回认证列表' : 'Back to Catalog'}
        </button>
        <div className="text-[10px] text-gray-600">{completedLessons.size}/{totalLessons} {zh ? '节完成' : 'completed'}</div>
      </div>

      {/* Course header card */}
      <div className={`relative ${cert.bg} border ${cert.border} rounded-2xl p-5 overflow-hidden`}
        style={{ boxShadow: `0 8px 30px ${cert.glow}` }}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ background: cert.gradientFrom, transform: 'translate(40%, -40%)' }} />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="text-3xl">{cert.icon}</div>
            <div>
              <div className={`text-base font-black ${cert.color}`}>{zh ? cert.name.zh : cert.name.en}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{zh ? cert.tagline.zh : cert.tagline.en}</div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden w-40">
                  <motion.div className="h-full rounded-full" animate={{ width: `${progress}%` }}
                    style={{ background: `linear-gradient(90deg, ${cert.gradientFrom}, ${cert.gradientTo})` }} transition={{ duration: 0.5 }} />
                </div>
                <span className={`text-xs font-bold ${cert.color}`}>{progress}%</span>
              </div>
            </div>
          </div>
          {allComplete && (
            <Button onClick={onStartExam}
              className="h-9 px-4 text-xs border-0 text-white font-bold shrink-0"
              style={{ background: `linear-gradient(135deg, ${cert.gradientFrom}, ${cert.gradientTo})` }}>
              <GraduationCap className="w-3.5 h-3.5 mr-1.5" />{zh ? '参加结业考试' : 'Take Exam'}
            </Button>
          )}
        </div>
      </div>

      {/* Chapters */}
      <div className="space-y-2">
        {cert.chapters.map((chapter, ci) => {
          const chapterCompleted = chapter.lessons.every(l => completedLessons.has(l.id));
          const isExpanded = expandedChapter === chapter.id;

          return (
            <div key={chapter.id} className="bg-gray-900/50 border border-white/[0.06] rounded-xl overflow-hidden">
              <button onClick={() => setExpandedChapter(isExpanded ? '' : chapter.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${chapterCompleted ? 'bg-green-500' : cert.bg}`}>
                  {chapterCompleted ? <Check className="w-3 h-3 text-white" /> : <span className="text-[9px] font-bold text-gray-400">{ci + 1}</span>}
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-xs font-semibold ${chapterCompleted ? 'text-green-300' : 'text-white'}`}>
                    {zh ? chapter.title.zh : chapter.title.en}
                  </div>
                  <div className="text-[9px] text-gray-600">{chapter.lessons.filter(l => completedLessons.has(l.id)).length}/{chapter.lessons.length} {zh ? '节' : 'lessons'}</div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-white/[0.05]">
                      {chapter.lessons.map((lesson, li) => {
                        const unlocked = isUnlocked(ci, li);
                        const completed = completedLessons.has(lesson.id);
                        const isPlaying = playingLesson === lesson.id && playing;

                        return (
                          <motion.div key={lesson.id}
                            className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.03] last:border-0 ${unlocked ? 'hover:bg-white/[0.02]' : 'opacity-50'} transition`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${completed ? 'bg-green-500' : isPlaying ? cert.bg : 'bg-white/5'}`}>
                              {completed ? <Check className="w-3 h-3 text-white" /> :
                               isPlaying ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw className={`w-3 h-3 ${cert.color}`} /></motion.div> :
                               unlocked ? <LessonTypeIcon type={lesson.type} /> : <Lock className="w-3 h-3 text-gray-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-medium truncate ${completed ? 'text-green-300 line-through opacity-60' : isPlaying ? cert.color : 'text-gray-300'}`}>
                                {zh ? lesson.title.zh : lesson.title.en}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-gray-600 flex items-center gap-1">
                                  <LessonTypeIcon type={lesson.type} />{zh ? { video: '视频', reading: '阅读', practice: '实践' }[lesson.type] : lesson.type}
                                </span>
                                <span className="text-[9px] text-gray-600">{lesson.duration}</span>
                              </div>
                            </div>
                            {unlocked && !completed && (
                              <button onClick={() => handlePlayLesson(lesson.id)} disabled={isPlaying}
                                className={`text-[10px] px-2.5 py-1 rounded-lg transition ${cert.color} ${cert.bg} border ${cert.border} hover:opacity-80 disabled:opacity-40 shrink-0`}>
                                {isPlaying ? (zh ? '学习中...' : 'Loading...') : (zh ? '开始' : 'Start')}
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Exam CTA if all done */}
      {allComplete && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`${cert.bg} border ${cert.border} rounded-2xl p-5 flex items-center justify-between gap-4`}
          style={{ boxShadow: `0 8px 30px ${cert.glow}` }}>
          <div>
            <div className={`text-sm font-bold ${cert.color}`}>{zh ? '所有课程已完成！' : 'All lessons complete!'}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{zh ? '参加结业考试（≥80分）即可领取认证证书和授权奖励' : 'Pass the graduation exam (≥80%) to claim your certificate and rewards'}</div>
          </div>
          <Button onClick={onStartExam}
            className="h-10 px-5 text-sm border-0 text-white font-bold shrink-0"
            style={{ background: `linear-gradient(135deg, ${cert.gradientFrom}, ${cert.gradientTo})` }}>
            <GraduationCap className="w-4 h-4 mr-1.5" />{zh ? '参加考试' : 'Take Exam'}
          </Button>
        </motion.div>
      )}
    </div>
  );
};

// ─── Purchase Modal ───────────────────────────────────────────────────────────

const PurchaseModal = ({
  cert, zh, onClose, onConfirm,
}: {
  cert: Certificate; zh: boolean; onClose: () => void; onConfirm: () => void;
}) => {
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const handlePay = () => {
    setPaying(true);
    setTimeout(() => { setPaying(false); setPaid(true); setTimeout(() => { onConfirm(); onClose(); }, 1500); }, 2000);
  };

  const totalLessons = cert.chapters.reduce((s, c) => s + c.lessons.length, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 25 }}
        className="bg-gray-950 border border-white/10 w-full md:max-w-md rounded-t-3xl md:rounded-2xl overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">{zh ? '购买课程' : 'Buy Course'}</h2>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/8 flex items-center justify-center text-gray-500 hover:text-white transition"><X className="w-3.5 h-3.5" /></button>
          </div>

          <div className={`flex items-center gap-4 p-4 ${cert.bg} border ${cert.border} rounded-xl`}>
            <CertBadge cert={cert} earned={false} />
            <div>
              <div className={`text-sm font-bold ${cert.color}`}>{zh ? cert.name.zh : cert.name.en}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{cert.duration} · {totalLessons}{zh ? '节课' : ' lessons'}</div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { icon: <Package className="w-3.5 h-3.5" />, text: zh ? `毕业奖励：${cert.reward.authMonths}个月${cert.reward.authTier === 'lite' ? 'Lite' : 'Pro'}套餐授权（价值¥${cert.reward.authTier === 'lite' ? (1980 * cert.reward.authMonths) : (5800 * cert.reward.authMonths)}）` : `Graduation: ${cert.reward.authMonths} months ${cert.reward.authTier} access`, color: cert.color },
              ...(cert.reward.starCoins > 0 ? [{ icon: <Coins className="w-3.5 h-3.5" />, text: zh ? `赠送星币 ⬡${cert.reward.starCoins.toLocaleString()}` : `⬡${cert.reward.starCoins.toLocaleString()} star coin bonus`, color: 'text-amber-400' }] : []),
              { icon: <BookOpen className="w-3.5 h-3.5" />, text: zh ? '课程内容终身可访问，随时复习' : 'Lifetime access to course materials', color: 'text-gray-400' },
              { icon: <RefreshCw className="w-3.5 h-3.5" />, text: zh ? '不限次数重考，通过即颁发证书' : 'Unlimited exam retakes until you pass', color: 'text-gray-400' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className={item.color}>{item.icon}</span>
                <span className="text-gray-300">{item.text}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
            <div>
              <div className="text-2xl font-black text-white">¥{cert.price.toLocaleString()}</div>
              <div className="text-[9px] text-gray-600">{zh ? '教育培训费 · 一次付清' : 'Education fee · One-time payment'}</div>
            </div>
            <AnimatePresence mode="wait">
              {paid ? (
                <motion.div key="ok" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2 text-green-400 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5" />{zh ? '购买成功！' : 'Success!'}
                </motion.div>
              ) : (
                <Button key="pay" onClick={handlePay} disabled={paying}
                  className="h-10 px-6 text-sm border-0 text-white font-bold"
                  style={{ background: `linear-gradient(135deg, ${cert.gradientFrom}, ${cert.gradientTo})` }}>
                  {paying ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{zh ? '支付中...' : 'Paying...'}</> : (zh ? '立即购买' : 'Buy Now')}
                </Button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const TrainingCenter = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';

  // State per certification level
  const [purchased, setPurchased] = useState<Set<CertLevel>>(new Set(['basic']));
  const [earned, setEarned] = useState<Set<CertLevel>>(new Set());
  const [progress, setProgress] = useState<Record<CertLevel, number>>({ basic: 35, commerce: 0, ai: 0 });
  const [scores, setScores] = useState<Record<CertLevel, number>>({ basic: 0, commerce: 0, ai: 0 });

  const [view, setView] = useState<CourseView>('catalog');
  const [activeCert, setActiveCert] = useState<CertLevel | null>(null);
  const [examMode, setExamMode] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [buyTarget, setBuyTarget] = useState<CertLevel | null>(null);

  const cert = activeCert ? CERTIFICATES.find(c => c.level === activeCert)! : null;

  const handleStartCourse = (level: CertLevel) => {
    setActiveCert(level);
    setView('course');
    setExamMode(false);
  };

  const handleExamComplete = (score: number) => {
    if (!activeCert) return;
    if (score >= 80) {
      setEarned(prev => new Set([...prev, activeCert]));
      setScores(prev => ({ ...prev, [activeCert]: score }));
      setShowCertModal(true);
    }
    setExamMode(false);
    setView('course');
  };

  const handleBuy = (level: CertLevel) => {
    setPurchased(prev => new Set([...prev, level]));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">
              {zh ? '培训认证中心' : 'Training & Certification'}
            </span>
            <GraduationCap className="w-5 h-5 text-purple-400" />
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {zh ? '通过培训结业，用更低成本解锁明星带货授权资质' : 'Graduate from training courses to unlock celebrity commerce authorization at lower cost'}
          </p>
        </div>

        {view !== 'catalog' && (
          <button onClick={() => { setView('catalog'); setActiveCert(null); setExamMode(false); }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition border border-white/8 rounded-lg px-3 py-2 hover:border-white/20">
            <ChevronLeft className="w-3.5 h-3.5" />{zh ? '课程目录' : 'Catalog'}
          </button>
        )}
      </div>

      {/* Value proposition banner */}
      {view === 'catalog' && (
        <div className="bg-gradient-to-r from-purple-500/10 via-cyan-500/8 to-amber-500/8 border border-white/[0.08] rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm font-bold text-white mb-1">
              {zh ? '培训认证 vs 直接购买套餐' : 'Training Cert vs Direct Package'}
            </div>
            <div className="text-[11px] text-gray-400 leading-relaxed">
              {zh ? '培训结业后可获得等额套餐授权（¥980培训 ≈ 获得¥1,980 Lite授权），同时证明您具备合规操作能力，是低成本入门的最优路径。' : 'Graduates receive equivalent package authorization (¥980 training ≈ ¥1,980 Lite access), while proving compliance competency — the best low-cost entry path.'}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { val: '¥980', desc: zh ? '起步价格' : 'Starting price', color: 'text-cyan-400' },
              { val: zh ? '终身' : 'Lifetime', desc: zh ? '课程有效期' : 'Course validity', color: 'text-purple-400' },
              { val: '∞', desc: zh ? '可重复考试' : 'Exam retakes', color: 'text-amber-400' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
                <div className="text-[9px] text-gray-600">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress stats */}
      {view === 'catalog' && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: zh ? '已购课程' : 'Purchased', val: purchased.size, color: 'text-cyan-400', bg: 'bg-cyan-500/8', border: 'border-cyan-500/20' },
            { label: zh ? '已获认证' : 'Certified', val: earned.size, color: 'text-green-400', bg: 'bg-green-500/8', border: 'border-green-500/20' },
            { label: zh ? '解锁权限' : 'Unlocked', val: earned.size * 1, color: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/20' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} border ${s.border} rounded-xl p-3 text-center`}>
              <div className={`text-2xl font-black ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <AnimatePresence mode="wait">
        {view === 'catalog' && (
          <motion.div key="catalog" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="grid md:grid-cols-3 gap-4">
            {CERTIFICATES.map(c => (
              <CertCard key={c.level} cert={c}
                progress={progress[c.level]}
                purchased={purchased.has(c.level)}
                earned={earned.has(c.level)}
                zh={zh}
                onStart={() => handleStartCourse(c.level)}
                onBuy={() => setBuyTarget(c.level)}
              />
            ))}
          </motion.div>
        )}

        {view === 'course' && cert && !examMode && (
          <motion.div key="course" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <CourseView cert={cert} zh={zh} initialProgress={progress[cert.level]}
              onBack={() => setView('catalog')}
              onStartExam={() => setExamMode(true)}
              onLessonComplete={(lessonId) => {
                const totalLessons = cert.chapters.reduce((s, c) => s + c.lessons.length, 0);
                setProgress(prev => ({
                  ...prev,
                  [cert.level]: Math.min(100, prev[cert.level] + Math.round(100 / totalLessons)),
                }));
              }}
            />
          </motion.div>
        )}

        {view === 'course' && cert && examMode && (
          <motion.div key="exam" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-gray-900/50 border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.06]">
                <div className="text-2xl">{cert.icon}</div>
                <div>
                  <div className={`text-sm font-bold ${cert.color}`}>{zh ? cert.name.zh : cert.name.en} · {zh ? '结业考试' : 'Graduation Exam'}</div>
                  <div className="text-[10px] text-gray-500">{zh ? `共${cert.exam.length}题，≥80分通过` : `${cert.exam.length} questions, pass at ≥80%`}</div>
                </div>
              </div>
              <ExamView cert={cert} zh={zh} onComplete={handleExamComplete} onBack={() => setExamMode(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Modal */}
      <AnimatePresence>
        {buyTarget && (
          <PurchaseModal
            cert={CERTIFICATES.find(c => c.level === buyTarget)!}
            zh={zh}
            onClose={() => setBuyTarget(null)}
            onConfirm={() => { handleBuy(buyTarget); setBuyTarget(null); }}
          />
        )}
      </AnimatePresence>

      {/* Certificate Modal */}
      <AnimatePresence>
        {showCertModal && cert && (
          <CertificateModal
            cert={cert}
            zh={zh}
            score={scores[cert.level]}
            onClose={() => setShowCertModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrainingCenter;
