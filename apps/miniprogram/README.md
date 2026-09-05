# apps/miniprogram — AI 明星带货 · 微信小程序（带货方）

> 第三个前端，带货方视角。后端复用 `apps/server`，运营/审核能力复用 `apps/admin`。
> 设计来源：Claude Design 导出原型 `celebrity-selling`（11 屏）。

## 一、它做什么 / 不做什么

**做**（11 屏，带货方核心路径）：
1. 激活码登录
2. 消息首页（AI Bot 同事流 + 待办中心）
3. 工作台（GMV / 流程 / 我的明星）
4. 明星市场
5. 明星详情 + 申请授权
6. AI 视频生成器（4 步配置）
7. 生成过渡（4 步 Pipeline 进度）
8. 视频资产中心（含空状态分支 + 生成中卡片）
9. 视频详情（多平台渠道 / 生成参数 / 脚本 / 教练建议）
10. 数据看板 + 复盘
11. 我的（占位）

**不做**：
- CRM / 激活码生成 / 客户漏斗 / 经纪审核工作台 / 平台运营配置 / 财务对账 / BI 报表 → 全部在 `apps/admin`
- 搞钱任务、投流配置、评论/私信、邀请树 → 小程序后续版本

## 二、目录结构

```
apps/miniprogram/
├─ project.config.json     # 微信开发者工具配置
├─ sitemap.json
├─ app.json                # 11 页注册 + 自定义 tabBar
├─ app.js                  # globalData / auth 持久化
├─ app.wxss                # 设计令牌（与 figma tokens.css 同名）
├─ agent.md                # ⚠️ 任何 agent 在本目录工作前必读
├─ utils/
│  ├─ api.js               # 后端调用封装（mock 开关）
│  ├─ mocks.js             # 字段对齐 packages/types/src/* 的演示数据
│  └─ format.js            # 与 packages/api-client/src/format.ts 同形
├─ custom-tab-bar/         # 5 项 + 中央凸起（工作台）
└─ pages/
   ├─ login/               # 01 激活码登录
   ├─ messages/            # 02 消息首页（tab）
   ├─ videos/              # 08 + 08c 视频资产中心（tab，含空状态）
   ├─ workbench/           # 03 工作台（tab，凸起按钮）
   ├─ market/              # 04 明星市场（tab）
   ├─ me/                  # 占位（tab）
   ├─ celebrity-detail/    # 05 明星详情 + 授权
   ├─ generator/           # 06 视频生成器
   ├─ generating/          # 07 生成过渡
   ├─ video-detail/        # 08b 视频详情
   └─ dashboard/           # 09 数据看板 + 复盘
```

## 三、启动

1. 用 **微信开发者工具**（基础库 ≥ 3.0）打开 `apps/miniprogram/` 目录。
2. AppID 选 "测试号" 或填自有 AppID。
3. **mock 模式**（默认）：`app.js → globalData.useMock = true`，无需启动 server，直接演示。
4. **联调模式**：把 `useMock` 改为 `false`，把 `apiBaseUrl` 改成 server 暴露的 URL（如 `https://your-host/api`），并：
   - 在 IDE → "详情 → 本地设置 → 不校验合法域名" 勾上（开发态）
   - 上线前在小程序管理后台 "开发管理 → 服务器域名" 配置 `request 合法域名`
5. 真机预览：扫码后用 iOS / Android 都过一遍（**真机表现 ≠ 开发者工具**，详见 `agent.md`）。

## 四、与 apps/server 的接口映射

`utils/api.js` 中所有 URL 在 `specs/openapi.yaml` 中均已存在：

| 屏 | 调用 | endpoint |
|---|---|---|
| 00 | 微信静默登录（id 模式）| `POST {idBaseUrl}/oauth2/token`（grant `urn:aibuzz:params:oauth:grant-type:wechat-mini`）|
| 00 | 刷新令牌（id 模式）| `POST {idBaseUrl}/oauth2/token`（grant `refresh_token`）|
| 00 | 账号档案 + 开通状态 | `GET /me`（`identityUid` + `enrollments[]`）|
| 00b | 开通带货 | `POST /me/enrollments/celebrity/activate { licenseKey }` |
| 00c | 一键取号绑手机 | `POST {idBaseUrl}/api/me/phone/wechat-bind { code }` |
| 00c | 短信绑手机 | `POST {idBaseUrl}/api/me/phone/send-code`、`POST {idBaseUrl}/api/me/phone/bind` |
| 01 | 发送注册验证码（legacy）| `POST /auth/sms/request-code { purpose: "register" }` |
| 01 | 激活码 + 验证码注册（legacy）| `POST /auth/sms/register` |
| 02 | 通知/待办 | `GET /notifications` |
| 03 / 09 | 工作台 / 看板总览 | `GET /celebrity/overview` |
| 04 | 明星市场 | `GET /celebrity/stars` |
| 05 | 明星详情 | `GET /celebrity/stars/{id}` |
| 06 | 模板 | `GET /celebrity/templates` |
| 06→07 | 触发生成 | `POST /celebrity/generate` |
| 07 | 进度查询 | `GET /celebrity/projects/{id}` |
| 08 | 视频列表 + 额度 | `GET /celebrity/videos` + `GET /me/wallet` |
| 08b | 单视频详情 | `GET /celebrity/videos/{id}` 或 `/celebrity/projects/{projectId}/videos` |
| 08b | 多平台分发 | `POST /celebrity/projects/{projectId}/distribute` |

> **数据形状真源**：`packages/types/src/celebrity-zone.ts`。
> 小程序的 `mocks.js` 字段名按此对齐；后端 `*Dto` 同名。

## 五、与 apps/admin 的边界

小程序内 **完全不出现** 以下能力（均在 admin 完成）：
- 激活码生成 / 发放
- 经纪团队/合规官的资质审核工作台
- 明星上下架、品类、价格、风控
- 财务、分账、对账、BI 报表

小程序仅消费这些能力的"结果"，例如：
- 资质审核进度展示在「明星详情 → 授权进度」（数据来自 server，由 admin 推进状态机）
- 额度/价格在「视频中心 → 生成额度」（数据来自 server，由 admin 配置）

## 六、注意事项 — **请先读 agent.md**

`agent.md` 是本目录的"操作手册"，列出了：
- 微信小程序平台思维（把"平台 Bug"作为头号假设）
- iOS / Android / 开发者工具差异
- 自定义 tabBar、路由、CSS、网络、setData、字体、存储 等已知坑与变通方案

**任何**修改本工程的 agent 必须先读完。

## 六之二、登录模式：统一账号中心 vs legacy

> 契约真源：[`docs/unified-identity-plan.md`](../../docs/unified-identity-plan.md) §5 / §6 / §12.2 / §12.6。

`config/env.js` 的 `authMode` 决定小程序怎么登录（缺省按有没有填 `idBaseUrl` 推导）：

| | `authMode: "id"`（统一账号中心） | `authMode: "legacy"`（历史流程） |
|---|---|---|
| 首屏 | `pages/launch/index` → `wx.login` 静默授权 → 账号中心发令牌 | `pages/launch/index` → `pages/login/index` 注册页 |
| 用户要填什么 | **什么都不填**（要用手机号的动作再一键取号） | 手机号 + 短信验证码 + 激活码 |
| 激活码的位置 | 登录**之后**的「开通带货」一步（`pages/enroll/index`） | 注册表单里，登录与开通合成一步 |
| 令牌 | 账号中心 access + refresh，存 storage `auth.id`，401 单飞刷新 | server 自签 JWT，存 storage `auth` |
| 请求头 | `Authorization: Bearer` + `X-App-Code: celebrity` | 同左，`X-App-Code: celebrity-mp` |
| 手机号 | JWT 的 `phone_verified` claim；未验证时在有副作用的动作前弹绑定面板 | 注册时已收集 |

**为什么手机号还得单独绑**：微信只在同一开放平台主体下才返回相同 unionid，本生态几个小程序不一定同主体，
所以 unionid 不能当跨端身份键（§5 D5）。客户端不读、不存、不比对 unionid；跨端合并一律由手机号触发。

**新增文件**

| 文件 | 作用 |
|---|---|
| `config.js` | 运行时配置唯一出口（合并 `config/env.js` + 默认值），导出 `authMode` / `idBaseUrl` / `idClientId` / `appCode` / `configError` |
| `utils/auth.js` | 账号中心登录态：`loginWithWechat` / `ensureLoggedIn` / `refresh`（单飞）/ `logout` / 读 JWT claim |
| `utils/phone.js` | 手机号绑定：`ensurePhoneVerified` / 一键取号 / 短信兜底 / 合并后重登 |
| `components/phone-bind-sheet/` | 「绑定手机号」底部面板（`open()` 返回 `Promise<boolean>`） |
| `pages/launch/` | 首屏：静默登录 → 拉 `/me` → 已开通进工作区 / 未开通去开通页 |
| `pages/enroll/` | 开通 AI 明星带货（激活码） |

**手机号绑定的挂载点**（这些动作会先确认 `phone_verified`）：`pages/generator`（开始生成）、
`pages/recharge`（提交充值申请）、`pages/enroll`（开通）、`pages/me`（主动绑定入口 + 未绑定提示条）。
其它页面调 `Phone.ensurePhoneVerified(this)` 时若没挂面板组件，会兜底引导到「我的」，不会硬失败。

### 手测清单（小程序没有自动化测试，改动这条链路后必须逐条走）

前置：`cp config/env.example.js config/env.js`，填 `useMock: false` + `apiBaseUrl` + `idBaseUrl`（本地 `http://localhost:8090`），
IDE 勾「不校验合法域名」，并保证 server(8080) 与账号中心(8090) 都在跑（账号中心在独立仓库 [`pokocat/aibuzz-id`](https://github.com/pokocat/aibuzz-id)，clone 到本仓同级后 `./mvnw spring-boot:run`）。

1. **首次静默登录**：清缓存（IDE「清除数据缓存」）→ 重新编译 → 首屏应停在启动页几秒后直接进工作区，
   **全程不出现任何输入框**。检查 storage 里有 `auth.id`（含 accessToken / refreshToken / expiresAt）。
2. **未开通 → 开通页**：用一个没有 celebrity 开通记录的账号进 → 应被送到开通页；输入激活码 → 开通成功 → 进工作区；
   输错激活码 → 页面上给「这个激活码无效或已被使用」，不出现内部错误码。
3. **绑手机号 · 一键取号**：用未绑手机号的账号点「开始生成」/「提交充值申请」→ 弹底部面板 →
   点「微信一键绑定」→ 授权 → 面板关闭并继续原动作。**真机必测**（开发者工具的取号是模拟的）。
4. **绑手机号 · 短信兜底**：面板里点「用短信验证码绑定」→ 收码 → 绑定成功；用个人主体 / 未认证小程序时
   一键取号会直接失败，确认自动切到短信通道且给了人话提示。
5. **合并后 reloginRequired**：用「A 账号（微信新号）绑定 B 账号已有的手机号」触发合并 →
   应提示「已合并到你的原有账号」→ 自动重新静默登录 → `/me` 里看到的是存活方账号（B）的数据，且不需要用户手动重登。
6. **绑定成功但重登失败**（P1-9 回归，必测）：走第 5 步触发合并，但在点「确认绑定」之后、
   面板关闭之前**把账号中心停掉**（或 IDE 里断网）。期望：
   - 面板**不关闭**，红字提示「绑定成功，但重新登录失败，请重启小程序再试」；
   - 面板上只剩「知道了」，微信一键绑定 / 短信输入框 / 获取验证码全部消失（不能让用户再绑一次）；
   - **原动作被取消**（比如从「开始生成」进来的，回去之后没有开始生成，也没有扣积分）；
   - 完全退出小程序再进 → 自动静默登录到存活方账号，一切正常。
   反例（修复前的行为）：面板直接关闭 + 「手机号已绑定」toast + 原动作继续执行 → 下一步 401 或读到旧数据。
7. **未开通账号不能混进工作区**（P2-3 回归）：让 `/api/me` 返回 `enrollments: []`（空数组）——
   期望被送到开通页。反例（修复前）：空数组掉进 `platforms` 兼容分支被判成「已开通」，直接进工作区。
8. **配置错误 fail closed**（P2-6 回归）：把 `env.js` 改成 `authMode: "id"` 但 `idBaseUrl: ""` → 重新编译 →
   启动页应停在「配置错误：缺少账号中心地址」屏，**不出现任何登录 / 注册入口**，也不会退回 legacy 注册页；
   没有请求被打出去。改回正确的 `idBaseUrl` → 恢复正常。
9. **401 刷新**：手动把 storage 里 `auth.id.accessToken` 改坏 → 触发任意接口 → 应无感刷新后成功；
   再把 `refreshToken` 一起改坏 → 应静默重新 `wx.login` 后成功；两者都不通时回到启动页。
10. **legacy 模式回退**：把 `env.js` 的 `authMode` 改成 `"legacy"`（或**同时**清空 `authMode` 与 `idBaseUrl`）→
    重新编译 → 首屏进老的「手机号 + 短信 + 激活码」注册页，整条老链路不受影响；`X-App-Code` 回到 `celebrity-mp`。
    注意：只清空 `idBaseUrl` 而 `authMode` 仍写着 `"id"` 会命中第 8 条的配置错误屏，这是有意的。
11. **退出登录**：「我的 → 退出登录」→ id 模式回启动页并重新静默登录；legacy 模式回注册页。

## 七、版本日志

详细业务规格见根目录 `product_spec_ai_celebrity.md`（独立 AI 明星产品文档，按版本追加）。

- **v0.149 / 2026-09-04**：接入统一账号中心（`id.aibuzz.cn`）。`authMode=id` 时启动即微信静默登录
  （`wx.login` → `POST /oauth2/token`，微信小程序 grant），激活码从「注册」降级为登录后的「开通带货」一步；
  新增 `config.js` / `utils/auth.js` / `utils/phone.js` / `components/phone-bind-sheet/` /
  `pages/launch/` / `pages/enroll/`；`utils/api.js` 带账号中心 Bearer + `X-App-Code: celebrity`，
  401 单飞刷新一次、失败静默重登，403 `PRODUCT_NOT_ENROLLED` 导向开通页；生成 / 充值 / 开通前确认
  `phone_verified`，未验证弹一键取号（短信兜底），合并触发 `reloginRequired` 时自动重新静默登录。
  legacy 模式（`pages/login`）完整保留，只是在 id 模式下不可达。

  **P2 评审收口（2026-09-04）**，三条都是「静默地把错的当成对的」：
  - `utils/phone.js` `afterBind` 不再吞掉重登失败。原来重新登录 / `/api/me` 失败都被 `.catch(() => null)`
    转成成功，调用方拿着一张**服务端已经作废**的令牌继续往下走（合并时被并方的令牌当场进拦截名单）。
    现在必须「拿到新令牌」+「`/me` 重新拉到」都成立才 resolve；否则抛
    `BIND_RELOGIN_FAILED`（「绑定成功，但重新登录失败，请重启小程序再试」），
    `components/phone-bind-sheet` 据此把面板锁成只读、并把调用方的待办动作判否（不继续执行）。
  - `app.js` `isEnrolled` 认空数组。只要 `/api/me` 给了 `enrollments` 数组它就是唯一真值，
    **`[]` 也是**（= 一个产品都没开通）；只有字段整个缺失才回落 `platforms` 兼容老后端。
    原来写的是 `length > 0`，于是新账号会掉进 `platforms` 的历史语义（空 = 全集）被判成已开通。
  - `config.js` 配置错误 fail closed。显式声明 `authMode: "id"` 却没给 `idBaseUrl` 时不再悄悄退回 legacy
    （那会让用户注册出一批账号中心里根本不存在的孤儿账号），改为导出 `configError`，
    由 `pages/launch` 渲染「配置错误：缺少账号中心地址」错误屏，不给任何登录入口。
    `authMode` 不写、靠 `idBaseUrl` 推导出 legacy 仍是正常形态，不受影响。

- **v0.5.4 / 2026-05-09**：文档收敛（小程序无代码改动；`agent.md` 加「文档同步纪律」段）。
- **v0.5.3 / 2026-05-09**：近实时同步 —— App 全局 15s + 消息/chat 页 5s 子轮询 + 业务关键点立即 trigger（`triggerUnreadRefresh`）；自定义 tabBar 加未读红点；WebSocket 升级路径在 `app.js` 末尾留 TODO。
- **v0.5.2 / 2026-05-09**：server 侧重写为按需合成（拉模式），小程序契约不变。
- **v0.5.1 / 2026-05-09**：消除 5 处页面硬编码（durations / languages / categories / keypoints / star 占位）；接入 `/me/messages-overview` 新 shape；`pages/generating` 改为真实轮询 `getJobProgress(jobId)`；`pages/chat` 进入立即 `markBotRead` 清红点。
- **v0.4.0 / 2026-05-07**：通信层完整对接 server（11 屏 API + 字段长名对齐）；server-side endpoints 已落地。
- **v0.3.0 / 2026-05-07**：与 web 版明星专区对齐。新增双 Tab（我的明星/全部市场）、明星资料图集 + 视频、生成器模型选择 + 模板效果预览 + 动态积分消耗、我的页积分钱包 + 充值流程；补完所有点击位。
- **v0.2.0 / 2026-05-07**：消息从单条卡片改为会话流，新增 chat 详情页（6 种消息块）。
- **v0.1.0 / 2026-05-07**：首版。11 屏静态实现 + mock 数据 + 与 server 的接口映射占位。
