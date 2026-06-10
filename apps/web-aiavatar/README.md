# AiAvatar · 数字人资产平台（web-aiavatar）

> 移动端 H5 / 微信小程序形态的「数字人资产平台」。真人授权复刻 / 纯 AI 原创两条创建路径，
> 形象 · 声音 · 衍生物（图集 / 表情 / 场景 / 换装 / 3D / 运镜视频）一站式沉淀为可复用资产，
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

## 屏幕地图（18 屏）

底部 5 Tab：`首页 · 数字人 · ＋创建 · 应用 · 我的`（＋为中间凸起，弹路径选择 sheet）。

| 屏 | 入口 | 说明 |
|---|---|---|
| 首页 | Tab | 悬浮轮播 + 「我的数字人资产」横滑 + 空态引导 + 开始创作大卡 |
| 数字人库 | Tab | mine / public · 搜索 / 分类筛选 / 网格切换 |
| 资产详情 | 卡片 | 形象设定 def / 标准图集 / 衍生物 / 版本 / 授权 + 音色 pill |
| 造型档案 / 设计造型 | 详情 | final 造型列表 + AI 设计造型（描述 / 场景库替换） |
| 衍生查看 | 详情 | 某类衍生物多张产出（图集 / 场景 / 3D 可旋转 / 视频可播放） |
| AI 创建 | 创建 sheet | 上传照片 / 文字描述 → 四宫格挑选 → 推荐音色 → 保存 |
| 真人捕获 | 创建 sheet | 录制引导 → 倒计时录制 → 身份核验 → 选音色 → 保存 + 授权 |
| 创建链路（5 步） | 真人 / 继续 | 素材&授权 → 形象生成 → 调整（自然语言 / 几何精调）→ 出图定稿 → 衍生 |
| 选择音色 | 详情音色 pill | 内置 7 款 AI 合成音色（女 4 / 男 3）· 试听 · 设为默认 |
| 声音工作室 / 声音克隆 | 我的 | 内置音色 + 我的声音 + 克隆录制 |
| 授权登记 | 我的 | License 按状态筛 · 下载凭证 / 续签 / 签署 |
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
  `JobApi` / `LicenseApi` / `CaptureApi` / `AccountApi` / `AppApi` / `SceneApi` / `TemplateApi`），
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
