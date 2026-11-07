# AIStarEcosystem 界面文案规则

通用规则在 `wenan` 技能（`~/.agents/skills/wenan/SKILL.md`），这里只写本仓自己的东西，和通用规则冲突时以这里为准。硬性约定仍以 `AGENTS.md` §8「UI 文案」与 §4.8 为准。

扫描脚本会读「统一叫法」「扫描排除」「扫描放行」三节，标题和表格列的顺序不要改。

last-reviewed：2026-11-07

## 范围

- PC 站是 `apps/web-aiavatar` 的桌面形态（`html[data-layout="desktop"]`）。页面在 `src/app/`，Studio 业务组件在 `src/ip/`，画布胶水在 `src/canvas-bridge/`，外壳在 `src/shell/`。
- 新旧两版都要看：`?ui=new`、`?ui=old`（`shell/ui-version.ts`）。
- 导航叫法的真值：`src/shell/studio-navigation.ts`。「画布」是一张张可编辑的画布，「项目」是作品画廊页，两者不要混叫。
- web-drama 另有术语表 `docs/drama-ux-copy-pass.md` §2，改 drama 先查表。
- 服务端报错也算界面文字：`python3 -I ~/.agents/skills/wenan/scripts/scan_copy.py apps/server/src/main --ext .java,.json`。这里的命中大多是写给模型的话和运营后台文字，只改用户能看到的（`BusinessException` 的 message、积分流水说明）。

- 资产页的「人物」是一个分类，包含我的 IP、角色和授权形象；资产库里能新建、能关联的那一项叫「角色」。两个词不互换。

## 统一叫法

| 不再使用 | 统一为 | 说明 |
|---|---|---|
| 正在读取 / 重新读取 / 重试读取 / 读不出 / 读不到 / 没读出 | 正在加载 X… / 重试 / X 加载失败，请稍后刷新重试。 |  |
| 可以再点一次 / 复制后发给我们 / 发给我们 | 请重试。多次失败时，可复制「错误详情」反馈给我们。 |  |
| 回到 | 返回 X |  |
| 在画布上看 / 去画布看 / 在画布中查看 | 在画布上查看 |  |
| 新建创作 | 新建画布 |  |
| 另存一份 / 换成最新内容 / 以这里为准 | 另存为新画布并加载最新版本 / 加载最新版本 / 保留此页改动 |  |
| 保存画布模板 / 保存完整画布 | 保存为模板 / 保存模板 |  |
| 生成时的描述 / 生成指令 / 本次生成提示词 | 提示词 |  |
| 有就写 | 选填 |  |
| 放入画布 | 放进画布 |  |
| 放进成片 | 加入成片 |  |
| 合成好的作品 | 已合成的作品 |  |
| 上传处理中 | 上传中… |  |
| 会消耗积分 | 将消耗积分 |  |
| 当参考图 | 用作参考图 |  |
| 记录号 | 追查号 |  |
| 做成数字名片 / 建卡中 | 创建数字名片 / 创建中 |  |
| 上传到这个库 | 上传到此资产库 |  |
| 资产名片 | 资产详情 |  |
| 带货线 / 带货应用 | AI 明星带货 |  |
| 在途 | 进行中 |  |
| 个人钱包 | 个人积分 |  |
| 本次上限 / 按实际完成的内容结算 / 在付款时抵扣 / 生成时选择付款账户 / 不含在视频费用 | 删除 | 费用写法见通用规则「费用」 |
| 归集 | 回收 |  |
| 出图 / 出片 | 生成图片 / 生成视频 | 「成片」作名词保留 |
| 先改改 | 修改方案 |  |
| 就用这版 / 重做这一段 | 采用此版本 / 重新生成 |  |
| 不发了 / 开始聊 / 规划分镜 / 标准照 | 放弃发送 / 开始对话 / 写分镜脚本 / 资产图 |  |
| 不用这个结果 / 提交重新生成 | 放弃分集 / 重新生成 |  |

界面上单独的「Studio」写 IP Studio；「受理」写开始或提交，「释放」写退回。这两条词太短，容易命中正常文字，不进扫描表，靠通读。

## 扫描排除

- `*/src/proto/*`
- `*/src/canvas/*`
- `!*/src/canvas/locales/*`
- `*/translations.ts`
- `*/src/ip/personal-ip-prompts.ts`
- `*/src/canvas-bridge/studio-recreation.ts`
- `*/resources/studio/prompts/*`
- `*/resources/studio/skills/*`
- `*/resources/h3-skill/*`
- `*/resources/prompts/*`
- `*/resources/seed/*`
- `*/db/migration/*`
- `*Seeder.java`
- `*DataInitializer.java`
- `*Prompts.java`
- `*/aep/clip/*`

军师快出片（`aep/clip`）是另一个产品，「快出片」是它的名字。「出图提示词」「出图描述」是导演台和提示词库共用的名词，不是按钮，放行。

## 扫描放行

- `例：赋能、闭环、生态位`
- `https://.../plugin.js`
- `先聊思路，再出图`
- `先看看这个开头`
- `出图提示词`
- `出图描述`
- `方便出图`

## 不能动的文字

- **被代码当逻辑判断的文字**：
  - 画布名「空白画布 · 新画布」「· 新画布」「未命名画布」（`startNewCanvas` 复用、起名靠它判断）。
  - 导演台 `PASSING_NOTICE`（`ip/director/director-workbench.tsx`）按服务端原文判断，改要两边一起改。
  - 工作记录里的「N 个对象」（`CreateNodesTool`、`ReadCanvasTool`、`UpdateNodesTool`、`ViewImagesTool`）。
  - 服务端 `CreditService` 的「积分余额不足，本次操作需 X，当前可用 Y」，`StudioPaymentMessage` 用正则读它。
  - 技能名「出图」「出视频」显示在助手头部，真值在 `resources/studio/skills/*.md`。
  - `failure.message` 的匹配，改报错前先 `git grep` 这句话。
- **提示词和拼给模型的话**：`resources/studio/prompts/**`、`resources/studio/skills/**`、`resources/h3-skill/**`、`DirectorPrompts`、场景目录的 `compose`、`composeStarter` 拼出的句子。
- **其它**：
  - 用户口吻的快捷答复（`StudioExecutionSummary` 的建议）和首页四个示例按钮（复刻一条短视频 / 做一个 IP 形象 / 写一段短剧 / 搭一套创作流程）。
  - 产品名 IP Studio、AiAvatar，品牌位「IP Studio · 声量引擎旗下」，标语「一个 IP，无限可能」。
  - 授权凭证（`DapLicenseService`）和授权范围（`DapConsentService.PLATFORMS` 及 `proto/api.ts` 同形的 mock）。
  - vendored 画布只改 `src/canvas/locales/zh-CN.ts`，改了留注释。

## 报错出口

用户操作失败一律走 `reportStudioError`（`src/ip/studio-errors.tsx`），导演台用 `useStudioFailure`。弹窗标题「X 没有完成」，错误码和追查号放「错误详情」。后台失败（自动保存、轮询）传 `background` 或 `once`。不另做横幅或 toast。

## 其它写法

- 时间用 `formatDateTime()`（`src/lib/datetime.ts`），不拼 `toLocaleString`，不 `slice(0, 10)`。
- 数字用 `formatCredits`、`formatCompactNumber`。
- 生成的图和视频标「AI 生成」（`TODO.md` 记着 AI 视频和 AI 图片还没做）。

## 怎么验证

- **本地打开页面**：演示模式缺很多接口，要用真后端。
  - 后端：`devq backend build --cwd <仓库>/apps/server -- -o -q -DskipTests package`，再 `devq backend start <构建ID> --name <名字> --port <端口> --profile dev -- "--spring.datasource.url=jdbc:h2:file:<库副本>;MODE=MySQL;AUTO_SERVER=TRUE;DB_CLOSE_DELAY=-1" --aep.dev-auth.enabled=true --aep.enterprise.enabled=true`。
  - 前端：`devq service start --name <名字> --budget next --port <端口> --cwd <仓库>/apps/web-aiavatar -- env NEXT_PUBLIC_USE_MOCK=0 NEXT_PUBLIC_AUTH_MODE=legacy NEXT_PUBLIC_ENTERPRISE_ENABLED=1 NEXT_PUBLIC_SERVER_API_BASE=http://127.0.0.1:<后端端口> pnpm exec next dev --webpack -p <端口>`。
  - 登录：页面里 `POST /api/auth/dev-login`，把返回的 `token` 写进 `localStorage` 的 `aiavatar_token` 和 `aistareco.auth.token`。
  - 用完 `devq service stop`。
- **本地看不到的**：H3 模型和折扣活动只有线上有，折扣悬停、优化另计要在线上 `/video?scene=ecom-talking` 只读确认，不发起生成。
- **检查**：`AGENTS.md` §9「1b」的门禁；`devq run --name typecheck-aiavatar --cwd <仓库> -- pnpm --filter @ai-star-eco/web-aiavatar typecheck`。全量测试交给 PR 的 CI，工作流只在 PR 和手动触发时跑。
- 宽度 1440 和 1280 各看一次；改了布局再跑 `/impeccable critique`。

## 记录放哪

- 改动记录：`docs/audits/pc-ui-copy-review-2026-11.md`，按批次加表。
- 没改的存量：`TODO.md`「时间显示与文案统一」段的「PC 站文案全面优化后的存量」。
