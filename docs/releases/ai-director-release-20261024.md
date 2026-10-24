# AI 导演台首发 · 发布记录

- 发布号：`20261024-ai-director`
- 构建提交：`main` `a1e8fc85`。合入 `codex/ai-director`（`160518b1` → `a005fa83`），从干净工作区 `../AIStarEcosystem-main-release` 构建。
- 服务范围：`server`、`web-aiavatar`。`web-aiavatar` 构建时带 `NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，登录方式按默认 `id`。
- 上线时间：2026-10-24 21:44（北京时间）
- 数据库迁移：V65 `director work`，新建 `director_work` 表，`ip_run` 加 `host_type` 列。线上 21:44:29 执行成功，用时 0.095 秒。生产配置未改。
- 回滚：在 `AIStarEcosystem-main-release` 里执行 `deploy-release.sh dist/deploy/20261024-studio-plan-material-scope server,web-aiavatar`。V65 只新增表和可空列，旧代码不读，回滚时保留。
- 设计真源：[`docs/ai-director-plan.md`](../ai-director-plan.md)，提示词见 [`docs/prompts/ai-director-visual-production.md`](../prompts/ai-director-visual-production.md)。
- 同时带上的分支提交：`0c8e64e9`（视频智能优化界面精简）和 `7017819f`（Studio 待办方案归档）。前者也会进本次 `web-aiavatar` 包。

## 内容

- **入口：** Studio 主导航「AI 导演台」，路由为 `/director` 和 `/director/[id]`。
- **作品：** 服务端拥有的结构化作品，存在 `director_work.content_json`。生成任务复用原生 `IpRun`，计价、冻结、付款和结算沿用原链路。
- **剧本：**
  - 可以 AI 写、粘贴，或拆集。
  - 可以重新 AI 生成：旧稿进 `scriptHistory`，最多保留 3 版；集和片段清空，资产保留。
  - 已有分镜图或视频时，重新生成会被拒（`DIRECTOR_CLIPS_HAVE_MEDIA`）。
- **资产：**
  - 按全剧一次提取，结果先进「确认资产」弹窗，用户保存后才入库。
  - 角色出横版 16:9 设定集（全身三视图、头部三面、表情四宫格、特征特写、半身）。
  - 角色音色可写文字描述，也可加参考音频。
  - 角色图只能由系统生成。上传的照片设为「形象参考」，只在生成设定图时作为图1交给模型；直接上传或采用上传图会被拒（`DIRECTOR_CHARACTER_UPLOAD_NOT_ALLOWED`）。
- **分镜：**
  - 左侧分集栏，片段卡以视频为主。
  - 分镜图在单独的弹窗里，可看历史版本、改提示词、重新生成。
  - 视频提示词按分镜宫格逐镜写。
  - 可以多选片段批量生成。
  - 首帧出片模式适用于只支持首帧的模型。
- **界面：**
  - 一行顶栏，左侧竖栏切换剧本、资产、分镜。
  - 弹窗打开时焦点进入弹窗，Tab 在弹窗内循环，关闭后焦点回到原来的按钮。
  - 页面外层包了 antd `App`。

## 发布前验证

- **合并后的 main：**`typecheck:all`、`typecheck:admin`、`mvnw compile -o`、`check:api-contract` 全部通过。
- **web-aiavatar vitest：**1 条失败，`select-field-wiring.test.ts`。原因是 admin 审计页还在用原生 select，main 上原本就有，与本次无关。
- **server ipstudio 整包（上一轮）：**1220 条，0 失败，5 条跳过。导演台没有专门的服务端单测，以下面的本地端到端为准。
- **本地端到端**（测试响应 + 本地库，浏览器实点）：
  - 提取后确认保存、改名记别名、丢弃清单；一键制作停下等确认，丢弃后停止。
  - 批量出分镜图。
  - 重新生成剧本。
  - 音色描述写进视频提示词的语音轨。
  - 角色形象参考：上传后已采用的图标「需更新」；重新生成的提示词末尾带形象参考说明。直接上传返回 400。
  - 弹窗焦点进入与归还、Tab 循环。
- **Codex 评审一轮：**P1 和 3 条 P2 已修（跨批次的勾选残留、丢弃时一键制作仍在跑、音色描述用错修订号、匹配到的资产改名被丢）。

## 线上验收

- `verify.sh`：ALL GREEN。
- server 21:44:24 启动，16.7 秒完成；启动后日志 0 条 ERROR（`grep -E ' -ERROR | ERROR [0-9]+ ---'`，单元 `aistareco-server`）。
- `https://aiavatar.aibuzz.cn/director`：200。

## 未验证

- 线上没有跑过真实出图、出片：本地真实 Agnes 出图已验，视频当时卡在厂商队列，见 [`docs/audits/ai-director-local-acceptance-20261022.md`](../audits/ai-director-local-acceptance-20261022.md)。
- 新版角色设定集的真实出图质量没看过，五个分区是否稳定出齐要看首批任务。形象参考照片交给真实图片模型后效果如何，也没验证。
- 用户刚提出手机端不必专门照顾，本次对手机端只放大了几个按钮，没有做完整适配。
- `studio-workspace.test.tsx` 有 1 条偶发失败，单独跑能通过，与导演台无关。

---

## 追加发布（2026-10-25 00:52–01:04，三次）

| 制品 | 服务 | main 提交 | 内容 |
|---|---|---|---|
| `20261024-ai-director-2` | server + web-aiavatar | `070cb3e3` | 生成中 AI 动效；编剧提示词按用户的竖屏短剧提示词重写，加题材 / 调性；一键制作默认只做到分镜脚本；任务列表在新事务里读 |
| `20261024-ai-director-3` | server | `f6f233db` | 模型 JSON 只缺结尾括号时补齐（`ModelJson`） |
| `20261024-ai-director-4` | server | `06e8571d` | 剧本正文不写「出场人物 / 钩子 / 伏笔」等策划标注，不用列表和加粗 |

web-aiavatar 仍是 `-2` 的包（构建参数 `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，已核对 manifest）。无新迁移，schema 仍是 65。三次启动均 15–16 秒，0 条 ERROR，`verify.sh` ALL GREEN。

### 修了什么

- **点「生成剧本」没反应：** 线上日志里第一次 POST 返回 200，之后 5 分钟没有一次轮询。原因是任务在独立事务里建，外层事务的 MySQL 快照（可重复读）看不到它，返回给页面的任务列表是空的。`view()` 改为在新事务里读。本地 H2 复现不了，见 AGENTS.md §8.0.1 ⑯。
- **真模型第一次生成失败：** 聚算 Qwen3.8 27B 写完了 1500 字剧本（finish=stop），只漏了最外层的 `}`，整单判失败、已退款（run `IPR-fc76a880a5544e99a12d`）。`ModelJson` 现在只在文本停在完整值上、只缺结尾括号时补括号；截在字符串中间或逗号、冒号后面照样失败。这份原始回复已在本地用新解析器读出（《泥与光》，正文 1369 字）。

### 线上真模型验收（作品 `DW-83cef0f90037400caa11`，创意「敦煌飞仙的玄幻故事」，题材奇幻脑洞）

- 点击后立刻显示「AI 正在写剧本」动效和计时，顶部状态条同步；重新生成时显示顶部横幅。
- 第二次生成成功，约 2 积分；人物陈默（修复师，打喷嚏、强忍烟瘾）、看守老赵，地点「莫高窟第45窟」，道具羊毛刷、丙烯颜料；三集，伏笔在第 3 集回收，结尾有悬念。但正文带「- **出场人物**」「**钩子**」等标注 → `-4` 修。
- `-4` 后重新生成：正文是干净的剧本格式（场标题下直接写动作和对白），三集各一场。

### 仍要注意

- 第三次生成第 2 集出现了「想不起照片里的女人是谁」的记忆线，接近提示词禁止的「失忆」桥段；模型没有完全遵守，未再调整。
- 一键制作「分镜脚本」档只在本地测试模式跑过，线上没有用真模型跑完整链路（拆分 → 提取 → 规划）。
