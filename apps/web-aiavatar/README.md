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

### Studio 统一登录（2026-10-10）

Studio 与数字资产共用 AiAvatar 的 OIDC 授权码 + PKCE、`/auth/callback` 和 `aiavatar` 开通记录。
首页登录、画布列表、画布直达链接都走统一账号中心；登录后回到原站内路径（保留查询参数与 hash）。
画布在登录及开通检查完成前不挂载，未开通时显示激活码入口。生产客户端仍为 `web-aiavatar`。

当前本地 Studio 使用 `http://localhost:8098`，在 `.env.local` 配置：

```dotenv
NEXT_PUBLIC_USE_MOCK=0
NEXT_PUBLIC_AUTH_MODE=id
NEXT_PUBLIC_ID_ISSUER=http://localhost:8098
NEXT_PUBLIC_ID_CLIENT_ID=web-aiavatar-local
NEXT_PUBLIC_SERVER_API_BASE=http://localhost:18080
NEXT_PUBLIC_ENABLE_DEV_LOGIN=0
```

从仓库根运行 `python3 infra/scripts/studio-local-identity.py` 启动同级 `../aibuzz-id`。
切换旧进程或更新客户端清单时加 `--restart`。该脚本使用本仓
`infra/local/studio-identity.yml`，明确登记 localhost 与 127.0.0.1 的 3013、3016、3019
回调、退出回跳与浏览器 CORS；仅监听回环地址，强制 dev profile。
本地测试账号为 `dev` / `devdevdevdevdev`（dev 重复 5 次），首次启动由既有 import/admin API 初始化。
账号、UID 和客户端保存到 `.studio-e2e/unified-auth/local-identity/database.mv.db`；
初始化服务密钥自动生成并单独存本机，均不入 Git。重启保留同一账号，不修改产品权限或积分。
当前开发预览入口是 `http://localhost:3016/login?next=%2Fdashboard`（3019 须另行启动对应预览包）。
Studio 后端也须设置 `AEP_ID_ISSUER=http://localhost:8098`
（或启动参数 `--aep.identity.issuer=http://localhost:8098`），受众保持 `aistar-api`。
账号中心重启会结束其本地浏览器会话，重新登录即可；不要改回临时内存库，否则测试账号会丢失。
`NEXT_PUBLIC_*` 在构建时内联，预览生产包必须重新构建后启动。标准独立开发也可使用 8090 + `web-dev`。

> **构建引擎**：Next 16 默认用 Turbopack，但其在部分环境（尤其某些 macOS）会
> `FATAL ... Turbopack ... panic`。因此本 app 的 `dev` / `build` **默认走 webpack**（稳定），
> Turbopack 作为 `dev:turbo` / `build:turbo` 可选项。若仍遇 Turbopack panic：先
> `rm -rf .next` 清缓存再重试，或直接用默认 webpack 脚本。

---

## 屏幕地图（27 屏）

底部 5 Tab：`首页 · 资产库 · ＋创建 · 应用 · 我的`（＋为中间凸起，弹「先选类型再选来源」sheet）。

### AI 数字名片（v0.153 新增 · 公开页）

| 屏 | 入口 | 说明 |
|---|---|---|
| 名片公开页 `/card/p/<slug>` | 扫码 / 转发链接 | **不需要登录、不走开通门** —— 见客户扫码就得能打开。四卷无缝背景纸：纸白首屏 → 青雾「我在做的事」→ 灰白企业与历程 → 深青墨联系。存 vCard 进通讯录；微信内下载被拦时改弹可复制面板 |
| 我的名片 `/cards` | 我的 → 我的名片 | 名片列表 + 编辑 / 复制链接 / 发布 / 取消发布。取消发布后链接立刻打不开 |
| 编辑名片 `/cards/<id>/edit` | 名片列表 → 编辑 | 只编辑首屏会显示的字段 + 联系方式 + 能提供/在找。形象与衣柜由 `from-avatar` 自动带来，不在这里编辑 |

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

### v0.156（2026-09-07）— 修名片建卡断链

「我的名片」空态让人「去挑形象」，挑完形象详情页却**没有任何建卡入口** —— 链就断在这。
名片建卡的唯一起点必须是形象（名字和整柜造型才有得带），所以入口就长在形象详情
`/assets/{id}` 的「数字名片」一节：没卡给「做成数字名片」（建草稿后直接送去
`/cards/{id}/edit`），有卡给「去编辑名片」。两处空态文案也改成真能走通的路。

### v0.155（2026-09-07）— 工作流 → 名片打通（换装条 + 一键建卡 + 编辑表单）

**先修了一个根本缺陷**：名片的形象引用**从来没在读路径上解析过**。`CardService` 连
`DapAvatarRefResolver` 都没注入 —— 文档里只有 `figure.ref`，真建一张卡就是**没有形象**。
演示名片能显示只是因为它写死了 `imageUrl`，正好把这个缺陷盖住了整整两版。

**衣柜**：`CardFigure.looks[]`，每项 `{ref, label}` —— 只存 `look:<id>` 引用，图由服务端
出 wire 时解析。公开页右侧竖排缩略图条，访客点着切换装扮和表情。

- 横排放不下：会压在人脸下沿的溶解带上。竖排贴屏幕右缘，形象居中 340px，两者不打架。
- 解析不出来的那件**从衣柜里摘掉**（服务端做的）—— 切过去一片空白比不给这个选项更糟。
- 标签直接就是工作台的形象卡标题（「日常潮玩装」「表情 · 开心大笑」），不另造一套分类。

**一键建卡** `POST /v1/card/from-avatar`：名字取形象名、衣柜取该形象全部已出图的造型。
用户在工作台已经起过名、跑过一套装扮和表情，不该再填一遍。只建**草稿** —— 发布是显式动作，
一键不能把人的联系方式挂上公网。

**编辑表单** `/cards/{id}/edit`：此前只有接口没有界面，名片实际建不出来。一期只做首屏
会显示的字段 + 联系方式 + 能提供/在找；作品、公司、履历等长内容后置。

### v0.153（2026-09-07）— AI 数字名片公开页（一期 · 只做展示）

方案真源 [`docs/digital-business-card-plan.md`](../../docs/digital-business-card-plan.md)；
三产品整合见 [`docs/ip-ecosystem-integration.md`](../../docs/ip-ecosystem-integration.md)。

**这一期只做三件事**：扫码即看（无需注册登录）/ 形象三档 / 一键存进通讯录。
交换名片、名片夹、字段分层可见挂二期 —— 它们的前提是先有人愿意把链接递出去。

**新增**
- `src/proto/card.ts` —— 类型契约 + Mock + `fetchCard` + `buildVCard`。形象一律以
  `dapDisplayRef` 引用数字资产（`look:<id>` / `deriv:<id>` / `null`=跟随定妆照），
  **名片存引用不存图**，资产改了名片自动跟着变。
- `src/components/card/card-view.tsx` —— 四卷纸 + 换纸渐变带 + 底部溶解的形象 + 复制 / vCard。
- `src/app/card/p/[slug]/page.tsx` —— 公开路由，刻意不调 `useRequireAuth` / `EnrollmentGate`。
- `public/card/demo-*.jpg` —— 演示形象（3D 潮玩渲染），页面底部标「演示数据」。
- `src/app/cards/page.tsx` —— 「我的名片」（主人视角）。`/me` 加入口。

**接真后端（同版）**
- server 新域 `card`（表 `card_profile`，V28）。公开读 `GET /api/v1/card/p/{slug}`；
  写路径 `/mine`、CRUD、`publish|unpublish`、`by-avatar/{avatarId}`。
- `CardApi` 一律走 `apiFetch` —— 手写 `fetch` 会漏掉 `X-App-Code`，`EnrollmentGuard`
  直接 403 `APP_CODE_REQUIRED`。路径必须写字面量：`check:api-contract` 是静态扫描，
  拼接出来的路径（`apiFetch(\`/card${p}\`)`）它读不懂，门会红。
- 资产详情页「被用在哪」并入名片行（`CardApi.byAvatar`），与艺人壳引用、合成出片同一张列表。

**三条实现红线（都是实测踩出来的）**
1. **首屏底色 = `#FFFFFF`**，与形象图的棚拍白同色 —— 图片矩形因此隐形，不靠遮罩硬遮。
   换成开屏视频时同一条规则照用。
2. **形象只做底部溶解**（`linear-gradient` mask），不能用径向遮罩 —— 径向会把帽顶吃掉。
3. **巨号字标是刊头，不压在人身上**。手机上下巴到手之间的干净带只有约 56px，
   压不下 73px 高的字；桌面画布大才有条件把字压在腿上。

**微信里的兜底**：`.vcf` 下载在微信内置浏览器会被拦。检测到微信 UA 时不走下载，
改弹一个可逐条复制的面板并说明「右上角用浏览器打开再存」—— 不让按钮点了没反应。

**门禁**：`typecheck:all` 8/8 · `pnpm --filter @ai-star-eco/web-aiavatar build` 通过
（`/card/p/[slug]` 已在路由表）· `check:api-contract` OK。

**未接后端**：`USE_MOCK=1` 走本地样例。live 模式对应 `GET /api/v1/card/p/{slug}`，
需在 `ProductRouteTable.PUBLIC_GETS` 登记后才可未登录访问；`card_profile` 表尚未建。

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


### v0.201 · 2026-10-07 · 画布历史恢复与云端素材

生成结果重新打开后只能看到最新候选，旧 `adhoc` 运行没有可见入口；「加入我的资产」只写浏览器 IndexedDB，顶部资产页无法找到。新增完整运行历史（30 条分页）、最近 50 个画布内容版本与恢复入口、云端画布素材（图片/视频/文本）。历史成图与提示词可恢复到画布，无须重新生成或扣费；新运行另保留原始指令。项目卡自动从本人图片取封面。

V39 新增 `ip_project_revision` / `ip_saved_asset`，项目文档 TEXT 扩为 LONGTEXT，与既有 2MB 上限一致。版本与当前文档同事务，PUT 行锁串行检查指纹；素材按本人内容幂等，owner 行锁防并发重复。只保存 key，读取重签；删除素材条目不删除被文档/历史共用的原件。旧浏览器中有本人 key 的素材迁移到云端，未能确认归属的文本/data URL 不自动导入。

离开画布的导航先等待保存，保存失败留在画布并允许重试；在途失败不自动再次发 PUT，避免无限重试和错误基线。节点内容同步提前到 layout effect，候选图加载失败强制重签一次并给出明确重试入口。版本记录从更新后开始；旧操作不能凭空补造，既有生成记录直接可查。

接口：`GET /api/v1/ip-studio/projects/{id}/runs?page=0`；`GET projects/{id}/history`；`GET projects/{id}/history/{revisionId}`；`GET|POST /api/v1/ip-studio/saved-assets`；`DELETE saved-assets/{id}`。恢复整版沿用项目 PUT 与 `baseDocVersion`。运行历史、版本与素材均只允许属主访问。


### v0.202 · 2026-10-08 · 统一 Studio（未发布）

新增 `src/ip/studio-workspace.tsx` 与 `studio-node-content.tsx`，复用 vendor canvas 的节点和 render slot。bridge 的 `studio-api/nodes/script/save` 承接接口、结果采用、实际脚本输入与保存闸；样式沿用 `.ip-surface` 令牌及 `html[data-layout]`。新增剧本编辑、故事板、成片、IP 引用、主形象/造型采用与任务恢复，不新建应用或第二画布。

粘贴与局部改稿、候选比较、参考快照、跨项目复用、旧发布人物关联与 DapAssetUsage 作品回流均已接入。`signed-video.tsx` 失败时只自动重签一次，再提供人工重试。Studio CSS 在应用 layout 静态导入，避免动态组件热更新丢样式；375px 顶栏由作用域规则紧凑排列，设备选择仍由 data-layout 决定。首版 M0–M4 已通过真实 Agnes 主链与本地平台账本验收；主链 126 + 画幅回归 30 积分，真实成片 720×1280 / 15.168005 秒，下载一致。

M6 增加 `studio-assistant/batch-panel` 和 bridge 的 `studio-batch`：四模式对话、本人节点上下文、可编辑计划与缺失引用提示，分集与顺序执行共用原生任务。请求在收费提交前保存，恢复复用原键，暂停只停止后续步骤。真实双集各有独立成片；商品入口、只读声音/驱动目录与明确时间段字幕包装属于 M5，聚算固定音色和配音成片已接通，X-Dub 同音频口型短样片通过；人物固定声音版本绑定已接通，专属声音仍未接，详见后两节。

验证环境均为 NEXT_PUBLIC_USE_MOCK=0、隔离后端 18080：已有样例时 fixture=true，真实 Agnes 时 fixture=false；两种记录分别保留。测试数据/截图/成片在 `.studio-e2e`，媒体在 `.studio-fixtures`，不入 Git。验证命令和结果见 `docs/ip-studio-unified-canvas-validation.md`。标准模板方案在 `docs/ip-studio-workflow-template-plan.md`；当前仅清理模板/示例的作者任务、采用身份、对话和批准痕迹，M7 参数化版本与资产包尚未实现。


### v0.202 配音增量 · 2026-10-08（本地验收通过，代码未发布）

Studio 新增固定音色配音节点、试听/下载、刷新恢复和成片采用配音。供应商为聚算 `qwen3-tts`，后台用途 `DAP_AUDIO`，9 个官方预设音色，正文最多 600 字、风格最多 160 字。新增 `GET /api/v1/ip-studio/studio/speech-catalog`、`POST /api/v1/ip-studio/projects/{id}/speech-runs`；仍以 IpRun 保存唯一任务，不新建任务或资产身份副本。V41 为两个用途 ENUM 添加 DAP_AUDIO，保留已有绑定；迁移必须先于用途配置。

平台按明确配置的单次配音价格校验 maxCost、冻结和结算；供应商按实际音频秒计量，两者分开。持久化原请求与 Job，afterCommit 派发，Idempotency-Key=runId，已受理任务重启只查询，超时不新建任务；音频鉴权下载、实际格式检查后转存 key，短期地址与到期换签。合成可用 `packaging.voiceoverStorageKey` 替换原轨，先验本人归属；长于成片拒绝，不截断台词。

真实 Vivian WAV 3.52 秒与带中文包装的 5.066016 秒成片通过，新增 8 积分、pending=0，恢复/重放不重复扣费。线上仅登记 Qwen3 TTS 端点，Studio 代码和 DAP_AUDIO 绑定仍待发布，生产售价未定。固定预设音色不代表专属声音克隆或数字人口型驱动完成。详见 `docs/ip-studio-unified-canvas-validation.md` §11。


### v0.202 口型增量 · 2026-10-08（本地短样片通过，未发布）

Studio 口型同步采用聚算 `x-dub`：选择本人 MP4 人物片段与已生成 WAV，先按真实音频秒向上取整报价，再确认生成。单独后台用途 `DAP_LIP_SYNC` 与 V42，平台明确配置每秒积分；本地测试为 10 积分/秒，生产售价未配置。只上传已选两份素材，原生请求仅 `model/input_video_asset_id/input_audio_asset_id`，不混入通用视频的提示词、时长或清晰度参数。输入/原 Job/checkpoint 保存在同一 IpRun，已受理后只查原 Job，同 Key 鉴权下载保留 `model=x-dub`。预检为 MP4、15–60fps、128MiB；WAV、最多 60 秒/25MiB，配音不得长于视频。成功转存真实视频后同事务结算，失败释放原冻结。

结果另存片段，先检查再采用。X-Dub 此次返回左原片/右口型的对照；“提取口型片段 · 免费”在画幅及左侧与源片 SSIM 匹配后取右侧，保留对照版本，不调供应商、不改输入或账本，重复提取返回同一文件。采用口型片段显式排除原片；合成保留该片段的原音轨。任务列表可定位画布结果。

真实小紫卡通 IP + 原 Vivian WAV 3.52 秒完成，原口型结果 1408×1280/25fps、提取为 704×1280，中文包装成片 720×1280/3.540998 秒。新增 40 积分，提取/合成 0，同键恢复/提取重放没有新增扣费，pending=0；浏览器下载与我方文件一致。详细证据见 `docs/ip-studio-unified-canvas-validation.md` §12。仅证明短样片闭环与可见嘴部变化，未量化音素同步质量或长口播。人物固定声音版本绑定后续已接通（验证记录 §13），专属声音克隆仍未接通；本次未修改线上绑定，代码未提交、未发布。

### v0.202 人物声音版本增量 · 2026-10-08（本地真实验收通过，未发布）

官方预设声音现可归属于人物：在完成的配音节点选择“设为人物声音”，保存音色、风格与真实试听，生成不可变版本，并明确设为默认；保存和切换免费。配音入口可选人物与历史声音版本、播放试听，已选择的版本锁定音色与风格。修改风格需要使用临时固定音色，再显式保存新版本；临时配音不改默认，旧任务继续使用原版本。

复用 `DapVoice(kind=preset,engine=qwen3-tts)`，新增 `profileVersion/stylePrompt/sourceRunId`；`DapAvatar.voiceId` 为默认声音的精确引用，新增 V43，不修改旧迁移，不给旧采样伪造训练状态。来源必须是本人当前项目成功的 studio-audio；音色/风格/试听来自服务端任务，人物行锁、expectedVoiceId 与唯一(avatar_id,source_run_id) 防止覆盖和重复采纳。采纳重放返回原版本，不将当前默认切回旧版本。试听只存 key、实时签名；画布只保存声音版本和 key 的快照。

新增 `GET /api/v1/ip-studio/studio/voice-profiles`、`POST /api/v1/ip-studio/projects/{id}/adopt-voice`、`PUT /api/v1/ip-studio/studio/performers/{avatarId}/voice`。TTS 请求可带 avatarId/voiceId，服务端校验本人、同人物、就绪、音色与风格一致；输入保存 appliedVoice 快照，已受理任务复用原请求正文。原请求兼容新增空字段的旧指纹，重放先于当前配置检查。成功配音与原积分结算同事务记录声音在项目的使用，不建立第二份任务或声音库存。

真实“小紫 · 自然声 v1”使用 Vivian 与“自然明快，像朋友一样介绍。”，原试听 3.52 秒；同版本新台词生成 WAV 4.96 秒，唯一新增消费 8 积分。v2 以新台词为试听，保留同一官方音色/风格；v1/v2 采纳重放、默认切换及原任务重放没有新增账本记录，旧任务仍是 v1。两版本均能在画布查看和试听，当前默认切回 v1。证据见 `docs/ip-studio-unified-canvas-validation.md` §13。专属声音克隆、长口播和生产整体发布验收仍未完成。


### v0.203 · 2026-10-08 · Studio 模板发布版本与输入表单（本地通过，未发布）

沿用 IpDemoTemplate/IpTemplateResolver，增加个人与官方可见范围、不可变 IpTemplateVersion（V44）及 Project.templateVersionId。本人在同一画布配置图片/IP、文字或选项输入、图片步骤、依赖、尺寸、输出角色和采用确认点；个人模板仅本人可见，官方发布仍需超级管理员。模板发布只按白名单重建配方与画布，作者媒体、历史候选、任务、身份、对话和批准不进入版本；旧接口不能覆盖版本模板或删除历史发布，旧模板和项目保持兼容。

用户先填自己的真实图片或精确 IP 图片版本，使用平台当前 DAP_IMAGE 配置预览逐步费用，再免费创建独立画布。每份实例重建 node/connection id、保留自己的输入并锁定来源版本；模板更新后旧画布不跟随变化，下架阻止新套用，旧画布仍可恢复创建时计划。发布与套用均不启动模型、不冻结积分；生成任务仍走原生 IpRun/账本。新增本人模板停用/启用、来源版本与创建时计划查看。商品入口同步修复仅引用旧人物图片时漏显示驱动/声音状态，多人物引用不猜默认出镜人。

M7.1 验收：两个不同人物输入分别建立独立画布，8 图片配方按当前单价报价 64 积分，v1/v2 锁定、停用阻止新建、恢复与作者私有素材清理通过，账本零变化。M7.2 的依赖执行/人工采用暂停/单步恢复与 M7.3 中文展示板/资产包归档尚未完成，八张图片尚未生成；不能将准备好的画布标为成功资产包。验证记录见 `ip-studio-unified-canvas-validation.md` §14。

### v0.204 · 2026-10-08 · 图片模板执行与一次人物设定图（本地，未发布）

有限图片配方复用原生 IpRun/账本，支持依赖、人工采用、逐步费用上限、单步指令调整、显式 CAS 重做和同键恢复；原任务/候选保留，上游变化标记过期，不自动重跑。未知受理结果不能修改原正文后重新提交。画布文档仍由客户端维护，执行指针和模板来源由服务端维护。

进阶模板可免费将采用且未过期的原图打包为 ZIP（来源清单）与可读中文展示板；部分选择明确显示 n/总数。主形象与人物造型显式归档，归档/打包重放复用原结果。本人版本统计派生自原生任务实际费用和采用状态，不含全平台指标。真实进阶样例14次生成/112积分、同请求恢复零新增扣费、pending=0；六张通过并在浏览器完成6/8部分资产包下载，两张仍因侧视角/面部风格未通过，不称完整成功。

按用户澄清，默认旗舰模板改为一个 `sheet` 图片步骤，一次生成一张包含人物档案、三视图、表情、面部/服装细节、配饰与材质配色的设定图。整图继续供图像参考，先生成单独镜头再做视频；独立资产/拼板为可选进阶流程。提示词见 `docs/prompts/ip-character-sheet.md`，按用户附图编写，不称作者原词。本地个人模板与独立实例只验证一张/8积分报价、零生成/零扣费；一次成图质量及整图参考出镜头尚待真实验收。代码与新增表尚未生产发布，详情见 `docs/ip-studio-unified-canvas-validation.md` §15。


### v0.205 · 2026-10-08 · IP 人物库与功能验收（本地，未发布）

画布入口改为“IP 人物库”，以人物为单位汇总主形象、历史、设定图、特写、表情、视角、服装细节和声音。对标 Chrome 中实际观察的小云雀角色库：搜索与分类 → 人物详情 → 选择具体素材 → 添加到画布。缺少素材显示未添加，人物属性只读取既有设定，不猜测。引用保存精确人物/图片版本/lookId/key 与默认声音版本，保存失败可恢复；已归档造型继续保存为人物素材。

V45 为 DapLook 增加可空 assetRole；免费分类接口只修改本人同人物的已完成造型类别，不改主图、版本或积分。旧请求缺此字段仍按旧指纹恢复，避免重复归档。模板结果在画布打开时恢复，计划关闭期间原任务仍继续更新，无需打开制作计划才找回图片。

用户明确本轮验收聚焦界面交互、功能逻辑与 LibTV 创作动线，图片美观及人物一致性不作为功能通过条件，不为改善效果反复生成。一次设定图已通过原生任务受理、结果返回与恢复；浏览器采用、人物sheet归档、跨画布整图引用和一次真实镜头生成均通过，原请求恢复没有新增费用。历史画质观察保留为模型效果备注，不阻塞已实现功能的验收。模板仍为有限图片配方；高级视频模式、专属声音克隆及生产发布不在已完成范围。详细交互与持久化证据见 docs/ip-studio-character-library.md 和 docs/ip-studio-unified-canvas-validation.md §16。

### v0.207 · 2026-10-08 · Studio 创作首页（本地，未发布）

登录首页与创作中心共用 Studio 主要功能入口、近期画布及模板；想法正文先保存，再打开对应面板，保存失败沿用原项目。保留群青/麦黄品牌与原资产业务。详情见 [首页实现](../../docs/ip-studio-home.md)。

模板人物选择使用明确内容浮层容器，避开固定/隐藏顶栏；确认/取消恢复同一表单的输入和焦点。桌面、375×812手机及原画布人物库验证通过，本轮没有提交模型生成。

### v0.206 · 2026-10-08 · 画布界面与人物选择统一（本地，未发布）

按 impeccable 修复画布生成面板、节点操作、创作工具和缩放区域的重叠；参数按容器宽度换行，输入/提交及取消返回可达。人物库、画布添加、节点参考、创作要求、商品人物和模板输入共用 StudioIpLibrary，保留精确素材/版本与默认声音快照。节点引用后连接并返回原输入，模板输入改变使旧计划失效。人物卡片不再随高度压缩，手机人物确认固定底栏。见 [审查与验证](../../docs/ip-studio-ui-audit.md)。


### v0.209 · Studio 助手引用（本地，未发布）

`studio-assistant-context.ts` 管理 @ 查询、引用上限与 UTF-8 故事导入；`studio-assistant.tsx` 保持显式节点 ID 引用，恢复历史请求模型和上下文，复用原任务重查路径及共享 overlay 容器。故事成为普通 Text 节点，先经 `saveStudioDocument` 落库再提交。仅支持 TXT / Markdown，媒体理解和其他文档格式未接；见 `docs/ip-studio-assistant-context.md`。

### v0.208 · Studio 视频模式（本地，未发布）

画布原生节点与 Studio 视频面板复用实际视频模型能力：首尾帧角色、全能参考编号、清晰度/画幅/时长/种子和费用上限。模型合同来自 `/v1/ip-studio/studio/video-models`，非支持模型维持文字/一张首帧。见 [实现与验证边界](../../docs/ip-studio-video-modes.md)。

### v0.210 · Studio 多候选视频（2026-10-08，本地未发布）

画布原生视频参数与 Studio 视频创作均选择 1/2/4 条并显示整批费用；同一幂等请求绑定多个通用视频 Job。逐条状态与比较窗口保留失败候选、旧采用版本和成功结果，只有成功候选能被采用。刷新恢复原批次，网络未知不重建。实现和验收范围见 `docs/ip-studio-video-modes.md` 与统一验证 §21；本轮不新增收费生成，运镜/特效预设和长视频仍未接通。

### v0.211 · Studio 运镜输入标签（2026-10-08，本地未发布）

`src/ip/studio-motion-prompt.tsx` 为共享目录与选择器，三种视频输入复用；vendored chip input 仅扩展通用命名指令、光标、编辑、移除及纯文本剪贴板。完整提示词仍是唯一持久化与提交真值，不增加后端/API或供应商相机参数。浮层阻断画布事件，搜索挂载时聚焦，运镜入口在输入正文前保持手机可发现。文档与验收见 `docs/ip-studio-camera-motion.md`、统一验证 §22；本轮新增收费生成0、未发布。

### v0.212 · Studio 视频特效描述库（2026-10-08，本地未发布）

`src/ip/studio-effect-library.tsx` 与 `src/canvas-bridge/effect-api.ts` 供原生/展开/抽屉共用，完整提示词重建命名指令。异步目录更新按序列化文字偏移恢复光标，Modal `afterClose` 后插入避免焦点约束；原生模型名称先经 `endpointIdFor` 映射真实 ID。`VIDEO_GENERATION` 候选负责模型白名单，V46 建描述与账号活动表；四个接口挂 `/api/v1/ip-studio/video-effects`。个人发布私有、不可变、只存本人图片 key，收藏和最近独立持久化。手机卡片行按内容高度、保存表单固定返回/保存且字段滚动，仍读 `html[data-layout]`。没有新供应商任务/收费，原生效果与完整社区目录未接。见 `docs/ip-studio-video-effects.md`、统一验证 §23。

### v0.213 · 特效点选与替换（2026-10-08，本地未发布）

原位、展开和右侧抽屉均点卡片直接选用；独立详情和收藏不改正文。替换已识别特效时保留其余正文、运镜、参考与模型，自定义改写仍为用户正文；抽屉取消与刷新恢复可用。前端43文件327项、构建和类型检查通过，本轮无收费生成。超长视频依赖的供应商模式仍未接入，不能称全量LibTV对齐。见 `docs/ip-studio-video-effects.md`、统一验证 §24。

### v0.215 · Studio 助手画面读取（本地，未发布）

助手增加图片/短视频四帧读取开关，按后台 `textModels.supportsVision` 开放，历史恢复 `readVisuals`。文字模型明确关闭，音频只读取文字设定；新对话过滤选中的对话/计划节点。真实调用一次、2积分，视频主体描述通过，三色图未有效回答；请求与计费幂等通过，不反复验图。335项全前端与最终18项助手专项、36项后端、构建/类型/契约通过。见助手文档与统一验证§26，本地未发布。

### v0.214 · PDF / Word 故事导入（2026-10-08，本地未发布）

studio-api.importStudioStory 用FormData调用 POST /v1/ip-studio/projects/{id}/story-import；Java StudioStoryImportService 提取PDF、DOC、DOCX正文，项目归属先验、原文件不落库、不建任务、不计费。TXT/Markdown保留本地UTF-8读取，客户端文档仍拥有可编辑Text节点。8MB / PDF100页 / 24000字上限；DOCX解压内容有上限。PDFBox 3.0.8与POI 5.5.1固定在pom，依据[PDFBox官方文档](https://pdfbox.apache.org/3.0/getting-started.html)与[POI文字提取文档](https://poi.apache.org/text-extraction.html)。本地7项后端、332项前端、构建、类型与契约通过；见统一验证§25。

### v0.216 · Studio 统一附件（2026-10-08，本地未发布）

助手“添加附件”共用本地上传/素材库两条入口，支持图片、MP4、音频和故事多选，逐项报错保留成功项和草稿，保存失败可独立重试且不重传、不启动付费消息。现有云端画布素材库增加audio，搜索/筛选/多选后引用普通节点；已有同key/同正文节点复用。音频可试听、加入我的资产和再引用。免费media-import先验本人项目和实际字节/时长/编码/像素，再计aiavatar存储；上限详见助手文档。实际验收四类文件及损坏PNG、刷新五节点、音频试听/保存，运行0，钱包账本不变。345前端/22后端、构建/类型/契约通过。音轨/完整连续视频理解、Skill/分享和超长模式仍未接通，见统一验证§27。

### v0.217 · Studio 对话快照分享（2026-10-08，本地未发布）

助手历史旁“分享”仅在完成一轮对话后开放。先保存画布并预览服务端白名单文字快照，再明确创建链接；任何获得链接的人可匿名查看对话和创作建议。V47 新增 `ip_conversation_share` / `ip_conversation_copy`，不修改原画布、素材和积分。24字节随机 token，同内容发布幂等；更新快照撤销旧链接，撤销和源画布删除使公开读取失效。公开 GET 仅豁免精确路径，返回 no-store/noindex；复制和管理保留登录、aiavatar 开通、手机绑定及本人归属检查。

快照不含源节点、素材 key/URL、请求、模型、任务或账号字段，原参考绑定替换为重新选择提示。公开页“在 Studio 中继续创作”将文字与建议复制到本人新画布，创建新节点 ID并直接打开助手，无媒体和执行请求，未自动生成；同 owner/clientRequestId 幂等，浏览器 session 保留复制键以供失败/刷新重试。复制内容仍需显式选择本人参考素材、模型并确认费用。分享后新增消息不会自动公开，未发送草稿不进入快照。

这是 Studio 自有分享闭环；LibTV 当前可见“空对话不能分享”入口，但调研账号无历史，本轮未为探测弹窗调用模型，不能宣称其分享表单的所有行为逐项一致。公开画布与复制、社区展示仍是独立待办。验收见统一验证§28。


### React Flow 当前配音与成片草稿（本地未发布）

商品模板输入可选画布或商品库已有图片，并预览实际人物/商品。配音节点保存未提交的正文、风格与人物声音版本；成片方案节点按分集保存比例、包装、字幕和配音，关闭编辑器等待云端保存，刷新可继续。原请求确认失败保留原身份，同地址换签也重新加载媒体。商品模板→图片/视频人工采用→真实配音→合成下载已本地闭合，见统一验证 §32；局部改写及拆镜草稿保存分集范围，刷新后继续原范围；双集恢复和独立成片方案已确认（统一验证 §33）。后续原创/改编及新画布连续制作见 §34，图片视频工具见 §35；整画布分享按用户要求暂缓，未提交部署。


### v0.218 · 剧本原创/改编与连续制作（2026-10-09，本地未发布）

剧本面板明确区分原创与故事改编，可选择画布文字或已编辑剧本作为素材；提交时保存其当前正文快照，原稿保留。创作设定增加最多三种融合题材、人物关系与叙事结构，生成后的编辑器共用同一设定表单。设定修改只影响后续改写与拆镜，不改原受理请求，并提示既有下游内容需要重新制作。文本请求沿用已选模型；新可空字段不破坏旧请求幂等。

连续制作可选择图片/视频模型及画幅，确认步骤与费用上限后按序执行。已有采用首帧被替换时必须重新确认；计划及输出自动避开已有节点。弹窗内容滚动、确认/暂停固定在底部。暂停只停止后续提交，刷新从原请求继续。实际验收见统一验证§34。

用户明确暂不做整画布分享/复制，本轮保留个人画布发布为模板及新输入套用；不据对话分享推定已实现公开画布。

### v0.219 · 新画布图片/视频工具收尾（2026-10-09，本地未发布）

选中图片或视频后可直接下载当前采用版本，复用同源素材原件及字节判断后缀；裁剪、拆图、局部重绘自动避开已有节点。局部重绘保留原图，先保存标记/连接，再确认模型、候选数量与费用；新界面真实两图候选、第二版采用/刷新/下载已闭合。视频四模式、帧交换、编号参考、实际合同参数与整批报价使用同一面板；混合候选状态复用隔离交互样例、不新增供应商视频。证据与本地交付边界见统一验证 §35，个人模板保留，整画布分享暂缓。

### v0.220 · 模型接入端点并发与排队（2026-10-09，本地未发布）

后台为每个模型接入端点配置生成任务并发上限，同一端点跨用途共用额度。Studio 任务中心显示「排队中 · 有空位后自动开始」，等待时可以停止并释放原冻结积分；已提交的视频继续查询原任务。队列持久化，等待不计入执行超时，不触发新模型请求或重复收费。配置、覆盖入口和恢复边界见 [端点队列说明](../../docs/ai-endpoint-generation-queue.md)，验收见统一验证 §36；本轮没有付费生成或手机适配。

### v0.221 · 排队序列与实时位置（2026-10-09，本地未发布）

任务、画布节点和制作计划显示同端点实时排队序号，使用「排队提醒：当前模型请求量较高，你目前排在第 N 位。」；复用原任务每 1.2 秒轮询更新位置，取消后立即清除排队并继续更新后续任务。每条视频候选独立排队；开始执行切回真实进度。请求中断提示重试，保留原任务身份；不猜预计时间或重新提交。队列由服务端票据投影，节点 metadata 仅为展示缓存。见统一验收 §37。


### v0.222 · Studio 屏幕层浮窗（2026-10-09，本地未发布）

- `src/ip/studio-floating-panel.tsx` 统一无蒙层节点/工具浮窗，portal 到 `data-studio-floating-root`，不进入 React Flow 的缩放层。`StudioFloatingContext` 随视口/节点变化重新定位，ResizeObserver 处理容器尺寸，不使用定时 DOM 轮询。
- 节点单击分发创作、普通文字或完成剧本预览；选择参考期间 `studio-reference-mode` / `studio-reference-selected` 保持原目标。人物库返回只恢复选择，不 fitView。工具栏透明空隙 `pointer-events:none`，可见子控件恢复命中，避免挡住节点拖动。
- 助手默认可拖动且停靠显式选择，任务/制作计划共存逻辑由工作台管理。异步面板提交/保存用 session guard，旧 A 完成不能关闭新 B。文字和剧本大编辑器仍为显式展开。
- 助手 `AssistantDraft` 仅为内存中的项目/对话 UI 草稿，不改已受理 request；历史切换前保存，提交后清除相应缓存。创作/助手/配音 footer 固定，正文单独滚动。原运行、计费、队列、模板 API 未改。
- 分批回归覆盖 72 个不同前端用例，最后定向助手/配音 29 项通过；类型、API 契约通过。实页参考、隔离本地项目和截图见统一验证 §38。没有新增收费生成或生产部署。

### v0.223 · 节点命令与浮层上下文（2026-10-09，本地未发布）

`studio-node-command.ts` 在泛型媒体之前解析助手/计划/成片业务节点，单击、双击、右键编辑与旧 editor 命令共用。口型入口捕获 `lipOriginId`，不再读取变化中的 selected；口型输入按 projectId/打开对象初始化，固定 footer 保存原提交键与费用流程。

`studio-video-references.ts` 将有效输入映射为按媒体类型编号的提示词引用，并按 nodeId 同时重绑换序标签。删除被引用素材写入明确待修正标记，按钮禁用；已受理 request 保持原样。浮层按舞台维护有界层级，指针/焦点置前，只有活动浮层响应 Esc；chip input 仅做一处带注释的 Escape 冒泡修正，引用/IME 仍拦截编辑键。

本轮 88 个不同定向用例通过，最后工作台 43 项与输入 11 项通过；类型/API 契约通过。浏览器用既有本人视频/WAV 免费预估，未新增生成。剧本编辑器本体留到 Markdown 专项。见统一验证 §39。

### v0.224 · 全屏 Markdown 剧本与同屏 AI 改稿（2026-10-09，本地未发布）

`src/ip/studio-script-editor.tsx` 是屏幕尺寸的聚焦文档任务，`studio-script-markdown.ts` 负责框架、旧 script 序列化、标题/分集校验及下游投影；`studio-markdown-preview.tsx` 安全渲染常用 Markdown，原始 HTML 不执行。原节点保存 `scriptMarkdown` 与 `scriptEditor` 草稿/历史/原请求/建议稿；结构化 script 服务人物、场景、道具与按集拆镜。完整整稿建议需显式采纳；手改冲突不自动覆盖，失败保存不推进确认基准。同终态 run 重投影不能回退手工文档，pending 改稿不能被复制或删除，复制完成节点清来源执行绑定。

`StudioRunRequest.scriptEdit.markdown` 仅用于 assistant，1–48000 字，消息保持 4000 字前端限制；`StudioScriptRevision` 在 hold 前检查路径，worker 在结算前校验五章节/唯一分集与完整 JSON，输出 `IpRun.output.scriptRevision {summary,markdown}`。继续复用配置提示词、文本端点、队列、幂等/限价及 afterCommit；普通 assistant 的 plan 输出不变。已知 runId 只查原任务，未知提交复用原请求键。

本轮真实 Agnes 一次 2 积分，API 同键/双集/提案持久化通过；类型/API、定向交互及集成检查见统一验证 §40。前端页面 HTTP 200，浏览器 CUA 服务连续超时，视觉截图尚未验收；未提交或发布。剩余 LibTV 差距以对齐文档顶部最新矩阵为准。

### v0.225 · Tiptap 剧本富文本（2026-10-09，本地未发布）

`src/ip/studio-script-rich-editor.tsx` / `src/canvas-bridge/studio-script-rich-extensions.ts` 替换自写 Markdown 源码编辑及预览器，使用 Tiptap 3.31.4 官方 React、StarterKit、Markdown 和 TableKit。Next.js 下 `immediatelyRender:false`，编辑/建议稿共享 schema，HTML 粘贴走 ProseMirror 过滤。Markdown 持久化/API 保持既有合同；加载与外部采纳不触发假编辑，撤销回导入文档还原原始字符串，防止仅排版归一化误判 AI 冲突。基础表格支持行列操作，不支持合并格及复杂富媒体。结构标题读取可见文字，支持强调、下划线及转义文字，原格式与偏移不改；后端改稿输出验证同样识别可见标题。`web-drama` 显式锁定原 2.27.2 core，隔离新3.x依赖。共71个不同前端用例（业务42、富文本12、改稿10、解析7）分批通过，收尾标题修复仅重测相关19项；后端改稿合同4项、两应用类型检查通过。桌面视觉与真实保存详见 §41。

### v0.226 · 文档自身的目录（2026-10-09，本地未发布）

新增 MIT 官方 `@tiptap/extension-table-of-contents@3.31.4`，从当前编辑器真实标题生成锚点和层级；修改、新增、删除、撤销自动更新，重复标题用 ID 定位。当前稿与只读建议稿各自维护原生目录，导航不切换版本。左侧删除固定框架/分集投影，制作操作移至右侧素材。锚点初始化不计入编辑历史，也不重写原 Markdown；后台/API 与任务计费不变。24 项定向测试与类型检查通过，UI 保存/重开与服务端重读已验，详见统一验证 §42。


### v0.227 · 文档优先布局（2026-10-10，本地未发布）

用户否定 v0.226 的独立全高目录侧栏。标题导航现在属于富文本正文，消费官方原生锚点；默认文档优先，AI/设定/素材按需打开。重复版本工具条删除，格式工具合入顶部；只读建议保留显式版本与采纳。25 项定向测试和类型检查通过，桌面与实际窄桌面证据见统一验证 §43；原用户草稿保留，无新增模型调用，未部署。

### v0.228 · Studio 供应商积分计价与上线收尾（2026-10-10）

按用户确认，新增配音、口型同步暂以 1 聚算积分 = 1 平台积分，加 50% 溢价；人民币换算后续统一调整。配置 `ipstudio.supplier-point-pricing` 分开保存供应商每秒积分、换算比例和溢价，不混用端点的人民币微元字段。先对供应商计费秒数向上取整，再对整笔平台积分向上取整，避免每秒取整造成额外溢价。生产确认成本前不开放模型，旧验收单价不作为正式售价。

配音按正文 Unicode 字符数 + 10 秒（上限 600 秒）确定并显示预冻结上限，生成完成按实际音频时长结算、退回剩余冻结；这是一笔消费上限，不是时长预测。极端慢速音频超出上限则明确失败并释放冻结，不追加扣费。口型同步按已解码驱动音频时长报价。任务保存完整定价快照，重启恢复、同键重放和后台调价不改变原请求；已受理旧任务保留旧快照兼容。

正式发布覆盖后端、AiAvatar 和管理后台；保留个人画布发布模板，整画布分享仍暂缓。发布前已完成生产数据库/旧服务备份，隔离 MySQL 8.0.46 上 V39→V48 九项迁移与重复启动零迁移检查；正式部署与线上验收事实记录在 `docs/ip-studio-production-release.md`。

### v0.229 · 连线引用恢复（2026-10-10）

React Flow 补回拖线到空白处的“引用该节点生成”菜单，文本/图片/视频选择后建立新草稿及真实输入连接并打开创作浮层；连接已有节点可落在节点内容区。连线剪刀、键盘操作、撤销与保存刷新闭环，断开引用同步更新创作面板。上游文字使用最新富文本稿拼入生成请求，不修改已受理任务。代码在 `src/ip/studio-flow-canvas.tsx`、`studio-connection-create-menu.tsx` 与 `src/canvas-bridge/studio-linked-inputs.ts`，文档 wire 不变。H3 首帧上传故障为生产端点 10443 连接超时，已验证标准 HTTPS 上传并修正配置，无新视频任务；验收及发布事实见统一验证 §44 与生产发布记录。


### v0.230 · 账号与旧 Studio 界面统一（2026-10-10）

桌面 `/me` 改为账号总览，使用工作台顶栏、Studio 色彩和统一账号导航；任务、会员与积分、存储、真人授权素材、回收站、设置与安全共用同一内容区，去掉旧 Studio 的 480px 手机取景框。已有业务接口和流程继续复用，没有另建账号真值或改计费。

旧 `/studio`、`/#studio` 入口转到自由画布，旧首页/资产库/我的/授权入口映射到现有页面；账号工具保留 hash 深链。菜单、选中状态、内部跳转及浏览器前进后退同步，创建参数和真人确认回调原样保留。正式模式不展示静态演示订阅套餐；充值读取现有后台套餐，加载、空列表和失败重试可见。详见 `docs/aiavatar-account-unification.md`。任务中心仍展示资产生成任务，画布任务沿用各画布历史；不宣称旧业务模块全部重写。

#### v0.230 追加 · 顶栏可用积分（2026-10-10）

桌面右上角展示 `/api/me/wallet` 的 `totalBalance`，点击进入会员与积分。可见窗口每 15 秒及页面切换/恢复焦点时刷新，隐藏窗口停止轮询；不含冻结余额。读取不调用旧 AccountApi，不触发月度赠送；加载为“—”，错误明确并可重试，只有服务端明确“钱包尚未开通”才按 0 展示。4 项刷新/切号/失败定向用例与真实本地余额、模拟零值/大数字/错误、桌面视觉和编译门通过，无充值或模型提交。

### v0.231 · 模板直接打开个人画布副本（2026-10-10）

官方与个人模板统一点击即复制到个人画布，取消进入前的输入/模型/报价表单。`StudioTemplateUse` 只负责免费创建和打开，React Strict Mode/重渲染复用同一次请求，失败可返回或重试。模板目录文案同步；普通节点使用现有创作浮层、参数、计费与任务逻辑，不新建模板执行入口。已有锁定版本的旧实例仍可按原任务恢复。

`IpTemplateResolver` 按请求人解析个人模板，`StudioTemplateCanvasCopy` 从不可变版本复制独立节点/连线、文字默认值和图片/视频规格；将配方文字变量落成真实文本连线，不携带任务锁或作者私有素材。保存只修改个人副本，原模板不变；发布自己的模板仍保留。缺参考图、必填文字和选项不匹配在所连节点提交时提示，不在进入画布时阻止。验证与发布事实见统一验证记录和生产发布记录。

### v0.232 · 模板只读预览与显式个人副本（2026-10-10）

官方模板点击后先打开只读画布，浏览、缩放和查看节点提示词不创建项目。仅点击“存为个人副本”免费创建一份普通可编辑画布；保存中禁用重复提交，失败保留预览并由用户重试。首页、画布列表与画布内模板库共用这条路径，个人发布模板也按不可变来源预览。预览不挂载项目同步或生成工作台，不能拖动、增删、改写节点及连线；沿用现有节点样式和画布浮层查看设置。个人副本继续在节点内替换输入、编辑和确认生成费用，原模板不变，旧锁定实例保持兼容。本规则替代 v0.231 的“点击即创建”入口。
