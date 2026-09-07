# IP 工作台 · 数字资产 · 数字名片 —— 整合方案

> 三个子产品合成一条链：**造形象 → 登记资产 → 对外发布**。
> 相关真源：[`ip-studio-plan.md`](ip-studio-plan.md) · [`ip-studio-generalize-proposal.md`](ip-studio-generalize-proposal.md) · [`digital-business-card-plan.md`](digital-business-card-plan.md)
> last-reviewed：2026-09-07（v0.153–v0.156 落地后回填实际形态）

---

## 1. 一条链，三段职责

```
 AI IP 工作台            数字资产平台              数字名片
 (ipstudio 3015)         (dap · web-aiavatar)      (/card)
 ─────────────           ─────────────────         ──────────
 一张照片 + 内置工作流   登记 · 版本 · 授权 · 用量  对外发布面
 一次产出一整组          DapAvatar / Look / Deriv   引用，不拷贝
        │                        │                      │
        └──── IpPublishService ──┴──── dapDisplayRef ───┘
```

| | 前提 | 单位 | 产出 |
|---|---|---|---|
| **工作台** | 还没有形象 | **一整组** | `DapAvatar` + 多条 `DapLook` + `DapDerivative` |
| **数字资产** | 已经有形象 | 一次一个动作 | 在既有形象上补单张（`createLook` / `createDerivative`） |
| **数字名片** | 已经有资产 | 一张对外页面 | 不产生资产，只引用 |

**分界线是带不带 `avatarId`** —— `DapWorkflowService` 全部方法都要求已有形象；工作台是从零到一组。
名片不关心形象是哪边来的，两条路都汇进同一个 `DapAvatar`。

---

## 2. 打通只靠两样现成东西

### 2.1 `dapDisplayRef`（v0.60 已实现，不要另造）

`DapAvatarRefResolver` 已定义的形象引用格式，名片每屏存一个字符串即可：

```
null          → 跟随定妆照（永远最新）
look:<id>     → 指定装扮
deriv:<id>    → 指定衍生（表情图 / 短动作视频）
variant:<idx> → 形象变体
shot:<name>   → 机位照
```

**它已处理「资产被删 / 进回收站 → 静默回退，不阻断渲染」**，名片直接复用，不自己写降级。

### 2.2 `DapAssetUsage`（已存在，加一个用途类型）

合成产物已在用它写双向引用。名片发布时同样写一条 `business_card`：

- dap 资产详情页 → 「已用于 · AI 数字名片 BC-2041」
- 授权撤销 / 形象删除时 → 立刻知道影响哪几张名片

### 2.3 开通：不发新码

`ProductRouteTable` 的 `any("/api/v1/**", AIAVATAR)` 兜底，`/api/v1/card/**` 与 `/api/v1/ip-studio/**` 共用同一条 `product_enrollment`。**开通数字资产平台 = 同时拥有工作台与名片。**

---

## 3. 内置工作流模板「IP 打造」

工作台首页新增一个一键模板。选性别 → 传一张照片 → 自动铺好整张画布。

### 3.1 画布骨架

```
画布内（ipstudio 出图链路）              发布之后（dap 视频衍生链路）
[原始照片] → [特征卡] → [风格]
                ↓
          [主形象 ×4]  ← 择一设为主形象，后续全部以它为 i2i 锚
                ↓
        ┌───────┴───────┐
   [装扮 ×4]        [表情 ×6]
        └───────┬───────┘
             [发布]  ─ ─ ─ ─ ─ ─ ─ ─ ▶  [短动作 ×3]
```

**短动作不在画布里跑。** `IpRunService` 只受理 `identity` / `generate` 两种节点，产物是图；短动作走 `DapWorkflowService.createDerivative(avatarId, "video", …)`，**该方法要求已有 `avatarId` 且形象已有定妆图** —— 也就是必须先发布。画布上它挂在「发布」下游，虚线连接。

> 一个对我们有利的细节：`createDerivative` 只对 `path=real`（真人复刻）的视频衍生要求审核通过的素材；ipstudio 发布的是 `path=ai`，不卡这道闸。

**主形象必须先定。** 装扮 / 表情 / 动作三组都把主形象作为参考图第一顺位（`master → source → reference`），这是「看起来是同一个人」的根。

### 3.2 三组产出与去向

| 组 | 数量 | 在哪跑 | 单价 | 小计 | 产出实体 | 名片怎么用 |
|---|---|---|---|---|---|---|
| 特征卡 | 1 次 | 画布 | `dap.ip-identity` 2 | 2 | — | 一致性锚，不出图 |
| **主形象** | 4 张 | 画布 | `dap.ip-image` 8 | 32 | `DapAvatar` | 定妆照 |
| **装扮** Outfit | 4 套 | 画布 | `dap.ip-image` 8 | 32 | `DapLook` | `look:<id>` —— 每屏一套 |
| **表情** Expression | 6 个 | 画布 | `dap.ip-image` 8 | 48 | `DapDerivative(kind=expr)` | `deriv:<id>` —— 名片彩蛋 / 社群头像 |
| **短动作** Motion | 3 段 × 2–3 秒 | **发布后 · dap** | `dap.derive-video` 30 | 90 | `DapDerivative(kind=video)` | `deriv:<id>` —— 名片**微动档**；也是 8 秒开屏的分镜来源 |

**全部跑完 204 分**，分三步扣：第 1 步 34（特征卡 + 主形象）→ 第 2 步 80（装扮 + 表情）→ 第 3 步 90（短动作，发布后）。

单价真源是 `DapProperties.Pricing`（`ipIdentity=2` / `ipImage=8` / `deriveVideo=30`），三项都可后台改 —— **UI 必须读实时单价，不许把数字写死在前端**。

> 短动作组直接补上了名片形象三档里的中间那档（静态 / **微动** / 口播）。产出格式要求带透明通道的 WebP 动图，见 [`digital-business-card-plan.md`](digital-business-card-plan.md) §8。

### 3.3 分男女：只分该分的

**性别只决定两件事：服装品类词库、体态基准。**

| 维度 | 男 | 女 |
|---|---|---|
| 服装品类词库 | 卫衣 / 工装裤 / 衬衫 / 西装外套 / 直筒裤 | 露肩针织 / 吊带 / 阔腿裤 / 半裙 / 大衣 |
| 体态基准 | 正面站立，肩线平直，重心居中 | 略侧身，重心偏移，肩线略斜 |

**性别不决定表情与性格。** 表情组男女**共用同一套六个**（开心 / 惊讶 / 思考 / 无奈 / 得意 / 犯困），短动作组同理。

> 这是刻意的设计约束。把「男性克制 / 女性活泼」写进模板会把刻板印象编码进产品，而且限制用户表达。性别在这里只是**服饰与体态的默认起点**，任何词条用户都能改，也可以直接选「不指定」。

### 3.4 模板是提示词，不是字段

每个模板项是**一段完整的提示词骨架**，套用后整段落进输入框，随便改。见 [`ip-studio-generalize-proposal.md`](ip-studio-generalize-proposal.md)。

表情组与动作组有一条硬约束写进模板正文：**服装、机位、光线保持与主形象一致，只改表情 / 动作**。这是这两组能成套用的前提。

---

## 4. 一条用户动线

1. 公社会员注册 → 名片草稿自动建（带姓名 / 手机 / 企业）
2. 名片提示「还没有形象」→ 跳工作台
3. 工作台：选性别 → 传一张自拍 → 套用「IP 打造」→ 一键铺画布
4. 跑主形象 ×4 → 择一设为主形象
5. 一键运行剩余三组（装扮 4 / 表情 6 / 动作 3）
6. 发布 → `DapAvatar` + 4 `DapLook` + 9 `DapDerivative` 进数字资产
7. 回名片：按屏挑装扮，微动档挑动作
8. 军师诊断供文字内容 → 发布名片 → 扫码递出去

**每一步的产物都是下一步的输入，没有一次重复劳动。**

---

## 5. 需要新增的

| 层 | 项 |
|---|---|
| ~~server~~ | ~~`card_profile` 表~~ **v0.153 已落地**（V28 迁移；核过线上 `flyway_schema_history` 最大值=27） |
| ~~server~~ | ~~公开读端点~~ **v0.153 已落地**：`GET /api/v1/card/p/{slug}` + `AepSecurityConfig` permitAll + `PUBLIC_GETS` 登记，8 条单测守「未发布 / 软删 / 不存在同一个 404」 |
| ~~server~~ | ~~`DapAssetUsage` 用途类型~~ **v0.153 已落地**：发布名片时写一条 `usedByType=card` 的使用记录（best-effort 旁路，失败只 WARN 不挡发布） |
| ~~server~~ | ~~内置模板端点~~ **v0.153 已落地**：`GET /v1/ip-studio/prompt-presets`（装扮 9 / 表情 6 / 短动作 3）；内置工作流走既有的 `GET /templates`，新增 `ip-launch-female` / `ip-launch-male` 两套 |
| server | 短动作：复用 `DapWorkflowService.createDerivative(avatarId, "video", …)`，**必须在 ipstudio 发布之后**；需要一个「发布后自动排队跑短动作」的编排（**仍未写**，当前形态见下） |
| ~~web-ipstudio~~ | ~~内置「IP 打造」工作流~~ **v0.156 补齐**：`ip-toy-figure`「潮玩 IP · 一张照片起一整套」照业务方真稿排 —— 照片 → 特征卡 → 招牌造型 → 主形象 → 五套变体 → 发布，配套五条视频提示词进 motion 组 |
| ~~web-ipstudio~~ | ~~出图弹层通用化~~ **v0.153 已落地**：形象卡从五个固定字段改成一个提示词框 + 内置模板 chip（装扮组按性别过滤）；首页「IP 打造」入口沿用既有模板卡片，选男版还是女版 = 选哪张模板卡 |
| ~~web-aiavatar~~ | ~~资产详情页「已用于 · 名片」~~ **v0.153 已落地**：并进「被用在哪」，与艺人壳引用、合成出片同一张列表 |
| ~~web-aiavatar~~ | ~~`/card` 域全部页面~~ **v0.155 已落地**：公开页 `/card/p/{slug}`（含换装条）、「我的名片」`/cards`、编辑表单 `/cards/{id}/edit`。建卡走 `POST /v1/card/from-avatar`，名字与衣柜从形象自动带过来 |
| ~~web-ipstudio~~ | ~~工作台里看得到资产与名片~~ **v0.154 已落地**：`/assets` + `/cards` 两个只读页 + 顶栏导航「项目 · 资产 · 名片」。服务端零改动，复用已有读接口 |
| ~~契约~~ | ~~openapi 补 path~~ **v0.153 已落地**：9 条（card ×8 + prompt-presets ×1），`check:api-contract` 绿 |

### 短动作现在长什么样（v0.153 实际形态）

画布跑不了短动作 —— `IpRunService` 只认 `identity` / `generate` 两种节点，而
`DapWorkflowService.createDerivative` 要求先有 `avatarId`，也就是**必须发布之后**。
所以这一版没有假装能在画布里跑：三条短动作提示词（挥手 / 点头 / 指向下方）作为
内置模板放进 `prompt-presets` 的 `motion` 组，用户发布成数字资产后到 dap 里生成。
「发布后自动排队」是下一步，不是这一版。

---

## 6. 三条红线

1. **名片只读工作台「发布出来的」资产**，不读 `ip_project.doc`。doc 是客户端拥有、服务端整存整取的，破了这条边界两边就锁死。
2. **签名 URL 不进任何文档**（§4.7.7）。名片文档、画布 doc 一律只存 cdnKey，出 wire 时经 `CdnUrlSigner` 重签。
3. **引用失效必须有降级 + 通知。** `DapAvatarRefResolver` 已有静默回退；名片还要额外通知主人，不能让访客看到破图而主人不知道。

---

## 7. 待拍板

1. 内置模板写死在 `IpCatalogService` 还是进 `PromptService`（可后台配）—— 倾向后者，模板是运营资产。
2. dap 的 `expr` / `ward` 衍生与工作台表情组 / 装扮组重叠 —— 建议 **dap 只保留单张微调，成组一律进工作台**。
3. 短动作视频的引擎与单价（视频按秒计费，3 段 × 2–3 秒的成本要先算清楚再开放）。
