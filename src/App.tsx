import React, { useState, useEffect, useRef } from 'react';
import { 
  Music2, Mic2, Users, Award, Share2, TrendingUp, Sparkles, 
  Play, Pause, Rocket, Zap, CheckCircle2, Lock, ArrowRight,
  LayoutDashboard, Disc, Wallet, Settings, Menu, X, Plus,
  MessageSquare, Video, Globe, ChevronRight, Edit3, Wand2,
  Headphones, Heart, ShoppingBag, UserCircle, LogOut, ChevronDown,
  BarChart3, Globe2, Fingerprint, Coins, Flame, Crown, SkipForward, SkipBack, Search, Home as HomeIcon, Library,
  Cpu, Layers, Radio, MoveRight, Globe as GlobeIcon, ArrowLeft,
  Scissors, Copy, Trash2, PlayCircle, Music, Type, GripHorizontal, Disc3, Activity, Upload, Mic, Volume2, Wind, Loader2, Square, Youtube, ShieldCheck, Smile, FileText, UploadCloud, Check, RefreshCw
} from 'lucide-react';
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Progress } from "./components/ui/progress";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Switch } from "./components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValue, useMotionTemplate } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import DistributionPage from "./components/DistributionPage";
import ArtistSigningDialog from "./components/ArtistSigningDialog";
import ArtistDetailDialog from "./components/ArtistDetailDialog";
import ArtistListingDialog from "./components/ArtistListingDialog";
import OnboardingGuide from "./components/OnboardingGuide";
import MusicGenerationDialog from "./components/MusicGenerationDialog";
import NFTMintingDialog from "./components/NFTMintingDialog";
import { ThemeProvider, useTheme, themeConfig } from "./components/ThemeProvider";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { AIIncubator } from "./components/AIIncubator";

// --- Types & Translation Data ---
type Lang = 'zh' | 'en';

const TRANSLATIONS = {
  zh: {
    nav: { features: "核心功能", showcase: "孵化案例", ecosystem: "生态流程", about: "关于我们", enter: "进入控制台" },
    hero: {
      badge: "AI 音乐操作系统 v2.0 Live",
      title1: "挑战现实。",
      title2: "定义你的偶像。",
      desc: "AI Star Eco 是全球首��去中心化虚拟艺人孵化网络。我们打破了传统经纪公司的围墙，将 AIGC 工具、区块链确权与粉丝经济完美融合。",
      cta_primary: "开始构建生态",
      cta_secondary: "观看概念片",
      stats_creators: "50k+ 创作者",
      stats_songs: "120万+ 生成歌曲"
    },
    workflow: {
      tag: "闭环生态",
      title: "不仅仅是工具，更是一个自运行经济体。",
      desc: "传统的音乐产业是线性的、封闭的。而我们构建了一个网状的价值网络。在这里，粉丝的每一次互动都���转化为制作人的收益。",
      steps: [
        { title: "创造 (Create)", desc: "利用 LLM 生成丰富的人设背景，结合 AI 音乐引擎批量产出高质量单曲。" },
        { title: "发行 (Distribute)", desc: "一键分发至全球流媒体。自动生成短视频切片，通过算法引爆流量。" },
        { title: "变现 (Monetize)", desc: "通过铸造限量电子勋章（Badge）和虚拟周边，深度挖掘粉丝经济价值。" }
      ]
    },
    features: {
      saas_title: "Super-SaaS 工作台",
      saas_desc: "我们将几十种 AI 工具集成在一个控制面板中。告别在不同网页间切换的繁琐，体验流心般的创作快感。",
      assets_title: "资产上链",
      assets_desc: "每一首歌、每一个勋章都拥有独一无二的数字指纹。",
      dao_title: "粉丝 DAO",
      dao_desc: "让粉丝���与决策���共同决定艺人的下一次巡演与专辑风格。"
    },
    portal: {
      fan_title: "星际听众",
      fan_desc: "探索无限音乐宇宙，为你热爱的声音打榜，收藏独一无二的数字资产。",
      fan_btn: "进入秀场",
      maker_title: "造梦架构师",
      maker_desc: "掌握 AI 之力，从零孵化虚拟偶像。创作、发行、变现，一人即是一个帝国。",
      maker_btn: "开始创作",
      coach_title: "生态领航员",
      coach_desc: "发掘明日之星，管理学员数据。从每一次成功孵化中获取生态分润。",
      coach_btn: "管理后台"
    },
    fan: {
      title: "星际金曲榜",
      market_title: "限量勋章市场",
      discovery: "发现",
      charts: "榜单",
      market: "市场",
      me: "我的",
      vote: "投票",
      mint: "铸造",
      remaining: "剩余",
      guess_like: "猜你喜欢"
    },
    producer: {
      sidebar: {
         dashboard: "经纪大盘 (Dashboard)",
         mcn: "MCN与孵化 (Incubation)",
         incubator: "AI歌手孵化 (Persona)",
         wardrobe: "造型与道具库 (Styling)",
         production: "创作与确权 (Creation)",
         studio: "音乐与MV工坊 (Studio)",
         copyright: "版权与链上资产 (Copyright)",
         growth: "发行与运营 (Distribution)",
         dist: "全网矩阵分发 (Matrix)",
         community: "粉丝社群 (Community)",
         finance: "商业变现 (Monetization)",
         logout: "退出登录 (Logout)",
         switch: "切换艺人 (Switch Project)",
         new_project: "孵化新歌手 (New Project)"
      },
      overview: {
         welcome: "你好，制作人。",
         subtitle: "这是今天的数据概览。",
         eco_value: "生态估值",
         rev: "预估版税",
         holders: "勋章持有",
         streams: "总播放量",
         fans: "全网粉丝",
         chart_title: "收入与互动趋势",
         tasks_title: "建议行动",
         tasks_desc: "AI 增长建议",
         tasks: [
            { t: "铸造 '夏日' 勋章", d: "粉丝正在请求新的收藏品。" },
            { t: "回复 Alex 教练", d: "关于新歌的反馈待处理。" },
            { t: "优化元数据", d: "Track #03 缺少流派标签。" }
         ]
      },
      earnings: {
         title: "财务中心",
         balance: "可用余���",
         withdraw: "提现资产",
         source_title: "收入构成",
         history_title: "交易记录",
         source_stream: "流媒体版税",
         source_nft: "NFT 销售",
         source_tips: "粉丝打赏",
         col_date: "日期",
         col_desc: "摘要",
         col_amount: "金额",
         col_status: "状态"
      },
      persona: {
         title: "人设引擎",
         desc: "微调性格参数。大模型将自动生成背景故事、说话风格和视觉指令。",
         sweet: "甜美度",
         energy: "活力值",
         mystery: "神秘感",
         keywords: "核心关键词",
         regen: "重生成人设",
         bio_title: "生成小传",
         modes: {
            text: "参数/文本",
            img: "图生人设",
            hybrid: "基因杂交"
         },
         labels: {
            upload_ref: "上传参考图",
            upload_parents: "上传父本/母本 (A/B)",
            mix_ratio: "基因混合比例",
            neg_prompt: "反向提示词 (排除效果)",
            adv_settings: "高级调优",
            text_prompt: "详细外观描述"
         }
      },
      studio: {
         title: "AI 录音棚",
         track_title: "歌曲标题",
         prompt_label: "风格/流派提示词",
         lyrics_label: "歌词/故事背景 (可选)",
         btn_gen: "生成歌曲 (消耗5点)",
         btn_generating: "正在生成...",
         library: "作品库",
         tabs: { text: "文本模式", melody: "旋律模式", advanced: "进阶模式", interactive: "互动写歌", lyrics: "歌词成歌", inspiration: "灵感写歌", image: "图片成歌", remix: "热歌爆改", fun: "趣味写歌", acrostic: "藏头歌", gift: "送Ta歌" },
         upload_melody: "上传旋律片段",
         describe_style: "描述风格 (例如: Synth-pop)...",
         song_structure: "歌曲结构",
         bpm: "BPM (节拍)",
         key: "调性 (Key)",
         interactive_prompt: "AI 制���人：今天��做点什么感觉的音乐？告诉我你的想法...",
         type_answer: "输入你的想法...",
         lyrics_input: "在此粘贴你的歌词...",
         music_style: "音乐风格 (如 Pop, Rock, R&B...)",
         idea_input: "例如：一个赛博朋克武士爱上了自动售货机...",
         feeling_lucky: "手气不错",
         upload_image: "上传图片生成配乐",
         extra_context: "附加风格提示 (可选)",
         original_song: "原曲链接或名称",
         remix_target: "例如：爆改成赛博朋克合成器波...",
         theme: "趣味主题",
         core_phrase: "核心歌词",
         acrostic_hidden: "藏���词 (最多8个字)",
         acrostic_topic: "歌曲主题 (如 浪漫，自然...)",
         gift_to: "送给谁",
         gift_occasion: "场合",
         gift_message: "你想对TA说什么？"
      },
      mint: {
         title: "资产铸造",
         desc: "为粉丝创建数字收藏品。每个勋章都是独一无二且可交易的。",
         name_label: "勋章名称",
         upload_label: "上传封面",
         upload_text: "拖拽或点击上传",
         supply: "发行量",
         price: "价格 (¥)",
         perks: "权益与赋能",
         perk_audio: "无损音源下载",
         perk_discord: "私密社群权限",
         btn_mint: "铸造发行",
         preview: "效果预览",
         active: "活跃系列"
      },
      locked: {
         title: "模块未解锁",
         desc: "升级到企业版以访问此功能。",
         back: "返回总览"
      },
      editor: {
         title: "高级剪辑工作台",
         mode_audio: "音乐制作",
         mode_video: "MV 剪辑",
         track_vocal: "人声轨道",
         track_melody: "伴奏轨道",
         track_lyrics: "歌词轨道",
         track_video: "视频轨道",
         track_fx: "特效轨道",
         btn_play: "播放",
         btn_pause: "暂停",
         btn_split: "分割",
         btn_delete: "删除",
         btn_export: "定稿导出",
         btn_finalize: "应用修改",
         prompt_lyrics: "双击修改歌词区块...",
         prompt_fx: "拖拽添加滤镜/转场",
         status_draft: "草稿模式 - 实时预览",
         msg_saved: "修改已保存并同步至云端。"
      }
    },
    coach: {
       sidebar: {
          cmd: "指挥中心",
          trainees: "学员管理",
          msg: "消息",
          settings: "设置",
          logout: "退出"
       },
       header: {
          region: "亚太区节点",
          value: "生态总价值"
       },
       monitor: {
          title: "小队监控",
          desc: "实时追踪活跃制作人的表现。",
          filter: "筛选",
          new_task: "下发任务",
          kpi_songs: "本周新歌",
          kpi_rate: "成功率",
          kpi_review: "待批改"
       },
       table: {
          producer: "制作人",
          status: "状态",
          progress: "周进度",
          rev: "营收",
          action: "操作"
       },
       detail: {
          msg: "发消息",
          profile: "档案",
          latest: "最新提交",
          submitted: "提交于",
          approve: "通过",
          reject: "驳回",
          radar: "能力雷达",
          close: "关闭面板"
       }
    }
  },
  en: {
    nav: { features: "Features", showcase: "Showcase", ecosystem: "Workflow", about: "About", enter: "Console" },
    hero: {
      badge: "AI Music OS v2.0 Live",
      title1: "Defy Reality.",
      title2: "Define Your Idol.",
      desc: "AI Star Eco is the world's first decentralized virtual idol incubation network. We merge AIGC tools, blockchain ownership, and fan economy into one seamless ecosystem.",
      cta_primary: "Start Building",
      cta_secondary: "Watch Demo",
      stats_creators: "50k+ Creators",
      stats_songs: "1.2M+ Generated Songs"
    },
    workflow: {
      tag: "Ecosystem",
      title: "Not just a tool, but a self-running economy.",
      desc: "Traditional music industry is linear and closed. We built a meshed value network where every fan interaction translates into producer revenue.",
      steps: [
        { title: "Create", desc: "Use LLM to generate rich personas and AI music engines to mass-produce high-quality tracks." },
        { title: "Distribute", desc: "One-click distribution to global DSPs. Auto-generate viral short videos via algorithms." },
        { title: "Monetize", desc: "Mint limited NFT badges and virtual merch to deeply mine fan economy value." }
      ]
    },
    features: {
      saas_title: "Super-SaaS Workspace",
      saas_desc: "We integrated dozens of AI tools into one dashboard. Say goodbye to switching tabs.",
      assets_title: "On-Chain Assets",
      assets_desc: "Every song and badge has a unique digital fingerprint.",
      dao_title: "Fan DAO",
      dao_desc: "Let fans participate in decisions, voting on tours and album styles."
    },
    portal: {
      fan_title: "Fan",
      fan_desc: "Explore the infinite music universe, vote for your favorite sounds, and collect unique digital assets.",
      fan_btn: "Enter Show",
      maker_title: "Maker",
      maker_desc: "Master AI power to incubate virtual idols from scratch. Create, Distribute, Monetize.",
      maker_btn: "Start Creating",
      coach_title: "Coach",
      coach_desc: "Discover tomorrow's stars, manage trainee data, and earn eco-dividends from success.",
      coach_btn: "Coach Hub"
    },
    fan: {
      title: "Star Charts",
      market_title: "Badge Market",
      discovery: "Discover",
      charts: "Charts",
      market: "Market",
      me: "Me",
      vote: "Vote",
      mint: "Mint",
      remaining: "Left",
      guess_like: "You Might Like"
    },
    producer: {
      sidebar: {
         dashboard: "经纪大盘 (Dashboard)",
         mcn: "MCN与孵化 (Incubation)",
         incubator: "AI歌手孵化 (Persona)",
         wardrobe: "造型与道具库 (Styling)",
         production: "创作与确权 (Creation)",
         studio: "音乐与MV工坊 (Studio)",
         copyright: "版权与链上资产 (Copyright)",
         growth: "发行与运营 (Distribution)",
         dist: "全网矩阵分发 (Matrix)",
         community: "粉丝社群 (Community)",
         finance: "商业变现 (Monetization)",
         logout: "退出登录 (Logout)",
         switch: "切换艺人 (Switch Project)",
         new_project: "孵化新歌手 (New Project)"
      },
      overview: {
         welcome: "Hello, Producer.",
         subtitle: "Here's today's overview.",
         eco_value: "Eco Value",
         rev: "Est. Royalty",
         holders: "Badge Holders",
         streams: "Total Streams",
         fans: "Total Fans",
         chart_title: "Revenue & Engagement",
         tasks_title: "Suggested Actions",
         tasks_desc: "AI Growth Tips",
         tasks: [
            { t: "Mint 'Summer' Badge", d: "Fans are asking for new collectibles." },
            { t: "Reply to Coach Alex", d: "Feedback on 'Neon Rain' is pending." },
            { t: "Optimize Metadata", d: "Missing genre tags for track #03." }
         ]
      },
      earnings: {
         title: "Financial Center",
         balance: "Available Balance",
         withdraw: "Withdraw Funds",
         source_title: "Revenue Sources",
         history_title: "Transaction History",
         source_stream: "Streaming Royalty",
         source_nft: "NFT Sales",
         source_tips: "Fan Tips",
         col_date: "Date",
         col_desc: "Description",
         col_amount: "Amount",
         col_status: "Status"
      },
      persona: {
         title: "Persona Engine",
         desc: "Fine-tune personality parameters. LLM will generate backstory, speech, and visuals.",
         sweet: "Sweetness",
         energy: "Energy",
         mystery: "Mystery",
         keywords: "Core Keywords",
         regen: "Regenerate Identity",
         bio_title: "Generated Bio",
         modes: {
            text: "Text/Params",
            img: "Img2Persona",
            hybrid: "Hybrid/Mix"
         },
         labels: {
            upload_ref: "Reference Image",
            upload_parents: "Parent Sources (A/B)",
            mix_ratio: "Mix Ratio",
            neg_prompt: "Negative Prompt",
            adv_settings: "Fine-tuning",
            text_prompt: "Detailed Description"
         }
      },
      studio: {
         title: "AI Composer",
         track_title: "Track Title",
         prompt_label: "Style / Genre Prompts",
         lyrics_label: "Lyrics Context (Optional)",
         btn_gen: "Generate Track (5 Credits)",
         btn_generating: "Generating...",
         library: "Generated Library",
         tabs: { text: "Text", melody: "Melody", advanced: "Advanced", interactive: "Interactive", lyrics: "Lyrics2Song", inspiration: "Inspiration", image: "Image2Song", remix: "Remix Hit", fun: "Fun Modes", acrostic: "Acrostic", gift: "Gift a Song" },
         upload_melody: "Upload Melody",
         describe_style: "Describe the style (e.g., Synth-pop)...",
         song_structure: "Song Structure",
         bpm: "BPM",
         key: "Key",
         interactive_prompt: "AI Producer: What kind of vibe are you looking for today?",
         type_answer: "Type your answer...",
         lyrics_input: "Paste your lyrics here...",
         music_style: "Music Style (e.g. Pop, Rock, R&B...)",
         idea_input: "e.g. A cyberpunk samurai falling in love with a vending machine...",
         feeling_lucky: "I'm Feeling Lucky",
         upload_image: "Upload an image to generate soundtrack",
         extra_context: "Optional style hints...",
         original_song: "Original Song Name or URL",
         remix_target: "e.g. Turn into Cyberpunk Synthwave",
         theme: "Fun Theme",
         core_phrase: "Core Phrase",
         acrostic_hidden: "Hidden Word (Max 8 chars)",
         acrostic_topic: "Topic (Romance, Nature...)",
         gift_to: "To Who",
         gift_occasion: "Occasion",
         gift_message: "What do you want to say to them?"
      },
      mint: {
         title: "Mint Assets",
         desc: "Create digital collectibles. Each badge is unique and tradable.",
         name_label: "Badge Name",
         upload_label: "Artwork Upload",
         upload_text: "Drag & drop to upload",
         supply: "Supply",
         price: "Price (¥)",
         perks: "Perks & Utilities",
         perk_audio: "Lossless Audio",
         perk_discord: "Private Discord",
         btn_mint: "Mint Collection",
         preview: "Preview",
         active: "Active Collections"
      },
      locked: {
         title: "Module Locked",
         desc: "Upgrade to Enterprise Plan to access this feature.",
         back: "Return to Dashboard"
      },
      editor: {
         title: "Advanced NLE Studio",
         mode_audio: "Audio Edit",
         mode_video: "MV Edit",
         track_vocal: "Vocals",
         track_melody: "Melody",
         track_lyrics: "Lyrics",
         track_video: "Video Track",
         track_fx: "FX Track",
         btn_play: "Play",
         btn_pause: "Pause",
         btn_split: "Split",
         btn_delete: "Delete",
         btn_export: "Finalize & Export",
         btn_finalize: "Apply Changes",
         prompt_lyrics: "Double click to edit lyrics...",
         prompt_fx: "Drag & drop filters/transitions",
         status_draft: "Draft Mode - Realtime Preview",
         msg_saved: "Changes saved and synced."
      }
    },
    coach: {
       sidebar: {
          cmd: "Command Center",
          trainees: "Trainees",
          msg: "Messages",
          settings: "Settings",
          logout: "Logout"
       },
       header: {
          region: "APAC Node",
          value: "Total Eco Value"
       },
       monitor: {
          title: "Squad Monitor",
          desc: "Real-time performance tracking of active producers.",
          filter: "Filter",
          new_task: "New Task",
          kpi_songs: "New Songs",
          kpi_rate: "Success Rate",
          kpi_review: "Pending Reviews"
       },
       table: {
          producer: "Producer",
          status: "Status",
          progress: "Progress",
          rev: "Revenue",
          action: "Action"
       },
       detail: {
          msg: "Message",
          profile: "Profile",
          latest: "Latest Submission",
          submitted: "Submitted",
          approve: "Approve",
          reject: "Reject",
          radar: "Skills Radar",
          close: "Close Panel"
       }
    }
  }
};

// --- Mock Data ---
const MOCK_SINGERS = [
  { id: '1', name: 'Neon V', style: 'Cyberpunk', status: 'Active', avatar: 'https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=200&q=80' },
  { id: '2', name: 'Luna Soft', style: 'Lo-Fi Pop', status: 'Dev', avatar: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&q=80' },
  { id: '3', name: 'Project: Zero', style: 'Rock', status: 'Plan', avatar: 'https://images.unsplash.com/photo-1514525253440-b393452e2347?w=200&q=80' },
];

const EARNING_DATA = [
  { name: '1', song: 4000, badge: 2400 },
  { name: '2', song: 3000, badge: 1398 },
  { name: '3', song: 2000, badge: 9800 },
  { name: '4', song: 2780, badge: 3908 },
  { name: '5', song: 1890, badge: 4800 },
  { name: '6', song: 2390, badge: 3800 },
  { name: '7', song: 3490, badge: 4300 },
];

const CHART_DATA = [
  { id: 1, title: "Neon Rain", artist: "Neon V", votes: 12450, trend: "up", cover: "https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=400&q=80" },
  { id: 2, title: "Cyber Heartbeat", artist: "Project: Zero", votes: 10890, trend: "up", cover: "https://images.unsplash.com/photo-1514525253440-b393452e2347?w=400&q=80" },
  { id: 3, title: "Digital Tears", artist: "Luna Soft", votes: 9800, trend: "down", cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80" },
  { id: 4, title: "Void Echo", artist: "Echo Bot", votes: 8500, trend: "same", cover: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&q=80" },
  { id: 5, title: "System Error", artist: "Glitch Gang", votes: 7200, trend: "up", cover: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&q=80" },
];

const TRANSACTIONS = [
   { id: 1, date: "2024-03-15", desc: "Royalty Payout - Feb 2024", amount: "+ ¥12,450.00", status: "Completed" },
   { id: 2, date: "2024-03-14", desc: "Mint Revenue - Genesis Badge", amount: "+ ¥8,920.00", status: "Completed" },
   { id: 3, date: "2024-03-12", desc: "AI Service Fee (Suno API)", amount: "- ¥200.00", status: "Completed" },
   { id: 4, date: "2024-03-10", desc: "Withdrawal to Wallet (0x8...2a)", amount: "- ¥5,000.00", status: "Processing" },
];

const LYRICS = [
   { time: 0, text: "Neon rain falling down..." },
   { time: 4, text: "Washing away the dust of this town." },
   { time: 8, text: "I see your ghost in the hologram," },
   { time: 12, text: "Running through the wires, who I am?" },
   { time: 16, text: "(Instrumental Break)" },
   { time: 24, text: "Cyber heart, beating slow," },
   { time: 28, text: "Where the data streams, there I go." },
];

// --- Components Helpers ---

// 1. Particle Background
const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    const particles: any[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * width, y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
      });
    }
    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x; const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
             ctx.beginPath(); ctx.strokeStyle = `rgba(147, 51, 234, ${0.15 * (1 - dist / 150)})`;
             ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
          }
        }
      });
      requestAnimationFrame(animate);
    };
    animate();
    const handleResize = () => { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
};

// --- 0. Home / Landing Page ---
const Home = ({ onEnter, lang, setLang }: { onEnter: () => void, lang: Lang, setLang: (l: Lang) => void }) => {
  const t = TRANSLATIONS[lang];
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    mouseX.set((clientX - window.innerWidth / 2) / 50);
    mouseY.set((clientY - window.innerHeight / 2) / 50);
  };

  return (
    <div className="relative min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 overflow-x-hidden" onMouseMove={handleMouseMove}>
      <nav className="fixed top-0 w-full z-50 bg-black/60 backdrop-blur-md border-b border-white/5">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 cursor-pointer" onClick={onEnter}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">AI Star <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">Eco</span></span>
          </motion.div>
          <div className="hidden md:flex items-center gap-8">
            {[t.nav.features, t.nav.showcase, t.nav.ecosystem, t.nav.about].map((item, i) => (
              <motion.button key={item} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }} onClick={onEnter} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                {item}
              </motion.button>
            ))}
          </div>
          <div className="flex items-center gap-4">
             <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="text-gray-400 hover:text-white">
                <GlobeIcon className="w-4 h-4 mr-1" /> {lang === 'zh' ? 'EN' : '中'}
             </Button>
             <Button onClick={onEnter} className="bg-white text-black hover:bg-gray-200 font-bold rounded-full px-6 shadow-lg shadow-white/10">
               {t.nav.enter}
             </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative min-h-screen flex flex-col justify-center pt-20 overflow-hidden">
        <ParticleBackground />
        <div className="absolute top-[20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-purple-800/20 to-cyan-800/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
        
        <div className="container mx-auto px-6 relative z-10 grid lg:grid-cols-12 gap-12 items-center flex-1">
          <motion.div style={{ x: mouseX, y: mouseY }} className="lg:col-span-7 space-y-8">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-md mb-6 hover:bg-cyan-500/10 transition-colors cursor-default group">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500 group-hover:bg-cyan-400 transition-colors"></span>
                </span>
                <span className="text-xs font-medium text-cyan-300 tracking-wide uppercase group-hover:text-cyan-200 transition-colors">{lang === 'zh' ? 'AI 歌手生态系统 Live v2.5.1' : 'AI Singer Ecosystem Live v2.5.1'}</span>
              </div>
              <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold leading-[0.95] text-white tracking-tighter mb-8">
                {lang === 'zh' ? '代码即歌喉。' : 'Code Is Voice.'} <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 animate-gradient-x bg-[length:200%_auto]">
                  {lang === 'zh' ? '唤醒数字生命。' : 'Awaken Digital Life.'}
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-400 max-w-xl leading-relaxed border-l-2 border-cyan-500/30 pl-6 mb-8">
                {lang === 'zh' 
                  ? "这里是赛博时代的数字生命孵化器。我们重构了【制作人-教练-粉丝】的共生网络，利用生物基因引擎与声纹合成技术，让每一个字节都拥有灵魂。数据不再冰冷，它是您触手可及的资产，也是永不落幕的偶像传奇。"
                  : "The digital life incubator of the Cyber Age. We reconstruct the symbiotic network of [Producers-Coaches-Fans], leveraging Bio-Gene Engines and Voice Synthesis to endow every byte with a soul. Data is no longer cold; it is your tangible asset and an everlasting legend."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={onEnter} size="lg" className="h-14 px-8 text-base font-bold rounded-full bg-white text-black hover:bg-cyan-50 shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:scale-105">
                  {t.hero.cta_primary}
                </Button>
                <Button onClick={onEnter} size="lg" variant="outline" className="h-14 px-8 text-base font-medium rounded-full border-white/20 bg-transparent text-white hover:bg-white/5 backdrop-blur-md hover:border-white/40 transition-all">
                   {t.hero.cta_secondary}
                </Button>
              </div>
              <div className="mt-12 flex items-center gap-6 text-gray-500 text-sm font-mono flex-wrap">
                 <div className="flex items-center gap-2"><Users className="w-4 h-4 text-cyan-500" /> {lang === 'zh' ? '50k+ 制作人' : '50k+ Producers'}</div>
                 <div className="w-1 h-1 bg-gray-700 rounded-full" />
                 <div className="flex items-center gap-2"><Music2 className="w-4 h-4 text-purple-500" /> {t.hero.stats_songs}</div>
                 <div className="w-1 h-1 bg-gray-700 rounded-full hidden sm:block" />
                 <div className="flex items-center gap-2 hidden sm:flex"><Fingerprint className="w-4 h-4 text-pink-500" /> {lang === 'zh' ? '20W+ 基因库' : '200k+ Genes'}</div>
              </div>
            </motion.div>
          </motion.div>
          
          {/* Visual - Abstract Data Flow */}
          <div className="lg:col-span-5 relative h-[500px] w-full hidden lg:block">
             <div className="absolute inset-0 bg-gradient-to-tr from-[#1a1a2e] to-[#0f0f12] rounded-[2.5rem] border border-white/10 backdrop-blur-sm p-8 flex flex-col justify-between overflow-hidden shadow-2xl group cursor-default">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
                <div className="relative z-10 flex justify-between items-start">
                   <div><h3 className="text-white font-bold text-lg flex items-center gap-2"><Sparkles className="w-4 h-4 text-cyan-400" /> Ecosystem Monitor</h3><p className="text-gray-500 text-xs font-mono">System Status: Optimal</p></div>
                   <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><div className="w-2 h-2 rounded-full bg-yellow-500" /><div className="w-2 h-2 rounded-full bg-green-500" /></div>
                </div>
                
                {/* Dashboard Card 1 - Trainee */}
                <div className="relative z-10 self-center w-full max-w-[320px] space-y-4">
                   <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="bg-black/60 backdrop-blur-md rounded-xl border border-white/10 p-4 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2"><Badge variant="outline" className="text-[10px] h-5 border-green-500/30 text-green-400 bg-green-500/10">ACTIVE</Badge></div>
                      <div className="flex items-center gap-3 mb-3">
                         <Avatar className="w-10 h-10 border border-purple-500/30"><AvatarImage src="https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=200" /></Avatar>
                         <div>
                           <div className="text-sm font-bold text-white">Neon V</div>
                           <div className="text-[10px] text-gray-400 flex items-center gap-1"><Cpu className="w-3 h-3" /> Gene Mixing: 98%</div>
                         </div>
                      </div>
                      <div className="w-full bg-gray-800/50 h-1.5 rounded-full overflow-hidden mb-2">
                        <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500" initial={{ width: "0%" }} animate={{ width: "98%" }} transition={{ duration: 2, delay: 0.5 }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                        <span>Model: C-Punk v4</span>
                        <span>ETA: 00:02</span>
                      </div>
                   </motion.div>

                   {/* Dashboard Card 2 - Stats */}
                   <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 7, delay: 1, repeat: Infinity, ease: "easeInOut" }} className="bg-black/80 backdrop-blur-md rounded-xl border border-white/10 p-4 shadow-2xl ml-8">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-white">Real-time Revenue</span>
                        <span className="text-xs text-green-400 font-mono">+12.4%</span>
                      </div>
                      <div className="h-16 w-full bg-gradient-to-b from-cyan-900/10 to-transparent rounded border border-white/5 relative overflow-hidden flex items-end px-1 pb-0 gap-1">
                         {[40, 60, 30, 80, 50, 90, 70, 45, 65, 85, 55, 75].map((h, i) => (
                            <motion.div key={i} className="flex-1 bg-cyan-500/40 hover:bg-cyan-400/80 transition-colors rounded-t-sm" initial={{ height: '0%' }} animate={{ height: `${h}%` }} transition={{ duration: 0.8, delay: i * 0.05 }} />
                         ))}
                      </div>
                   </motion.div>
                </div>
             </div>
          </div>
        </div>
        
        {/* Live Ticker */}
        <div className="w-full bg-[#0c0c0e] border-y border-white/5 py-3 relative z-20 mt-12 overflow-hidden">
           <div className="flex items-center justify-center gap-12 animate-marquee whitespace-nowrap text-xs sm:text-sm font-mono text-gray-500">
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"/> LIVE: New Gene "Cyber-Elf" Synthesized by @User992</span>
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full"/> MARKET: Badge #8821 Sold for ¥1,200</span>
              <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"/> SYSTEM: Voice Engine v3.0 Deployment Complete</span>
           </div>
        </div>
      </div>

      {/* Workflow */}
      <section className="py-24 bg-[#050505] relative border-t border-white/5">
         <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
               <div className="max-w-2xl">
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 mb-4">{t.workflow.tag}</Badge>
                  <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{t.workflow.title}</h2>
                  <p className="text-gray-400 text-lg leading-relaxed">{t.workflow.desc}</p>
               </div>
            </div>
            <div className="relative">
               <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent -translate-y-1/2 z-0" />
               <div className="grid md:grid-cols-3 gap-8 relative z-10">
                  {t.workflow.steps.map((step, i) => (
                     <div key={i} className={`bg-[#0c0c0e] border border-white/10 p-8 rounded-2xl relative group hover:border-${i===0?'cyan':i===1?'purple':'pink'}-500/50 transition-colors`}>
                        <div className={`w-16 h-16 bg-black rounded-2xl border border-white/10 flex items-center justify-center mb-6 text-2xl font-bold text-gray-700 group-hover:text-${i===0?'cyan':i===1?'purple':'pink'}-400 group-hover:border-${i===0?'cyan':i===1?'purple':'pink'}-500 transition-all shadow-lg mx-auto md:mx-0`}>0{i+1}</div>
                        <h3 className="text-2xl font-bold text-white mb-2">{step.title}</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-4">{step.desc}</p>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </section>

      {/* Features Bento */}
      <section className="py-24 bg-black relative">
         <div className="container mx-auto px-6">
             <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 h-auto md:h-[600px]">
                <div className="md:col-span-2 md:row-span-2 bg-[#121212] rounded-3xl p-8 border border-white/10 relative overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                   <div className="relative z-10 h-full flex flex-col justify-between">
                      <div>
                         <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4"><Zap className="w-6 h-6 text-cyan-400" /></div>
                         <h3 className="text-3xl font-bold text-white mb-2">{t.features.saas_title}</h3>
                         <p className="text-gray-400 max-w-md">{t.features.saas_desc}</p>
                      </div>
                      <div className="mt-8 rounded-xl bg-black/50 border border-white/5 p-4 backdrop-blur-sm">
                         <div className="flex items-center gap-3 border-b border-white/5 pb-3 mb-3">
                            <div className="w-3 h-3 rounded-full bg-red-500" /><div className="w-3 h-3 rounded-full bg-yellow-500" /><div className="w-3 h-3 rounded-full bg-green-500" />
                         </div>
                         <div className="space-y-2">
                            <div className="h-2 w-1/3 bg-gray-700 rounded-full" /><div className="h-2 w-2/3 bg-gray-800 rounded-full" /><div className="h-2 w-1/2 bg-gray-800 rounded-full" />
                         </div>
                      </div>
                   </div>
                </div>
                <div className="bg-[#121212] rounded-3xl p-6 border border-white/10 flex flex-col justify-center hover:bg-[#18181b] transition-colors group">
                   <Award className="w-8 h-8 text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
                   <h4 className="text-xl font-bold text-white">{t.features.assets_title}</h4>
                   <p className="text-sm text-gray-400 mt-2">{t.features.assets_desc}</p>
                </div>
                <div className="bg-[#121212] rounded-3xl p-6 border border-white/10 flex flex-col justify-center hover:bg-[#18181b] transition-colors group">
                   <Users className="w-8 h-8 text-pink-400 mb-4 group-hover:scale-110 transition-transform" />
                   <h4 className="text-xl font-bold text-white">{t.features.dao_title}</h4>
                   <p className="text-sm text-gray-400 mt-2">{t.features.dao_desc}</p>
                </div>
             </div>
         </div>
      </section>

      {/* Footer */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-b from-black to-[#0a0a0a]">
         <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-8">Ready to define the future?</h2>
            <Button onClick={onEnter} size="lg" className="h-14 px-8 rounded-full bg-white text-black hover:bg-gray-200">{t.nav.enter}</Button>
            <div className="mt-12 text-gray-600 text-sm">© 2024 AI Star Eco. All rights reserved.</div>
         </div>
      </section>
    </div>
  );
};

// --- 1. Portal ---
const Portal = ({ onSelectRole, lang, setLang }: { onSelectRole: (role: string) => void, lang: Lang, setLang: (l: Lang) => void }) => {
  const t = TRANSLATIONS[lang].portal;
  return (
    <div className="h-screen w-full flex bg-black overflow-hidden font-sans relative">
       {/* Lang Switch */}
       <div className="absolute top-4 right-4 z-50">
          <Button variant="ghost" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="bg-black/50 text-white backdrop-blur hover:bg-white/20 rounded-full">
             <GlobeIcon className="w-4 h-4 mr-1"/> {lang === 'zh' ? 'EN' : '中'}
          </Button>
       </div>

       {/* Fan */}
       <div onClick={() => onSelectRole('fan')} className="relative flex-1 border-r border-white/10 transition-all duration-700 ease-in-out hover:flex-[2.5] group cursor-pointer overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1514525253440-b393452e2347?w=1200&q=80')] bg-cover bg-center transition-transform duration-1000 group-hover:scale-110" />
          <div className="absolute inset-0 bg-black/70 group-hover:bg-pink-900/60 transition-colors duration-500" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
             <Heart className="w-16 h-16 text-white/50 group-hover:text-white mb-6 transition-colors duration-300 transform group-hover:-translate-y-4" />
             <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4 translate-y-8 group-hover:translate-y-0 transition-transform duration-500">{t.fan_title}</h2>
             <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
                <p className="text-sm text-white/70 max-w-xs mx-auto mb-8 leading-relaxed">{t.fan_desc}</p>
                <Button className="bg-white text-pink-900 hover:bg-white/90 rounded-full px-8 font-bold">{t.fan_btn} <ChevronRight className="w-4 h-4 ml-2" /></Button>
             </div>
          </div>
       </div>

       {/* Maker */}
       <div onClick={() => onSelectRole('producer_intro')} className="relative flex-1 border-r border-white/10 transition-all duration-700 ease-in-out hover:flex-[2.5] group cursor-pointer overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=80')] bg-cover bg-center transition-transform duration-1000 group-hover:scale-110" />
          <div className="absolute inset-0 bg-black/70 group-hover:bg-cyan-900/60 transition-colors duration-500" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
             <Zap className="w-16 h-16 text-white/50 group-hover:text-white mb-6 transition-colors duration-300 transform group-hover:-translate-y-4" />
             <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4 translate-y-8 group-hover:translate-y-0 transition-transform duration-500">{t.maker_title}</h2>
             <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
                <p className="text-sm text-white/70 max-w-xs mx-auto mb-8 leading-relaxed">{t.maker_desc}</p>
                <Button className="bg-white text-cyan-900 hover:bg-white/90 rounded-full px-8 font-bold">{t.maker_btn} <ChevronRight className="w-4 h-4 ml-2" /></Button>
             </div>
          </div>
       </div>

       {/* Coach */}
       <div onClick={() => onSelectRole('coach')} className="relative flex-1 transition-all duration-700 ease-in-out hover:flex-[2.5] group cursor-pointer overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80')] bg-cover bg-center transition-transform duration-1000 group-hover:scale-110" />
          <div className="absolute inset-0 bg-black/70 group-hover:bg-purple-900/60 transition-colors duration-500" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
             <Award className="w-16 h-16 text-white/50 group-hover:text-white mb-6 transition-colors duration-300 transform group-hover:-translate-y-4" />
             <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4 translate-y-8 group-hover:translate-y-0 transition-transform duration-500">{t.coach_title}</h2>
             <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
                <p className="text-sm text-white/70 max-w-xs mx-auto mb-8 leading-relaxed">{t.coach_desc}</p>
                <Button className="bg-white text-purple-900 hover:bg-white/90 rounded-full px-8 font-bold">{t.coach_btn} <ChevronRight className="w-4 h-4 ml-2" /></Button>
             </div>
          </div>
       </div>
    </div>
  );
};

// --- 2. Fan APP ---
const FanApp = ({ onBack, lang, setLang }: { onBack: () => void, lang: Lang, setLang: (l: Lang) => void }) => {
  const t = TRANSLATIONS[lang].fan;
  const [activeTab, setActiveTab] = useState('charts');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const handleVote = () => alert(lang === 'zh' ? "投票成功！��度值 +10 🔥" : "Voted! Heat +10 🔥");

  return (
    <div className="min-h-screen bg-[#050505] text-white flex justify-center bg-zinc-900">
      <div className="w-full max-w-md bg-black min-h-screen relative shadow-2xl flex flex-col">
         <div className="h-14 px-4 flex items-center justify-between bg-black/80 backdrop-blur-md sticky top-0 z-30 border-b border-white/10">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-lg flex items-center justify-center"><Music2 className="w-4 h-4 text-white" /></div>
               <span className="font-bold text-lg">{t.title}</span>
            </div>
            <div className="flex items-center gap-3">
               <Button variant="ghost" size="icon" onClick={() => setLang(lang==='zh'?'en':'zh')} className="h-8 w-8 text-xs">{lang.toUpperCase()}</Button>
               <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20"><LogOut className="w-4 h-4" /></Button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
            {activeTab === 'charts' && (
               <div className="p-4 space-y-6">
                  <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{t.title} 🏆</h2><Badge variant="secondary" className="bg-white/10 text-xs">Real-time</Badge></div>
                  {/* Top 3 */}
                  <div className="flex items-end justify-center gap-4 py-4">
                     {/* 2nd */}<div className="flex flex-col items-center gap-2 w-1/3"><div className="relative"><div className="w-20 h-20 rounded-full border-2 border-gray-400 p-1"><img src={CHART_DATA[1].cover} className="w-full h-full rounded-full object-cover" /></div><div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-600 text-white text-xs font-bold px-2 py-0.5 rounded-full border border-black">2</div></div><div className="text-center"><div className="font-bold text-sm truncate w-20">{CHART_DATA[1].artist}</div><div className="text-xs text-gray-500 flex items-center justify-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {CHART_DATA[1].votes}</div></div></div>
                     {/* 1st */}<div className="flex flex-col items-center gap-2 w-1/3 -mt-6"><div className="relative"><Crown className="w-8 h-8 text-yellow-400 absolute -top-8 left-1/2 -translate-x-1/2 animate-bounce" /><div className="w-24 h-24 rounded-full border-2 border-yellow-400 p-1 shadow-[0_0_20px_rgba(250,204,21,0.3)]"><img src={CHART_DATA[0].cover} className="w-full h-full rounded-full object-cover" /></div><div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full border border-black">1</div></div><div className="text-center"><div className="font-bold text-sm truncate w-24">{CHART_DATA[0].artist}</div><div className="text-xs text-yellow-500 font-bold flex items-center justify-center gap-1"><Flame className="w-3 h-3 fill-yellow-500" /> {CHART_DATA[0].votes}</div><Button size="sm" onClick={handleVote} className="h-6 text-xs mt-2 bg-gradient-to-r from-yellow-500 to-orange-500 border-0 rounded-full px-4">{t.vote}</Button></div></div>
                     {/* 3rd */}<div className="flex flex-col items-center gap-2 w-1/3"><div className="relative"><div className="w-20 h-20 rounded-full border-2 border-orange-700 p-1"><img src={CHART_DATA[2].cover} className="w-full h-full rounded-full object-cover" /></div><div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-800 text-white text-xs font-bold px-2 py-0.5 rounded-full border border-black">3</div></div><div className="text-center"><div className="font-bold text-sm truncate w-20">{CHART_DATA[2].artist}</div><div className="text-xs text-gray-500 flex items-center justify-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {CHART_DATA[2].votes}</div></div></div>
                  </div>
                  {/* List 4-10 */}
                  <div className="space-y-3 mt-4">
                     {CHART_DATA.slice(3).map((item, index) => (
                        <div key={item.id} className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                           <div className="text-gray-500 font-mono w-4 text-center">{index + 4}</div><img src={item.cover} className="w-12 h-12 rounded-lg object-cover" />
                           <div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{item.title}</div><div className="text-xs text-gray-400">{item.artist}</div></div>
                           <div className="flex flex-col items-end gap-1"><div className="text-xs font-bold text-gray-300 flex items-center gap-1"><Flame className="w-3 h-3 text-gray-500" /> {item.votes}</div><Button size="icon" variant="ghost" className="h-6 w-6 rounded-full border border-white/10 hover:bg-pink-500/20 hover:text-pink-500" onClick={handleVote}><Heart className="w-3 h-3" /></Button></div>
                        </div>
                     ))}
                  </div>
               </div>
            )}
            
            {activeTab === 'market' && (
               <div className="p-4 space-y-6">
                  <h2 className="text-xl font-bold">{t.market_title} 💎</h2>
                  <div className="grid grid-cols-2 gap-4">
                     {[1,2,3,4].map(i => (
                        <Card key={i} className="bg-[#121214] border-white/10 overflow-hidden">
                           <div className="aspect-square bg-gray-800 relative"><img src={`https://images.unsplash.com/photo-${1600000000000 + i * 999}?w=400`} className="w-full h-full object-cover" /><div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-white border border-white/20">{t.remaining} 12</div></div>
                           <div className="p-3"><h4 className="font-bold text-sm truncate">Neon Genesis #{i}02</h4><div className="flex justify-between items-center mt-2"><span className="text-cyan-400 font-bold text-sm">¥ 19.9</span><Button size="sm" className="h-6 text-xs bg-white text-black hover:bg-gray-200">{t.mint}</Button></div></div>
                        </Card>
                     ))}
                  </div>
               </div>
            )}
            
            {activeTab === 'discovery' && (
               <div className="p-4 space-y-6">
                  <div className="relative h-48 rounded-2xl overflow-hidden"><img src="https://images.unsplash.com/photo-1514525253440-b393452e2347?w=600" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" /><div className="absolute bottom-4 left-4"><Badge className="bg-pink-600 border-0 mb-2">New Release</Badge><h2 className="text-2xl font-bold">Electric Dreams</h2><p className="text-sm text-gray-300">Project: Zero • EP</p></div></div>
                  <div><h3 className="font-bold mb-4">{t.guess_like}</h3><div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">{[1,2,3,4].map(i => (<div key={i} className="w-32 flex-shrink-0 space-y-2"><img src={`https://images.unsplash.com/photo-${1500000000000 + i * 5000}?w=300`} className="w-32 h-32 rounded-lg object-cover" /><div className="text-sm font-bold truncate">Song Name {i}</div><div className="text-xs text-gray-500">Artist {i}</div></div>))}</div></div>
               </div>
            )}
         </div>

         {/* Floating Play Bar */}
         <div onClick={() => setShowFullPlayer(true)} className="absolute bottom-16 left-4 right-4 bg-[#1c1c1e]/90 backdrop-blur-md border border-white/10 rounded-full p-2 pr-4 flex items-center justify-between shadow-xl z-20 cursor-pointer hover:scale-105 transition-transform">
            <div className="flex items-center gap-3">
               <div className={`w-10 h-10 rounded-full bg-gray-800 overflow-hidden border border-white/10 ${isPlaying ? 'animate-spin-slow' : ''}`}>
                  <img src={CHART_DATA[0].cover} className="w-full h-full object-cover" />
               </div>
               <div><div className="text-sm font-bold text-white">Neon Rain</div><div className="text-xs text-gray-400">Neon V</div></div>
            </div>
            <div className="flex items-center gap-3">
               <div className="h-4 flex items-center gap-0.5">
                  {[...Array(6)].map((_, i) => (
                     <div key={i} className={`w-0.5 bg-cyan-500 rounded-full ${isPlaying ? 'animate-music-bar' : 'h-1'}`} style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
               </div>
               <div onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200">
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
               </div>
            </div>
         </div>

         {/* Full Screen Player Modal */}
         <AnimatePresence>
            {showFullPlayer && (
               <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute inset-0 bg-[#0c0c0e] z-50 flex flex-col">
                  <div className="h-16 px-6 flex items-center justify-between">
                     <Button size="icon" variant="ghost" onClick={() => setShowFullPlayer(false)} className="text-white"><ChevronDown className="w-6 h-6" /></Button>
                     <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Now Playing</div>
                     <Button size="icon" variant="ghost" className="text-white"><Share2 className="w-5 h-5" /></Button>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
                     <div className={`w-72 h-72 rounded-full border-8 border-[#1c1c1e] shadow-2xl overflow-hidden relative ${isPlaying ? 'animate-spin-slow' : ''}`}>
                         <img src={CHART_DATA[0].cover} className="w-full h-full object-cover" />
                         <div className="absolute inset-0 bg-black/20 rounded-full pointer-events-none" />
                         <div className="absolute inset-0 border-[40px] border-black/80 rounded-full pointer-events-none" />
                     </div>
                     
                     <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-white">Neon Rain</h2>
                        <p className="text-cyan-400 font-medium text-lg">Neon V</p>
                     </div>

                     <div className="w-full space-y-4">
                        <div className="h-32 overflow-hidden relative mask-linear-y text-center">
                           <div className="space-y-4">
                              {LYRICS.map((line, i) => (
                                 <p key={i} className={`text-lg transition-all duration-500 ${i===1 ? 'text-white font-bold scale-110' : 'text-gray-600'}`}>
                                    {line.text}
                                 </p>
                              ))}
                           </div>
                        </div>
                        
                        <div className="space-y-2">
                           <div className="relative h-1 bg-gray-800 rounded-full overflow-hidden">
                              <div className="absolute h-full w-1/3 bg-white rounded-full" />
                           </div>
                           <div className="flex justify-between text-xs text-gray-500 font-mono">
                              <span>1:12</span><span>3:45</span>
                           </div>
                        </div>

                        <div className="flex justify-between items-center px-4">
                           <SkipBack className="w-8 h-8 text-white" />
                           <div onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform cursor-pointer shadow-lg shadow-white/20">
                              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                           </div>
                           <SkipForward className="w-8 h-8 text-white" />
                        </div>
                     </div>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>

         <div className="h-16 bg-black border-t border-white/10 flex items-center justify-around px-2 absolute bottom-0 w-full z-30">
            <NavButton icon={<HomeIcon />} label={t.discovery} active={activeTab === 'discovery'} onClick={() => setActiveTab('discovery')} />
            <NavButton icon={<BarChart3 />} label={t.charts} active={activeTab === 'charts'} onClick={() => setActiveTab('charts')} />
            <NavButton icon={<ShoppingBag />} label={t.market} active={activeTab === 'market'} onClick={() => setActiveTab('market')} />
            <NavButton icon={<UserCircle />} label={t.me} active={activeTab === 'me'} onClick={() => setActiveTab('me')} />
         </div>
      </div>
    </div>
  );
};
const NavButton = ({ icon, label, active, onClick }: any) => (<button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${active ? 'text-pink-500' : 'text-gray-500 hover:text-gray-300'}`}>{React.cloneElement(icon, { className: "w-6 h-6", strokeWidth: active ? 2.5 : 2 })}<span className="text-[10px] font-medium">{label}</span></button>);

// --- 3. Producer Intro ---
const ProducerIntro = ({ onEnterApp, lang, setLang }: { onEnterApp: () => void, lang: Lang, setLang: (l: Lang) => void }) => {
   const t = TRANSLATIONS[lang].portal;
   return (
     <div className="min-h-screen bg-black text-white relative">
        <div className="absolute top-4 right-4 z-50"><Button variant="ghost" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="bg-white/10 text-white backdrop-blur rounded-full"><GlobeIcon className="w-4 h-4 mr-1"/> {lang === 'zh' ? 'EN' : '中'}</Button></div>
        <div className="container mx-auto px-6 py-20 relative z-10">
           <div className="max-w-3xl space-y-8">
              <Badge className="bg-cyan-900/30 text-cyan-400 border-cyan-500/30">Producer Program Phase 2.0</Badge>
              <h1 className="text-6xl font-bold leading-tight">{t.maker_title}<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">{lang === 'zh' ? '孵化属于你的虚拟偶像矩阵' : 'Incubate Your Virtual Idol Matrix'}</span></h1>
              <p className="text-xl text-gray-400">{t.maker_desc}</p>
              <Button onClick={onEnterApp} size="lg" className="h-14 px-10 text-lg bg-white text-black hover:bg-gray-200">{lang === 'zh' ? '进入制作人控制台' : 'Enter Producer Console'} <ArrowRight className="ml-2" /></Button>
           </div>
        </div>
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 bg-[url('https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1000')] bg-cover bg-left pointer-events-none mask-linear" />
     </div>
   );
}

const SidebarItem = ({ icon, label, id, active, onClick, themeStyles }: any) => (
   <button
     onClick={() => onClick(id)}
     className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
       active === id 
         ? themeStyles.itemActive
         : themeStyles.itemBase
     }`}
   >
     {React.cloneElement(icon, { size: 18 })}
     {label}
   </button>
 );

const AdvancedEditor = ({ song, onBack, t }: { song: any, onBack: () => void, t: any }) => {
   const [mode, setMode] = useState<'audio'|'video'>('audio');
   const [isPlaying, setIsPlaying] = useState(false);
   const [isProMelody, setIsProMelody] = useState(false);
   
   // New state variables for Dialog interactions
   const [previewInstrument, setPreviewInstrument] = useState<string | null>(null);
   const [dialogView, setDialogView] = useState<'list' | 'upload' | 'record'>('list');
   const [isApplyingAI, setIsApplyingAI] = useState(false);
   const [selectedStyle, setSelectedStyle] = useState('赛博朋克');
   const [isDraggingOver, setIsDraggingOver] = useState(false);

   const [proTracks, setProTracks] = useState([
      { id: '1', name: 'Piano 钢琴', icon: Music, color: 'blue', isMuted: false, isSolo: false, level: 75, clips: [{ w: 90, offset: 0 }] },
      { id: '2', name: 'Guitar 吉他', icon: Radio, color: 'yellow', isMuted: false, isSolo: false, level: 85, clips: [{ w: 80, offset: 5 }] },
      { id: '3', name: 'Bass 贝斯', icon: Activity, color: 'orange', isMuted: false, isSolo: true, level: 60, clips: [{ w: 80, offset: 5 }] },
      { id: '4', name: 'Drums 架子鼓', icon: Disc3, color: 'emerald', isMuted: false, isSolo: false, level: 90, clips: [{ w: 85, offset: 0 }] }
   ]);

   const TRACK_COLORS: Record<string, any> = {
      blue: { border: 'border-l-blue-500', text: 'text-blue-400', bg: 'bg-blue-400', bgLight: 'bg-blue-500/20', borderLight: 'border-blue-500/40', hoverBorder: 'hover:border-blue-400', fill: 'bg-blue-500', from: 'from-black/0 to-blue-900/5', ring: 'border-blue-500' },
      yellow: { border: 'border-l-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-400', bgLight: 'bg-yellow-500/20', borderLight: 'border-yellow-500/40', hoverBorder: 'hover:border-yellow-400', fill: 'bg-yellow-500', from: 'from-black/0 to-yellow-900/5', ring: 'border-yellow-500' },
      orange: { border: 'border-l-orange-500', text: 'text-orange-400', bg: 'bg-orange-400', bgLight: 'bg-orange-500/20', borderLight: 'border-orange-500/40', hoverBorder: 'hover:border-orange-400', fill: 'bg-orange-500', from: 'from-black/0 to-orange-900/5', ring: 'border-orange-500' },
      emerald: { border: 'border-l-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-400', bgLight: 'bg-emerald-500/20', borderLight: 'border-emerald-500/40', hoverBorder: 'hover:border-emerald-400', fill: 'bg-emerald-500', from: 'from-black/0 to-emerald-900/5', ring: 'border-emerald-500' },
      purple: { border: 'border-l-purple-500', text: 'text-purple-400', bg: 'bg-purple-400', bgLight: 'bg-purple-500/20', borderLight: 'border-purple-500/40', hoverBorder: 'hover:border-purple-400', fill: 'bg-purple-500', from: 'from-black/0 to-purple-900/5', ring: 'border-purple-500' },
      indigo: { border: 'border-l-indigo-500', text: 'text-indigo-400', bg: 'bg-indigo-400', bgLight: 'bg-indigo-500/20', borderLight: 'border-indigo-500/40', hoverBorder: 'hover:border-indigo-400', fill: 'bg-indigo-500', from: 'from-black/0 to-indigo-900/5', ring: 'border-indigo-500' },
      rose: { border: 'border-l-rose-500', text: 'text-rose-400', bg: 'bg-rose-400', bgLight: 'bg-rose-500/20', borderLight: 'border-rose-500/40', hoverBorder: 'hover:border-rose-400', fill: 'bg-rose-500', from: 'from-black/0 to-rose-900/5', ring: 'border-rose-500' },
      cyan: { border: 'border-l-cyan-500', text: 'text-cyan-400', bg: 'bg-cyan-400', bgLight: 'bg-cyan-500/20', borderLight: 'border-cyan-500/40', hoverBorder: 'hover:border-cyan-400', fill: 'bg-cyan-500', from: 'from-black/0 to-cyan-900/5', ring: 'border-cyan-500' },
      pink: { border: 'border-l-pink-500', text: 'text-pink-400', bg: 'bg-pink-400', bgLight: 'bg-pink-500/20', borderLight: 'border-pink-500/40', hoverBorder: 'hover:border-pink-400', fill: 'bg-pink-500', from: 'from-black/0 to-pink-900/5', ring: 'border-pink-500' },
   };

   const handleAddInstrument = (name: string, icon: any, color: string) => {
      setProTracks([...proTracks, {
         id: Date.now().toString(),
         name,
         icon,
         color,
         isMuted: false,
         isSolo: false,
         level: 80,
         clips: [{ w: 60 + Math.random()*30, offset: Math.random()*10 }]
      }]);
      // If we are currently in dialog, we would normally close it here but let's just leave it or manage it via Radix Dialog primitives.
   };

   const handlePreview = (e: React.MouseEvent, instId: string) => {
      e.stopPropagation();
      setPreviewInstrument(prev => prev === instId ? null : instId);
   };

   const handleApplyAI = () => {
      setIsApplyingAI(true);
      setTimeout(() => {
         setIsApplyingAI(false);
         // Simulate adding AI recommended tracks
         handleAddInstrument('Synth 合成器', Radio, 'purple');
         setTimeout(() => handleAddInstrument('Drum Machine 鼓机', Disc3, 'emerald'), 100);
         setTimeout(() => handleAddInstrument('E-Guitar 电吉他', Zap, 'yellow'), 200);
      }, 1500);
   };

   const INSTRUMENT_PRESETS = [
      { id: 'cello', cat: 'strings', nameEn: 'CELLO', nameZh: '大提琴', fullName: 'Cello 大提琴', icon: Music, color: 'indigo', styles: ['古风/国潮', '流行/流行'] },
      { id: 'violin', cat: 'strings', nameEn: 'VIOLIN', nameZh: '小提琴', fullName: 'Violin 小提琴', icon: Music, color: 'rose', styles: ['流行/流行', '电子/��曲'] },
      { id: 'eguitar', cat: 'strings', nameEn: 'E-GUITAR', nameZh: '电吉他', fullName: 'E-Guitar 电吉他', icon: Zap, color: 'yellow', styles: ['赛博朋克', '摇滚/金属', '流行/流行'] },
      { id: 'aguitar', cat: 'strings', nameEn: 'A-GUITAR', nameZh: '木吉他', fullName: 'Acoustic 木吉他', icon: Music, color: 'orange', styles: ['流行/流行', '古风/国潮'] },
      { id: 'erhu', cat: 'strings', nameEn: 'ERHU', nameZh: '二胡', fullName: 'Erhu 二胡', icon: Activity, color: 'red', styles: ['古风/国潮', '赛博朋克'] },
      { id: 'guzheng', cat: 'strings', nameEn: 'GUZHENG', nameZh: '古筝', fullName: 'Guzheng 古筝', icon: Layers, color: 'cyan', styles: ['古风/国潮'] },
      
      { id: 'piano', cat: 'keys', nameEn: 'PIANO', nameZh: '钢琴', fullName: 'Piano 钢琴', icon: Layers, color: 'blue', styles: ['流行/流行', '古风/国潮'] },
      { id: 'synth', cat: 'keys', nameEn: 'SYNTH', nameZh: '合成器', fullName: 'Synth 合成器', icon: Radio, color: 'purple', styles: ['赛博朋克', '电子/舞曲', '流行/流行'] },
      { id: 'bass', cat: 'keys', nameEn: 'BASS', nameZh: '低音', fullName: 'Sub Bass 低音', icon: Volume2, color: 'orange', styles: ['摇滚/金属', '流行/流行', '电子/舞曲', '赛博朋克'] },
      { id: '8bit', cat: 'keys', nameEn: 'CHIPTUNE', nameZh: '8-Bit脉冲', fullName: '8-Bit 脉冲', icon: Cpu, color: 'pink', styles: ['赛博朋克', '电子/舞曲'] },
      
      { id: 'drums', cat: 'perc', nameEn: 'DRUMS', nameZh: '架子鼓', fullName: 'Drum Kit 鼓组', icon: Disc3, color: 'emerald', styles: ['摇滚/金属', '流行/流行'] },
      { id: 'drummachine', cat: 'perc', nameEn: '808-KIT', nameZh: '电子鼓机', fullName: 'Drum Machine 鼓机', icon: Disc3, color: 'fuchsia', styles: ['赛博朋克', '电子/舞曲', '流行/流行'] },
      { id: 'taiko', cat: 'perc', nameEn: 'TAIKO', nameZh: '大鼓', fullName: 'Taiko 大鼓', icon: Disc3, color: 'red', styles: ['古风/国潮', '摇滚/金属'] },
      
      { id: 'flute', cat: 'wind', nameEn: 'FLUTE', nameZh: '长笛', fullName: 'Flute 长笛', icon: Wind, color: 'cyan', styles: ['古风/国潮', '流行/流行'] },
      { id: 'sax', cat: 'wind', nameEn: 'SAX', nameZh: '萨克斯', fullName: 'Saxophone 萨克斯', icon: Wind, color: 'yellow', styles: ['流行/流行', '电子/舞曲'] },
      { id: 'suona', cat: 'wind', nameEn: 'SUONA', nameZh: '唢呐', fullName: 'Suona 唢呐', icon: Wind, color: 'red', styles: ['古风/国潮', '摇滚/金属', '赛博朋克'] },
      
      { id: 'sfx', cat: 'all', nameEn: 'SFX', nameZh: '音效', fullName: 'SFX 音效', icon: Activity, color: 'pink', styles: ['赛博朋克', '电子/舞曲', '摇滚/金属', '流行/流行', '古风/国潮'] },
   ];
   
   return (
      <div className="flex flex-col h-[calc(100vh-140px)] bg-[#0c0c0e]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative">
   <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
   
   {/* Top Toolbar */}
   <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/40 backdrop-blur-md relative z-10 shrink-0">
      <div className="flex items-center gap-4">
         <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4 mr-2"/> Back</Button>
         <div className="h-6 w-px bg-white/10" />
         <h3 className="font-bold text-white flex items-center gap-2">{song?.title} <Badge className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] uppercase tracking-wider">{t.status_draft}</Badge></h3>
      </div>
      <div className="flex items-center gap-3">
         <div className="bg-white/5 rounded-lg p-1 flex">
            <button onClick={()=>setMode('audio')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mode==='audio'?'bg-cyan-500 text-black shadow-[0_0_10px_rgba(34,211,238,0.3)]':'text-gray-400 hover:text-white'}`}>{t.mode_audio}</button>
            <button onClick={()=>setMode('video')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${mode==='video'?'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]':'text-gray-400 hover:text-white'}`}>{t.mode_video}</button>
         </div>
         <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />
         <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white hidden md:flex"><Settings className="w-4 h-4" /></Button>
         <Button size="sm" variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hidden md:flex">{t.btn_finalize}</Button>
         <Button size="sm" className="bg-gradient-to-r from-cyan-600 to-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)] transition-all">{t.btn_export}</Button>
      </div>
   </div>
   
   {/* Main Workspace */}
   <div className="flex-1 flex flex-col min-h-0 relative z-10">
      {/* Preview Area (Top Half) */}
      <div className="flex-1 flex flex-col md:flex-row bg-black/50 border-b border-white/10 p-4 md:p-6 gap-4 md:gap-6 relative overflow-hidden">
          {mode === 'video' ? (
             <div className="flex-1 rounded-xl bg-black border border-white/10 flex flex-col relative overflow-hidden shadow-inner h-48 md:h-auto group">
                {/* Video mock */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1200')] bg-cover bg-center opacity-40 mix-blend-screen" />
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/40 to-cyan-900/40" />
                
                {/* Grid / Safe Margins Overlay */}
                <div className="absolute inset-8 border border-white/10 rounded-lg pointer-events-none flex items-center justify-center border-dashed">
                   <div className="w-px h-full bg-white/5 border-l border-dashed border-white/20" />
                   <div className="h-px w-full bg-white/5 absolute border-t border-dashed border-white/20" />
                </div>
                
                <div className="absolute inset-0 flex items-center justify-center z-10 text-gray-300 hover:text-white transition-colors cursor-pointer flex-col gap-4">
                   <PlayCircle className="w-16 h-16 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                   <span className="font-mono text-sm tracking-widest bg-black/60 px-3 py-1 rounded backdrop-blur">{t.prompt_fx}</span>
                </div>

                <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent z-20 flex items-center gap-3">
                   <div className="text-xs font-mono text-white drop-shadow-[0_0_2px_black]">00:01:23</div>
                   <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer relative">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 w-[35%] relative shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                         <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_5px_white]" />
                      </div>
                   </div>
                   <div className="text-xs font-mono text-gray-400 drop-shadow-[0_0_2px_black]">00:03:45</div>
                </div>
             </div>
          ) : (
             <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
                {/* Lyrics Editor / Structure */}
                <div className="flex-1 bg-[#0c0c0e]/80 border border-white/10 rounded-xl p-6 overflow-y-auto custom-scrollbar relative group shadow-inner">
                   <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#0c0c0e]/90 backdrop-blur-md pb-3 z-10 border-b border-white/5">
                      <h4 className="text-xs text-gray-400 uppercase tracking-widest font-bold flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-cyan-500" /> 结构与歌词</h4>
                      <Button size="sm" variant="outline" className="border-white/10 h-8 text-xs bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"><Edit3 className="w-3 h-3 mr-2" /> 编辑歌词</Button>
                   </div>
                   <div className="space-y-2 font-medium text-sm md:text-base leading-relaxed">
                      {[
                         { t: "00:00", text: "[前奏]", type: "tag" },
                         { t: "00:12", text: "霓虹灯影倒映雨中", type: "lyric" },
                         { t: "00:16", text: "赛博都市令我疯狂", type: "lyric" },
                         { t: "00:22", text: "[主歌 1]", type: "tag" },
                         { t: "00:24", text: "将意识上传至云端", type: "lyric" },
                         { t: "00:28", text: "数字心脏剧烈跳动", type: "lyric" },
                         { t: "00:34", text: "[副歌]", type: "tag", active: true },
                         { t: "00:36", text: "遗落世界的阵阵回音", type: "lyric", active: true },
                         { t: "00:40", text: "在盲目静电中寻觅信号", type: "lyric" }
                      ].map((line, i) => (
                         <div key={i} className={`flex items-start gap-4 p-3 rounded-xl transition-all duration-300 ${line.active ? 'bg-gradient-to-r from-cyan-500/10 to-transparent border-l-2 border-cyan-400 shadow-[inset_20px_0_20px_-20px_rgba(34,211,238,0.2)]' : 'border-l-2 border-transparent hover:bg-white/5'}`}>
                            <div className={`font-mono text-[11px] pt-1.5 w-12 text-right ${line.active ? 'text-cyan-400 font-bold' : 'text-gray-500'}`}>{line.t}</div>
                            <div className={`flex-1 ${line.type === 'tag' ? 'text-cyan-500/80 font-bold text-xs uppercase tracking-widest mt-1.5' : (line.active ? 'text-white text-base font-semibold drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'text-gray-400 text-sm hover:text-gray-300')} cursor-text transition-colors`}>
                               {line.text}
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          )}
          
          {/* Properties Panel (Right) */}
          <div className="w-full md:w-72 flex flex-col gap-4 overflow-y-auto min-h-0 shrink-0">
             <div className="bg-[#0c0c0e]/80 border border-white/10 rounded-xl p-5 flex-1 shadow-inner custom-scrollbar relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] pointer-events-none" />
                <h4 className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-6 flex items-center gap-2 border-b border-white/5 pb-3"><Settings className="w-3.5 h-3.5 text-gray-500" /> 属性检查器</h4>
                {mode === 'audio' ? (
                   <div className="space-y-6 relative z-10">
                      <div className="space-y-3">
                         <Label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">曲速 (BPM)</Label>
                         <div className="flex gap-2">
                            <Input defaultValue="124" className="bg-black/40 border-white/10 h-10 text-sm font-mono focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all text-center" />
                            <Button variant="outline" className="h-10 border-white/10 px-5 text-xs bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/40 transition-all font-medium">测速</Button>
                         </div>
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">调号</Label>
                         <select className="w-full bg-black/40 border border-white/10 rounded-lg h-10 px-3 text-sm text-gray-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all appearance-none cursor-pointer">
                            <option>Am</option><option>C</option><option>Dm</option><option>F#m</option>
                         </select>
                      </div>
                      
                      <div className="pt-6 border-t border-white/5 space-y-4">
                         <div className="flex justify-between items-center">
                            <Label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">人声滤镜</Label>
                            <Badge variant="outline" className="text-[9px] border-cyan-500/40 text-cyan-300 bg-cyan-500/10 font-medium">已激活</Badge>
                         </div>
                         <div className="grid grid-cols-2 gap-2.5">
                            <Button variant="outline" className="h-10 text-xs border-cyan-500/40 bg-cyan-500/15 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] font-medium">无线电</Button>
                            <Button variant="outline" className="h-10 text-xs border-white/10 bg-black/40 text-gray-400 hover:border-white/30 hover:text-white hover:bg-white/5 transition-all">机械音</Button>
                            <Button variant="outline" className="h-10 text-xs border-white/10 bg-black/40 text-gray-400 hover:border-white/30 hover:text-white hover:bg-white/5 transition-all">回声</Button>
                            <Button variant="outline" className="h-10 text-xs border-white/10 bg-black/40 text-gray-400 hover:border-white/30 hover:text-white hover:bg-white/5 transition-all">原声</Button>
                         </div>
                      </div>

                      <div className="pt-6 border-t border-white/5 space-y-5">
                         <Label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">主控均衡器 (EQ)</Label>
                         <div className="space-y-4">
                            <div className="space-y-1.5">
                               <div className="flex justify-between text-[10px] text-gray-400 font-medium"><span>低频</span><span className="text-cyan-400">+2dB</span></div>
                               <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 w-[60%] rounded-full shadow-[0_0_8px_rgba(34,211,238,0.4)]" /></div>
                            </div>
                            <div className="space-y-1.5">
                               <div className="flex justify-between text-[10px] text-gray-400 font-medium"><span>中频</span><span className="text-gray-500">-1dB</span></div>
                               <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-gray-500 w-[45%] rounded-full" /></div>
                            </div>
                            <div className="space-y-1.5">
                               <div className="flex justify-between text-[10px] text-gray-400 font-medium"><span>高频</span><span className="text-cyan-400">+4dB</span></div>
                               <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 w-[75%] rounded-full shadow-[0_0_8px_rgba(34,211,238,0.4)]" /></div>
                            </div>
                         </div>
                      </div>
                   </div>
                ) : (
                   <div className="space-y-6 relative z-10">
                      <div className="space-y-3">
                         <Label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">画面比例</Label>
                         <div className="grid grid-cols-3 gap-2.5">
                            <Button variant="outline" className="h-12 text-[10px] font-medium border-purple-500/40 bg-purple-500/15 text-purple-300 p-0 flex flex-col gap-1.5 items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.15)]"><div className="w-5 h-3 border-2 border-current rounded-[2px] opacity-80"/>16:9</Button>
                            <Button variant="outline" className="h-12 text-[10px] font-medium border-white/10 bg-black/40 text-gray-400 hover:border-white/30 hover:text-white hover:bg-white/5 transition-all p-0 flex flex-col gap-1.5 items-center justify-center"><div className="w-3 h-5 border-2 border-current rounded-[2px] opacity-60"/>9:16</Button>
                            <Button variant="outline" className="h-12 text-[10px] font-medium border-white/10 bg-black/40 text-gray-400 hover:border-white/30 hover:text-white hover:bg-white/5 transition-all p-0 flex flex-col gap-1.5 items-center justify-center"><div className="w-4 h-4 border-2 border-current rounded-[2px] opacity-60"/>1:1</Button>
                         </div>
                      </div>
                      <div className="pt-6 border-t border-white/5 space-y-3">
                         <Label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">视觉风格</Label>
                         <div className="grid grid-cols-2 gap-2.5">
                            <Button variant="outline" className="h-10 text-xs font-medium border-purple-500/40 bg-purple-500/15 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]">赛博朋克</Button>
                            <Button variant="outline" className="h-10 text-xs font-medium border-white/10 bg-black/40 text-gray-400 hover:border-white/30 hover:text-white hover:bg-white/5 transition-all">二次元</Button>
                            <Button variant="outline" className="h-10 text-xs font-medium border-white/10 bg-black/40 text-gray-400 hover:border-white/30 hover:text-white hover:bg-white/5 transition-all">写实</Button>
                            <Button variant="outline" className="h-10 text-xs font-medium border-white/10 bg-black/40 text-gray-400 hover:border-white/30 hover:text-white hover:bg-white/5 transition-all">3D 渲染</Button>
                         </div>
                      </div>
                      <div className="pt-6 border-t border-white/5 space-y-3">
                         <Label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">转场特效</Label>
                         <select className="w-full bg-black/40 border border-white/10 rounded-lg h-10 px-3 text-sm text-gray-200 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all appearance-none cursor-pointer"><option>故障 (Glitch)</option><option>淡入淡出 (Fade)</option><option>擦除 (Wipe)</option><option>闪白 (Flash)</option></select>
                      </div>
                      <div className="pt-6 border-t border-white/5 space-y-3">
                         <div className="flex justify-between items-center"><Label className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">特效强度</Label><span className="text-[10px] text-purple-400 font-mono">80%</span></div>
                         <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-1 border border-white/5"><div className="h-full bg-gradient-to-r from-purple-600 to-purple-400 w-[80%] rounded-full shadow-[0_0_8px_rgba(168,85,247,0.4)]" /></div>
                      </div>
                   </div>
                )}
             </div>
          </div>
      </div>
      
      {/* Timeline (Bottom Half) */}
      <div className="h-72 bg-[#09090b] flex flex-col shrink-0 border-t border-white/10 relative">
         {/* Timeline Header (Tools) */}
         <div className="h-12 border-b border-white/10 flex items-center px-4 justify-between bg-[#0c0c0e]">
            <div className="flex items-center gap-3">
               <div className="flex items-center bg-black/50 rounded-lg p-1 border border-white/5">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white"><SkipBack className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300" onClick={()=>setIsPlaying(!isPlaying)}>
                     {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white"><SkipForward className="w-4 h-4" /></Button>
               </div>
               <div className="font-mono text-sm text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-md border border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]">00:01:23 <span className="text-cyan-500/50 mx-1">/</span> 00:03:45</div>
            </div>
            <div className="flex items-center gap-2">
               <div className="flex items-center gap-1 bg-black/50 p-1 rounded-lg border border-white/5 mr-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-white" title={t.btn_split}><Scissors className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-white" title="Copy"><Copy className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-400" title={t.btn_delete}><Trash2 className="w-3.5 h-3.5" /></Button>
               </div>
               <div className="h-4 w-px bg-white/10 mx-1" />
               <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white"><Search className="w-4 h-4" /></Button>
            </div>
         </div>
         
         {/* Timeline Ruler */}
         <div className="h-6 bg-[#121214] border-b border-white/5 flex sticky top-0 z-20 overflow-hidden">
            <div className="w-40 shrink-0 border-r border-white/10 bg-[#0c0c0e]" />
            <div className="flex-1 relative">
               {[...Array(20)].map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-l border-white/10" style={{ left: `${i * 10}%` }}>
                     <span className="text-[9px] text-gray-500 absolute left-1 top-1 font-mono">00:{(i * 10).toString().padStart(2, '0')}</span>
                  </div>
               ))}
               {/* Small ticks */}
               {[...Array(100)].map((_, i) => (
                  <div key={`t-${i}`} className={`absolute bottom-0 w-px bg-white/5 ${i % 5 === 0 ? 'h-full' : 'h-1/2'}`} style={{ left: `${i * 2}%` }} />
               ))}
            </div>
         </div>
         
         {/* Tracks */}
         <div 
            className={`flex-1 overflow-y-auto overflow-x-auto relative flex flex-col custom-scrollbar transition-colors duration-300 ${isDraggingOver ? 'bg-cyan-950/20 shadow-[inset_0_0_50px_rgba(6,182,212,0.1)]' : 'bg-[#09090b]'}`}
            onDragOver={(e) => {
               e.preventDefault();
               e.dataTransfer.dropEffect = 'copy';
               setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
               e.preventDefault();
               setIsDraggingOver(false);
               const instId = e.dataTransfer.getData('text/plain');
               if (instId) {
                  const inst = INSTRUMENT_PRESETS.find(i => i.id === instId);
                  if (inst) {
                     handleAddInstrument(inst.fullName, inst.icon, inst.color);
                  }
               }
            }}
         >
            <div className="min-w-[1200px] pb-8">
               {mode === 'video' && (
                  <div className="h-20 border-b border-white/5 flex group hover:bg-white/[0.02]">
                     <div className="w-40 border-r border-white/10 bg-[#0c0c0e] p-3 flex flex-col justify-center shrink-0 sticky left-0 z-30 shadow-[5px_0_10px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center gap-2 text-purple-400 font-bold text-xs"><Video className="w-4 h-4" /> {t.track_video}</div>
                        <div className="text-[10px] text-gray-500 mt-1 flex items-center justify-between"><span>V1</span> <Lock className="w-3 h-3" /></div>
                     </div>
                     <div className="flex-1 relative bg-gradient-to-b from-black/0 to-purple-900/5 flex items-center px-4 gap-1 py-2">
                        <div className="h-full bg-purple-500/20 border border-purple-500/50 rounded-md w-[35%] flex items-center justify-center text-xs text-purple-300 font-mono tracking-widest overflow-hidden relative group/clip cursor-pointer hover:bg-purple-500/30 hover:border-purple-400 transition-colors shadow-inner">
                           <div className="absolute left-0 top-0 bottom-0 w-2 bg-purple-500/50 cursor-ew-resize opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                           <div className="absolute right-0 top-0 bottom-0 w-2 bg-purple-500/50 cursor-ew-resize opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                           Clip_Intro_01.mp4
                        </div>
                        <div className="h-full bg-purple-500/20 border border-purple-500/50 rounded-md w-[45%] flex items-center justify-center text-xs text-purple-300 font-mono tracking-widest overflow-hidden relative group/clip cursor-pointer hover:bg-purple-500/30 hover:border-purple-400 transition-colors shadow-inner">
                           <div className="absolute left-0 top-0 bottom-0 w-2 bg-purple-500/50 cursor-ew-resize opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                           <div className="absolute right-0 top-0 bottom-0 w-2 bg-purple-500/50 cursor-ew-resize opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                           Clip_Chorus_Render.mp4
                        </div>
                     </div>
                  </div>
               )}
               
               {/* Track 1 */}
               <div className="h-20 border-b border-white/5 flex group hover:bg-white/[0.02]">
                  <div className="w-40 border-r border-white/10 bg-[#0c0c0e] p-3 flex flex-col justify-center shrink-0 sticky left-0 z-30 shadow-[5px_0_10px_rgba(0,0,0,0.5)]">
                     <div className="flex items-center gap-2 text-pink-400 font-bold text-xs"><Mic2 className="w-4 h-4" /> {t.track_vocal}</div>
                     <div className="text-[10px] text-gray-500 mt-1 flex items-center justify-between"><span>A1</span> <div className="flex gap-1"><Headphones className="w-3 h-3"/><Lock className="w-3 h-3" /></div></div>
                  </div>
                  <div className="flex-1 relative bg-gradient-to-b from-black/0 to-pink-900/5 flex items-center px-4 gap-1 py-2">
                     <div className="h-full bg-pink-500/20 border border-pink-500/50 rounded-md w-[40%] ml-[10%] flex items-center px-2 overflow-hidden relative group/clip cursor-pointer hover:bg-pink-500/30 hover:border-pink-400 transition-colors">
                         <div className="absolute left-0 top-0 bottom-0 w-2 bg-pink-500/50 cursor-ew-resize opacity-0 group-hover/clip:opacity-100 transition-opacity z-10" />
                         <div className="absolute right-0 top-0 bottom-0 w-2 bg-pink-500/50 cursor-ew-resize opacity-0 group-hover/clip:opacity-100 transition-opacity z-10" />
                         <div className="absolute inset-0 flex items-center justify-around opacity-60 px-1">
                            {[...Array(60)].map((_,i)=><div key={i} className="w-1 bg-pink-400 rounded-full" style={{height: Math.random()*80 + 10 + '%'}} />)}
                         </div>
                         <div className="absolute bottom-1 left-2 text-[8px] font-mono text-pink-300 bg-black/60 px-1 rounded">Main_Vocals</div>
                     </div>
                  </div>
               </div>
               {/* Track 2 */}
               {!isProMelody ? (
                  <div className="h-20 border-b border-white/5 flex group hover:bg-white/[0.02]">
                     <div className="w-40 border-r border-white/10 bg-[#0c0c0e] p-3 flex flex-col justify-center shrink-0 sticky left-0 z-30 shadow-[5px_0_10px_rgba(0,0,0,0.5)] group/track">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs"><Music className="w-4 h-4" /> {t.track_melody}</div>
                           <Badge onClick={() => setIsProMelody(true)} className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/60 cursor-pointer text-[8px] px-1 py-0 h-4 flex items-center gap-1 transition-colors" title="Split into Stems"><Layers className="w-2.5 h-2.5"/> PRO</Badge>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1 flex items-center justify-between">
                           <span>A2</span> 
                           <div className="flex gap-1 items-center">
                              <div className="hidden group-hover/track:flex gap-0.5 mr-2 items-end h-3" title="Mixer levels">
                                 <div className="w-1 h-full bg-white/10 rounded-full overflow-hidden"><div className="w-full bg-cyan-400 h-[60%] mt-auto" /></div>
                                 <div className="w-1 h-full bg-white/10 rounded-full overflow-hidden"><div className="w-full bg-cyan-400 h-[80%] mt-auto" /></div>
                                 <div className="w-1 h-full bg-white/10 rounded-full overflow-hidden"><div className="w-full bg-cyan-400 h-[40%] mt-auto" /></div>
                              </div>
                              <Headphones className="w-3 h-3 hover:text-white cursor-pointer"/>
                              <Lock className="w-3 h-3 hover:text-white cursor-pointer" />
                           </div>
                        </div>
                     </div>
                     <div className="flex-1 relative bg-gradient-to-b from-black/0 to-cyan-900/5 flex items-center px-4 gap-1 py-2">
                        <div className="h-full bg-cyan-500/20 border border-cyan-500/50 rounded-md w-[90%] flex items-center px-2 overflow-hidden relative cursor-pointer hover:bg-cyan-500/30 hover:border-cyan-400 transition-colors">
                            <div className="absolute left-0 top-0 bottom-0 w-2 bg-cyan-500/50 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity z-10" />
                            <div className="absolute right-0 top-0 bottom-0 w-2 bg-cyan-500/50 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity z-10" />
                            <div className="absolute inset-0 flex items-center justify-around opacity-60 px-1">
                               {[...Array(150)].map((_,i)=><div key={i} className="w-1 bg-cyan-400 rounded-full" style={{height: Math.random()*90 + 10 + '%'}} />)}
                            </div>
                            <div className="absolute bottom-1 left-2 text-[8px] font-mono text-cyan-300 bg-black/60 px-1 rounded">Instrumental_Mix</div>
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="flex flex-col border-b border-white/5 relative z-20">
                     {/* Pro Master Header */}
                     <div className="h-10 border-b border-white/5 flex bg-[#0c0c0e]/80">
                        <div className="w-40 border-r border-white/10 bg-[#0c0c0e] px-3 flex items-center justify-between shrink-0 sticky left-0 z-30 shadow-[5px_0_10px_rgba(0,0,0,0.5)]">
                           <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs"><Music className="w-4 h-4" /> {t.track_melody}</div>
                           <Badge onClick={() => setIsProMelody(false)} className="bg-cyan-500/40 text-white border-cyan-400 hover:bg-cyan-500/60 cursor-pointer text-[8px] px-1 py-0 h-4 flex items-center gap-1 transition-colors" title="Merge to Simple"><Layers className="w-2.5 h-2.5"/> SIMP</Badge>
                        </div>
                        <div className="flex-1 opacity-20 pointer-events-none" style={{ backgroundImage: "linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.02) 75%, transparent 75%, transparent)", backgroundSize: "10px 10px" }} />
                     </div>
                     
                     {proTracks.map((track, trackIndex) => {
                        const theme = TRACK_COLORS[track.color];
                        const Icon = track.icon;
                        return (
                           <div key={track.id} className={`h-16 flex group hover:bg-white/[0.02] ${trackIndex > 0 ? 'border-t border-white/5' : ''}`}>
                              <div className={`w-40 border-r border-white/10 bg-[#0c0c0e]/90 p-2 flex flex-col justify-center shrink-0 sticky left-0 z-30 shadow-[5px_0_10px_rgba(0,0,0,0.5)] border-l-2 ${theme.border}`}>
                                 <div className={`text-[10px] ${theme.text} font-bold flex items-center gap-1.5`}><Icon className="w-3 h-3" /> {track.name}</div>
                                 <div className="mt-2 flex items-center justify-between text-gray-500">
                                    <span 
                                       onClick={() => {
                                          const newTracks = [...proTracks];
                                          newTracks[trackIndex].isMuted = !newTracks[trackIndex].isMuted;
                                          setProTracks(newTracks);
                                       }}
                                       className={`text-[8px] cursor-pointer px-1 rounded transition-colors ${track.isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30 font-bold' : `hover:${theme.text} bg-white/5`}`}>M</span>
                                    <div className="flex gap-2 items-center">
                                       <div className="w-12 h-1.5 bg-black rounded-full overflow-hidden border border-white/10"><div className={`h-full ${theme.bg}`} style={{width: `${track.level}%`}}/></div>
                                       <div className={`w-3 h-3 rounded-full border ${track.isSolo ? `${theme.ring} bg-${theme.bg}/20` : 'border-gray-500'} flex items-center justify-center hover:border-white cursor-pointer`}
                                            onClick={() => {
                                               const newTracks = [...proTracks];
                                               newTracks[trackIndex].isSolo = !newTracks[trackIndex].isSolo;
                                               setProTracks(newTracks);
                                            }}
                                       >
                                          <div className={`w-1 h-1 rounded-full ${track.isSolo ? theme.bg : 'bg-gray-500'}`} />
                                       </div>
                                    </div>
                                 </div>
                              </div>
                              <div className={`flex-1 relative bg-gradient-to-b ${theme.from} flex items-center px-4 gap-1 py-1`}>
                                 {track.clips.map((clip, i) => (
                                    <div key={i} className={`h-full ${theme.bgLight} border ${theme.borderLight} rounded-md flex items-center px-1 overflow-hidden relative cursor-pointer ${theme.hoverBorder} transition-colors`} style={{width: `${clip.w}%`, marginLeft: `${clip.offset}%`}}>
                                        <div className="absolute inset-0 flex items-center justify-around opacity-70 px-1 gap-[1px]">
                                           {[...Array(Math.floor(clip.w))].map((_, j) => (
                                              <div key={j} className={`w-1 ${theme.bg} rounded-sm`} style={{height: Math.random() * 60 + 20 + '%'}} />
                                           ))}
                                        </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        );
                     })}
                     
                     {/* Sub-track: Add New */}
                     <Dialog>
                        <DialogTrigger asChild>
                           <div className="h-14 flex group hover:bg-white/[0.02] border-t border-white/5 cursor-pointer transition-all duration-300">
                              <div className="w-40 border-r border-white/10 bg-[#0c0c0e]/50 p-2 flex flex-col items-center justify-center shrink-0 sticky left-0 z-30 transition-all group-hover:bg-cyan-950/20 h-14">
                                 <div className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 group-hover:text-cyan-400 transition-colors"><Plus className="w-3 h-3" /> 添����乐器 / 音轨</div>
                                 <div className="text-[8px] text-purple-400/80 font-mono mt-0.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <Sparkles className="w-2 h-2" /> AI 分析与推荐
                                 </div>
                              </div>
                              <div className="flex-1 bg-white/[0.01]" />
                           </div>
                        </DialogTrigger>
                        <DialogContent className="bg-[#121216]/95 backdrop-blur-xl border border-white/10 text-white sm:max-w-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden p-0">
                           <AnimatePresence mode="wait">
                              {dialogView === 'list' && (
                                 <motion.div key="list" initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:20}} className="flex flex-col max-h-[85vh]">
                                    <div className="p-6 pb-2 shrink-0">
                                       <DialogHeader>
                                          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                             <Plus className="w-6 h-6 text-cyan-400" />
                                             添加新��奏轨道
                                          </DialogTitle>
                                          <DialogDescription className="text-gray-400 text-sm">
                                             选择预设乐器，或通过外部导入、实时录制建立新音轨。
                                          </DialogDescription>
                                       </DialogHeader>
                                    </div>
                                    
                                    <div className="px-6 py-2 overflow-y-auto overflow-x-hidden pb-6 no-scrollbar">
                                       {/* AI Recommendation Zone */}
                                       <div className="mb-4 bg-gradient-to-r from-purple-900/40 via-cyan-900/20 to-transparent border border-purple-500/30 rounded-xl p-3 relative overflow-hidden group">
                                          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
                                          <div className="absolute -right-10 -top-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-colors" />
                                          
                                          <div className="flex items-start justify-between relative z-10">
                                             <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                   <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                                                   <span className="text-xs font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">AI 智能推荐编曲</span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mb-3">基于当前赛博朋克曲风与歌词情感分析，建议添加以下轨道组合：</p>
                                                
                                                <div className="flex gap-2">
                                                   <div className="flex items-center gap-1.5 bg-black/50 border border-purple-500/40 rounded-md px-2 py-1 cursor-pointer hover:bg-purple-900/50 hover:border-purple-400 transition-all">
                                                      <Radio className="w-3 h-3 text-purple-400" />
                                                      <span className="text-[10px] text-purple-100">模拟合成器</span>
                                                      <Plus className="w-3 h-3 text-gray-500 hover:text-white" />
                                                   </div>
                                                   <div className="flex items-center gap-1.5 bg-black/50 border border-emerald-500/40 rounded-md px-2 py-1 cursor-pointer hover:bg-emerald-900/50 hover:border-emerald-400 transition-all">
                                                      <Disc3 className="w-3 h-3 text-emerald-400" />
                                                      <span className="text-[10px] text-emerald-100">808鼓机</span>
                                                      <Plus className="w-3 h-3 text-gray-500 hover:text-white" />
                                                   </div>
                                                   <div className="flex items-center gap-1.5 bg-black/50 border border-yellow-500/40 rounded-md px-2 py-1 cursor-pointer hover:bg-yellow-900/50 hover:border-yellow-400 transition-all">
                                                      <Zap className="w-3 h-3 text-yellow-400" />
                                                      <span className="text-[10px] text-yellow-100">失真电吉他</span>
                                                      <Plus className="w-3 h-3 text-gray-500 hover:text-white" />
                                                   </div>
                                                </div>
                                             </div>
                                             <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={handleApplyAI}
                                                disabled={isApplyingAI}
                                                className="h-7 text-[10px] border-purple-500/50 text-purple-300 hover:bg-purple-500/20 hover:text-purple-100 min-w-[90px]"
                                             >
                                                {isApplyingAI ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> 应用中</> : '一键应用推荐'}
                                             </Button>
                                          </div>
                                       </div>

                                       {/* Music Style Filter */}
                                       <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                          {['赛博朋克', '古风/国潮', '摇滚/金属', '流行/流行', '电子/舞曲'].map(style => (
                                             <Badge 
                                                key={style}
                                                variant="outline"
                                                onClick={() => setSelectedStyle(style)}
                                                className={`relative overflow-hidden cursor-pointer transition-all duration-300 whitespace-nowrap group ${
                                                   selectedStyle === style 
                                                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.25)] hover:bg-cyan-500/30' 
                                                      : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30 hover:text-white hover:-translate-y-0.5'
                                                }`}
                                             >
                                                {selectedStyle === style && (
                                                   <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></div>
                                                )}
                                                <span className={`relative z-10 flex items-center gap-1.5 ${selectedStyle === style ? 'pl-2' : ''} transition-all duration-300`}>
                                                   {selectedStyle === style && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                                                   {style}
                                                </span>
                                             </Badge>
                                          ))}
                                       </div>

                                       {/* Categories Radio State (Pure CSS no React state needed) */}
                                       <input type="radio" name="inst-cat" id="cat-all" className="peer/all hidden" defaultChecked />
                                       <input type="radio" name="inst-cat" id="cat-strings" className="peer/strings hidden" />
                                       <input type="radio" name="inst-cat" id="cat-keys" className="peer/keys hidden" />
                                       <input type="radio" name="inst-cat" id="cat-perc" className="peer/perc hidden" />
                                       <input type="radio" name="inst-cat" id="cat-wind" className="peer/wind hidden" />

                                       <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2 mt-2">
                                          <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" /> 
                                          乐器大类 (Categories)
                                       </h4>
                                       
                                       <div className="grid grid-cols-5 gap-2 mb-4">
                                          <label htmlFor="cat-all" className="relative flex flex-col items-center justify-center py-2 px-1 rounded-md cursor-pointer bg-black/40 border border-white/10 hover:bg-white/5 transition-all peer-checked/all:bg-white/10 peer-checked/all:border-white/40 peer-checked/all:shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                                             <Layers className="w-4 h-4 text-gray-400 mb-1" />
                                             <span className="text-[10px] font-bold text-gray-300">全部</span>
                                          </label>
                                          <label htmlFor="cat-strings" className="relative flex flex-col items-center justify-center py-2 px-1 rounded-md cursor-pointer bg-black/40 border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all peer-checked/strings:bg-cyan-950/40 peer-checked/strings:border-cyan-400 peer-checked/strings:shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                                             <Music className="w-4 h-4 text-cyan-400 mb-1" />
                                             <span className="text-[10px] font-bold text-cyan-100">拨弦/拉弦</span>
                                          </label>
                                          <label htmlFor="cat-keys" className="relative flex flex-col items-center justify-center py-2 px-1 rounded-md cursor-pointer bg-black/40 border border-white/10 hover:border-purple-500/50 hover:bg-purple-950/20 transition-all peer-checked/keys:bg-purple-950/40 peer-checked/keys:border-purple-400 peer-checked/keys:shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                                             <Radio className="w-4 h-4 text-purple-400 mb-1" />
                                             <span className="text-[10px] font-bold text-purple-100">键盘/电子</span>
                                          </label>
                                          <label htmlFor="cat-perc" className="relative flex flex-col items-center justify-center py-2 px-1 rounded-md cursor-pointer bg-black/40 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-950/20 transition-all peer-checked/perc:bg-emerald-950/40 peer-checked/perc:border-emerald-400 peer-checked/perc:shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                                             <Disc3 className="w-4 h-4 text-emerald-400 mb-1" />
                                             <span className="text-[10px] font-bold text-emerald-100">打击乐</span>
                                          </label>
                                          <label htmlFor="cat-wind" className="relative flex flex-col items-center justify-center py-2 px-1 rounded-md cursor-pointer bg-black/40 border border-white/10 hover:border-yellow-500/50 hover:bg-yellow-950/20 transition-all peer-checked/wind:bg-yellow-950/40 peer-checked/wind:border-yellow-400 peer-checked/wind:shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                                             <Wind className="w-4 h-4 text-yellow-400 mb-1" />
                                             <span className="text-[10px] font-bold text-yellow-100">吹管/民族</span>
                                          </label>
                                       </div>

                                       <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" /> 
                                          具体乐器 (Instruments)
                                       </h4>
                                       
                                       <div className="grid grid-cols-5 gap-2 pr-1 pb-1">
                                          {INSTRUMENT_PRESETS.filter(inst => inst.styles.includes(selectedStyle)).map((inst) => {
                                             const Icon = inst.icon;
                                             const isPlaying = previewInstrument === inst.id;
                                             
                                             // Map colors to tailwind classes dynamically but safely (since they are generated elsewhere or standard)
                                             // We will just use the standard mapped colors for hover/border states 
                                             const colorMap: Record<string, string> = {
                                                indigo: 'hover:border-indigo-500/50 hover:bg-indigo-950/40 hover:shadow-[0_0_12px_rgba(99,102,241,0.3)] text-indigo-400 group-hover:text-indigo-300 group-hover:border-indigo-400 group-hover:drop-shadow-[0_0_6px_rgba(99,102,241,0.8)]',
                                                rose: 'hover:border-rose-500/50 hover:bg-rose-950/40 hover:shadow-[0_0_12px_rgba(225,29,72,0.3)] text-rose-400 group-hover:text-rose-300 group-hover:border-rose-400 group-hover:drop-shadow-[0_0_6px_rgba(225,29,72,0.8)]',
                                                yellow: 'hover:border-yellow-500/50 hover:bg-yellow-950/40 hover:shadow-[0_0_12px_rgba(234,179,8,0.3)] text-yellow-400 group-hover:text-yellow-300 group-hover:border-yellow-400 group-hover:drop-shadow-[0_0_6px_rgba(234,179,8,0.8)]',
                                                orange: 'hover:border-orange-500/50 hover:bg-orange-950/40 hover:shadow-[0_0_12px_rgba(249,115,22,0.3)] text-orange-400 group-hover:text-orange-300 group-hover:border-orange-400 group-hover:drop-shadow-[0_0_6px_rgba(249,115,22,0.8)]',
                                                red: 'hover:border-red-500/50 hover:bg-red-950/40 hover:shadow-[0_0_12px_rgba(239,68,68,0.3)] text-red-400 group-hover:text-red-300 group-hover:border-red-400 group-hover:drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]',
                                                cyan: 'hover:border-cyan-500/50 hover:bg-cyan-950/40 hover:shadow-[0_0_12px_rgba(6,182,212,0.3)] text-cyan-400 group-hover:text-cyan-300 group-hover:border-cyan-400 group-hover:drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]',
                                                blue: 'hover:border-blue-500/50 hover:bg-blue-950/40 hover:shadow-[0_0_12px_rgba(59,130,246,0.3)] text-blue-400 group-hover:text-blue-300 group-hover:border-blue-400 group-hover:drop-shadow-[0_0_6px_rgba(59,130,246,0.8)]',
                                                purple: 'hover:border-purple-500/50 hover:bg-purple-950/40 hover:shadow-[0_0_12px_rgba(168,85,247,0.3)] text-purple-400 group-hover:text-purple-300 group-hover:border-purple-400 group-hover:drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]',
                                                pink: 'hover:border-pink-500/50 hover:bg-pink-950/40 hover:shadow-[0_0_12px_rgba(236,72,153,0.3)] text-pink-400 group-hover:text-pink-300 group-hover:border-pink-400 group-hover:drop-shadow-[0_0_6px_rgba(236,72,153,0.8)]',
                                                emerald: 'hover:border-emerald-500/50 hover:bg-emerald-950/40 hover:shadow-[0_0_12px_rgba(16,185,129,0.3)] text-emerald-400 group-hover:text-emerald-300 group-hover:border-emerald-400 group-hover:drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]',
                                                fuchsia: 'hover:border-fuchsia-500/50 hover:bg-fuchsia-950/40 hover:shadow-[0_0_12px_rgba(217,70,239,0.3)] text-fuchsia-400 group-hover:text-fuchsia-300 group-hover:border-fuchsia-400 group-hover:drop-shadow-[0_0_6px_rgba(217,70,239,0.8)]',
                                             };

                                             const cClass = colorMap[inst.color] || colorMap.cyan;
                                             
                                             // Extract individual parts for precise targeting
                                             const baseHover = cClass.split(' text-')[0];
                                             const iconColor = 'text-' + cClass.split(' text-')[1].split(' ')[0];
                                             const groupHoverIcon = 'group-hover:text-' + cClass.split(' group-hover:text-')[1].split(' ')[0];
                                             const groupHoverBorder = 'group-hover:border-' + cClass.split(' group-hover:border-')[1].split(' ')[0];
                                             const groupHoverDrop = 'group-hover:drop-shadow-' + cClass.split(' group-hover:drop-shadow-')[1];

                                             return (
                                                <div 
                                                   key={inst.id}
                                                   draggable 
                                                   onDragStart={(e) => {
                                                      e.dataTransfer.setData('text/plain', inst.id);
                                                      e.dataTransfer.effectAllowed = 'copy';
                                                   }}
                                                   className={`hidden peer-checked/all:flex peer-checked/${inst.cat}:flex relative flex-col items-center justify-center h-14 gap-0.5 cursor-grab group bg-black/40 border border-white/10 rounded-md overflow-hidden backdrop-blur-md transition-all duration-300 -translate-y-0 hover:-translate-y-[2px] ${baseHover}`} 
                                                   onClick={() => handleAddInstrument(inst.fullName, inst.icon, inst.color)}
                                                >
                                                   <div className={`absolute top-1 right-1 z-10 transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={(e) => handlePreview(e, inst.id)}>
                                                      {isPlaying ? (
                                                         <div className="w-3 h-3 flex items-center justify-center gap-[1px]">
                                                            <div className="w-0.5 h-1.5 bg-white animate-[bounce_0.8s_infinite] rounded-full" />
                                                            <div className="w-0.5 h-2.5 bg-white animate-[bounce_0.8s_infinite_0.2s] rounded-full" />
                                                            <div className="w-0.5 h-1 bg-white animate-[bounce_0.8s_infinite_0.4s] rounded-full" />
                                                         </div>
                                                      ) : (
                                                         <PlayCircle className={`w-3 h-3 ${iconColor} hover:text-white hover:scale-110 transition-transform`} />
                                                      )}
                                                   </div>
                                                   <div className={`absolute top-0 left-0 w-1 h-1 border-t border-l border-white/20 transition-colors ${groupHoverBorder}`} />
                                                   <div className={`absolute bottom-0 right-0 w-1 h-1 border-b border-r border-white/20 transition-colors ${groupHoverBorder}`} />
                                                   <Icon className={`w-3.5 h-3.5 ${iconColor} ${groupHoverIcon} group-hover:scale-110 transition-all ${groupHoverDrop}`} />
                                                   <div className="flex flex-col items-center leading-none mt-0.5">
                                                      <span className={`text-[10px] font-medium text-gray-300 ${groupHoverIcon}`}>{inst.nameZh}</span>
                                                      <span className={`text-[7px] font-mono text-gray-500 mt-0.5 ${iconColor.replace('text-', 'group-hover:text-')}`}>{inst.nameEn}</span>
                                                   </div>
                                                </div>
                                             );
                                          })}

                                          {/* Browse All */}
                                          <div className="flex relative flex-col items-center justify-center h-14 gap-0.5 cursor-pointer group bg-black/40 border border-white/10 border-dashed rounded-md overflow-hidden backdrop-blur-md transition-all hover:-translate-y-[2px] hover:border-white/40 hover:bg-white/5">
                                             <Search className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors group-hover:scale-110" />
                                             <div className="flex flex-col items-center leading-none mt-0.5">
                                                <span className="text-[10px] font-medium text-gray-400 group-hover:text-white">更多...</span>
                                                <span className="text-[7px] font-mono text-gray-600 group-hover:text-gray-400 mt-0.5">BROWSE</span>
                                             </div>
                                          </div>
                                       </div>

                                       <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2 mt-4">
                                          <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]" /> 
                                          外部来源 (External)
                                       </h4>
                                       <div className="grid grid-cols-2 gap-4 pb-2">
                                          <div 
                                             className="border border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 to-cyan-500/10 hover:from-cyan-500/10 hover:to-cyan-500/20 rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:border-cyan-400 group hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] relative overflow-hidden"
                                             onClick={() => setDialogView('upload')}
                                          >
                                             <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-cyan-500/20 transition-colors" />
                                             <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform relative z-10 border border-cyan-500/30">
                                                <Upload className="w-5 h-5 text-cyan-400" />
                                             </div>
                                             <div className="relative z-10">
                                                <div className="font-bold text-cyan-400 text-sm flex items-center gap-2">上传音频文件 <ArrowRight className="w-3 h-3 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" /></div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">支持 MP3, WAV, FLAC 格式</div>
                                             </div>
                                          </div>
                                          
                                          <div 
                                             className="border border-pink-500/30 bg-gradient-to-r from-pink-500/5 to-pink-500/10 hover:from-pink-500/10 hover:to-pink-500/20 rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:border-pink-400 group hover:shadow-[0_0_20px_rgba(236,72,153,0.15)] relative overflow-hidden"
                                             onClick={() => setDialogView('record')}
                                          >
                                             <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-pink-500/20 transition-colors" />
                                             <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform relative z-10 border border-pink-500/30">
                                                <div className="absolute inset-0 rounded-full border border-pink-500/50 animate-ping opacity-20" />
                                                <Mic className="w-5 h-5 text-pink-400 relative z-10" />
                                             </div>
                                             <div className="relative z-10">
                                                <div className="font-bold text-pink-400 text-sm flex items-center gap-2">实时录制伴奏 <ArrowRight className="w-3 h-3 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" /></div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">调用麦克风或声卡内录</div>
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                 </motion.div>
                              )}

                              {dialogView === 'upload' && (
                                 <motion.div key="upload" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                       <Button variant="ghost" size="sm" onClick={() => setDialogView('list')} className="text-gray-400 hover:text-white p-0 h-auto w-auto hover:bg-transparent"><ArrowLeft className="w-5 h-5" /></Button>
                                       <DialogTitle className="text-xl font-bold text-cyan-400">上传音频文件</DialogTitle>
                                    </div>
                                    <div className="border-2 border-dashed border-white/20 rounded-2xl p-12 flex flex-col items-center justify-center bg-black/40 hover:bg-white/5 hover:border-cyan-500/50 transition-all cursor-pointer group">
                                       <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                          <Upload className="w-8 h-8 text-cyan-400" />
                                       </div>
                                       <h4 className="text-lg font-bold text-white mb-2">点击或拖拽文件到此处</h4>
                                       <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">支持 MP3, WAV, FLAC 格式。单文件最大限制 50MB。AI 将自动分析并分离轨道。</p>
                                       <Button className="bg-cyan-600 hover:bg-cyan-500 text-white border-none" onClick={(e) => { e.stopPropagation(); handleAddInstrument('Uploaded Audio', Upload, 'cyan'); setDialogView('list'); }}>
                                          选择文件...
                                       </Button>
                                    </div>
                                 </motion.div>
                              )}

                              {dialogView === 'record' && (
                                 <motion.div key="record" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                       <Button variant="ghost" size="sm" onClick={() => setDialogView('list')} className="text-gray-400 hover:text-white p-0 h-auto w-auto hover:bg-transparent"><ArrowLeft className="w-5 h-5" /></Button>
                                       <DialogTitle className="text-xl font-bold text-pink-400">实时录制</DialogTitle>
                                    </div>
                                    <div className="bg-black/40 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden">
                                       <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none" />
                                       
                                       <div className="relative mb-8 cursor-pointer group" onClick={() => { handleAddInstrument('Recorded Audio', Mic, 'pink'); setDialogView('list'); }}>
                                          <div className="absolute inset-0 bg-pink-500/20 rounded-full blur-xl group-hover:bg-pink-500/40 transition-colors" />
                                          <div className="absolute inset-0 rounded-full border border-pink-500/50 animate-ping opacity-50" />
                                          <div className="w-24 h-24 rounded-full bg-pink-500 flex items-center justify-center relative z-10 shadow-[0_0_30px_rgba(236,72,153,0.5)]">
                                             <Mic className="w-10 h-10 text-white" />
                                          </div>
                                       </div>
                                       
                                       <h4 className="text-2xl font-bold text-white mb-2 font-mono">00:00:00</h4>
                                       <p className="text-sm text-gray-400 mb-6 flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> 麦克风已就绪 (Default Input)
                                       </p>
                                       
                                       <div className="w-full max-w-md h-12 bg-white/5 rounded-lg border border-white/10 flex items-center px-4 gap-1 overflow-hidden">
                                          {/* Mock Audio Waveform */}
                                          {Array.from({ length: 40 }).map((_, i) => (
                                             <div key={i} className="flex-1 bg-pink-500/30 rounded-full transition-all duration-300" style={{ height: `${Math.max(10, Math.random() * 100)}%` }} />
                                          ))}
                                       </div>
                                    </div>
                                 </motion.div>
                              )}
                           </AnimatePresence>
                        </DialogContent>
                     </Dialog>
                  </div>
               )}
               {/* Track 3 */}
               <div className="h-14 border-b border-white/5 flex group hover:bg-white/[0.02]">
                  <div className="w-40 border-r border-white/10 bg-[#0c0c0e] p-3 flex items-center shrink-0 sticky left-0 z-30 shadow-[5px_0_10px_rgba(0,0,0,0.5)]">
                     <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs"><Type className="w-4 h-4" /> {t.track_lyrics}</div>
                  </div>
                  <div className="flex-1 relative bg-gradient-to-b from-black/0 to-yellow-900/5 flex items-center px-4 gap-1 py-2">
                     <div className="h-7 bg-yellow-500/20 border border-yellow-500/50 rounded text-[10px] text-yellow-200 flex items-center px-3 cursor-pointer hover:bg-yellow-500/40 shadow-sm ml-[10%]">Verse 1</div>
                     <div className="h-7 bg-yellow-500/20 border border-yellow-500/50 rounded text-[10px] text-yellow-200 flex items-center px-3 cursor-pointer hover:bg-yellow-500/40 shadow-sm ml-8">Chorus</div>
                     <div className="h-7 bg-yellow-500/20 border border-yellow-500/50 rounded text-[10px] text-yellow-200 flex items-center px-3 cursor-pointer hover:bg-yellow-500/40 shadow-sm ml-12">Verse 2</div>
                  </div>
               </div>
               
               {/* Playhead */}
               <div className="absolute top-0 bottom-0 left-[35%] w-px bg-cyan-400 z-40 shadow-[0_0_15px_rgba(34,211,238,1)] pointer-events-none">
                  <div className="w-3 h-3 bg-cyan-400 absolute -top-1.5 -left-1.5 flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                     <div className="w-1 h-1 bg-black rounded-full" />
                  </div>
                  <div className="absolute top-0 bottom-0 -left-4 w-8 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
               </div>
            </div>
         </div>
      </div>
   </div>
</div>
   );
}

// --- 4. Producer SaaS Dashboard ---
const ProducerDashboard = ({ onLogout, lang, setLang }: { onLogout: () => void, lang: Lang, setLang: (l: Lang) => void }) => {
  const t = TRANSLATIONS[lang].producer;
  const { theme } = useTheme();
  const themeStyles = themeConfig[theme].sidebar;
  const [activeSinger, setActiveSinger] = useState(MOCK_SINGERS[0]);
  const [activePage, setActivePage] = useState('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSongs, setGeneratedSongs] = useState([
     { id: 101, title: "Neon Tears", status: "Published", plays: "450k", date: "2024-03-10" },
     { id: 102, title: "Cyber City Vibe", status: "Draft", plays: "-", date: "2024-03-12" }
  ]);
  const [editingSong, setEditingSong] = useState<any>(null);
  const [personaParams, setPersonaParams] = useState({ sweetness: 50, energy: 80, mystery: 30 });

  // New states for enhanced interactions
  const [myArtists, setMyArtists] = useState(MOCK_SINGERS.slice(0, 5));
  const [signingArtist, setSigningArtist] = useState<any>(null);
  const [viewingArtist, setViewingArtist] = useState<any>(null);
  const [listingArtist, setListingArtist] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMusicGenerator, setShowMusicGenerator] = useState(false);
  const [showNFTMinting, setShowNFTMinting] = useState(false);
  const [selectedTrackForNFT, setSelectedTrackForNFT] = useState<any>(null);

  // Check if user has completed onboarding
  useEffect(() => {
    const completed = localStorage.getItem('onboarding_completed');
    if (!completed) {
      setTimeout(() => setShowOnboarding(true), 500);
    }
  }, []);

  const handleGenerateSong = () => {
     setIsGenerating(true);
     setTimeout(() => {
        setIsGenerating(false);
        const newSong = { id: Date.now(), title: "New Generated Track #" + Math.floor(Math.random()*100), status: "Draft", plays: "-", date: "Just now" };
        setGeneratedSongs([newSong, ...generatedSongs]);
        setEditingSong(newSong);
        setActivePage('editor');
     }, 2000);
  };

  // Handler for signing an artist
  const handleSignArtist = (artist: any) => {
     setMyArtists([...myArtists, { ...artist, id: Date.now(), signedDate: new Date().toISOString() }]);
  };

  // Handler for listing artist to market
  const handleListingSuccess = () => {
     // In real app, would update database and refresh listings
  };

  // Handler for music generation success
  const handleMusicGenerated = (track: any) => {
    setGeneratedSongs([track, ...generatedSongs]);
  };

  // Handler for NFT minting success
  const handleNFTMinted = () => {
    // In real app, would update blockchain records
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#09090b] text-white font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex w-64 border-r flex-col z-30 ${themeStyles.bg} ${themeStyles.border}`}>
        <div className={`h-16 flex items-center px-4 border-b gap-2 ${themeStyles.border}`}>
          <div className={`w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center ${themeStyles.glow}`}><Zap className="w-5 h-5 text-white" /></div><span className="font-bold text-lg tracking-tight">AI Studio Pro</span>
        </div>
        <div className={`p-4 border-b ${themeStyles.border}`}>
           <label className="text-[10px] text-gray-500 font-bold mb-3 block uppercase tracking-wider">{t.sidebar.switch}</label>
           <Dialog>
             <DialogTrigger asChild>
                <button className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 transition-colors group">
                   <div className="flex items-center gap-3">
                      <div className="relative"><Avatar className="w-10 h-10 rounded-lg border border-white/10"><AvatarImage src={activeSinger.avatar} /><AvatarFallback>{activeSinger.name[0]}</AvatarFallback></Avatar><div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#18181b] rounded-full"></div></div>
                      <div className="text-left"><div className="text-sm font-bold leading-none group-hover:text-cyan-400 transition-colors">{activeSinger.name}</div><div className="text-[10px] text-gray-400 mt-1.5 bg-white/5 px-1.5 py-0.5 rounded inline-block">{activeSinger.style}</div></div>
                   </div><ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
             </DialogTrigger>
             <DialogContent className="bg-[#18181b] border-white/10 text-white w-[90vw] md:w-full rounded-2xl">
                <DialogHeader><DialogTitle>{t.sidebar.switch}</DialogTitle><DialogDescription>Select Project</DialogDescription></DialogHeader>
                <div className="space-y-2 mt-2">{MOCK_SINGERS.map(singer => (<div key={singer.id} onClick={() => setActiveSinger(singer)} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent hover:border-cyan-500/30 transition-all"><Avatar className="w-12 h-12 rounded-lg"><AvatarImage src={singer.avatar} /></Avatar><div className="flex-1"><div className="font-bold text-base">{singer.name}</div><div className="text-xs text-gray-400 flex items-center gap-2 mt-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>{singer.style} • {singer.status}</div></div>{activeSinger.id === singer.id && <CheckCircle2 className="w-5 h-5 text-cyan-500" />}</div>))}<Button variant="outline" className="w-full border-dashed border-white/20 text-gray-400 hover:text-white hover:bg-white/5 h-12 mt-2"><Plus className="w-4 h-4 mr-2" /> {t.sidebar.new_project}</Button></div>
             </DialogContent>
           </Dialog>
        </div>
        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
           <ThemeSwitcher lang={lang} />
           <div className="h-2"></div>
           <SidebarItem icon={<LayoutDashboard />} label={t.sidebar.dashboard} id="overview" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
           <div className={`pt-4 pb-2 text-[10px] font-bold uppercase tracking-wider px-2 ${themeStyles.sectionTitle}`}>{t.sidebar.mcn}</div>
           <SidebarItem icon={<Fingerprint />} label={t.sidebar.incubator} id="persona" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
           <SidebarItem icon={<ShoppingBag />} label={t.sidebar.wardrobe} id="wardrobe" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
           <div className={`pt-4 pb-2 text-[10px] font-bold uppercase tracking-wider px-2 ${themeStyles.sectionTitle}`}>{t.sidebar.production}</div>
           <SidebarItem icon={<Mic2 />} label={t.sidebar.studio} id="studio" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
           <SidebarItem icon={<ShieldCheck />} label={lang === 'zh' ? "版权保护申请 (Copyright)" : "Apply Copyright"} id="copyright_apply" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
            <SidebarItem icon={<Rocket />} label={lang === 'zh' ? "全网发行 (Distribution)" : "Global Release"} id="distribution" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
            <SidebarItem icon={<Coins />} label={lang === 'zh' ? "资产上链铸造 (Mint)" : "Mint NFT Assets"} id="nft_mint" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
           <div className={`pt-4 pb-2 text-[10px] font-bold uppercase tracking-wider px-2 ${themeStyles.sectionTitle}`}>{t.sidebar.growth}</div>
           <SidebarItem icon={<Globe2 />} label={t.sidebar.dist} id="launch" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
           <SidebarItem icon={<Smile />} label={t.sidebar.community} id="community" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
           <SidebarItem icon={<Wallet />} label={t.sidebar.finance} id="earnings" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
        </div>
        <div className={`p-4 border-t bg-black/20 space-y-2 ${themeStyles.border}`}>
          <Button variant="ghost" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="w-full justify-start text-gray-500 hover:text-white"><GlobeIcon className="w-4 h-4 mr-2" /> {lang === 'zh' ? 'Switch to English' : '切换中文'}</Button>
          <Button variant="ghost" onClick={onLogout} className="w-full justify-start text-gray-500 hover:text-white hover:bg-red-500/10 hover:text-red-400 transition-colors"><LogOut className="w-4 h-4 mr-2" /> {t.sidebar.logout}</Button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 border-b border-white/10 bg-[#0c0c0e]/90 backdrop-blur-md z-30 shrink-0">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(8,145,178,0.5)]"><Zap className="w-4 h-4 text-white" /></div>
            <span className="font-bold text-lg tracking-tight">AI Studio</span>
         </div>
         <div className="flex items-center gap-3">
            <Dialog>
               <DialogTrigger asChild>
                  <button className="rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/50">
                     <Avatar className="w-8 h-8 rounded-lg border border-white/10 shadow-[0_0_10px_rgba(0,0,0,0.5)]"><AvatarImage src={activeSinger.avatar} /><AvatarFallback>{activeSinger.name[0]}</AvatarFallback></Avatar>
                  </button>
               </DialogTrigger>
               <DialogContent className="bg-[#18181b] border-white/10 text-white w-[90vw] rounded-2xl">
                  <DialogHeader><DialogTitle>{t.sidebar.switch}</DialogTitle><DialogDescription>Select Project</DialogDescription></DialogHeader>
                  <div className="space-y-2 mt-2">{MOCK_SINGERS.map(singer => (<div key={singer.id} onClick={() => setActiveSinger(singer)} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent hover:border-cyan-500/30 transition-all"><Avatar className="w-12 h-12 rounded-lg"><AvatarImage src={singer.avatar} /></Avatar><div className="flex-1"><div className="font-bold text-base">{singer.name}</div><div className="text-xs text-gray-400 flex items-center gap-2 mt-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>{singer.style}</div></div>{activeSinger.id === singer.id && <CheckCircle2 className="w-5 h-5 text-cyan-500" />}</div>))}</div>
                  <div className="pt-4 border-t border-white/10 mt-2 flex gap-2">
                     <Button variant="outline" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="flex-1 border-white/10"><GlobeIcon className="w-4 h-4 mr-2"/> {lang === 'zh' ? 'EN' : '中'}</Button>
                     <Button variant="outline" onClick={onLogout} className="flex-1 border-red-500/20 text-red-400 hover:bg-red-500/10"><LogOut className="w-4 h-4 mr-2"/> Exit</Button>
                  </div>
               </DialogContent>
            </Dialog>
         </div>
      </div>

      <main className="flex-1 overflow-y-auto relative bg-[#09090b] pb-24 md:pb-0">
         <header className="hidden md:flex h-16 border-b border-white/10 items-center justify-between px-8 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-20">
            <h2 className="text-lg font-medium text-white flex items-center gap-3"><span className="text-gray-500">Workspace /</span> <span className="capitalize">{activePage.replace('_', ' ')}</span></h2>
            <div className="flex items-center gap-4"><div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-400"><Cpu className="w-3 h-3" /><span>GPU Connected</span></div><div className="w-px h-6 bg-white/10"></div><Button size="sm" className="bg-white text-black hover:bg-gray-200 font-bold rounded-full"><Share2 className="w-3 h-3 mr-2" /> Export</Button></div>
         </header>
         <div className="p-6 md:p-10 pb-24 max-w-7xl mx-auto relative z-10">
            <AnimatePresence mode="wait">
               <motion.div key={activePage} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: "easeOut" }}>
                  {activePage === 'overview' && (
                     <div className="space-y-8">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
                           <div>
                              <div className="text-cyan-500 font-mono text-xs mb-2 tracking-widest uppercase flex items-center gap-2"><div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" /> AI Star Agency</div>
                              <h1 className="text-4xl font-black tracking-tight text-white mb-1">{lang === 'zh' ? '我的经纪公司' : 'My Agency'}</h1>
                              <p className="text-gray-400 font-medium">{lang === 'zh' ? '管理你的AI歌手矩阵，拓展艺人阵容，探索市场机会' : 'Manage your AI artist roster, expand your lineup, explore market opportunities'}</p>
                           </div>
                           <div className="flex gap-3">
                              <Button onClick={() => setActivePage('persona')} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black tracking-widest h-12 px-6 rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] transition-all hover:scale-[1.02]">
                                 <Plus className="w-5 h-5 mr-2" /> {lang === 'zh' ? '孵化新歌手' : 'Create New Artist'}
                              </Button>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                           {[
                              { label: lang === 'zh' ? '旗下艺人' : 'Artists', value: "8", icon: <Users className="w-5 h-5 text-purple-400"/>, change: "+2", glow: "group-hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] group-hover:border-purple-500/30" },
                              { label: lang === 'zh' ? '总播放量' : 'Total Plays', value: "4.2M", icon: <Music2 className="w-5 h-5 text-cyan-400"/>, change: "+24%", glow: "group-hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] group-hover:border-cyan-500/30" },
                              { label: lang === 'zh' ? '市场签约' : 'Market Signings', value: "3", icon: <ShoppingBag className="w-5 h-5 text-emerald-400"/>, change: "+1", glow: "group-hover:shadow-[0_0_30px_rgba(52,211,153,0.15)] group-hover:border-emerald-500/30" },
                              { label: lang === 'zh' ? '公司收益' : 'Company Revenue', value: "¥45k", icon: <Wallet className="w-5 h-5 text-pink-400"/>, change: "+12%", glow: "group-hover:shadow-[0_0_30px_rgba(244,114,182,0.15)] group-hover:border-pink-500/30" },
                           ].map((stat, i) => (
                              <Card key={i} className={`group bg-gradient-to-br from-white/[0.03] to-transparent border-white/10 hover:bg-white/[0.05] transition-all duration-500 relative overflow-hidden ${stat.glow}`}>
                                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
                                 <CardContent className="p-6 relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                       <div className="p-3 bg-black/50 rounded-xl border border-white/5 shadow-inner">{stat.icon}</div>
                                       <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">{stat.change}</Badge>
                                    </div>
                                    <div className="text-3xl font-black text-white mb-1 tracking-tight">{stat.value}</div>
                                    <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
                                 </CardContent>
                              </Card>
                           ))}
                        </div>

                        <Tabs defaultValue="my_artists" className="w-full">
                           <TabsList className="bg-black/60 border border-white/5 w-full md:w-auto rounded-xl p-1.5 gap-1.5">
                              <TabsTrigger value="my_artists" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 flex items-center gap-2 px-4">
                                 <Users className="w-4 h-4" />
                                 {lang === 'zh' ? '我孵化的艺人' : 'My Artists'}
                              </TabsTrigger>
                              <TabsTrigger value="market" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 flex items-center gap-2 px-4">
                                 <ShoppingBag className="w-4 h-4" />
                                 {lang === 'zh' ? '艺人市场' : 'Artist Market'}
                              </TabsTrigger>
                              <TabsTrigger value="listed" className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 flex items-center gap-2 px-4">
                                 <Globe2 className="w-4 h-4" />
                                 {lang === 'zh' ? '已发布到市场' : 'Listed Artists'}
                              </TabsTrigger>
                           </TabsList>

                           <TabsContent value="my_artists" className="mt-6 space-y-4">
                              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                 {myArtists.map((artist, idx) => (
                                    <motion.div key={artist.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
                                       <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 hover:border-purple-500/30 transition-all cursor-pointer group overflow-hidden relative">
                                          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                          <CardContent className="p-0">
                                             <div className="relative h-48 overflow-hidden">
                                                <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                                                <div className="absolute top-3 right-3"><Badge className="bg-emerald-500/80 text-white border-0 shadow-lg backdrop-blur-md">{lang === 'zh' ? '活跃' : 'Active'}</Badge></div>
                                                <div className="absolute bottom-4 left-4 right-4">
                                                   <h3 className="text-xl font-black text-white mb-1 tracking-tight drop-shadow-lg">{artist.name}</h3>
                                                   <p className="text-xs text-cyan-400 font-mono tracking-wider">{artist.style}</p>
                                                </div>
                                             </div>
                                             <div className="p-5 space-y-4">
                                                <div className="grid grid-cols-3 gap-3">
                                                   <div className="text-center p-3 rounded-lg bg-black/40 border border-white/5">
                                                      <div className="text-lg font-black text-white mb-1">{12 - idx * 2}</div>
                                                      <div className="text-[9px] text-gray-500 uppercase tracking-widest">{lang === 'zh' ? '作品' : 'Songs'}</div>
                                                   </div>
                                                   <div className="text-center p-3 rounded-lg bg-black/40 border border-white/5">
                                                      <div className="text-lg font-black text-cyan-400 mb-1">{(1.5 - idx * 0.2).toFixed(1)}M</div>
                                                      <div className="text-[9px] text-gray-500 uppercase tracking-widest">{lang === 'zh' ? '播放' : 'Plays'}</div>
                                                   </div>
                                                   <div className="text-center p-3 rounded-lg bg-black/40 border border-white/5">
                                                      <div className="text-lg font-black text-emerald-400 mb-1">¥{(15 - idx * 2).toFixed(1)}k</div>
                                                      <div className="text-[9px] text-gray-500 uppercase tracking-widest">{lang === 'zh' ? '收益' : 'Revenue'}</div>
                                                   </div>
                                                </div>
                                                <div className="flex gap-2">
                                                   <Button size="sm" variant="outline" className="flex-1 border-white/10 hover:bg-purple-500/20 hover:border-purple-500/50 hover:text-purple-300 text-xs h-9" onClick={() => setViewingArtist(artist)}>
                                                      <UserCircle className="w-3 h-3 mr-1" />{lang === 'zh' ? '查看' : 'View'}
                                                   </Button>
                                                   <Button size="sm" variant="outline" className="flex-1 border-white/10 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:text-cyan-300 text-xs h-9" onClick={() => { setActiveSinger(artist); setActivePage('studio'); }}>
                                                      <Music className="w-3 h-3 mr-1" />{lang === 'zh' ? '创作' : 'Create'}
                                                   </Button>
                                                </div>
                                             </div>
                                          </CardContent>
                                       </Card>
                                    </motion.div>
                                 ))}
                                 <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-2 border-dashed border-white/10 hover:border-purple-500/50 transition-all cursor-pointer group flex items-center justify-center min-h-[400px]" onClick={() => setActivePage('persona')}>
                                    <CardContent className="text-center p-8">
                                       <div className="w-20 h-20 rounded-full bg-purple-500/10 border-2 border-purple-500/30 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:bg-purple-500/20 group-hover:border-purple-500/50 transition-all">
                                          <Plus className="w-10 h-10 text-purple-400" />
                                       </div>
                                       <h3 className="text-xl font-bold text-white mb-2">{lang === 'zh' ? '孵化新AI歌手' : 'Create New AI Artist'}</h3>
                                       <p className="text-sm text-gray-500 mb-6">{lang === 'zh' ? '从零开始打造你的虚拟偶像' : 'Build your virtual idol from scratch'}</p>
                                       <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold">
                                          <Wand2 className="w-4 h-4 mr-2" />{lang === 'zh' ? '开始孵化' : 'Start Creating'}
                                       </Button>
                                    </CardContent>
                                 </Card>
                              </div>
                           </TabsContent>

                           <TabsContent value="market" className="mt-6 space-y-4">
                              <div className="mb-6 flex flex-col md:flex-row gap-4">
                                 <Input placeholder={lang === 'zh' ? '搜索艺人名称、风格...' : 'Search artist name, style...'} className="flex-1 bg-black/50 border-white/10 h-12 focus:border-cyan-500/50" />
                                 <div className="flex gap-2">
                                    <Button variant="outline" className="border-white/10 hover:bg-white/5 px-6 h-12">{lang === 'zh' ? '全部风格' : 'All Styles'}<ChevronDown className="w-4 h-4 ml-2" /></Button>
                                    <Button variant="outline" className="border-white/10 hover:bg-white/5 px-6 h-12">{lang === 'zh' ? '价格排序' : 'Price'}<ChevronDown className="w-4 h-4 ml-2" /></Button>
                                 </div>
                              </div>
                              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                 {[
                                    { id: 101, name: "Stella Vox", style: "Dream Pop", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400", songs: 20, followers: "45K", price: "¥8,800", owner: "StarLab Studio" },
                                    { id: 102, name: "Nyx Shadow", style: "Gothic Rock", avatar: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400", songs: 18, followers: "38K", price: "¥7,500", owner: "DarkWave Collective" },
                                    { id: 103, name: "Ray Beam", style: "Electro House", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400", songs: 25, followers: "52K", price: "¥9,900", owner: "Pulse Agency" },
                                    { id: 104, name: "Iris Flow", style: "Lo-fi Hip Hop", avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400", songs: 30, followers: "68K", price: "¥12,000", owner: "Chill Beats Co." },
                                 ].map((artist) => (
                                    <Card key={artist.id} className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer group overflow-hidden relative">
                                       <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                       <CardContent className="p-0">
                                          <div className="relative h-48 overflow-hidden">
                                             <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                             <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                                             <div className="absolute top-3 right-3"><Badge className="bg-cyan-500/80 text-white border-0 shadow-lg backdrop-blur-md">{lang === 'zh' ? '可签约' : 'Available'}</Badge></div>
                                             <div className="absolute bottom-4 left-4 right-4">
                                                <h3 className="text-xl font-black text-white mb-1 tracking-tight drop-shadow-lg">{artist.name}</h3>
                                                <p className="text-xs text-cyan-400 font-mono tracking-wider">{artist.style}</p>
                                             </div>
                                          </div>
                                          <div className="p-5 space-y-4">
                                             <div className="flex items-center justify-between text-xs text-gray-400">
                                                <span className="flex items-center gap-1"><UserCircle className="w-3 h-3" />{artist.owner}</span>
                                                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{artist.followers}</span>
                                             </div>
                                             <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                                                <span className="text-xs text-gray-400">{lang === 'zh' ? '签约价格' : 'Signing Price'}</span>
                                                <span className="text-xl font-black text-cyan-400 font-mono">{artist.price}</span>
                                             </div>
                                             <Button className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold h-10" onClick={() => setSigningArtist(artist)}>
                                                <ShoppingBag className="w-4 h-4 mr-2" />{lang === 'zh' ? '立即签约' : 'Sign Now'}
                                             </Button>
                                          </div>
                                       </CardContent>
                                    </Card>
                                 ))}
                              </div>
                           </TabsContent>

                           <TabsContent value="listed" className="mt-6 space-y-4">
                              <div className="mb-6 p-6 rounded-xl bg-gradient-to-r from-emerald-900/20 to-cyan-900/20 border border-emerald-500/20">
                                 <div className="flex items-start gap-4">
                                    <div className="p-3 bg-emerald-500/20 rounded-xl"><Globe2 className="w-6 h-6 text-emerald-400" /></div>
                                    <div className="flex-1">
                                       <h3 className="text-lg font-bold text-white mb-2">{lang === 'zh' ? '艺人市场发布' : 'Artist Market Listing'}</h3>
                                       <p className="text-sm text-gray-400 leading-relaxed mb-4">
                                          {lang === 'zh' ? '将你孵化的AI歌手发布到市场，让其他制作人可以签约合作。你将获得签约费用的80%作为收益，同时保留原创者身份标识。' : 'List your AI artists on the market for other producers to sign. You\'ll earn 80% of signing fees while retaining creator attribution.'}
                                       </p>
                                       <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold" onClick={() => setListingArtist(myArtists[0])}><Plus className="w-4 h-4 mr-2" />{lang === 'zh' ? '发布新艺人到市场' : 'List New Artist'}</Button>
                                    </div>
                                 </div>
                              </div>
                              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                 {MOCK_SINGERS.slice(1, 3).map((artist) => (
                                    <Card key={artist.id} className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 hover:border-emerald-500/30 transition-all group overflow-hidden relative">
                                       <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                       <CardContent className="p-0">
                                          <div className="relative h-48 overflow-hidden">
                                             <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                             <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                                             <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                                                <Badge className="bg-emerald-500/80 text-white border-0 shadow-lg backdrop-blur-md">{lang === 'zh' ? '市场中' : 'Listed'}</Badge>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-black/60 hover:bg-red-500/20 hover:text-red-400 backdrop-blur-md"><Settings className="w-4 h-4" /></Button>
                                             </div>
                                             <div className="absolute bottom-4 left-4 right-4">
                                                <h3 className="text-xl font-black text-white mb-1 tracking-tight drop-shadow-lg">{artist.name}</h3>
                                                <p className="text-xs text-emerald-400 font-mono tracking-wider">{artist.style}</p>
                                             </div>
                                          </div>
                                          <div className="p-5 space-y-4">
                                             <div className="grid grid-cols-2 gap-3">
                                                <div className="text-center p-3 rounded-lg bg-black/40 border border-white/5">
                                                   <div className="text-lg font-black text-cyan-400 mb-1">{Math.floor(Math.random() * 2000 + 800)}</div>
                                                   <div className="text-[9px] text-gray-500 uppercase tracking-widest">{lang === 'zh' ? '浏览量' : 'Views'}</div>
                                                </div>
                                                <div className="text-center p-3 rounded-lg bg-black/40 border border-white/5">
                                                   <div className="text-lg font-black text-purple-400 mb-1">{Math.floor(Math.random() * 10 + 3)}</div>
                                                   <div className="text-[9px] text-gray-500 uppercase tracking-widest">{lang === 'zh' ? '询价' : 'Inquiries'}</div>
                                                </div>
                                             </div>
                                             <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                                                <span className="text-xs text-gray-400">{lang === 'zh' ? '标价' : 'Price'}</span>
                                                <span className="text-lg font-black text-emerald-400 font-mono">¥{Math.floor(Math.random() * 5000 + 6000)}</span>
                                             </div>
                                             <div className="flex gap-2">
                                                <Button size="sm" variant="outline" className="flex-1 border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-300 text-xs h-9">
                                                   <BarChart3 className="w-3 h-3 mr-1" />{lang === 'zh' ? '数据' : 'Analytics'}
                                                </Button>
                                                <Button size="sm" variant="outline" className="flex-1 border-white/10 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 text-xs h-9">
                                                   <X className="w-3 h-3 mr-1" />{lang === 'zh' ? '下架' : 'Unlist'}
                                                </Button>
                                             </div>
                                          </div>
                                       </CardContent>
                                    </Card>
                                 ))}
                              </div>
                           </TabsContent>
                        </Tabs>
                     </div>
                  )}

                  {activePage === 'persona' && (
                     <AIIncubator 
                        lang={lang}
                        onBack={() => setActivePage('overview')}
                        activeSinger={activeSinger}
                        personaParams={personaParams}
                        setPersonaParams={setPersonaParams}
                     />
                  )}

                  {activePage === 'persona_old' && (
                     <div className="grid lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-5 space-y-6">
                           <div>
                              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4 uppercase tracking-widest"><Cpu className="w-3 h-3"/> Neural Link</div>
                              <h2 className="text-3xl font-black mb-2 tracking-tight">{t.persona.title}</h2>
                              <p className="text-gray-400 text-sm">{t.persona.desc}</p>
                           </div>
                           
                           <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 overflow-hidden shadow-2xl">
                              <Tabs defaultValue="text" className="w-full">
                                 <div className="p-2 border-b border-white/10 bg-black/40">
                                    <TabsList className="grid w-full grid-cols-3 bg-black/60 rounded-xl p-1 gap-1">
                                       <TabsTrigger value="text" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">{t.persona.modes.text}</TabsTrigger>
                                       <TabsTrigger value="img" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">{t.persona.modes.img}</TabsTrigger>
                                       <TabsTrigger value="hybrid" className="rounded-lg data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300">{t.persona.modes.hybrid}</TabsTrigger>
                                    </TabsList>
                                 </div>
                                 
                                 <TabsContent value="text" className="p-6 space-y-6 mt-0">
                                    <div className="space-y-4"><div className="flex justify-between text-sm font-bold text-gray-300"><span>{t.persona.sweet}</span><span className="text-cyan-400 font-mono">{personaParams.sweetness}%</span></div><Input type="range" className="accent-cyan-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer w-full hover:accent-cyan-400 transition-all" value={personaParams.sweetness} onChange={(e) => setPersonaParams({...personaParams, sweetness: parseInt(e.target.value)})} /></div>
                                    <div className="space-y-4"><div className="flex justify-between text-sm font-bold text-gray-300"><span>{t.persona.energy}</span><span className="text-purple-400 font-mono">{personaParams.energy}%</span></div><Input type="range" className="accent-purple-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer w-full hover:accent-purple-400 transition-all" value={personaParams.energy} onChange={(e) => setPersonaParams({...personaParams, energy: parseInt(e.target.value)})} /></div>
                                    <div className="space-y-4"><div className="flex justify-between text-sm font-bold text-gray-300"><span>{t.persona.mystery}</span><span className="text-indigo-400 font-mono">{personaParams.mystery}%</span></div><Input type="range" className="accent-indigo-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer w-full hover:accent-indigo-400 transition-all" value={personaParams.mystery} onChange={(e) => setPersonaParams({...personaParams, mystery: parseInt(e.target.value)})} /></div>
                                    <div className="space-y-2"><Label className="text-gray-400 uppercase text-[10px] font-bold tracking-wider">{t.persona.labels.text_prompt}</Label><Textarea placeholder="Silver hair, cybernetic eye, streetwear..." className="bg-black/50 border-white/10 h-20 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all" /></div>
                                    <div className="space-y-2"><Label className="text-red-400/80 uppercase text-[10px] font-bold tracking-wider">{t.persona.labels.neg_prompt}</Label><Input placeholder="Bad anatomy, blurry, low quality..." className="bg-red-950/10 border-red-900/30 text-sm focus:border-red-500/50" /></div>
                                    <div className="pt-4 border-t border-white/10"><Label className="text-gray-400 uppercase text-[10px] font-bold tracking-wider mb-3 block">{t.persona.keywords}</Label><div className="flex flex-wrap gap-2">{['Cyberpunk', 'Melancholy', 'Time Traveler'].map(tag => (<Badge key={tag} className="bg-white/5 hover:bg-white/10 cursor-pointer text-gray-300 border border-white/10 px-3 py-1">{tag} <X className="w-3 h-3 ml-2 opacity-50 hover:opacity-100 hover:text-red-400"/></Badge>))}</div></div>
                                 </TabsContent>
                                 
                                 <TabsContent value="img" className="p-6 space-y-6 mt-0">
                                    <div className="border-2 border-dashed border-white/10 rounded-xl h-48 flex flex-col items-center justify-center text-gray-500 hover:bg-cyan-950/20 hover:border-cyan-500/50 hover:text-cyan-400 transition-all cursor-pointer group"><div className="w-14 h-14 bg-white/5 group-hover:bg-cyan-500/20 rounded-full flex items-center justify-center mb-4 transition-all"><Plus className="w-6 h-6"/></div><span className="text-sm font-bold tracking-wide">{t.persona.labels.upload_ref}</span><span className="text-xs mt-1 opacity-50">Supports PNG, JPG (Max 5MB)</span></div>
                                    <div className="space-y-4"><div className="flex justify-between text-sm font-bold text-gray-300"><span>Reference Strength</span><span className="text-cyan-400 font-mono">75%</span></div><Input type="range" defaultValue={75} className="accent-cyan-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer w-full" /></div>
                                    <div className="space-y-2"><Label className="text-red-400/80 uppercase text-[10px] font-bold tracking-wider">{t.persona.labels.neg_prompt}</Label><Input placeholder="Deformed, ugly..." className="bg-red-950/10 border-red-900/30 text-sm focus:border-red-500/50" /></div>
                                 </TabsContent>
                                 
                                 <TabsContent value="hybrid" className="p-6 space-y-6 mt-0">
                                    <div className="flex gap-4"><div className="flex-1 border-2 border-dashed border-white/10 rounded-xl h-36 flex flex-col items-center justify-center text-gray-500 hover:border-pink-500/50 transition-all cursor-pointer relative overflow-hidden group shadow-inner"><div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400')] bg-cover opacity-40 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500" /><span className="relative z-10 bg-black/60 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-lg">Parent A</span></div><div className="flex-1 border-2 border-dashed border-white/10 rounded-xl h-36 flex flex-col items-center justify-center text-gray-500 hover:border-cyan-500/50 transition-all cursor-pointer relative overflow-hidden group shadow-inner"><div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400')] bg-cover opacity-40 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500" /><span className="relative z-10 bg-black/60 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-lg">Parent B</span></div></div>
                                    <div className="space-y-4"><div className="flex justify-between text-sm font-bold text-gray-300"><span>{t.persona.labels.mix_ratio}</span><span className="text-pink-400 font-mono">50/50</span></div><Input type="range" defaultValue={50} className="accent-pink-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer w-full hover:accent-pink-400" /><div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-500 font-bold"><span>More A</span><span>More B</span></div></div>
                                 </TabsContent>
                              </Tabs>
                           </Card>
                           <Button className="w-full h-14 text-lg font-bold bg-white text-black hover:bg-gray-200 shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all duration-300"><Wand2 className="w-5 h-5 mr-2" /> {t.persona.regen}</Button>
                        </div>
                        <div className="lg:col-span-7 bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-10 relative overflow-hidden flex flex-col items-center text-center shadow-2xl">
                           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-black/0 to-transparent pointer-events-none" />
                           <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />
                           
                           <div className="relative mb-8 group cursor-pointer">
                              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-purple-500 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                              <div className="w-56 h-56 rounded-full p-1.5 bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 relative z-10 animate-spin-slow" style={{ animationDuration: '10s' }}>
                                 <Avatar className="w-full h-full border-8 border-[#0c0c0e] rounded-full" style={{ animation: 'spin 10s linear infinite reverse' }}>
                                    <AvatarImage src={activeSinger.avatar} className="object-cover" />
                                    <AvatarFallback>AI</AvatarFallback>
                                 </Avatar>
                              </div>
                              <div className="absolute bottom-4 right-4 z-20 bg-black/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 flex items-center shadow-xl group-hover:scale-110 transition-transform"><Edit3 className="w-3 h-3 mr-1.5 text-cyan-400" /> EDIT</div>
                           </div>
                           <h2 className="text-4xl font-black text-white mb-2 tracking-tight drop-shadow-lg">{activeSinger.name}</h2>
                           <p className="text-cyan-400 font-mono tracking-widest text-sm mb-8 flex items-center gap-2"><Layers className="w-4 h-4"/> {activeSinger.style} Core v3.5</p>
                           
                           <div className="bg-black/60 rounded-2xl p-8 text-left w-full backdrop-blur-md border border-white/5 relative group hover:border-white/10 transition-colors">
                              <div className="absolute top-0 left-6 w-12 h-1 bg-cyan-500/50 group-hover:w-full group-hover:bg-cyan-500/30 transition-all duration-700" />
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Radio className="w-4 h-4 text-gray-400"/> {t.persona.bio_title}</h4>
                              <p className="text-gray-300 text-sm leading-relaxed font-medium">Born in the data streams of Sector 7, {activeSinger.name} is a synthesis of lost memories and future hopes. With a voice calibrated for {personaParams.sweetness > 50 ? 'emotional resonance' : 'piercing clarity'}, they wander the digital wasteland looking for the perfect melody.</p>
                           </div>
                        </div>
                     </div>
                  )}

                  {activePage === 'studio' && (
                     <div className="grid lg:grid-cols-12 gap-8 h-[calc(100vh-180px)]">
                        <div className="lg:col-span-4 flex flex-col gap-4">
                           <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 flex-1 flex flex-col shadow-2xl relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-50" />
                              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-xl"><Sparkles className="w-5 h-5 text-purple-400" /> {t.studio.title}</CardTitle></CardHeader>
                              <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden pt-2">
                                 <Tabs defaultValue="interactive" className="w-full flex-1 flex flex-col overflow-hidden">
                                    <div className="pb-4">
                                       <TabsList className="flex flex-wrap w-full bg-black/60 border border-white/5 shadow-inner h-auto gap-1.5 p-1.5 justify-start rounded-xl">
                                          {[
                                             {v:"interactive", l:t.studio.tabs.interactive}, {v:"text", l:t.studio.tabs.text}, {v:"lyrics", l:t.studio.tabs.lyrics},
                                             {v:"inspiration", l:t.studio.tabs.inspiration}, {v:"melody", l:t.studio.tabs.melody}, {v:"image", l:t.studio.tabs.image},
                                             {v:"remix", l:t.studio.tabs.remix}, {v:"fun", l:t.studio.tabs.fun}, {v:"acrostic", l:t.studio.tabs.acrostic}, {v:"gift", l:t.studio.tabs.gift}, {v:"advanced", l:t.studio.tabs.advanced}
                                          ].map(tab => (
                                             <TabsTrigger key={tab.v} value={tab.v} className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 data-[state=active]:border-purple-500/30 border border-transparent transition-all">{tab.l}</TabsTrigger>
                                          ))}
                                       </TabsList>
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                       <TabsContent value="text" className="space-y-4 mt-0"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.track_title}</Label><Input placeholder="e.g. Midnight Protocol" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.prompt_label}</Label><Textarea placeholder="Cyberpunk, Synthwave, Female Vocals..." className="bg-black/50 border-white/10 h-20 resize-none focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.lyrics_label}</Label><Textarea placeholder="..." className="bg-black/50 border-white/10 h-24 resize-none focus:border-purple-500/50" /></div></TabsContent>
                                       <TabsContent value="melody" className="space-y-4 mt-0"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.track_title}</Label><Input placeholder="e.g. Neon Echoes" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="border-2 border-dashed border-white/10 rounded-xl h-24 flex flex-col items-center justify-center text-gray-500 hover:bg-purple-900/10 hover:border-purple-500/50 hover:text-purple-400 transition-all cursor-pointer group"><div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center mb-2 group-hover:bg-purple-500/20 transition-colors"><Music2 className="w-4 h-4"/></div><span className="text-xs font-bold">{t.studio.upload_melody}</span></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.prompt_label}</Label><Textarea placeholder={t.studio.describe_style} className="bg-black/50 border-white/10 h-20 resize-none focus:border-purple-500/50" /></div></TabsContent>
                                       <TabsContent value="advanced" className="space-y-4 mt-0"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.track_title}</Label><Input placeholder="e.g. Sector 7 Anthem" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.song_structure}</Label><Input placeholder="Verse 1, Chorus..." className="bg-black/50 border-white/10 text-xs focus:border-purple-500/50" /></div><div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.bpm}</Label><Input placeholder="120" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.key}</Label><Input placeholder="Am" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div></div></TabsContent>
                                       <TabsContent value="interactive" className="space-y-4 mt-0"><div className="bg-black/50 rounded-xl p-5 h-40 flex flex-col justify-end border border-white/5 relative overflow-hidden"><div className="absolute top-4 left-4 flex gap-1"><div className="w-2 h-2 rounded-full bg-red-500/50"/><div className="w-2 h-2 rounded-full bg-yellow-500/50"/><div className="w-2 h-2 rounded-full bg-green-500/50"/></div><div className="text-sm text-cyan-400 mb-2 font-mono"><span className="opacity-50">&gt;</span> {t.studio.interactive_prompt} <span className="animate-pulse">_</span></div></div><div className="flex gap-2"><Input placeholder={t.studio.type_answer} className="bg-black/60 border-white/10 h-12 focus:border-cyan-500/50" /><Button size="icon" variant="outline" className="border-white/10 h-12 w-12 flex-shrink-0 hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/50"><ArrowRight className="w-5 h-5"/></Button></div></TabsContent>
                                       <TabsContent value="lyrics" className="space-y-4 mt-0"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.track_title}</Label><Input placeholder="e.g. Midnight Protocol" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.tabs.lyrics}</Label><Textarea placeholder={t.studio.lyrics_input} className="bg-black/50 border-white/10 h-32 resize-none focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.music_style}</Label><Input placeholder={t.studio.music_style} className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div></TabsContent>
                                       <TabsContent value="inspiration" className="space-y-4 mt-0"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.track_title}</Label><Input placeholder="e.g. Dream Scape" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.tabs.inspiration}</Label><Textarea placeholder={t.studio.idea_input} className="bg-black/50 border-white/10 h-24 resize-none focus:border-purple-500/50" /></div><Button variant="outline" className="w-full border-dashed border-white/20 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all"><Sparkles className="w-4 h-4 mr-2"/> {t.studio.feeling_lucky}</Button></TabsContent>
                                       <TabsContent value="image" className="space-y-4 mt-0"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.track_title}</Label><Input placeholder="e.g. Neon Vision" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="border-2 border-dashed border-white/10 rounded-xl h-32 flex flex-col items-center justify-center text-gray-500 hover:bg-cyan-900/10 hover:border-cyan-500/30 transition-all cursor-pointer group"><div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mb-2 group-hover:bg-cyan-500/20"><Search className="w-5 h-5 group-hover:text-cyan-400"/></div><span className="text-xs font-bold">{t.studio.upload_image}</span></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.extra_context}</Label><Input placeholder={t.studio.extra_context} className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div></TabsContent>
                                       <TabsContent value="remix" className="space-y-4 mt-0"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.track_title}</Label><Input placeholder="e.g. Cyber Remix" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.original_song}</Label><Input placeholder={t.studio.original_song} className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.tabs.remix}</Label><Input placeholder={t.studio.remix_target} className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div></TabsContent>
                                       <TabsContent value="fun" className="space-y-4 mt-0"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.track_title}</Label><Input placeholder="e.g. Meme Track" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.theme}</Label><select className="w-full bg-black/50 border border-white/10 rounded-md h-10 px-3 text-sm text-white focus:border-purple-500/50 outline-none"><option>洗脑神曲 (Brainwash Meme)</option><option>猫叫合唱团 (Cat Meowing)</option><option>8-bit 复古 (8-bit Retro)</option></select></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.core_phrase}</Label><Input placeholder="e.g. 'Never Gonna Give You Up'" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div></TabsContent>
                                       <TabsContent value="acrostic" className="space-y-4 mt-0"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.track_title}</Label><Input placeholder="e.g. Hidden Message" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.acrostic_hidden}</Label><Input placeholder={t.studio.acrostic_hidden} className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.acrostic_topic}</Label><Input placeholder={t.studio.acrostic_topic} className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div></TabsContent>
                                       <TabsContent value="gift" className="space-y-4 mt-0"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.track_title}</Label><Input placeholder="e.g. For You" className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.gift_to}</Label><Input placeholder={t.studio.gift_to} className="bg-black/50 border-white/10 focus:border-purple-500/50" /></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.gift_occasion}</Label><select className="w-full bg-black/50 border border-white/10 rounded-md h-10 px-3 text-sm text-white focus:border-purple-500/50 outline-none"><option>生日 (Birthday)</option><option>纪念日 (Anniversary)</option><option>安慰 (Cheer Up)</option></select></div></div><div className="space-y-2"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.studio.gift_message}</Label><Textarea placeholder={t.studio.gift_message} className="bg-black/50 border-white/10 h-20 resize-none focus:border-purple-500/50" /></div></TabsContent>
                                    </div>
                                 </Tabs>
                                 
                                 <div className="pt-2 mt-auto space-y-4 border-t border-white/10">
                                    {isGenerating && (
                                       <div className="h-14 bg-black/60 backdrop-blur-md rounded-xl flex items-center justify-center gap-1.5 px-4 border border-white/10 relative overflow-hidden shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                                          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-purple-500/20 animate-pulse" />
                                          {[...Array(24)].map((_, i) => (
                                             <motion.div key={i} className="w-1 bg-gradient-to-t from-cyan-400 to-purple-500 rounded-full" animate={{ height: [4, Math.random() * 24 + 8, 4] }} transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.03, ease: "easeInOut" }} />
                                          ))}
                                       </div>
                                    )}
                                    <Button onClick={handleGenerateSong} disabled={isGenerating} className={`w-full h-14 text-lg font-black tracking-wider transition-all duration-500 rounded-xl ${isGenerating ? 'bg-gray-900 text-gray-500 cursor-not-allowed border border-white/5' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_40px_rgba(168,85,247,0.6)] border border-purple-500/50 hover:scale-[1.02]'}`}>
                                       {isGenerating ? <span className="flex items-center gap-2"><Sparkles className="w-5 h-5 animate-spin text-purple-400" /> {t.studio.btn_generating}</span> : <><Wand2 className="w-5 h-5 mr-2"/> {t.studio.btn_gen}</>}
                                    </Button>
                                 </div>
                              </CardContent>
                           </Card>
                        </div>
                        
                        <div className="lg:col-span-8 flex flex-col bg-[#0c0c0e]/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
                           <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
                           <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40 backdrop-blur-md relative z-10">
                              <h3 className="font-black text-lg flex items-center gap-3 tracking-wide"><Library className="w-5 h-5 text-purple-400" /> {t.studio.library}</h3>
                              <Badge variant="outline" className="bg-purple-900/20 text-purple-300 border-purple-500/30 px-3 py-1 font-mono">Filter: All</Badge>
                           </div>
                           <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10 custom-scrollbar">
                              {generatedSongs.map((song) => (
                                 <motion.div key={song.id} onClick={() => { if(song.status !== 'Processing') { setEditingSong(song); setActivePage('editor'); } }} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="group flex items-center justify-between p-4 rounded-xl bg-black/40 hover:bg-white/5 border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer">
                                    <div className="flex items-center gap-5">
                                       <div className="w-14 h-14 bg-gray-900 rounded-xl flex items-center justify-center relative overflow-hidden group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all border border-white/5">
                                          {song.status === 'Processing' ? (<div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />) : (<Disc className={`w-7 h-7 ${song.status === 'Published' ? 'text-cyan-400' : 'text-gray-500'}`} />)}
                                          {song.status !== 'Processing' && (<div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Edit3 className="w-5 h-5 text-white shadow-lg" /></div>)}
                                       </div>
                                       <div>
                                          <div className="font-bold text-base text-white mb-1 group-hover:text-purple-300 transition-colors">{song.title}</div>
                                          <div className="text-xs text-gray-500 flex items-center gap-3 font-mono">{song.date} {song.status === 'Published' ? <Badge className="h-5 px-2 text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Published</Badge> : <Badge className="h-5 px-2 text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">Draft</Badge>}</div>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                       <div className="text-sm text-gray-500 font-mono hidden md:block">{song.plays !== '-' ? `${song.plays} plays` : ''}</div>
                                       <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full hover:bg-white/10 hover:text-cyan-400"><Share2 className="w-4 h-4" /></Button>
                                       </div>
                                    </div>
                                 </motion.div>
                              ))}
                           </div>
                        </div>
                     </div>
                  )}

                  {activePage === 'editor' && (
                     <AdvancedEditor song={editingSong} t={t.editor} onBack={() => { setEditingSong(null); setActivePage('studio'); }} />
                  )}

                  {activePage === 'launch' && (
                     <div className="grid lg:grid-cols-12 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-180px)]">
                        {/* ================= LEFT COLUMN: IP & Channels ================= */}
                        <div className="lg:col-span-8 space-y-8 pb-10">
                           {/* HEADER */}
                           <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-6">
                              <div>
                                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-4 uppercase tracking-widest"><Share2 className="w-3 h-3"/> Distribution Engine</div>
                                 <h2 className="text-4xl font-black mb-2 tracking-tight text-white drop-shadow-lg">全网分发与确权中心</h2>
                                 <p className="text-gray-400 text-sm leading-relaxed max-w-2xl">一键分发至全球流媒体平台、短视频矩阵及元宇宙演唱会，同步完成资产确权与溯源保护。</p>
                              </div>
                              <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black tracking-widest h-14 px-8 rounded-xl shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] transition-all hover:scale-[1.02] shrink-0">
                                 <Rocket className="w-5 h-5 mr-2" /> 一键全网发行
                              </Button>
                           </div>

                           {/* 资产确权与知识产权保护 */}
                           <div className="space-y-5">
                              <div className="flex items-center justify-between">
                                 <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                    资产确权与知识产权保护 (IP Protection)
                                 </h3>
                                 <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px] tracking-widest hidden md:inline-flex">全链路监控中</Badge>
                              </div>
                              <div className="grid md:grid-cols-3 gap-5">
                                 <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 relative overflow-hidden group hover:border-emerald-500/30 transition-all shadow-xl">
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <CardHeader className="pb-3">
                                       <CardTitle className="flex items-center gap-2 text-sm text-gray-200"><Fingerprint className="w-4 h-4 text-emerald-400"/> 模型与声纹确权</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                       <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5">
                                          <span className="font-medium text-xs text-gray-400">3D外观专利</span>
                                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px]">已注册</Badge>
                                       </div>
                                       <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5">
                                          <span className="font-medium text-xs text-gray-400">声纹区块链溯源</span>
                                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px]">保护中</Badge>
                                       </div>
                                    </CardContent>
                                 </Card>

                                 <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 relative overflow-hidden group hover:border-blue-500/30 transition-all shadow-xl">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <CardHeader className="pb-3">
                                       <CardTitle className="flex items-center gap-2 text-sm text-gray-200"><Music className="w-4 h-4 text-blue-400"/> 原创音乐与版权</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                       <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5">
                                          <span className="font-medium text-xs text-gray-400">ISRC 编码获取</span>
                                          <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10 text-[10px]">已获批</Badge>
                                       </div>
                                       <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5">
                                          <span className="font-medium text-xs text-gray-400">音频水印注入</span>
                                          <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10 text-[10px]">全网监控</Badge>
                                       </div>
                                    </CardContent>
                                 </Card>

                                 <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 relative overflow-hidden group hover:border-yellow-500/30 transition-all shadow-xl">
                                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <CardHeader className="pb-3">
                                       <CardTitle className="flex items-center gap-2 text-sm text-gray-200"><Smile className="w-4 h-4 text-yellow-400"/> 衍生品与美术资产</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                       <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5">
                                          <span className="font-medium text-xs text-gray-400">社交表情包</span>
                                          <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-[10px]">著作权保护</Badge>
                                       </div>
                                       <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5">
                                          <span className="font-medium text-xs text-gray-400">周边立绘插画</span>
                                          <Badge variant="outline" className="text-gray-500 border-white/10 text-[10px]">待上链</Badge>
                                       </div>
                                    </CardContent>
                                 </Card>
                              </div>
                           </div>

                           {/* 分发网络矩阵 */}
                           <div className="space-y-5 pt-4 border-t border-white/5">
                              <div className="flex items-center justify-between">
                                 <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                                    <GlobeIcon className="w-5 h-5 text-cyan-400" />
                                    全网渠道分发矩阵 (Distribution Channels)
                                 </h3>
                              </div>
                              <div className="grid md:grid-cols-2 gap-5">
                                 <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 relative overflow-hidden group hover:border-green-500/30 transition-all">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl" />
                                    <CardHeader className="p-5 pb-3">
                                       <CardTitle className="flex items-center justify-between text-sm">
                                          <span className="flex items-center gap-2 text-gray-200"><Music2 className="w-4 h-4 text-green-400" /> 流媒体音乐 (Web2)</span>
                                          <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">版税收集中</Badge>
                                       </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 pt-0 space-y-2">
                                       <div className="flex flex-wrap gap-2">
                                          {['Spotify', 'Apple Music', '网易云音乐', 'QQ��乐'].map(p => <Badge key={p} variant="outline" className="bg-white/5 text-gray-400 border-white/10 hover:text-white transition-colors">{p}</Badge>)}
                                       </div>
                                    </CardContent>
                                 </Card>

                                 <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
                                    <CardHeader className="p-5 pb-3">
                                       <CardTitle className="flex items-center justify-between text-sm">
                                          <span className="flex items-center gap-2 text-gray-200"><Video className="w-4 h-4 text-blue-400" /> 短视频流量矩阵</span>
                                          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">创作者激励</Badge>
                                       </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 pt-0 space-y-2">
                                       <div className="flex flex-wrap gap-2">
                                          {['YouTube Shorts', 'TikTok 全球', '抖音/快手星图'].map(p => <Badge key={p} variant="outline" className="bg-white/5 text-gray-400 border-white/10 hover:text-white transition-colors">{p}</Badge>)}
                                       </div>
                                    </CardContent>
                                 </Card>

                                 <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 relative overflow-hidden group hover:border-purple-500/30 transition-all">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl" />
                                    <CardHeader className="p-5 pb-3">
                                       <CardTitle className="flex items-center justify-between text-sm">
                                          <span className="flex items-center gap-2 text-gray-200"><Radio className="w-4 h-4 text-purple-400" /> 全天候 AI 虚拟直播</span>
                                          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] animate-pulse">● Live</Badge>
                                       </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 pt-0 space-y-2">
                                       <div className="flex flex-wrap gap-2">
                                          {['Twitch 虚拟区', 'Bilibili 虚拟主播', '抖音音乐直播'].map((p, i) => <Badge key={p} variant="outline" className={`bg-white/5 border-white/10 transition-colors ${i === 2 ? 'text-gray-600' : 'text-gray-400 hover:text-white'}`}>{p}</Badge>)}
                                       </div>
                                    </CardContent>
                                 </Card>

                                 <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 relative overflow-hidden group hover:border-pink-500/30 transition-all">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-3xl" />
                                    <CardHeader className="p-5 pb-3">
                                       <CardTitle className="flex items-center justify-between text-sm">
                                          <span className="flex items-center gap-2 text-gray-200"><Users className="w-4 h-4 text-pink-400" /> 私域粉丝群与元宇宙</span>
                                          <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/20 text-[10px]">AI 助理托管</Badge>
                                       </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 pt-0 space-y-2">
                                       <div className="flex flex-wrap gap-2">
                                          {['Discord (5.2k+)', '微信/QQ矩阵', 'Decentraland'].map(p => <Badge key={p} variant="outline" className="bg-white/5 text-gray-400 border-white/10 hover:text-white transition-colors">{p}</Badge>)}
                                       </div>
                                    </CardContent>
                                 </Card>
                              </div>
                           </div>
                        </div>

                        {/* ================= RIGHT COLUMN: Actions & History ================= */}
                        <div className="lg:col-span-4 flex flex-col gap-6">
                           {/* 数据总览与变现入口 */}
                           <Card className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 backdrop-blur-xl border-cyan-500/30 relative overflow-hidden group cursor-pointer hover:border-cyan-400 transition-all shadow-[0_0_30px_rgba(6,182,212,0.15)] flex-shrink-0">
                              <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl" />
                              <CardContent className="p-6 text-center">
                                 <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/30">
                                    <TrendingUp className="w-8 h-8 text-cyan-400" />
                                 </div>
                                 <h3 className="text-xl font-black text-white mb-2 tracking-wide">多维变现池总览</h3>
                                 <p className="text-xs text-cyan-100/70 mb-5 leading-relaxed">监控全局版税、短视频激励、直播打赏及打榜收益数据。</p>
                                 <Button variant="outline" onClick={() => setActivePage('earnings')} className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 w-full font-bold tracking-widest h-12 rounded-xl transition-all bg-black/20">
                                    查看财务报表
                                 </Button>
                              </CardContent>
                           </Card>

                           {/* 近期分发记录 */}
                           <Card className="flex-1 bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 flex flex-col overflow-hidden shadow-2xl relative">
                              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                              <CardHeader className="p-5 border-b border-white/5 bg-black/40">
                                 <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-300 tracking-wide">
                                    <Activity className="w-4 h-4 text-gray-400"/> 近期分发历史
                                 </CardTitle>
                              </CardHeader>
                              <CardContent className="p-0 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                                 <div className="divide-y divide-white/5">
                                    {[1,2,3,4,5].map(i => (
                                       <div key={i} className="flex items-center justify-between p-4 hover:bg-white/5 transition-all cursor-pointer group border-l-2 border-transparent hover:border-blue-500">
                                          <div className="flex items-center gap-4">
                                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${i === 1 ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-black border-white/10 group-hover:border-white/20'}`}>
                                                <Disc className={`w-5 h-5 ${i === 1 ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`} />
                                             </div>
                                             <div>
                                                <div className={`font-bold text-sm mb-0.5 transition-colors ${i === 1 ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>Neon Vision EP.0{i}</div>
                                                <div className="text-[10px] text-gray-500 font-mono flex items-center gap-2">
                                                   <span>2026-03-1{i}</span>
                                                   <span className="w-1 h-1 rounded-full bg-gray-600" />
                                                   <span>全网渠道</span>
                                                </div>
                                             </div>
                                          </div>
                                          <div className="text-right flex items-center gap-3">
                                             <div className="hidden sm:block">
                                                <div className={`font-black text-xs font-mono mb-0.5 ${i === 1 ? 'text-cyan-400' : 'text-gray-300'}`}>{12.5 - i*1.2}M+</div>
                                                <div className="text-[9px] text-gray-500 uppercase tracking-widest">播放量</div>
                                             </div>
                                             <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </CardContent>
                           </Card>
                        </div>
                     </div>
                  )}

                  {activePage === 'wardrobe' && (
                     <div className="grid lg:grid-cols-12 gap-8 h-[calc(100vh-180px)]">
                        {/* 3D Preview Area */}
                        <div className="lg:col-span-5 bg-[#0c0c0e]/80 border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col">
                           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent pointer-events-none" />
                           <div className="flex justify-between items-center mb-4 z-10">
                              <h3 className="text-xl font-bold tracking-tight">Virtual Fitting Room</h3>
                              <Badge variant="outline" className="border-cyan-500/50 text-cyan-400">Live Preview</Badge>
                           </div>
                           <div className="flex-1 relative rounded-xl border border-white/5 overflow-hidden group">
                              <img src="https://images.unsplash.com/photo-1650542687395-6bda9f32c733?w=1080" alt="Avatar" className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                              <div className="absolute bottom-4 left-4 right-4 flex gap-2 flex-wrap">
                                 <div className="p-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2 text-xs text-cyan-400"><Layers className="w-3 h-3"/> Active: Neuro-Jacket</div>
                                 <div className="p-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2 text-xs text-orange-400"><ShoppingBag className="w-3 h-3"/> Sponsor: Nexa Cola</div>
                              </div>
                           </div>
                        </div>
                        {/* Inventory & Sponsors */}
                        <div className="lg:col-span-7 flex flex-col gap-6">
                           <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                              <button className="text-sm font-bold text-cyan-400 border-b-2 border-cyan-400 pb-2">Wardrobe & Props (造型道具)</button>
                              <button className="text-sm font-bold text-gray-500 hover:text-white transition-colors pb-2">Brand Deals (商单资源库)</button>
                           </div>
                           <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto pr-2 custom-scrollbar">
                              <Card className="bg-black/40 border-white/10 hover:border-cyan-500/50 transition-all cursor-pointer group">
                                 <CardContent className="p-4 space-y-3">
                                    <div className="aspect-square rounded-lg overflow-hidden bg-white/5 relative">
                                       <img src="https://images.unsplash.com/photo-1766052631095-c16328022120?w=500" alt="Prop" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                       <div className="absolute top-2 right-2 p-1 bg-black/60 rounded backdrop-blur-md"><Badge className="bg-cyan-500/20 text-cyan-400 text-[8px] border-0">Equipped</Badge></div>
                                    </div>
                                    <div>
                                       <div className="font-bold text-sm">Sonic Headset</div>
                                       <div className="text-xs text-gray-400">Cyberware +15</div>
                                    </div>
                                 </CardContent>
                              </Card>
                              <Card className="bg-black/40 border-orange-500/30 hover:border-orange-500 transition-all cursor-pointer group relative overflow-hidden">
                                 <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/20 rounded-full blur-xl" />
                                 <CardContent className="p-4 space-y-3 relative z-10">
                                    <div className="aspect-square rounded-lg overflow-hidden bg-white/5 relative">
                                       <img src="https://images.unsplash.com/photo-1616702681329-aec13ba8548e?w=500" alt="Sponsor" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                       <div className="absolute top-2 right-2"><Badge className="bg-orange-500/80 text-white text-[8px] border-0 shadow-[0_0_10px_#f97316]">Sponsor</Badge></div>
                                    </div>
                                    <div>
                                       <div className="font-bold text-sm text-orange-400">Nexa Cola Promo</div>
                                       <div className="text-xs text-gray-400 flex items-center gap-1 mt-1"><Coins className="w-3 h-3 text-yellow-500"/> +¥0.5 / view</div>
                                    </div>
                                 </CardContent>
                              </Card>
                           </div>
                           <div className="mt-auto bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6 rounded-2xl border border-white/10 flex items-center justify-between">
                              <div>
                                 <h4 className="font-bold mb-1">Content Monetization Ready</h4>
                                 <p className="text-xs text-gray-400">Equip sponsored items to generate revenue on next MV publish.</p>
                              </div>
                              <Button className="bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]">Apply Look to MV <ArrowRight className="w-4 h-4 ml-2"/></Button>
                           </div>
                        </div>
                     </div>
                  )}

                  {activePage === 'community' && (
                     <div className="grid lg:grid-cols-12 gap-8 h-[calc(100vh-180px)]">
                        <div className="lg:col-span-8 space-y-6 flex flex-col h-full">
                           <div className="flex items-center justify-between">
                              <div>
                                 <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">Fan DAO & Community <Badge className="bg-purple-500/20 text-purple-400 border-0">Live</Badge></h2>
                                 <p className="text-sm text-gray-400 mt-1">Manage fan interactions, voting quests, and airdrops.</p>
                              </div>
                              <Button className="bg-purple-600 hover:bg-purple-500 text-white"><Plus className="w-4 h-4 mr-2"/> New DAO Vote</Button>
                           </div>
                           <Card className="bg-[#0c0c0e]/80 border-white/10 flex-1 flex flex-col overflow-hidden">
                              <div className="p-4 border-b border-white/10 flex gap-4 bg-black/40">
                                 <Badge variant="outline" className="border-purple-500/50 text-purple-400 bg-purple-500/10">Active Votes</Badge>
                                 <Badge variant="outline" className="border-white/10 text-gray-400 hover:bg-white/5 cursor-pointer">Fan Feed</Badge>
                                 <Badge variant="outline" className="border-white/10 text-gray-400 hover:bg-white/5 cursor-pointer">Top Holders</Badge>
                              </div>
                              <div className="p-6 space-y-6 overflow-y-auto">
                                 <div className="p-5 rounded-xl border border-purple-500/30 bg-purple-500/5 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Globe2 className="w-24 h-24 text-purple-400"/></div>
                                    <div className="relative z-10">
                                       <div className="flex items-center gap-2 mb-2"><Flame className="w-4 h-4 text-orange-500"/><span className="text-xs font-bold text-orange-500 uppercase tracking-widest">Ending in 12h</span></div>
                                       <h4 className="text-xl font-bold mb-2">Next Single Genre Decision</h4>
                                       <p className="text-sm text-gray-400 mb-6">Let the badge holders decide what style our next track should be.</p>
                                       <div className="space-y-4">
                                          <div>
                                             <div className="flex justify-between text-sm mb-1"><span>Synthwave</span><span className="font-mono">68%</span></div>
                                             <Progress value={68} className="h-2 bg-black/50" />
                                          </div>
                                          <div>
                                             <div className="flex justify-between text-sm mb-1"><span>Cyber-Metal</span><span className="font-mono">32%</span></div>
                                             <Progress value={32} className="h-2 bg-black/50" />
                                          </div>
                                       </div>
                                       <div className="mt-6 flex items-center gap-4 pt-4 border-t border-white/10">
                                          <div className="flex -space-x-2">
                                             <Avatar className="w-6 h-6 border-2 border-[#18181b]"><AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"/></Avatar>
                                             <Avatar className="w-6 h-6 border-2 border-[#18181b]"><AvatarImage src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100"/></Avatar>
                                             <Avatar className="w-6 h-6 border-2 border-[#18181b]"><AvatarImage src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100"/></Avatar>
                                          </div>
                                          <span className="text-xs text-gray-400">1,204 fans voted</span>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </Card>
                        </div>
                        <div className="lg:col-span-4 space-y-6">
                           <Card className="bg-[#0c0c0e]/80 border-white/10 p-6">
                              <h3 className="font-bold text-sm tracking-widest text-gray-400 uppercase mb-6">Fan Analytics</h3>
                              <div className="space-y-6">
                                 <div>
                                    <div className="text-xs text-gray-500 mb-1">Active Community Members</div>
                                    <div className="text-3xl font-black text-white">42,890</div>
                                    <div className="text-xs text-green-400 mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> +12% this week</div>
                                 </div>
                                 <div className="w-full h-[1px] bg-white/10" />
                                 <div>
                                    <div className="text-xs text-gray-500 mb-1">Top Fan Demographics</div>
                                    <div className="space-y-2 mt-3">
                                       <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-500"/> Neo-Tokyo</span><span className="font-mono text-gray-400">45%</span></div>
                                       <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"/> Sector 7</span><span className="font-mono text-gray-400">30%</span></div>
                                    </div>
                                 </div>
                              </div>
                           </Card>
                        </div>
                     </div>
                  )}

                  {activePage === 'copyright_apply' && (
                     <div className="grid lg:grid-cols-2 gap-10 h-[calc(100vh-180px)]">
                        <div className="space-y-6 overflow-y-auto pr-4 custom-scrollbar">
                           <div>
                              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold mb-4 uppercase tracking-widest"><ShieldCheck className="w-3 h-3"/> {lang === 'zh' ? '版权与合规声明' : 'Copyright & Compliance'}</div>
                              <h2 className="text-3xl font-black mb-2 tracking-tight">{lang === 'zh' ? 'AI 音乐发行合规注册' : 'AI Music Registration'}</h2>
                              <p className="text-gray-400 text-sm leading-relaxed">{lang === 'zh' ? '为 AI 辅助创作的音乐进行版权固证与合规标注，提供分轨文件和商用授权证明，即可解锁全球全平台发行与收益通道。' : 'Provide copyright securing and compliance tags for AI-assisted music. Upload stems and commercial licenses to unlock global distribution and royalties.'}</p>
                           </div>

                           <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                              <CardContent className="p-8 space-y-6 relative z-10">
                                 <div className="space-y-3">
                                    <Label className="text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'zh' ? '作品基本信息' : 'Work Info'}</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                       <Input placeholder={lang === 'zh' ? "作品名称 (如: Cyber Lullaby)" : "Title (e.g. Cyber Lullaby)"} className="bg-black/50 border-white/10 h-12 focus:border-cyan-500/50 transition-colors" />
                                       <Input placeholder={lang === 'zh' ? "使用的 AI 工具 (如: Suno Pro)" : "AI Tool (e.g. Suno Pro)"} className="bg-black/50 border-white/10 h-12 focus:border-cyan-500/50 transition-colors" />
                                    </div>
                                 </div>
                                 
                                 <div className="space-y-3">
                                    <Label className="text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'zh' ? 'AI 创作声明 (必选)' : 'AI Creation Declaration'}</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                       <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-black/40 cursor-pointer hover:border-cyan-500/50 transition-all has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                          <div className="mt-0.5"><input type="radio" name="ai_type" className="w-4 h-4 accent-cyan-500 bg-transparent border-white/20" /></div>
                                          <div>
                                             <div className="text-sm font-bold text-white mb-1">{lang === 'zh' ? '纯 AI 生成' : 'Pure AI Generated'}</div>
                                             <div className="text-[10px] text-gray-500 leading-tight">{lang === 'zh' ? '仅使用提示词生成，无传统版权收益，仅获平台曝光。' : 'Generated via prompts only. No traditional royalties.'}</div>
                                          </div>
                                       </label>
                                       <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-black/40 cursor-pointer hover:border-cyan-500/50 transition-all has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                          <div className="mt-0.5"><input type="radio" name="ai_type" defaultChecked className="w-4 h-4 accent-cyan-500 bg-transparent border-white/20" /></div>
                                          <div>
                                             <div className="text-sm font-bold text-white mb-1">{lang === 'zh' ? '人类 + AI 协同' : 'Human + AI Co-creation'}</div>
                                             <div className="text-[10px] text-gray-500 leading-tight">{lang === 'zh' ? '人类提供词曲/思路，持有完整商用授权，可正常获利。' : 'Human provided lyrics/melody. Full commercial rights.'}</div>
                                          </div>
                                       </label>
                                    </div>
                                 </div>

                                 <div className="space-y-3">
                                    <Label className="text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'zh' ? '合规物料上传' : 'Compliance Materials Upload'}</Label>
                                    <div className="grid grid-cols-3 gap-4">
                                       <div className="border-2 border-dashed border-white/10 rounded-xl h-32 flex flex-col items-center justify-center text-gray-500 hover:bg-cyan-950/20 hover:border-cyan-500/50 hover:text-cyan-400 transition-all cursor-pointer">
                                          <UploadCloud className="w-6 h-6 mb-2"/>
                                          <span className="text-xs font-bold">{lang === 'zh' ? '分轨文件/母带' : 'Stems/Master'}</span>
                                          <span className="text-[9px] mt-1 text-gray-600">WAV ZIP</span>
                                       </div>
                                       <div className="border-2 border-dashed border-white/10 rounded-xl h-32 flex flex-col items-center justify-center text-gray-500 hover:bg-cyan-950/20 hover:border-cyan-500/50 hover:text-cyan-400 transition-all cursor-pointer">
                                          <FileText className="w-6 h-6 mb-2"/>
                                          <span className="text-xs font-bold">{lang === 'zh' ? '商用授权证明' : 'License Proof'}</span>
                                          <span className="text-[9px] mt-1 text-gray-600">Pro版截图/PDF</span>
                                       </div>
                                       <div className="border-2 border-dashed border-white/10 rounded-xl h-32 flex flex-col items-center justify-center text-gray-500 hover:bg-cyan-950/20 hover:border-cyan-500/50 hover:text-cyan-400 transition-all cursor-pointer">
                                          <Square className="w-6 h-6 mb-2"/>
                                          <span className="text-xs font-bold">{lang === 'zh' ? '高清专辑封面' : 'Cover Art'}</span>
                                          <span className="text-[9px] mt-1 text-gray-600">3000x3000px</span>
                                       </div>
                                    </div>
                                 </div>
                                 
                                 <div className="space-y-3">
                                    <Label className="text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'zh' ? '实名/KYC认证' : 'KYC Authentication'}</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                       <Input placeholder={lang === 'zh' ? "真实姓名/企业名称" : "Real Name / Entity"} className="bg-black/50 border-white/10 h-12 focus:border-cyan-500/50" />
                                       <Input placeholder={lang === 'zh' ? "证件号" : "ID Number"} className="bg-black/50 border-white/10 h-12 focus:border-cyan-500/50" type="password" />
                                    </div>
                                 </div>

                                 <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                       <span className="text-gray-400">{lang === 'zh' ? '全网防重版权固证费' : 'Copyright Hash Fee'}</span>
                                       <span className="font-mono text-white">¥ 29.90</span>
                                    </div>
                                    <div className="h-px w-full bg-white/10 my-2" />
                                    <div className="flex justify-between items-center text-lg font-bold">
                                       <span className="text-white">{lang === 'zh' ? '实付金额' : 'Total'}</span>
                                       <span className="font-mono text-cyan-400">¥ 29.90</span>
                                    </div>
                                 </div>

                                 <Button className="w-full h-14 bg-gradient-to-r from-cyan-600 to-blue-600 font-black tracking-wider text-white shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_50px_rgba(6,182,212,0.5)] border border-cyan-500/50 hover:scale-[1.02] transition-all duration-300 rounded-xl">
                                    <ShieldCheck className="w-5 h-5 mr-2" /> {lang === 'zh' ? '提交固证 & 支付' : 'Submit & Pay'}
                                 </Button>
                              </CardContent>
                           </Card>
                        </div>

                        <div className="flex flex-col gap-8">
                           <div className="bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col shadow-2xl relative overflow-hidden h-full">
                              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-black/0 to-transparent pointer-events-none" />
                              <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                                 <Activity className="w-4 h-4"/> {lang === 'zh' ? '确权进度追踪流水线' : 'Registration Pipeline'}
                              </h3>
                              
                              <div className="flex-1 space-y-10 relative before:absolute before:inset-y-0 before:left-[15px] before:w-[2px] before:bg-white/5">
                                 <div className="relative flex gap-6 group">
                                    <div className="w-8 h-8 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)] flex items-center justify-center relative z-10 shrink-0 group-hover:scale-110 transition-transform">
                                       <Check className="w-4 h-4 text-black" />
                                    </div>
                                    <div className="pt-1">
                                       <h4 className="text-sm font-bold text-white mb-1">{lang === 'zh' ? '文件哈希上链' : 'File Hash On-chain'}</h4>
                                       <p className="text-xs text-gray-500 mb-2">TxID: 0x8f3c...9a12</p>
                                       <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 bg-cyan-500/10 uppercase tracking-wider text-[9px] font-bold">Completed</Badge>
                                    </div>
                                 </div>

                                 <div className="relative flex gap-6 group">
                                    <div className="w-8 h-8 rounded-full border-2 border-cyan-500 bg-black flex items-center justify-center relative z-10 shrink-0">
                                       <RefreshCw className="w-3 h-3 text-cyan-500 animate-spin" />
                                    </div>
                                    <div className="pt-1">
                                       <h4 className="text-sm font-bold text-white mb-1">{lang === 'zh' ? 'AI 音源特征比对' : 'AI Audio Feature Match'}</h4>
                                       <p className="text-xs text-gray-500 mb-2 leading-relaxed">{lang === 'zh' ? '正在全网数据库交叉比对旋律重合度，确保原创性...' : 'Cross-checking melody overlap in global DB for originality...'}</p>
                                       <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 uppercase tracking-wider text-[9px] font-bold">Processing (45%)</Badge>
                                    </div>
                                 </div>

                                 <div className="relative flex gap-6 opacity-40">
                                    <div className="w-8 h-8 rounded-full border-2 border-white/20 bg-black flex items-center justify-center relative z-10 shrink-0">
                                       <FileText className="w-3 h-3 text-gray-400" />
                                    </div>
                                    <div className="pt-1">
                                       <h4 className="text-sm font-bold text-white mb-1">{lang === 'zh' ? '版权局人工初审' : 'Manual Review'}</h4>
                                       <p className="text-xs text-gray-500">{lang === 'zh' ? '预计等待 3-5 个工作日' : 'Est. 3-5 working days'}</p>
                                    </div>
                                 </div>

                                 <div className="relative flex gap-6 opacity-40">
                                    <div className="w-8 h-8 rounded-full border-2 border-white/20 bg-black flex items-center justify-center relative z-10 shrink-0">
                                       <Award className="w-3 h-3 text-gray-400" />
                                    </div>
                                    <div className="pt-1">
                                       <h4 className="text-sm font-bold text-white mb-1">{lang === 'zh' ? '下发电子版权证书' : 'Issue E-Certificate'}</h4>
                                       <p className="text-xs text-gray-500">{lang === 'zh' ? '全球互认确权' : 'Globally recognized ownership'}</p>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  )}

                  {activePage === 'distribution' && (
                     <DistributionPage songs={generatedSongs} lang={lang} />
                  )}

                  {activePage === 'distribution_old' && (
                     <div className="grid lg:grid-cols-2 gap-10 h-[calc(100vh-180px)]">
                        <div className="space-y-6 overflow-y-auto pr-4 custom-scrollbar">
                           <div>
                              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4 uppercase tracking-widest"><Rocket className="w-3 h-3"/> {lang === 'zh' ? '流媒体分发引擎' : 'Distribution Engine'}</div>
                              <h2 className="text-3xl font-black mb-2 tracking-tight">{lang === 'zh' ? '全网发行 & 多平台分发' : 'Global Distribution'}</h2>
                              <p className="text-gray-400 text-sm leading-relaxed">{lang === 'zh' ? '一键分发至腾讯AI专属通道（启明星）与全球流媒体平台，开启你的AI音乐传播之旅。' : 'One-click distribution to Tencent AI channel and global DSPs. Start your AI music journey.'}</p>
                           </div>

                           {/* 平台账号绑定状态 */}
                           <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                              <CardHeader className="pb-4">
                                 <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-200">
                                    <Settings className="w-4 h-4 text-blue-400" />
                                    {lang === 'zh' ? '平台账号授权管理' : 'Platform Account Authorization'}
                                 </CardTitle>
                                 <p className="text-xs text-gray-500 mt-1">{lang === 'zh' ? '绑定发行商与流媒体平台账号，解锁自动化分发功能' : 'Connect distributor & DSP accounts to unlock automated distribution'}</p>
                              </CardHeader>
                              <CardContent className="space-y-3 relative z-10">
                                 {/* DistroKid 账号 */}
                                 <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-all group">
                                    <div className="flex items-center gap-4">
                                       <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                                          <Music2 className="w-6 h-6 text-white" />
                                       </div>
                                       <div>
                                          <div className="text-sm font-bold text-white mb-0.5">DistroKid</div>
                                          <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                             <span className="text-emerald-400 font-mono">已连接 · artist@demo.com</span>
                                          </div>
                                       </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10">
                                       {lang === 'zh' ? '解绑' : 'Disconnect'}
                                    </Button>
                                 </div>

                                 {/* 腾讯音乐人账号 */}
                                 <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5 hover:border-blue-500/30 transition-all group">
                                    <div className="flex items-center gap-4">
                                       <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                                          <Globe className="w-6 h-6 text-white" />
                                       </div>
                                       <div>
                                          <div className="text-sm font-bold text-white mb-0.5">{lang === 'zh' ? '腾讯音乐人 (启明星)' : 'Tencent Music'}</div>
                                          <div className="text-[10px] text-gray-500">{lang === 'zh' ? '未连接 · 需授权访问' : 'Not connected · Auth required'}</div>
                                       </div>
                                    </div>
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white h-9 px-4 text-xs font-bold">
                                       <Plus className="w-3 h-3 mr-1" />
                                      {lang === 'zh' ? '立即授权' : 'Authorize'}
                                    </Button>
                                 </div>

                                 {/* Spotify for Artists */}
                                 <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5 hover:border-green-500/30 transition-all group">
                                    <div className="flex items-center gap-4">
                                       <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                                          <Disc className="w-6 h-6 text-white" />
                                       </div>
                                       <div>
                                          <div className="text-sm font-bold text-white mb-0.5">Spotify for Artists</div>
                                          <div className="text-[10px] text-gray-500">{lang === 'zh' ? '可选 · 用于追踪播放数据' : 'Optional · For analytics tracking'}</div>
                                       </div>
                                    </div>
                                    <Button size="sm" variant="outline" className="border-white/10 hover:bg-green-500/10 hover:border-green-500/50 hover:text-green-400 h-9 px-4 text-xs">
                                       {lang === 'zh' ? '连接' : 'Connect'}
                                    </Button>
                                 </div>

                                 {/* 网易云音乐人 */}
                                 <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5 hover:border-red-500/30 transition-all group">
                                    <div className="flex items-center gap-4">
                                       <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg">
                                          <Music className="w-6 h-6 text-white" />
                                       </div>
                                       <div>
                                          <div className="text-sm font-bold text-white mb-0.5">{lang === 'zh' ? '网易云音乐人' : 'NetEase Music'}</div>
                                          <div className="text-[10px] text-gray-500">{lang === 'zh' ? '未连接 · 需手机号验证' : 'Not connected · Phone verification required'}</div>
                                       </div>
                                    </div>
                                    <Button size="sm" variant="outline" className="border-white/10 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 h-9 px-4 text-xs">
                                       {lang === 'zh' ? '绑定' : 'Bind'}
                                    </Button>
                                 </div>

                                 <div className="pt-3 mt-2 border-t border-white/5">
                                    <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                       <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                          <Check className="w-3 h-3 text-blue-400" />
                                       </div>
                                       <p className="text-xs text-blue-200/80 leading-relaxed">
                                          {lang === 'zh' 
                                             ? '✓ 已连接 DistroKid，可发行至全球 150+ 平台\n✓ 仍需绑定国内平台以解锁 AI 专属通道' 
                                             : '✓ DistroKid connected - 150+ platforms unlocked\n✓ Domestic platforms needed for AI-exclusive channels'}
                                       </p>
                                    </div>
                                 </div>
                              </CardContent>
                           </Card>

                           <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                              <CardContent className="p-8 space-y-6 relative z-10">
                                 
                                 <div className="space-y-3">
                                    <Label className="text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'zh' ? '选择发行渠道' : 'Distribution Channels'}</Label>
                                    <div className="grid grid-cols-1 gap-4">
                                       <label className="flex flex-col gap-3 p-5 rounded-xl border border-white/10 bg-black/40 cursor-pointer hover:border-purple-500/50 transition-all has-[:checked]:border-purple-500 has-[:checked]:bg-purple-500/10 group">
                                          <div className="flex items-center justify-between">
                                             <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                                                   <Globe className="w-5 h-5 text-white" />
                                                </div>
                                                <div>
                                                   <div className="font-bold text-white text-sm mb-1">{lang === 'zh' ? '国内AI专属通道' : 'Domestic AI Channel'}</div>
                                                   <div className="text-[10px] text-gray-500">腾讯音乐「启明星」/ 网易云音乐人</div>
                                                </div>
                                             </div>
                                             <input type="checkbox" defaultChecked className="w-5 h-5 accent-purple-500 bg-transparent border-white/20 rounded" />
                                          </div>
                                          <div className="pl-13 text-xs text-gray-400 leading-relaxed border-l-2 border-purple-500/20 pl-4 group-has-[:checked]:border-purple-500/50 transition-colors">
                                             {lang === 'zh' 
                                                ? '✓ 自动标记「AI创作」标签\n✓ QQ音乐、酷狗、酷我同步上架\n✓ 平台播放激励金（每万次播放约¥30-80）\n✓ 支持纯AI生成作品发行' 
                                                : '✓ Auto-tag "AI Created"\n✓ QQ Music, Kugou, Kuwo sync\n✓ Platform play incentives\n✓ Pure AI works supported'}
                                          </div>
                                       </label>

                                       <label className="flex flex-col gap-3 p-5 rounded-xl border border-white/10 bg-black/40 cursor-pointer hover:border-purple-500/50 transition-all has-[:checked]:border-purple-500 has-[:checked]:bg-purple-500/10 group">
                                          <div className="flex items-center justify-between">
                                             <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                                   <Globe2 className="w-5 h-5 text-white" />
                                                </div>
                                                <div>
                                                   <div className="font-bold text-white text-sm mb-1">{lang === 'zh' ? '全球流媒体发行' : 'Global DSPs'}</div>
                                                   <div className="text-[10px] text-gray-500">DistroKid / TuneCore / CD Baby</div>
                                                </div>
                                             </div>
                                             <input type="checkbox" defaultChecked className="w-5 h-5 accent-purple-500 bg-transparent border-white/20 rounded" />
                                          </div>
                                          <div className="pl-13 text-xs text-gray-400 leading-relaxed border-l-2 border-emerald-500/20 pl-4 group-has-[:checked]:border-emerald-500/50 transition-colors">
                                             {lang === 'zh'
                                                ? '✓ Spotify, Apple Music, YouTube Music, Amazon Music\n✓ 150+ 平台同步发行\n✓ 赚取流媒体版税（需商业授权）\n✓ 支持 ISRC 与 UPC 国际标准码' 
                                                : '✓ Spotify, Apple Music, YouTube Music, Amazon\n✓ 150+ platforms sync\n✓ Earn streaming royalties\n✓ ISRC & UPC support'}
                                          </div>
                                       </label>

                                       <label className="flex flex-col gap-3 p-5 rounded-xl border border-white/10 bg-black/40 cursor-pointer hover:border-purple-500/50 transition-all has-[:checked]:border-purple-500 has-[:checked]:bg-purple-500/10 group">
                                          <div className="flex items-center justify-between">
                                             <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
                                                   <Youtube className="w-5 h-5 text-white" />
                                                </div>
                                                <div>
                                                   <div className="font-bold text-white text-sm mb-1">{lang === 'zh' ? '短视频矩阵打歌' : 'Short Video Matrix'}</div>
                                                   <div className="text-[10px] text-gray-500">抖音 / TikTok / 快手 / Instagram Reels</div>
                                                </div>
                                             </div>
                                             <input type="checkbox" className="w-5 h-5 accent-purple-500 bg-transparent border-white/20 rounded" />
                                          </div>
                                          <div className="pl-13 text-xs text-gray-400 leading-relaxed border-l-2 border-pink-500/20 pl-4 group-has-[:checked]:border-pink-500/50 transition-colors">
                                             {lang === 'zh'
                                                ? '✓ AI 自动生成 15s/30s/60s 竖屏切片\n✓ 批量发布至多平台矩阵账号\n✓ 算法优化标题、话题标签\n✓ 引流至完整版 & NFT 购买页' 
                                                : '✓ Auto-generate 15s/30s/60s vertical clips\n✓ Batch post to matrix accounts\n✓ Algorithm-optimized titles & hashtags\n✓ Drive traffic to full version & NFT'}
                                          </div>
                                       </label>
                                    </div>
                                 </div>

                                 <div className="w-full h-px bg-white/10" />

                                 <div className="space-y-3">
                                    <Label className="text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'zh' ? '发行时间设置' : 'Release Schedule'}</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                       <Input type="date" className="bg-black/50 border-white/10 h-12 focus:border-purple-500/50 transition-colors" />
                                       <Input type="time" className="bg-black/50 border-white/10 h-12 focus:border-purple-500/50 transition-colors" />
                                    </div>
                                 </div>

                                 <div className="space-y-3">
                                    <Label className="text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'zh' ? '预发售 / Pre-save 活动' : 'Pre-save Campaign'}</Label>
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                                       <div className="flex items-center gap-3">
                                          <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><Zap className="w-5 h-5"/></div>
                                          <div>
                                             <div className="text-sm font-bold text-gray-200 mb-1">{lang === 'zh' ? '开启预存活动' : 'Enable Pre-save'}</div>
                                             <div className="text-[10px] text-gray-500">{lang === 'zh' ? '提前15天开启预约，积累首发热度' : 'Start 15 days early to build momentum'}</div>
                                          </div>
                                       </div>
                                       <Switch className="data-[state=checked]:bg-purple-500" />
                                    </div>
                                 </div>

                                 <Button className="w-full h-14 bg-gradient-to-r from-purple-600 to-blue-600 font-black tracking-wider text-white shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_50px_rgba(168,85,247,0.5)] border border-purple-500/50 hover:scale-[1.02] transition-all duration-300 rounded-xl">
                                    <Rocket className="w-5 h-5 mr-2" /> {lang === 'zh' ? '提交发行审核' : 'Submit for Review'}
                                 </Button>
                              </CardContent>
                           </Card>
                        </div>

                        <div className="flex flex-col gap-6">
                           <div className="bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-black/0 to-transparent pointer-events-none" />
                              <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
                                 <Activity className="w-4 h-4"/> {lang === 'zh' ? '发行进度追踪' : 'Release Pipeline'}
                              </h3>
                              
                              <div className="space-y-8 relative before:absolute before:inset-y-0 before:left-[15px] before:w-[2px] before:bg-white/5 z-10">
                                 <div className="relative flex gap-6 group">
                                    <div className="w-8 h-8 rounded-full bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] flex items-center justify-center relative z-10 shrink-0 group-hover:scale-110 transition-transform">
                                       <Check className="w-4 h-4 text-black" />
                                    </div>
                                    <div className="pt-1 flex-1">
                                       <h4 className="text-sm font-bold text-white mb-1">{lang === 'zh' ? '内容审核通过' : 'Content Approved'}</h4>
                                       <p className="text-xs text-gray-500 mb-2">{lang === 'zh' ? '已通过平台内容政策检测' : 'Passed platform content policy'}</p>
                                       <Badge variant="outline" className="text-purple-400 border-purple-500/30 bg-purple-500/10 uppercase tracking-wider text-[9px] font-bold">Completed</Badge>
                                    </div>
                                 </div>

                                 <div className="relative flex gap-6 group">
                                    <div className="w-8 h-8 rounded-full border-2 border-purple-500 bg-black flex items-center justify-center relative z-10 shrink-0">
                                       <RefreshCw className="w-3 h-3 text-purple-500 animate-spin" />
                                    </div>
                                    <div className="pt-1 flex-1">
                                       <h4 className="text-sm font-bold text-white mb-1">{lang === 'zh' ? '元数据编码中' : 'Encoding Metadata'}</h4>
                                       <p className="text-xs text-gray-500 mb-2 leading-relaxed">{lang === 'zh' ? '正在为各平台生成 ISRC、UPC 标准码及封面尺寸适配...' : 'Generating ISRC, UPC codes and cover adaptations...'}</p>
                                       <Progress value={72} className="h-2 mb-2 bg-white/5" />
                                       <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 uppercase tracking-wider text-[9px] font-bold">Processing 72%</Badge>
                                    </div>
                                 </div>

                                 <div className="relative flex gap-6 opacity-40">
                                    <div className="w-8 h-8 rounded-full border-2 border-white/20 bg-black flex items-center justify-center relative z-10 shrink-0">
                                       <Globe2 className="w-3 h-3 text-gray-400" />
                                    </div>
                                    <div className="pt-1">
                                       <h4 className="text-sm font-bold text-white mb-1">{lang === 'zh' ? '分发至各平台' : 'Distribute to Platforms'}</h4>
                                       <p className="text-xs text-gray-500">{lang === 'zh' ? '预计 2-5 个工作日陆续上架' : 'Est. 2-5 days to go live'}</p>
                                    </div>
                                 </div>

                                 <div className="relative flex gap-6 opacity-40">
                                    <div className="w-8 h-8 rounded-full border-2 border-white/20 bg-black flex items-center justify-center relative z-10 shrink-0">
                                       <CheckCircle2 className="w-3 h-3 text-gray-400" />
                                    </div>
                                    <div className="pt-1">
                                       <h4 className="text-sm font-bold text-white mb-1">{lang === 'zh' ? '全平台上线' : 'Live on All Platforms'}</h4>
                                       <p className="text-xs text-gray-500">{lang === 'zh' ? '开始累积播放与收益' : 'Start earning streams & royalties'}</p>
                                    </div>
                                 </div>
                              </div>
                           </div>

                           <div className="flex-1 bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                              <div className="p-5 border-b border-white/10 font-black text-sm tracking-widest text-gray-300 flex items-center gap-2 bg-black/40">
                                 <TrendingUp className="w-4 h-4 text-emerald-500"/> {lang === 'zh' ? '已发行作品' : 'Released Tracks'}
                              </div>
                              <div className="p-3 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                 {[
                                    { title: 'Cyber Lullaby', platforms: 8, streams: '234K' },
                                    { title: 'Neon Dreams', platforms: 6, streams: '189K' },
                                    { title: 'Digital Horizon', platforms: 5, streams: '156K' },
                                 ].map((track, i) => (
                                    <div key={i} className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer group border border-transparent hover:border-white/5">
                                       <div className="relative">
                                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                                             <Music className="w-6 h-6 text-purple-400" />
                                          </div>
                                          <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/10 group-hover:ring-purple-500/50 transition-colors" />
                                       </div>
                                       <div className="flex-1">
                                          <div className="font-bold text-sm text-gray-200 group-hover:text-white transition-colors mb-1">{track.title}</div>
                                          <div className="text-[10px] text-gray-500 flex gap-3 font-mono">
                                             <span className="text-purple-400">{track.platforms} Platforms</span>
                                             <span className="text-emerald-400">{track.streams} Streams</span>
                                          </div>
                                       </div>
                                       <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-white transition-colors" />
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </div>
                  )}

                  {activePage === 'nft_mint' && (
                     <div className="grid lg:grid-cols-2 gap-10 h-[calc(100vh-180px)]">
                        <div className="space-y-6 overflow-y-auto pr-4 custom-scrollbar">
                           <div>
                              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold mb-4 uppercase tracking-widest"><Flame className="w-3 h-3"/> {lang === 'zh' ? '区块链资产引擎' : 'Blockchain Asset Engine'}</div>
                              <h2 className="text-3xl font-black mb-2 tracking-tight">{lang === 'zh' ? '资产上链铸造 & NFT发行' : 'Mint On-Chain Assets & NFT'}</h2>
                              <p className="text-gray-400 text-sm leading-relaxed">{lang === 'zh' ? '将AI音乐作品铸造为限量电子勋章NFT，为粉丝提供独一无二的数字收藏品，开启Web3粉丝经济新模式。' : 'Mint AI music as limited NFT badges. Create unique digital collectibles for fans and unlock Web3 fan economy.'}</p>
                           </div>
                           <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
                              <CardContent className="p-8 space-y-6 relative z-10">
                                 
                                 <div className="space-y-3"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'zh' ? 'NFT 系列信息' : 'NFT Collection Info'}</Label><Input placeholder={lang === 'zh' ? "系列名称 (如: Cyber Dreams Genesis)" : "Collection Name (e.g. Cyber Dreams Genesis)"} className="bg-black/50 border-white/10 h-12 focus:border-pink-500/50 transition-colors" /></div>
                                 <div className="space-y-3"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.mint.upload_label}</Label><div className="border-2 border-dashed border-white/10 rounded-2xl h-32 flex flex-col items-center justify-center text-gray-500 hover:bg-pink-950/20 hover:border-pink-500/50 hover:text-pink-400 transition-all cursor-pointer group"><div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mb-2 group-hover:bg-pink-500/20 transition-all"><Plus className="w-5 h-5"/></div><span className="text-sm font-bold tracking-wide">{t.mint.upload_text}</span></div></div>
                                 <div className="grid grid-cols-2 gap-6"><div className="space-y-3"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.mint.supply}</Label><Input type="number" defaultValue="100" className="bg-black/50 border-white/10 h-12 font-mono focus:border-pink-500/50" /></div><div className="space-y-3"><Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.mint.price}</Label><div className="relative"><span className="absolute left-4 top-3 text-gray-500">¥</span><Input type="number" defaultValue="19.9" className="bg-black/50 border-white/10 h-12 pl-8 font-mono focus:border-pink-500/50" /></div></div></div>
                                 <div className="space-y-4">
                                    <Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.mint.perks}</Label>
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors group">
                                       <div className="flex items-center gap-3"><div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Disc className="w-4 h-4"/></div><div className="text-xs font-bold text-gray-200">{t.mint.perk_audio}</div></div><Switch defaultChecked className="data-[state=checked]:bg-emerald-500" />
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors group">
                                       <div className="flex items-center gap-3"><div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><MessageSquare className="w-4 h-4"/></div><div className="text-xs font-bold text-gray-200">{t.mint.perk_discord}</div></div><Switch className="data-[state=checked]:bg-purple-500" />
                                    </div>
                                 </div>
                                 <Button className="w-full h-14 mt-4 bg-gradient-to-r from-pink-600 to-orange-600 font-black tracking-wider text-white shadow-[0_0_30px_rgba(244,63,94,0.3)] hover:shadow-[0_0_50px_rgba(244,63,94,0.5)] border border-pink-500/50 hover:scale-[1.02] transition-all duration-300 rounded-xl"><Coins className="w-5 h-5 mr-2" /> {lang === 'zh' ? '审核上架 & 铸造发行' : 'Submit Review & Mint'}</Button>
                              </CardContent>
                           </Card>
                        </div>
                        <div className="flex flex-col gap-8">
                           <div className="bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl relative overflow-hidden">
                              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-900/20 via-black/0 to-transparent pointer-events-none" />
                              <h3 className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-8 flex items-center justify-center gap-2"><Fingerprint className="w-4 h-4"/> {t.mint.preview}</h3>
                              <div className="w-72 mx-auto perspective-1000">
                                 <div className="relative aspect-[3/4] bg-black rounded-2xl border-2 border-white/10 shadow-[0_0_50px_rgba(244,63,94,0.2)] overflow-hidden group hover:rotate-y-12 hover:-rotate-x-12 hover:scale-105 transition-all duration-700 ease-out-expo cursor-pointer">
                                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500')] bg-cover bg-center opacity-90 group-hover:scale-110 transition-transform duration-1000" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000" />
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-pink-500/20 via-transparent to-transparent mix-blend-overlay" />
                                    <div className="absolute top-5 left-5"><Badge className="bg-pink-600 border-0 shadow-[0_0_20px_rgba(244,63,94,0.6)] px-3 py-1 font-bold tracking-wider">Series #1</Badge></div>
                                    <div className="absolute top-5 right-5 w-8 h-8 rounded-full border border-white/20 flex items-center justify-center backdrop-blur-md bg-white/5"><Crown className="w-4 h-4 text-white"/></div>
                                    <div className="absolute bottom-6 left-6 right-6 text-left">
                                       <h4 className="text-3xl font-black text-white mb-2 tracking-tight drop-shadow-md">Genesis Card</h4>
                                       <div className="flex justify-between items-center"><p className="text-xs font-bold text-pink-400 tracking-wider">EDITION OF 100</p><p className="text-xs font-mono text-gray-300">#001</p></div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                           <div className="flex-1 bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                              <div className="p-5 border-b border-white/10 font-black text-sm tracking-widest text-gray-300 flex items-center gap-2 bg-black/40"><Flame className="w-4 h-4 text-orange-500"/> {t.mint.active}</div>
                              <div className="p-3 space-y-2 overflow-y-auto custom-scrollbar">
                                 {[1,2,3].map(i => (
                                    <div key={i} className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer group border border-transparent hover:border-white/5">
                                       <div className="relative"><img src={`https://images.unsplash.com/photo-${1600000000000 + i * 999}?w=100`} className="w-14 h-14 rounded-lg object-cover shadow-lg" /><div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/10 group-hover:ring-pink-500/50 transition-colors" /></div>
                                       <div className="flex-1">
                                          <div className="font-bold text-sm text-gray-200 group-hover:text-white transition-colors mb-1">Neon Badge #{i}</div>
                                          <div className="text-[10px] text-gray-500 flex gap-3 font-mono"><span>PRICE: ¥19.9</span><span className="text-cyan-400">SOLD: {45+i*12}/100</span></div>
                                       </div>
                                       <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-white transition-colors" />
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </div>
                  )}

                  {activePage === 'earnings' && (
                     <div className="space-y-8">
                        <div className="flex flex-col md:flex-row gap-6">
                           <Card className="flex-1 bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 relative overflow-hidden shadow-2xl group">
                              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-700" />
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-50" />
                              <CardHeader className="pb-2"><CardTitle className="text-gray-400 text-xs uppercase tracking-widest flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-400"/> {t.earnings.balance}</CardTitle></CardHeader>
                              <CardContent className="relative z-10">
                                 <div className="text-5xl font-black mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 drop-shadow-sm font-mono">¥ 45,290.00</div>
                                 <div className="flex gap-4">
                                    <Button className="flex-1 h-12 bg-white text-black hover:bg-gray-200 font-bold tracking-wide shadow-[0_0_20px_rgba(255,255,255,0.1)]">{t.earnings.withdraw}</Button>
                                    <Button variant="outline" className="flex-1 h-12 border-white/10 hover:bg-white/5 font-bold tracking-wide">Add Funds</Button>
                                 </div>
                              </CardContent>
                           </Card>
                           
                           <Card className="flex-[2] bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden relative">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />
                              <CardHeader className="pb-0"><CardTitle className="text-sm uppercase tracking-widest text-gray-300">{t.earnings.source_title}</CardTitle></CardHeader>
                              <CardContent className="h-48 flex items-center justify-around">
                                  <div className="text-center group cursor-pointer"><div className="w-24 h-24 rounded-full border-4 border-cyan-500/30 group-hover:border-cyan-400 flex items-center justify-center text-2xl font-black mb-4 transition-colors shadow-[0_0_30px_rgba(6,182,212,0.1)] group-hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] bg-cyan-950/20 text-cyan-400 font-mono">65%</div><div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300">{t.earnings.source_stream}</div></div>
                                  <div className="text-center group cursor-pointer"><div className="w-20 h-20 rounded-full border-4 border-purple-500/30 group-hover:border-purple-400 flex items-center justify-center text-xl font-black mb-4 transition-colors shadow-[0_0_30px_rgba(168,85,247,0.1)] group-hover:shadow-[0_0_40px_rgba(168,85,247,0.3)] bg-purple-950/20 text-purple-400 font-mono">25%</div><div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300">{t.earnings.source_nft}</div></div>
                                  <div className="text-center group cursor-pointer"><div className="w-16 h-16 rounded-full border-4 border-pink-500/30 group-hover:border-pink-400 flex items-center justify-center text-lg font-black mb-4 transition-colors shadow-[0_0_30px_rgba(244,63,94,0.1)] group-hover:shadow-[0_0_40px_rgba(244,63,94,0.3)] bg-pink-950/20 text-pink-400 font-mono">10%</div><div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300">{t.earnings.source_tips}</div></div>
                              </CardContent>
                           </Card>
                        </div>

                        <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden relative">
                           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gray-500/50 to-transparent opacity-50" />
                           <CardHeader className="bg-black/40 border-b border-white/5"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><BarChart3 className="w-4 h-4 text-gray-400"/> {t.earnings.history_title}</CardTitle></CardHeader>
                           <CardContent className="p-0">
                              <div className="overflow-x-auto">
                                 <table className="w-full text-sm text-left">
                                    <thead className="bg-white/[0.02] text-gray-400 border-b border-white/5">
                                       <tr>
                                          <th className="p-5 font-bold text-[10px] uppercase tracking-widest">{t.earnings.col_date}</th>
                                          <th className="p-5 font-bold text-[10px] uppercase tracking-widest">{t.earnings.col_desc}</th>
                                          <th className="p-5 font-bold text-[10px] uppercase tracking-widest">{t.earnings.col_amount}</th>
                                          <th className="p-5 font-bold text-[10px] uppercase tracking-widest text-right">{t.earnings.col_status}</th>
                                       </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                       {TRANSACTIONS.map(tx => (
                                          <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors group">
                                             <td className="p-5 font-mono text-gray-500 text-xs">{tx.date}</td>
                                             <td className="p-5 font-bold text-gray-300 group-hover:text-white transition-colors">{tx.desc}</td>
                                             <td className={`p-5 font-black font-mono tracking-wider ${tx.amount.startsWith('+') ? 'text-emerald-400' : 'text-white'}`}>{tx.amount}</td>
                                             <td className="p-5 text-right"><Badge variant="outline" className={`border-0 px-3 py-1 font-bold tracking-wide ${tx.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>{tx.status}</Badge></td>
                                          </tr>
                                       ))}
                                    </tbody>
                                 </table>
                              </div>
                           </CardContent>
                        </Card>
                     </div>
                  )}

                  {activePage !== 'overview' && activePage !== 'persona' && activePage !== 'studio' && activePage !== 'badge' && activePage !== 'earnings' && (
                     <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center h-[70vh] text-center max-w-lg mx-auto relative"
                     >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-black/0 to-transparent pointer-events-none" />
                        <div className="relative mb-10 group">
                           <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full group-hover:bg-red-500/40 transition-all duration-700" />
                           <div className="w-28 h-28 bg-[#0c0c0e] rounded-3xl flex items-center justify-center border-2 border-red-500/30 relative z-10 shadow-[0_0_50px_rgba(239,68,68,0.2)] group-hover:scale-105 group-hover:border-red-400 transition-all duration-500">
                              <Lock className="w-12 h-12 text-red-500" />
                           </div>
                           <div className="absolute -top-3 -right-3 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full border-2 border-[#0c0c0e] shadow-lg tracking-widest z-20">LOCKED</div>
                        </div>
                        
                        <h3 className="text-4xl font-black text-white mb-4 tracking-tight">{t.locked.title}</h3>
                        <p className="text-gray-400 mb-10 leading-relaxed max-w-sm text-sm">{t.locked.desc}</p>
                        
                        <div className="grid grid-cols-2 gap-4 w-full">
                           <Button variant="outline" onClick={() => setActivePage('overview')} className="h-14 border-white/10 hover:bg-white/5 font-bold tracking-wider rounded-xl">
                              {t.locked.back}
                           </Button>
                           <Button className="h-14 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black tracking-widest border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.3)] rounded-xl hover:scale-[1.02] transition-all">
                              <Zap className="w-5 h-5 mr-2 fill-current" /> UPGRADE
                           </Button>
                        </div>
                        
                        <div className="mt-12 pt-8 border-t border-white/10 w-full relative">
                           <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#09090b] px-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">Enterprise Access</div>
                           <div className="flex justify-center gap-8 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700 mt-4">
                                 <div className="flex flex-col items-center gap-3"><div className="p-3 rounded-full bg-cyan-950/30 border border-cyan-900/50"><Globe className="w-5 h-5 text-cyan-500" /></div><span className="text-[9px] font-bold tracking-widest text-gray-400">GLOBAL NODES</span></div>
                                 <div className="flex flex-col items-center gap-3"><div className="p-3 rounded-full bg-purple-950/30 border border-purple-900/50"><Cpu className="w-5 h-5 text-purple-500" /></div><span className="text-[9px] font-bold tracking-widest text-gray-400">DEDICATED GPU</span></div>
                                 <div className="flex flex-col items-center gap-3"><div className="p-3 rounded-full bg-pink-950/30 border border-pink-900/50"><Fingerprint className="w-5 h-5 text-pink-500" /></div><span className="text-[9px] font-bold tracking-widest text-gray-400">KYC ACCESS</span></div>
                           </div>
                        </div>
                     </motion.div>
                  )}
               </motion.div>
            </AnimatePresence>
         </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[88px] bg-[#0c0c0e]/95 backdrop-blur-xl border-t border-white/10 z-40 flex items-center justify-around shadow-[0_-10px_40px_rgba(0,0,0,0.5)] px-[8px] pt-[8px] pb-[0px]">
         {[
            { id: 'overview', icon: <LayoutDashboard className="w-6 h-6" />, label: lang === 'zh' ? '总览' : 'Home' },
            { id: 'persona', icon: <Fingerprint className="w-6 h-6" />, label: lang === 'zh' ? '孵化' : 'AI' },
            { id: 'studio', icon: <Mic2 className="w-6 h-6" />, label: lang === 'zh' ? '制作' : 'Studio' },
            { id: 'distribution', icon: <Rocket className="w-6 h-6" />, label: lang === 'zh' ? '发行' : 'Release' },
            { id: 'nft_mint', icon: <Coins className="w-6 h-6" />, label: lang === 'zh' ? '铸造' : 'Mint' },
         ].map(item => (
            <button key={item.id} onClick={() => setActivePage(item.id)} className={`flex flex-col items-center justify-center w-16 gap-1.5 transition-all ${activePage === item.id ? 'text-cyan-400 scale-110' : 'text-gray-500 hover:text-gray-300'}`}>
                {item.icon}
                <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
            </button>
         ))}
      </div>

      {/* Dialog Components */}
      <ArtistSigningDialog
        artist={signingArtist}
        isOpen={!!signingArtist}
        onClose={() => setSigningArtist(null)}
        onSuccess={handleSignArtist}
        lang={lang}
      />

      <ArtistDetailDialog
        artist={viewingArtist}
        isOpen={!!viewingArtist}
        onClose={() => setViewingArtist(null)}
        lang={lang}
        onCreateMusic={() => {
          if (viewingArtist) {
            setActiveSinger(viewingArtist);
            setActivePage('studio');
            setViewingArtist(null);
          }
        }}
      />

      <ArtistListingDialog
        artist={listingArtist}
        isOpen={!!listingArtist}
        onClose={() => setListingArtist(null)}
        onSuccess={handleListingSuccess}
        lang={lang}
      />

      <OnboardingGuide
        isOpen={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
        lang={lang}
        onNavigate={(page) => setActivePage(page)}
      />

      <MusicGenerationDialog
        isOpen={showMusicGenerator}
        onClose={() => setShowMusicGenerator(false)}
        onSuccess={handleMusicGenerated}
        lang={lang}
      />

      <NFTMintingDialog
        isOpen={showNFTMinting}
        onClose={() => setShowNFTMinting(false)}
        onSuccess={handleNFTMinted}
        lang={lang}
        track={selectedTrackForNFT}
      />
    </div>
  );
}

// --- 5. Coach Dashboard ---
const CoachDashboard = ({ onLogout, lang, setLang }: { onLogout: () => void, lang: Lang, setLang: (l: Lang) => void }) => {
   const t = TRANSLATIONS[lang].coach;
   const [selectedTrainee, setSelectedTrainee] = useState<number | null>(null);
   const trainees = [
      { id: 1, name: "Alex Chen", status: "On Track", progress: 75, revenue: 1200, lastActive: "2h ago", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100" },
      { id: 2, name: "Sarah V", status: "Warning", progress: 30, revenue: 450, lastActive: "3d ago", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
      { id: 3, name: "Mike D", status: "On Track", progress: 88, revenue: 3400, lastActive: "15m ago", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100" },
      { id: 4, name: "Emma W", status: "Star", progress: 95, revenue: 8900, lastActive: "Just now", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
   ];

   return (
      <div className="flex h-screen bg-[#0f0f12] text-white overflow-hidden">
         <aside className="w-20 lg:w-64 border-r border-white/10 bg-[#141418] flex flex-col transition-all">
            <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-white/10">
               <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.5)]"><Award className="w-5 h-5 text-white" /></div><span className="font-bold text-lg text-purple-100 ml-3 hidden lg:block tracking-wider">COACH<span className="text-purple-500">OS</span></span>
            </div>
            <div className="p-4 space-y-2 flex-1">
               <Button variant="ghost" className="w-full justify-center lg:justify-start bg-purple-500/10 text-purple-400 border border-purple-500/20"><LayoutDashboard className="lg:mr-3 w-5 h-5"/><span className="hidden lg:block">{t.sidebar.cmd}</span></Button>
               <Button variant="ghost" className="w-full justify-center lg:justify-start text-gray-400 hover:text-white hover:bg-white/5"><Users className="lg:mr-3 w-5 h-5"/><span className="hidden lg:block">{t.sidebar.trainees}</span></Button>
               <Button variant="ghost" className="w-full justify-center lg:justify-start text-gray-400 hover:text-white hover:bg-white/5"><MessageSquare className="lg:mr-3 w-5 h-5"/><span className="hidden lg:block">{t.sidebar.msg}</span> <Badge className="ml-auto bg-red-500 h-5 w-5 p-0 flex items-center justify-center hidden lg:flex">3</Badge></Button>
               <Button variant="ghost" className="w-full justify-center lg:justify-start text-gray-400 hover:text-white hover:bg-white/5"><Settings className="lg:mr-3 w-5 h-5"/><span className="hidden lg:block">{t.sidebar.settings}</span></Button>
            </div>
            <div className="p-4 border-t border-white/10 space-y-2">
               <Button variant="ghost" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="w-full justify-center lg:justify-start text-gray-400 hover:text-white"><GlobeIcon className="lg:mr-3 w-4 h-4"/> <span className="hidden lg:block">{lang === 'zh' ? 'EN' : '中'}</span></Button>
               <Button variant="outline" onClick={onLogout} className="w-full justify-center lg:justify-start border-white/10 text-gray-400 hover:text-white hover:bg-white/5"><LogOut className="lg:mr-3 w-4 h-4"/><span className="hidden lg:block">{t.sidebar.logout}</span></Button>
            </div>
         </aside>

         <main className="flex-1 flex flex-col min-w-0">
            <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#0f0f12]/95 backdrop-blur z-20">
               <h1 className="text-xl font-bold flex items-center gap-2"><span className="text-gray-500">Region:</span> {t.header.region} <span className="flex h-2 w-2 relative ml-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span></h1>
               <div className="flex items-center gap-4"><div className="text-right hidden md:block"><div className="text-xs text-gray-400">{t.header.value}</div><div className="text-lg font-bold font-mono text-green-400">¥ 458,290</div></div><Avatar className="border border-white/20"><AvatarImage src="https://github.com/shadcn.png" /><AvatarFallback>CX</AvatarFallback></Avatar></div>
            </header>

            <div className="flex-1 overflow-hidden flex">
               <div className="flex-1 overflow-y-auto p-8">
                  <div className="flex justify-between items-end mb-6"><div><h2 className="text-2xl font-bold mb-1">{t.monitor.title}</h2><p className="text-gray-400 text-sm">{t.monitor.desc}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" className="border-white/10"><Settings className="w-4 h-4 mr-2"/> {t.monitor.filter}</Button><Button size="sm" className="bg-purple-600 hover:bg-purple-500"><Plus className="w-4 h-4 mr-2"/> {t.monitor.new_task}</Button></div></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                     <Card className="bg-[#141418] border-white/5"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-blue-500/10 rounded-lg text-blue-400"><Disc className="w-6 h-6"/></div><div><div className="text-2xl font-bold">142</div><div className="text-xs text-gray-500">{t.monitor.kpi_songs}</div></div></CardContent></Card>
                     <Card className="bg-[#141418] border-white/5"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-green-500/10 rounded-lg text-green-400"><TrendingUp className="w-6 h-6"/></div><div><div className="text-2xl font-bold">85%</div><div className="text-xs text-gray-500">{t.monitor.kpi_rate}</div></div></CardContent></Card>
                     <Card className="bg-[#141418] border-white/5"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-red-500/10 rounded-lg text-red-400"><MessageSquare className="w-6 h-6"/></div><div><div className="text-2xl font-bold">12</div><div className="text-xs text-gray-500">{t.monitor.kpi_review}</div></div></CardContent></Card>
                  </div>
                  <div className="bg-[#141418] border border-white/5 rounded-xl overflow-hidden">
                     <table className="w-full text-left text-sm"><thead className="bg-white/5 text-gray-400"><tr><th className="p-4 font-medium">{t.table.producer}</th><th className="p-4 font-medium">{t.table.status}</th><th className="p-4 font-medium">{t.table.progress}</th><th className="p-4 font-medium">{t.table.rev}</th><th className="p-4 font-medium text-right">{t.table.action}</th></tr></thead><tbody className="divide-y divide-white/5">{trainees.map(t => (<tr key={t.id} onClick={() => setSelectedTrainee(t.id)} className={`hover:bg-white/5 cursor-pointer transition-colors ${selectedTrainee === t.id ? 'bg-purple-900/20' : ''}`}><td className="p-4 flex items-center gap-3"><Avatar className="w-8 h-8 rounded-md"><AvatarImage src={t.avatar} /><AvatarFallback>{t.name[0]}</AvatarFallback></Avatar><div><div className="font-bold">{t.name}</div><div className="text-xs text-gray-500">{t.lastActive}</div></div></td><td className="p-4"><Badge variant="outline" className={`${t.status === 'On Track' ? 'border-green-500/30 text-green-400 bg-green-500/10' : ''} ${t.status === 'Warning' ? 'border-red-500/30 text-red-400 bg-red-500/10' : ''} ${t.status === 'Star' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' : ''}`}>{t.status}</Badge></td><td className="p-4"><div className="flex items-center gap-3"><Progress value={t.progress} className="h-1.5 w-24 bg-gray-800" /><span className="text-xs text-gray-500">{t.progress}%</span></div></td><td className="p-4 font-mono">¥ {t.revenue}</td><td className="p-4 text-right"><Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10"><ChevronRight className="w-4 h-4" /></Button></td></tr>))}</tbody></table>
                  </div>
               </div>

               <AnimatePresence>
                  {selectedTrainee && (
                     <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 350, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="border-l border-white/10 bg-[#141418] flex flex-col">
                        <div className="p-6 border-b border-white/10 flex justify-between items-start"><div className="flex flex-col items-center w-full"><div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-purple-500 to-pink-500 mb-3"><img src={trainees.find(t => t.id === selectedTrainee)?.avatar} className="w-full h-full rounded-full object-cover border-4 border-[#141418]"/></div><h3 className="text-xl font-bold">{trainees.find(t => t.id === selectedTrainee)?.name}</h3><p className="text-sm text-gray-400">Level 3 Producer</p><div className="flex gap-2 mt-4 w-full"><Button className="flex-1 bg-white text-black hover:bg-gray-200">{t.detail.msg}</Button><Button variant="outline" className="flex-1 border-white/10">{t.detail.profile}</Button></div></div></div>
                        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                           <div>
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{t.detail.latest}</h4>
                              <div className="bg-black/40 p-3 rounded-lg border border-white/5"><div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 bg-cyan-900/20 rounded flex items-center justify-center text-cyan-400"><Music2 className="w-5 h-5"/></div><div><div className="font-bold text-sm">Neon Nights.mp3</div><div className="text-xs text-gray-500">{t.detail.submitted} 2h ago</div></div></div><div className="h-8 bg-gray-800 rounded flex items-center justify-center gap-1 opacity-50">{[...Array(15)].map((_,i) => <div key={i} className="w-1 bg-gray-400 rounded-full" style={{height: Math.random()*20+4}} />)}</div><div className="flex gap-2 mt-3"><Button size="sm" className="flex-1 bg-green-600 hover:bg-green-500 h-8 text-xs">{t.detail.approve}</Button><Button size="sm" variant="outline" className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 text-xs">{t.detail.reject}</Button></div></div>
                           </div>
                           <div><h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{t.detail.radar}</h4><div className="aspect-square bg-black/40 rounded-lg border border-white/5 flex items-center justify-center relative"><div className="w-32 h-32 border border-gray-700 rounded-full opacity-30 absolute" /><div className="w-20 h-20 border border-gray-700 rounded-full opacity-30 absolute" /><div className="w-10 h-10 border border-gray-700 rounded-full opacity-30 absolute" /><svg className="w-full h-full absolute p-8" viewBox="0 0 100 100"><path d="M50 10 L80 40 L70 80 L30 80 L20 40 Z" fill="rgba(147, 51, 234, 0.4)" stroke="#9333ea" strokeWidth="2" /></svg><span className="absolute top-4 text-[10px] text-gray-400">Composition</span><span className="absolute bottom-4 left-4 text-[10px] text-gray-400">Mixing</span><span className="absolute bottom-4 right-4 text-[10px] text-gray-400">Marketing</span></div></div>
                        </div>
                        <div className="p-4 border-t border-white/10"><Button variant="ghost" className="w-full text-gray-500 hover:text-white" onClick={() => setSelectedTrainee(null)}>{t.detail.close}</Button></div>
                     </motion.div>
                  )}
               </AnimatePresence>
            </div>
         </main>
      </div>
   );
};

// --- Main App Logic ---
export default function App() {
  const [page, setPage] = useState('home'); 
  const [lang, setLang] = useState<Lang>('zh');

  return (
    <ThemeProvider>
      <div className="bg-black min-h-screen text-white">
         <AnimatePresence mode="wait">
            {page === 'home' && <motion.div key="home" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Home onEnter={() => setPage('portal')} lang={lang} setLang={setLang} /></motion.div>}
            {page === 'portal' && <motion.div key="portal" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Portal onSelectRole={(role) => { if (role === 'fan') setPage('fan'); else if (role === 'producer_intro') setPage('producer_intro'); else if (role === 'coach') setPage('coach'); }} lang={lang} setLang={setLang} /></motion.div>}
            {page === 'fan' && <motion.div key="fan" initial={{opacity:0, x: 20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}}><FanApp onBack={() => setPage('home')} lang={lang} setLang={setLang} /></motion.div>}
            {page === 'producer_intro' && <motion.div key="p-intro" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><ProducerIntro onEnterApp={() => setPage('producer_app')} lang={lang} setLang={setLang} /></motion.div>}
            {page === 'producer_app' && <motion.div key="p-app" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><ProducerDashboard onLogout={() => setPage('home')} lang={lang} setLang={setLang} /></motion.div>}
            {page === 'coach' && <motion.div key="coach" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><CoachDashboard onLogout={() => setPage('home')} lang={lang} setLang={setLang} /></motion.div>}
         </AnimatePresence>
      </div>
    </ThemeProvider>
  );
}
