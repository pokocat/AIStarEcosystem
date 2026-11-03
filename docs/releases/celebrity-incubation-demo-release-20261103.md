# AI 艺人孵化演示版生产发布（2026-11-03）

## 发布了什么

- **服务**：只发 `web-celebrity`，server 和其他应用没动。
- **制品**：`20261103-celebrity-incubation`，从 main `0bb84ab47` 在仓外干净工作区
  `../AIStarEcosystem-release-celebrity-incubation` 构建。构建参数沿用上一版：
  `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`、
  `NEXT_PUBLIC_USE_MOCK=0`。
- **发布时间**：2026-11-03 14:03 CST。
- **内容**：
  - 侧栏新增「AI 艺人 → AI 艺人孵化」（`/incubation`），所有登录用户都能看到（用户选的方案）。
    点进去是给业务方路演用的演示页：孵化五步、在孵艺人、孵化工具箱。点艺人卡片进入详情页，
    默认显示矩阵账号，另有数字资产、短剧与视频、商业合作三个页签。
    页面全部是前端示例数据（`src/mocks/incubation.ts`），右上角标了「演示数据」。所有能力入口点了都只弹
    「正在完善中」，不调接口、不扣积分。
  - `public/ai-stars/` 的形象图换成 Codex 新出的写实时尚风（6 张，800×1200 JPG），落地页和孵化页共用。
- **一起带上线的 main 改动**：线上上一版 web-celebrity 是 `20261101-client-image-upload-76b353939`。
  从那版到本次，影响 celebrity 的只有 `packages/types` 和 `packages/api-client` 的企业类型小改动
  （2 个文件、6 行），celebrity 用不到。

## 检查

- 发布前在功能分支跑了 `pnpm typecheck:all`、`pnpm check:api-contract`、web-celebrity 的 108 个测试，全部通过。
  之后 main 上又多了两个只改 web-aiavatar / server / specs 的提交，变基后没再重跑。
- 本机演示模式下走过总览页、艺人详情的四个页签、「正在完善中」弹窗，手机 375 宽无横向滚动。
- 直推 main，没开 PR，所以没有 CI 结论。

## 线上验收

- `deploy-release.sh` 自带的 `verify.sh` 全绿。
- `https://celebrity.aibuzz.cn/`、`/login`、`/incubation`、`/incubation/shen-xinglan` 都返回 200；
  `/ai-stars/shen-xinglan.jpg` 返回的是新图（800×1200，157,932 字节）。浏览器打开落地页，首屏已显示新形象。
- nginx 访问日志里，发布前后 celebrity 相关的请求没有 5xx。
- **没验收的**：`/incubation` 要登录后才能看到内容，本次没用账号登录正式站去点。

## 回滚

生产机 `/opt/ai-star-eco/releases/20261101-client-image-upload-76b353939` 是上一版 web-celebrity，用
`deploy-release.sh <该目录> web-celebrity` 重新部署即可。只涉及前端静态内容，没有数据和迁移。
