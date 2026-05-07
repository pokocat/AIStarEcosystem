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
│  ├─ mocks.js             # 字段对齐 apps/web/src/types/* 的演示数据
│  └─ format.js            # 与 apps/web/src/lib/format.ts 同形
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
| 01 | 激活码登录 | `POST /auth/activate` |
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

> **数据形状真源**：`apps/web/src/types/celebrity-zone.ts`。
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

## 七、版本日志

- **v0.1.0 / 2026-05-07**：首版。11 屏静态实现 + mock 数据 + 与 server 的接口映射占位。等待与 server 真实联调。
