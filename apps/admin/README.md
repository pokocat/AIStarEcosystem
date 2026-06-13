# apps/admin — AI Star Eco · 运营后台

> 本期（v0.5）聚焦 **AI 明星带货线** 的运营能力。其他产品线（数字人 / 数字 IP / 音乐 / 影视 / NFT / 社群）的页面仍在 `app/` 中，但 sidebar 已隐藏（`enabled: false`）。

## 启动

```bash
pnpm install
pnpm dev:admin      # http://localhost:3003
pnpm typecheck:admin
pnpm --filter @ai-star-eco/admin-new build
```

环境变量（`.env.local`）：

```
NEXT_PUBLIC_API_BASE_URL=/api          # 浏览器侧 API base；填 https://api.aibuzz.cn 也会自动补 /api
NEXT_PUBLIC_USE_MOCK=0                 # 0 跑真后端；1 用 mocks/ 静态数据
```

## 端口对照

| 服务 | 端口 |
|---|---|
| `apps/server`（Spring Boot） | 8080 |
| `apps/admin`（本应用，Next 16 / React 19 / pnpm workspace） | **3003** |
| `apps/web`（带货方用户端） | 3002 |
| `apps/miniprogram`（小程序） | — |

## 登录

`AdminAuthController` 在 `/api/admin/auth/login`，平台运营账号走 `/api/admin/auth/operator-login`：

```bash
curl -s -X POST localhost:8080/api/admin/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jq .data.token
```

DataInitializer 默认 seed 两个账号：

| username | password | role |
|---|---|---|
| admin    | admin123    | SUPER_ADMIN |
| operator | operator123 | OPERATOR |

> v0.5：`AdminRole` 在 admin TS 已与 server enum 大小写对齐为 `SUPER_ADMIN | OPERATOR`。
> v0.42+：登录后可在 `/profile` 修改自己的后台登录密码；该入口同时兼容 `admin_users` 与 `AepUser.operatorRole` 两套后台账号来源。

## 当前可用菜单（v0.5 sidebar enabled = true）

- **平台账户**：账号 / 经纪公司、秘钥批次、**后台管理员**（v0.32 新增，仅 SUPER_ADMIN）
- **AI 艺人**：生命周期、艺人档案
- **明星带货** ★（重点）：明星档案、模板、**模板脚本**、**授权关系**、**引擎价格**、带货项目、商品库
- **财务**：结算中心、**充值订单**（v0.56：核准入账 / 驳回）、**充值套餐**、异常风控
- **分发**：分发渠道、发行队列
- ~~基础数据~~（v0.59 起整组隐藏：积分包页已删 —— 与「财务 · 充值套餐」重复；其余子项本就隐藏）
- **平台与配置**：**AI 模型与 Key**（v0.41 合并）、**Prompt 管理**（v0.40 新增）、**Agent 平台**、平台配置
- **消息与日志**：消息中心（v0.58 起为真实运营收件箱：充值下单/取消、新用户激活等业务事件实时入箱）、审计日志

## 隐藏的菜单（v0.5 sidebar enabled = false，URL 直访仍可用）

- AI 作品（数字人产品线）：歌曲、专辑、演唱会、短剧、电影、广告、配音、版权
- 变现 / 社群（数字人产品线）：数字藏品、社群活动、互动审核
- 基础数据中：曲风/造型库/姿态库/锻造预设

> 切回需要时改 `apps/admin/src/constants/nav.ts` 中对应组的 `enabled` 即可。

## 关键页面（v0.5 新增）

- `/celebrity/stars`（既有；v0.62 起仅查看 / 新增 / 删除 —— 档案「编辑」移交明星商务工作台 web-star `/profile`）
- `/celebrity/templates`（既有，CRUD 待补 v0.6）
- **`/celebrity/template-scripts`**（v0.5 新增）— 模板脚本列表 / 状态推进 / 试跑
- **`/celebrity/star-authorizations`**（v0.5 新增）— 用户 × 明星 授权 CRUD + 状态机推进
- **`/celebrity/engine-pricing`**（v0.5 新增）— 引擎价格表
- **`/finance/recharge-orders`**（v0.56 新增）— 充值订单核销：用户下单 → 运营线下收款后「入账（经不可变账本）/ 驳回（填原因）」
- **`/finance/recharge-packages`**（v0.5 新增）— 充值套餐 CRUD（软删）
- **`/platform/ai-models`**（v0.5 起；v0.41 合并「LLM 网关 Key」）— 双 Tab：模型接入端点（上游密钥+单模型+地址，含网关 Key）/ AI 应用绑定

## 与 server / web / miniprogram 的契约

- Types：`apps/admin/src/types/*` 与 `apps/web/src/types/*` **逐字段一致**（admin-only 扩展用 `Admin*` 命名）
- Server DTO：字段名严格匹配 TS interface
- Endpoint 全集：`specs/openapi.yaml`，`pnpm check:api-contract` 守门

## 版本日志

- **v0.59 / 2026-06-10**：①`/platform/accounts` 账号「停用 / 恢复」接真链路 —— `api/users.ts` +`suspendUser/reactivateUser`（POST `/admin/users/{id}/suspend|reactivate`，停用原因必填写入审计日志 `admin.user.suspend|reactivate`）；页面改 `useConfirm` + toast 模式，删掉无 onConfirm 的 ActionDialog 与「查看」死按钮；server 侧短信登录补停用闸（403 ACCOUNT_DISABLED，此前停用账号仍可短信登录）。注意：已签发 JWT 到期前仍有效（无状态边界）。②消息中心侧栏未读角标（`badgeKey: notif_unread`，与页面同源 `listNotifications` 数 `viewedAt == null`）。③删除 `/base/credit-packs`（与充值套餐重复 + 全死按钮），连带删除独占的 api/mocks/types settings 文件，「基础数据」组整组隐藏。详见 VERSION_HISTORY.md v0.59。
- **v0.58 / 2026-06-10**：①消息中心真实化 —— 改为**运营收件箱**（server 只列 `__admin__` 行；充值下单/取消、新用户激活由 `NotificationPublisher` 实时写入，audience 标注关联账号）；「全部标记已读」接通 `POST /admin/notifications/read-all`；删除假的「标为未读」切换（已读不可逆，已读行显示已读时间）。②结算中心（`/finance/ledger`）流水补全 —— 账号列显示 昵称+登录名+用户ID（server DTO 直接回填 `username/displayName`，删除 500 条上限的客户端 join）；余额/统计全部精确值（不再 "433.1K" 近似）；时间全部精确到秒；「导出对账单」真实现（CSV / UTF-8 BOM / 原始整数）；删除无后端的「复核通过/驳回」假按钮（充值核准在「财务 · 充值订单」页），业务交易「处理中」= 积分 hold 冻结中（跟随 CreditHold 状态）。详见 VERSION_HISTORY.md v0.58。
- **v0.57 / 2026-06-09**：`/platform/auth-logs`（账号登录日志）新增「来源应用」列 + 筛选下拉，区分登录来自哪个子应用（music / drama / celebrity / aiavatar / celebrity-mp 小程序 / admin）。数据来自各前端注入的 `X-App-Code` 请求头 → server `AuditLog.appCode` 列。`types/audit.ts` 增 `appCode` + `APP_CODE_LABEL/KEYS`；`api/audit.ts` 两入参增 `appCode`；admin 自身 `api/_client.ts` 注入 `X-App-Code=admin`。老数据无来源 → 显示 "—"。详见 AGENTS.md / VERSION_HISTORY.md v0.57。
- **v0.53 / 2026-06-07**：`/platform/licenses` 秘钥批次按子应用拆分。批次表新增「适用范围」列（全站可用 / 子应用徽章）；新建批次弹窗新增「适用子应用」多选 chip（music / drama / celebrity / aiavatar，不勾选 = 全站）+「自定义单包点数」（覆盖等级默认，支持「仅 aiavatar · 发 1000 积分」类批次）。`types/account.ts` 增 `SubProduct` / `SUB_PRODUCT_LABEL_ZH` + `AepUser.platforms`；`types/license.ts` `LicenseBatch.platforms`；`api/licenses.ts` `CreateBatchInput.platforms`。对应 server `LicenseBatch.platforms` 列 + 激活按批次授权（详见 AGENTS.md v0.53）。
  同日第二批（三端对齐审计治理）：`/celebrity/operators` 新增「平台访问」列 + 平台编辑弹窗（PATCH /admin/aep-users/{id}/platforms，仅 SUPER_ADMIN）；`/celebrity/engine-pricing` 动作单价表分两组并新增数字人平台（dap）12 行（0 = 走部署默认价，>0 覆盖立即生效）；`/platform/prompts` KEY_LABEL 补全 16 keys；selling-channels API 入参改用 `SellingChannelUpsertInput` 镜像。详见 `docs/ADMIN_ALIGNMENT_AUDIT.md`。
- **v0.42 / 2026-05-30**：admin 升级到 Next 16.2.6 + React 19，纳入根 pnpm workspace；新增 `/profile` 个人设置页（当前身份 + 自助改密），后端新增 `POST /api/admin/auth/change-password`；修复 Topbar / 登录页 render 期间读取浏览器环境造成的 hydration mismatch；全局错误通知接入 API 失败、未处理 Promise、脚本错误和 App Router error boundary。
- **v0.41 / 2026-05-29**：合并「AI 模型」+「LLM 网关 Key」两个菜单为一个「AI 模型与 Key」（`/platform/ai-models`，删 `/platform/llm-keys`）。改为三 Tab：①**模型接入端点（含 Key）**—— 固定 {上游密钥 + 单模型 + 地址} 的 CRUD + 测试连接 + 获取模型列表选固定模型 + 生成/撤销网关 Key（`sk-aep-*`，明文一次横幅）+ 计费归属用户（空=平台级不计费）；②**AI 应用绑定** —— 7 个用途各一个端点下拉（脚本起草 / 卖点提取 / 变量抽取等），一用途一端点、无兜底；③**用量统计** —— 时间窗下拉（近 1/7/30/90/365 天）+ 4 个汇总数 + 按端点 / 按模型两张占比表，数据来自 server 自建 token 流水聚合（`GET /api/admin/ai-models/usage`，不依赖各家计费接口）。对应 server `AdminAiModelEndpointController`（+`/{id}/mint-key`、`/{id}/revoke-key`、`/usage`）+ `AdminAiAppBindingController`（`/api/admin/ai-app-bindings`）。`api/ai-models.ts` +`getUsage`/`getProviderUsage`/绑定函数；`api/llm-keys.ts` + `LlmKeysApi` 删除。
- **v0.40 / 2026-05-29**：新页 `/platform/prompts`（平台与配置组「Prompt 管理」）。素材运营文本三件（脚本起稿 / 卖点提取 / 变量抽取）的 system + user 模板在此管理：system/user 双 textarea + params（temperature / max_tokens / json 模式）+ 启用开关 + 试运行（填充预览，不真调模型）。对应 server `AdminPromptController`（/api/admin/prompts）+ `prompt_template` 表。`/platform/ai-models` 的可选 purpose 加「卖点提取 / 变量抽取」，可把 provider 路由到这两类用途。`/celebrity/engine-pricing` 动作单价表加「AI 脚本起稿」一行（积分/单稿，0=不计费），运营设单价即开启起稿计费。
- **v0.39 / 2026-05-28**：新页 `/platform/agent-bots`（平台与配置组「Agent 平台」）。
  接入 Coze 等 agent 平台 bot 做「形象锻造」这类场景：CRUD + 场景下拉（一个 sceneKey 对应一个 bot）+ token 加密存储（仅显示脱敏值）。server 端 `ForgeCozeService` 改为按 sceneKey 从后台配置取 bot，env 兜底；不再 env 写死。
- **v0.38 / 2026-05-28**：`/platform/ai-models` 大模型配置增强。
  - 顶部「快速添加」内置常见服务商预设（火山方舟 / Kimi / DeepSeek / 千问 / OpenAI），选中即填好 baseUrl / 默认模型，补 API 密钥即可建档。
  - 编辑表单新增「可用模型」区：点「获取模型列表」调 `discover-models`（新建）/ `fetch-models`（已存，用落库密钥）从服务商拉取模型，点选设为默认模型，保存写入配置。
  - 列表新增「模型数」列 + 顶部搜索框（名称 / 编号 / 地址 / 模型）。server 端不再 seed 占位 provider（删除 `AiModelProviderDataInitializer`），完全配置化。
- **v0.32 / 2026-05-25**：
  - `/platform/licenses`「新建批次」按钮接入弹窗（名称 / 发证方 / 等级 / 数量 / 有效期）；批次行追加「铸码」按钮 → `/api/admin/license-batches/{id}/mint-keys` 一次性返回明文激活码 + 复制/保存弹窗。
  - 新页 `/platform/staff` — admin_users CRUD（列表 + 搜索 + 角色筛选 + 新建 + 编辑 + 重置密码 + 停用 + 删除）。
  - server `/api/admin/staff/**` 收紧为 `hasRole("SUPER_ADMIN")`（之前与其他 admin 端点同样 hasAnyRole）；sidebar nav 同步 `roles: ["SUPER_ADMIN"]` 门控。
  - 顺手修复 `useAdminRole` 角色大小写归一化（server `AdminUserDto.role` 是小写 `super_admin`，admin 前端约定 `SUPER_ADMIN`；之前 role-gated 菜单对真实超管也是隐藏的，所以 v0.30 的 error-logs gate 实际只在 USE_MOCK=1 时生效）。
  - server `DataInitializer.seedSampleKeys` 在 dev 首启时把明文激活码用 WARN level 打印到日志（含「⚠️ DEV-SEED LICENSE CODES」横幅 + 批次名 + 单包点数）；不再「有码但拿不到明文」。
- **v0.31 / 2026-05-24**：商品库 CRUD + 抖音链接建档 + 刷新图片全部收归 admin（`/celebrity/products`）。
  顶部新增「从抖音链接建档」/「新建商品」；行内新增「编辑」/「刷新图片」；server 端
  `/api/products/**` 收紧为「已登录用户只读」，写动作走 `/api/admin/products/**`
  （hasAnyRole SUPER_ADMIN/OPERATOR）。详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.31。
- **v0.5.4 / 2026-05-09**：文档收敛（角色名 `SUPER_ADMIN/OPERATOR` 与代码对齐；删 4 个过期总规；新建 `docs/INDEX.md`；引入「文档同步纪律」段）。
- **v0.5.3 / 2026-05-09**：小程序近实时同步（多层轮询 + 业务关键点 trigger）；admin 无变更。
- **v0.5.2 / 2026-05-09**：Bot 消息从硬编码改为按需查询（拉模式，零事件总线）；admin 无变更。
- **v0.5.1 / 2026-05-09**：消除小程序硬编码 + 通知系统真正接通（`/me/messages-overview` / `/celebrity/dictionaries` / `/celebrity/jobs/{id}` / `/notifications/conversations/{botId}/read-all`）；admin 无变更。
- **v0.5.0 / 2026-05-08**：明星 / 模板 / 授权 / 套餐 / 引擎价 / 模板脚本 / AI 模型 全栈 admin CRUD；sidebar 聚焦明星带货线。详见 `product_spec_ai_celebrity.md` v0.5 节。
- **v0.4.0 / 2026-05-07**：server 端用户侧接口打通（小程序和 server 双端跑通）；admin 维持 GET-only。
- 之前版本：见 `product_spec_ai_celebrity.md`。

- **v0.66**：新增导航组「短剧专区」→ `/drama/config`（web-drama 个性化配置：扣费确认阈值 + 大纲/分场分镜/拆镜/选角/首帧单价；真值存 `aep_platform_configs` `drama.credit.*`，分镜视频单价沿用「引擎价格」`material.video-generate`）。
- **v0.71**：短剧专区新增 `/drama/prompts`「提示词设置」。短剧各 AI 动作（大纲 `drama.outline` / 整集分场分镜 `drama.epscript` / 单场拆镜 `drama.split_scene` / 选角 `drama.cast` + 短视频脚本 `drama.script_draft`）的 system + user 提示词与调参在此维护。复用「Prompt 管理」同一后端 `/api/admin/prompts`（SUPER_ADMIN/OPERATOR），按 `drama.*` 过滤；每个 prompt 给友好名 / 用途 / 可用占位符提示 / 试运行，并对 `temperature`（创意发散度）/ `max_tokens`（单次最长输出）/ `jsonMode`（强制 JSON）三个专业参数加人性化说明 + 推荐默认占位（留空即用，无需每次设）。改完保存 1 分钟内全节点生效。
- **v0.72**：`/drama/prompts` 增加 4 个图像/视频出片 key（`kind:"media"`）——`drama.frame_image` / `drama.clip_video`（工作台分镜出图/出片）+ `drama.short_frame_image` / `drama.short_clip_video`（短视频工坊）。media 类是给图像/视频模型的单条 prompt：编辑时隐藏 System 与 temperature/max_tokens/jsonMode（不适用），只露提示词模板 + 可用占位符（`{{visual}}`/`{{size}}`/`{{move}}`/`{{styleSuffix}}` 等）+ 试运行；并提示比例/版数/首帧参考由前端按镜头传入、单价在「个性化配置」调。
