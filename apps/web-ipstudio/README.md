# web-ipstudio — AI IP 工作台

桌面端无限画布：上传一张照片 → 挑一套内置工作流 → 稳定产出一组**同一人物、同一风格**的 AI IP 形象 →
发布成 AiAvatar 数字资产（`DapAvatar` + `DapLook`），供音乐 / 短剧 / 带货各线引用。

设计真源：[`docs/ip-studio-plan.md`](../../docs/ip-studio-plan.md)（本 app 实现 §2 / §5 / §6 前端侧）。
产品与设计约束：[`PRODUCT.md`](PRODUCT.md)。

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
- Tailwind **v4**（`@theme` 令牌在 `src/styles/app.css`，设计令牌在 `src/styles/tokens.css`）
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
└── app/
    ├── page.tsx                # 公开 landing
    ├── login/ · auth/callback/ # 登录（legacy 表单 / 账号中心 OIDC 双轨）
    └── (workspace)/projects/   # 列表 + [id] 画布（params 是 Promise，server 壳 await 后传给客户端）
```

## 版本日志

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
`https://aiavatar.aibuzz.cn`）。登录当前是 legacy 模式：web-ipstudio 尚未在统一账号中心
注册 `client_id`，切 `NEXT_PUBLIC_AUTH_MODE=id` 前需先完成注册与 CORS 登记。

完整背景与登记清单见 [`infra/README.md`](../../infra/README.md) §5.1 / §5.4。
