# AI Star Eco — 产品与技术规格说明书（中文版）
**版本号**: 2.6.0  
**文档类型**: 产品需求 + 技术架构  
**最后更新**: 2026-04-14  
**当前状态**: Phase 1 需求对齐完成 / 实施中  

## 文档版本迭代记录

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v2.6.0 | 2026-04-14 | 根据 2026-04-14 需求对齐会议，调整产品定位为“AI艺人/IP孵化”；明确一期聚焦音乐生成与分发、MV与专业编辑后置；补充模板化孵化、品牌植入、授权/买断签约、激活码与积分逻辑。 |
| v2.5.1 | 2026-04-08 | 仓库现有产品规格基线版本。 |

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

**AI Star Eco** 是一个面向制作人、MCN、品牌方与培训服务商的 **AI艺人/IP孵化与分发平台**。当前业务表达建议统一使用“AI艺人孵化”或“IP孵化”，而现有前端组件与部分代码仍沿用“AI歌手”命名。

平台的核心不是把所有复杂创作工具一次性做满，而是先打通“**账号开通 → 模板化孵化 → 音乐生成 → 分发 → 商业授权**”这条主链路，并为后续独立 APP、专业编辑器、MV 服务商、艺人公司系统对接预留接口。

- **模板化孵化** — 支持官方IP、创始人IP、品牌定制IP、短视频/短剧角色模板
- **音乐优先** — 一期先做音乐生成、试听、轻编辑与分发，MV 与专业编辑后置
- **商业授权** — 支持形象授权、买断、广告植入、品牌联名、数字资产打包
- **SaaS/贴牌** — 系统既可独立售卖，也可与“艺人公司”系统打通，支持贴牌与渠道授权
- **多角色生态** — 面向粉丝、制作人、掌门人提供不同工作台与协作链路

### 核心用户痛点

传统音乐、广告与虚拟形象行业的工具链高度割裂。独立制作人、经纪团队和品牌方面临以下核心问题：

1. 缺乏能把“人物设定、音乐生成、素材沉淀、分发授权”串起来的一体化工作台
2. 完全自由式的 AIGC 生产难以培训、难以标准化交付，缺少模板框架和可复制方法
3. 账号授权、激活码、积分、配额、合同类型往往散落在多个系统里，运营成本高
4. 真正复杂的音视频编辑门槛很高，浏览器内重做一遍成本极大，必须分阶段建设

AI Star Eco 的第一目标不是替代所有专业软件，而是将碎片化流程收敛成可执行的业务闭环：**开通账号 → 孵化艺人/IP → 生成音乐 → 分发曝光 → 授权变现**。

---

## 2. 用户角色与画像

应用支持三种独立用户入口，每种角色拥有专属工作台：

### 2.1 粉丝（星际听众 / Galactic Listener）
- **核心目标**: 发现 AI 音乐、为榜单投票、收集限量 NFT 勋章
- **入口路径**: 落地页 → "进入秀场 / Enter Show"
- **核心操作**: 浏览榜单、为歌曲投票、铸造/收集勋章、发现新艺人
- **变现参与**: 被动角色 — 购买勋章/周边，参与粉丝DAO投票

### 2.2 制作人（造梦架构师 / Dream Architect）
- **核心目标**: 从零孵化 AI 艺人/IP，生成音乐与素材，完成授权分发和商业变现
- **入口路径**: 落地页 → "开始创作 / Start Creating" → 完整制作人控制台
- **核心操作**: 选择模板、固定角色元素、生成音乐、沉淀素材库、绑定平台账号、签约/挂牌、管理收益与积分
- **变现模式**: 主动角色 — 销售激活码、收取培训/服务费、获取品牌投放与授权收益、承接分发服务

### 2.3 MCN掌门人（生态领航员 / Ecosystem Navigator）
- **核心目标**: 管理制作人/学员团队、监控KPI、下发任务、赚取生态分润
- **入口路径**: 落地页 → "管理后台 / Coach Hub" → 掌门人控制台
- **核心操作**: 监控学员表现、审批/驳回作品提交、管理激活账号与配额、跟进分发与广告合作
- **变现模式**: 被动分润 — 从学员服务收入、广告撮合、代运营项目中获取分成

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
制作人工作台（ProducerApp，业务表达为 AI艺人/IP 孵化台）
├── 侧边栏导航（全程固定显示）
│   ├── 经纪大盘 → 总览面板（默认）
│   ├── AI艺人/IP孵化 → AIIncubator 组件（现有组件名保留）
│   ├── 模板与素材中心 → 官方IP / 创始人IP / 品牌IP / 道具场景库
│   ├── 音乐工坊 → AI录音棚（一期主能力）
│   ├── 视频/MV工坊 → Phase 2+ 能力（一期仅预留）
│   ├── 版权与链上资产 → NFT铸造模块
│   ├── 发行与运营 → DistributionPage 组件
│   ├── 市场与签约 → 艺人挂牌 / 授权 / 买断
│   ├── 账号授权 → 激活码 / 配额 / 积分
│   └── 商业变现 → 财务/收益中心
└── 主内容区（随导航动态切换）
```

### 3.3 AI艺人/IP孵化流程（当前组件名仍为 AI歌手孵化）
```
AIIncubator（主画廊页）
├── 查看已孵化艺人/IP卡片（网格布局）
├── 搜索与筛选（状态筛选：全部/活跃/草稿/归档）
├── "创建新艺人" → 创建草稿艺人 → 进入 SingerEditor
└── 点击卡片"编辑" → SingerEditor

SingerEditor（6-Tab创作工作台，后续继续扩展模板与素材派生）
├── Tab 1：模板与官方IP库
│   ├── 模板类型：官方IP / 创始人IP / 品牌联名IP / 短剧角色
│   └── 选择模板 → 自动填入：名称、头像、风格、标签、人格参数、推荐素材结构
├── Tab 2：参数调节
│   ├── 快速预设（甜美少女 / 冷酷女王 / 活力青春 / 神秘精灵 / 创始人IP / 品牌代言人）
│   ├── 核心参数：甜度 / 能量 / 神秘感（0–100滑块）
│   └── 基本信息：艺人名称、音乐风格、商业用途标签
├── Tab 3：基因混合
│   └── 【规划中】选择两位父本歌手 → 设置混合比例 → 生成后代
├── Tab 4：图片定制与合规参考
│   ├── 上传参考图 → AI生成相似风格艺人
│   └── 若涉及真人肖像、名人脸或品牌元素，进入人工/法务校验队列
├── Tab 5：服装换装（WardrobeSystem）
│   ├── 分类筛选：全部 / 上衣 / 下装 / 配饰 / 鞋子 / 发型
│   ├── 全库搜索（200+件单品）
│   ├── 稀有度系统：普通 / 稀有 / 史诗 / 传说
│   ├── 按槽位装备/卸下服装
│   ├── 收藏管理
│   ├── 一键随机搭配
│   ├── 保存套装为命名预设
│   └── 实时预览面板（艺人 + 当前装备 + 品牌露出位）
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

孵化完成后
├── 固化人物元素：脸型 / 发型 / 服装 / 道具 / 场景 / 语气标签
├── 派生素材库：海报、封面、广告图、短视频脚本素材、MV封面
└── 输出用途：音乐发布 / 广告代言 / 短视频矩阵 / 课程案例 / 品牌共创
```

### 3.4 音乐制作流程
```
AI录音棚（产品能力分层设计）
├── L1：哼唱/自动生成版（一期优先落地）
│   ├── 文本模式：提示词 + 风格 → 生成
│   ├── 旋律模式：上传旋律音频 + 风格描述
│   ├── 歌词成歌：粘贴歌词 → 生成完整曲目
│   ├── 灵感写歌：自由创意输入 → AI诠释创作
│   ├── 图片成歌：上传图片 → AI生成配乐
│   └── 轻编辑：试听、重生成、片段裁剪、15s/30s/60s 导出
├── L2：外设辅助版（Phase 2）
│   └── 接入 MIDI / 外部乐器 / 更多结构化参数
├── L3：专业音色库版（Phase 3 或独立 APP）
│   └── 分轨、STEM、专业音色库、复杂编曲与混音
├── 外部能力策略
│   ├── 后端以“多引擎抽象层”接入音乐服务商，避免单一供应商锁定
│   ├── 可对接 Suno 类能力，必要时支持跳转第三方编辑页
│   └── 浏览器内不在一期重做完整 DAW
└── 视频/MV说明
    ├── 图片转视频、视频生成能力后续可接入
    └── 一期只保留扩展位与数据结构，不作为上线阻塞项

生成状态流转：输入 → 生成中（带阶段进度） → 预览 → 轻编辑 → 成功
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
├── 账号绑定状态（按所需平台逐一显示；账号归用户/机构自身所有）
├── 发行计划（日期 + 时间选择，预存功能开关）
├── 发布 → 触发多平台分发任务
└── 收益说明
    ├── 外部平台收益默认回流到绑定的平台账号
    └── 平台侧优先记录分发状态、服务费与估算数据，不在一期承诺全自动分账
```

### 3.7 艺人签约流程（MCN / 市场）
```
ArtistListingDialog → 浏览市场艺人
└── ArtistSigningDialog（艺人签约弹窗）
    ├── 第1步：查看详情 — 艺人信息（风格、作品数、粉丝数、可授权资产）
    ├── 第2步：选择合同类型
    │   ├── 买断转让
    │   ├── 独家运营授权
    │   └── 非独家形象使用授权
    ├── 第3步：选择权利范围
    │   ├── 形象使用权
    │   ├── 音乐资产包
    │   ├── 广告/短视频投放权
    │   └── 社交账号/粉丝资产（可选）
    ├── 第4步：合同条款与支付确认
    │   └── 明确期限、地域、分成、是否转移既有曲目版权
    └── 第5步：签约成功 — 艺人加入制作人的签约名单
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

### 3.10 账号开通与激活码授权流程
```
代理/直客获取激活码
├── 新用户注册/登录
├── 输入激活码 → 校验批次、有效期、是否已入库
├── 绑定工作区/经纪公司身份
├── 开通默认额度（如 3 个 AI 艺人名额）
├── 发放赠送积分（默认 100 点）
├── 后续通过购买点数 / 升级套餐 / 补充授权包继续扩容
└── 结算模式支持
    ├── 预付码包：发码即结算
    └── 激活结算：用户激活后再结算
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
| PD-02 | AI艺人/IP孵化 | 搜索词、状态筛选 | 创建、编辑、删除、归档艺人；进入 SingerEditor |
| PD-03 | 编辑器-模板/IP库 | IP卡片选择、模板类型 | 应用官方IP、创始人IP、品牌模板；回填基础结构 |
| PD-04 | 编辑器-参数调节 | 甜度/能量/神秘感滑块（0–100），名称、风格、商业用途文本框 | 应用快速预设、手动调节、保存 |
| PD-05 | 编辑器-基因混合 | 父本A、父本B选择，混合比例滑块 | 生成后代（Phase 3规划） |
| PD-06 | 编辑器-图片定制 | 图片文件上传、来源声明 | AI图生人设（Phase 3规划）；合规标记与审核 |
| PD-07 | 编辑器-服装换装 | 分类筛选、搜索、服装卡片选择 | 按槽装备/卸下、收藏、随机搭配、保存套装、导出；支持品牌露出位 |
| PD-08 | 编辑器-姿态动作 | 姿态分类筛选、姿态卡片、表情emoji、强度滑块、手势 | 应用姿态/表情/手势组合、预览、保存 |
| PD-09 | AI录音棚（一期） | 提示词、风格、歌词、旋律、图片等 | 生成曲目（消耗积分）、试听、重生成、加入曲库 |
| PD-10 | NFT铸造 | 合集名称、发行量、ETH价格、版税比例、稀有度、空投开关 | 连接钱包、铸造、在区块链浏览器查看 |
| PD-11 | 发行与运营 | 曲目选择、渠道多选、账号绑定、发行日期/时间、预存开关 | 发布至选定平台；跟踪分发状态；展示收益回流说明 |
| PD-12 | 商业变现/财务 | — | 查看积分、服务费、培训费、广告收益、交易记录、提现 |
| PD-13 | 轻编辑台 | 音频片段、时长裁剪、导出规格 | 试听、裁剪、导出短版；复杂编辑延后 |
| PD-14 | 市场与签约 | 艺人市场列表、合同类型、授权范围 | 签约艺人、查看详情、管理买断/授权合同（企业版增强） |
| PD-15 | 账号授权 | 激活码、额度包、积分包 | 兑换激活码、查看配额、补充点数、查看授权状态 |

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
| 前端应用 | Next.js 14（App Router） + TypeScript |
| 样式系统 | Tailwind CSS v4 + shadcn/ui |
| 动效库 | Motion/React |
| 图表库 | Recharts（BarChart、AreaChart） |
| 图标库 | Lucide-React |
| UI组件库 | Radix UI primitives + `apps/web/src/components/ui/` |
| BFF层 | Next.js Route Handlers（当前对接 mocks，后续代理 Spring Boot） |
| 后端服务 | Spring Boot 3.3.5 + Java 17 + Spring Data JPA |
| 数据库 | H2（开发） / PostgreSQL（生产规划） |
| 契约 | OpenAPI 3.1 + openapi-typescript |
| AI能力集成 | 音乐/图像/视频能力通过外部引擎抽象层接入，专业编辑后续独立 APP 化 |

### 5.2 应用架构

```
apps/web（Next.js）
├── src/app/**                    页面路由与 Layout
├── src/views/**                  页面级视图组件
├── src/features/**               领域 hooks / providers
├── src/components/**             业务组件（AIIncubator、SingerEditor、DistributionPage 等）
├── src/api/**                    Typed API client
├── src/app/api/**                Route Handlers（当前 BFF）
└── src/mocks/**                  开发期 Mock Resolver

apps/server（Spring Boot）
├── controller/**                 REST 控制器
├── service/**                    业务逻辑
├── repository/**                 数据访问
├── model/**                      JPA 实体
├── dto/**                        请求/响应 DTO
└── common/**                     统一返回、异常、错误处理

当前联调链路：
Page → feature hook → api client → app/api/** → mocks/**

目标联调链路：
Page → feature hook → api client → app/api/** → apps/server（Bearer JWT）
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

当前正式工程的状态管理采用“**路由状态 + 领域 hooks + provider context + BFF 数据请求**”组合方式，而不是单一根组件托管：

- 路由状态：由 Next.js App Router 驱动页面切换与布局层级
- 领域状态：由 `features/**/hooks` 管理，如 `use-singers`、`use-tracks`、`use-producer-workspace`
- 全局偏好：由 `ThemeProvider`、`app-preferences-provider`、`useDictionary()` 等 Context/Provider 管理
- 数据流：`Page/View → feature hook → api client → Route Handler → mock / Spring Boot`

**当前推荐的状态分层：**
```typescript
// 1. 全局偏好
theme             // 主题
lang              // 中英双语
workspace         // 当前制作人工作区 / 经纪公司视角

// 2. 领域数据
singers           // 艺人列表
tracks            // 曲库与生成任务
marketplace       // 挂牌与合同
distribution      // 渠道绑定与发行任务
credits           // 积分余额 / 历史

// 3. 临时UI状态
dialogs           // 音乐生成、NFT铸造、签约等弹窗
filters           // 搜索、筛选、排序
editorDraft       // 当前编辑中的艺人/IP草稿
```

> 注：根目录 `src/App.tsx` 中的 `useState` 组织方式仍可作为原型阶段参考，但正式实现应以 `apps/web` 的领域化状态拆分为准。

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

#### 统一积分与配额规则
- 新用户注册默认获得 **100 点赠送积分**
- 音乐生成默认 **5 点/次**，服装/道具/模板包/高级编辑能力统一走积分或套餐解锁
- 套餐升级优先带来更高额度、更高模型等级和更多积分，而不是单独售卖功能按钮
- 异步任务失败必须退回预扣积分；一次性消费型道具/解锁型商品不退回
- 激活码可同时开通账号资格、艺人名额与初始积分

#### 编辑能力分层规则
```
L1（一期）：哼唱/自动生成 + 试听 + 轻编辑
L2（二期）：结构化参数 + 外设辅助 + 更多控制项
L3（三期/独立APP）：专业音色库 + 分轨 + 深度编辑
```

#### 艺人签约与授权规则
```
签约合同至少分为三类：
- 买断转让：形象/资产所有权按合同转移，后续收益默认归受让方
- 独家运营授权：原创者保留所有权，运营方按合同获取独家商业运营权
- 非独家授权：适合广告、短视频、单次活动等限定场景

默认运营授权合同收益分成（可配置）：
- 运营方（购买/MCN方）：70%
- 原创者：30%

必须显式约定：
- 是否转移既有曲目版权
- 是否包含社交账号/粉丝资产
- 合同期限、地域、媒介范围、商业用途
```

#### NFT版税逻辑
- 版税比例在**铸造时**由创作者设定
- 版税仅适用于**二级市场**交易
- 一级市场销售收益100%归铸造制作人
- 稀有度影响视觉展示和市场感知价值，但不直接改变经济公式

#### 发行与收益回流规则
- 播放激励：约每万次播放 ¥30–80（平台估算值）
- 腾讯/网易渠道自动添加「AI创作」标签
- 全球DSP（通过DistroKid）：适用行业标准版税费率
- 外部平台收益默认回流至用户/机构绑定的第三方账号
- 一期平台只对分发状态、估算数据、服务费/培训费/广告费负责，不承诺覆盖所有外部结算链路
- 当平台后续具备 MCN 托管账号能力后，才在系统内启用自动分账

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

### 5.6 当前实现接口与目标接口

当前工程采用 `apps/web` + `apps/server` 双应用结构：

- `apps/web/app/api/**`：当前作为 BFF/Mock Route Handlers
- `apps/server`：Spring Boot REST API，逐步承接真实业务逻辑
- 成功响应统一为 `{ "data": ... }`，错误响应统一为 `{ "error": { "code", "message" } }`

**核心目标接口：**
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

POST   /api/activation-codes/redeem   兑换激活码
GET    /api/activation-codes/status   查询激活码状态/额度包信息

GET    /api/analytics/dashboard  汇总仪表盘指标数据
```

### 5.7 持久化模型示意（Spring Boot / PostgreSQL 规划）

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
  workspace_id UUID,
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
  workspace_id UUID,
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
  contract_type VARCHAR(30),      -- buyout / exclusive_license / non_exclusive_license
  rights_scope JSONB,             -- 形象、音乐、广告、社交资产等
  duration_days INT,
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

-- 激活码批次表
CREATE TABLE activation_code_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_no VARCHAR(64) UNIQUE NOT NULL,
  settlement_mode VARCHAR(20) NOT NULL,  -- prepaid / on_activation
  default_singer_slots INT DEFAULT 3,
  default_credit_amount INT DEFAULT 100,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 激活码表
CREATE TABLE activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES activation_code_batches(id),
  code_hash VARCHAR(128) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL,           -- created / imported / sold / activated / revoked
  workspace_id UUID,
  activated_by UUID REFERENCES users(id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. UI状态与组件行为

### 6.1 音乐生成弹窗（MusicGenerationDialog）状态

| 状态 | UI表现 |
|-------|-------------|
| `input`（输入） | 表单可见；所有字段可编辑；"生成"CTA激活 |
| `generating`（生成中） | 进度条动画；阶段标签动态更新（分析参数→作曲中→编曲中→母带处理→完成）；表单隐藏；取消按钮可用 |
| `preview`（预览） | 生成曲目元数据展示；音频播放控件可用；"使用此曲目" / "重新生成" / "轻编辑"选项 |
| `success`（成功） | 确认动效；"下载"、"分享"、"加入曲库"CTA；自动关闭倒计时 |
| `pro-upsell`（能力升级提示） | 当用户尝试使用高级编辑或更高模型时，展示专业版升级提示 |

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
| `contract-type`（合同类型） | 选择买断 / 独家授权 / 非独家授权；同步展示默认分成与权利差异 |
| `rights-scope`（权利范围） | 勾选形象、音乐、广告、社交资产等授权包；未选不得继续 |
| `payment`（支付确认） | 费用明细、期限、地域、分成；"确认支付"按钮；可取消 |
| `success`（签约成功） | 动效庆祝；"查看合同"、"查看艺人"、"关闭"CTA；更新签约名单 |

### 6.4 AI艺人孵化器视图状态

| 状态 | UI表现 |
|-------|-------------|
| 画廊（默认） | 艺人卡片网格；搜索/筛选栏；创建CTA |
| 空状态 | 居中Sparkles图标；"暂无艺人"提示；"创建新艺人"CTA |
| 编辑中 | SingerEditor完全替换画廊视图（非弹窗，全屏视图切换） |
| 保存中 | 保存按钮短暂加载态；乐观UI更新 |
| 模板预置中 | 模板字段自动回填；推荐素材结构异步加载 |

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
| 上传疑似名人/真人照片 | 未区分 | 增加来源声明、风险提示与人工复核 |
| 品牌联名模板未上传授权材料 | 未校验 | 禁止进入商业发布流程 |
| NFT发行量设为0 | 无前端校验 | 最小值设为1 |
| NFT版税超过100% | 无上限校验 | 最大100%，超过30%时弹出警告 |
| 发行时间设为过去 | 无校验 | 禁止排期到过去的时间 |
| 签约时未选择合同类型/权利范围 | 未处理 | 前端拦截 + 后端强校验 |

### 8.2 API与网络边界情况

| 场景 | 当前处理方式 | 建议处理方式 |
|----------|-----------------|---------------------|
| AI音乐生成失败 | 静默处理，Mock阶段无错误状态 | 弹出错误Toast；退还积分；提供重试入口 |
| 生成超时（>60秒） | 未处理（Mock） | 60秒后超时；通知用户；加入重试队列 |
| 第三方音乐引擎不可用 | 未处理 | 自动切换备用引擎；保留“稍后重试/跳转外部编辑器”方案 |
| 某发行渠道API宕机 | 未处理 | 显示各渠道状态标识；支持部分发布并生成失败报告 |
| 外部平台收益无法回流 | 未处理 | 标记为“平台外结算”，只展示渠道状态和绑定说明 |
| 用户拒绝连接钱包 | 未处理 | 显示拒绝提示；提供其他钱包选项 |
| NFT铸造链上交易被拒 | 未处理 | 解析交易错误；显示人类可读的错误信息 |
| 图片上传失败 | 未处理 | 文件大小限制（最大10MB），格式校验（JPG/PNG/WebP） |
| 音频文件过大 | 未处理 | 限制50MB；支持MP3/WAV/FLAC格式 |
| 激活码未入库或状态不匹配 | 未处理 | 返回明确错误码并提示联系渠道/管理员 |

### 8.3 权限与访问约束

| 功能 | 免费版 | 专业版 | 企业版 |
|---------|-----------|----------|-----------|
| AI歌手创建数量 | 最多3位 | 最多20位 | 无限制 |
| 音乐生成积分 | 5点/天 | 50点/天 | 无限制 |
| 轻编辑能力 | ✅ | ✅ | ✅ |
| 高级编辑能力 | ❌ | 可购买/按套餐开通 | ✅ |
| NFT铸造 | ❌ 锁定 | ✅ 最多10个/月 | ✅ 无限制 |
| 发行渠道 | 仅国内渠道 | 全渠道 | 全渠道+优先队列 |
| 粉丝社群模块 | ❌ 锁定 | ✅ | ✅ |
| MCN管理 | ❌ 锁定 | ❌ | ✅ |
| 基因混合实验室 | ❌ 锁定 | ✅ | ✅ |
| 传说级服装单品 | ❌ 锁定 | 可购买 | 已包含 |
| 品牌定制模板 | ❌ | 可购买 | ✅ |

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
- 上传真人照片、名人脸、品牌视觉元素时，必须要求用户确认授权来源并保留证据链
- 形象权、音乐版权、社交账号资产、广告投放权不默认打包转移，必须在合同中显式列明
- 品牌联名服装、道具、场景素材需以品牌方提供或已授权素材为准，生成结果需满足品牌审核要求
- NFT合约在主网部署前必须经过安全审计
- NFT铸造中的空投功能在特定司法管辖区可能受证券法监管

---

## 9. 阶段路线图

### Phase 1 — 核心主链路（当前实施）
- 落地页 + 三角色入口
- AI艺人/IP 模板化孵化
- 音乐生成（哼唱/自动生成版）+ 轻编辑
- 激活码开通账号 + 默认额度 + 赠送积分
- 账号绑定与分发任务骨架
- 市场挂牌 / 签约合同基础能力
- 掌门人端小队监控与审批

### Phase 2 — 对外分发与品牌商业化
- 外部音乐平台账号绑定与真实分发
- 图片转视频 / MV 生成能力接入
- 品牌联名模板、服装/道具广告位管理
- 素材库批量派生、短视频矩阵分发
- 与“艺人公司”系统做批次、激活码、结算对接
- 更完整的 MCN 代运营与托管场景

### Phase 3 — 专业创作与链上资产

| 功能 | 优先级 | 复杂度 |
|---------|----------|-----------|
| 多引擎真实AI生成接入（音乐/图像/视频） | ⭐⭐⭐⭐⭐ 最高 | 高 |
| 专业音色库与分轨编辑 | ⭐⭐⭐⭐⭐ 最高 | 极高 |
| 独立专业编辑 APP / 工作台 | ⭐⭐⭐⭐ 高 | 极高 |
| 品牌IP联名合作系统 | ⭐⭐⭐⭐ 高 | 中 |
| 真实区块链集成（EVM） | ⭐⭐⭐ 中 | 极高 |
| NFT 二级市场与权益映射 | ⭐⭐⭐ 中 | 高 |
| 3D专业捏脸工具 | ⭐⭐⭐ 中 | 极高 |
| VRM格式导出（Unity/VRChat兼容） | ⭐⭐⭐ 中 | 极高 |
| 更高级的模板市场与资产交易 | ⭐⭐⭐⭐ 高 | 高 |
| 单元测试 + E2E测试套件 | ⭐⭐⭐⭐ 高 | 中 |
| 性能优化：大库虚拟滚动 | ⭐⭐⭐ 中 | 低 |

### 后续阶段核心技术要求

#### 多引擎能力编排
```typescript
// 示例环境变量
MUSIC_PROVIDER_PRIMARY=<provider>
MUSIC_PROVIDER_FALLBACK=<provider>
VIDEO_PROVIDER=<provider>
IMAGE_PROVIDER=<provider>

// 原则：
// 1. 服务商以抽象层接入，不把前端直接耦合到某一家引擎
// 2. 支持主引擎失败后的回退策略
// 3. 高级编辑与外部跳转能力通过配置开关控制
```

#### 统一认证与激活码接入
```typescript
// 需支持的认证方式：
// - 邮箱/密码
// - Google OAuth（主要用户群体）
// - 微信 OAuth（中国市场关键路径）
// - 激活码兑换开通
// - MetaMask钱包（后续Web3场景）
```

#### 实时任务推送
```typescript
// 需要实时推送/轮询的场景：
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

## 附录B：原型组件文件映射表（历史参考）

> 说明：下表主要对应根目录 `src/` 下的 Figma 原型导出文件，用于追溯早期交互来源。当前正式工程实现已迁移到 `apps/web` 与 `apps/server`。

| 文件路径 | 功能描述 | 代码行数（约） |
|------|---------|----------------|
| `/App.tsx` | 根组件，包含所有视图、翻译文案、Mock数据 | 2500+ |
| `/components/AIIncubator.tsx` | 歌手画廊，搜索/筛选，创建/删除操作 | 415 |
| `/components/SingerEditor.tsx` | 6-Tab歌手编辑器 | 365 |
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
| `/apps/web/src/app/api/**` | Next.js Route Handlers（当前 BFF / Mock 代理） | — |
| `/apps/server/src/main/java/com/aistareco/**` | Spring Boot 后端实现 | — |

---

*文档结束 — AI Star Eco 产品与技术规格说明书 v2.6.0（中文版）*
