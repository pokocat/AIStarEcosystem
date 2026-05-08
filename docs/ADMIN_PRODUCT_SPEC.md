# 后台运营管理系统 · 产品说明书

> 版本：v1.0（2026-05-07）
> 适用对象：`apps/admin` 管理后台
> 配套真值源：`apps/web/src/types/*`（领域类型）、`apps/web/src/constants/*`（UI 字典）、`apps/web/src/mocks/*`（待替换为后台可配置的真实数据）
> 核心理念：**前台展示的所有内容都必须可被运营在后台配置**——没有"写死在代码里"的字典、参数、模板或列表。

---

## 0. 设计原则

1. **零硬编码字典**：当前 `apps/web/src/constants/*` 中的图标 / 颜色 / 标签 / 分类 / 价格 / 阶段 / 选项，全部上移到后台为「配置项数据」，前端按 key 拉取并渲染。
2. **零硬编码列表**：当前 `apps/web/src/mocks/*` 中的 AI 明星、艺人、模板、商品、服装、姿态、引擎、音乐流派、影视分类、节日活动等，全部成为后台 CRUD 实体。
3. **配置即版本化**：每条配置都有 `version / draft / publishedAt / publishedBy` 元数据；运营修改后先存草稿，发布后才对前台生效（详见 §10）。
4. **配置可灰度**：配置项支持「全量 / 白名单 / AB 实验」三档投放（详见 §10.4）。
5. **配置可审计**：所有写操作进入 `AuditLog`（已有 `apps/admin/src/types/audit.ts`），记录前后值 diff。
6. **三端对齐**：每张配置表都遵循 `web types ↔ admin types ↔ server entity/dto` 同名同字段的硬约束（参见 `AGENTS.md` §「领域模型完整对齐表」）。

---

## 1. 系统总览

后台分 **6 个一级菜单**，对齐 `apps/admin/src/app/` 现有路由，并补齐覆盖 `apps/web` 全部展示面：

| 一级菜单 | 现有目录 | 主要职能 | 前台对应 |
|---------|---------|----------|---------|
| 平台 (Platform) | `platform/` | 账号、机构、工作室、License、平台配置 | `/login`、`/activate`、`/portal` |
| 艺人 (Artists) | `artists/`、`celebrity/` | 数字艺人 IP、AI 明星、签约花名册、生命周期 | `/producer/artists`、`/producer/artist`、`/producer/celebrity-zone/**` |
| 内容 (Content) | `content/` | 音乐、影视、综艺、广告、声音、版权 | `/producer/music`、`/producer/copyright` |
| 分发 (Distribution) | `distribution/` | 分发渠道、提交队列、审核 | `/producer/distribution` |
| 变现 / 财务 (Monetization & Finance) | `monetization/`、`finance/` | 钱包账本、积分包、套餐、提现、对账 | `/producer/finance` |
| 基础数据 (Base) | `base/` | 字典、模板、姿态、服装、流派、引擎、生成参数 | `/producer/wardrobe`、`/producer/appearance`、`/producer/incubator` |
| 社区 / 通知 | `community/`、`notifications/` | 粉丝团、活动、消息中心、Banner、公告 | `/fan`、`/coach`、全局 NoticeBoard |
| 审计 (Audit) | `audit/` | 操作日志、登录日志、风控 | — |

> 现有 `apps/admin/src/app/` 已含：`platform/{accounts,config,licenses,studios}`、`celebrity/{products,projects,stars}`、`content/{ads,albums,concerts,copyright,dramas,movies,songs,voice}`、`base/{credit-packs,genres,pose,presets,wardrobe}`、`artists`、`distribution`、`finance`、`monetization`、`community`、`audit`、`notifications`。本文档以**补齐配置化**为目标重写。

---

## 2. 平台域 · Platform

### 2.1 账号管理 `platform/accounts`
- **管理对象**：`AdminUser`（管理员）+ `AepUser`（前台用户：Fan / Producer / Coach）。
- **可配置字段**：用户名、邮箱、手机、角色（`PLATFORM_OPERATOR` / `FINANCE_ADMIN` / 前台 `Fan` / `Producer` / `Coach`）、状态（active/suspended/banned）、绑定机构、绑定 License。
- **前台联动**：禁用用户 → 立即吊销 JWT；调整角色 → 下次登录后端读取新角色生效；前台 `/portal`、`/producer/*`、`/fan`、`/coach` 入口按角色显示/隐藏。

### 2.2 机构 / 工作室 `platform/studios`
- **管理对象**：`Studio`（含 `AdminStudio` 扩展）。
- **可配置字段**：名称、logo、Slogan、签约艺人配额上限、可用积分包、客户经理、生效期。

### 2.3 License 管理 `platform/licenses`
- **管理对象**：`LicenseBatch`、`LicenseKey`。
- **可配置字段**：批次名、有效期、激活上限、绑定机构、绑定套餐、激活方式（一次性 / 多次）。
- **前台联动**：`/activate` 页面校验码、剩余次数、过期文案。

### 2.4 平台配置 `platform/config`（**新增/扩展**）
全站级别的开关与文案，对应当前散落在 web 各处的硬编码：

| 配置组 | 配置项示例 | 当前硬编码位置 |
|-------|-----------|---------------|
| 主题 | 默认主题（dark/light）、品牌主色、可选主题列表 | `apps/web/src/components/ThemeProvider.tsx`、`ThemeShowcase.tsx` |
| 站点文案 | 站点名、Slogan、备案号、页脚文案 | `apps/web/src/components/HomePage.tsx` |
| 登录 / 激活 | 登录方式开关（密码 / 验证码 / 第三方）、激活说明文案、客服联系方式 | `apps/web/src/app/login/page.tsx`、`/activate` |
| 全局 FAB | 浮动按钮项、跳转、可见角色 | `apps/web/src/constants/fab-actions.ts` |
| 命令面板 | ⌘K 命令项 | `apps/web/src/constants/command-items.ts` |
| 引导 | 新手引导步骤、视频地址、完成奖励 | `apps/web/src/components/OnboardingGuide.tsx` |
| 公告 / 通知栏 | 全站 NoticeBoard 多条公告、有效期、目标角色 | `apps/web/src/components/NoticeBoard.tsx` |
| 弹幕 | DanmakuLive 默认开关、敏感词、刷新频率 | `apps/web/src/components/DanmakuLive.tsx` |
| 风控 | 单 IP / 单账号生成频次、敏感词、内容审核策略 | — |
| 维护模式 | 全站维护开关、白名单、提示文案 | — |

---

## 3. 艺人域 · Artists（含 AI 明星）

### 3.1 数字艺人花名册 `artists/`（对齐 `apps/web/src/types/artist.ts`）

#### 3.1.1 艺人列表（CRUD）
- **字段**：`id / name / type / quality / status / talents{6} / stats{8} / mbti / horoscope / debutDate / coverUrl / bio / coachId / studioId / labels[]`。
- **可配置文案**：状态徽章颜色 / 文案、品质（Rarity）色阶、类型徽章。

#### 3.1.2 艺人参数字典（**当前在 `apps/web/src/constants/artist-config.ts` 硬编码**）
| 字典 | 含义 | 字段 |
|-----|------|------|
| `ArtistType` 列表 | 艺人分类（singer/actor/entertainer/dancer/host/all_rounder/idol） | id、中文名、icon、配色、是否启用 |
| `ArtistQuality` 列表 | 稀有度（common/rare/epic/legendary）| id、中文名、徽章色、获得概率（用于盲盒） |
| `ArtistStatus` 列表 | 生命周期（trainee/debut/active/rest/retired）| id、中文名、徽章色、可流转目标状态 |
| 才艺六维 `TalentProfile` | singing/acting/dancing/hosting/comedy/variety | label、icon、最大值、加成系数 |
| MBTI / 星座 | 用于人设 | 启用列表、文案 |

**配置发布后**：`apps/web/src/constants/artist-config.ts` 改为运行时从 `/api/config/artist` 拉取（首屏 SSR；配 SWR 缓存）。

#### 3.1.3 艺人生命周期规则（**当前隐式**）
- 状态机配置：`trainee → debut → active`、`active ↔ rest`、`active → retired`、各跳转所需积分 / 审批人。
- 出道前置条件：六维总分阈值、必备形象、必发歌曲数、签约关系。

### 3.2 AI 明星专区 `celebrity/stars`（对齐 `apps/web/src/types/celebrity-zone.ts`）

> 这是用户重点强调的「AI 明星列表」配置面。当前 `apps/web/src/mocks/celebrity-zone.ts` 写死了所有数据，必须全部后台化。

#### 3.2.1 AI 明星 CRUD（`CelebrityStar`）
- **基础字段**：`name / avatar / cover / category / subCategories / isHot / description / startingPrice`。
- **授权配置**（`CelebrityAuthorization`）：状态（unauthorized / pending / authorized / expired）、可用场景标签、过期日、可选风格数、申请入口 URL、审核预计时长文案。
- **统计展示字段**（`stats`）：累计生成数、累计播放、转化率、GMV—— 默认由系统计算，运营可手动覆盖（用于运营专区头牌的"门面数据"）。
- **样片库**（`sampleVideos`）：分类标签、缩略图、视频 URL、显示顺序。
- **价格档**（`pricing`：体验版 / 标准版 / 旗舰版）：价格文案、特性列表、是否推荐。
- **可见性**：上下架、权重、置顶、定向（按角色 / 机构 / 白名单）。

#### 3.2.2 模板基础信息（`CelebrityTemplate`）
> 这只是模板的「卡片元信息」（用户在专区里挑选用）。**真正决定生成效果的提示词剧本见 §3.2.7**——后端运行时优先读 `TemplateScript.published`，`CelebrityTemplate` 只做展示与 1:N 关联。

- **字段**：`name / style(种草/测评/开箱/直播切片/剧情植入) / description / recommendedEngine / recommendedPrice / isHot / plays / conversionRate / fitHint / previews[]`。
- **运营动作**：模板新增 / 编辑 / 下架；按 AI 明星绑定可用模板；按"风格类目"管理。
- **提示词剧本入口**：每行模板都有「编辑脚本」按钮 → 跳转 §3.2.7 的脚本编辑器。模板必须至少有 1 个 `published` 脚本才能在用户端可选。

#### 3.2.3 引擎配置 `base/engines`（**新增**）
当前 `apps/web/src/mocks/celebrity-zone.ts` 中的 `EngineMeta` 写死了 KeLing / HiGen / MiniMax 三档：
- **字段**：`name / level(经济/标准/高级) / cost / creditPrice / speed / quality / desc / color / 是否启用`。
- **接口**：后端暴露 `/api/celebrity/engine-pricing`，前端通过 `apps/web/src/api/celebrity-zone.ts` 拉取，**取代 mocks**。
- **运营动作**：新增/调价/调权/上下线；价格变更走灰度（§10.4）。

#### 3.2.4 创意倾向与时长字典
- `CreativeTendency`：不限制 / 偏搞笑 / 偏温馨 / 偏专业 / 偏潮流 / 偏反转 → 后台开关 + 文案 + 是否默认。
- `CelebrityVideoDuration`：15/30/60s → 可启用集合 + 默认值。

#### 3.2.5 项目 / 视频 `celebrity/projects`、`celebrity/videos`
- 运营视图：跨用户的项目列表、状态分布、人工干预（驳回 / 通过 / 重生成）。
- 渠道字典 `ChannelStatus`：抖音 / 快手 / 小红书 / 视频号 / B 站 → 后台增删与 OAuth 配置。
- 视频审核策略：自动通过 / 全部人工 / 抽检比例。

#### 3.2.6 商品库 `celebrity/products`（`CelebrityProductInput`）
- 商品名 / 链接 / 图片 / 卖点；运营审核违禁词、外链白名单。

#### 3.2.7 模板脚本系统 · `TemplateScript`（**新增 · 视频生成核心**）

> 用户重点强调：**模板要做成提示词的集合，足够详细，让模型按模板的约定输出视频**。本节定义这套"脚本"的数据模型、编辑器、运行时装配、三端契约。
>
> 当前现状：`CelebrityTemplate` 只持有 `description / fitHint / previews` 等营销面文案，**没有任何 prompt 字段**（`apps/web/src/mocks/celebrity-zone.ts` 397–489 行的 6 个模板可证）。后端拿到 `templateId` 后无 prompt 集合可装配，生成效果完全靠引擎默认值。本节闭环。

##### 3.2.7.1 设计目标
1. **双模可选**：
   - **`text` 模式**——结构化文本脚本，含分镜/视角/动作/口播/Prompt 片段（详 §3.2.7.2 / §3.2.7.3）。
   - **`video_ref` 模式**——上传一段视频素材作为模板内容，由模型按"风格 / 结构 / 节奏 / 全部"参考生成（详 §3.2.7.2.5）。
   - 两种模式共享变量系统、引擎适配、风控、后处理、版本化能力。
2. **结构化剧本**（text 模式）：一个模板 = 系统 Persona + 系统 Prompt + N 个 Scene（镜头/动作/口播/商品出镜/Prompt 片段） + 风格修饰 + 负向提示。
3. **运营只填中文剧本与提示词集合 / 上传参考视频**，运行时由后端 `PromptAssemblyService` 替换变量、按引擎方言改写、过风控，再调引擎。
4. **同一脚本兼容三引擎、三时长**：通过 `engineAdapters.{KeLing|HiGen|MiniMax}` 与 `durationVariants["15"|"30"|"60"]` 表达差异。
5. **版本化 + 灰度 + A/B + 指标回流**：草稿 → 审核 → 发布；可回滚；可分桶；指标 30 天回看。

##### 3.2.7.2 数据模型 `TemplateScript`

放置：`apps/web/src/types/celebrity-zone.ts`（新增），与 `CelebrityTemplate` 1:N（同一模板可多个版本，但同时仅一个 `published`）。

```ts
TemplateScript {
  id: ID;
  templateId: ID;                // 关联 CelebrityTemplate
  version: number;
  status: "draft" | "in_review" | "published" | "archived";
  language: "zh-CN";

  /** 0. 模式选择 —— 决定下文哪些字段必填 */
  kind: "text" | "video_ref";

  /** 0a. video_ref 模式专属 —— text 模式时为 undefined（详 §3.2.7.2.5） */
  referenceClip?: TemplateReferenceClip;

  /** 1. 角色画像：明星该"演什么"（两种模式都填，video_ref 模式作"附加约束"） */
  persona: {
    voiceTone: string;           // "亲切、邻家女孩"
    speakingStyle: string;       // "短句、口语化、带语气词"
    personality: string[];       // ["温暖", "专业", "有亲和力"]
    forbiddenTone: string[];     // 不能出现的语气
  };

  /** 2. 系统提示：顶层总体约束（text 模式 ≥ 200 字；video_ref 模式可短，作"补充指令"） */
  systemPrompt: string;

  /** 3. 场景序列：镜头-by-镜头剧本（text 模式必填；video_ref 模式可空，由参考视频天然提供分镜） */
  scenes: Scene[];               // §3.2.7.3

  /** 4. 风格修饰 */
  visualStyle: {
    lighting: string;            // "柔和自然光 + 侧补光"
    colorPalette: string[];      // ["#fde7e9", "#ffd6a5"]
    cinematography: string;      // "手持小晃动、浅景深"
    referenceUrls?: string[];    // 风格参考图
  };

  /** 5. 负向提示 */
  negativePrompt: string;        // "避免：低饱和、阴暗光线、AI 痕迹、口型错位、商品 logo 模糊"

  /** 6. 变量插槽 */
  variables: TemplateVariable[]; // §3.2.7.4

  /** 7. 引擎适配 */
  engineAdapters: {
    KeLing?:  EngineAdapter;     // §3.2.7.5
    HiGen?:   EngineAdapter;
    MiniMax?: EngineAdapter;
  };

  /** 8. 时长适配 */
  durationVariants: {
    "15": { sceneIds: ID[]; cutHint: string };
    "30": { sceneIds: ID[]; cutHint: string };
    "60": { sceneIds: ID[]; cutHint: string };
  };

  /** 9. 后处理（剪辑/字幕/水印/BGM） */
  postProcess: {
    subtitleTemplate: string;             // "{{starName}} | {{productName}}"
    watermarkPolicy: "always" | "if_unauth" | "never";
    bgmCategory?: string;
    transitionStyle?: string;             // "硬切" / "淡入" / "节奏卡点"
  };

  /** 10. 风控 */
  safety: {
    forbiddenWords: string[];
    requiredDisclaimers: string[];        // ["广告", "效果因人而异"]
    brandRestrictions?: string[];         // 不可对比的品牌
  };

  /** 11. A/B 实验（可选） */
  experiment?: {
    bucket: "A" | "B";
    rolloutPct: number;                   // 0–100
    siblingScriptId?: ID;
  };

  /** 12. 评估反馈（系统回填） */
  metrics?: {
    runs: number;
    avgPlays: number;
    conversionRate: number;
    avgFitScore: number;                  // 引擎回传的口型/画面匹配度
    rejectRate: number;                   // 人工审核驳回率
  };

  createdAt: ISODateTime;
  publishedAt?: ISODateTime;
  publishedBy?: ID;
}
```

##### 3.2.7.2.5 视频参考模式 `TemplateReferenceClip`（`kind: "video_ref"` 专属）

> 用户需求：**支持上传一段视频素材作为模板内容**。运营在专区里挑了"视频模板"后，模型会以这段参考视频的风格 / 结构 / 节奏作为生成依据，再叠加运营填写的口播脚本和明星 / 商品变量。

**典型用法**：
- 运营找到一条爆款短视频（自有版权或经授权），上传作为「视觉骨架」。
- 系统自动抽取关键帧 / 分镜 / 时长 / BGM 节奏，生成 `referenceClip` 元数据。
- 运行时把视频/帧序列传给引擎的「视频参考」通道（KeLing 的 `motion_reference`、HiGen 的 `style_clip`、MiniMax 的 `ref_video`），叠加 §3.2.7.2 的 systemPrompt / variables / safety。

**数据模型**：

```ts
TemplateReferenceClip {
  /** 上传的原始视频，公开访问 URL（CDN） */
  videoUrl: string;
  /** 缩略图（运营列表视图展示） */
  thumbUrl: string;
  /** 视频时长，秒 */
  durationSec: number;
  /** 帧率 / 分辨率 / 编码（系统转码后回填） */
  meta: {
    width: number;
    height: number;
    fps: number;
    codec: string;       // "h264" | "h265" | "vp9"
    sizeBytes: number;
  };

  /** 参考用途：决定模型如何"用"这段素材 */
  usage: "style" | "structure" | "rhythm" | "all";
  // - style:     仅参考画面色调 / 光线 / 镜头感
  // - structure: 参考分镜节奏 / 镜头切换 / 景别变化（不复刻具体画面）
  // - rhythm:    仅参考时间节奏（用于卡点视频）
  // - all:       三者皆参考（强约束，最像参考视频）

  /** 影响强度 0–1，越高越接近参考视频；引擎层会换算成各自的 weight */
  influence: number;

  /** 可选：运营手动框选的"重点参考片段"（视频内时间窗），只对这些片段做参考 */
  segments?: Array<{ startSec: number; endSec: number; note: string }>;

  /** 系统抽帧产物：用于做参考图通道、缩略图、prompt 助手分析 */
  keyFrames?: Array<{ url: string; tSec: number; tags?: string[] }>;

  /** 系统检测产物：作 prompt 助手草稿 */
  autoAnalysis?: {
    detectedShots: Array<{ tSec: number; shotType: string }>;  // 自动分镜
    detectedBgmBpm?: number;                                    // 节奏检测
    dominantColors?: string[];                                  // 主色板
    suggestedScenes?: Scene[];                                  // 一键转 text 模式的草稿
  };

  /** 版权 / 授权 */
  license: {
    source: "self_owned" | "licensed" | "platform_official";
    licenseDoc?: string;          // 授权书 URL（licensed 必填）
    expireAt?: ISODate;
    creditTo?: string;            // 必标注的版权方
  };

  /** 风控状态 */
  reviewStatus: "pending" | "approved" | "rejected";
  reviewNotes?: string;
  reviewedBy?: ID;
}
```

**编辑器交互（§3.2.7.6 增量）**：
1. 「模式选择」首屏二选一：「文本脚本（结构化分镜）」/「上传视频参考」。
2. video_ref 模式编辑器分四区：
   - **左区 · 上传与转码**：拖拽上传，最大 200 MB / ≤ 60s；上传后系统自动转码 + 抽帧 + 检测 → 进度条 + 元数据回填。
   - **中区 · 参考策略**：单选 `usage`（style/structure/rhythm/all）+ 滑块 `influence(0–1)` + 时间窗 `segments[]`（在播放器上拖框）。
   - **右区 · prompt 补丁**：保留 `systemPrompt / variables / safety / postProcess`；可选「参考关键帧 + 自动 Scene 草稿」一键转入 text 模式继续微调。
   - **底区 · 版权 + 审核**：填 source / 授权书上传 / creditTo；提交审核（先人工过版权与内容合规，后才能发布）。
3. 试跑：与 text 模式同一 dry-run 入口，prompt 装配预览右侧多一栏「参考视频缩略 + 关键帧」，便于核对。

**运行时差异**（§3.2.7.7 装配流程的补丁）：

```
PromptAssemblyService（kind === "video_ref"）：
  1. 取 published TemplateScript
  2. 跳过 "scenes 子集选择"（参考视频天然提供分镜）；durationVariants 改成
     "用 referenceClip.segments 截取目标时长"
  3. 把 product / star 等填入 systemPrompt / safety / postProcess（与 text 一致）
  4. 装配引擎请求：除常规 positive / negative，**额外注入参考视频通道**：
       - KeLing:  motion_reference = {url, weight: influence}
       - HiGen:   style_clip = {url, segments, weight}
       - MiniMax: ref_video   = {url, mode: usage, weight}
  5. 风控：对 referenceClip.reviewStatus !== "approved" 直接拒绝执行
  6. 调引擎；积分扣费在 EngineMeta.creditPrice 基础上 × (1 + videoRefSurcharge)
     （视频参考通道通常更贵，加价系数在 §3.2.3 引擎配置里维护）
```

**风控加严**（在 §3.2.7.2 `safety` 之外增加）：
- 必须有版权文件或归属为 `self_owned / platform_official`。
- 必跑色情 / 暴力 / 政治敏感画面检测（NSFW + 人脸识别 + 违禁元素）。
- 不允许出现明显第三方 logo / 真人明星，除非 `license.creditTo` 明确授权。
- 同一视频被超过 N 个脚本复用时（默认 N=10）触发预警，避免"视觉趋同"。

##### 3.2.7.3 场景结构 `Scene`（`kind: "text"` 必填；`video_ref` 可选叠加）

```ts
Scene {
  id: ID;
  order: number;                          // 顺序
  durationSec: number;                    // 该场景秒数
  shotType: "近景" | "中景" | "远景" | "特写" | "运镜";
  cameraMotion?: "推" | "拉" | "摇" | "移" | "跟" | "静止";
  composition: string;                    // "明星左 1/3 站位，商品放右下"

  setting: string;                        // "暖色调家居客厅，沙发+绿植"
  props?: string[];

  // 演员动作
  action: string;                         // "明星拿起{{productName}}转身展示给镜头"
  expression: string;                     // "微笑 + 眼神惊喜"
  gestureRefs?: ID[];                     // 关联 §7.2 Gesture 库

  // 口播 / 字幕
  dialogue: string;                       // "你们看，{{sellingPoints[0]}}！"
  voiceEmotion: "calm" | "excited" | "warm" | "professional";
  onScreenText?: string;                  // 屏幕大字："限时 ¥{{price}}"

  // 商品出镜
  productAppearance: {
    angle: "front" | "side" | "top" | "in_use";
    durationSec: number;
    closeUpFraming: string;               // "充满画面 1/3，背景虚化"
  };

  // 模型 prompt 片段（最终参与拼装；可中英夹杂）
  positivePromptFragment: string;         // 长文本，详尽到色温/材质/景深
  negativePromptFragment?: string;
}
```

> **关键设计**：每个 Scene 同时持有「人能读懂的中文剧本」+「给模型的结构化 prompt 片段」。运营优先填中文，prompt 片段可由 AI 助手草稿生成、人工微调。

##### 3.2.7.4 变量系统 `TemplateVariable`

```ts
TemplateVariable {
  key: string;                            // "productName"
  label: string;                          // "商品名"
  type: "text" | "textArray" | "number" | "image" | "enum";
  source: "product" | "star" | "engine" | "duration" | "manual";
  required: boolean;
  default?: string;
  enumValues?: string[];
  maxLength?: number;
  examples?: string[];
}
```

**预置变量清单**（运营不可删，仅可改 label / 约束）：

| key | source | 说明 |
|-----|--------|------|
| `productName` | product | 商品名 |
| `sellingPoints` | product | 卖点数组（最多 3 条） |
| `productImages` | product | 商品图（接引擎参考图通道） |
| `productLink` | product | 跳转链接（出现在水印/字幕） |
| `starName` | star | 明星名 |
| `starPersona` | star | 明星人设标签 |
| `engineName` | engine | 引擎名（adapter 内部用） |
| `durationSec` | duration | 视频时长 |
| `cta` | manual | 行动召唤文案 |
| `price` | manual | 售价 |
| `discount` | manual | 折扣文案 |

**模板内引用语法**：
- 简单替换：`{{productName}}`
- 数组下标：`{{sellingPoints[0]}}`
- 默认值：`{{cta|"立刻下单"}}`
- 缺失校验：`required=true` 的变量缺失时装配失败；`safety.requiredDisclaimers` 未出现时装配失败。

##### 3.2.7.5 引擎适配器 `EngineAdapter`

```ts
EngineAdapter {
  enabled: boolean;
  /** 顶层 prompt 模板，可引用 {{systemPrompt}} / {{scenes}} / 任意变量 */
  promptTemplate: string;

  /** 引擎专属参数 */
  params: {
    aspectRatio?: "9:16" | "16:9" | "1:1";
    fps?: 24 | 30 | 60;
    seed?: number;
    cfgScale?: number;
    // KeLing 专属：camera_control / motion_strength
    // HiGen 专属：lipsync_strength / emotion_intensity
    // MiniMax 专属：style_id / ref_image_weight
    [key: string]: unknown;
  };

  /** 后端调用引擎时的请求体 schema 引用 */
  requestSchemaRef: string;               // e.g. "schemas/keling.req.v2"

  /** 引擎拒绝/超时时的兜底 */
  fallbackEngine?: CelebrityEngine;
}
```

> 服务端新增 `PromptAssemblyService`（§3.2.7.7），输入 `(scriptId, productInput, starId, duration, engine)`，输出引擎可消费的请求体。

##### 3.2.7.6 后台编辑器（运营 UI）

新增路由：`apps/admin/src/app/celebrity/templates/[templateId]/scripts/[scriptId]/`

| 模块 | 关键交互 |
|-----|---------|
| 元信息面板 | 版本号、状态徽章、绑定的 `CelebrityTemplate`、语言；右上角「保存草稿 / 提交审核 / 发布 / 回滚」 |
| Persona / SystemPrompt 编辑区 | 富文本 + 实时字数 + 「AI 改写」按钮（基于 LLM 给运营草稿建议） |
| **场景时间线**（核心） | 横向时间轴（按 `order × durationSec`），每个场景一张卡片显示 shotType / 镜头运动 / 布景 / 动作 / 口播 / 商品出镜；支持拖拽改顺序；点击右侧抽屉编辑 `positivePromptFragment` 长文本（含变量自动补全） |
| 变量管理器 | 列表视图，新增 / 编辑 / 删除（系统变量不可删），每条带「示例值预填」用于试跑 |
| 引擎适配器 Tab | 三个 Tab（KeLing / HiGen / MiniMax），各自独立 `promptTemplate` 编辑器；侧栏实时显示「装配预览」（变量替换后的最终 prompt） |
| 时长变体配置 | 三个 chip（15 / 30 / 60s），每个选择启用的场景子集 + `cutHint`（剪辑提示） |
| 后处理 / 风控 Tab | 字幕模板、水印策略、BGM 类目、敏感词、必带免责声明、不可对比品牌 |
| **预览 / 试跑**（核心） | 左侧填模拟入参（商品 + 明星 + 引擎 + 时长） → 中间高亮显示最终装配 prompt（变量替换、场景拼接、风控过滤标红） → 右侧「提交试跑作业」实际调引擎，消耗预设的运营测试积分，返回视频在线播放 |
| 版本与发布 | 列出全部版本（draft/in_review/published/archived），支持版本 diff 对比、一键回滚到任意 published 历史版本、双人复核才能发布 |
| 指标面板 | 跑过的 N 次作业的 plays / conversion / fitScore / rejectRate；A/B 实验对比柱图（30 天回看） |

##### 3.2.7.7 运行时装配流程

```
用户在 /producer/celebrity-zone 选模板 → 填商品 → 选引擎 → 选时长 → 提交
        │
        ▼
后端 CelebrityGenerationController.create
        │
        ▼
PromptAssemblyService:
  1. 取该 templateId 下 status=published 的 TemplateScript（A/B 时按 userId 哈希分桶）
  2. 按 durationVariants[duration].sceneIds 选场景子集
  3. 把 product / star / engine / duration / cta / price 填入 variables
  4. 替换 systemPrompt 与每个 scene 的 {{...}}
  5. 拼接 fullPositive  = persona + systemPrompt + scenes.map(positivePromptFragment) + visualStyle
  6. 拼接 fullNegative = base + scenes.map(negativePromptFragment) + safety.forbiddenWords
  7. 走 engineAdapters[engine].promptTemplate 改写为引擎方言 + 注入 engine.params
  8. 风控校验（forbiddenWords / requiredDisclaimers / brandRestrictions）→ 失败则返回明确错误码
        │
        ▼
调引擎（KeLing / HiGen / MiniMax）→ 视频 URL
        │  失败时按 engineAdapters[engine].fallbackEngine 兜底重试
        ▼
回写 LedgerEntry（按 EngineMeta.creditPrice 扣积分）；同步 metrics 累计
```

##### 3.2.7.8 三端契约（按 `AGENTS.md` 「新增领域 SOP」）

| 文件 | 动作 |
|------|------|
| `apps/web/src/types/celebrity-zone.ts` | 新增 `TemplateScript / Scene / TemplateVariable / EngineAdapter / TemplateReferenceClip` 类型，含 `kind: "text" \| "video_ref"` 判别字段 |
| `apps/web/src/mocks/celebrity-zone.ts` | 给 6 个 `CelebrityTemplate` 各补 1 份示范 `TemplateScript` |
| `apps/web/src/api/celebrity-zone.ts` | 新增 `getTemplateScript(templateId)`（用户端只读最新 published） |
| `apps/admin/src/types/celebrity-zone.ts` | 镜像 + `AdminTemplateScript`（含全部 metrics、版本列表、审核流元数据） |
| `apps/admin/src/api/celebrity-zone.ts` | 新增 `listScripts / getScript / saveDraft / submitReview / publish / rollback / dryRun` |
| `apps/admin/src/app/celebrity/templates/[templateId]/scripts/...` | §3.2.7.6 编辑器路由 |
| `apps/server/.../aep/model/TemplateScript.java` | 新增 JPA 实体 + Scene / Variable / Adapter 子表（或 JSON 列） |
| `apps/server/.../aep/dto/TemplateScriptDto.java` | DTO 字段名严格对齐 TS interface |
| `apps/server/.../aep/service/PromptAssemblyService.java` | **新增**：变量替换 + 引擎适配 + 风控校验；按 `kind` 走 text / video_ref 两条装配分支 |
| `apps/server/.../aep/service/VideoReferenceIngestService.java` | **新增**（video_ref 模式）：视频上传转码、抽帧、自动分镜、BGM BPM、主色板检测、NSFW / 违禁检测 |
| `apps/server/.../aep/storage/` | 视频与关键帧的对象存储桶配置（OSS / S3）+ CDN 失效 |
| `apps/server/.../aep/controller/AdminTemplateScriptController.java` | `/admin/template-scripts/**` |
| `apps/server/.../aep/controller/CelebrityGenerationController.java` | 改造：取 `TemplateScript.published`，调用 `PromptAssemblyService` |
| `specs/openapi.yaml` | 新增 paths：`/admin/template-scripts`、`/admin/template-scripts/{id}`、`/admin/template-scripts/{id}/dry-run`、`/admin/template-scripts/{id}/publish`、`/admin/template-scripts/{id}/rollback`、`/admin/template-scripts/{id}/upload-clip`（multipart 上传参考视频）、`/admin/template-scripts/{id}/clip-status`（轮询转码/检测状态）、`/template-scripts/{id}` |
| `specs/BUSINESS_RULES.md` | 新增：变量替换语法、引擎适配优先级、`{{var\|default}}` 解析规则、敏感词校验时机、双人复核门槛、A/B 桶分配函数 |

##### 3.2.7.9 验收（DoD）

- [ ] 内置模板脚本数 ≥ 6（覆盖 6 种 `TemplateStyle`：种草安利 / 硬核测评 / 轻松开箱 / 直播切片 / 剧情植入 / 日常 Vlog）。
- [ ] **两种 `kind` 各至少有 2 份示例**（text 模式结构化分镜；video_ref 模式带版权审核通过的参考视频）。
- [ ] text 模式每份脚本至少 3 个场景，每个 `positivePromptFragment` ≥ 80 字。
- [ ] video_ref 模式参考视频 ≤ 60 秒、≤ 200 MB；上传后 5 分钟内完成转码 + 抽帧 + 检测。
- [ ] 同一脚本可成功为 3 种引擎装配 prompt（dry-run 全绿）；prompt diff 在 admin 编辑器一屏可比。
- [ ] 脚本变更走「草稿 → 审核 → 发布 → 归档」四态；发布后 1 分钟内前台拉到。
- [ ] A/B 桶按 `userId` 哈希稳定（同一用户多次刷新落同一桶）；实验 30 天指标回看。
- [ ] 风控：含 `forbiddenWords` 的脚本无法发布（前置校验 + 后端二次校验）；运行时缺 `requiredDisclaimers` 时装配失败。
- [ ] video_ref 风控：`reviewStatus !== "approved"` 不可发布；NSFW / 违禁画面命中即拒；版权文件为必填项（除 `self_owned / platform_official`）。
- [ ] 引擎超时 / 拒绝 → 自动按 `fallbackEngine` 兜底一次，二次失败才回报给用户并退积分。
- [ ] 所有脚本变更进 `AuditLog`（who / version / before-after JSON diff）。

### 3.3 AI 形象工坊 `base/presets`（对齐 `apps/web/src/types/appearance-forge.ts`）

> 用户重点强调的「AI 数字人参数」全部在这里。

#### 3.3.1 形象模板 CRUD（`ForgeTemplate`）
- 字段：`name / image / tags[] / style`；按风格分组（cyberpunk / gothic / holo / 国风 / …）。
- 标签字典：自由 tag 池，控制下拉与搜索建议。

#### 3.3.2 锻造模式开关（`ForgeMode`）
- 四种模式：`template_photo` / `prompt_only` / `template_prompt` / `random` —— 每种独立开关、积分单价、文案、可见角色。

#### 3.3.3 数字人参数字典（**核心配置面**）
| 配置项 | 类型 | 现存位置 | 后台可配置内容 |
|-------|-----|---------|---------------|
| 发型 `LabeledOption[]` | 离散选项 | `mocks/appearance-forge.ts` | 名称、缩略图、标签、是否启用 |
| 瞳色 `LabeledOption[]`（含 `color`）| 离散选项 + 颜色 | 同上 | 名称、十六进制色 |
| 风格标签 `LabeledOption[]` | 多选 | 同上 | 名称、配色 |
| 面部滑块 `FaceSlider[]` | 0–100 数值 | 同上 | id / label / 默认值 / 上下界 / 单位 |
| 渐变配色 `ColorScheme[]` | 双色渐变 | 同上 | 名称 + 两色 |
| 融合比例区间 | 数值 | 同上 | min / max / step / 默认 |
| 锁定字段 | 字段集 | 同上 | 哪些 `sliderId / 选项键` 允许被锁定 |

#### 3.3.4 生成结果与商业化（`AppearanceStatus`）
- 状态字典：`draft / official / listed / sold` → 名称、徽章色、可流转规则。
- 上架价区间、版权归属、NFT mint 模板。

### 3.4 签约 / 生命周期 `artists/lifecycle`
- 签约表 `SignedArtist`：合同模板、抽成比例、有效期。
- 经纪事件流水（CoachDashboard 后端化）。

---

## 4. 内容域 · Content

### 4.1 音乐 `content/songs`、`content/albums`、`content/concerts`
- **CRUD**：歌曲、专辑、演唱会（对齐 `types/music.ts`）。
- **流派字典 `base/genres`**：`MusicGenre` —— 名称、icon、配色、热度权重、是否启用。
- **生成阶段配置**（**核心 · 当前在 `apps/web/src/constants/generation-ui.ts` 硬编码**）：
  | 阶段 (`GenerationStage`) | 可配置字段 |
  |-------|-----------|
  | idle / analyzing / composing / lyrics / arranging / mastering / done / error | `label`、`desc`、`icon`、文字色、背景色、边框色 |
  | 流式参数 | `STREAM_CHUNK_SIZE`（每 N 字一吐）、`STREAM_INTERVAL_MS`、`STAGE_HOLD_MS`、`PRE_ANALYZE_MS` |
  | 模型 | `modelVersion` 列表 + 每个版本的 `creditsEstimate`、`thinkDepth` 选项 |
- **音乐生成模板**：曲风 prompt 模板、BPM/调性预设、封面 prompt 模板。
- **资源限额**：单艺人月生成上限、并发上限（按机构 / 套餐档位）。

### 4.2 影视 `content/dramas`、`content/movies`、`content/voice`、`content/ads`
- **类目字典**：影视题材、广告品类、声音性别 / 风格（对齐 `types/film.ts` 的 `FilmGenre`、`AdCategory`、`VoiceStyle` 等）。
- **`apps/web/src/constants/film-ui.ts`** 全部上移：状态徽章、类型 icon、评分阈值。
- **生产模板**：剧本大纲模板、广告 30 秒/60 秒结构模板、语音情感预设。

### 4.3 版权 `content/copyright`
- 版权类型字典、收益分成模板、托管平台白名单。
- 版权状态机（pending / approved / disputed / revoked）。

---

## 5. 分发域 · Distribution

### 5.1 渠道字典 `distribution/channels`
- 平台清单：网易云、QQ 音乐、抖音、快手、小红书、视频号、B 站、Spotify、YouTube …
- 字段：`name / icon / oauthClientId / quotaPerDay / 提交模板 / 退回原因字典 / 是否启用`。
- 对齐 `types/distribution.ts` 的 `Platform`。

### 5.2 提交队列 `distribution/queue`
- `DistributionQueueItem` 状态机（draft / submitted / live / rejected）、SLA、自动重试次数、人工审核开关。

### 5.3 审核策略
- 按渠道配置：自动审核阈值、敏感词、违禁素材、版权校验规则。

---

## 6. 变现 / 财务域 · Monetization & Finance

### 6.1 积分体系（**严守账本不变性，配置不直接改余额**）
- **积分包 `base/credit-packs`**（已存在）：`CreditPack` —— 名称、面额、售价（分）、赠送、有效期、是否限时、目标角色。
- **套餐档位**：`PricingTierName`（体验版 / 标准版 / 旗舰版）—— 价格文案、特性、推荐、绑定明星范围。
- **充值入口**：支付方式（微信 / 支付宝 / 对公）、最低 / 最高单笔、限额。
- **赠送活动**：节日 / 新人 / 任务奖励的发放规则。

### 6.2 收益与抽成 `finance/`
- 抽成比例：平台 / 经纪 / 制作人 / 艺人四方分成模板（按内容类型差异化）。
- 提现规则：T+N、最低提现、手续费率、单笔上限。
- 对账单模板：周期、字段、导出格式。

### 6.3 钱包视图
- 运营对任意钱包的查询（只读 + 通过 `LedgerEntry` 调账，禁止 UPDATE 余额）。
- 调账原因码字典（人工补偿 / 退款 / 风控冻结 / 系统修正）。

---

## 7. 基础数据域 · Base（数字人 + 内容 共享字典）

### 7.1 服装库 `base/wardrobe`（对齐 `types/wardrobe.ts`）
- **CRUD `ClothingItem`**：name / category（top/bottom/accessory/shoes/hair/outfit）/ rarity / priceCredits / saleStatus(FREE/PAID/LOCKED) / tags / imageUrl / previewUrl / isNew / isTrending。
- **类目字典**：`ClothingCategory`、`Rarity`、`SaleStatus` 全部后台可编辑（图标 / 文案 / 配色，当前在 `constants/wardrobe-ui.ts`、`wardrobe-v2-ui.ts`）。
- **套装 `SavedOutfit`**：官方套装运营预设（首发 / 节日 / 联名）。

### 7.2 姿态库 `base/pose`（对齐 `types/pose.ts`）
- **CRUD `Pose / Expression / Gesture`**：含动画文件、缩略图、难度、积分价、销售状态、所属分类。
- **类目字典**：`PoseCategory`（standing/sitting/dancing/singing/action）、`PoseDifficulty`、`ExpressionCategory` —— 全部后台编辑（当前 `constants/pose-ui.ts`）。

### 7.3 流派字典 `base/genres`
- 音乐流派、影视题材、综艺类型、广告品类，统一一张「分类树」表。

### 7.4 引擎与模板 `base/engines`、`base/presets`
- 见 §3.2.3、§3.3.1。

### 7.5 通用 UI 字典（**当前散落在 `apps/web/src/constants/*` 的 17 个文件全部后台化**）

| 文件 | 内容 | 后台对应 |
|-----|------|---------|
| `appearance-forge-ui.ts` | 形象工坊 step / 状态徽章 | `base/presets` 的 UI 子配置 |
| `artist-config.ts` | 艺人类型 / 品质 / 状态徽章 | §3.1.2 |
| `celebrity-zone-ui.ts` | AI 明星专区 tab / 引擎徽章 | §3.2 |
| `coach-ui.ts` | 掌门人面板配置 | `monetization` 子配置 |
| `command-items.ts` | ⌘K 命令面板项 | §2.4 |
| `community-ui.ts` | 社区粉丝徽章、活动状态 | §8 |
| `fab-actions.ts` | 浮动按钮项 | §2.4 |
| `fan-ui.ts` | 粉丝面板 banner / 任务卡 | §8 |
| `film-ui.ts` | 影视类型 / 状态徽章 | §4.2 |
| `generation-ui.ts` | 音乐生成阶段 / 流式参数 | §4.1 |
| `music-ui.ts` | 音乐流派 / 播放器配置 | §4.1 |
| `nft-dialog-ui.ts` | NFT 铸造对话框 | §6（变现） |
| `notification-ui.ts` | 通知类型 / 图标 / 配色 | §8 |
| `pose-ui.ts` | 姿态分类 / 难度徽章 | §7.2 |
| `settings-sections.ts` | 设置页分组 | §2.4 |
| `wardrobe-ui.ts` / `wardrobe-v2-ui.ts` | 服装类目 / 稀有度 | §7.1 |

---

## 8. 社区 / 通知域

### 8.1 粉丝团 `community/`（对齐 `types/community.ts`）
- **粉丝层级 `FanTier`**：层级名、阈值、徽章、特权列表（评论高亮、专属表情、抢先听）。
- **成长积分 `FanGrowthPoint`**：行为 → 积分映射（点赞 +N / 评论 +N / 转发 +N / 打榜 +N）。
- **活动 `CommunityEvent`**：名称、cover、时间、奖励、目标艺人、参与门槛、状态（upcoming/live/ended）。

### 8.2 通知中心 `notifications/`（对齐 `types/notification.ts`）
- **通知类型字典**：system / billing / artist / social / risk —— 图标 / 配色 / 优先级 / 默认渠道（站内 / 邮件 / 短信 / 推送）。
- **模板**：每种通知一个文案模板（含变量），运营可改文案 / 占位符。
- **群发任务**：定向规则、定时发送、发送回执。
- **NoticeBoard 公告**：标题、正文、生效时段、目标角色、紧急程度。

---

## 9. 审计与风控 `audit/`（对齐 `apps/admin/src/types/audit.ts`）

- **操作日志**：所有运营写操作 → `AuditLog`（who / when / target / before / after / ip / userAgent）。
- **登录日志**：成功 / 失败、来源 IP、设备指纹。
- **风控规则**（**新增**）：
  - 单账号单日生成次数上限。
  - 同一商品图重复生成检测。
  - 敏感词库（多版本切换）。
  - IP / 设备黑名单。
- **运营回放**：按运营 + 时间范围回放配置变更，支持「回滚到某版本」。

---

## 10. 配置发布机制（横切能力）

### 10.1 配置实体统一表结构
```
ConfigItem {
  id: ID
  key: string                    // e.g. "celebrity.engine.kl"
  scope: "global" | "tenant" | "studio" | "user"
  scopeId?: ID
  payload: JSON                  // 实际配置内容
  status: "draft" | "published" | "archived"
  version: number
  publishedAt?: ISODateTime
  publishedBy?: ID
  effectiveFrom?: ISODateTime
  effectiveTo?: ISODateTime
}
```

### 10.2 工作流
1. 运营在后台编辑 → 自动存为 `draft`。
2. 提交审核 → `FINANCE_ADMIN` / `PLATFORM_OPERATOR` 复核（高风险项必须双人复核：定价 / 抽成 / 发放）。
3. 发布 → 写 `published` 版本，旧版本变 `archived`，全网生效（带 CDN 失效）。
4. 回滚 → 一键将某历史版本重新 `published`。

### 10.3 前台拉取策略
- 入口聚合 API：`GET /api/config/bootstrap`（按角色返回所需所有字典与开关，强缓存 60s + ETag）。
- 域级 API：`GET /api/config/{domain}`（细粒度拉取）。
- 前端 `apps/web/src/api/config.ts` 已存在 → 扩展为统一 fetcher，替换 `constants/*` 中的硬编码导出。

### 10.4 灰度策略
- 全量、白名单（用户 / 机构 / 工作室）、AB 桶（按 userId 哈希）。
- 适用对象：定价（积分包 / 引擎 / 套餐）、新模板、新引擎、生成阶段参数。

### 10.5 三端同步契约
按 `AGENTS.md` 第 3 步规则：
- `apps/web/src/types/config.ts`（**新增**）→ 真值源；
- `apps/admin/src/types/config.ts` 复制 + `AdminConfigItem` 扩展；
- `apps/server/.../aep/model/ConfigItem.java` + `ConfigItemDto.java` + `AdminConfigController.java`；
- `specs/openapi.yaml` 新增 paths：`/admin/config`、`/admin/config/{key}`、`/config/bootstrap`、`/config/{domain}`；
- `npm run check:api-contract` 必须绿。

---

## 11. 改造范围速查（落地优先级）

> **P0**（强配置化痛点，本期必做）
1. AI 明星列表 + 引擎 + 模板 + 价格档（§3.2）—— 当前 `mocks/celebrity-zone.ts` 全量后台化。
2. **模板脚本系统 `TemplateScript`（§3.2.7）** —— 让 AI 视频生成真正"按模板走"，含双模（文本脚本 / 视频参考）、变量、引擎适配、风控。
3. **`PromptAssemblyService` + 引擎 adapter 三件套（§3.2.7.7）** —— KeLing / HiGen / MiniMax 各自请求体装配 + 兜底链。
4. AI 形象工坊参数字典（§3.3.3）—— 发型 / 瞳色 / 滑块 / 渐变 / 锁定项。
5. 音乐生成阶段与流式参数（§4.1 → `generation-ui.ts`）。
6. 服装 / 姿态 / 表情 / 手势库（§7.1、§7.2）—— 含价格 / 销售状态。
7. 全站字典上移：17 个 `constants/*` 文件 → API 化（§7.5）。
8. 配置中心实体 + 草稿/发布/审计（§10）。

> **P1**（运营效率提升）
9. 渠道字典 + 提交队列 + 审核策略（§5）。
10. 积分包 / 套餐 / 抽成模板（§6）。
11. 通知模板 + NoticeBoard + 群发（§8.2）。
12. 风控规则（敏感词 / 频次 / 黑名单）（§9）。
13. 模板脚本试跑工作台（§3.2.7.6 试跑模块）+ A/B 桶 + 指标回流。

> **P2**（长尾）
14. 灰度 / AB 桶（§10.4）。
15. 配置回滚 UI、配置变更影响面分析。
16. 视频参考模板的素材库 / 转码 / 帧采样自动化（§3.2.7.2 video_ref 模式产能化）。

---

## 12. 与现有文档的关系

- **本文档新增**：`docs/ADMIN_PRODUCT_SPEC.md` —— 运营视角的「全配置化」总览。
- **保持权威**：
  - `product_spec.md` —— 产品级总规（用户视角）。
  - `AGENTS.md` —— 三端代码协议（开发视角）。
  - `specs/openapi.yaml` —— 接口契约。
  - `specs/BUSINESS_RULES.md` —— openapi 表达不了的业务规则。
- **drift 守护**：本文档每条「可配置项」都应在 `apps/web/src/types/*` 找到对应类型；新增配置项时，先改 `types`，再改 `openapi.yaml`，再写本文。

---

## 13. 验收清单（DoD）

- [ ] `apps/web/src/constants/*` 不再 `export` 任何静态字典数据；改为运行时拉取。
- [ ] `apps/web/src/mocks/*` 仅作为 USE_MOCK=1 / 单测兜底，所有列表数据有 `/admin/*` CRUD 入口。
- [ ] `apps/admin/src/app/` 覆盖本文 §2–§9 列出的全部菜单。
- [ ] 后台修改配置 → 1 分钟内前台生效（CDN 失效 + 客户端 SWR）。
- [ ] 所有写操作可在 `audit/` 看到 diff。
- [ ] `npm run check:api-contract` 全绿。
- [ ] `(cd apps/web && npx tsc --noEmit) && (cd apps/admin && npx tsc --noEmit) && (cd apps/server && ./mvnw compile -q -o)` 全绿。

---

> 后续每次 figma 原型更新或新增前台配置项，先回到本文 §11 加优先级，再按 `AGENTS.md` 「新增领域 SOP」推进；不要让前台再多出一行硬编码字典。
