# AiAvatar · 数字资产平台（web-aiavatar）

> 移动端 H5 / 微信小程序形态的「数字资产平台」。**六类资产**共用一套登记语言 ——
> `DH-` 人物 / `IP-` 品牌 / `SC-` 场景 / `PD-` 产品 / `VO-` 声音 / `ST-` 风格；
> IP 是容器，合成工作台把 人物 × 场景 × 产品 变成成片；
> 形象 · 声音 · 衍生物（图集 / 表情 / 场景 / 换装 / 3D / 运镜视频）与跨资产成片一站式沉淀为可复用资产，
> 并一键接入下游子应用（音乐 / 短剧 / 带货）。
>
> 本 app 是上传的《数字人资产平台 — 数据模型与系统逻辑规格》+ Figma Make 移动端原型
> 《数字人资产平台-移动端-v4》的工程落地。

- **端口**：3013（`pnpm dev:aiavatar` / `next dev -p 3013`）
- **技术栈**：Next 16.2.6 / React 19 / TypeScript（pnpm workspace 成员）
- **形态**：真实全屏 H5 应用 —— 底部 5 Tab + 覆盖页栈的客户端 SPA；铺满视口、真实安全区
  （刘海屏 / home 指示条 `env(safe-area-inset-*)`）；桌面端居中为一列内容（非手机模型）
- **主题**：HeyGen 风「清爽」皮肤 —— 纯白纸面 `#F7F9FB` + 单色青 `#12B3DE` 点睛
- **字体**：Manrope（UI/标题）/ Newsreader（资产身份衬线）/ JetBrains Mono（登记号）/ Noto Sans SC（中文）

---

## 快速开始

```bash
# 仓库根目录
pnpm install                       # 安装依赖
pnpm dev:aiavatar                  # http://localhost:3013

# 或在本目录
pnpm dev                           # 同上（默认 webpack 引擎，稳定）
pnpm dev:turbo                     # 想要 Turbopack 提速时用（部分机器会 panic，见下）
pnpm typecheck                     # tsc --noEmit
pnpm build                         # 生产构建（webpack，standalone）
pnpm build:turbo                   # Turbopack 构建（可选）
```

无需启动后端：屏幕层直接消费 `src/proto/data.ts` 的样例数据（`NEXT_PUBLIC_USE_MOCK=1`）。

> **构建引擎**：Next 16 默认用 Turbopack，但其在部分环境（尤其某些 macOS）会
> `FATAL ... Turbopack ... panic`。因此本 app 的 `dev` / `build` **默认走 webpack**（稳定），
> Turbopack 作为 `dev:turbo` / `build:turbo` 可选项。若仍遇 Turbopack panic：先
> `rm -rf .next` 清缓存再重试，或直接用默认 webpack 脚本。

---

## 屏幕地图（27 屏）

底部 5 Tab：`首页 · 资产库 · ＋创建 · 应用 · 我的`（＋为中间凸起，弹「先选类型再选来源」sheet）。

### 数字资产平台（v0.104 新增 9 屏 / 改造 4 屏）

| 屏 | 入口 | 说明 |
|---|---|---|
| 首页 · 资产总览 | Tab（改造） | 合成 banner + 六类资产瓦片（数量 + 登记前缀）+ 跨类型最近更新 + 人物 rail |
| 资产库 | Tab（改造） | 我的资产 / 资产广场 · 六类分类 pill（全部时分区总览）· 搜索 |
| 场景库 / 产品库 / 风格模板库 | 资产库分类 | 来源（实拍 / AI）+ 空间筛选；上传 / 生成入口同格 |
| IP 详情 · 资产容器 | IP 卡 | 下挂 人物 / 场景 / 产品 / 声音 + 作品 + 授权三 tab；「用这个 IP 合成」 |
| IP 授权 | IP 详情 | LIC 凭证 · 有效期 · 续签 |
| 场景详情 | 场景卡 | 规格档案 · 光线变体 · APPLIED TO 已用于 |
| 产品详情 | 产品卡 | 多角度 + 品牌授权备注 · READY FOR 可直接产出 |
| 合成工作台 | banner / IP / 场景 / 产品 | 人物 × 场景 × 产品 选料 + 出片设置 + 授权核对 + COST |
| 合成结果 | 合成完成 | ARCHIVED 钢印 · 成片网格 · SOURCE 用到的资产 · 回流入库 |
| 新建资产 sheet | ＋ 创建（改造） | 先选类型（六类）再选来源（上传 / AI 生成两路并重） |
| 存储用量 | 我的（改造） | 按六类资产 + 合成产物 + 授权素材拆分 |

### 数字人主线（沿用）

| 屏 | 入口 | 说明 |
|---|---|---|
| 资产详情 | 卡片 | 形象设定 def / 标准图集 / 衍生物 / 版本 / 授权 + 音色 pill |
| 造型档案 / 设计造型 | 详情 | final 造型列表 + AI 设计造型（描述 / 场景库替换） |
| 衍生查看 | 详情 | 某类衍生物多张产出（图集 / 场景 / 3D 可旋转 / 视频可播放） |
| AI 创建 | 创建 sheet | 上传照片 / 文字描述 → 四宫格挑选 → 推荐音色 → 保存 |
| 真人素材入库 | 创建 sheet ／ 真人素材库 | 上传图片 / 视频或录制 → **确认当前协议 → 首次前往七牛云本人核验（同页打开）→ 自动回流 → 服务端确认结果 → 素材逐条送审**。流程到入库即结束，不自动生成、不扣生成算力；同一真人补素材复用 active 分组，换真人新建组 |
| 创建链路（5 步） | 真人 / 继续 | 素材&授权 → 形象生成 → 调整（自然语言 / 几何精调）→ 出图定稿 → 衍生 |
| 选择音色 | 详情音色 pill | 内置 7 款 AI 合成音色（女 4 / 男 3）· 试听 · 设为默认 |
| 声音工作室 / 声音克隆 | 我的 | 内置音色 + 我的声音 + 克隆录制 |
| 真人素材库 | 我的 | 每条素材预览与审核状态 · approved 后显示 `qasset` 引用 · License 凭证 / 续签 / 历史协议补确认 · 新增真人素材 |
| 作业队列 | 首页铃铛 | Job 实时进度 · 重试 / 查看 |
| 我的 / 会员与算力 / 存储用量 / 设置 | Tab | 账户 · 算力 / 存储 · 入口 |
| 应用中心 | Tab | 音乐工作室 / 短剧工坊 / 短视频带货（复用已定稿 Avatar） |

---

## 目录结构

```
src/
├── app/
│   ├── layout.tsx          # html/body + 全局样式 + 字体 link（React 19 自动提升到 <head>）
│   └── page.tsx            # 渲染 <App />（客户端 SPA 入口）
├── styles/
│   └── globals.css         # 设计令牌 + 手机壳/微信 chrome + V4「清爽」皮肤（移植自原型）
└── proto/                  # 原型移植层（屏幕 + 原语 + 数据）
    ├── data.ts             # ★ 领域类型 + Mock 数据（类型契约真源）
    ├── icons.tsx           # 线性图标库
    ├── portrait.tsx        # 数字人占位图
    ├── ui.tsx              # 基础 UI 原语（Button/Badge/Card/Tabs/Modal/Toast…）
    ├── shell.tsx           # 手机壳 PhoneFrame + 微信状态栏/导航/底部 Tab + 共享部件
    ├── toast.ts            # Toast 桥接
    ├── app.tsx             # ★ 根：Tab / 覆盖页栈 / 创建入口 / 屏幕索引
    └── screen-*.tsx        # 各屏（home / library / avatar / voiceapps / lictaskme /
                            #        more / real / chain / aicreate / voicepick）
```

---

## 数据 / 后端

**所有数据都经 `src/proto/api.ts` 这一个出入口**（屏幕层不直接 import `./data`）：

- `api.ts` 是前端契约层，已按规格 §4 补齐全部 REST 端点（`AvatarApi` / `VoiceApi` /
  `JobApi` / `LicenseApi` / `CaptureApi` / `AccountApi` / `AppApi` / `SceneApi` / `TemplateApi`
  + v0.104 的 `AssetApi` / `ComposeApi` + v0.105 的 `RealAuthApi` / `MaterialApi`），
  每个函数都带 `USE_MOCK` 分支：
  - `NEXT_PUBLIC_USE_MOCK=1`（默认）→ 返回 `src/proto/data.ts` 的样例（私有 mock「数据库」）。
  - `NEXT_PUBLIC_USE_MOCK=0` → `apiFetch` 打 `/api/v1/*`（经 `next.config.mjs` rewrite 到 :8080），
    自动解包后端响应壳 `{ success, data }` / 分页 `{ data, pagination }`。
- 屏幕用 `useApi(fn, seed.xxx())` 取数据：mock 下 `seed.*` 同步给出完整样例（首帧无闪烁），
  live 下初值为空、异步填充。**从 mock 切到真后端只需改 `USE_MOCK`，屏幕层零改动。**
- UI 字典（状态/路径/标准图/衍生 meta/链路/能力/精调/模板/配色）是展示配置，由 `api.ts`
  同步再导出（`DATA.STATUS` 等），同样只经本文件。
- `src/proto/data.ts` 现在只被 `api.ts` 引用（领域类型 + mock 数据真源）。
- 仓库已有 `apps/server` 的 `com.aistareco.aep.aiavatar.*`（v0.45）后端领域，但其契约与本规格
  是两套不同解释。本前端的契约真源是 `data.ts` 的接口 + `api.ts` 的 REST 面；接后端时以此对齐。
  详见 [`DECISIONS.md`](DECISIONS.md)。

---

## 版本日志

### v0.147（2026-09-01）— 完整 5 Tab 重排（首页 / 发现 / 创作 / 资产 / 我的）+ 修返回键乱跳

**起因（用户实测三条）**：① Tab 之间用 push 跳转，从任一 Tab 按返回都退回「我的」；
② 授权是低频操作却常驻一格；③ 首页被资产清单占满，"今天该干什么"和"有什么可看"都没有落点。

- **五个 Tab 重排**（真源 `docs/aiavatar-asset-hub-redesign.md` §1.5「信息架构（2026-09-01 定案）」）：
  | Tab | 路由 | 由原先哪些页面合并而来 |
  |---|---|---|
  | 首页 | `/` | 原工作台（总览 + 待办）+ 新增快捷创作 / 最近更新 / 官方精选 |
  | 发现 | `/discover` | 原资产主页的「官方资产」段 + 明星形象申请入口 |
  | 创作 | `/create` | 原中间凸起键（直接拉老 SPA 弹层）升级为真页面 |
  | 资产 | `/assets` | 原资产主页的「我的资产」段 |
  | 我的 | `/me` | 账号 + 授权中心（原 Tab 降为二级）+ 任务中心 + 算力/存储/设置 |
- **Tab 切换改 replace**：历史里只留"当前 Tab"一条，返回键不再在 Tab 间兜圈；
  二级页（设定卡 / studio 流程）仍是 push，返回回到来时的 Tab。
- **修创建流程的死链**：`realcapture` / `aicreate` / `compose` 属 `FLOW_SCREENS`
  （冷启动不按 hash 还原，缺角色上下文），此前 `/studio#/create/real` 这类深链会静默落到
  老首页。改为 `App` 新增 `start` 参数（`/studio?start=real|ai|compose|sheet`），由外壳
  在登录与平台门禁放行后显式发起流程。老 `?create=1` 继续兼容。
- **流程屏不再被底部导航挡住**：`tabBar` 作为插槽传进 `App`，与老 tab 栏共用同一显示条件
  （有覆盖页就收起）；`AppShell` 只在 tab 栏真的显示时才留底部空位。
- **修两处内部黑话**：创作页任务行显示 `mock.generate`（内部 stage 名）与
  `58.550452234259915%`（未取整的浮点）→ 改用人话的 `kind` + 取整百分比。
- 文件：新增 `components/hub/{home,discover,create-center,assets-library,asset-cards}.tsx`
  与 `app/{discover,create}/page.tsx`；删除 `components/hub/assets-home.tsx`。

### v0.142（2026-08-29）— 公开宣传页回归（访客首页）+ 工作台美化

- **根路径双面**：未登录访客看公开宣传页（`src/components/hub/landing.tsx`），已登录直接进工作台；
  访客不再被弹去 `/login`。旧 hash 转发仍优先于一切本页导航（七牛刷脸回调红线不变）。
  dev 预览：任意模式加 `?landing=1`。
- **宣传页视觉方向「青雾产品秀」**：青色氛围光 + AI 生成品牌插画（`public/landing/*.jpg`，
  4 张共 256KB，加载失败优雅隐藏）+ 悬浮的真实界面预览卡 + 三张图文卖点卡。
- **工作台美化**：资产总览改为青色渐变主卡（大号总数 + 三分类分栏）+ 快捷入口三宫格
  （创建资产 / 去创作 / 授权中心）；分类计数与总数对齐（IP 归入素材，与货架页一致）。
- **文案过「说人话」**：「进行中的事」→「进行中」、「暂时没有等你处理的事」→「没有在办的事」、
  「创建 / 制作请进工作室」→「创建、出片都在工作室」；任务 eta 只在真是时间估计时显示，
  不与「生成中」徽章重复。

### v0.141-hub-P2a（2026-08-29）— 明星授权进中枢：货架明星形象卡 + 授权中心双向 + 明星名片

- 新契约 `AssetApi.starGrants()`（`GET /v1/assets/star-grants`，celebrity 域只读投影）+
  `data.ts` `StarGrant` 类型与 mock。
- 货架"人物与形象"区展示授权给我的明星形象（授权引入徽章 + 有效期）；新路由
  `/stars/[id]` 明星形象名片（授权内容 + 去带货创作，审批中 / 已到期如实展示）；
  授权中心拆双向 tab（授权给我的 / 我授权出去的）；工作台纳入"明星授权审批中"。
- 申请与审批不在本 app 做（走带货线 + 明星工作台），这里只读结果；使用记录待
  带货出片真链路上线后接入 —— 无生产者不建假账。

### v0.107-hub-P1（2026-08-29）— 资产中枢重构第一期：真路由读界面 + /studio 双轨

> 设计真源：[`docs/aiavatar-asset-hub-redesign.md`](../../docs/aiavatar-asset-hub-redesign.md)。

- **新五路由（App Router + JSX + 现有 V4 令牌，无手机壳/微信 chrome）**：
  `/` 工作台（资产总览数字 + 进行中的事 + 最近动态）、`/assets` 资产货架（人物与形象大卡
  为主角，声音次之，场景/产品/风格/IP 收进"素材库"分区）、`/assets/[id]` 资产名片 + 设定卡
  （授权证书块 / 去创作 / 组成部分 / 被用在哪〔references + compositions〕/ 设定完整度〔前端
  按已填槽位推导〕/ 标准图集 / 衍生货架 / 人设）、`/licenses` 授权中心、`/me` 我的。
- **双轨迁移**：老版整站（`src/proto/App`，含创建链路 / 真人刷脸授权 / 合成工作台等全部
  "写"流程）原样挂 `/studio`，hash 深链不变；新页面进流程一律深链 `/studio#/...`。
- **兼容红线**：根路由挂旧 hash 转发器（`/#/avatar/...`、`/#/real-auth/...` 等 →
  `/studio` + 原 hash），七牛刷脸回调与历史分享链接不断；/studio 迁完前不得移除。
- 新增 `src/components/hub/`（ui.tsx JSX 原语 / auth.tsx 登录守卫 / data.ts 拉取工具）、
  `/login`（复用 MLogin 整套逻辑 + ?next= 回跳）。数据层完全复用 `src/proto/api.ts`，
  mock/live 双模式不变。门禁：typecheck + build（8 路由）绿；mock 模式五页 + 转发浏览器实测。

### v0.106（2026-08-03）— 七牛云真人核验移动端回流 + 平台授权证据链

- **同页跳转与自动回流**：进入七牛云 H5 前先把当前会话写入 `#/real-auth/<sessionId>`，再在当前页打开；七牛云回调页自动跳回该会话，也保留手动返回按钮。刷新、重新登录和用户手动返回后均可继续轮询，不会丢失链路。
- **过期链接正确重建**：不再把旧短链接当成可刷新资源；链接失效后调用 restart，由服务端回收旧分组并新建七牛云分组，避免继续展示失效 URL。
- **协议与核验证据分离**：开始核验前必须明确勾选当前版《真人数字形象授权及个人信息处理告知》。服务端保存协议全文、版本、哈希、授权范围、期限、处理方、时间和请求环境；七牛云 `active` 只证明活体与同人一致性，不再被等同为平台业务授权。
- **授权凭证 v2**：凭证分别展示平台协议留痕和七牛云核验证据；旧的真人授权若缺协议快照或核验引用，统一显示「待补确认」，不能继续通过生成/合成授权闸门。
- **绕过面收口**：声明式授权接口不能再给真人形象直接发证；重复回调和重复 verify 保持幂等，不会重复消费一次性 token、重复登记授权或重复提交素材。

### v0.105（2026-08-02）— 真人授权刷脸实名认证 + 素材平台审核（接七牛云 modelink）

> 本节保留当时的版本记录；当前交互与授权语义以 v0.106 为准。

真人线此前的「身份核验」是假的（后端只要素材存在就判通过并自动发授权）。本版接入七牛云 modelink，
把它换成**本人刷脸实名认证 + 服务端判定**，并补上「素材送内容安全审核」。**授权与审核全程免费**。

**新屏 / 改造**：

- **RealAuth（实名认证）** —— `screen-real.tsx` 里原来的假「身份核验」步骤真实化为独立一屏：
  准备中 → **去刷脸认证**（打开上游认证页；链接短时有效，可就地「换新链接」）→ 核验中 →
  通过后自动核验并登记肖像授权 → 未通过可「重新认证」。真人流水线因此变成
  `建资产 + 捕获 + 上传素材 → 实名认证 → 核验登记授权 → 复刻生成 → 就绪`。
- **补认证（authOnly）** —— 带既有资产进流程且它已经有定妆图时，认证通过即完成
  （文案「实名认证已完成」），不重复跑复刻生成。
- **授权登记页**（`screen-lictaskme.tsx`）：顶部新增「**待授权**」块（真人资产 × 无生效授权，
  每行一个「去认证」；**列表为空则整块不渲染** —— 授权徽标稀有是设计语义，不做常驻空状态）；
  授权卡加「**已刷脸核验**」徽标（只在 `verifyMethod=liveness` 时出现，未核验不显示负面文案）+
  可折叠「授权素材」（点开再拉，避免列表一次发 N 个请求）。
- **资产详情**（`screen-library.tsx`）：真人形象缺生效授权 → 顶部提示条 +「去认证」；
  新增「平台审核」区块 —— AI 原创人物可主动「提交平台审核」，真人形象只读展示审核结果（无记录不渲染）。
- **合成工作台**（`screen-compose.tsx`）：服务端 403 `DAP_LICENSE_REQUIRED` 从一句 toast 升级为拦截块，
  明说「本次没有建单，也没有扣算力」并给「去完成授权认证」。
- **新共用组件 `material-status.tsx`**：`MaterialBadge`（待审核 / 审核中 / 已通过 / 未通过）、
  `MaterialRow` / `MaterialSection`（`submit` / `readonly` 两模式）、`LivenessBadge`。
- 三个「去认证」入口统一走 `app.tsx` 新增的 `ctx.startRealAuth(char)`；带既有资产时深链写成
  `#/create/real/<id>`。

**契约（`data.ts` / `api.ts`）**：`License` 加 `verifyMethod`（`liveness` / `declared`，老数据视作
`declared`）；新增 `RealAuthSession` / `RealAuthStatus` / `Capture`（`authSessionId` / `authStatus`）/
`DapMaterialInfo` / `MaterialStatus` / `MaterialRefType`；新增 `RealAuthApi`（`POST /v1/real-auth/sessions`、
`GET /v1/real-auth/sessions/{id}`）与 `MaterialApi`（`POST` / `GET /v1/materials`）；
`CaptureApi.verify` 返回 `{passed, captureId, licenseId?}`，**认证未完成时会 409 `DAP_AUTH_NOT_COMPLETED`
—— 调用方应回到等待轮询，而不是当作失败**。

**mock 仍是一等公民**（`USE_MOCK=1` 整链离线可演示，已浏览器实测）：认证会话与素材审核都用
「创建时刻 + 时间差」惰性推进（与既有 mock 任务模拟器同思路，不开定时器）；刷脸通过后会往 mock
授权登记簿真的追加一条「已刷脸核验」的授权；`ComposeApi.create` 的 mock 分支补 403 与 server 对齐。
新增样本 **DH-2044「顾岩 Gù」**（真人复刻、已出图、**未授权**），驱动「待授权」块 / 详情提示条 /
合成 403 三处演示。mock 演示路径：
`授权登记 → 待授权「去认证」→ 录制/上传 → 实名认证（约 10 秒自动推进到通过）→ 授权登记出现新 LIC + 已刷脸核验徽标`；
以及 `资产库 → DH-2044 → 合成工作台 → 出片 → 403 拦截块 → 去完成授权认证`。

**server 侧要点**（详见 [`docs/VERSION_HISTORY.md`](../../docs/VERSION_HISTORY.md) `### v0.105` 与
[`apps/server/README.md`](../server/README.md)）：新增 `dap_material_group`（MG-）/ `dap_material`（MAT-）
两表 + `DapLicense.verifyMethod`/`livenessGroupId`、`DapCapture.authGroupId` 三列；接入点走后台
「AI 应用绑定」新用途 `DAP_REAL_AVATAR`（无 env 兜底），未配置且不允许 mock → 503
`DAP_MODELINK_NOT_CONFIGURED`（§8.0，不产假数据）；真人复刻缺生效授权的硬闸从合成路径**前移到生成入口**。

**分组治理补丁（同版收尾，纯 server，无前端改动）**：真实 API 探测确认上限
**3 个分组 / 30 个素材是整个平台账号级的**（非每用户）。补上 `deleteGroup` 能力 + 失败会话重试即回收
+ 超期 failed 分组的低频回收器（**active 分组绝不删** —— 生效授权的取证凭据）；配额打满从笼统 502
升级为 503 `DAP_MODELINK_QUOTA_EXCEEDED`。AI 原创人物送审从「平台默认组」改为**数字人专属 aigc 分组**
（账号级共享单例，配 `AEP_DAP_MODELINK_AIGC_QGROUPID` 即认领线上已建好的分组）。
新列 `dap_material_group.recycled_at`。推翻理由与取舍见 [`DECISIONS.md`](./DECISIONS.md) §M。

门禁：server compile + dap modelink 4 个新测试类 + `mvnw test` 全量回归全绿 / `pnpm typecheck:all` /
web-aiavatar `build` / `pnpm check:api-contract` 全绿；补丁轮 `Dap*Test` 47/47（新增
`DapModelinkGatewayTest`，本机 HttpServer 打桩上游、不打真实 API）+ contract 全绿。

### v0.104（2026-07-27）— 从「数字人平台」扩展为「数字资产平台」（六类资产 + IP 容器 + 跨资产合成）

设计真源：claude.ai/design 项目「数字资产平台」`数字资产平台.dc.html`（18 屏 → 27 屏：新增 9 / 改造 4）。

**产品骨架不变**（每个资产仍是被登记、编号、版本化的档案），**唯一根本变化**：
数字人不再是唯一的资产种类，而是六类之一。

1. **六类资产 + 统一登记语言**：`DH-` 人物 / `IP-` 品牌 / `SC-` 场景 / `PD-` 产品 /
   `VO-` 声音 / `ST-` 风格。衬线资产名 + REG 编号 + 版本 + 更新时间；分类靠**前缀与图标**
   区分不靠颜色（沿用 Collapsed-Rainbow 纪律）。
2. **授权模型收窄**：只有「真人肖像人物」与「IP」进授权登记（LIC 凭证 / 有效期 / 续签）；
   场景 / 产品 / 风格是轻资产，只记来源（实拍上传 or AI 生成）。授权徽标因此仍然稀有。
3. **IP 成为容器**：`DapAssetIp` 下挂人物 / 场景 / 产品 / 声音（成员靠各实体的 `ipId` 指向，
   删 IP 只解绑不删成员）；详情页三 tab = 资产 / 作品 / 授权。
4. **跨资产合成**：`POST /v1/compositions`（人物 × 场景 × 产品 → 成片）。出片前做**授权核对** ——
   真人复刻缺生效 LIC 直接 403 `DAP_LICENSE_REQUIRED`，不建单不扣费；产物入库登记为该 IP 的
   衍生物，并给每个用到的资产写一条 `DapAssetUsage` 双向引用（驱动详情页「APPLIED TO · 已用于」）。
5. **底部第二个 Tab**「数字人」→「**资产库**」；首页 rail 升级为六类资产总览 + 跨类型最近更新；
   创建 sheet 改为「先选类型，再选来源」；存储用量按六类资产口径拆分。

**server**（`com.aistareco.aep.dap.*`）：新增 7 张表
（`dap_asset_ip` / `dap_scene` / `dap_product` / `dap_style` / `dap_composition` /
`dap_composition_output` / `dap_asset_usage`）+ `DapAvatar.ipId` / `DapLicense.ipId` 两列；
新服务 `DapAssetService`（登记 / 检索 / 容器关系 / 引用台账）、`DapCompositionService`（授权核对 +
建单）、`DapAssetJobs`（场景生成 / 光线变体 / 产品图 / 补角度 / 合成五类执行体，进度与取消仍由
`DapJobRunner` 收口）；`DapImageInput` 抽出人物线与资产线共用的 i2i 参考图解析；
新 prompt key `dap.{scene_image,scene_variant,product_image,product_angle,compose}`（admin 可改）；
新单价 `dap.{scene-generate,scene-variant,product-generate,product-angle,compose}`（admin 动作单价表可配，
按张计费）。**§4.7 纪律**：新表文件字段一律存 storage key，JSON 文档（变体 / 多角度）里也只存
`cdnKey`，URL 出 wire 时由 `FileStorageService::signedUrl` 逐条派生。

**前端**：`data.ts` 补六类资产类型 + mock；`api.ts` 新增 `AssetApi` / `ComposeApi`（含 mock 任务
模拟器，产物在任务翻 done 的同一刻同步回填，与 `awaitJob` 解析时机对齐）；新增
`asset-kit.tsx`（登记语言原语）/ `asset-create.tsx`（六类新建流程）/ `screen-assets.tsx` /
`screen-ip.tsx` / `screen-scene.tsx` / `screen-product.tsx` / `screen-compose.tsx`；
六类资产深链 `#/ip|scene|product|style|compose/<id>` 支持冷启动还原。

门禁：server `compile` + `mvnw test` **409/409 全绿、0 失败**（本机需 `AEP_CDN_DRIVER=local`
覆盖 `apps/server/.env` 里的 `oss`，否则 30 个 `@SpringBootTest` 上下文加载失败 —— 已核实为
**与本轮无关的既有本地环境问题**，干净树同样复现，记入 `TODO.md` 2026-07-27 段）/
`pnpm typecheck:all`（10/10）/ web-aiavatar `build` / `pnpm check:api-contract` 全绿；mock 模式浏览器实测走通「首页总览 → 资产库 → IP 详情 →
合成工作台 → 合成结果 → 场景详情看到新增的『已用于』→ 场景光线变体 → 新建资产 sheet →
AI 生成场景 → 存储用量」整条链路。

- **2026-06-26 · 接入积分钱包在线充值（v2 §6）**：「会员与算力 → 充值算力」从静态 PACKS + 死按钮
  （「在线支付通道接入中」）改为真在线支付。`api.ts` 加 `WalletApi`（packages / checkout / confirmShadow）
  + `meFetch`（走 `/api` 前缀而非 `/api/v1`，带 Bearer + X-App-Code，复用主用户域 `/api/me/wallet/*`）。
  `MMembership` 加载真套餐（`listRechargePackages(sourceApp=aiavatar)`，含 mock 样例），「立即充值」→
  `rechargeCheckout` → `payData=page` 支付宝跳转 / `shadow` dev 收银台自动确认 → toast 到账。
  USE_MOCK=1 走样例 + 影子全流程可通；USE_MOCK=0 打真后端（aiavatar 登录已是真 JWT）。
- **2026-06-11 · 色彩纪律审计（redesign skill）**：V4「单青色清爽」皮肤的四处彩虹泄漏收敛 ——
  ①首页「开始创作」4 张暗卡的霓虹素材（蓝紫星云/绿金全息/紫粉声波/蓝绿芯片各一色系）
  统一品牌 duotone：底图 `grayscale` + 右上青色微光遮罩（screen 混合），四卡成为一组刻意的
  深墨暗段落而非彩色噪音；②Portrait 占位画像不再按 `char.hue` 每人一色（库网格彩虹墙），
  统一冷蓝灰族（hue 208±4 微差）；③首页轮播 bg/glow 紫粉 pastel → 青蓝族（皮肤明言去紫粉的漏网）；
  ④底部 FAB 由彩虹底图改实色品牌青渐变（底图降为 18% 去色纹理）；⑤详情统计行「2 小时前」
  文案降字号，不再撑爆 16px 数字槽。纯 CSS/常量级改动，无结构变更。
- **2026-06-11 · 灯箱 / Modal 层级修复**：`MLightbox` 与 `UI.Modal` 改 `createPortal` 渲染到
  `document.body`。根因：详情页 tab 内容容器 `.m-fade` 的 `mFadeUp` transform 动画带
  `fill-mode: both`（永久生效）→ 容器常驻 stacking context，`fixed + zIndex:200` 的覆盖层
  在其中压不过外层 sticky tab 条（z 5）/ 底部操作栏（z 20），表现为大图预览被 Tab 条和
  CTA 按钮「切开」。portal 跳出后为真全屏顶层（无头实测：覆盖中部 + 底栏，挂 body 下）。
- **2026-06-11 · 中文字体回退链**：`-apple-system` → 苹方 → HarmonyOS Sans SC → MiSans → 雅黑 → Noto Sans SC，修复国产 Android ROM（鸿蒙 / 小米等）中文字体断档。

### v0.11（2026-06-10）— 反向「应用于」视图（收敛 Phase 2 ①）

数字人详情页新增「应用于」卡片：展示该数字人被哪些 music / drama 艺人壳引用
（v0.60 收敛的反向视角）。

- **API**（`api.ts`）：`AvatarApi.references(id)` → `GET /api/v1/avatars/{id}/references`，
  mock 分支读 `data.ts` 的 `AVATAR_REFERENCES`（DH-2041 双引用 / DH-2038 单引用样例）。
- **类型**（`data.ts`）：`AvatarReference`（ipId / ipName / app / type / status /
  dapDisplayRef / importedAt），与 server `DapDtos.AvatarReferenceDto` 字段 1:1。
- **UI**（`screen-library.tsx` `MAppliedTo`）：概览统计与 Tab 之间插卡；每行 = 子应用图标
  （music ♪ / drama 🎬）+ 艺人名 + 「AI 音乐人 / AI 短剧 · yyyy-MM-dd 引入」+ 状态徽标；
  空列表不渲染（多数数字人无引用，不留空壳）；公开形象（PA-*）不拉取。

### v0.10（2026-06-10）— 真人复刻录制简化：6 秒三角度无声录制 + 美颜预览

暂不做声音复刻，录制只为采集多角度面部素材，故大幅缩短并强化引导（`screen-real.tsx`）：

1. **12 秒朗读 → 6 秒无声三角度**：删除提词器脚本；新增 `ANGLES` 分段
   （正对镜头 2s → 缓慢左转 2s → 缓慢右转 2s，正面放首段以契合后端「第 1 秒抽身份帧」）；
   `getUserMedia` 改 `audio: false`，不再申请麦克风权限。
2. **录制交互引导**：角度指引卡（三段步骤 chips + 当前动作大字 + 段内剩余秒数）、
   取景框内虚线面部参考椭圆、贴边脉动方向箭头（`mNudgeX` keyframe）、
   段切换中央闪示 + `navigator.vibrate` 轻震动、进度条分段刻度。
3. **美颜预览（降低素颜心理负担）**：`BEAUTY_FILTER` CSS 滤镜作用于**预览与回放展示层**
   （录制流/上传素材始终为原始录像，身份核验需要原片），录制屏与回放卡均有「美颜 开/关」角标，
   默认开；配套文案「录像仅用于身份核验 · 数字人形象将由 AI 美化」贯穿引导/录制/回放三屏。
4. 后端零改动（`DapCaptureService` 本无时长校验）；API 契约不变。

### v0.9（2026-06-09）— 数字人广场：大图预览 + 正面半身归位 + 运营上传公开数字人

承接 v0.8，按反馈补三项：

1. **形象图大图预览**（`screen-library.tsx` `MLightbox`）：广场详情「形象图集」每张图可点开看大图，
   全屏灯箱，多图左右切换 + 计数，点背景 / ✕ 关闭。
2. **定妆照 = 正面半身**：`data.ts` / `DapCatalogService` 给 `shotImages` 补 `front-half`（= 定妆主图 `-1`），
   广场图集按「正面半身 / 右侧脸 / 左侧脸」三机位陈列；`tilesForCat` 去重（定妆与正面半身同图时不再重复列）。
3. **运营内嵌后台 · 上传公开数字人**（沿用 web-celebrity v0.55 运营管理模式）：
   - 运营（`operatorRole` ∈ operator / super_admin）在数字人广场看到「＋ 新增公开数字人」，
     弹表单上传**正面半身 / 右侧脸 / 左侧脸**形象图（→ OSS，`§4.7`）+ 填人设（名称 / 简介 / 分类 / 设定档案）；
     已发布的运营形象在详情可**编辑 / 下架**。普通用户只读、可另存。
   - 后端：新增 `DapPublicAvatar` 实体 + `DapPublicAvatarService` + `AdminDapPublicAvatarController`
     （`POST/GET/PUT/DELETE /api/v1/admin/avatars` + `POST /api/v1/admin/uploads` multipart）；
     `AepSecurityConfig` 加 `/api/v1/admin/** → hasAnyRole(SUPER_ADMIN, OPERATOR)`；
     `GET /avatars?scope=public` 合并「内置 10 静态样板 + 运营 DB 形象」；`saveAs` 对运营形象连 OSS 图一起复制。
   - 前端：`api.ts` `PlazaAdminApi`（list/create/update/remove/uploadImage）+ `isOperatorRole`；
     `screen-library.tsx` `useIsOperator` / `PlazaAvatarForm`。
   - mock/dev 默认开放运营工具便于本地演示；`pnpm typecheck` / `build` / `check:api-contract` / server 编译全绿。

### v0.8（2026-06-09）— 「公开数字人」升级为「数字人广场」（10 个真实样板形象 + 只读 + 另存为）

**目标**：把库里单薄的「公开数字人」tab（6 个无图、无设定的占位）做成真正的**数字人广场**——
10 个不同**风格 / 元素 / 特征**的样板形象，可浏览、可「另存为我的数字人」后再编辑。

**改动**：
- **改名**：库 tab「公开数字人」→「**数字人广场**」（`screen-library.tsx`）。
- **10 个真实公开形象**（`data.ts` `PUBLIC_AVATARS` 6→10，每个带完整 `def` 设定档案 / `palette` 配色 /
  `tagline` / `voiceName`）：商务精英 Annie、居家博主 Christina、播客 Terry、社媒达人 Pamela、
  知识讲师 Marcus、日系 Yuki、二次元星界少女 Selena、赛博机甲 Vex、萌系吉祥物 Cha、新中式国风 Mubai
  （写实 / 二次元 / 赛博 / 3D / 国风混搭，覆盖 pro / life / ugc / community 四类）。
- **每人 3 张形象图**（codex-cli imagegen 生成，存 `public/plaza/PA-XX-{1,2,3}.jpg`，根相对路径，
  mock / live 均由本 app `/public` 直出，server 不托管）：正面定妆 / 右侧 3/4 / 左侧。
- **只读 + 另存为**：广场形象进详情走只读陈列 `MPublicShowcase`（形象图集 + 设定档案，**无任何编辑 /
  生成入口**）；底部主操作由「生成更多资产」改为「**另存为我的数字人**」→ `AvatarApi.saveAs(id)`
  复制为可编辑的 `DH-*` 副本并打开（mock 连图复制；live 复制人设、用户再生成自己的形象）。
- **后端同步**：`DapCatalogService.publicAvatars()` 同形同值扩到 10 + 图片 URL；新增
  `POST /api/v1/avatars/{id}/save-as`（`DapAvatarService.saveAsFromPublic` 复制公开人设为个人数字人）；
  `specs/openapi.yaml` 补 path；`pnpm check:api-contract` / 三端编译全绿。

### v0.7（2026-06-08）— 数字人详情页重构为「作品库」（生成资产统一沉淀）

**痛点**：详情页原「衍生资产」tab 只是个**类型清单**（图集/表情/场景/换装/3D/视频，每类一行 + 「查看」下钻），
生成的真实产物（图/视频）在详情页不可浏览，用户只能去**任务中心**翻历史——不合理。

**改动（仅 `screen-library.tsx`，纯前端）**：
- 详情页 tab 由「标准图集 / 衍生资产 / 版本 / 授权」**精简为 3 个**：**作品 / 版本 / 档案**（默认「作品」）。
- 新增 **`MAssets` 作品库**：把该数字人**全部已生成资产**统一陈列——
  - 顶部分类筛选 chip（`全部 N` + 各有内容的分类带计数 + `＋ 生成`）；
  - 「全部」按分类分区展示作品**缩略图网格**（每区 header：图标 + 名称 + 计数 + 「生成 / 生成更多」；超 6 张折叠 `+N`）；
  - 选中某分类 → 只看该区；选中「图集」→ 复用富交互 `MAtlas`（候选 4 选 1 / 出标准图集）；
  - 视频缩略图带 ▶ 角标，点开进 `MDerivView` 真播放/下载；图片点开进对应分类查看器；
  - **生成中**的分类就地显示进度条（不再「生成完不知道在哪」）；空态引导「生成第一个资产」。
- `＋ 生成` / 空态 → `GenPicker` 选类型 → 复用既有 `DerivConfigSheet` 配置生成；生成完成后递增 `genSeq`
  使作品库重新拉取（`AvatarApi.derivatives` + 计数刷新）。
- 概览统计改为有意义的「版本 / 作品 / 视频 / 更新」。
- 移除旧 `MDerivTab`（类型清单）；`MDerivView` 查看器保留复用。
- 配合 v0.6 永久链接：刷新会停在 `#/avatar/<id>`，作品一直在详情页可达。
- `pnpm typecheck` / `pnpm build` 全绿。

> 数据兼容：作品库优先用 `AvatarApi.derivatives(id)` 的真实产物；mock / 未加载时按 `counts` 出占位缩略图
> （沿用 `Portrait` 占位画像），mock 与 live 一致可演示。

### v0.6（2026-06-08）— 移动端导航与交互打磨（永久链接 / 下拉刷新 / 加载态 / 任务可达 / 文案 / 头像）

按用户反馈做一轮交互打磨，**纯前端（`src/proto/*` + `globals.css`），不改 server / openapi / 契约**：

1. **永久链接 + 前进/后退**（`app.tsx`）：哈希路由随导航实时写回 URL（`#/home`、`#/library`、
   `#/avatar/<id>`、`#/avatar/<id>/<deriv|looks|design|voice>`、`#/tasks` 等）—— 变深 `pushState`、
   同层 `replaceState`；冷启动 / 浏览器前进键 / 粘贴链接按 URL 还原（需实体的覆盖页先拉取再「一次性」
   落 tab+stack，避免还原中途把 URL 覆写坏）。替换原「单哨兵」返回陷阱。
2. **下拉刷新**（`shell.tsx` `AppShell`）：内容区顶部下拉触发 —— 重挂当前屏（重跑挂载期数据拉取）
   + 刷新共享资产；带顶部旋转指示器；仅滚动条在顶部时生效，sheet / 创建向导内不触发（不丢进度）。
3. **加载态**（`screen-library.tsx` / `screen-home.tsx`）：「我的数字人」列表与首页资产 rail 拉取
   后端数据时显示骨架屏（`.m-skel`），不再整页空白 / 误闪「还没有数字人资产」空态。
4. **衍生可达 + 计数修复**：任务中心「查看」按任务的衍生类型直达对应成片（`openDeriv`），不再只回
   资产首页；修复 mock 衍生计数竞态（完成与计数回填同刻发生 → 详情「衍生类型 / 图集」不再恒为 0）。
   配合 #1，刷新会停留在当前资产 / 衍生页，不再「点了生成后找不到」。
5. **文案去黑话**（`data.ts` / `screen-library.tsx` / `screen-real.tsx`）：状态「已入库」→「已就绪」；
   移除资产卡上无功能的「已登记」钢印；真人复刻成功提示「授权凭证已登记」→「肖像授权已保存」。
6. **铃铛 → 任务中心**（`screen-lictaskme.tsx`）：标题「作业队列」→「任务中心」（对齐 data-screen-label），
   首屏说明更口语；「我的」里的入口同步改名。铃铛点开即进入这个后台任务 / 进度列表。
7. **「我的」Tab 头像**（`shell.tsx`）：去掉硬编、与用户无关的「柯」字 —— 改为登录用户名首字（live），
   无登录态则回退通用头像图标。

### v0.5（2026-06-07）— 精调美颜端上化（真实生效：MediaPipe 关键点 + WebGL 实时美颜）

- **痛点**：几何精调原走「滑杆参数 → 英文指令 → Agnes i2i 整图重绘」，细粒度数值指令对扩散模型
  基本无效 / 不可控，且重绘漂移身份、无预览、不可复算。方案调研见
  [`docs/FACE_BEAUTY_RESEARCH.md`](../../docs/FACE_BEAUTY_RESEARCH.md)。
- **新模块 `src/proto/beauty/`**（端上确定性美颜，零新增 npm 依赖）：
  - `landmarks.ts` — MediaPipe Face Landmarker（478 点，WASM，Apache-2.0）运行时加载：
    自托管 `public/mediapipe/**` 优先，jsDelivr CDN 兜底（`NEXT_PUBLIC_MP_ASSETS_BASE` 可覆盖）；
    检测失败 / mock 占位 → 标准构图近似锚点降级（流程不断，角标提示）。
  - `engine.ts` — WebGL1 单 shader：位移场液化（径向缩放 + 定向位移 ≤12 op，5 滑杆 → 人脸锚点
    构建）+ 保边磨皮（色距加权 + 高频回注，限皮肤 mask）+ 美白 + 滤镜调色；画布即原图分辨率，
    导出 `canvas.toBlob`。像素级保身份、确定性可复算。
  - `presets.ts` — 一键美颜三档（轻/标准/重）+ 7 款滤镜（参数式调色，新增滤镜一行配置）。
  - `studio.tsx` — 精调工作台：实时预览（拖动 60fps）/ 按住对比原图 / 精调·美颜·滤镜三分区 /
    应用 → 全分辨率导出上传。
- **创建链路 step3 调整**（`screen-chain.tsx`）：「精确精调」→「精调美颜」（BeautyStudio 实时生效）；
  「自然语言迭代」更名「AI 重绘迭代」（Agnes i2i 保留，定位语义级编辑）。
- **api.ts**：`AvatarApi.imageBlob`（同源取图，规避 CDN 跨域 canvas 污染）+ `AvatarApi.applyRefine`
  （multipart 成品回传）；mock 分支完整（占位画像可演示全流程，应用后 dataURL 落 mock store）。
- **server**（`com.aistareco.aep.dap.*`）：
  - `GET /api/v1/avatars/{id}/image` — 定妆图同源流式输出（owner 校验 + no-store）；
  - `POST /api/v1/avatars/{id}/refine-apply` — 成品图落 `FileStorageService` → 切定妆图 →
    `addVersion("refine")` → `recordLocalDone` 登记已完成作业（mode=local，**零积分**——无引擎成本）；
  - `/avatars/{id}/warp`（Agnes 路径）保留为 legacy，UI 不再调用。
- **自托管资产**：`public/mediapipe/`（~25MB：SIMD/nosimd 双 wasm + face_landmarker.task），
  随仓库提交保证离线/国内可用；`scripts/fetch-mediapipe-assets.sh` 可重新拉取/升级。
- **注意**：生产 CDN 无需为此配 CORS（取图走同源 API）；低端机首次加载关键点资产 3~11MB
  （gzip 后显著小），仅精调页触发且全局单例缓存。

### v0.4（2026-06-06）— 全栈打通：登录 + 真实生成（server dap 领域 + Agnes 多模态）

- **登录门**（live 模式）：新 `screen-login`（手机验证码 / 注册（验证码+激活码）/ dev 体验账号），
  token 持久化 `localStorage.aiavatar_token`，401 全局回登录屏；设置页真实退出登录（带二次确认）。
- **server 端落地**：`com.aistareco.aep.dap.*`（表 `dap_*`，REST `/api/v1/**` 与 `src/proto/api.ts` 1:1），
  账户复用 aep_users + 钱包三段式扣费 + 月度赠送；生成走 Agnes（chat/image/video），未配 key 自动降级占位产物。
- **创建链路全接真**：AI 描述 → 人设解析 + 4 变体真图挑选；上传照片复刻（真实文件选择/预览）；
  真人捕获（真实摄像头 MediaRecorder 录制 → 加密上传 → 核验自动登记授权 → 复刻）；
  5 步向导（生成/迭代/精调/图集定稿/衍生）全部真任务 + 进度轮询 + 失败重试态。
- **资产消费**：详情四 tab 真数据；衍生查看器真图/真视频播放/下载；造型档案轮询；声音克隆真麦克风
  + 采样回放；任务中心真轮询 + 重试/取消；`Portrait` 支持真实图片（占位画像兜底）。
- **mock 模式保留**：`NEXT_PUBLIC_USE_MOCK=1` 时内置任务模拟器，全部流程可离线演示推进。
- **联调工具**（均在仓库根目录执行）：`apps/web-aiavatar/scripts/dap-dev.sh`（人工体验起服，前台 Ctrl+C 停）+ `apps/web-aiavatar/scripts/dap-verify.sh`（一键编译+起服+30 步 API E2E）+ `apps/web-aiavatar/scripts/dev-fake-multimodal-server.mjs`（本地 fake 多模态引擎）。两脚本用 `aep.dap.dev-seed.*` 自动把 DAP_* 端点种进 admin 表，无需手动进后台配置。
- 配套 `next.config.mjs` 增 `/cdn` `/static` rewrites（dev fake-CDN 产物直出）。

### v0.3（2026-06-06）— 去原型化：真实可投产的全屏 H5 应用

- **移除手机壳 / 微信 chrome 装饰**：删掉 iPhone 外框（`.m-device`/`.m-island`）、伪状态栏
  （「9:41」+ 信号/wifi/电量）、伪微信胶囊、伪 home 指示条、桌面「屏幕索引」侧栏。
- `PhoneFrame` → 真实 `AppShell`（`.app-root`）：`position:fixed` 铺满视口、`flex` 纵向布局；
  顶部预留 `env(safe-area-inset-top)`、底部 Tab 与 Sheet 用 `env(safe-area-inset-bottom)` 适配
  刘海屏 / home 指示条；导航栏去掉胶囊让位，左右等距。
- 桌面端把应用居中为一列（`max-width:480px` + 细描边/投影），不是手机模型。
- `layout.tsx`：`theme-color` 改为应用表面色、补 `appleWebApp` standalone 元信息、禁用电话号识别。
- 行为 / 数据 / 屏幕逻辑不变；`pnpm typecheck` / `build` 全绿，dev 实测渲染已无任何手机壳痕迹。
- **细节打磨**：(1) 默认构建引擎切回 **webpack**（规避 Turbopack 在部分环境的 FATAL panic；
  Turbopack 留作 `dev:turbo`/`build:turbo`）；(2) **浏览器/系统返回键**接入覆盖页栈（单哨兵
  `history.pushState`/`popstate`：返回先关最上层覆盖页 / Sheet，根层才离开应用）；(3) 移除首页
  「预览空态」演示开关等原型残留；(4) CSS：`overscroll-behavior:contain` 防滚动链外泄、
  `text-size-adjust` 防 iOS 文字缩放、控件 `user-select:none`、防横向溢出。

### v0.2（2026-06-06）— 前端 API 契约层（所有数据走 api.ts）

- 新增 `src/proto/api.ts`：按规格 §4 补齐全部 REST 端点（9 个命名空间），每个带 `USE_MOCK` 分支
  + `apiFetch`（解包响应壳）+ `useApi` hook（mock 首帧无闪烁）+ `seed` 同步种子。
- 把屏幕里原先内联 / 直读 `data.ts` 的实体（公开数字人 / 应用中心 / 场景库 / 账户）统一收口到
  `data.ts`，并全部改走 `*Api`：屏幕层不再 import `./data`，实体数据一律经 `api.ts`。
- server 端不动；从 mock 切真后端只需 `NEXT_PUBLIC_USE_MOCK=0`。`pnpm typecheck` / `build` 全绿，
  dev SSR 实测实体数据（如「林深」「星岚」）经 api 层正常渲染。

### v0.1（2026-06-06）— 首版落地（移动端原型工程化）

- 按上传规格 + Figma Make 移动端原型 v4 落地 `apps/web-aiavatar`（Next 16 / React 19 / pnpm，port 3013）。
- 移植 18 屏 + 全套 UI 原语 + 手机壳/微信 chrome + V4「清爽」单色青皮肤。
- 领域模型（`src/proto/data.ts`）：Avatar / Look / Derivative / License / Job / BuiltinVoice(7) /
  Account / Application + 8 态状态机 + 5 步创建链路 + 6 类衍生 + 5 张标准图集。
- `pnpm typecheck` 全绿；`pnpm build` 通过（`/` 静态预渲染）；dev server `GET / 200` 实测渲染正常。
