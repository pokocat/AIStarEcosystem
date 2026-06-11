# web-star — 明星商务工作台

> 第五个 web 子应用（v0.60）：明星本人 / 经纪团队的审核与运营中枢。
> 浅色 light 主题（白底 + 红黑灰 + 星光金），桌面优先（≥1280 侧导航，<1024 顶部 Tab）。

## 启动

```bash
pnpm install            # 仓库根目录
pnpm dev:star           # http://localhost:3014
pnpm typecheck:web-star
pnpm --filter @ai-star-eco/web-star build
```

`.env.local`：

```
NEXT_PUBLIC_USE_MOCK=1                 # 1=纯前端 mock；0=走真后端
NEXT_PUBLIC_SERVER_API_BASE=http://localhost:8080
NEXT_PUBLIC_ENABLE_DEV_LOGIN=1         # dev 种子账号快速登录
```

种子明星账号（server dev seed）：`star_shenteng / star123`（手机号 13900002222），
绑定 celebrity 域 `star-shen-teng`（沈腾），platforms=`star`。

## 技术栈

Next 16.2.6 / React 19 / Tailwind v4 / pnpm workspace。依赖共享包
`@ai-star-eco/{types,ui,api-client}`；图表 recharts；动效 motion（仅状态反馈）。

## 路由

```
/                      公开 landing
/login                 验证码 / 密码登录（dev 显示种子账号）
/onboard               明星入驻（登录后无档案绑定时强制引导）
/(workspace)/…         工作台（route group，不出现在 URL）
  /dashboard           工作台总览（KPI / IP 链路 / 待办聚合）
  /ip-auth             IP 授权中心（4 资产 × 6 状态机）
  /cooperation         带货授权（web-celebrity 创作者申请的审批队列 ★打通核心）
  /whitelist           报白账号（5 步推进 + 参数一键复制）
  /digital-human       数字人授权
  /ai-likeness         AI 形象授权（三级风控）
  /content-review      内容审核（通过 / 要求修改 / 驳回）
  /product-onboard     商品入库（6 步 + 双路寄样 ★打通核心）
  /product-library     商品库（step=5 派生）
  /brand-auth          品牌授权（双层审核 + 双向寄样）
  /revenue             分成收益（GMV 趋势 + 月度明细）
  /rules               内容授权规则（绿黄橙红四区启停）
  /infringement        侵权巡查（处置弹层 + 留痕）
  /contracts           合同中心（搜索 / 双筛选 / 到期提醒）
```

## 与 web-celebrity 的打通

| 动作 | 发起端 | 落点 |
|---|---|---|
| 明星入驻 `/onboard` | web-star | 创建 CelebrityStar → celebrity 明星市场立即可见 |
| 带货授权申请 | web-celebrity `/star/[id]/apply` | web-star `/cooperation` 审批 → 批准后 celebrity 端授权态实时变 authorized + 站内通知 |
| 商品报备 | web-celebrity `/products` 行内「报备」 | web-star `/product-onboard`（step=2 明星审核）→ 入库后双端状态同步 |

## 版本日志

- **v0.60**（2026-06-10）：首版。13 个 Figma 原型模块全量浅色化复刻 + 新增「带货授权」
  打通模块；后端 `/api/star/**` 域（12 实体）+ `/api/me/celebrity/*` 打通端点；
  mock / 真后端双模式；H2 与 MySQL 双双 E2E 验证。
