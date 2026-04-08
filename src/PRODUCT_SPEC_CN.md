# AI Star Eco — 产品与技术规格说明书（中文版）
**版本号**: 2.5.1  
**文档类型**: 产品需求 + 技术架构  
**最后更新**: 2026-04-08  
**当前状态**: Phase 2 已完成 / Phase 3 规划中  

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [用户角色与画像](#2-用户角色与画像)
3. [用户流程与业务逻辑](#3-用户流程与业务逻辑)
4. [功能需求](#4-功能需求)
5. [技术规格](#5-技术规格)
6. [UI状态与组件行为](#6-ui状态与组件行为)
7. [主题与设计系统](#7-主题与设计系统)
8. [边界情况与约束条件](#8-边界情况与约束条件)
9. [阶段路线图](#9-阶段路线图)

---

## 1. 执行摘要

### 核心价值主张

**AI Star Eco** 是一个全栈式、AIGC驱动的虚拟偶像孵化与商业变现操作系统，定位为**全球首个去中心化虚拟艺人孵化网络**，将以下三大能力深度融合：

- **AIGC 工具链** — AI生成音乐、人设创作、图像生成
- **区块链确权** — NFT勋章铸造、链上资产数字指纹
- **粉丝经济** — 投票打榜、限量收藏品市场、粉丝DAO治理
- **多角色生态** — 为粉丝、制作人、MCN掌门人提供三套独立工作台

### 核心用户痛点

传统音乐和虚拟偶像产业**高度线性、封闭、被大型经纪公司垄断**。独立创作者面临以下三大痛点：

1. 缺乏统一工作台来创作、发行、变现 AI 生成的歌手
2. 缺少在没有企业级资源条件下，围绕虚拟艺人构建粉丝经济的工具
3. 缺乏粉丝互动与制作人收益直接挂钩的价值共享网络

AI Star Eco 用一个**自运行的经济平台**替代上述碎片化工作流，核心闭环为：**创造 → 发行 → 变现**。

---

## 2. 用户角色与画像

应用支持三种独立用户入口，每种角色拥有专属工作台：

### 2.1 粉丝（星际听众 / Galactic Listener）
- **核心目标**: 发现 AI 音乐、为榜单投票、收集限量 NFT 勋章
- **入口路径**: 落地页 → "进入秀场 / Enter Show"
- **核心操作**: 浏览榜单、为歌曲投票、铸造/收集勋章、发现新艺人
- **变现参与**: 被动角色 — 购买勋章/周边，参与粉丝DAO投票

### 2.2 制作人（造梦架构师 / Dream Architect）
- **核心目标**: 从零孵化 AI 歌手，制作音乐，全球发行，商业变现
- **入口路径**: 落地页 → "开始创作 / Start Creating" → 完整制作人控制台
- **核心操作**: 创建AI歌手人设、生成音乐曲目、分发至全球流媒体平台、铸造NFT合集、管理收益
- **变现模式**: 主动角色 — 赚取流媒体版税、NFT销售收益、粉丝打赏

### 2.3 MCN掌门人（生态领航员 / Ecosystem Navigator）
- **核心目标**: 管理制作人/学员团队、监控KPI、下发任务、赚取生态分润
- **入口路径**: 落地页 → "管理后台 / Coach Hub" → 掌门人控制台
- **核心操作**: 监控学员表现、审批/驳回作品提交、与制作人沟通、查看数据分析
- **变现模式**: 被动分润 — 从学员成功孵化中获取百分比提成

---

## 3. 用户流程与业务逻辑

### 3.1 落地页 → 角色选择流程
```
落地页（Home）
├── 导航栏：核心功能 | 孵化案例 | 生态流程 | 关于我们 | 进入控制台
├── Hero 区（粒子背景 + 鼠标视差）
├── 工作流程区（创造 → 发行 → 变现）
├── 功能特性区（Super-SaaS工作台 | 资产上链 | 粉丝DAO）
└── 角色入口选择卡
    ├── 粉丝入口 → 粉丝App视图
    ├── 制作人入口 → 制作人App视图（默认：经纪大盘）
    └── 掌门人入口 → 掌门人App视图
```

### 3.2 制作人主流程
```
制作人工作台（ProducerApp）
├── 侧边栏导航（全程固定显示）
│   ├── 经纪大盘 → 总览面板（默认）
│   ├── MCN与孵化 → MCN模块（需解锁）
│   ├── AI歌手孵化 → AIIncubator 组件
│   ├── 创作与确权 → 人设引擎（内联）
│   ├── 音乐与MV工坊 → AI录音棚（11种生成模式）
│   ├── 版权与链上资产 → NFT铸造模块
│   ├── 发行与运营 → DistributionPage 组件
│   ├── 全网矩阵分发 → DistributionPage（矩阵视图）
│   ├── 粉丝社群 → 社群（需解锁）
│   └── 商业变现 → 财务/收益中心
└── 主内容区（随导航动态切换）
```

### 3.3 AI歌手孵化流程（核心主流程）
```
AIIncubator（主画廊页）
├── 查看已孵化歌手卡片（网格布局）
├── 搜索与筛选（状态筛选：全部/活跃/草稿/归档）
├── "创建新歌手" → 创建草稿歌手 → 进入 SingerEditor
└── 点击歌手卡片"编辑" → SingerEditor

SingerEditor（6-Tab创作工作台）
├── Tab 1：官方IP库
│   └── 选择预设IP → 自动填入：名称、头像、风格、标签、人格参数
├── Tab 2：参数调节
│   ├── 快速预设（甜美少女 / 冷酷女王 / 活力青春 / 神秘精灵）
│   ├── 核心参数：甜度 / 能量 / 神秘感（0–100滑块）
│   └── 基本信息：歌手名称、音乐风格（文本输入）
├── Tab 3：基因混合
│   └── 【规划中】选择两位父本歌手 → 设置混合比例 → 生成后代
├── Tab 4：图片定制
│   └── 【规划中】上传参考图 → AI生成相似风格歌手
├── Tab 5：服装换装（WardrobeSystem）
│   ├── 分类筛选：全部 / 上衣 / 下装 / 配饰 / 鞋子 / 发型
│   ├── 全库搜索（200+件单品）
│   ├── 稀有度系统：普通 / 稀有 / 史诗 / 传说
│   ├── 按槽位装备/卸下服装
│   ├── 收藏管理
│   ├── 一键随机搭配
│   ├── 保存套装为命名预设
│   └── 实时预览面板（歌手 + 当前装备）
└── Tab 6：姿态动作（PoseLibrary）
    ├── 子Tab：姿态库
    │   ├── 分类：站姿 / 坐姿 / 舞蹈 / 演唱 / 动作
    │   ├── 16个姿态（部分锁定），难度：简单 / 中等 / 困难
    │   └── 选择姿态 → 预览 → "应用姿态"
    ├── 子Tab：表情
    │   ├── 12种表情，5个情绪分类
    │   ├── 强度滑块（0–100）
    │   └── "应用表情"
    └── 子Tab：手势
        ├── 8种手势（emoji方式呈现）
        └── "应用手势"
```

### 3.4 音乐制作流程
```
AI录音棚（11种生成模式）
├── 文本模式：提示词 + 风格 → 生成
├── 旋律模式：上传旋律音频 + 风格描述
├── 进阶模式：歌曲结构 + BPM + 调性 + 风格
├── 互动写歌：与AI制作人对话式创作
├── 歌词成歌：粘贴歌词 → 生成完整曲目
├── 灵感写歌：自由创意输入 → AI诠释创作
├── 图片成歌：上传图片 → AI生成配乐
├── 热歌爆改：提供原曲参考 → 风格改编
├── 趣味写歌：主题 + 核心歌词 → 趣味创作
├── 藏头歌：隐藏词 + 歌曲主题 → 藏头创作
└── 送Ta歌：送给谁 / 场合 / 想说的话 → 专属赠歌

生成状态流转：输入 → 生成中（带阶段进度） → 预览 → 成功
生成阶段：分析参数 → 作曲中 → 编曲中 → 母带处理 → 完成
```

### 3.5 NFT铸造流程
```
NFT铸造弹窗（NFTMintingDialog）
├── 第1步：配置 — 合集名称、发行量、价格(ETH)、版税比例、稀有度、空投开关
├── 第2步：连接钱包 — MetaMask / WalletConnect / Coinbase Wallet
├── 第3步：铸造中 — 进度条 + 区块链确认信息
└── 第4步：铸造成功 — 在区块链浏览器查看、分享、下载证书
```

### 3.6 音乐发行流程
```
发行页面（DistributionPage）
├── 选择发行曲目（来自已生成曲库）
├── 选择发行渠道（多选）
│   ├── 国内AI专属通道（腾讯音乐启明星 / 网易云音乐人）
│   ├── 全球流媒体发行（DistroKid / TuneCore）
│   ├── 短视频平台矩阵（抖音 / TikTok）
│   └── YouTube Music 专区
├── 账号绑定状态（按所需平台逐一显示）
├── 发行计划（日期 + 时间选择，预存功能开关）
└── 发布 → 触发多平台分发
```

### 3.7 艺人签约流程（MCN / 市场）
```
ArtistListingDialog → 浏览市场艺人
└── ArtistSigningDialog（艺人签约弹窗）
    ├── 第1步：查看详情 — 艺人信息（风格、作品数、粉丝数、创建者）
    ├── 第2步：合同条款 — 条款审阅、勾选同意
    │   └── 收益分成：运营方 70% / 原创者 30%
    ├── 第3步：支付确认 — 签约费用确认
    └── 第4步：签约成功 — 艺人加入制作人的签约名单
```

### 3.8 掌门人控制台流程
```
掌门人工作台（CoachApp）
├── 头部：节点区域（亚太区）+ 生态总价值
├── 小队监控
│   ├── KPI汇总卡：本周新歌数 / 成功率 / 待批改数
│   ├── 制作人列表：姓名 / 状态 / 周进度条 / 营收 / 操作
│   └── 行操作：查看档案 / 下发任务
├── 制作人详情面板（侧滑展开）
│   ├── 档案Tab：头像、统计数据、能力雷达图
│   ├── 最新提交：曲目信息 + 通过 / 驳回操作
│   └── 发消息按钮
└── 侧边栏：指挥中心 / 学员管理 / 消息 / 设置 / 退出
```

### 3.9 粉丝端流程
```
粉丝App（FanApp）
├── 底部导航：发现 / 榜单 / 市场 / 我的
├── 发现Tab：猜你喜欢 — 艺人推荐卡
├── 榜单Tab（星际金曲榜）
│   ├── 排行列表（排名、标题、艺人、票数、趋势标识）
│   └── 每首歌的投票按钮（触发票数+1）
├── 市场Tab（限量勋章市场）
│   ├── NFT勋章网格（剩余库存、价格、铸造CTA）
│   └── 铸造CTA → 连接铸造流程
└── 我的Tab：用户勋章库存、收听历史
```

---

## 4. 功能需求

### 4.1 全局 / 跨模块功能

| 编号 | 功能 | 说明 |
|----|---------|-------------|
| G-01 | 中英双语支持 | 完整的 zh/en 切换，所有UI文案由 `TRANSLATIONS` 对象统一驱动 |
| G-02 | 主题切换系统 | 6种设计主题运行时即时切换：赛博朋克、玻璃态、渐变流体、新拟态、终端黑客、极简科技 |
| G-03 | 粒子背景 | 基于Canvas API的粒子系统，青色圆点 + 紫色连线 |
| G-04 | 动效动画 | 所有主要过渡使用 `motion/react`（AnimatePresence、弹簧动画、滚动视差） |
| G-05 | 全局音频播放器 | 悬浮底部播放条：播放/暂停、跳曲、进度拖拽、音量、静音、循环、随机播放、可视化波形 |
| G-06 | 新手引导 | 首次启动弹窗，分步骤引导功能使用 |
| G-07 | Toast通知 | 通过自定义 `ToastNotification` 组件显示成功/错误/信息提示 |
| G-08 | 响应式布局 | 移动端优先网格布局，侧边栏在移动端可折叠 |

### 4.2 落地页

| 编号 | 功能 | 说明 |
|----|---------|-------------|
| LP-01 | 固定顶部导航 | Logo + 导航链接 + 语言切换 + "进入控制台"主CTA |
| LP-02 | 鼠标视差Hero | 通过 `useMotionValue` 实现标题随鼠标移动的视差效果 |
| LP-03 | Hero数据统计 | 展示实时数据：50k+创作者、120万+生成歌曲 |
| LP-04 | 工作流程区 | 三步闭环（创造/发行/变现）带动效步骤卡 |
| LP-05 | 功能特性区 | 三张特性卡（Super-SaaS工作台 / 资产上链 / 粉丝DAO） |
| LP-06 | 角色入口区 | 三张入口卡（粉丝 / 制作人 / 掌门人），各含独立CTA |

### 4.3 制作人控制台

| 编号 | 模块 | 核心输入项 | 核心操作 |
|----|--------|-----------|-------------|
| PD-01 | 经纪大盘（总览） | — | 查看生态估值、版税、勋章持有量、播放量、粉丝数；Recharts柱/面积图；AI建议任务列表 |
| PD-02 | AI歌手孵化 | 搜索词、状态筛选 | 创建、编辑、删除、归档歌手；进入SingerEditor |
| PD-03 | 编辑器-官方IP | IP卡片选择 | 应用预设名称/头像/风格/标签/人格参数 |
| PD-04 | 编辑器-参数调节 | 甜度/能量/神秘感滑块（0–100），名称、风格文本框 | 应用快速预设、手动调节、保存 |
| PD-05 | 编辑器-基因混合 | 父本A、父本B选择，混合比例滑块 | 生成后代（Phase 3规划） |
| PD-06 | 编辑器-图片定制 | 图片文件上传 | AI图生人设（Phase 3规划） |
| PD-07 | 编辑器-服装换装 | 分类筛选、搜索、服装卡片选择 | 按槽装备/卸下、收藏、随机搭配、保存套装、导出 |
| PD-08 | 编辑器-姿态动作 | 姿态分类筛选、姿态卡片、表情emoji、强度滑块、手势 | 应用姿态/表情/手势组合、预览、保存 |
| PD-09 | AI录音棚 | 11种模式Tab，各模式专属表单字段（提示词、风格、BPM、调性、歌词、图片等） | 生成曲目（消耗5点）、音频预览、加入曲库 |
| PD-10 | NFT铸造 | 合集名称、发行量、ETH价格、版税比例、稀有度、空投开关 | 连接钱包、铸造、在区块链浏览器查看 |
| PD-11 | 发行与运营 | 曲目选择、渠道多选、账号绑定、发行日期/时间、预存开关 | 发布至选定平台 |
| PD-12 | 商业变现/财务 | — | 查看余额、收入构成（流媒体/NFT/打赏）、交易记录、提现 |
| PD-13 | NLE剪辑工台 | 音频/视频模式切换 | 播放/暂停、分割、删除轨道片段、编辑歌词、拖拽特效、定稿导出 |
| PD-14 | MCN与孵化 | 艺人市场列表 | 签约艺人、查看详情、管理签约名单（非企业版锁定） |
| PD-15 | 粉丝社群 | — | 粉丝消息管理（非企业版锁定） |

### 4.4 MCN掌门人控制台

| 编号 | 功能 | 说明 |
|----|---------|-------------|
| C-01 | 小队监控 | 制作人实时数据表（状态、进度条、营收） |
| C-02 | KPI汇总 | 本周新歌数、成功率%、待批改数 |
| C-03 | 制作人详情面板 | 档案 + 最新提交 + 通过/驳回 + 能力雷达图 |
| C-04 | 任务下发 | 向指定制作人下发任务 |
| C-05 | 即时消息 | 直接与制作人发消息的CTA |
| C-06 | 生态总价值头部 | 汇总生态价值展示，节点区域标签 |

### 4.5 粉丝端

| 编号 | 功能 | 说明 |
|----|---------|-------------|
| F-01 | 音乐榜单 | 排行列表含票数、趋势标识（升/降/平），支持投票操作 |
| F-02 | 勋章市场 | NFT卡片网格含剩余库存、价格、铸造CTA |
| F-03 | 发现推荐 | "猜你喜欢"精选艺人卡片流 |
| F-04 | 我的主页 | 用户勋章库存、收听历史 |

---

## 5. 技术规格

### 5.1 技术栈

| 层级 | 技术选型 |
|-------|-----------|
| UI框架 | React 18 + TypeScript |
| 样式系统 | Tailwind CSS v4 |
| 动效库 | Motion/React（原Framer Motion） |
| 图表库 | Recharts（BarChart、AreaChart） |
| 图标库 | Lucide-React |
| UI组件库 | 自定义shadcn/ui风格组件（`/components/ui/`） |
| 路由方案 | 基于State的视图切换（单页应用，无React Router） |
| 后端服务 | Supabase（Deno上运行的Hono服务器 + KV存储） |
| 音频处理 | 原生HTML5 `<audio>` API |
| 画布渲染 | 原生Canvas API（粒子背景） |

### 5.2 应用架构

```
App.tsx（根组件）
├── ThemeProvider（主题Context）
├── Home（落地页）          [view = 'home']
├── ProducerApp（制作人工作台）[view = 'producer']
│   ├── 侧边栏（全程固定）
│   ├── OverviewSection（总览）
│   ├── AIIncubator → SingerEditor
│   │   ├── WardrobeSystem（服装换装）
│   │   └── PoseLibrary（姿态动作）
│   ├── PersonaSection（人设引擎，内联）
│   ├── StudioSection（AI录音棚，11种模式）
│   ├── MintSection（NFT铸造）
│   ├── EditorSection（NLE剪辑台）
│   ├── DistributionPage（发行页面）
│   ├── FinanceSection（财务中心）
│   └── LockedSection（锁定模块）
├── FanApp（粉丝端）         [view = 'fan']
├── CoachApp（掌门人端）     [view = 'coach']
├── GlobalAudioPlayer（悬浮全局播放器）
├── MusicGenerationDialog（音乐生成弹窗）
├── NFTMintingDialog（NFT铸造弹窗）
├── ArtistSigningDialog（艺人签约弹窗）
├── ArtistDetailDialog（艺人详情弹窗）
├── ArtistListingDialog（市场列表弹窗）
├── OnboardingGuide（新手引导弹窗）
├── ThemeSwitcher（悬浮主题切换器）
└── ThemeShowcase（主题预览弹窗）
```

### 5.3 核心数据实体

#### Singer（AI歌手）
```typescript
interface Singer {
  id: string;                          // UUID / 时间戳字符串
  name: string;                        // 显示名称（支持双语）
  avatar: string;                      // 图片URL
  style: string;                       // 音乐曲风标签
  status: 'active' | 'draft' | 'archived'; // 活跃 | 草稿 | 归档
  quality: 'common' | 'rare' | 'epic' | 'legendary'; // 普通 | 稀有 | 史诗 | 传说
  createdAt: Date;
  stats: {
    songs: number;                     // 已制作曲目总数
    fans: number;                      // 粉丝总数
    popularity: number;                // 人气值 0–100
  };
  tags: string[];                      // 可搜索分类标签
}
```

#### PersonaParams（人格参数）
```typescript
interface PersonaParams {
  sweetness: number;   // 0–100，驱动LLM人设甜度维度
  energy: number;      // 0–100，驱动LLM人设活力维度
  mystery: number;     // 0–100，驱动LLM人设神秘感维度
}
```

#### ClothingItem（服装单品）
```typescript
interface ClothingItem {
  id: string;
  name: string;
  category: 'top' | 'bottom' | 'accessory' | 'shoes' | 'hair' | 'outfit';
  imageUrl: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  price: number;                       // 虚拟货币价格
  tags: string[];
  isLocked?: boolean;                  // 需要升级套餐才能解锁
  isNew?: boolean;                     // NEW标签标识
  isTrending?: boolean;                // HOT标签标识
}
```

#### Pose（姿态）
```typescript
interface Pose {
  id: string;
  name: string;
  category: 'standing' | 'sitting' | 'dancing' | 'singing' | 'action';
  thumbnail: string;
  difficulty: 'easy' | 'medium' | 'hard'; // 简单 | 中等 | 困难
  isLocked?: boolean;
  isNew?: boolean;
  animation?: string;                  // 预留字段，用于未来动画数据
}
```

#### Expression（表情）
```typescript
interface Expression {
  id: string;
  name: string;
  emoji: string;
  intensity: number;                   // 0–100，混合强度
  category: 'happy' | 'sad' | 'cool' | 'surprised' | 'other';
  // 分类：开心系 | 悲伤系 | 酷炫系 | 惊讶系 | 其他
}
```

#### Song / Track（歌曲/曲目）
```typescript
interface Song {
  id: string;
  title: string;
  date: string;                        // ISO日期字符串
  status: 'Published' | 'Draft' | 'Processing'; // 已发布 | 草稿 | 处理中
  plays?: string;                      // 显示字符串，例如："12.4K"
  audioUrl?: string;                   // 实际音频文件URL
}
```

#### Artist（市场艺人）
```typescript
interface Artist {
  id: number;
  name: string;
  style: string;
  avatar: string;
  price: string;                       // 签约费用显示字符串
  owner: string;                       // 原创者用户名
  songs: number;
  followers: string;                   // 显示字符串，例如："58.2K"
}
```

#### Transaction（交易记录）
```typescript
interface Transaction {
  id: number;
  date: string;                        // ISO日期
  desc: string;                        // 摘要描述
  amount: string;                      // 显示字符串，例如："+¥12,450.00"
  status: 'Completed' | 'Processing' | 'Failed'; // 已完成 | 处理中 | 失败
}
```

#### ChannelConfig（发行渠道配置）
```typescript
interface ChannelConfig {
  id: string;
  name: string;                        // 中文名称
  nameEn: string;                      // 英文名称
  description: string;
  icon: LucideIcon;
  iconBg: string;                      // Tailwind渐变类名
  requiredAccounts: string[];          // 发行所需绑定的账号ID列表
  benefits: string[];                  // 中文权益列表
  benefitsEn: string[];               // 英文权益列表
}
```

### 5.4 状态管理

当前状态管理完全通过React `useState` 钩子实现，以 `App.tsx` 为根级状态容器，通过 props 向下传递。**未引入**外部状态管理库（如Zustand、Redux）。

**`App.tsx` 根级核心状态：**
```typescript
const [view, setView] = useState<'home' | 'fan' | 'producer' | 'coach'>('home');
const [lang, setLang] = useState<'zh' | 'en'>('zh');
const [activeSection, setActiveSection] = useState<string>('dashboard');
const [activeSinger, setActiveSinger] = useState<Singer | null>(MOCK_SINGERS[0]);
const [personaParams, setPersonaParams] = useState<PersonaParams>({
  sweetness: 70, energy: 80, mystery: 50
});
const [isPlaying, setIsPlaying] = useState(false);
const [currentSong, setCurrentSong] = useState<Song | null>(null);
const [generatedSongs, setGeneratedSongs] = useState<Song[]>([]);
const [showMusicDialog, setShowMusicDialog] = useState(false);
const [showNFTDialog, setShowNFTDialog] = useState(false);
const [showSigningDialog, setShowSigningDialog] = useState(false);
// ... 其他弹窗/模态框状态
```

**主题状态**由 `ThemeProvider` Context管理，通过 `useTheme()` 钩子全局访问。

### 5.5 业务逻辑与计算规则

#### 稀有度系统（品质分级）
| 等级 | 视觉颜色 | 星级数量 | 光晕颜色 | 解锁条件 |
|------|--------|-----------|-----------|--------|
| 普通（Common） | 灰色 | ⭐⭐ | 无 | 免费 |
| 稀有（Rare） | 蓝色 | ⭐⭐⭐ | 蓝色光晕 | 免费 |
| 史诗（Epic） | 紫色 | ⭐⭐⭐⭐ | 紫色光晕 | 免费 |
| 传说（Legendary） | 金色 | ⭐⭐⭐⭐⭐ + 皇冠 | 金色光晕+脉冲 | 部分需解锁 |

#### 基因混合概率（规划中 — Phase 3）
```
后代稀有度出现概率：
普通（Common）   = 60%
稀有（Rare）     = 30%
史诗（Epic）     = 9%
传说（Legendary） = 1%

突变事件（随机5%概率触发）可将稀有度提升一级。
突变类型：全息效果 | 双色发型 | 异色瞳 | 赛博植入体 | 元素光环
```

#### 音乐生成积分系统
- 每次生成操作**消耗5点积分**
- 积分在点击"生成"按钮时立即扣除
- 当前实现（Mock阶段）：生成失败不退还积分
- 积分余额按会话追踪（Phase 2未持久化至后端）

#### 收益分配规则（艺人签约）
```
签约艺人收益分成：
- 运营方（购买/MCN方）：70%
- 原创者：30%
- 平台服务费：待定（Phase 3商业化模型中确定）
```

#### NFT版税逻辑
- 版税比例在**铸造时**由创作者设定
- 版税仅适用于**二级市场**交易
- 一级市场销售收益100%归铸造制作人
- 稀有度影响视觉展示和市场感知价值，但不直接改变经济公式

#### 发行平台激励（国内渠道）
- 播放激励：约每万次播放 ¥30–80（平台估算值）
- 腾讯/网易渠道自动添加「AI创作」标签
- 全球DSP（通过DistroKid）：适用行业标准版税费率

#### 人气值计算（Mock阶段）
```
当前：静态Mock数值（0–100）

规划版本：人气值 = 加权平均(
  播放量排名  × 0.4 +
  粉丝增长率  × 0.3 +
  勋章销售速度 × 0.2 +
  社交媒体提及 × 0.1
)
```

### 5.6 API端点（后端 — Supabase / Hono）

当前后端实现极简。Hono服务器（`/supabase/functions/server/index.tsx`）仅暴露以下接口：

| 方法 | 路径 | 说明 |
|--------|------|-------------|
| GET | `/make-server-62916cbc/health` | 健康检查，返回 `{ status: "ok", version: "2.5.1" }` |

**Phase 3规划API端点：**
```
POST   /api/singers              创建新AI歌手
GET    /api/singers/my           获取当前用户的歌手列表
PUT    /api/singers/:id          更新歌手数据
DELETE /api/singers/:id          归档/删除歌手

POST   /api/tracks/generate      触发AI音乐生成任务
GET    /api/tracks/my            获取用户曲库

POST   /api/nft/mint             发起NFT铸造
GET    /api/nft/collections      获取用户NFT合集

POST   /api/distribution/publish 将曲目发布到选定平台

GET    /api/marketplace/listings 获取社区IP市场列表
POST   /api/marketplace/sign     签约/购买艺人

GET    /api/analytics/dashboard  汇总仪表盘指标数据
```

### 5.7 Supabase 数据库结构设计（Phase 3规划）

```sql
-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  avatar_url VARCHAR(500),
  role ENUM('fan', 'producer', 'coach') DEFAULT 'producer',
  plan ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
  credits INT DEFAULT 100,        -- 积分余额
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI歌手表
CREATE TABLE ai_singers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500),
  style VARCHAR(50),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'archived')),
  quality VARCHAR(20) DEFAULT 'common' CHECK (quality IN ('common', 'rare', 'epic', 'legendary')),
  parameters JSONB,               -- PersonaParams：sweetness、energy、mystery
  tags TEXT[],
  equipped_wardrobe JSONB,        -- 当前服装槽位状态
  active_pose VARCHAR(50),        -- 当前应用的姿态ID
  active_expression VARCHAR(50),  -- 当前应用的表情ID
  parent_a_id UUID REFERENCES ai_singers(id), -- 基因混合父本A
  parent_b_id UUID REFERENCES ai_singers(id), -- 基因混合父本B
  genetic_ratio INT,              -- 基因混合比例 0–100
  is_public BOOLEAN DEFAULT FALSE,
  songs_count INT DEFAULT 0,
  fans_count INT DEFAULT 0,
  popularity INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 曲目表
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID REFERENCES users(id),
  singer_id UUID REFERENCES ai_singers(id),
  title VARCHAR(200) NOT NULL,
  audio_url VARCHAR(500),
  cover_url VARCHAR(500),
  generation_mode VARCHAR(50),    -- 'text'/'melody'/'lyrics'/'image'等
  prompt TEXT,
  style VARCHAR(100),
  bpm INT,
  key VARCHAR(10),
  duration_sec INT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'published')),
  play_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NFT合集表
CREATE TABLE nft_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  track_id UUID REFERENCES tracks(id),
  name VARCHAR(100) NOT NULL,
  supply INT NOT NULL,
  price_eth DECIMAL(18, 8),
  royalty_pct INT CHECK (royalty_pct BETWEEN 0 AND 100),
  rarity VARCHAR(20),
  contract_address VARCHAR(66),   -- 链上合约地址
  minted_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 交易记录表
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50),               -- 'royalty'/'nft_sale'/'tip'/'signing_fee'/'withdrawal'/'ai_credit'
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 市场艺人列表表
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES users(id),
  singer_id UUID REFERENCES ai_singers(id),
  title VARCHAR(100),
  description TEXT,
  price DECIMAL(10, 2),
  license_type VARCHAR(20) CHECK (license_type IN ('exclusive', 'non-exclusive')),
  views INT DEFAULT 0,
  sales INT DEFAULT 0,
  rating DECIMAL(3, 2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'sold', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 掌门人-学员关系表
CREATE TABLE coach_trainees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES users(id),
  trainee_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'active',
  revenue_share_pct INT DEFAULT 10,  -- 掌门人从学员收益中的分成比例
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- 服装库存表
CREATE TABLE wardrobe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  item_id VARCHAR(50) NOT NULL,          -- 映射到 ClothingItem.id
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  is_equipped BOOLEAN DEFAULT FALSE,
  equipped_on_singer UUID REFERENCES ai_singers(id)
);
```

---

## 6. UI状态与组件行为

### 6.1 音乐生成弹窗（MusicGenerationDialog）状态

| 状态 | UI表现 |
|-------|-------------|
| `input`（输入） | 表单可见；所有字段可编辑；"生成"CTA激活 |
| `generating`（生成中） | 进度条动画；阶段标签动态更新（分析参数→作曲中→编曲中→母带处理→完成）；表单隐藏；取消按钮可用 |
| `preview`（预览） | 生成曲目元数据展示；音频播放控件可用；"使用此曲目" / "重新生成"选项 |
| `success`（成功） | 确认动效；"下载"、"分享"、"加入曲库"CTA；自动关闭倒计时 |

### 6.2 NFT铸造弹窗（NFTMintingDialog）状态

| 状态 | UI表现 |
|-------|-------------|
| `config`（配置） | 配置表单全字段可编辑；步骤指示器显示1/4 |
| `wallet`（连接钱包） | 钱包选择网格（MetaMask / WalletConnect / Coinbase）；"已连接"状态反馈 |
| `minting`（铸造中） | 进度条动画；区块链确认信息；不可关闭 |
| `success`（成功） | 庆祝动效；NFT预览卡；"在区块链浏览器查看"、"分享"CTA |

### 6.3 艺人签约弹窗（ArtistSigningDialog）状态

| 状态 | UI表现 |
|-------|-------------|
| `details`（查看详情） | 艺人详情卡含统计数据；"下一步"CTA激活 |
| `contract`（合同条款） | 可滚动合同内容；必须勾选同意才可继续；"同意并继续" |
| `payment`（支付确认） | 费用明细；"确认支付"按钮；可取消 |
| `success`（签约成功） | 动效庆祝；"查看艺人"、"关闭"CTA；更新签约名单 |

### 6.4 AI歌手孵化器视图状态

| 状态 | UI表现 |
|-------|-------------|
| 画廊（默认） | 歌手卡片网格；搜索/筛选栏；创建CTA |
| 空状态 | 居中Sparkles图标；"暂无歌手"提示；"创建新歌手"CTA |
| 编辑中 | SingerEditor完全替换画廊视图（非弹窗，全屏视图切换） |
| 保存中 | 保存按钮短暂加载态；乐观UI更新 |

### 6.5 服装换装系统（WardrobeSystem）状态

| 状态 | UI表现 |
|-------|-------------|
| 默认 | 展示所有服装；无已装备项 |
| 已装备 | 卡片边框高亮；"已装备"标签；预览面板对应槽位更新 |
| 已锁定 | 锁定图标覆盖；点击弹出升级套餐提示 |
| 已收藏 | 心形图标高亮；数据持久化在favorites数组 |
| 随机搭配 | 所有可用槽位随机填充；预览面板即时更新 |
| 保存套装 | 以命名条目加入savedOutfits列表 |

### 6.6 模块锁定状态

当侧边栏某模块需要企业版套餐时：
- 渲染 `LockedSection` 组件
- 锁定图标 + "模块未解锁"标题
- "升级到企业版"CTA按钮
- "返回总览"链接

### 6.7 发行页面账号状态

| 账号状态 | 视觉展示 |
|--------------|--------|
| 已连接 | 绿色勾选 + 账号邮箱显示 |
| 未连接 | 红/橙色标识 + "连接"按钮 |
| 必须连接但缺失 | 渠道卡上的警告角标；发布按钮被禁用 |

---

## 7. 主题与设计系统

### 7.1 可用主题列表

| 主题ID | 中文名称 | 英文名称 | 视觉特征 |
|---------|-----------|-----------|-----------------|
| `cyberpunk` | 赛博朋克强化版 | Cyberpunk Enhanced | 霓虹光效 + 扫描线 + 故障艺术 |
| `glassmorphism` | 玻璃态现代风 | Glassmorphism | 毛玻璃 + 背景模糊 + 光影层次 |
| `gradient` | 渐变流体风格 | Gradient Fluid | 动态渐变 + 流体动画 + 彩色光晕 |
| `neumorphism` | 新拟态风格 | Neumorphism | 柔和阴影 + 浮雕效果 + 优雅质感 |
| `terminal` | 终端黑客风 | Terminal Hacker | 黑底绿字 + 等宽字体 + CRT扫描线 |
| `minimal` | 极简科技风 | Minimal Tech | 干净线条 + 高对比度 + 信息密度优先 |

### 7.2 主题驱动的侧边栏Token映射

每个主题提供一个侧边栏配置对象：
```typescript
{
  bg: string;           // 背景类名
  itemBase: string;     // 默认导航项样式
  itemActive: string;   // 选中导航项样式
  sectionTitle: string; // 分区标题颜色
  border: string;       // 边框颜色类名
  glow: string;         // 光晕/阴影效果类名
}
```

### 7.3 核心颜色系统（赛博朋克主题 — 默认）

| 设计Token | 色值 | 使用场景 |
|-------|-------|-------|
| 主色 | `cyan-500`（#06b6d4） | 激活状态、主CTA、光晕效果 |
| 辅助色 | `purple-500`（#a855f7） | 强调点、渐变 |
| 点缀色 | `pink-500`（#ec4899） | 破坏性强调、特殊高亮 |
| 背景色 | `#0c0c0e` | 卡片/面板背景 |
| 表面色 | `rgba(255,255,255,0.05)` | Hover悬停状态 |
| 边框色 | `rgba(255,255,255,0.1)` | 分隔线、卡片边框 |

### 7.4 字体规范

- 标题：`font-black`（900字重），紧凑字距（`tracking-tighter`）
- 正文：系统字体栈，次要文字使用 `text-gray-400`
- 等宽字体：用于财务数字和代码样式展示
- 未引入自定义字体（依赖系统字体 + Tailwind默认值）

### 7.5 动效设计原则

| 元素 | 动效类型 | 规格参数 |
|---------|-----------|------|
| 页面切换 | `AnimatePresence` 淡入 + 位移 | 时长300ms，缓动：easeOut |
| 卡片悬停 | `whileHover: { scale: 1.02 }` | 弹簧：stiffness 300 |
| 卡片点击 | `whileTap: { scale: 0.98 }` | 即时 |
| 列表项 | 交错式 `opacity: 0→1, y: 20→0` | 延迟：index × 50ms |
| 进度条 | 弹簧动画宽度变化 | stiffness: 100, damping: 30 |
| 浮动光晕 | CSS `animate-pulse` / `animate-ping` | 原生CSS动画 |
| 鼠标视差 | `useMotionValue` → `useSpring` → `style.x/y` | damping: 25 |

---

## 8. 边界情况与约束条件

### 8.1 数据校验边界情况

| 场景 | 当前处理方式 | 建议处理方式 |
|----------|-----------------|---------------------|
| 保存时歌手名称为空 | 无校验，允许保存空字符串 | 必填字段校验，最少1个字符 |
| 歌手名称超过100字 | 无截断处理 | 增加最大长度限制 |
| 三项人格参数全部为0 | 允许，生成"平淡"人设 | 设置最低值下限或弹出警告 |
| 积分余额为0时尝试生成 | 无拦截，Mock阶段直接成功 | 用升级套餐CTA拦截操作 |
| 歌手名称重复 | 允许（ID唯一即可） | 检测到名称冲突时提示用户 |
| NFT发行量设为0 | 无前端校验 | 最小值设为1 |
| NFT版税超过100% | 无上限校验 | 最大100%，超过30%时弹出警告 |
| 发行时间设为过去 | 无校验 | 禁止排期到过去的时间 |

### 8.2 API与网络边界情况

| 场景 | 当前处理方式 | 建议处理方式 |
|----------|-----------------|---------------------|
| AI音乐生成失败 | 静默处理，Mock阶段无错误状态 | 弹出错误Toast；退还积分；提供重试入口 |
| 生成超时（>60秒） | 未处理（Mock） | 60秒后超时；通知用户；加入重试队列 |
| 某发行渠道API宕机 | 未处理 | 显示各渠道状态标识；支持部分发布并生成失败报告 |
| 用户拒绝连接钱包 | 未处理 | 显示拒绝提示；提供其他钱包选项 |
| NFT铸造链上交易被拒 | 未处理 | 解析交易错误；显示人类可读的错误信息 |
| 图片上传失败 | 未处理 | 文件大小限制（最大10MB），格式校验（JPG/PNG/WebP） |
| 音频文件过大 | 未处理 | 限制50MB；支持MP3/WAV/FLAC格式 |

### 8.3 权限与访问约束

| 功能 | 免费版 | 专业版 | 企业版 |
|---------|-----------|----------|-----------|
| AI歌手创建数量 | 最多3位 | 最多20位 | 无限制 |
| 音乐生成积分 | 5点/天 | 50点/天 | 无限制 |
| NFT铸造 | ❌ 锁定 | ✅ 最多10个/月 | ✅ 无限制 |
| 发行渠道 | 仅国内渠道 | 全渠道 | 全渠道+优先队列 |
| 粉丝社群模块 | ❌ 锁定 | ✅ | ✅ |
| MCN管理 | ❌ 锁定 | ❌ | ✅ |
| 基因混合实验室 | ❌ 锁定 | ✅ | ✅ |
| 传说级服装单品 | ❌ 锁定 | 可购买 | 已包含 |

### 8.4 状态持久化缺口（Phase 2当前局限性）

- 所有状态**仅存储在内存中** — 刷新页面后全部重置
- 歌手画廊刷新后恢复为4位硬编码Mock歌手
- 已生成曲目在会话结束后不保留
- 每位歌手的服装装备状态未持久化
- 切换歌手时，人格参数重置为默认值

### 8.5 并发与竞态条件

| 场景 | 风险 | 缓解措施 |
|----------|------|-----------|
| 用户快速连续创建多位歌手 | 1毫秒内时间戳ID可能重复 | 改用 `crypto.randomUUID()` |
| 多个音乐生成任务同时触发 | 无队列机制，Mock允许并发 | 服务端按用户设置并发限制队列 |
| 快速连续投票 | UI票数可能与服务器不同步 | 乐观更新 + 服务器确认机制 |
| 主题切换期间动画进行中 | 可能产生视觉残影 | 用 `AnimatePresence` 包裹主题切换过渡 |

### 8.6 边界值定义

| 字段 | 最小值 | 最大值 | 备注 |
|-------|-----|-----|-------|
| 人格参数（甜度/能量/神秘感） | 0 | 100 | 整数步进 |
| NFT发行量 | 1 | 10,000 | 建议最大值1,000以保持稀缺性 |
| NFT价格（ETH） | 0.001 | 100 | 设置下限以防粉尘攻击 |
| NFT版税比例 | 0 | 100 | 平台推荐：5–15% |
| BPM（节拍） | 40 | 240 | 音乐制作行业标准范围 |
| 曲目时长 | 30秒 | 600秒（10分钟） | — |
| 歌手标签数量 | 0 | 10 | 画廊卡片最多显示3个 |
| 服装单品价格 | 0 | 9,999 | 虚拟货币，无真实交易 |
| 表情强度 | 0 | 100 | 整数步进 |

### 8.7 无障碍访问缺口

- 稀有度颜色编码（灰/蓝/紫/金）无色盲友好的非颜色标识 → **建议添加文字标签**
- 粒子背景动画未适配 `prefers-reduced-motion` 媒体查询 → **建议添加动效偏好检测**
- 复杂拖拽编辑器缺乏键盘导航映射
- Toast通知无 ARIA live region 播报
- 部分纯图标按钮（删除、查看、保存）缺少 `aria-label`

### 8.8 知识产权与法律约束

- AI生成内容必须符合各DSP平台内容审核政策
- 官方IP模板的基因混合若进行商业化，可能产生授权模糊问题 → 建议每个IP模板附带明确授权协议
- NFT合约在主网部署前必须经过安全审计
- NFT铸造中的空投功能在特定司法管辖区可能受证券法监管

---

## 9. 阶段路线图

### Phase 1 — MVP（已完成 ✅）
- 落地页 + 三角色入口
- 制作人控制台（10+模块）
- 基础AI歌手人设引擎
- Mock音乐生成 + 曲库
- NFT铸造Mock流程
- 粉丝端（榜单、市场）
- 掌门人端（小队监控）
- 6套主题设计系统

### Phase 2 — 功能增强（已完成 ✅）
- AI孵化器Phase 2架构重构（AIIncubator.tsx + SingerEditor.tsx）
- 服装换装系统WardrobeSystem（200+件单品，5个槽位，稀有度系统）
- 姿态动作库PoseLibrary（30+姿态，12种表情，8种手势）
- DistributionPage多渠道发行（账号绑定体系）
- MusicGenerationDialog（11种生成模式）
- NFTMintingDialog（4步骤铸造流程）
- ArtistSigningDialog + ArtistDetailDialog + ArtistListingDialog
- GlobalAudioPlayer（全局悬浮播放器）
- OnboardingGuide（新手引导）

### Phase 3 — 高级生态建设（规划中 📅）

| 功能 | 优先级 | 复杂度 |
|---------|----------|-----------|
| 社区IP市场 | ⭐⭐⭐⭐⭐ 最高 | 高 |
| 真实AI生成API对接（Replicate/SDXL） | ⭐⭐⭐⭐⭐ 最高 | 高 |
| 基因混合真实算法实现 | ⭐⭐⭐⭐ 高 | 高 |
| Supabase全量数据持久化 | ⭐⭐⭐⭐⭐ 最高 | 中 |
| 用户认证系统（Supabase Auth） | ⭐⭐⭐⭐⭐ 最高 | 中 |
| AI对话生成器（角色人设对话） | ⭐⭐⭐⭐ 高 | 高 |
| 3D专业捏脸工具 | ⭐⭐⭐ 中 | 极高 |
| VRM格式导出（Unity/VRChat兼容） | ⭐⭐⭐ 中 | 极高 |
| 品牌IP联名合作系统 | ⭐⭐⭐⭐ 高 | 中 |
| 粉丝DAO治理模块 | ⭐⭐⭐ 中 | 高 |
| 真实区块链集成（EVM） | ⭐⭐⭐ 中 | 极高 |
| Zustand状态管理升级 | ⭐⭐⭐⭐ 高 | 低 |
| React Router集成（多页面） | ⭐⭐⭐ 中 | 中 |
| 单元测试 + E2E测试套件 | ⭐⭐⭐⭐ 高 | 中 |
| 性能优化：大库虚拟滚动 | ⭐⭐⭐ 中 | 低 |

### Phase 3 核心技术要求

#### AI图像生成对接
```typescript
// 所需环境变量
REPLICATE_API_TOKEN=<token>
OPENAI_API_KEY=<token>         // DALL-E 3 备用方案

// 推荐模型：stability-ai/sdxl 或 black-forest-labs/flux-schnell
// Prompt构建：concat(风格前缀, personaParams转文字, 质量后缀)
```

#### Supabase认证集成
```typescript
// 需支持的认证方式：
// - 邮箱/密码
// - Google OAuth（主要用户群体）
// - 微信 OAuth（中国市场关键路径）
// - MetaMask钱包（Web3用户群体）
```

#### 实时功能（Phase 3）
```typescript
// 需要Supabase Realtime订阅的场景：
// - 粉丝投票榜单实时更新
// - 掌门人小队活动动态流
// - NFT铸造状态实时推送
// - 曲目AI生成进度推送
```

---

## 附录A：Mock数据参考

### 模拟歌手（App.tsx MOCK_SINGERS）
```
1. Neon V         — 赛博朋克风   — 活跃
2. Luna Soft      — Lo-Fi Pop   — 开发中
3. Project: Zero  — 摇滚         — 规划中
```

### 模拟榜单（CHART_DATA）
```
排名  曲目           艺人            票数      趋势
1    《Neon Rain》   Neon V         12,450    ↑ 上升
2    《Cyber Heartbeat》 Project:Zero 10,890  ↑ 上升
3    《Digital Tears》   Luna Soft    9,800   ↓ 下降
4    《Void Echo》       Echo Bot     8,500   → 持平
5    《System Error》    Glitch Gang  7,200   ↑ 上升
```

### 模拟财务数据（TRANSACTIONS）
```
日期          摘要                      金额            状态
2024-03-15   版税结算 - 2024年2月      +¥12,450.00     已完成
2024-03-14   铸造收益 - Genesis勋章    +¥8,920.00      已完成
2024-03-12   AI服务费（Suno API）       -¥200.00       已完成
2024-03-10   提现到钱包（0x8...2a）    -¥5,000.00      处理中
```

---

## 附录B：组件文件映射表

| 文件路径 | 功能描述 | 代码行数（约） |
|------|---------|----------------|
| `/App.tsx` | 根组件，包含所有视图、翻译文案、Mock数据 | 2500+ |
| `/components/AIIncubator.tsx` | 歌手画廊，搜索/筛选，创建/删除操作 | 415 |
| `/components/SingerEditor.tsx` | 6-Tab歌��编辑器 | 365 |
| `/components/WardrobeSystem.tsx` | 服装库 + 装备系统 | 800+ |
| `/components/PoseLibrary.tsx` | 姿态/表情/手势库 | 700+ |
| `/components/DistributionPage.tsx` | 多渠道发行UI | 400+ |
| `/components/MusicGenerationDialog.tsx` | 11种模式音乐生成弹窗 | 300+ |
| `/components/NFTMintingDialog.tsx` | 4步骤NFT铸造弹窗 | 300+ |
| `/components/ArtistSigningDialog.tsx` | 4步骤艺人签约弹窗 | 250+ |
| `/components/ArtistDetailDialog.tsx` | 艺人数据分析弹窗 | 200+ |
| `/components/ArtistListingDialog.tsx` | 市场浏览弹窗 | 200+ |
| `/components/GlobalAudioPlayer.tsx` | 悬浮全局音频播放器 | 200+ |
| `/components/OnboardingGuide.tsx` | 首次启动引导流程 | 150+ |
| `/components/ThemeProvider.tsx` | 主题Context + 6套主题配置 | 150+ |
| `/components/ThemeSwitcher.tsx` | 悬浮主题切换器UI | 100+ |
| `/components/ThemeShowcase.tsx` | 主题预览弹窗 | 100+ |
| `/supabase/functions/server/index.tsx` | Hono API服务器（Deno） | 30 |

---

*文档结束 — AI Star Eco 产品与技术规格说明书 v2.5.1（中文版）*
