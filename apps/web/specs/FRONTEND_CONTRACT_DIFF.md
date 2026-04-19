# Frontend ↔ Backend Contract Diff

本文件对比 `apps/web_new/src/types/*.ts`（前端真值源）与 `specs/openapi.yaml`（后端 OpenAPI 规范）的差异。
生成于 2026-04-17。

---

## 摘要

| 指标 | 数值 |
|------|------|
| **前端定义的领域** | 14 个文件 |
| **前端定义的主要类型** | ~45 个接口/类型 |
| **前端定义的枚举** | ~30 个 |
| **OpenAPI 定义的 schemas** | ~74 个 |
| **完全一致（字段/枚举同步）** | ~25 项 |
| **存在字段差异** | ~15 项 |
| **仅前端存在（后端待补）** | ~8 项 |
| **仅后端存在（前端未接入）** | ~20 项 |

**结论**：前后端契约存在 **中等规模的分化**，主要体现在：
1. 前端为展示侧优化，多用预格式化字符串；后端偏向数值存储
2. 影视（Film）、社区（Community）等业务领域前端定义超前
3. NFT、分发（Distribution）等新域后端定义更完整

---

## 按领域逐项对照

### 1️⃣ 共享类型 (`_shared.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `Rarity` | `SingerQuality` / `NFTRarity` | ✅ 完全一致 | 都是 "common\|rare\|epic\|legendary" |
| `ID` | `string, format: uuid` | ✅ 完全一致 | 别名使用 |
| `ISODateTime` | `string, format: date-time` | ✅ 完全一致 | ISO-8601 格式 |
| `ApiResponse<T>` | `SuccessResponse` | ✅ 完全一致 | success + data + 可选 message |
| `ApiErrorShape` | `ErrorDetail` | ✅ 完全一致 | code + message + details |
| `PaginationMeta` | `PaginationMeta` | ✅ 完全一致 | 字段完全对齐 |
| `AsyncJobStarted` | `AsyncJobStarted` | ✅ 完全一致 | jobId, status, pollUrl, pollIntervalMs |
| `Money` | ❌ 无 | ❌ 不存在 | 前端定义了 amount + currency + display；OpenAPI 未覆盖 |

**结论**：共享壳层契约完全同步；`Money` 类型是前端补充。

---

### 2️⃣ 艺人 (`artist.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `ArtistType` | ❌ 无直接对应 | ⚠️ 命名不同 | 前端定义 7 种：singer/actor/entertainer/dancer/host/all_rounder/idol；OpenAPI 无枚举，仅在 Singer 中归为一种 |
| `ArtistQuality` | `SingerQuality` | ✅ 完全一致 | 别名指向 Rarity |
| `ArtistStatus` | ❌ 不对应 | ❌ 缺失 | 前端定义 "trainee\|debut\|active\|rest\|retired"；OpenAPI 只有 SingerStatus "active\|draft\|archived" |
| `TalentProfile` | ❌ 无 | ❌ 不存在 | 前端定义 singing/acting/dancing/hosting/comedy/variety 六维才艺；OpenAPI 未覆盖 |
| `ArtistStats` | `SingerStats` + 扩展 | ⚠️ 字段差异 | OpenAPI 只有 songs/fans/popularity；前端还有 dramas/ads/variety/revenue/monthlyRevenue |
| `Artist` | ❌ 无直接对应 | ⚠️ 关键差异 | 前端 Artist 比 SingerDetail 更宽：含 talents/level/exp/maxExp/domains/endorsements/commercialValue；后端未实现 |

**结论**：**艺人领域分化最大**。前端对艺人概念扩展为多类型、多维度、多业务，远超 Singer 的简化模型。

---

### 3️⃣ 教练 (`coach.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `SignedArtist` | ❌ 无 | ❌ 不存在 | 前端定义签约艺人视角（MCN/分成/合同），OpenAPI 无对应 |
| `CoachRevenuePoint` | 类似 `EarningDataPoint` | ⚠️ 字段差异 | 前端按月份分 streaming/endorsement/nft/live；OpenAPI 是 songRevenue/badgeRevenue |
| `DistributionQueueItem` | ❌ 无 | ❌ 不存在 | 前端定义发行队列状态追踪；OpenAPI 未覆盖 |
| `CopyrightItem` | ❌ 无 | ❌ 不存在 | 前端定义版权审核流程；OpenAPI 未覆盖 |
| `CoachCategoryDistribution` | ❌ 无 | ❌ 不存在 | 前端定义分类占比饼图；OpenAPI 未覆盖 |
| `CoachPage` | ❌ 无 | ❌ 不存在 | 前端定义页面导航；纯 UI 层逻辑 |

**结论**：Coach 领域**前端全面超前**。教练端在发行、版权、财务等业务逻辑上远未对齐后端。

---

### 4️⃣ 音乐 (`music.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `SongStatus` | ❌ 无 | ❌ 不存在 | 前端定义 "recording\|mixing\|released"；OpenAPI 是 TrackStatus "draft\|processing\|published" |
| `AlbumStatus` | ❌ 无 | ❌ 不存在 | 前端定义 "planning\|recording\|released"；OpenAPI 未覆盖 Album |
| `Song` | 类似 `Track` | ⚠️ 命名/字段差异 | 前端 Song 含 genre/rating；Track 含 generationMode/prompt |
| `Album` | ❌ 无 | ❌ 不存在 | 前端定义专辑模型；OpenAPI 无 Album schema |
| `Concert` | ❌ 无 | ❌ 不存在 | 前端定义演唱会；OpenAPI 未覆盖 |
| `MusicGenre` | ❌ 无 | ❌ 不存在 | 前端定义曲风；OpenAPI 未覆盖 |

**结论**：音乐域的**命名与建模方式不同**。前端面向产品（Song/Album/Concert），后端面向技术（Track 生成）。

---

### 5️⃣ 财务 (`finance.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `TransactionStatus` | `TransactionStatus` | ❌ 不同 | 前端："completed\|pending\|processing"；OpenAPI："pending\|completed\|failed" |
| `TransactionType` | `TransactionType` | ❌ 完全不同 | 前端："income\|withdrawal"（简化）；OpenAPI："royalty\|nftSale\|tip\|signingFee\|withdrawal\|aiCredit\|distribution\|platformFee"（8 种） |
| `Transaction` | `Transaction` | ✅ 部分一致 | 前端版字段更少（source/amount/type）；OpenAPI 更完整（userId/direction/currency/referenceId） |
| `MonthlyRevenuePoint` | 类似 `EarningDataPoint` | ⚠️ 字段差异 | 前端含 month/revenue；OpenAPI 是 period/songRevenue/badgeRevenue |
| `RevenueSource` | ❌ 无 | ❌ 不存在 | 前端定义收益来源饼图；OpenAPI 无 |
| `WalletSummary` | `WalletBalance` | ⚠️ 字段差异 | 前端：totalBalance/pendingAmount/monthChange（都是展示文案）；OpenAPI：available/pending/totalEarned/currency（数值） |

**结论**：财务域**展示层与数据层分离明显**。前端多用预格式化文案，OpenAPI 返回原始数值。

---

### 6️⃣ 服装 (`wardrobe.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `ClothingCategory` | `ClothingCategory` | ✅ 完全一致 | "top\|bottom\|accessory\|shoes\|hair\|outfit" |
| `ClothingItem` | `ClothingItem` | ✅ 部分一致 | 前端少字段（无 nameEn/isLocked/isNew/isTrending/sortOrder/isActive/createdAt）；前端关注：id/name/category/imageUrl/rarity/price/tags |
| `SavedOutfit` | `SavedOutfit` | ✅ 部分一致 | 前端 SavedOutfit 包含 items（Record<EquipSlot, ClothingItem\|null>）；OpenAPI 是 items（EquippedItems，仅 string 列表） |
| `EquippedSlots` | `EquippedItems` | ⚠️ 类型差异 | 前端：Record<EquipSlot, ClothingItem\|null>（对象）；OpenAPI：{top/bottom/accessory/shoes/hair}（字符串 ID） |

**结论**：服装域**结构契合度较高**，细节上前端做了类型化增强。

---

### 7️⃣ 姿态 (`pose.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `PoseCategory` | `PoseCategory` | ✅ 完全一致 | "standing\|sitting\|dancing\|singing\|action" |
| `PoseDifficulty` | `PoseDifficulty` | ✅ 完全一致 | "easy\|medium\|hard" |
| `Pose` | `Pose` | ✅ 部分一致 | 前端：id/name/category/thumbnail/difficulty/isLocked/isNew/animation；OpenAPI：id/name/nameEn/category/thumbnailUrl/animationUrl/difficulty/isLocked/isNew/sortOrder/isActive/createdAt |
| `ExpressionCategory` | `ExpressionCategory` | ✅ 完全一致 | "happy\|sad\|cool\|surprised\|other" |
| `Expression` | `Expression` | ✅ 部分一致 | 前端：id/name/emoji/intensity/category；OpenAPI：id/name/nameEn/emoji/defaultIntensity/category/sortOrder/isActive |
| `Gesture` | `Gesture` | ✅ 部分一致 | 前端：id/name/icon/category；OpenAPI：id/name/nameEn/emoji/sortOrder/isActive |

**结论**：姿态域**枚举完全同步**，但 OpenAPI 包含更多元数据字段（nameEn/sortOrder/isActive）。

---

### 8️⃣ 通知 (`notification.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `NotificationType` | ❌ 无 | ❌ 不存在 | 前端定义 "revenue\|fan\|content\|system\|achievement"；OpenAPI 无通知 schema |
| `Notification` | ❌ 无 | ❌ 不存在 | 前端定义通知消息结构；OpenAPI 无覆盖 |

**结论**：通知域**前端独立设计**，后端未实现。

---

### 9️⃣ 影视 (`film.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `DramaStatus` | ❌ 无 | ❌ 不存在 | 前端定义 "casting\|filming\|post-production\|released"；OpenAPI 无 Drama 模型 |
| `MovieStatus` | ❌ 无 | ❌ 不存在 | 前端定义 "pre-production\|filming\|post-production\|released"；OpenAPI 无 Movie 模型 |
| `MovieRole` | ❌ 无 | ❌ 不存在 | 前端定义 "lead\|supporting\|cameo"；OpenAPI 无 |
| `AdType` | ❌ 无 | ❌ 不存在 | 前端定义 "TVC\|digital\|print\|social"；OpenAPI 无 |
| `AdStatus` | ❌ 无 | ❌ 不存在 | 前端定义 "negotiating\|shooting\|completed"；OpenAPI 无 |
| `VoiceWorkType` | ❌ 无 | ❌ 不存在 | 前端定义 "animation\|documentary\|audiobook\|game"；OpenAPI 无 |
| `Drama/Movie/Advertisement/VoiceWork` | ❌ 无 | ❌ 不存在 | 前端完整定义影视业务实体；OpenAPI 全无覆盖 |

**结论**：影视域**完全前端超前**。这是一个新业务域，后端尚未实现任何 schema。

---

### 🔟 分发 (`distribution.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `PlatformCategory` | ❌ 无枚举 | ❌ 不存在 | 前端定义 "music\|video\|social\|live"；OpenAPI 无对应枚举 |
| `PlatformStatus` | ❌ 无枚举 | ❌ 不存在 | 前端定义 "connected\|pending\|disconnected"；OpenAPI 无对应枚举 |
| `Platform` | 类似 `PlatformAccount` | ⚠️ 字段差异 | 前端：id/name/icon/category/status/followers/lastSync；OpenAPI 是 PlatformAccount：id/userId/platformKey/connected/email/connectedAt/updatedAt |
| `ContentDistributionStatus` | ❌ 无 | ❌ 不存在 | 前端定义 "published\|distributing\|scheduled\|draft"；OpenAPI 无直接对应 |
| `DistributionContentItem` | 类似 `DistributionJob` | ⚠️ 建模差异 | 前端按内容维度（id/title/type/status/platforms/totalViews/date）；OpenAPI 按发行任务维度（jobId/trackId/selectedChannels/platformResults） |
| `PlatformViewPoint` | ❌ 无 | ❌ 不存在 | 前端定义平台播放统计；OpenAPI 无 |

**结论**：分发域**前端侧重 UI 展示**（平台连接、内容追踪、播放统计），OpenAPI **侧重任务流程**（发行作业、渠道结果、预发售）。

---

### 1️⃣1️⃣ 粉丝 (`fan.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `FanTab` | ❌ 无 | ❌ 不存在 | 前端定义页面标签页；纯 UI 逻辑 |
| `FanArtist` | ❌ 无 | ❌ 不存在 | 前端定义粉丝视角的艺人卡片；OpenAPI 无直接对应 |
| `TrackItem` | 类似 `Track` | ⚠️ 展示优化 | 前端简化为 id/title/artist/cover/plays/duration/liked；OpenAPI Track 更完整 |
| `NFTItem` | 类似 `NFTCollectionSummary` | ⚠️ 字段差异 | 前端：id/name/artist/preview/price/rarity/holders；OpenAPI：id/name/coverUrl/priceEth/remaining/rarity/trackId |
| `FanProfile` | ❌ 无 | ❌ 不存在 | 前端定义粉丝档案；OpenAPI 无对应 |

**结论**：粉丝域**前端做了展示优化**，简化了模型，OpenAPI 无粉丝侧专用 schema。

---

### 1️⃣2️⃣ 社区 (`community.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `FanTier` | ❌ 无 | ❌ 不存在 | 前端定义粉丝等级；OpenAPI 无 |
| `FanGrowthPoint` | ❌ 无 | ❌ 不存在 | 前端定义粉丝增长时间序列；OpenAPI 无 |
| `FanActionType` | ❌ 无 | ❌ 不存在 | 前端定义粉丝互动类型枚举；OpenAPI 无 |
| `FanActivity` | ❌ 无 | ❌ 不存在 | 前端定义粉丝活动动态；OpenAPI 无 |
| `CommunityEventType` | ❌ 无 | ❌ 不存在 | 前端定义社区事件类型；OpenAPI 无 |
| `CommunityEvent` | ❌ 无 | ❌ 不存在 | 前端定义社区事件；OpenAPI 无 |

**结论**：社区域**完全前端超前**。这是一个新业务域，后端尚未实现。

---

### 1️⃣3️⃣ 导航 (`navigation.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `CommandItem` | ❌ 无 | ❌ 不存在 | 前端定义命令面板条目；纯 UI 控件，OpenAPI 无需覆盖 |

**结论**：导航域**纯前端 UI 逻辑**，不需要后端 schema。

---

### 1️⃣4️⃣ 设置 (`settings.ts`)

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `SettingsSection` | ❌ 无 | ❌ 不存在 | 前端定义设置界面分页；纯 UI 逻辑 |
| `SubscriptionPlan` | 类似 `PlanType` | ⚠️ 字段差异 | 前端：id/name/code/price/features/current（完整计划对象）；OpenAPI：PlanType 仅是枚举 "free\|pro\|enterprise" |
| `BillingRecord` | ❌ 无 | ❌ 不存在 | 前端定义账单记录；OpenAPI 无对应 |

**结论**：设置域**前端对订阅计划进行了扩展**，OpenAPI 仅定义了 PlanType 枚举。

---

## 🔍 仅前端存在的类型（后端需补）

### 高优先级（业务核心）
1. **`Film` 域整体**：Drama, Movie, Advertisement, VoiceWork（影视/广告/配音业务未被 OpenAPI 覆盖）
2. **`Community` 域整体**：FanTier, FanActivity, CommunityEvent（社区互动业务未被覆盖）
3. **`ArtistType` 和 `ArtistStatus` 枚举**：OpenAPI 仅定义 SingerStatus，无艺人多类型模型
4. **`TalentProfile` 六维才艺**：前端定义了详细的人才属性模型
5. **`SignedArtist`（MCN 视角）**：Coach 业务的核心实体未被 OpenAPI 覆盖
6. **Distribution 队列与版权审核**：DistributionQueueItem, CopyrightItem（发行流程管理未被覆盖）

### 中优先级（展示/UI 层）
7. `Money` 类型（金额 + 展示文案）
8. `Platform` 和 `PlatformCategory`（分发平台统计视图）
9. `SubscriptionPlan` 完整对象（计划详情，OpenAPI 仅定义枚举）
10. `FanArtist`, `TrackItem`, `NFTItem`（粉丝侧简化模型）
11. `BillingRecord`（账单记录）
12. `Notification` 和 `NotificationType`（消息中心）

### 低优先级（纯 UI 逻辑）
13. `CommandItem`（命令面板）
14. `SettingsSection`（设置页导航）
15. `CoachPage`（教练页导航）
16. `FanTab`（粉丝页标签页）

---

## 🔍 仅后端存在的类型（前端未接入）

### OpenAPI 定义但前端无直接对应

1. **`User`**（完整用户对象）- 前端未定义，仅在 API 响应中使用
2. **`PersonaParams`**（艺人参数化属性 sweetness/energy/mystery）- 前端 Artist 无此字段
3. **`OfficialIp`**（官方IP模板）- 前端无官方 IP 管理页
4. **`UserWardrobeItem`**（用户服装所有权）- 前端无明确模型
5. **`SingerPoseConfig`**（艺人姿态配置）- 前端 Pose 无此状态管理
6. **`LyricLine`**（歌词行级对象）- 前端 Track 中无歌词对象
7. **`TrackGenerationRequest` / `TrackGenerationResponse`**（异步生成作业）- 前端无对应
8. **`NFTPerks`**（NFT 权益）- 前端 NFTItem 无此字段
9. **`NftMintRequest`**（NFT 铸造请求）- 前端无 NFT 铸造 UI
10. **`NFTMintJob`**（NFT 铸造任务）- 前端无铸造任务追踪
11. **`DistributionChannel` / `PlatformAccount` / `PlatformResult`**（分发渠道管理）- 前端 Platform 模型简化
12. **`DistributionJob` / `DistributionPublishRequest`**（发行作业）- 前端无完整对应
13. **`ChartEntry` / `VoteRecord`**（排行榜 & 投票）- 前端无排行榜功能
14. **`CoachTrainee` / `TraineeKPI` / `SubmissionReview`**（教练学员管理）- 前端教练端未实现
15. **`DashboardStats`**（仪表板统计）- 前端无统计聚合
16. **`MarketplaceArtist` / `SigningContract` / `ArtistListingRequest`**（艺人售卖市场）- 前端无市场概念
17. **`ArtistAnalytics` / `RecentSong`**（艺人分析）- 前端无分析页
18. **`EarningDataPoint`**（收益数据点）- 前端无收益图表数据结构
19. **`WalletBalance`**（钱包余额）- 前端 WalletSummary 仅展示文案
20. **`ErrorResponse` / `ErrorDetail`**（错误响应）- 前端在 ApiErrorShape 中定义

---

## 📊 字段级差异总结

### 类型差异（同名但类型不一致）

| 字段 | 前端类型 | OpenAPI 类型 | 说明 |
|------|------|------|------|
| `Transaction.amount` | `string`（预格式化） | `number` | 前端显示文案（如 "+¥1000"），OpenAPI 原始数值 |
| `Transaction.type` | `"income" \| "withdrawal"` | 8 种详细类型 | 前端简化，OpenAPI 细分 |
| `ClothingItem` 整体 | 简化（6 字段） | 完整（14 字段） | 前端关注展示必需，OpenAPI 包含元数据 |
| `SavedOutfit.items` | `Record<EquipSlot, ClothingItem\|null>` | `EquippedItems`（string ID） | 前端嵌入完整对象，OpenAPI 仅 ID 引用 |
| `Pose.thumbnail` | `string` | `string, format: uri` | OpenAPI 更严格（format 规范） |
| `NFTCollection.priceEth` | 预期 `number` | `string`（decimal 字符串） | OpenAPI 用字符串避免浮点精度问题 |
| `Artist.fans/revenue` | `string`（预格式化） | `integer`（原始值） | 前端预格式化，OpenAPI 原始 |

### 缺失字段（OpenAPI 有，前端无）

| OpenAPI 字段 | 所属 Schema | 前端是否需要 | 说明 |
|------|------|------|------|
| `nameEn` | Pose, Expression, Gesture, OfficialIp, ClothingItem | ⚠️ 可选 | 国际化支持，前端暂未用 |
| `sortOrder` | Pose, Expression, Gesture, ClothingItem, OfficialIp | ⚠️ 可选 | 排序权重，前端无需曝露 |
| `isActive` | Pose, Expression, Gesture, ClothingItem, OfficialIp | ⚠️ 可选 | 逻辑删除标记，前端无需曝露 |
| `createdAt` / `updatedAt` | 大多数实体 | ✅ 应含 | 前端应该包含 |
| `format: date-time` | 所有时间字段 | ✅ 应严格化 | 前端应规范化为 ISO-8601 |

### 缺失字段（前端有，OpenAPI 无）

| 前端字段 | 所属类型 | OpenAPI 缺陷 | 说明 |
|------|------|------|------|
| `display` | `Money` | 完全无 | 前端预格式化展示文案 |
| `persona` / `talents` | `Artist` | 部分无（无 TalentProfile） | 艺人多维属性未被 OpenAPI 覆盖 |
| `level`, `exp`, `maxExp` | `Artist` | 无 | 艺人成长系统，OpenAPI 未定义 |
| `domains` | `Artist` | 无 | 艺人主营领域，OpenAPI 未定义 |
| `commercialValue` | `Artist` | 无 | 商业价值评级，OpenAPI 未定义 |
| `emoji` | `Gesture` | `emoji` 字段有，但结构差异 | OpenAPI Gesture 包含 emoji，但前端定义略有不同 |

---

## 🎯 建议与后续行动

### 1. 紧急（P0）：协调高频业务域

**影视（Film）**
- 后端需在 OpenAPI 中定义：Drama, Movie, Advertisement, VoiceWork schemas
- 前端已完整定义，可直接沿用
- 涉及：创建/编辑影视项目、追踪参演状态、收益结算

**社区（Community）**
- 后端需在 OpenAPI 中定义：FanTier, FanActivity, CommunityEvent, FanGrowthPoint schemas
- 前端已完整定义，可直接沿用
- 涉及：粉丝等级、活动动态、投票参与

**艺人类型与生命周期**
- 后端需支持前端定义的 ArtistType（singer/actor/entertainer/dancer/host/all_rounder/idol）
- 后端需支持前端定义的 ArtistStatus（trainee/debut/active/rest/retired）
- 当前 OpenAPI 仅定义 SingerStatus（active/draft/archived），过于简化

### 2. 高优先级（P1）：补齐核心业务

**MCN & Coach 业务**
- 定义 SignedArtist, CoachRevenuePoint, DistributionQueueItem, CopyrightItem schemas
- 前端教练端已完整设计，后端需实现对应 API

**NFT 铸造与销售**
- 定义 NFTPerks, NftMintRequest, NFTMintJob schemas
- 补充 NFTCollection 中缺失的权益与阶段字段

**分发渠道管理**
- 统一 Platform / PlatformAccount / DistributionChannel 的定义
- 前端 Platform 是简化视图，OpenAPI 的 DistributionChannel/PlatformAccount 更完整，需明确职责分工

### 3. 中优先级（P2）：展示层对齐

**预格式化字符串 vs. 原始数值**
- 建议：OpenAPI 返回原始数值，前端负责格式化
- 当前状态：前端部分字段已预格式化（ArtistStats.fans/revenue、Transaction.amount），容易与后端数据不同步
- 行动：在 API 层约定格式化规范，或在后端支持两种返回模式

**时间格式规范化**
- 确保所有 date-time 字段使用 `format: date-time`（ISO-8601）
- 前端统一使用 `ISODateTime` 类型别名

**货币与金额**
- OpenAPI Transaction.amount 使用 `number`，但精度定义不清
- 建议：定义 `PreciseDecimal` 类型，或约定小数位数（如 2 位表示分）
- 前端 Money 类型支持 amount + currency + 可选 display，可作为模板

### 4. 低优先级（P3）：文档与清理

**标记已覆盖的字段**
- 在前端类型中添加注释，指向对应的 OpenAPI schema
- 示例：`// @openapi SingerQuality`

**废弃/重构计划**
- 确认 Coach 页（CoachPage 枚举）是否还需要，或移至路由定义
- 确认 CommandItem 是否需要后端支持，或完全由前端静态定义

**Future Domains（尚未规划）**
- 预留扩展点：后端可为以下域预先定义 schemas（虽暂无前端实现）
  - 内容审核（ContentModerationJob）
  - 用户等级系统（UserLevel, UserBadge）
  - 推荐引擎（RecommendationRecord）
  - 分析（ArtistAnalytics 虽在 OpenAPI 已定义，但前端未接入）

---

## 📈 数据对比表

| 维度 | 前端 | OpenAPI | 差异 |
|------|------|------|------|
| **总 schema/类型 数** | ~45 个接口 + ~30 个枚举 | ~74 个 schemas | 后端定义更多（包括请求/响应包装） |
| **完整对齐** | ~25 个 | ~25 个 | 约 50% 对齐度 |
| **字段级差异** | ~15 个 | ~15 个 | 多为展示优化差异 |
| **前端超前** | ~8 个类型 + ~6 个枚举 | - | Film, Community, Coach 等新域 |
| **后端超前** | - | ~20 个 schemas | User, 生成作业, NFT 铸造等细节 |
| **最大风险** | Artist 模型分化 | SingerDetail 过简 | 艺人多类型、多维度业务未统一 |
| **最大收益** | 分发分离 | DistributionJob/Channel 定义完整 | 前端可直接复用 OpenAPI 模型 |

---

## 📋 一句话总结

**前端为产品优先（展示 + 业务逻辑），OpenAPI 为技术优先（API 规范 + 数据完整性）；两者在艺人、教练、影视、社区等核心域的契约存在 20~50% 差距，需逐域协调统一。**

---

生成于 2026-04-17 | 下一步建议：按 P0 → P1 → P2 的优先级分批对齐，预计需 2-3 个迭代完成完全同步。

---

## 附录 · AI 形象锻造（`appearance-forge.ts`）— 2026-04-18 新增

| 前端类型 | OpenAPI Schema | 状态 | 差异说明 |
|---|---|---|---|
| `ForgeMode` | ❌ 无 | ❌ 不存在 | 4 种模式：`template_photo` / `prompt_only` / `template_prompt` / `random` |
| `ForgeTemplate` | ❌ 无 | ❌ 不存在 | id + name + image + tags[] + style |
| `LabeledOption`（发型 / 瞳色 / 风格标签） | ❌ 无 | ❌ 不存在 | 下拉清单；仅部分含颜色字段 |
| `FaceSlider` / `faceValues` | ❌ 无 | ❌ 不存在 | 6 项面部微调，值域 0-100 |
| `ColorScheme` | ❌ 无 | ❌ 不存在 | 两色渐变主题配色 |
| `ForgeRequest` | ❌ 无 | ❌ 不存在 | 生成调用参数；含 artistId / mode / templateId / uploadedPhoto / prompt / faceValues / lockedFeatures |
| `ForgeResult` | ❌ 无 | ❌ 不存在 | 含 id / image / prompt / mode / createdAt / locked[] |
| `ForgeOptions` | ❌ 无 | ❌ 不存在 | 静态选项批量下发包 |

**接口：**
- `GET  /appearance-forge/options` — 拉取静态模版 / 选项清单
- `GET  /appearance-forge/history?artistId=` — 该艺人历史生成记录
- `POST /appearance-forge/generate` — 异步生成（mock 模式同步返回）
- `POST /appearance-forge/blueprint` — 保存为艺人形象蓝图

**结论**：该域为前端全新超前领域，OpenAPI 完全缺失。后端介入时建议：
1. 生成接口按 `AsyncJobStarted` 封装（复用 `_shared.ts` 异步壳）；
2. 图片存储使用 `imageUrl`（与 wardrobe 一致）；
3. `uploadedPhoto` DataURL 在后端应提前转存对象存储，请求体改为 `photoAssetId`。


## 附录 · 音乐工坊（product_spec.md §10）

本次 v2.2 落地音乐工坊 P0 主动脉，相关契约差异：

**Song 类型新增字段**（OpenAPI 尚未涵盖）：

| 前端类型字段 | OpenAPI Schema | 状态 | 说明 |
|---|---|---|---|
| `artistId` | ❌ 无 | ✅ 已对齐 | 必填（DB NOT NULL）；对接发行平台时即为歌手身份；后端在 `aep_songs.artist_id` 已落列并收紧为 NOT NULL |
| `audioUrl` | ❌ 无 | ❌ 不存在 | 当前 mock 占位 URL；后续迁 OSS |
| `coverUrl` / `lyrics` / `modelVersion` / `thinkDepth` / `creditsSpent` / `createdAt` | ❌ 无 | ❌ 不存在 | 见 product_spec.md §10.2 |

**Album 字段变更**：
- **新增**：`artistId` / `trackIds`（前端、后端均已落列）
- **删除前端契约**：`trackCount` / `status` / `sales` / `revenue`（admin 存量过渡页面仍读取，标记 @deprecated）

**Concert 字段变更**：
- **新增**：`artistIds` / `streamUrl`
- **弱化前端契约**：`venue` / `ticketPrice` / `capacity` / `soldTickets` / `revenue` 标记 @deprecated（admin 过渡使用）

**新增接口**（均走 `/api/me/*`）：
- `GET  /me/songs` — 列出当前用户名下所有 AI 艺人的歌曲（按 artistId JOIN DigitalIp.ownerUserId）
- `POST /me/songs` — 创建歌曲；body 必含 `artistId`，后端校验 ownership + 按 (modelVersion, thinkDepth) 扣 credits
- `POST /me/songs/:id/advance` — 推进状态机（MVP 无扣费）

**结论**：OpenAPI 未覆盖。后端落地建议：
1. 扣费策略由 admin 侧 `/platform/config` key `music.workflowPricing` 下发，Controller 读配置扣费；
2. 创建入口需写入 `LedgerEntry` 并将 `reference.type='song_generation'` / `reference.id=song.id`；
3. 发布（released）后触发分发流程（未来对接音乐发行开放平台，以 `artistId` 映射为外部 "歌手"）。


## 附录 · AI 生成工作流（创作工坊 LLM Playground · v2.4）

本次 v2.4 落地 StudioPage 的 LLM Playground，新增 `generation` 领域。当前属**纯前端交互模拟**（typewriter + 候选池随机），相关契约钩子已预埋：

**前端类型（新域，OpenAPI 无）**：

| 前端类型 | OpenAPI Schema | 状态 | 说明 |
|---|---|---|---|
| `GenerationStage` | ❌ 无 | ❌ 不存在 | 8 值枚举；后端 SSE 事件的 event type 可直接复用 |
| `GenerationMessage` | ❌ 无 | ❌ 不存在 | 对话气泡；后端建议存入 `aep_generation_message` 审计表 |
| `GeneratedMusicDraft` | ❌ 无 | ❌ 不存在 | 最终产物结构；`creditsEstimate` 由后端按模型/深度表查得 |
| `GenerationRequest` / `GenerationResult` | ❌ 无 | ❌ 不存在 | P2 后端对接用 |
| `GenerationJob`（admin） | ❌ 无 | ❌ 不存在 | 审计实体；P2 建议落表 `aep_generation_job` |

**新增接口（均为预留钩子，前端组件走本地流式模拟，不实际调用）**：
- `POST /me/generation/run` — 触发一次生成；推荐后端走 SSE / WebSocket 流式回推 `stage` 事件，最后一个事件携带 `draft` payload
- `GET  /admin/generation/jobs` — 列出全平台生成任务（审计）
- `GET  /admin/generation/jobs/:id` — 详情
- `POST /admin/generation/jobs/:id/abort` — 人工中止
- `POST /admin/generation/jobs/:id/refund` — 退费

**后端实现建议（待办）**：
1. 模型 × 深度价表由 `/admin/platform/config` 下发，与 `MusicApi.createSong` 的扣费逻辑共用；
2. 生成流程应在 `accept` 时才落库为 `Song`（与当前前端 `MusicApi.createSong` 对齐），`GenerationJob.resultSongId` 记录落库结果；
3. 审计日志：每条生成无论是否 accept 都写 `GenerationJob` + `GenerationMessage[]`（含用户 prompt 与模型回写片段），支持合规回溯。

---

## 附录 · 账号 = Studio 收紧（v2.5 · 2026-04-19）

本次收紧把 **"一个账号 = 一个 Studio"** 从约定变成硬契约：

| 维度 | 变化 |
|------|------|
| `LicenseRedeemRequest` | 必填 `studioName`；可选 `studioKind`（默认 personal_creator）。后端 `LicenseActivationService` 在同一事务内 AepUser + Studio + Wallet + Membership + LedgerEntry 一起落库 |
| `LicenseRedeemResult` | 响应新增 `studio: StudioDto`（与 AepUser 一同返回） |
| `DigitalIp.studioId` | DB 层 `nullable=false`；创建艺人时若未传则后端按 owner→Studio 自动回填；无 Studio 返 409 |
| `DigitalIp.ownerUserId` | 前端 `Artist.ownerUserId` 类型收紧为必填（与 server 的 NOT NULL 对齐）；`studioId` 同样必填 |
| `Song.artistId` | DB 层 `nullable=false`；创建歌曲时必传，后端校验 ownership |
| `GET /me/songs` | 新增 `?artistId=` 筛选参数（StudioPage 按艺人查歌曲直接走参数，无需前端 filter） |
| `AdminStudioDto` | 新增 `ownerUsername` 冗余字段 |
| `AdminDigitalIpDto`（复用 `DigitalIpDto`） | 新增 `studioName` 便利字段 |
| `AdminMusicController` Song DTO | 新增 `artistName / studioId / studioName` 便利字段 |
| DataInitializer | 移除 personal-kind 示例账号；每个 Studio 首艺人种 1–2 首 Song
