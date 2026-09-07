# web-ipstudio — AI IP 工作台

桌面端无限画布：上传一张照片 → 挑一套内置工作流 → 稳定产出一组**同一人物、同一风格**的 AI IP 形象 →
发布成 AiAvatar 数字资产（`DapAvatar` + `DapLook`），供音乐 / 短剧 / 带货各线引用。

设计真源：[`docs/ip-studio-plan.md`](../../docs/ip-studio-plan.md)（本 app 实现 §2 / §5 / §6 前端侧）。
产品与界面约束：[`PRODUCT.md`](PRODUCT.md)。
**视觉系统（配色 token / 语义映射 / landing 与画布边界 / 素材规则）：[`design.md`](design.md)** ——
改任何颜色前先读它。色值的代码真源**只有** `src/styles/tokens.css`；`src/styles/app.css` 用
`@theme inline` + `var()` 别名指过去、不复制 hex，所以改色只动 `tokens.css` + `design.md`
两处。字体是唯一例外（`@theme` 里必须写字面量，见 design.md 开头）。

## 启动

```bash
# 仓库根目录
pnpm install
pnpm dev:ipstudio          # → http://localhost:3015

pnpm --filter @ai-star-eco/web-ipstudio typecheck
pnpm --filter @ai-star-eco/web-ipstudio build
```

首次本地跑先复制环境变量：`cp apps/web-ipstudio/.env.example apps/web-ipstudio/.env.local`。

## Mock / 真后端切换

| 变量 | 值 | 行为 |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | `1`（默认，`.env.local`） | 全部数据走 `src/mocks/ip-studio.ts`：2 套模板 / 6 套风格 / 2 个样例项目 + **本地运行模拟器**（约 3 秒推完进度，产出占位候选图）。零网络，无需起后端。占位产物一律带「示例 / MOCK」角标。 |
| `NEXT_PUBLIC_USE_MOCK` | `0` | 走 `apiFetch` → `next.config.mjs` rewrites → Spring Boot `/api/v1/ip-studio/**`。 |

切换只需改这一个变量：`src/api/ip-studio.ts` 每个函数顶部 `if (USE_MOCK)` 分支，路径与
`docs/ip-studio-plan.md` §4.2 / `specs/openapi.yaml` 一一对应（`scripts/check-api-contract.mjs` 守门）。

其他变量：

- `NEXT_PUBLIC_SERVER_API_BASE`（默认 `http://localhost:8080`）
- `NEXT_PUBLIC_AIAVATAR_URL`（默认 `http://localhost:3013`）—— 发布成功后「去数字资产平台查看」的基址

## 技术栈

- Next **16.2.6**（App Router / Turbopack）+ React **19** + TypeScript 5.7
- Tailwind **v4**（运行时 CSS 变量在 `src/styles/tokens.css` = 色值单一真源；
  `src/styles/app.css` 用 `@theme inline` + `var()` 别名把调色板指过去，不复制 hex；
  文档真源 [`design.md`](design.md)）
- 画布：**`@xyflow/react` 12**（React Flow，MIT）
- 状态：**zustand**（`src/lib/canvas-store.ts`，doc + 有界撤销重做 60 步）
- 共享层：`@ai-star-eco/{types,ui,api-client,landing}`
- 图标：`lucide-react`
- 端口 **3015**；登录与开通共用 **aiavatar**（`requiredPlatform="aiavatar"`，`X-App-Code: aiavatar`）

## 目录

```
src/
├── api/ip-studio.ts            # IpStudioApi：§4.2 全部端点 + awaitRun 轮询（1.5s / 10min 上限）
├── mocks/ip-studio.ts          # USE_MOCK 内存实现（模板 / 风格 / 样例项目 / 运行模拟器）
├── lib/
│   ├── canvas-store.ts         # 画布状态（doc 唯一写入口）+ 撤销重做 + 运行投影
│   ├── graph.ts                # 上下游查找 / 拓扑序 / 连线合法性 / 缺失输入预检（纯函数）
│   ├── node-meta.ts            # 7 种节点的中文名 / 图标 / 默认数据 / 错误码与阶段的中文翻译
│   ├── selection.ts            # 「定稿」候选解析（可能来自更早一次运行）
│   └── flow-types.ts           # React Flow 节点 data 类型
├── components/canvas/
│   ├── canvas-shell.tsx        # 画布页主体：加载 / 自动保存 / 运行编排 / 发布
│   ├── node-shell.tsx          # 档案卡外壳（7 种节点共用）
│   ├── nodes/*.tsx             # 7 个自定义节点组件
│   ├── inspector/*.tsx         # 右侧属性面板（按节点类型分发）
│   ├── palette.tsx             # 左侧节点面板（拖 / 点两种添加方式）
│   ├── topbar.tsx              # 工作栏：项目名 / 保存状态 / 积分 / 撤销重做 / 运行全部 / 发布
│   └── publish-dialog.tsx      # 发布对话框 + 成功态（DH- 编号 + 去 AiAvatar 查看）
├── components/landing/
│   └── atlas.tsx               # landing 作品图集裁切器（4×3 等格 → background-position 选格）
└── app/
    ├── page.tsx                # 公开 landing（英雄 / 灵感画廊 / 未来应用方向 / 关于 / 收尾 CTA）
    ├── login/ · auth/callback/ # 登录（legacy 表单 / 账号中心 OIDC 双轨）
    └── (workspace)/projects/   # 列表 + [id] 画布（params 是 Promise，server 壳 await 后传给客户端）
```

## landing 素材

landing 的人物与场景图全部来自**一张图集**（**4 列 × 3 行、等格无间距、每格 1:1**），
由 `src/components/landing/atlas.tsx` 用 `background-size: 400% 300%` + `background-position`
选格，代码不做图像处理。格位对照表与红线（禁止 SVG / 色块冒充作品图、场景区必须标注
「场景示意」）见 [`design.md`](design.md) §8。

**生产真源是 OSS 上的绝对地址**（AGENTS.md §4.7，资产不入 git）：

```
https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/ipstudio/landing/character-atlas-v1.png
```

`atlas.tsx` 里的 `ATLAS_SRC` 直接引用它，因此 **fresh clone 不需要任何本地图片，
`pnpm dev` / 生产构建都能完整显示**，`build-release.sh` 也不必额外带图。

`public/landing/` 只是**可选**的本地开发回退副本与设计留档，已 gitignore、不入库，
而且**不会被自动使用**（没有实现任何自动 fallback）—— 想改用本地那份，临时把 `ATLAS_SRC`
改成 `/landing/character-atlas.png` 即可。换图流程：按同样 4×3 网格重新导出 →
发新版本号的 OSS 对象（`-v2` …）→ 改 `ATLAS_SRC` 一行。

## 版本日志

### v0.152（2026-09-06）— landing 重构 + 双主色视觉系统

- **配色真源新增 [`design.md`](design.md)**：低饱和群青 `#495B91`（深至 `#344B70`）/
  麦黄 `#E7D58D` / 纸白 `#F5F4EF` / 墨 `#202C42`。分工固定：群青 = 品牌顶栏 + 选中态 +
  进行中；麦黄 = 主动作；工作台保持浅色工作面。首版的单一青色 `#12B3DE` **整体退役**
  （`src/` 内已无该色值）。
- `src/styles/tokens.css` 全量重写并成为**色值单一真源**；`src/styles/app.css` 的调色板走
  `@theme inline` + `var()` 别名（不复制 hex，字体除外），另加 landing 专用 utility
  （`paper-tag` 麦黄纸标签 / `paper-tag-light` / `atlas-cell` / `tilt-a…c` / `.hero-collage`）
  与 `prefers-reduced-motion` 降级块。`public/icon.svg` 一并换到新色系（图形结构不变）。
- **公开 landing 全量重构**（真实 HTML/CSS，非截图）：群青英雄区（麦黄纸标签 kicker +
  **三行麦黄大标题** `clamp(64px,6.5vw,104px)` + 麦黄 CTA + 一张大竖主卡与两张小竖侧卡的
  **重叠拼贴**）→ 灵感画廊四表情（`#gallery`）→ 未来应用方向 2×2 场景（`#scenes`）→
  商业化展望麦黄横幅（顶栏「关于 IP Studio」锚 `#about` 落这里）→ 收尾 CTA。
  容器 `max-w-[1440px]`；响应式（重叠拼贴与旋转只在 ≥768px 生效，移动端两列摆正防溢出）、
  锚点可用、`scroll-padding-top` 避开粘顶栏；**`useAuth` 跳转逻辑一行未改**。
  **landing 上不放产品工作流 / 技术说明段**（`design.md` §10）。
- 新 `src/components/landing/atlas.tsx`：单张 4×3 图集按格裁切（`role="img"` +
  `aria-label`）。两种裁切 —— `AtlasFrame`（1:1 整格）与 `AtlasPortrait`（竖幅：外框立起来、
  内层那一格仍 1:1 按高度铺满并水平居中，只裁左右空白，头脚完整、不跨格、不拉伸）。
  格位契约见 `design.md` §8。
- **画布同步换肤**（逻辑零变更）：画布工作栏与工作台品牌栏转深群青（前景走 `--on-blue*`
  四档，保存四态在群青上都 ≥4.5:1）；发布 / 运行 / 重新加载 / 登录提交等主动作转麦黄；
  选中 / 定稿 / 锁定 / 运行中仍是群青；点阵与 MiniMap 直接吃 `var(--line-3)` /
  `var(--line-2)` / 新 token `var(--canvas-mask)`，画布组件里不留写死色值；图上信息条与
  序号角标改用新 token `var(--img-chip)`（替掉裸 `rgba(255,255,255,…)`）。
- **属性面板字号提级**（评审）：可编辑输入 / 主按钮 / 属性说明 ≥ 14px（输入与按钮 `h-10`），
  辅助字段标签 `.field-label` 12px、编号 `.reg` 11px、等宽提示词 13px；说明文字去掉
  `line-clamp`，长文靠换行。画布内节点字号不动（由画布缩放承担）。
- 状态色重挑：`--ok/--warn/--err/--info` 在白面与自身 `*-soft` 底上都 ≥4.5:1（原值在 soft
  底上只有 4.0–4.2）；`--ink-3` 由 `#8A96A1` 收紧到 `#626D82`（纸白上 4.7:1），
  `--ink-4` 明确降级为「只做装饰、不承载文字」。`--ink-3` 在 `--surface-3` / `--primary-soft`
  上余量不足（实测表见 `design.md` §2），这些位置换 `--ink-2`。
- 共享组件（`EnrollmentGate` / `IdCenterLoginScreen` / `AuthCallbackScreen`）的 theme
  改传 `var(--accent)` / `var(--accent-fg)`，主按钮随主动作一起变麦黄。
- 素材纪律：图集已按 §4.7 上生产 OSS 并由 `ATLAS_SRC` 直接引用（fresh clone 即可完整显示）；
  `public/landing/` 仅可选本地副本，gitignore、不入库、不自动启用。
- 门禁：`typecheck` + `vitest 26/26` + 生产 `build`（6 路由）+ `check:api-contract` 全绿；
  **无 server / openapi / 节点结构 / doc-runs 契约变更**。
- 浏览器评审第一轮（Codex）改判并已落实：删掉 landing 的四步链路 / 技术说明段（连
  `metadata.description` 一起改成 slogan 口吻）；英雄区标题由两行 62px 改三行
  `clamp(64px,6.5vw,104px)`；三张小方图改成竖幅重叠拼贴且纸标签定位到各自卡片（原先挂在
  栅格单元格上会被拉长导致标签悬空）；纸标签由纸白改**麦黄**（麦黄块上用纸白变体
  `paper-tag-light`）；纠正「SVG 不能解析 var()」的错误注释并把画布色值全换回 token；
  属性面板 10/10.5px 说明字提到 ≥14px。
- 浏览器评审第二轮收尾：`app.css` 的 `@theme` 改 `@theme inline` + `var()` 别名（色值单一
  真源落在 `tokens.css`，字体因与 `@ai-star-eco/ui` 的 `--font-sans` 冲突仍需两处字面量）；
  `public/icon.svg` 换新色系；撤掉 `tokens.css` / `node-shell` / `canvas-shell` /
  `basic-inspectors` / `generate-inspector` 与 design.md 里那组算错的对比度数字，改为
  只在 design.md §2 维护 Codex 复测的实测表（`--surface-2` 4.69 / `--canvas` ≈4.7 都过；
  只有 `--surface-3` 4.28 / `--primary-soft` 4.21 差一点），现有更深的文字色不动。

### v0.151（2026-09-06）— 首版

- 新子应用落地：项目列表（模板新建 / 空白画布 / 删除）+ 无限画布（React Flow 12）。
- 7 种节点：照片 / 人物特征卡 / 风格 / 形象卡 / 生成 / 参考图 / 发布，档案卡外观沿用
  AiAvatar 的 Atelier Ledger（衬线只给资产名、等宽只给编号、单一青色只给主操作与运行中）。
- 「效果稳定」的前端面：特征卡锁定、主形象唯一（切换即转移）、候选择优选图、
  **本次实际提示词**与**参考图生效情况**（未生效给中文原因，如「参考图超出模型上限，已按优先级省略」）、
  逐次花费如实展示。
- 运行：单节点运行 / 取消；「运行全部生成」按拓扑序执行 —— 主形象未定稿时只跑主形象并提示先选图，
  已定稿则依次跑其余形象，任一失败即停（不继续消耗积分）。
- 保存：doc / 项目名变化防抖 1.2s `PUT`，顶栏显示 编辑中 / 保存中 / 已自动保存 / 保存失败可重试，
  离开前 `beforeunload` 兜底；运行与发布前都会带上最新 doc，避免「先 PUT 再 POST」竟态。
- 撤销重做：60 步有界历史 + `⌘Z` / `⇧⌘Z`（输入框内不拦截）。
- 发布：选主形象 + 勾选造型 + 资产名 → 成功展示 `DH-` 编号与「去数字资产平台查看」。
- 工程登记：`pnpm-workspace.yaml` / 根 `package.json`（`dev:ipstudio`、`typecheck:web-ipstudio`）/
  `.claude/launch.json`（3015）/ `scripts/check-api-contract.mjs` 扫描根。
- 类型契约真源：`packages/types/src/ip-studio.ts`（server DTO 字段名与之 1:1）。

## 生产部署

| 项 | 值 |
|---|---|
| 域名 | `https://ipstudio.aibuzz.cn`（80 → 308 跳 HTTPS，共用 `*.aibuzz.cn` 泛域名证书） |
| systemd 单元 | `aistareco-web-ipstudio`（`/opt/ai-star-eco/web-ipstudio`，监听 `127.0.0.1:3015`） |
| 运行期 env | `/etc/aistareco/web-ipstudio.env`（模板 `infra/env/web-ipstudio.env.example`） |
| nginx vhost | `infra/nginx/ipstudio.aibuzz.cn.conf.example`（80）+ `ipstudio.aibuzz.cn.ssl.conf.example`（443） |

发布：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=<本机私钥> \
  ./infra/scripts/deploy.sh web-ipstudio
```

⚠️ `NEXT_PUBLIC_*` 是 Next 的**构建期内联**值 —— 包括发布成功链接用的
`NEXT_PUBLIC_AIAVATAR_URL`。改 `/etc/aistareco/web-ipstudio.env` 不生效，
必须在 `infra/scripts/build-release.sh` 打包时带上（该脚本已内置默认
`https://aiavatar.aibuzz.cn`）。

登录走**统一账号中心** `https://id.aibuzz.cn`（2026-09-06 起）：客户端 `client_id=web-ipstudio`
（公开客户端 · 授权码 + PKCE），回跳 `https://ipstudio.aibuzz.cn/auth/callback`。因此发布必须带上
构建期的 `NEXT_PUBLIC_AUTH_MODE=id NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`
（`build-release.sh` 默认是 `legacy`，不带就会退回本仓登录页）：

```bash
NEXT_PUBLIC_AUTH_MODE=id NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn \
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=<本机私钥> \
  ./infra/scripts/deploy.sh web-ipstudio
```

完整背景与登记清单见 [`infra/README.md`](../../infra/README.md) §5.1 / §5.4。
