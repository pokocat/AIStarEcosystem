# Studio 对话去掉「继续」、不锁方法、单击弹浮层 · 发布记录

- 发布号：`20261023-studio-dialogue-no-continue`
- 构建提交：`main` `1eed1284`（干净工作区 `../AIStarEcosystem-main-release` 构建）
- 服务范围：`server`、`web-aiavatar`、`web-drama`（web-drama 只改了提示文案）
- 上线时间：2026-10-24 10:22（北京时间）
- 数据库迁移：无；生产配置：未改
- 设计真源：[`docs/ip-studio-dialogue-no-continue.md`](../ip-studio-dialogue-no-continue.md)、[`docs/ip-studio-dialogue-intents.md`](../ip-studio-dialogue-intents.md)「2026-10-23：不锁方法」

## 内容

| 提交 | 内容 |
|---|---|
| `39bbc1ce` `d11ca588` | 对话不再停下来让用户说「继续」：一条消息 = 一个 run = 一条回复，单轮步数 / 调用 / 工具 / 时长 / Token 分配上限删除。首笔冻结 = min(普通文本额度, 可用余额)，不够时在同一 run 上追加冻结（`runId#n`），按实际用量依次结算；余额不够才停，给充值入口。对话费用不再计入制作阶段预算，确认卡上限不含对话预留。对话不再因客户端 `maxCost` 回 409。长文按 offset 分段读；子任务最多等 10 分钟。提示词 SEED v25。 |
| `28d627a3` | 每条消息、read_skill、propose_plan 都按意图选方法，有制作在进行也不锁；换方法时旧制作空闲则结束、仍在生成则放手让它跑完。`STUDIO_SKILL_OPERATION_NOT_ALLOWED` 等内部报错不再给用户看。提示词 SEED v26。 |
| `be456c75` `4f075e53` | 画布单击视频 / 音频照常播放并弹出浮层；单击标题栏选中并弹出浮层（300ms 后弹，避免与双击改名冲突）。 |

## 发布前验证

- 合并后 `main`：`pnpm install --frozen-lockfile`、`typecheck:all`、`typecheck:admin`、`mvnw compile -o`、`check:api-contract` 全过。
- 服务端对话 / 制作 / 计费相关 289 条测试全过（含真实账本集成测试：个人与企业成员钱包追加冻结、余额不够、冻结全部结清）。
- web-aiavatar vitest 1202 条，1 条失败：`select-field-wiring.test.ts`，原因是 `apps/admin` 审计页的原生 select（main 上原有，非本次）。
- 企业计费集成测试 10 条失败（`EnterpriseVideoBillingIntegrationTest` 8 条、`EnterpriseStudioBillingIntegrationTest` 2 条），在未改动的基线 `070334d0` 上同样失败，与本次无关，已记 TODO。
- 单击弹浮层：本地演示模式浏览器实测，单击视频开始播放且弹出「生成视频」、播放器未重建；单击标题选中并弹出浮层；双击标题进入改名不弹浮层，Esc 后标题不变。

## 线上验收

- `verify.sh`：ALL GREEN（各 systemd 单元 active、公网与子域名 200、server 本地 API、nginx -t）。
- server 10:22:49 启动，16 秒完成；启动后日志 0 条 ERROR。
- `PromptTemplateSeeder` 刷新 54 个未改动提示词，`aep.material.prompt-seed-version` = `v26-2026-10-23-dialogue-unlocked-methods`；线上 `dap.ip_studio_skill_dialogue`（version=1，seed）已含规则 14（不让用户回「继续」）与分段读取用法。
- 发布前线上核对：上一次出现「第1步的操作不在当前阶段允许的范围内」是 2026-10-23 18:59（IPP-d395bde4），出图→视频续接修复 19:39 上线后再未出现。

## 未验证

- **没有用真模型跑过长任务**（§8.0.1 ⑦）。上线后截至记录时没有新的对话任务；需要观察首批真实对话：是否一条消息做完、追加冻结是否出现且结清、换方法是否顺畅、有无 `STUDIO_PRICE_CHANGED` / `STUDIO_SKILL_OPERATION_NOT_ALLOWED`。
- 已打开的旧页面不认识新行为的部分字段，刷新后正常。
