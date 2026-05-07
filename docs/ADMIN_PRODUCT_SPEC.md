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

#### 3.2.2 模板配置 `celebrity/projects`（`CelebrityTemplate`）
- **字段**：`name / style(种草/测评/开箱/直播切片/剧情植入) / description / recommendedEngine / recommendedPrice / isHot / plays / conversionRate / fitHint / previews[]`。
- **运营动作**：模板新增 / 编辑 / 下架；按 AI 明星绑定可用模板；按"风格类目"管理。

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
2. AI 形象工坊参数字典（§3.3.3）—— 发型 / 瞳色 / 滑块 / 渐变 / 锁定项。
3. 音乐生成阶段与流式参数（§4.1 → `generation-ui.ts`）。
4. 服装 / 姿态 / 表情 / 手势库（§7.1、§7.2）—— 含价格 / 销售状态。
5. 全站字典上移：17 个 `constants/*` 文件 → API 化（§7.5）。
6. 配置中心实体 + 草稿/发布/审计（§10）。

> **P1**（运营效率提升）
7. 渠道字典 + 提交队列 + 审核策略（§5）。
8. 积分包 / 套餐 / 抽成模板（§6）。
9. 通知模板 + NoticeBoard + 群发（§8.2）。
10. 风控规则（敏感词 / 频次 / 黑名单）（§9）。

> **P2**（长尾）
11. 灰度 / AB 桶（§10.4）。
12. 配置回滚 UI、配置变更影响面分析。

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
