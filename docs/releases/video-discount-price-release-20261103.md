# AI 视频页生成前显示模型折扣 · 生产发布（2026-11-03）

用户 2026-11-03 交接（Codex 只读排查）：后台已有「H3限时折扣」（接入点 `ai-jusuan-minimax-h3`，五折，全体，北京时间 11-01 至 12-01），正式站 AI 视频页 minimax-h3、15 秒、768p 的按钮仍显示 930 积分，要点了生成、在确认弹窗里才看得到折扣。用户确认「合进 main」后要求「发布」。

## 用户能看到的变化

- AI 视频页「生成视频」按钮上的价改由服务端报价：有折扣时原价划掉、后面是折后视频费（例如「~~930~~ 465 积分」），下面一行写优惠名和省了多少（「H3限时折扣，省 465 积分。」）。还没写提示词、没放素材也看得到。
- 付款账户定了（没加入企业，或设了默认账户）才写「模型赠款抵多少，再付多少积分」；没定时只写视频费，个人与企业价不同就两个都写，不冒充最终应付。
- 先优化提示词的文字费用另说一句「先优化另按实际用量扣少量积分」，不算进视频费。
- 换模型、改时长 / 清晰度 / 画面时，旧报价作废；报价回来之前按钮先显示价表价并变淡。切回之前用过的参数也重新报，后台刚改的折扣不会被旧结果挡住。
- 按钮里的价格小药丸改成压暗一档的同色底，白字对比度从 3.96:1 提到约 6.4:1；AI 图片页共用这颗药丸，一起变清楚。
- 点生成后的确认弹窗、提交上限、幂等和受理快照都没变，弹窗仍按完整请求再报一次价，那一份是付款依据。

## 正式制品

| 项目 | 真值 |
| --- | --- |
| 构建 main 提交 | `f7e58a31b4e59d67328bcb2bd6be887940c9e86d`（修复提交 `c9d280739`、`a2e096a4b` 快进推到 main；之后另一会话推了 `0bb84ab47` celebrity 演示和 `f7e58a31b` 文档，都不碰 server / web-aiavatar） |
| 发布包 | `20261103-video-discount-price`：server / web-aiavatar |
| 构建工作区 | 同级干净工作区 `../AIStarEcosystem-release-mobile-design`（detached origin/main），统一队列构建，退出码 0 |
| 构建参数 | AUTH_MODE=id、ID_ISSUER=https://id.aibuzz.cn、ENTERPRISE_ENABLED=1、USE_MOCK=0（`manifest.env` 已核对） |
| 制品 SHA256 | server JAR `db53d2a195672168f35cbeda56c5626921661a34812d24320920afdcd7228641`；web-aiavatar `7cbe30c26c6859cb2277ca58b02bef290fe5999990684d9f3d350056db2bcc77`，BUILD_ID `GaKB4-98IqMXXkkkSgjRj`；包内入口 `./apps/web-aiavatar/server.js` |
| 数据库 | 无迁移（Flyway 仍是 74） |
| 新接口 | `GET /api/v1/ip-studio/studio/video-price`：只带模型、模式、清晰度、画面比例、时长、各类参考素材张数和付款账户；只读，不建任务、不冻结、不读素材、不调模型；GET 所以不受「未绑手机号只读」拦截 |
| 契约核对 | 线上 server `856ce19cf` → 本次：dto 没有改动，openapi 只新增上面这个路径；admin、studio-admin、其它 web 不受影响 |
| CI | main `0bb84ab47`（含两个修复提交）手动触发 [运行 41587373700](https://github.com/pokocat/AIStarEcosystem/actions/runs/41587373700)：frontend-tests、backend、六个应用的 build-and-browser 共 8 项全绿 |

## 发布前检查

- 本地编译门全绿（全工作区类型检查、admin 类型检查、server 编译、接口契约），web-aiavatar 全量 207 个文件 1629 项测试通过。
- 后端：`MaterialVideoScopedBillingIntegrationTest`（真账本、H2）新增 3 项：页面价与提交报价逐项相同、报价后无冻结 / 流水 / 余额变化；折扣删除、过期、未开始、停用都不生效；个人范围优惠不打到企业钱包、企业范围只给该企业成员钱包。`VideoStudioServiceTest` 新增页面价与画布价同价同规格、清晰度 / 画面 / 时长 / 模式校验。相关后端测试合计 812 项、0 失败。
- 本地真后端（库副本）+ 浏览器：后台加一条同线上配置的五折（`unit=call`、`specKey=*`），页面价与确认弹窗报价逐项一致（含价格版本号）；停用、过期回到原价；拖时长 8 次只发 1 次报价；取消生成后钱包 579 / 冻结 0 不变；桌面与 390 宽都看过。界面评审（单会话版）发现价格药丸对比度不足，已修。
- 两次只读查询（14:59、15:01 北京时间）：`ip_run`、`material_video_job`、`dap_job` 没有在途任务；`ip_plan_execution` 6 条「等用户处理」、3 条已取消、2 条部分完成，重启不影响。

## 线上验收

时间为北京时间。

- **server**：15:01:38 开始发布，15:02:11 `aistareco-server` 起来，15:02:30 启动完成，Flyway 校验 74 项、无需迁移，NRestarts=0。运行中的 JAR 校验和与制品一致；env-check、verify 均 ALL GREEN。`/opt/ai-star-eco/server/release-id.txt`、`release-sha.txt`、`release-manifest.env` 已手工写成本版。
- **web-aiavatar**：15:02:12 起来，NRestarts=0，线上 BUILD_ID `GaKB4-98IqMXXkkkSgjRj`。
- **日志**：发布后后端 0 条 ERROR，前端日志无报错。
- **页面**（已登录的浏览器，只看不点生成）：`/video?scene=local-groupbuy`，minimax-h3、15 秒、768P，请求 `GET /api/v1/ip-studio/studio/video-price?model=ai-jusuan-minimax-h3&mode=t2v&tier=768p&aspectRatio=9:16&durationSec=15&…&payer=personal` 返回 200；按钮「~~930~~ 465 积分」，下面「H3限时折扣，省 465 积分。先优化另按实际用量扣少量积分。」。
- **重启窗口**：nginx 15:00–15:06 共 69 个 200、1 个 302、7 个 502。502 在 15:02:13–15:02:28：6 个是部署脚本探测 `GET /api/config`，1 个是用户读钱包余额 `GET /api/me/wallet`（15:02:21，只读请求，页面会重新读）。不称零中断。
- **没验的**：没在线上点生成看确认弹窗、也没真实扣费（会花用户的钱）；企业成员没设默认账户时的两账户价没在线上看。

## 已知限制

- AI 图片页和画布的生成按钮仍只显示价表价，折扣要到确认弹窗才看得到，已记 TODO。画布出视频可直接复用本接口；图片要另加一个同口径的 GET 报价接口。
- 报价接口出错时按钮静默显示价表价，不说折扣暂时没读到；付款仍以确认弹窗为准，不会扣错。

## 备份与回滚

- 上一版：两个服务都是生产机 `/opt/ai-star-eco/releases/20261102-enterprise-billing-everywhere`（`856ce19cf`）。
- 两个服务都可以单独回滚：只回 server，新前端调不到报价接口，按钮回到价表价（看不到折扣，付款不受影响）；只回 web-aiavatar，旧前端不调新接口，新接口闲置。
- 没有迁移，无数据需要回退。本机构建工作区 `../AIStarEcosystem-release-mobile-design` 保留到下一次发布。
