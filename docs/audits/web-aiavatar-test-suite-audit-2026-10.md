# web-aiavatar 测试集审计（2026-10-20）

> 范围：`apps/web-aiavatar` 的 vitest，从 main `3dbca7d2` 测量。逐条分类在文末附录 A–D（四份独立审计原样收录）。
> 状态：**用户 2026-10-20 确认「都做，再压缩」，已实施**，结果见第 5 节。

## 1. 先说结论

1. **用例条数不是耗时来源。** 1056 条里有 454 条在 node 环境跑，合计只花 **17 秒**；其余 602 条在 78 个 jsdom 文件里，占了 662 秒用例时间里的 **662 秒**。删掉一百条纯逻辑用例，运行时间基本不会变。
2. **单条 4–15 秒、以及「119 条失败」，几乎全是 CPU 争用。** 默认配置下 vitest 开 9 个 worker，每个 worker 起一个 jsdom 环境再加载 antd、画布模块，测试自己就把负载顶到 110–125（10 核机器）。同一批 23 个中等文件，串行跑用例合计 **41.6 秒**，全量并行时测出来是 **343 秒**；`studio-select` 首条用例从 11.2 秒降到 0.25 秒。超时报的失败都是这个原因，用例本身没问题。
3. **能安全删除或合并的大约 63 条（占 6%），省下的实际时间不到 15 秒。** 四份审计逐条看过之后，大部分用例要么钉着事故（注释里有日期、§8.0.1 编号或 Codex 复核记录），要么钉着计费、幂等、不丢数据这类不变量；还有 47 条是结构测试。可删的只剩只换了参数的近似用例，以及同一行为在 jsdom 和 node 里各测了一遍的情况。
4. **真正有效的是三项不删保护的改动**：限制并发、改用假计时器，以及把一个 jsdom 文件整个并进另一个（第 3 节）。

## 2. 量化

| 口径 | 墙钟 | 失败 | 累计（transform / collect / environment / tests） |
|---|---:|---:|---|
| 首轮全量，机器同时在跑其它会话的浏览器（load ≈ 112） | 290 s | 20（全是 5 s 超时） | — / — / — / 679 s |
| 全量，机器较空闲，默认 worker 数 | 102–107 s | 3 | 18 / 198 / 211 / 303 s |
| 全量，`--maxWorkers=4` | 107 s | **0** | 13 / 96 / 95 / 147 s |

- 「每次要跑 3–5 分钟」是和开发服务器、浏览器脚本同时跑的情况。单独跑大约 100 秒。
- **把 worker 限到 4 个，墙钟不变，CPU 消耗减半，超时假失败从 3 条降到 0。** 争用之下多开 worker 并不会更快。
- 默认配置下，机器空闲时也稳定有 2–3 条假失败：`studio-create-home` 的两条，加上 `studio-workspace` 的「frame-intent confirmation…」或「closing the editor waits for cloud save…」二者之一。
- 剩下的墙钟主要花在**每个 jsdom 文件的固定开销**上：建 jsdom 环境加导入模块，约 1.5 秒一个文件，78 个文件。这部分没法靠删用例省下来。

最慢的文件（`--maxWorkers=4` 时的用例耗时）：`studio-workspace` 22.8 s（85 条）、`project-sync` 16.5 s（31 条，其中约 14 s 是真实的防抖等待）、`studio-assistant` 12.5 s（61 条）、`studio-create-home` 4.5 s、`generation` 3.0 s（两条用例在等真实的 1.5 s 轮询）。全量并行时（第一轮、负载高）的前 25 名和每条用例耗时见附录。

## 3. 建议改动（按收益排）

### 3.1 不删保护的提速（推荐全做）

| 改动 | 预计收益 | 风险 |
|---|---|---|
| `vitest.config.ts` 限制并发：`maxWorkers` 设为约一半核数；顺手把已被标为 deprecated 的 `environmentMatchGlobs` 迁到文件头的 `@vitest-environment` 注释（两份文件已经在用这种写法） | 消除超时假失败；CPU 减半，和开发服务器一起跑时互相拖得少；墙钟基本不变 | 低。`setup-storage.ts` 不动 |
| `project-sync.test.ts` 有 13 条用例在真等 900 ms 防抖或 `sleep(1200)`，照同文件里已经在用的 `vi.useFakeTimers()` 写法改 | 约省 14 s（这个文件 16.5 s → 约 2.5 s） | 断言不变 |
| `generation.test.ts` 两条「停止」用例在等真实的 1.5 s 轮询，改用假计时器 | 约省 3.5 s | 断言不变 |
| `studio-create-home` 的删除用例只要 1 份画布就够，不用默认的 27 份 | 约省 1.5 s，也消掉一条常见的假失败 | 无 |
| `studio-media-generation-state.test.tsx` 并进 `studio-flow-card.test.tsx`（`test.each` 和对方的断言重复，剩下的排队用例挪过去） | 少一个 jsdom 文件，约省 3.5 s | 无 |

### 3.2 删除或合并用例（约 63 条，不丢保护）

| 文件 | 删/并 | 说明 |
|---|---:|---|
| `ip/studio-workspace.test.tsx` | 14 | 85 → 71。三条「fixed 模式只配一个模型」的用例测不到 fixed 分支，和 selectable 用例完全重复（#76 #79 #81）；#84 并进 #83（规则已由 `studio-video-selection.test.ts` 覆盖，删除参考的步骤要一并挪进 #83）；#24 和 #23 只差一条错误消息；其余是同一种初始状态的近似用例，合并到一次 render 里 |
| `ip/studio-assistant.test.tsx` | 7 | 61 → 54。#1 只断言旧的四模式界面不存在；#9 #32 → #7；#27 → #4；#23 → #20；#28 与 store 测试重复；#42 → #54 |
| 中段 23 个 jsdom 文件 | 3 | create-home #6 → #1，project-sync #3 → #1，demo-admin #1 的结构断言并进 #3 |
| 其余 101 个文件（多为 node） | 36 | 同一纯函数只换参数的用例并成一条（如 `app-chrome` 三条 `?start=` 走的是同一条路径；`review-edge-cases` 有一条和 `video.test.ts` 逐字相同） |
| **合计** | **约 60–63** | 1056 → 约 993。实际省时间不到 10 秒，主要价值是少维护几条 |

代价：失败信息会变粗一些，几条断言并进一条用例后，报错只能说明「这一组里有一条错了」。下面两条要借合并的机会**补上**，否则就是覆盖缺口：
- fixed 模式下**有多个模型**时也必须禁用选择。目前没有任何用例测这个，这是原本就有的缺口。
- #84 删除参考后，模式要回退到原来的状态。这一步必须真的挪进 #83。

### 3.3 需要你拍板

1. **11 条只测上游画布页的用例**（`canvas-node-video`、`canvas-node-prompt-panel`、`docked-overlays` 三个文件，约 7 秒）。被测的 `canvas/pages/canvas/project.tsx` 全仓没有任何地方引用，Studio 里打不开这个页面。删掉的代价是：以后如果有人把这个页面重新挂上，本仓对 vendored 组件的几处改动就没有测试守着了。我倾向于**保留**：AGENTS.md 要求搬进来的画布尽量少改、改了要留痕，这几条测试就是那些痕迹。
2. **两条要先改业务代码才能变窄的用例**（workspace #51 #52）。选文本模型的规则在 `studio-workspace.tsx:819` 和 `studio-text-composer.tsx:20` 各写了一遍，违反 §8.0.1 ④。这次任务约定不改业务代码，所以只**登记为后续待办**，这两条用例本轮不动。

### 3.4 不建议做的

- `isolate: false` 或改用 happy-dom：能明显降低每个文件的固定开销，但会碰到 §8.0.1 ⑬ 的 Storage 保护，以及 `project-sync` 跨用例共享的保存队列。用例之间串状态，正是 10-05 那次 CI 红而本机绿的原因。
- 为了省时间把 jsdom 文件大量合并成一个：省下的是每个文件约 1.5 秒的启动时间，但会让用例之间共享模块状态，失败时也更难定位。

## 4. 预计效果

| 方案 | 用例数 | 单独全量墙钟 | 假失败 |
|---|---:|---:|---:|
| 现在 | 1056 | 约 100–107 s（和别的东西一起跑 290 s） | 默认配置 2–3 条，高负载 20 条 |
| 3.1 + 3.2 | 约 993 | 预计约 85–95 s；CPU 消耗减半，和开发服务器一起跑时降得最多 | 预计 0 |

墙钟降得不多，原因是剩下的时间大部分花在 78 个 jsdom 文件的启动上，不在用例里。要再大幅降，只能减少 jsdom 文件的数量或每个文件导入的模块，这需要先改组件的拆分方式，不在这一轮的范围内。

## 5. 实施结果（2026-10-20）

**用例 1056 → 963（−93，−8.8%），文件 136 → 133。** 合入 main（`ed2a405e`，期间 main 新增了 33 条用例）后：**main 1089 条 → 996 条**，137 个文件，负载约 50 时全量 169 秒全绿。助手测试因为 main 改了快捷回复的行为（点了就发送），以 main 版本为准重新精简了一遍（64 → 50），main 新增的事故用例全部保留。 比清单多删的部分来自「再压缩」：assistant 多并 7 条，account-navigation 19 条并成 3 条循环，models 3 条并成 1 条。被并掉的用例，其独有断言都挪进了宿主用例。

| 组 | 改动 |
|---|---|
| 配置 | `maxWorkers: "50%"`、`testTimeout: 15_000`；删掉已被标为 deprecated 的 `environmentMatchGlobs`，`project-sync` / `layout-mode` 改在文件头写 `@vitest-environment jsdom`。`setup-storage.ts` 没动 |
| studio-workspace | 85 → 70。补了两条覆盖：fixed 模式下有多个模型也必须禁用（删掉 fixed 判断后这条会变红），以及删除参考后模式回退。选文本模型的规则收进 `canvas-bridge/studio-text-model.ts`（`studioChosenTextModel`），`studio-workspace.tsx` 和 `studio-text-composer.tsx` 都改为调用它，行为不变，新增 5 条 node 测试。#22 #58 改用假计时器 |
| studio-assistant | 61 → 47。固定的 600 ms 等待改成按条件等；`mocks/studio-dialogue.test.ts` 改在 node 环境跑 |
| 中段 23 个文件 | jsdom 用例 217 → 208，另有 7 条纯函数用例挪到 node（新建 `canvas-bridge/studio-storyboard.test.ts`、`ip/library-extraction-source.test.ts`）。`project-sync` 全部改用假计时器，16.5 s → 0.4 s |
| 其余 | 附录 D 列的 36 条合并全部做完。`generation` 改用假计时器，3.7 s → 0.05 s。删掉 `studio-media-generation-state`（排队用例挪进 `studio-flow-card`）；signed-audio / signed-video 并进 `signed-media`；删掉只测上游画布页的三个文件，共 11 条 |

**耗时对比**（同一台机器上 main 和精简版交替跑。其它会话一直在跑 Java 和浏览器，机器始终空不下来，所以各轮之间的绝对数字不能直接比，只能比同一轮内的两组）：

| 轮次（当时负载） | main 3dbca7d2 | 精简后 |
|---|---|---|
| 1（72–227） | 144 s，2 条超时失败 | **109 s，0 失败** |
| 2（150–175，极端） | 526 s，98 条超时失败 | **469 s，24 条超时失败** |
| 加上 15 s 超时后（≈98） | — | 322 s，4 条失败，单独重跑全过 |

- 机器空闲时，main 跑一遍约 100–107 s（第 2 节）；精简版这次没能等到空闲窗口实测。按用例累计时间推算（tests 303 s → 约 160 s），空闲时预计 70–90 s。
- 极端负载下仍会出现假失败：一部分是首条用例超过 15 s，一部分是 Testing Library 默认的 1 s `waitFor`。这些用例单独跑都能过，属于和别的进程抢 CPU，不是用例坏了。要彻底稳定，只能别和开发服务器、浏览器脚本同时跑。
- typecheck 通过（`tsc --noEmit`）。
- 顺手发现、没有修的问题记进了 `TODO.md`：剧本面板的模型选择器显示值不看 fixed 模式（同一条规则的第三份写法）；`studioComposerTake` 和对话框写在同一个 `.tsx` 里，node 测试要 mock antd 才能引用它；`studio-video-prompt-wiring` 第 3 条只读那个没被引用的上游页面。

---

## 附录 A · studio-workspace.test.tsx 逐条


基线：85 条 / 162.5 秒 / jsdom。仓库：`仓库根目录`（只读，没有改任何文件）。
编号按 timings.tsv 里的顺序。标了 failed 的 5 条（#14 #20 #34 #82 #83–85）都是机器负载下 5 秒超时造成的假失败，耗时偏高。

### 先说结论里最要紧的一点：合并成一次 render 省不了多少

- 最便宜的几条（#63 0.10s、#41 0.14s、#42 0.19s、#64 0.23s）本身就要挂一次完整的 `StudioWorkspace`。所以**挂载本身只要约 0.1–0.4 秒**。
- 慢的用例慢在**挂载之后**：一串 `findBy`/`waitFor`、capabilities/models 的 Promise、保存 Promise，以及两条走真实轮询定时器的用例（#22 `timeout:3500`、#58 `timeout:3000`）。这些等待合并后还在。
- 估算：把初始状态相同的用例并成一次 render，被并进去的那条一般只能省下 **60–75%**（主要是省掉 openVideo + 模型加载）。下面合并组的估算都按这个比例算。把所有同初始状态的用例全并掉，比下表再多省大约 5–8 秒，但用例之间会互相带状态（提交之后节点就变成 success），不建议这么做。

### 逐条分类

| # | 用例名（前 60 字） | 耗时 | 分类 | 理由 |
|---|---|---|---|---|
| 1 | plain text editing keeps extraction and body in one panel w | 2.53 | UNSURE | 只断言「只有一个 dialog、里面有提取资产按钮」，偏结构；但名字像是在钉「出现过两个工具条」的回归。和 #71 部分重叠。要先确认有没有对应事故再决定删 |
| 2 | image composer targets its own upload slot and retains the  | 3.73 | KEEP | `upload-image` 命令带 nodeId、`image-uploaded` 后关闭面板，是命令契约 |
| 3 | image composer only offers ratios stored on the selected mo | 3.83 | KEEP（合并的宿主） | 比例来自端点、旧的不支持的草稿被拦。逻辑写在 `studio-workspace.tsx:820-846` 组件里，**没有纯函数**。#5 #6 并进来 |
| 4 | image composer submits the exact chosen resolution and reta | 4.15 | KEEP | 请求体 size/aspectRatio/maxCost 契约，草稿也存了 size |
| 5 | image composer uses the selected endpoint prompt limit inst | 1.29 | MERGE→#3 | 初始状态和 #3 一样（idle 图片 + 打开图片面板）。只要 mock 的 capability 多带 `imagePromptMaxChars:20000`，就能在同一次 render 里断言 |
| 6 | image composer lists only batch sizes returned for the sele | 1.35 | MERGE→#3 | 同上，capability 加 `imageBatchCounts:[1,3,5]` 即可。`models.test.ts` 已经覆盖了 `imageBatchCountsFor` |
| 7 | image result actions stay on the image node toolbar rather  | 0.75 | KEEP | 按钮放在节点工具条而不在生成面板，是设计规则；很便宜 |
| 8 | editing reference images on an existing image generates in  | 0.86 | KEEP-INCIDENT | 不新增子节点、旧版本保留、下游标 upstreamChanged（数据不丢） |
| 9 | video generation shows video controls without result or ima | 0.78 | MERGE→#29 | 默认 Host 加 openVideo，只看按钮在不在；可以在 #29 打开面板那一刻一起断言 |
| 10 | regenerating an existing shot video keeps its node, connect | 1.46 | KEEP-INCIDENT | 原地重出：节点和连线不变，旧版本保留 |
| 11 | regenerating an existing work video keeps its node, connect | 0.89 | KEEP-INCIDENT | 同上，kind=work |
| 12 | regenerating an existing undefined video keeps its node, co | 1.49 | KEEP-INCIDENT | 同上，没有 studio 字段的旧节点。`studio-nodes.test.ts` 有类似的窄测试，但没有提交请求那一步；保守起见保留 |
| 13 | script creation can reference characters without image or v | 2.28 | MERGE→#32 | 只看剧本面板里有哪些按钮；#32 本来就打开剧本面板，可以在那里断言 |
| 14 | storyboard script creation stays in detail and canvas refer | 6.02 | KEEP | 从故事板选参考再回来，要有一条真实的边且已保存、没有提交；#59 只覆盖画布入口（超时假失败） |
| 15 | a lost submit response replaces ordinary generation with sa | 4.44 | KEEP-INCIDENT | 幂等：响应丢了用同一个 key 确认，编辑过草稿也不换 key |
| 16 | refresh restores cancelled queue semantics without replayin | 0.40 | KEEP-INCIDENT | 刷新后不重放、不提交 |
| 17 | retrying a failed native video keeps 按原文生成 from the save | 1.41 | KEEP-INCIDENT | 注释里写了 Codex review 47c057ea |
| 18 | refresh with an active accepted batch offers its existing t | 2.13 | KEEP-INCIDENT | 已受理的任务不能被重复提交 |
| 19 | refresh of an unknown outcome confirms the original body; r | 1.90 | KEEP-INCIDENT | 结果未知时，网络失败不能放出新 key |
| 20 | a definite unaccepted STUDIO_PRICE_CHANGED server rejection | 6.93 | KEEP-INCIDENT | 明确被拒才放出新 key（错误码契约）（超时假失败） |
| 21 | a definite unaccepted ENDPOINT_NOT_ALLOWED server rejection | 2.57 | KEEP-INCIDENT | 同上，换成 503；状态码不同可能走不同分支，保留 |
| 22 | polling failure on an accepted batch keeps the original tas | 1.93 | KEEP-INCIDENT | 轮询失败不能补交。走真实轮询定时器（timeout 3500），换成假定时器能省时间，但有风险 |
| 23 | a local save offline during unknown-task recovery retains t | 1.79 | KEEP-INCIDENT | 保存失败不提交，原请求不变 |
| 24 | a local document conflict during unknown-task recovery reta | 2.52 | MERGE→#23（删） | 两个参数的 mock 都是 `new Error(failure)`，只是消息不同，没有冲突专用的错误类型，走的是同一条分支 |
| 25 | a known active batch keeps ordinary generation locked when  | 1.20 | KEEP-INCIDENT | 保存不可用时，已知的活跃任务不能被重新提交 |
| 26 | an unknown speech task retains its original identity across | 1.18 | KEEP-INCIDENT | 配音任务：原 key 和正文不变 |
| 27 | an unknown lip task retains its original identity across a  | 1.65 | KEEP-INCIDENT | 口型任务：提交函数不同，保留 |
| 28 | video generation persists and submits the full edited camer | 1.83 | KEEP | 完整的镜头要求原样进 prompt 并持久化；和 #10 有部分重叠，但 #10 不看持久化和保存 |
| 29 | closing and reopening the unified editor preserves an edita | 3.47 | KEEP（合并的宿主） | 关掉再打开，草稿还在；#9 #62 #75 并进来 |
| 30 | opening immediately after adding a node resolves the new do | 0.82 | KEEP | 「props 还没跟上」的竞态 |
| 31 | closing the editor waits for cloud save and keeps the draft | 1.65 | KEEP-INCIDENT | 保存失败不关面板（防丢草稿） |
| 32 | a new canvas script resumes its saved draft and generation  | 1.14 | KEEP（合并的宿主） | 草稿恢复，生成填回同一个节点；#13 并进来 |
| 33 | a lost script rewrite response confirms its successor reque | 1.47 | KEEP-INCIDENT | 不多建一个付费节点 |
| 34 | saving an existing script is free and retries the same draf | 5.47 | KEEP-INCIDENT | 免费，重试不重复建节点（超时假失败） |
| 35 | editor save failure retains edited script and splitting aft | 2.98 | KEEP-INCIDENT | 不恢复过时内容。`studio-script.test.ts`「splits the edited body…」覆盖了拆分本身，但保存失败这一段只有这里测 |
| 36 | task history retains a replaced failure after refresh and p | 1.59 | KEEP | 分页 + 不提供重新提交；和 `studio-task-list.test.tsx` 部分重叠 |
| 37 | reopening reconciles added/removed graph references with th | 1.16 | KEEP | 草稿和图上的边对账 |
| 38 | a text wired into a video is visible and its current conten | 1.58 | KEEP | `withStudioLinkedText` 有窄测试；这里钉的是组件真的接上了，且请求快照等于提交的内容 |
| 39 | removing a wired text from the composer removes its edge be | 1.86 | KEEP | 删引用会同时删边；可以和 #38 共用一次 render（提交后删掉再交一次），保守起见先不并 |
| 40 | cutting an incoming media edge updates an open composer wit | 1.35 | KEEP | 外部剪断边后，打开的面板同步更新 |
| 41 | a template image node opens its execution step without open | 0.14 | KEEP | 便宜，模板步骤路由 |
| 42 | a template video node opens its execution step without open | 0.19 | KEEP | 同上 |
| 43 | blank and unaccepted template videos cannot enter assembly; | 0.65 | KEEP | templateAccepted 门 |
| 44 | work settings survive remount without assembly, and a faile | 1.94 | KEEP-INCIDENT | 保存失败编辑器不关 |
| 45 | assembling a recreation canvas leaves out the original the  | 0.75 | KEEP-INCIDENT | 2026-10-19 用户报障（爆款复刻）。`studio-work-clips.test.ts` 有窄测试，这条钉的是最终请求体 |
| 46 | exporting from the advanced editor submits an assemble run  | 0.65 | KEEP-INCIDENT | 2026-10-19，高级编辑导出的契约 |
| 47 | assembly resumes saved packaging and adds the actual audio  | 0.76 | KEEP | packaging 请求体，加配音依赖边 |
| 48 | selected episode survives saving the Markdown editor, closi | 1.38 | KEEP | 重新挂载后分集选择还在 |
| 49 | an adaptation draft restores its mode, chosen story and set | 2.20 | KEEP | 改编请求体 mode/settings，用的是当前故事快照 |
| 50 | completed-script edits … 'selectable' (previous model avail | 2.49 | KEEP | 保留一条集成用例：已受理请求不变、拆分请求带 settings 和正文 |
| 51 | completed-script edits … 'fixed' (previous model available: | 2.32 | SLOW-NARROW | 只是换个参数测选模型规则 `studio-workspace.tsx:819 chosenTextModel`。改成 node 窄测试需要先抽出纯函数 |
| 52 | completed-script edits … 'selectable' (previous model avail | 2.68 | SLOW-NARROW | 同上 |
| 53 | editing or removing a plain story flags its adaptation and  | 0.62 | KEEP | `markStudioDescendants` 有窄测试；这条钉的是 effect 接上了 + 已受理请求不变 |
| 54 | the image download uses the newly adopted take and never cr | 0.37 | KEEP | 下载用的是采用版本的 key，不创建 run |
| 55 | the video download uses the newly adopted take and never cr | 0.59 | KEEP | 同上 |
| 56 | a selected video with two takes keeps 问助手, 重新生成视频 and | 0.38 | KEEP | 画布改版的设计规则（工具条最多两个主操作），便宜 |
| 57 | a queued video shows waiting instead of fake progress and c | 1.23 | MERGE→#58 + task-list（删） | `studio-task-list.test.tsx`「queued jobs display queue order rather than an invented progress bar and expose original cancellation」覆盖了同一件事；`cancel('accepted')` 那条线 #58 也覆盖了 |
| 58 | queue polling advances the displayed position and stops aft | 1.66 | KEEP | 轮询更新位次、停止后 queue 置 null。走真实定时器 |
| 59 | canvas reference picking keeps the original draft and creat | 0.52 | KEEP | 只建一条边、草稿不变 |
| 60 | switching node composers preserves each independent draft w | 0.89 | KEEP | 每个节点的草稿互不影响 |
| 61 | a previous panel save cannot close a newly selected node co | 1.04 | KEEP | async session guard 竞态 |
| 62 | task utility stays visible when a node composer opens | 0.71 | MERGE→#29 | 默认 Host；先开任务面板再 openVideo，可以放进 #29 的开头 |
| 63 | legacy editor entry opens the assistant business node witho | 0.10 | KEEP | 便宜；`studio-node-command.test.ts` 测的是纯路由，这条测的是 `editor` 事件的入口 |
| 64 | legacy editor entry opens the batch business node without t | 0.23 | KEEP | 同上 |
| 65 | ordinary node opening keeps lip sync anchored to its explic | 0.39 | KEEP | 口型的打开节点固定（v0.223 规则） |
| 66 | removing an earlier video reference preserves surviving men | 0.68 | KEEP | `rebindStudioVideoMentions` 有窄测试；这条钉的是删掉后生成被禁用 |
| 67 | opening and reopening a template draft keeps empty upstream | 1.06 | KEEP | `studioLinkedInputError` 有窄测试；这条钉的是重新打开后空槽的边还在 + 提交前拦下 |
| 68 | storyboard opens an ordinary image in an embedded creator w | 0.45 | KEEP | 和 `studio-storyboard.test.tsx` 部分重叠，便宜 |
| 69 | view switching saves a creator draft; a failed save retains | 1.41 | KEEP-INCIDENT | 保存失败保留编辑器（防丢草稿） |
| 70 | storyboard node switching persists the original creator dra | 3.34 | KEEP-INCIDENT | 同上，故事板里切节点的路径 |
| 71 | plain text detail edits the original node, follows incoming | 2.03 | KEEP | 改原节点、保存失败重试、图不变 |
| 72 | storyboard script composer shows instructions while the sub | 2.22 | KEEP | 请求快照是当前格式化的文档 |
| 73 | text intent uses the chosen model and rewrites the original | 2.30 | KEEP-INCIDENT | 正文不被指令替换、不复制节点、请求带 model/maxCost |
| 74 | queued text edits keep the body, show queue position and pr | 0.60 | KEEP | 防重复提交 |
| 75 | a completed video exposes recreation from its own composer  | 1.26 | MERGE→#29 | 默认 Host + openVideo；在 #29 末尾点「解析视频」再断言即可 |
| 76 | image composer displays its single configured model in fixe | 0.53 | MERGE→#77（删） | 只有一个选项时，`disabled = candidates.length<=1 \|\| mode==='fixed'`（L1084），fixed 这个条件根本没被测到，和 selectable 那条完全重复 |
| 77 | image composer displays its single configured model in sele | 0.80 | KEEP（合并的宿主） | 一次 render 里依次打开图片、文本、剧本三个面板（capability 合在一起），每个面板都断言单模型可见且禁用 |
| 78 | image model switching submits the selected endpoint and its | 3.44 | KEEP | 请求带端点和价格 |
| 79 | text composer keeps its single configured model visible in  | 0.91 | MERGE→#77（删） | 理由同 #76（`studio-text-composer.tsx:24`） |
| 80 | text composer keeps its single configured model visible in  | 2.48 | MERGE→#77 | 并进 #77 那一次 render |
| 81 | script composer shows its single fixed model outside collap | 0.96 | MERGE→#77（删） | 理由同 #76（L1088） |
| 82 | script composer shows its single selectable model outside c | 6.16 | MERGE→#77 | 并进 #77；「不在折叠设置里」（`closest('details')`）一并断言（超时假失败） |
| 83 | native video adds references from text mode without losing  | 7.31 | KEEP（合并的宿主） | 集成钉子：建边 + 请求带首尾帧和 maxCost 320。中间几步模式切换已被 `studio-video-selection.test.ts` 覆盖（超时假失败） |
| 84 | native video removes the last reference back to text and re | 6.25 | MERGE→#83 | `studio-video-selection.test.ts`「moves … and back as inputs are removed」「keeps an explicit compatible mode…」覆盖了规则。组件里删除这条线可以在 #83 提交前补一步（删掉 last 变回图生视频，再加回来）（超时假失败） |
| 85 | frame-intent confirmation opens the compact picker, preserve | 5.56 | KEEP-INCIDENT | 47c057ea 的 H3 首尾帧意图，不提前提交。`studio-video-prompt.test.ts` 覆盖了识别逻辑，这条钉的是界面流程 |

### 汇总

| 分类 | 条数 |
|---|---|
| KEEP-INCIDENT | 27 |
| KEEP | 41（其中 5 条作为合并的宿主：#3 #29 #32 #77 #83） |
| MERGE | 14（#5 #6 #9 #13 #24 #57 #62 #75 #76 #79 #80 #81 #82 #84） |
| SLOW-NARROW | 2（#51 #52） |
| COPY-ONLY | 0 |
| UNSURE | 1（#1） |

**能减掉的 jsdom 用例**：16 条（14 条合并或删除 + 2 条改成 node 窄测试），85 → 69，外加 1 条 node 用例。

**预计省时**（按 timings 算，合并进去的按 60–75% 计；超时假失败的耗时偏高，所以给一个区间）：

| 组 | 省时 |
|---|---|
| #5 #6 → #3 | ~2.0s |
| #9 #62 #75 → #29 | ~2.0s |
| #13 → #32 | ~1.7s |
| #24 删 | ~2.5s |
| #57 删 | ~1.2s |
| #76 #79 #81 删，#80 #82 → #77 | ~4–7s |
| #84 → #83 | ~4–5s |
| #51 #52 → node 窄测试 | ~4.5–5s |
| **合计** | **约 20–27 秒（162.5 秒的 12–17%）** |

**会失去的保护**
- #24：唯一的差别是错误消息。如果以后给「文档冲突」加专用的错误类型和分支，要重新补一条用例。
- #76 #79 #81：只有一个选项时 fixed 分支本来就测不到。fixed 模式下**有多个模型**也要禁用的情况，目前**没有任何用例覆盖**。这是一个本来就存在的缺口，不是删除造成的；可以借合并的机会补一条（两个模型 + fixed → 禁用）。
- #57：组件层面没人再断言「排队中且没有 0% 进度」；任务列表组件的测试还在测这件事。
- #84：必须真的把删除那一步补进 #83，否则组件里「删除引用 → 模式回退」这条线就没有集成测试了。
- #51 #52：前提是先把 L819 抽成纯函数。否则就是在删覆盖。

### 改成窄测试的前提，和顺手发现的问题
- `studio-workspace.tsx:819` 的 `chosenTextModel` 和 `studio-text-composer.tsx:20` 的 `selected` 是**同一条规则写了两遍**（违反 §8.0.1 ④）。把它抽成 `canvas-bridge` 里的纯函数（例如 `studioChosenTextModel(capabilities, model)`），两处都改成调用它，#51 #52 就能改成 node 测试。
- 图片面板的比例、尺寸、数量、提示词上限推导（L817–846）也写在组件里。抽成纯函数后，#3 #5 #6 的推导部分可以下放到 node，组件这边只留一条接线用例。这次没把它们标成 SLOW-NARROW，因为现在没有纯函数可以对应。
- #22 和 #58 等的是真实轮询定时器（约 1.2–3 秒）。换成 `vi.useFakeTimers` 能再省 2–3 秒，但和 `waitFor` 搭配容易出问题，没算进上面的估计。

## 附录 B · 创作助手相关逐条


范围：`apps/web-aiavatar/src/ip/studio-assistant.test.tsx`（61 条 / 76.8s）、`ip/studio-dialogue-execution.test.tsx`（3 / 1.4s）、`ip/studio-dialogue-check.test.tsx`（3 / 0.6s）、`ip/studio-conversation-start.test.tsx`（3 / 2.0s）、`ip/mocks/studio-dialogue.test.ts`（4 / 2.7s）；对照 node 环境的 `canvas-bridge/studio-dialogue-store.test.ts`（32）、`studio-dialogue.test.ts`（6）、`studio-assistant-context.test.ts`（6）、`studio-assistant-plan.test.ts`（5）、`studio-reply-actions.test.ts`（1）、`studio-conversations.test.ts`（2），另外顺带对照了 `canvas-bridge/studio-plan-execution.test.ts` 和 `ip/studio-entry.test.ts`（被测逻辑的纯函数版本在这两处）。
`ip/studio-dialogue-wiring.test.ts` 是结构测试，只拿来当依据，不标删。

读的仓库：`仓库根目录`。耗时取自 `timings.tsv`；标 failed 的是 5 秒超时（机器负载高），不是用例本身坏了。文件里第一条用例要吃掉冷启动（加载模块、首次 render），删掉它，这部分开销会转到下一条上。

### 总体判断

`studio-assistant.test.tsx` 的大多数用例都钉着事故（Codex 2026-10-19 P1/P2/R2、本地 e2e 2026-10-19、Production 2026-10-19、.studio-e2e D05/D10），或者钉着钱和数据的不变量：同一个 clientMessageId 重试、暂停和停止各用各的 request key、确认的上限而不是提议的上限、所选模型和它自己的 maxCost 一起发、首页那句话只发一次、保存失败的节点下次打开还能找回来、用户手改过的文字不被覆盖。**这个文件没有能大块删掉的东西。** 能省下的是几处和 node 环境 reducer 测试重复的 UI 测试，加上几条可以并进同一次 render 的用例，合计约 7 秒（约 9%）。

### studio-assistant.test.tsx（逐条）

| # | 用例名（前 60 字） | 耗时 | 分类 | 理由 |
|---|---|---|---|---|
| 1 | one continuous thread: no mode tabs, history picker, new-conv | 5.65s（超时） | COPY-ONLY | 主要是在断言旧界面（模式切换、历史下拉、新对话、感知画布开关）不存在，属于 DOM 结构。只有一处有点用：「助手模型」chip 在、「对话设置」按钮不在，这部分可以并进 #40/#41。`getConversation('p')` 其它每条用例都会隐式走到。建议删除，或把那一处模型断言挪到 #40。实际能省约 1s（冷启动会转给下一条）。 |
| 2 | the composer stays editable while a reply streams, and a tool | 5.21s（超时） | KEEP | 回复流式输出时还能发消息，并且请求带 `queueState: queued`、`maxCost: 21`、`model: one`；工作记录折叠、不露出工具原名。结构测试「composer is never disabled」只查 textarea 上没有 disabled，这条是行为层面的验证。store 测试覆盖了工具卡片 upsert，但没覆盖「流式中途发送」。 |
| 3 | send pins @ references, saves first, and a lost response is r | 6.88s（超时） | KEEP-INCIDENT | 钉住幂等：丢包后重试用同一个 clientMessageId；先保存再发；pinnedNodeIds 正确。 |
| 4 | a definite rejection gives the draft and references back for | 2.21s | KEEP | 明确被拒（503 `AI_TOKEN_PRICE_NOT_CONFIGURED`）时不出「重新发送」、草稿和引用放回。这是按错误码区分「可重试 / 不可重试」的契约。**接收 #27 的合并。** |
| 5 | stop goes through the priority control, not a new message | 2.54s | KEEP | 停止走 `control` 接口，不是另发一条消息（否则会多一轮扣费）；title 里写明会停掉进行中的制作。 |
| 6 | the plan shows the recommended approach first; choosing anoth | 0.59s | KEEP | 「改用这个做法」只往输入框里填字，不 post，也就不花钱。 |
| 7 | confirming production posts the execution, approach, plan rev | 0.71s | KEEP-INCIDENT | createExecution 的请求体全字段（budgetCap/autoFixCap/approvalId/approachId/expectedRevision）、上限低于报价时禁用、确认后的记录显示 120/30 而不是 122/40。**接收 #9、#32 的合并**（fixture 相同：planBlock + approvalBlock）。 |
| 8 | analysis is created without an execution; replaced and expire | 0.63s | KEEP | 分析阶段不带 executionId/approachId；被替代和已过期的卡不能确认（防止按旧报价开工）。 |
| 9 | 「先改改」 only focuses the composer | 0.69s | MERGE | fixture 和 #7 一样。在 #7 点「开始制作」之前先点「先改改」，断言焦点在输入框、createExecution 没被调用，然后接着走 #7。能省约 0.6s。 |
| 10 | old four-mode conversations stay readable under a collapsed 之 | 0.73s | KEEP | 旧数据仍可读，从旧节点进来时默认展开。别处没有覆盖。 |
| 11 | server canvas commands create nodes once, even when replayed, | 0.57s | KEEP | reducer 层的重放去重有 store 测试「replays canvas commands…」，投影层的有 plan-execution「replaying the same event changes nothing」。这条验证的是组件把两者接起来：保存，并把 `studio-dialogue-canvas-seq` 持久化。不算重复。 |
| 12 | a canvas command whose save failed is neither recorded as pro | 1.03s | KEEP-INCIDENT | Codex 2026-10-19 P1，丢数据。 |
| 13 | an assistant node whose save failed comes back… (after some p | 1.70s | KEEP-INCIDENT | Codex R2。用例里有一个固定 `setTimeout(600)`，可以换成等条件或复用 `settle()`，每个变体能省约 0.5s（这是提速，不是删用例）。 |
| 14 | an assistant node whose save failed comes back… (as the first | 1.28s | KEEP-INCIDENT | 同上，test.each 的另一个变体。两个变体走的是不同的代码路径（有正文时有占位消息，空线程时没有），不建议并。 |
| 15 | a text proposal is adopted only while the node still holds th | 0.26s | KEEP-INCIDENT | 不覆盖用户手改的内容（丢数据类不变量）。 |
| 16 | question options and follow-up suggestions only fill the comp | 0.42s | KEEP | 选项和建议只填进输入框，不 post。 |
| 17 | 「从这里重新开始」 branches from that message and shows the new | 0.25s | KEEP | branch 请求体，并且流切到新线程 th2。 |
| 18 | 「就用这版」 on a check node records the inspected run on its ow | 0.19s | KEEP | 接收端：accept 带 stepId=v1、runId=run-v1；redo 发出 `{action:'video'}`。check 测试 #2 测的是发送端，两条合起来才是一个闭环，不算重复。 |
| 19 | the production strip pauses or stops through the execution en | 0.89s | KEEP-INCIDENT | 暂停和停止各用各的 clientRequestId，并带 expectedStatus（幂等）。 |
| 20 | (a) a canvas opened after its execution finished gets the pro | 0.68s | KEEP-INCIDENT | D05。plan-execution (a) 测了纯投影；这条测的是读 execution、读 run、保存、写 projected 记录、游标从 0 开始，这些只在这里有。**可接收 #23 的合并。** |
| 21 | (a2) a restore whose save failed is restored again on the next | 1.75s | KEEP-INCIDENT | 保存失败后还能再恢复（丢数据）。 |
| 22 | (b) opening it again adds nothing and reads no runs; a node de | 2.57s（超时） | KEEP-INCIDENT | 不重复读 run、不重复保存、用户删掉的节点不重建（墓碑）。plan-execution R6-02 只测了纯函数 `executionOutputMissing`，「不再读 run、不再保存」只有这条在测。 |
| 23 | (c) text the user already rewrote on a produced node survives | 1.90s | MERGE | 纯函数层面和 plan-execution「(c) a node the user already edited is left exactly as it is」一模一样。组件层多出来的只有一点：`getRun` 不读 r-facts。可以并进 #20：(a) 改用 `initial=[mine]`，断言 mine 原样保留、其余三个节点照常恢复、没有「修改建议」、`getRun` 没读 r-facts；「恢复的文字来自 run」这条断言改到 limits 节点上。保护不丢，能省约 1.5s。拿不太准的话就保留，这条是丢数据类。 |
| 24 | the canvas restores on open even with the panel closed when it | 0.44s | KEEP | `restorePending` 路径：面板关着不拉对话，缺产出时照样恢复。 |
| 25 | a confirmed card shows the authorized caps and when; without t | 0.72s | KEEP-INCIDENT | D10，从不显示提议的 1000。后半段（旧卡没有服务端快照，回落到 execution 预算）在 reducer 层被 store 测试「a confirmed card reports what was actually authorized」覆盖了，可以删掉后半段的第二次 render，省约 0.3s。前半段（渲染文字 + formatDateTime + 第几版方案）保留。 |
| 26 | first open on this browser replays execution commands from the | 0.98s | KEEP-INCIDENT | store 测试「first open without a canvas cursor replays from the start」测了 reducer；这条测的是接上投影之后，快照之后的命令只出修改建议、不覆盖。 |
| 27 | a message that would not fit the stage budget says by how much | 1.48s | MERGE | 和 #4 是同一个行为（明确被拒，草稿保留，不出「重新发送」），只是换了错误码（402 `STUDIO_PLAN_BUDGET_EXCEEDED`）和提示文字（还差 30 积分）。在 #4 的同一次 render 里接着发第二条、让它 402 被拒，断言两种错误码都没出「重新发送」，两段提示文字都出现。能省约 1.2s。 |
| 28 | a message queued during an execution without a turn waits as q | 0.68s | MERGE | 和 store 测试「a message queued while an execution runs may come back without a turn」是同一个行为：status 为 queued、没有 activeTurnId、标签是「排队中，下一步应用」。UI 层的「不出停止按钮 / 不出正在准备回复」由 activeTurnId 推出来，#32（并进 #7 之后）也断言了「没有回复中的停止」。建议删除，保留 store 那条。能省约 0.7s。 |
| 29 | the progress strip breaks out the dialogue share of the stage | 0.17s | KEEP | 预算展示。纯函数 `dialogueShare`（`ip/studio-dialogue-execution.tsx:22`）没有单独的测试，这条是它唯一的覆盖。很快，不用动。 |
| 30 | follow-ups saved on the completion summary show after a reload | 0.98s | UNSURE | 去重逻辑被 store 测试「follow-ups saved on the message and those from turn.done show once」完整覆盖了（`messageSuggestions`），「点建议填进输入框」被 #16 覆盖。剩下唯一独有的保护是「渲染层不会画出两组『接下来可以』」。这算不算值得保留的回归钉子，说不准，所以没标 MERGE。如果删，能省约 1s。 |
| 31 | a card shows its own shortfall and dialogue reserve; a replaced | 0.49s | KEEP | 缺口、对话预留、有缺口时自动展开上限输入，这些是独有的。后半段「被替代的卡不能开工」和 #8 重复，可以删掉那几行断言，但省不了多少时间。 |
| 32 | confirming a card, then the server closing its synthetic turn, | 0.54s | MERGE | reducer 部分和 store 测试「a confirmation outside a running turn closes its own synthetic turn」重复。UI 部分（输入框旁没有停止按钮、只有一个回复气泡）可以直接接在 #7 的确认之后：发出 approval.required 和 turn.done 两个事件，再加这三行断言。能省约 0.4s。 |
| 33 | a raise card of the running analysis confirms that same execut | 0.96s | KEEP-INCIDENT | Codex 2026-10-19 P2，曾经启动了第二个分析。 |
| 34 | with several active skills the settings offer 「技能」 (default 自 | 2.43s | KEEP | 选「自动」时不带 skillKey；选了技能就带上；重试时 skillKey 和 clientMessageId 都保持不变（幂等）。 |
| 35 | one active skill, or a thread already bound to a skill, shows | 2.06s | KEEP | 已绑定技能的线程不再发 skillKey（服务端会拒绝换技能，见 mocks 测试 #2）。两次 render 是因为配置不同，必须分开。 |
| 36 | a plan card names the skill version it was planned with | 0.60s | KEEP | `studioSkillBadge`（`canvas-bridge/studio-skills.ts:43`）没有 node 测试，这条是它唯一的覆盖，并钉住「不露出原始 key」。以后可以挪成纯函数测试，现在不急。 |
| 37 | 400 STUDIO_SKILL_REQUIRED names the skills that fit, keeps the | 5.02s | KEEP | 按错误码契约：显示成行内问题而不是 alert，草稿保留，重新加载技能，选完后带 skillKey 重发。耗时高主要是 findBy 在等异步加载技能，逻辑本身是集成行为，没法改成纯函数测试。`skillRequiredChoices` 在 mocks 测试 #2 里已有纯函数覆盖。 |
| 38 | operators get 「把这次制作整理成技能草稿」 under a completion summ | 1.08s | KEEP-INCIDENT | 计费上限 maxCost 21、只用一个 request key、确认弹窗里写明费用。 |
| 39 | the draft entry is only for operators, only under a summary of | 1.31s | KEEP | 权限：非运营看不到入口、只在完成总结下出现、403 时说明原因。三次 render 的配置都不同，不能并。 |
| 40 | assistant shows its single fixed model without opening setting | 0.53s | KEEP | 2026-10-18 从旧输入框移植过来（Codex）。可以接收 #1 里那条「没有对话设置按钮」的断言。 |
| 41 | assistant shows its single selectable model without opening se | 0.24s | KEEP | test.each 的另一个变体，capabilities 不同，必须分开 render。 |
| 42 | the picked model goes with its own ceiling | 0.31s | MERGE | Codex P2（计费）。#54 在刷新之后也断言了 `{model:'two', maxCost:8}`。可以把这条并进 #54：先选 two、发一条、断言，然后刷新、再发一条、再断言。保护不丢，能省约 0.3s。 |
| 43 | a fixed model is not sent | 0.35s | KEEP-INCIDENT | Codex P2：固定模型时不发 model 字段，maxCost 21。 |
| 44 | an empty canvas opens on task cards and what the canvas holds; | 0.98s | KEEP | 点 chip 会把这一类节点全部加进引用（行为）；使用说明 `ol>li` 只有一个子元素，钉的是一个真实出过的版式 bug（一行一个字）。标题和卡片文字的断言偏文案，但没必要拆开。 |
| 45 | 「复刻一条短视频」 pins the only video, drafts the request with bla | 1.77s | KEEP | 素材不齐不能发；发出时带 skillKey 和 pinnedNodeIds（防止空跑一轮扣费）。 |
| 46 | the checklist can be dismissed and the plain composer rules tak | 0.95s | KEEP | 跳过清单后回到普通的发送规则。别处没有覆盖。 |
| 47 | a dialogue-first start sends the prefilled brief once the threa | 0.89s | KEEP-INCIDENT | 只发一次；已经聊过的线程不发（防止重复扣费）。 |
| 48 | the homepage brief still goes out when it reaches a panel that | 0.39s | KEEP-INCIDENT | 本地 e2e 2026-10-19。 |
| 49 | history imported from the old assistant does not stop the home | 0.42s | KEEP-INCIDENT | Codex 真实环境复测 2026-10-19。 |
| 50 | without auto-send the brief fills the composer of an empty thre | 1.23s | KEEP | 不覆盖用户已经写好的草稿。 |
| 51 | an unsent draft and its references survive a refresh, and a se | 0.80s | KEEP | 草稿在改动时写入、发送后清掉，这些在组件里。`studio-assistant-memory.ts` 没有单独的测试。 |
| 52 | under StrictMode a saved draft is restored and stays saved | 0.54s | KEEP-INCIDENT | 浏览器走查 2026-10-19，即 AGENTS §8.0.1 ⑮ 里那条「持久化不要在卸载时写」。 |
| 53 | a restored draft drops references to nodes that left the canvas | 0.52s | KEEP | 真正要保护的是「残留的引用不会挡住发送」。过滤逻辑本身是 `readAssistantDraft(projectId, existingIds)`（`canvas-bridge/studio-assistant-memory.ts:12`），以后可以改成纯函数测试；现在不到 2 秒，不急。 |
| 54 | the chosen reply model is remembered for this canvas after a re | 0.80s | KEEP | 接收 #42 的合并。 |
| 55 | 「放进画布」 turns a finished reply into a text node once, and sho | 0.55s | KEEP-INCIDENT | Production 2026-10-19；只建一次。 |
| 56 | older replies show their raw action blocks folded, not as the a | 0.24s | KEEP | `splitReplyActions` 的纯函数逻辑由 `studio-reply-actions.test.ts` 覆盖；这条测的是组件真的用上了它（折叠起来，这类回复不显示「放进画布」）。结构测试里没有这一项，所以保留。 |
| 57 | a homepage brief that copies a reference video opens the check | 0.46s | KEEP-INCIDENT | 2026-10-19 线上：先扣了一轮积分，只换来一句「请上传视频」。用例里有一个 50ms 的固定等待，可以接受。 |
| 58 | the first message names a canvas nobody named; a name the user | 2.29s | SLOW-NARROW | 起名规则 `studioTitleFromBrief` / `studioCanvasHasDefaultTitle` 已经在 `ip/studio-entry.test.ts`（node）里覆盖了，其中「我的保温杯广告」不算默认名这一点也测了。组件里只有一行判断（`ip/studio-assistant.tsx:275`）。建议：删掉第二次 render（「用户起的名字保持不变」的规则已由纯函数测试覆盖），保留第一次 render 来证明组件接上了这行判断。或者把 :275 这行抽成纯函数做 node 测试。能省约 1.2s。 |
| 59 | nodes the assistant creates are brought into view and the firs | 0.94s | KEEP | 结构测试只查了 `dispatchStudioCommand("reveal"` 这段源码存在；这条测的是真的发出了 reveal 事件，并且提示只出现一次、会写进 localStorage。 |
| 60 | Enter sends and Shift+Enter starts a new line | 0.97s | KEEP-INCIDENT | 2026-10-19 走查，§8.0.1 ⑭。 |
| 61 | 「问助手」 adds the node to this message and keeps what was alrea | 1.30s | KEEP-INCIDENT | 2026-10-19 走查（有草稿时「问助手」不起作用）。 |

### 其它 jsdom 文件

| 文件 | 用例 | 耗时 | 分类 | 理由 |
|---|---|---|---|---|
| studio-dialogue-execution.test.tsx | a failed step can be retried from the strip; the retry is the | 1.00s | KEEP-INCIDENT | 2026-10-18 生产上的 execution：只给了「停止」。 |
| 同上 | a step waiting for a go-ahead offers 「继续制作」; a budget short | 0.12s | KEEP | 预算有缺口时必须走提高上限的卡片，不能直接继续（计费）。 |
| 同上 | a run stopped for a new instruction can be continued from the | 0.29s | KEEP-INCIDENT | Codex R3。 |
| studio-dialogue-check.test.tsx | a check node shows 「AI 判断」 item by item with the sampled evide | 0.18s | KEEP | 「缺依据就判 unknown，不判通过」是 AGENTS §8.0 写明的契约。 |
| 同上 | 「就用这版」 and 「重做这一段」 dispatch to the dialogue without st | 0.34s | KEEP | 发送端的事件载荷，并且点击不会拖动画布；和 assistant #18 合起来是一个闭环。 |
| 同上 | a read-only copy shows the verdict without actions; a check st | 0.03s | KEEP | 只读副本不出操作按钮。 |
| studio-conversation-start.test.tsx | a brief goes out on 「开始对话」 or Enter; Shift+Enter keeps writ | 1.64s | KEEP | 2026-10-19 首页 Enter 行为；空内容不能开始。耗时主要是文件冷启动。 |
| 同上 | example openers fill the box without sending; no idea yet poin | 0.26s | KEEP | 示例只填字不发送；href 指向 /templates 和 /scenes。 |
| 同上 | while a canvas is being created nothing can be sent twice | 0.09s | KEEP | 防止重复建画布。 |
| ip/mocks/studio-dialogue.test.ts | message → streamed text, a work record, a plan and a confirmat | 1.08s | KEEP | 演示模式和真实服务走同一个 reducer 和同一套契约（§8.0.1 ⑦）：同一个 clientMessageId 的 post 幂等、技能草稿幂等、实时投影之后再恢复不会多出节点。 |
| 同上 | skill routing: a tie asks the user, an explicit choice binds t | 0.38s | KEEP | 演示模式里，已绑定的线程换技能会得到 400 `STUDIO_INPUT_INVALID`。 |
| 同上 | a canvas whose recreation finished while it was closed: nodes | 0.22s | KEEP-INCIDENT | Codex R2-03 / R6-02 的演示路径。 |
| 同上 | a message sent while a turn runs is queued and later marked ap | 1.02s | KEEP | 演示模式里的排队转「已应用」。 |

附带一点（UNSURE，不在删减范围内）：`ip/mocks/studio-dialogue.test.ts` 标的是 jsdom，但它不渲染任何东西，只有 `mocks/ip-studio.ts:249` 包在 try/catch 里的一次 localStorage 调用，用到 localStorage 的 `rememberProjectedNodes` 也有保护。改成 node 环境能省掉 jsdom 环境的启动开销，但要先确认演示恢复那条（#3）在没有 localStorage 时行为不变；按 §8.0.1 ⑬，环境的改动要谨慎。

### node 文件（只用来对照，全部保留）

`studio-dialogue-store.test.ts` 的 32 条、`studio-dialogue.test.ts` 的 6 条、`studio-assistant-context.test.ts` 的 6 条、`studio-assistant-plan.test.ts` 的 5 条、`studio-reply-actions.test.ts` 的 1 条、`studio-conversations.test.ts` 的 2 条，全部 KEEP。它们合计不到 1.5 秒，而且是各自纯函数的唯一真源。发现的重复都是 jsdom 用例在重复 node 用例，所以应该删 jsdom 那一侧：

- store「a message queued while an execution runs may come back without a turn」↔ assistant #28
- store「follow-ups saved on the message and those from turn.done show once」↔ assistant #30
- store「a confirmation outside a running turn closes its own synthetic turn」↔ assistant #32
- store「a confirmed card reports what was actually authorized」↔ assistant #25 后半段
- store 中 canvas cursor 的几条，以及 plan-execution 的 replay / restore (a)(b)(c) ↔ assistant #11、#20、#22、#23、#26：只有 #23 是实质重复，其余几条在组件层多了读取、保存、持久化这些副作用
- `studio-reply-actions.test.ts` ↔ assistant #56：纯函数测试 vs 组件确实用上了它，两条都保留
- `studio-entry.test.ts` 的 studioTitleFromBrief / studioCanvasHasDefaultTitle ↔ assistant #58

### 汇总

| 分类 | 条数 |
|---|---|
| KEEP-INCIDENT | 26（assistant 23 + execution 2 + mocks 1） |
| KEEP | 39（assistant 29 + execution 1 + check 3 + start 3 + mocks 3，含 #40/#41 两个 test.each 变体） |
| MERGE | 6（assistant #9→#7、#23→#20、#27→#4、#28 删掉保留 store 那条、#32→#7、#42→#54） |
| COPY-ONLY | 1（assistant #1） |
| SLOW-NARROW | 1（assistant #58，减成一次 render） |
| UNSURE | 1（assistant #30）；另有 mocks 文件换 node 环境一项（不计入条数） |

不计 node 文件，jsdom 用例合计 74 条。

- **可以删掉或并掉的条数：** 7 条（#1、#9、#23、#27、#28、#32、#42），studio-assistant.test.tsx 从 61 条减到 54 条。如果再接受 UNSURE 的 #30，就是 53 条。#58 仍然是一条，只是变窄。
- **能省的时间（按 timings 估计）：** #1 约 1s（它吃的冷启动会转给下一条）、#27 约 1.2s、#23 约 1.5s、#58 约 1.2s、#28 约 0.7s、#9 约 0.6s、#32 约 0.4s、#42 约 0.3s，合计**约 7 秒**，占这个文件 76.8 秒的约 9%。如果再做两件不删用例的提速：#13/#14 里的固定 600ms 等待改成按条件等待（约 1s），#25 去掉第二次 render（约 0.3s），**合计约 8 到 9 秒**。删 #30 还能再省约 1s。
- **会失去什么保护：**
  - #1：没人再盯「旧的四模式 UI 有没有回来」。这是个界面回退的风险，不涉及钱和数据，结构测试也没钉它。
  - #28：如果 UI 不从 activeTurnId 推导停止按钮、而是自己另写一套判断，就没有 UI 层的测试能抓到了。#32 并进 #7 之后只在「确认」这一条路径上还有覆盖。
  - #58 第二次 render：如果组件把 :275 那行的条件写错（比如不查是不是默认名），没有组件层测试能发现。纯函数测试只能保证规则本身是对的。
  - 其余几条 MERGE 只是把断言挪进同一次 render，保护不变。
- **结论：** 这个文件的 77 秒里，大部分是有意保留的事故钉子和计费/幂等/数据不变量。真正的耗时来自每条用例都要整组件 render，加上机器负载导致的超时，不是来自冗余用例。想大幅提速，方向应该是降低单次 render 的成本（比如共享 Host 的初始化、减少 waitFor 轮询），不是删测试。

## 附录 C · 第 3–25 名 jsdom 文件逐条


只读审计，没改仓库。工作区 `仓库根目录`（HEAD 3dbca7d2）。
「并行耗时」取自 timings.tsv（全量并行跑）；「串行耗时」是我在同一工作区用
`npx vitest run <这 23 个文件> --maxWorkers=1` 实测（`mid-serial.json`，开跑时 load avg 63→22）。

### 一、先说结论：4–15 秒不是用例本身慢

| 口径 | 这 23 个文件的用例耗时合计 |
|---|---|
| timings.tsv（全量 136 文件并行，load ≈ 90） | **343 s** |
| 只跑这 23 个、默认并行（10 核） | 152 s（另有 2 条 5 s 超时假失败） |
| 只跑这 23 个、单 worker 串行 | **41.6 s**，其中 project-sync 16.5 s 是真睡眠 |

- **没有一个文件用 `userEvent`**，全是 `fireEvent`；也没有逐字键入。brief 里猜的「逐字 userEvent.type」在这批文件里不存在。
- 单条 4–15 s 的用例串行都在 0.25–1.8 s：`studio-select` 首条 11.21 s → 0.25 s，`studio-group-description` 9.02 s → 0.46 s，`studio-effect-library` 发布那条 8.70 s → <0.25 s，`studio-create-home` 首条 15.52 s → 1.09 s。差距 8–40 倍，是 CPU 争用：78 个 jsdom 文件同时跑，每条都是纯 CPU（`getByRole` 计算可访问名称、React 渲染、antd CSS-in-JS 首次注入）。timings 里 failed 的条目全是这类 5 s 超时。
- 每个文件**首条用例**普遍最慢（billing-dialog 4.37 s 后面全是 0.1 s 级；personal-asset-library、supplementary、storyboard 同理），是首次渲染承担了 antd/模块初始化，删别的用例不会变快。
- **文件级固定开销比用例本身还大**：串行跑这 23 个文件，`environment 19.8 s + collect 14.5 s ≈ 34 s`（约 1.5 s/文件：jsdom 建环境 + 导入 antd/tiptap/画布模块），而用例本体扣掉 project-sync 的睡眠只有约 25 s。

所以这一段**靠删用例省不了多少时间**（能安全删/并的只有 4 条，串行约 0.85 s）。真正能省时间的在下面第二节。

### 二、不删保护也能提速的办法（按收益排）

1. **project-sync 改用 fake timers（约 −14 s 真实墙钟，最大一项）**。文件里 13 条用例在真等 900 ms 防抖（`waitFor(..., {timeout:3000})`）或 `await new Promise(r=>setTimeout(r,1200))`，串行 16.5 s 中约 14 s 是睡眠，CPU 再空闲也省不掉，并行时它是这个 worker 的下限。同文件「等补存落地也要有上限」已经用 `vi.useFakeTimers()` + `await act(async()=>{await vi.advanceTimersByTimeAsync(950)})` 跑通（0.07 s），照它改：把「等防抖」换成 `advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS+50)`，把 `sleep(1200)` 换成 `advanceTimersByTimeAsync(1200)`，断言不变。注意 `waitFor` 在 fake timers 下要配合 `advanceTimers`，或者直接改成推进时间后同步断言。保护不减。
2. **限制 jsdom 并发 / 放宽 jsdom 超时，别把争用当失败**。这批假失败（5 s 超时）在串行下全是 <2 s。可选：jsdom 文件单独成 vitest project，`maxWorkers` 设到核数附近（现在机器 10 核）；或给 jsdom project 设 `testTimeout: 15000`。这不省时间，但能消掉假红，并让 timings 反映真实成本。（`environmentMatchGlobs` 已被 vitest 标 deprecated，迁到 `test.projects` 时正好一起做。）
3. **别在 `waitFor` 里对大列表反复 `getByRole`**。`waitFor` 每 50 ms 重跑一次回调，每次 `getByRole({name})` 都要遍历整棵树算可访问名称。最典型的是 `studio-create-home`「keeps a failed delete reviewable…」：只测删除，却沿用 27 份画布的默认夹具（24 张卡），串行 1.81 s。改成 `mocks.projects.mockResolvedValue([projects[0]])` 不损失任何断言，预计降到约 0.3 s。只有「loads content only for the visible page」那一条真需要 27 份。
4. **组件里的真实防抖**：`personal-asset-library.tsx:85-94` 搜索有 180 ms 防抖，「older search requests cannot overwrite…」要等两轮（串行 0.76 s）。可以用 fake timers，或者把 180 做成可注入的 prop/常量。收益小（约 0.4 s）。
5. **文件级开销（约 1.5 s/文件）**：想再降只能减少 jsdom 文件数或减少每个文件的导入。例如 `studio-storyboard`、`studio-video-prompt-notes`、`video-duration-panel`、`library-extraction-panel` 里各有 1–2 条纯函数用例（见表里 SLOW-NARROW），挪到 node 环境本身不省时间（都 <0.1 s），只是放对位置；只有当某个 jsdom 文件被**整个**挪空才省下那 1.5 s，这批里没有这种文件。`isolate:false` / 换 happy-dom 能明显降开销，但会碰 §8.0.1 ⑬ 的 `setup-storage.ts` 和各文件的模块级状态（project-sync 有跨实例的保存队列），**不建议**在这一轮做。

### 三、和 `src/canvas-bridge/*.test.ts`（node）的重复对照

- `studio-work-editor.test.tsx` ↔ `canvas-bridge/studio-work-clips.test.ts`：字幕错误文案（「第 2 条字幕结束在 12 秒…」）、横屏留黑边提示、片段排序这些**判定逻辑**两边都测了。jsdom 这边断的是「合成按钮因此禁用」「onMoveClip 被调用」「跨集不能拖」等接线，属 §8.0.1 ⑥，**保留**；可以把 jsdom 里重复的文案断言删掉只留按钮状态，但不省时间，可选。
- `studio-video-prompt-notes.test.tsx` ↔ `canvas-bridge/studio-video-prompt.test.ts`：台词识别、丢了哪些台词、首帧问题推荐哪种模式，判定在 node 测过；jsdom 这边测的是「只对会改写的模型显示」「对话框三个回调」，不重复，保留。
- `studio-billing-dialog.test.tsx` ↔ `canvas-bridge/studio-billing.test.ts`：前者测付款人选择对话框和默认偏好，后者测请求层的 billing key 重放，层次不同，没有重复。
- `studio-script-rich-editor.test.tsx`「formatting structural headings…」↔ `canvas-bridge/studio-script-markdown.test.ts`「formatted headings preserve semantic identities…」：一个测 Tiptap 往返，一个测 Markdown 层，保守视为不重复。
- `video-duration-panel.test.tsx` ↔ `canvas-bridge/video-duration.test.ts`：文件头写明这里专测「算对了但没写回去」（v0.176），纯函数那侧在 node，不重复。
- `project-sync.test.ts` 本身就是 hook 测试，canvas-bridge 下没有同主题的 node 测试。
- `studio-storyboard` 的纯函数（`studioStoryboardStatus` / `updateStudioStoryboardShot` / `studioStoryboardLinks`）**只在 jsdom 文件里测**，canvas-bridge 下没有 `studio-storyboard.test.ts`；挪过去更合适，但不省时间。

### 四、逐条分类

分类口径照 brief。只要沾钱、幂等、归属、不重复扣费、丢数据，或注释里写了事故日期/版本号，一律 KEEP-INCIDENT。「SLOW-TIMER」是 KEEP-INCIDENT 下的附注，表示改 fake timers 就能提速。

#### `src/ip/studio-create-home.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | Creation catalogue loads content only for the visible page,  | 15.52s ✗ | 1.09s | KEEP | 只读当前页 24 份画布内容（翻页才读第 25–27 份），是请求量契约；27 条夹具是翻页所需。并行 15.5s 是争用，串行 1.09s |
| 2 | Creation catalogue opens the secondary flow preview and pers | 6.83s ✗ | 0.24s | KEEP | 封面保存失败后弹窗保留可重试，且只调 selectCover，不发 doc（不改画布文档） |
| 3 | Creation catalogue restores automatic covers and explicitly  | 4.23s ✗ | 0.26s | KEEP | 恢复自动封面 + 显式刷新内容预览，别处无覆盖 |
| 4 | Creation catalogue opens a workflow template read-only witho | 2.94s | 0.21s | KEEP | 只读预览模板不建画布（mocks.create 未调用）；其中 nav href 断言偏结构，可留 |
| 5 | Creation catalogue guards rapid blank-canvas creation and na | 0.67s | 0.12s | KEEP-INCIDENT | 连点「空白画布」只建一次，防重复建画布 |
| 6 | Creation catalogue keeps saved canvases in Projects without  | 3.38s | 0.32s | MERGE | 与 #1 同一 render（默认 27 份 StudioProjects）；把 heading/「新建创作」链接/templates 未调用 三条断言并进 #1 首个 findByRole 之后，删本条 |
| 7 | Creation catalogue keeps a failed delete reviewable and remo | 10.86s ✗ | 1.81s | KEEP-INCIDENT | 删除失败不丢卡片、重试成功才移除（数据删除）。SLOW：沿用默认 27 份夹具，waitFor 里反复 getByRole 扫 24 张卡；改成 mocks.projects.mockResolvedValue([projects[0]]) 不损保护，串行 1.8s→约 0.3s |
| 8 | Template market lets super admins manage built-in official c | 2.47s | 0.11s | KEEP | 超管改内置官方封面走 template 作用域（权限 + 参数契约） |
| 9 | Template market keeps personal templates manageable and sepa | 1.09s | 0.11s | KEEP | 停用个人模板后不可预览、重新启用调 availability(personal,true) |
| 10 | Template market retains official example previews and separa | 1.35s | 0.07s | KEEP | 模板搜索与个人画布目录分离（不调 listProjects） |
| 11 | Creation idea moved from home saves the selected intent only | 0.62s | 0.55s | KEEP | 只有显式「创建并打开画布」才落想法，prompt 写进最后一个节点 |
| 12 | Creation idea moved from home retains a failed idea save and | 1.70s | 0.30s | KEEP-INCIDENT | 想法保存失败后重试复用同一画布（createProject 只 1 次），防重复建画布 |

#### `src/ip/studio-effect-library.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | all entry points insert a complete instruction at the rememb | 4.83s | 0.29s | KEEP | 按记住的光标插入完整指令、保留 @引用、不触发生成；applyVideoEffect(id,model) 参数契约 |
| 2 | an incompatible effect can be inspected but cannot be applie | 0.70s | 0.05s | KEEP | 不适用当前模型的特效可看不可用，不调 apply |
| 3 | favorite and recent survive close/reopen and the entire cata | 3.90s | 0.16s | KEEP | 收藏/最近使用跨关开保留，onCatalog 带回 favorite/lastUsedAt |
| 4 | personal publication saves exact text, declared models and o | 8.70s ✗ | 0.12s | KEEP | 发布个人特效的请求体（prompt/models/visibility/previewKey）契约；并行 8.7s 超时为争用假失败，串行 <0.25s |
| 5 | failed apply keeps the library and original prompt for expli | 1.13s | 0.07s | KEEP | 应用失败保留弹窗与原 prompt |
| 6 | search covers author, tags and actual model names; an empty  | 2.77s | 0.08s | KEEP | 搜索覆盖作者/标签/模型名 + 空结果可恢复（cheap） |
| 7 | details and favorite remain independent of selecting a card | 0.69s | 0.13s | KEEP | 查看详情不等于选用 |
| 8 | replacing a selected effect retains authored text and refere | 4.35s ✗ | 0.24s | KEEP | 替换已选特效不重复、保留手写文字与引用；与 #10 相近但起点不同（交互替换 vs 已存多特效收敛），保守不并 |
| 9 | slow selection cannot be cancelled or submitted twice, and f | 3.41s | 0.05s | KEEP-INCIDENT | 慢请求期间不可取消/不可重复提交（applyVideoEffect 只 1 次），失败保留原选择 |
| 10 | a saved prompt with multiple effects converges to one select | 1.59s | 0.11s | KEEP | 已存多个特效收敛为一个，运镜 chip 与引用保留 |
| 11 | a customized effect description remains authored text when c | 0.64s | 0.04s | KEEP | 用户改过的特效描述按手写文字保留 |

#### `src/ip/studio-script-editor.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | blank nodes open the full document framework; saving updates | 2.40s | 0.18s | KEEP-INCIDENT | 保存更新同一节点、位置与已受理 request 不变（数据） |
| 2 | save errors retain the editor and latest local draft instead | 0.73s | 0.04s | KEEP-INCIDENT | 保存失败保留编辑器与本地草稿（丢数据） |
| 3 | AI produces a persisted proposal with quote and bounded hist | 1.43s | 0.10s | KEEP-INCIDENT | 改稿请求体 maxCost/model/scriptEdit + 先存后提交；只有显式采纳才改草稿 |
| 4 | manual edits during an AI response disable ordinary adoption | 3.29s | 0.12s | KEEP-INCIDENT | AI 回复期间手改，普通采纳禁用，替换可撤销（丢数据） |
| 5 | an unknown submission result recovers with the original key  | 4.56s | 0.06s | KEEP-INCIDENT | 提交结果未知时刷新后用原 request（同幂等键）重放（幂等/不重复扣费） |
| 6 | accepted jobs resume by run ID without submitting or chargin | 2.83s | 0.01s | KEEP-INCIDENT | 已受理任务按 runId 续读，不再提交不再扣费 |
| 7 | draft-only return preserves incomplete Markdown and leaves t | 1.38s | 0.02s | KEEP-INCIDENT | 只返回不保存时保留半成品 Markdown，已存剧本不变 |
| 8 | material processing is separate from chat and saves the docu | 0.87s | 0.02s | KEEP | 素材处理先保存再打开提取（调用顺序） |
| 9 | invalid model output leaves the original draft available and | 1.57s | 0.03s | KEEP-INCIDENT | 模型输出不合法时原稿保留、UI 解锁 |
| 10 | a legacy node copy cannot recover a revision task belonging  | 0.81s | 0.01s | KEEP-INCIDENT | 复制出来的旧节点不能接续源节点的改稿任务（归属） |
| 11 | the document opens without a creation panel, and toggling th | 1.02s | 0.05s | KEEP | 切换对话面板不丢文档与未发送的改稿要求（草稿保留） |
| 12 | chat hides pricing internals and updates actual credits afte | 0.54s | 0.05s | KEEP-INCIDENT | 不显示 Token/冻结等内部计价，完成后显示实际扣费；与 #3 都断言 maxCost:21，部分重叠，但本条独有「隐藏内部计价 + 实际积分」，保守不并 |

#### `src/ip/studio-work-editor.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | the original a recreation copies starts outside the cut, say | 3.49s | 0.25s | KEEP-INCIDENT | 2026-10-19 用户反馈（爆款复刻原片默认被拼进成片） |
| 2 | a voiceover longer than the cut blocks assembly before the u | 1.05s | 0.09s | KEEP | 配音过长在合成前拦下（按钮 disabled）；数字判断无纯函数单测，留 |
| 3 | the browser's reading of the file replaces the stored length | 0.44s | 0.04s | KEEP | loadedmetadata 时长覆盖存的时长（接线）；比例提示文案与 studio-work-clips.test.ts「letterbox hints」重复，可只保留时长与提示存在性 |
| 4 | captions get times from the clips, and a caption past the en | 2.14s | 0.15s | KEEP | 字幕超时/空字幕拦合成（接线）；错误文案与 studio-work-clips.test.ts「caption problems match」重复，但这里断的是按钮 disabled 契约 |
| 5 | dragging moves a clip; arrows stay for keyboard use | 1.69s | 0.05s | KEEP | 拖动调 onMoveClip(0,2)、键盘箭头仍可用；reorder 纯逻辑已在 studio-work-clips.test.ts，这里测接线 |
| 6 | clips of different episodes cannot be dragged or stepped acr | 1.03s | 0.02s | KEEP | 跨集不能拖/不能箭头互换（AGENTS 成片编辑器规则） |
| 7 | without any voiceover the editor offers to make one instead  | 2.09s | 0.02s | KEEP | 无配音时给「去做一条配音」入口（cheap） |
| 8 | the preview plays the chosen clips back to back and shows ca | 3.95s | 0.06s | KEEP | 整片预览按成片时钟连放、字幕叠加 |
| 9 | clicking a clip that is not in the cut shows it alone, clear | 1.89s | 0.07s | KEEP | 单独预览不在成片里的片段 |
| 10 | finished works are listed newest first | 0.30s | 0.01s | KEEP | 作品按新到旧排（cheap） |
| 11 | advanced editing opens from the cut page, and once used it t | 1.84s | 0.13s | KEEP-INCIDENT | 2026-10-19 高级编辑接管一键成片，直到用户改回 |
| 12 | on a phone the advanced editor is offered but says it needs  | 1.47s | 0.03s | KEEP | 手机端高级编辑禁用并说明（cheap） |

#### `src/canvas-bridge/project-sync.test.ts`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | 加载 加载失败通知保留服务端错误码和真实追查号，仍不创建空画布 | 0.68s | 0.07s | KEEP-INCIDENT | 加载失败保留错误码/logId，不建空画布、不 PUT（覆盖服务端事故） |
| 2 | 加载 把服务端的文档灌进画布，ready 之后才允许渲染 | 0.08s | 0.06s | KEEP-INCIDENT | ready 之后才渲染（加载前保存=清空画布） |
| 3 | 加载 读不出来时给错误态，不是空画布 | 0.07s | 0.06s | MERGE | 与 #1 同为「GET 失败 → error 态、不建空画布」；把 result.current.error 断言并进 #1，删本条（省时≈0，只是去重） |
| 4 | 自动保存 保存失败通知保留服务端诊断，原文档和失败状态仍可恢复 | 0.08s | 0.06s | KEEP-INCIDENT | saveNow 失败保留诊断与本地内容 |
| 5 | 自动保存 加载完成之前的任何改动都不回存 | 0.09s | 0.06s | KEEP-INCIDENT | 文件头点名的致命条：加载完成前的改动不回存 |
| 6 | 自动保存 加载完之后改动会防抖回存 | 1.06s | 0.99s | KEEP-INCIDENT | 防抖回存。SLOW-TIMER：真等 900ms 防抖（waitFor timeout 3000） |
| 7 | 自动保存 防抖还没到点就切走：那一笔存进**旧项目自己**，且切换后不再重复存 | 1.37s | 1.31s | KEEP-INCIDENT | v0.179 改判：切走时存进旧项目、只存一次。SLOW-TIMER：sleep 1200ms |
| 8 | 自动保存 卸载时把最后一笔存掉 —— 改一笔立刻点走，改动不能没 | 0.10s | 0.06s | KEEP-INCIDENT | 卸载补存最后一笔（丢改动） |
| 9 | 自动保存 没有改动时卸载不白发一次 PUT | 0.13s | 0.11s | KEEP-INCIDENT | 无改动不白发 PUT |
| 10 | 自动保存 存不上要说出来，不能让用户以为改动落盘了 | 1.06s | 0.99s | KEEP-INCIDENT | 防抖路径保存失败要显示 failed。SLOW-TIMER：真等防抖 |
| 11 | 跨项目不许串号 旧项目的保存响应不许污染新项目的 baseDocVersion | 2.06s | 1.98s | KEEP-INCIDENT | v0.162 事故形状：跨项目 baseDocVersion 串号。SLOW-TIMER：等防抖 ×1 |
| 12 | saveNow 给调用方一个能据以决策的结果 存好了返回 saved | 0.09s | 0.06s | KEEP-INCIDENT | §8.0.1 ⑨ saveNow 返回 saved |
| 13 | saveNow 给调用方一个能据以决策的结果 存不上返回 failed（调用方据此拒绝发布，而不是拿旧内容发出去） | 0.12s | 0.11s | KEEP-INCIDENT | saveNow failed + retrySave；与 #4 同为 saveNow 失败，但 #4 断通知、本条断重试，保守不并 |
| 14 | saveNow 给调用方一个能据以决策的结果 撞上别处的编辑返回 conflict，并停掉自动保存（重试只会覆盖那份工作 | 1.55s | 1.31s | KEEP-INCIDENT | conflict 停掉自动保存。SLOW-TIMER：sleep 1200ms |
| 15 | 在途时的 saveNow 不许把「排队了」当成「存好了」 在途保存失败就返回 failed，不自动再发请求 | 1.09s | 0.99s | KEEP-INCIDENT | 在途失败返回 failed 不自动重发。SLOW-TIMER：等防抖 |
| 16 | 在途时的 saveNow 不许把「排队了」当成「存好了」 在途那次成功了就返回 saved（不再多存一次） | 0.99s | 0.99s | KEEP-INCIDENT | 在途成功返回 saved 不多存。SLOW-TIMER：等防抖 |
| 17 | 不做无谓的保存 发布前 saveNow 存过之后，防抖计时器到点不再重复 PUT 一遍 | 1.31s | 1.26s | KEEP-INCIDENT | 发布前存过后防抖不再重复 PUT。SLOW-TIMER：sleep 1200ms |
| 18 | 不做无谓的保存 什么都没改就点发布：不发 PUT，也不算失败（服务端已经有这份了） | 0.11s | 0.06s | KEEP-INCIDENT | 没改动点发布不 PUT 也不算失败 |
| 19 | 离开前补存的那一笔 用的是在途那次存完之后的基线 —— 拿旧基线补存必然假冲突 | 1.11s | 0.99s | KEEP-INCIDENT | 补存用在途完成后的基线（假冲突）。SLOW-TIMER：等防抖 |
| 20 | 离开后立刻又打开同一个项目 先等补存落地再读 —— 否则读回旧版、基线也是旧的（下一次保存必然假冲突） | 1.45s | 1.04s | KEEP-INCIDENT | 重开同一项目先等补存落地（假冲突）。SLOW-TIMER：等防抖 |
| 21 | 等补存落地也要有上限 一直没落地：既不能永远卡在「正在打开」，也不能把已知是旧的内容摆出来让人改 | 0.07s | 0.01s | KEEP-INCIDENT | Codex 复核：补存等待有上限且如实报错；已用 fake timers（0.07s），就是其余条的改造范式 |
| 22 | loads legacy conversation nodes into separate history and pe | 0.09s | 0.06s | KEEP | 旧对话节点进历史、只改历史也会保存且不加图节点 |
| 23 | 别的标签页存了新版 这里没改过东西：悄悄换成最新内容，不发 PUT、不进冲突，视口保留 | 1.61s | 0.99s | KEEP-INCIDENT | 别的标签页存了新版：未改则静默换新。SLOW-TIMER：等防抖 |
| 24 | 别的标签页存了新版 这里改过内容：立刻进冲突态，不白发一次必然 409 的 PUT，也不弹通知 | 1.57s | 1.26s | KEEP-INCIDENT | 别的标签页存了新版：改过立刻冲突、不白发 409。SLOW-TIMER：sleep 1200ms |
| 25 | 别的标签页存了新版 自己这一页的保存不算「别处」，同版本号的消息也不动 | 0.14s | 0.11s | KEEP-INCIDENT | 自己的保存广播不算别处 |
| 26 | 撞上冲突之后的三条出路 冲突本身不弹通知 —— 弹窗负责说，通知层逐条弹就是「页面一直在报错」 | 0.22s | 0.11s | KEEP-INCIDENT | 冲突不逐条弹通知 |
| 27 | 撞上冲突之后的三条出路 换成最新内容：画布变成服务端那份，冲突解除，自动保存恢复且带新基线 | 1.17s | 1.04s | KEEP-INCIDENT | 换成最新内容后自动保存恢复且带新基线。SLOW-TIMER：等防抖 |
| 28 | 撞上冲突之后的三条出路 以这里为准：拿服务端此刻的版本号重存本地内容，不是拿旧基线再撞一次 | 0.15s | 0.11s | KEEP-INCIDENT | 以这里为准用服务端此刻版本号重存 |
| 29 | 撞上冲突之后的三条出路 以这里为准时别处又存了一版：还是冲突，如实回报，弹窗继续开着 | 0.17s | 0.11s | KEEP-INCIDENT | 以这里为准时又冲突：如实回报 |
| 30 | 撞上冲突之后的三条出路 另存一份：本地内容进新画布（不带基线），这张换成最新内容，什么都不丢 | 0.14s | 0.11s | KEEP-INCIDENT | 另存一份不丢内容 |
| 31 | 撞上冲突之后的三条出路 另存没成功：本地改动原样留着，还是冲突态，用户可以再选 | 0.13s | 0.11s | KEEP-INCIDENT | 另存失败本地改动保留 |

#### `src/ip/library-extraction-panel.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | text extraction hides flat pricing, marks the paid action an | 3.22s | 0.27s | KEEP-INCIDENT | 付费动作标记 + 请求带 maxCost/model + 显示实际结算积分（计费） |
| 2 | a rejected price clears the unaccepted request so the next c | 0.37s | 0.14s | KEEP-INCIDENT | 价格变更 409 后丢弃未受理请求、下次用新 clientRequestId（幂等/计费） |
| 3 | refresh recovers the actual accepted source and saves existi | 0.37s | 0.11s | KEEP-INCIDENT | 刷新后用已受理 run 的原文指纹保存候选，不再分析（不重复扣费） |
| 4 | a genuinely changed document never relabels old extraction r | 0.59s | 0.07s | KEEP-INCIDENT | 文档真改过时不拿新指纹冒充旧结果（数据归属） |
| 5 | newly accepted extraction persists the returned fingerprint  | 0.47s | 0.07s | KEEP-INCIDENT | 新受理结果持久化服务端返回的指纹 |
| 6 | episode-only snapshots and legacy runs keep the original ful | 0.07s | 0.00s | SLOW-NARROW | 纯函数 extractionSourceHash（src/ip/library-extraction-source.ts），不渲染；可挪到 node 环境的 library-extraction-source.test.ts。耗时 0.07s，挪不省时，只是放对位置（该函数用 webcrypto，node 下可用） |
| 7 | saved assets appear on opening without clicking an improve b | 1.79s | 0.13s | KEEP | 打开即显示已存资产，不需点按钮、不重跑分析（不扣费） |
| 8 | saving returns to the visible saved collection rather than h | 0.92s | 0.06s | KEEP | 保存后回到已存列表 |
| 9 | editing returns to the collection with the latest saved desc | 0.23s | 0.05s | KEEP | 编辑后回到列表显示最新描述 |
| 10 | source-scoped assets are not silently limited to the first p | 3.52s | 0.07s | KEEP | 来源资产翻页不截断第一页（page:1 请求契约） |
| 11 | an analysis setup error does not hide already saved assets | 2.92s | 0.03s | KEEP | 分析配置出错不遮住已存资产 |
| 12 | a failed optional folders request keeps the saved collection | 1.66s | 0.03s | KEEP | test.each(folders)：可选请求失败保留列表并给重试；jsdom 里 each 不省时，保持 |
| 13 | a failed optional preference request keeps the saved collect | 0.66s | 0.02s | KEEP | test.each(preference)：同上 |
| 14 | a cancelled StrictMode initialization does not duplicate the | 0.30s | 0.03s | KEEP | StrictMode 取消的初始化不重复提示 |

#### `src/ip/ip-management.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | IP management user flows keeps shared navigation available w | 3.16s | 0.33s | UNSURE | 只断导航 href 与不建项目；名字说的是「手机上桌面头隐藏时」但没模拟手机。可并进 #7（同一 render 只等列表出现），但 #7 改了 voices/assets mock，导航不受影响——保守标 UNSURE，若并则省约 0.3s 串行 |
| 2 | IP management user flows saves a renamed character and updat | 2.86s | 0.25s | KEEP | 改名后列表与详情同步，patch 保留未改字段（请求体契约） |
| 3 | IP management user flows keeps the edit draft on a failed sa | 1.69s | 0.18s | KEEP-INCIDENT | 保存失败保留编辑草稿、不显示成功（丢数据） |
| 4 | IP management user flows passes the selected historical look | 1.97s | 0.13s | KEEP | 选中的历史形象版本精确写进新画布引用，不生成（不扣费） |
| 5 | IP management user flows reuses the existing free project af | 4.62s | 0.10s | KEEP-INCIDENT | 引用保存失败后复用已建画布（create 只 1 次） |
| 6 | IP management user flows clears the open dossier when its ch | 0.96s | 0.16s | KEEP | 搜索过滤掉当前人物时关闭详情 |
| 7 | IP management user flows shows unavailable statistics when t | 0.66s | 0.06s | KEEP | 目录失败时统计显示「—」而非 0（不伪造数据） |

#### `src/ip/studio-group-description.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | notes support explicit save, cancellation and clearing witho | 9.02s ✗ | 0.46s | KEEP | 显式保存/取消/清空；串行 0.46s，并行 9s 超时为争用（真实 antd Modal + 动画）。可改：mock antd Modal（像其他文件那样）可再省 ~0.3s，但会失去真 Modal 关闭行为，保守不改 |
| 2 | read-only templates show complete notes but never expose an  | 5.12s | 0.10s | KEEP | 只读模板看完整说明但无编辑器（cheap） |

#### `src/ip/studio-script-rich-editor.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | the script framework is rendered as headings, labels retain  | 1.61s | 0.11s | KEEP | 框架渲染为标题、下游投影在编辑后成立（纯 Editor，不 render） |
| 2 | formatting structural headings keeps their visible identity, | 0.18s | 0.05s | KEEP | 结构标题加格式后语义身份保留；与 canvas-bridge/studio-script-markdown.test.ts「formatted headings preserve semantic identities」相近，但那边测 Markdown 层、这里测 Tiptap 往返，保守不并 |
| 3 | bold formatting persists across the document interchange and | 0.07s | 0.02s | KEEP | test.each bold 往返（0.07s，cheap；each 合一不省时） |
| 4 | italic formatting persists across the document interchange a | 0.04s | 0.02s | KEEP | test.each italic |
| 5 | underline formatting persists across the document interchang | 0.05s | 0.02s | KEEP | test.each underline |
| 6 | strike formatting persists across the document interchange a | 0.04s | 0.02s | KEEP | test.each strike |
| 7 | nested lists, ordered lists, quotes and a simple table retai | 0.54s | 0.04s | KEEP | 列表/引用/表格结构往返 |
| 8 | pasted HTML cannot retain scripts, event attributes or javas | 0.11s | 0.03s | KEEP | 粘贴 HTML 去脚本/事件/javascript 链接（安全） |
| 9 | opening or receiving an unchanged document does not emit a n | 1.26s | 0.69s | KEEP-INCIDENT | 打开/收到未改文档不发规范化草稿（防假脏 → 无谓保存/覆盖） |
| 10 | toolbar formatting reflects the current selection state | 1.11s | 0.12s | KEEP | 工具栏状态跟随选区 |
| 11 | external AI adoption displays its formatted content without  | 0.82s | 0.14s | KEEP | 外部采纳 AI 版本不触发合成 change；建议稿只读 |
| 12 | outline navigation finds rendered headings and selects their | 0.39s | 0.17s | KEEP | 大纲跳转到标题位置 |
| 13 | the native document outline follows renamed, inserted, delet | 0.68s | 0.16s | KEEP | 大纲锚点随改名/插入/删除/降级稳定 |
| 14 | duplicate heading titles navigate by native anchor ID and ex | 1.15s | 0.10s | KEEP | 同名标题按锚点 ID 跳转；外部建议更新大纲不弄脏 |
| 15 | changing paragraph style through the page menu returns the c | 5.91s ✗ | 0.25s | KEEP | 段落样式菜单后光标回到文档（真实 Select，串行 0.25s；并行 5.9s 超时为争用） |

#### `src/ip/enterprise-workspace.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | allocation requires server preview and an explicit total con | 1.94s | 0.37s | KEEP-INCIDENT | 划拨必须先服务端预览 + 显式确认（fingerprint 契约，钱） |
| 2 | an uncertain submission retry keeps its idempotency key | 1.56s | 0.13s | KEEP-INCIDENT | 不确定结果重试复用幂等键（钱） |
| 3 | stale balances require another preview and never auto-submit | 2.22s | 0.10s | KEEP-INCIDENT | 余额过期须重新预览、不自动提交（钱） |
| 4 | reclaim-all preserves null intent in preview and submit whil | 4.94s | 0.09s | KEEP-INCIDENT | 全部回收 amount:null 意图保留（钱） |
| 5 | member scope hides management and team billing controls | 0.20s | 0.01s | KEEP | 成员视角隐藏管理与团队账单，不请求 wallet/recharges（权限） |
| 6 | a failed summary does not display zero balances or a false e | 0.06s | 0.01s | KEEP | 汇总失败不显示 0 余额 / 假「未加入企业」（不伪造） |
| 7 | a recharge requester can read own applications without team  | 0.18s | 0.02s | KEEP | 充值申请人只看自己的申请（权限） |
| 8 | recharge application reports pending processing and reloads  | 1.20s | 0.04s | KEEP | 充值申请提交后重读权威数据 |
| 9 | disabled feature exposes no controls and does not request en | 0.01s | 0.00s | KEEP | 开关关闭时不请求企业接口 |

#### `src/ip/studio-select.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | uses a DOM listbox, supports empty values and restores focus | 11.21s ✗ | 0.25s | KEEP | DOM listbox、空值、Esc 后焦点回到触发器（a11y 契约）。串行 0.25s；并行 11.2s 超时纯属争用 |
| 2 | does not open a disabled control | 0.77s | 0.02s | KEEP | 禁用时不打开（cheap） |

#### `src/canvas-bridge/video-duration-panel.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | 参数面板：夹过的时长要回写 候选数跟随所选端点，旧值不在清单时回写 | 3.62s | 0.32s | KEEP-INCIDENT | 文件头 v0.176/v0.179：夹过的值必须回写（纯函数测不出）；候选数回写 |
| 2 | 参数面板：夹过的时长要回写 自定义模型允许超过旧画布 30 秒上限的合同区间 | 1.04s | 0.04s | KEEP | 自定义模型合同区间超过 30 秒不回写 |
| 3 | 参数面板：夹过的时长要回写 存 4 秒、模型最短 5 秒 → 打开面板就把 5 写回 config | 3.29s | 0.03s | KEEP-INCIDENT | 4→5 秒回写（v0.176 缺陷本体） |
| 4 | 参数面板：夹过的时长要回写 已经在区间内就不写（免得白白触发一次自动保存） | 0.84s | 0.03s | KEEP | 区间内不写（免无谓自动保存） |
| 5 | 参数按钮收起状态 自定义画幅和清晰度正确显示且不出现误报 | 0.29s | 0.03s | KEEP | 收起态自定义画幅显示正确无误报 |
| 6 | 参数按钮收起状态 显示存着的 4 秒（不是夹过的 5 秒），并标出「这样发会被拒」 | 0.13s | 0.01s | KEEP-INCIDENT | 收起态显示存着的值并标「会被拒」（显示 5 提交 4 的事故形状） |
| 7 | 参数按钮收起状态 在区间内就照常显示，不加记号 | 0.13s | 0.01s | KEEP | 区间内不加记号；与 #6 是正反两面，可并成一次 render？不同 config 需两次 render，不省时，保持 |
| 8 | 参数按钮收起状态 面板没打开时不许悄悄回写 config（回写是用户打开面板才发生的事） | 0.09s | 0.01s | KEEP | 未打开面板不回写 |
| 9 | 参数面板：画幅按模型真正能出的来 自定义清晰度和画幅沿用端点合同，不补 p 或改成内置比例 | 0.33s | 0.03s | KEEP | 自定义清晰度/画幅沿用端点合同 |
| 10 | 参数面板：画幅按模型真正能出的来 只渲染这个模型能出的清晰度与比例，并把选不了的值夹回去写回 config | 0.50s | 0.03s | KEEP-INCIDENT | v0.184：只给模型能出的档位并回写（悄悄换画幅） |
| 11 | 参数面板：画幅按模型真正能出的来 竖的仍然落到竖的（3:4 → 9:16，不是一律回到第一个 16:9） | 0.02s | 0.00s | SLOW-NARROW | 纯函数 effectiveVideoGeometry（src/canvas/components/video-settings-panel.tsx），未 render；可挪到 node 的 video-duration.test.ts。0.02s，挪不省时 |
| 12 | 参数面板：画幅按模型真正能出的来 拿不到能力（模型没加载 / 协议不受限）就保留完整选项，不臆造限制 | 0.29s | 0.04s | KEEP | 拿不到能力时不臆造限制 |
| 13 | 参数按钮收起状态：画幅兑现不了要如实说 存着 720p·3:4、模型只出 768p 横竖 → 标出「实际会按 9:16  | 0.04s | 0.01s | KEEP-INCIDENT | v0.184：收起态如实说「实际会按 9:16 出」 |

#### `src/ip/personal-asset-library.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | saved script assets lead with an honest no-image state and s | 4.71s | 0.40s | KEEP | 无图资产诚实显示「待配图」+ 各分类总数分开 + 无写接口。并行 4.7s 主要是首条用例承担 antd/模块首次渲染 |
| 2 | successful list loading does not clear a folder failure or m | 0.42s | 0.28s | KEEP | 列表成功不清掉文件夹失败、不误标文件夹名（不伪造） |
| 3 | changing search clears selection and keeps batch actions sco | 0.77s | 0.46s | KEEP | 改搜索清空选择，批量动作只作用于可见结果（防误操作） |
| 4 | older search requests cannot overwrite the latest visible re | 1.49s | 0.76s | KEEP-INCIDENT | 旧搜索响应不覆盖新结果（竞态）。组件有 180ms 搜索防抖（personal-asset-library.tsx:85-94），本条要等两次真实防抖；可用 fake timers 或把 180 做成可注入，串行 0.76s→约 0.3s |
| 5 | text previews retain the complete saved content and use no w | 1.25s | 0.29s | KEEP | 文本预览展示完整内容、不调写接口 |
| 6 | pagination requests the next server page while category tota | 1.43s | 0.51s | KEEP | 翻页请求下一页、分类总数全局（page 契约） |

#### `src/ip/studio-billing-dialog.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | new choices start on personal funds even when enterprise is  | 4.37s | 0.19s | KEEP-INCIDENT | 新选择默认个人资金（付款人） |
| 2 | enterprise insufficiency never automatically switches to per | 0.66s | 0.04s | KEEP-INCIDENT | 企业积分不足不自动切个人（钱） |
| 3 | suspended membership disables enterprise while personal crea | 0.32s | 0.02s | KEEP-INCIDENT | 成员停用时企业不可选、个人可用 |
| 4 | a disallowed enterprise model still permits explicit persona | 0.37s | 0.03s | KEEP-INCIDENT | 模型未获企业授权仍可显式个人付 |
| 5 | text billing discloses the freeze ceiling and actual settlem | 0.26s | 0.01s | KEEP-INCIDENT | 文本计费说明冻结上限与实际结算（计费披露） |
| 6 | backend enterprise feature disabled permits explicit persona | 0.16s | 0.03s | KEEP-INCIDENT | 仅 mine 404 才允许个人付 |
| 7 | enterprise service network failures continue to block every  | 0.11s | 0.02s | KEEP-INCIDENT | 企业服务网络失败阻断所有新付款选择 |
| 8 | accounts without an enterprise generate with personal funds  | 0.01s | 0.00s | KEEP | 无企业账号直接个人付、不弹窗；与 canvas-bridge/studio-billing.test.ts「feature off preserves personal calls」相近但层不同（对话框入口 vs 请求层），保守不并 |
| 9 | saving a chosen enterprise skips future questions and is iso | 0.12s | 0.05s | KEEP-INCIDENT | 保存默认企业后不再问、按账号+企业隔离，超额也不静默换付款人 |
| 10 | settings can change a default to personal or restore asking  | 3.04s | 0.41s | KEEP | 设置页可改默认/恢复每次询问（真实 Select，0.41s 串行） |

#### `src/ip/enterprise-management.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | suspend previews exact available and pending consequences be | 3.97s | 0.31s | KEEP-INCIDENT | 停用前预览可用/冻结积分 + 显式确认 fingerprint（钱） |
| 2 | lifecycle failure retains preview and original idempotency k | 1.31s | 0.08s | KEEP-INCIDENT | 生命周期失败保留预览与原幂等键 |
| 3 | ordinary member cannot invoke administrator controls and can | 0.40s | 0.03s | KEEP | 普通成员无管理控件、可接受主账号移交（权限） |
| 4 | model policy selects human model names and sends endpoint id | 0.32s | 0.04s | KEEP | 模型策略显示人话名称、提交 endpointId+version（契约） |
| 5 | close with unresolved funds shows blockers and cannot submit | 0.07s | 0.03s | KEEP-INCIDENT | 有未结资金不能关闭企业 |
| 6 | group invitation creates a shareable 90-day link and stays v | 0.36s | 0.08s | KEEP | 群发邀请 validDays:90 + 链接带 #token（不进 query） |

#### `src/ip/studio-storyboard.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | all canvas nodes appear once without shot metadata; drafts,  | 0.63s | 0.14s | KEEP | 所有节点出现一次（含纯函数 studioStoryboardGroups 断言 + 渲染断言） |
| 2 | node opening and link navigation use original identities, an | 0.43s | 0.07s | KEEP | 打开节点用原身份、画布更新替换投影；末尾 studioStoryboardLinks 去重/去悬空为纯函数断言 |
| 3 | empty types stay visible and expansion can always restore al | 0.40s | 0.04s | KEEP | 空类型可见、展开后能恢复全部 |
| 4 | queue, failure and previous media status take precedence ove | 0.00s | 0.00s | SLOW-NARROW | 纯函数 studioStoryboardStatus（src/canvas-bridge/studio-storyboard.ts），未 render；canvas-bridge 下没有 studio-storyboard.test.ts，可挪过去（node）。0.00s，挪不省时 |
| 5 | shot edits keep the original canvas identity and notify link | 0.04s | 0.00s | SLOW-NARROW | 纯函数 updateStudioStoryboardShot，保留已受理输出（数据）。同上可挪到 node；0.04s，挪不省时 |
| 6 | selected detail keeps only its typed list, switches types an | 4.69s | 0.15s | KEEP | 选中详情只显示同类列表、切类型、跟随实时内容。并行 4.69s 是争用，串行 <0.25s |

#### `src/ip/studio-attachment-picker.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | canvas exposes direct upload and sends the selected files wi | 2.22s | 0.11s | KEEP | 画布直传不经额外菜单（cheap） |
| 2 | canvas library opens outside the toolbar and adds the select | 1.33s | 0.26s | KEEP | 资产库弹窗不在工具栏内、加入后 aria-expanded 复位 |
| 3 | selection survives server search and pagination and emits pr | 1.07s | 0.54s | KEEP | 选择跨服务端搜索/翻页保留，输出精确资产 |
| 4 | load and insertion failures preserve selection for an explic | 1.46s | 0.50s | KEEP | 加载与插入失败都保留选择可重试（丢选择） |

#### `src/ip/demo-admin.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | groups templates and examples in the shared page and keeps o | 1.77s | 0.15s | COPY-ONLY | 主要断标题/region/「已上线」「已下线」文字与 id 文本；唯一有契约价值的是「下线内容仍显示」。建议并进 #3（同一 render 已等到列表）保留「已下线」一条，删本条；省约 0.1s 串行 |
| 2 | edits display information and reloads sorting without changi | 2.30s | 0.09s | KEEP | 编辑只改展示字段（name trim/summary/sortOrder 请求体），重读排序 |
| 3 | reports a failed toggle without claiming the state changed,  | 1.16s | 0.24s | KEEP | 切换失败不谎报状态、可重试 |
| 4 | keeps operator and super admin permissions when changing the | 0.35s | 0.05s | KEEP | operator 无删除、none 不请求（权限） |
| 5 | shows loading, error recovery and the empty state | 0.19s | 0.04s | KEEP | 加载/错误重试/空态 |
| 6 | requires the existing destructive confirmation before deleti | 0.26s | 0.04s | KEEP-INCIDENT | 删除前必须二次确认，取消不调 remove（数据删除） |

#### `src/ip/enterprise-invitation-landing.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | anonymous user sees real company and registers/logs in then  | 1.50s | 0.26s | KEEP-INCIDENT | 匿名注册登录后接受邀请；不把企业 token 当推荐码；产品接口失败仍保留登录 |
| 2 | SMS validation and countdown prevent duplicate sends and dis | 0.83s | 0.25s | KEEP | 短信校验与倒计时防重复发送 |
| 3 | logged-in user explicitly confirms instead of joining on pag | 0.33s | 0.12s | KEEP | 已登录须显式确认、连点只 accept 1 次 |
| 4 | successful join clears the bearer only after persistence and | 0.77s | 0.09s | KEEP | 加入成功后才清 hash 里的 bearer |
| 5 | existing membership in another enterprise is visible and nev | 0.09s | 0.05s | KEEP | 已在其他企业不自动切换 |
| 6 | same-enterprise membership leads directly to management with | 0.28s | 0.11s | KEEP | 同企业成员直达管理不重复建成员 |
| 7 | product enrollment is retained and joining retries with the  | 0.54s | 0.08s | KEEP | 产品未开通：开通后用同一 token 重试 |
| 8 | expired/revoked invitation blocks SMS registration; network  | 0.59s | 0.09s | KEEP | 失效邀请阻断短信注册；网络错误可重试 |
| 9 | missing token makes no preview call; impersonation never reg | 0.39s | 0.04s | KEEP | 无 token 不请求预览；代登录（impersonation）不注册不加入（安全） |
| 10 | opening a different invitation fragment reloads the preview  | 0.45s | 0.07s | KEEP | hashchange 换邀请重新预览 |

#### `src/ip/supplementary-asset-library.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | avatar categories and search preserve each real asset destin | 2.71s | 0.37s | KEEP | 分类/搜索保留真实跳转地址、隐藏过期授权 |
| 2 | failed grants do not hide successful avatars and unknown lic | 1.10s | 0.13s | KEEP | 授权读取失败不藏形象、未知授权不显示「待完成」（不伪造） |
| 3 | real avatar license status remains accurate on redesigned ca | 0.22s | 0.02s | KEEP | 真人授权到期状态准确（cheap；断的是状态映射文字，属被测行为） |
| 4 | voice pagination, category and language filters include all  | 1.66s | 0.33s | KEEP | 声音分页/分类/语言筛选含全部、无播放调用 |
| 5 | voice load failure is a single retryable error rather than a | 0.06s | 0.05s | KEEP | 声音读取失败是单条可重试错误而非空库 |

#### `src/ip/studio-motion-prompt.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | insertion preserves text and upstream reference at the remem | 2.32s | 0.33s | KEEP | 记住的光标插入运镜、保留引用 |
| 2 | selection is replaced without replacing the surrounding prom | 0.77s | 0.07s | KEEP | 替换选区、X 只删该指令 |
| 3 | keyboard Backspace removes a whole motion chip and retains s | 0.13s | 0.01s | KEEP | test.each Backspace 整块删 chip |
| 4 | keyboard Delete removes a whole motion chip and retains surr | 0.13s | 0.01s | KEEP | test.each Delete 整块删 chip |
| 5 | editing a chip exposes its full instruction and normal edits | 0.08s | 0.02s | KEEP | 编辑 chip 展开完整指令、无隐藏第二份值 |
| 6 | copy and cut serialize complete instructions and reference l | 0.31s | 0.02s | KEEP | 复制/剪切序列化完整指令与引用标签 |
| 7 | paste accepts plain text only and restores both instruction  | 0.34s | 0.02s | KEEP | 粘贴只收纯文本并还原 chip/引用（安全） |
| 8 | search empty state and Escape are keyboard accessible; openi | 0.32s | 0.04s | KEEP | 搜索空态与 Esc 键盘可达，打开不改 prompt |
| 9 | restoring a saved prompt reconstructs the same chip; unrelat | 0.07s | 0.02s | KEEP | 恢复已存 prompt 重建 chip；无关重渲染保留光标 |
| 10 | palette pointer and click events never deselect the underlyi | 0.56s | 0.07s | KEEP | 调色板事件不冒泡取消画布选中 |
| 11 | Escape reaches the containing panel only after the reference | 0.38s | 0.04s | KEEP | Esc 先关引用选择器再交给外层面板（§8.0.1 ⑭ Esc 规则） |
| 12 | Chinese composition hides the placeholder without publishing | 0.09s | 0.02s | KEEP-INCIDENT | 中文输入法预编辑不发布半截文字 |
| 13 | cancelled composition restores the placeholder and compositi | 0.11s | 0.01s | KEEP-INCIDENT | 取消预编辑恢复占位、预编辑 Enter 不提交 |

#### `src/components/hub/studio-home.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | the home opens on the conversation box: a brief creates a ca | 2.54s | 0.24s | KEEP | 首页一句话：发前不建画布，发后建 1 个并带 send=1；首屏 href 断言偏结构 |
| 2 | a brief that copies a reference video opens the canvas witho | 0.97s | 0.23s | KEEP-INCIDENT | Production 2026-10-19：复刻类开头不自动发（先扣一轮积分只换来「请上传视频」） |
| 3 | a specific home tool still opens its intended workflow on ex | 0.82s | 0.09s | KEEP | 专项入口仍走对应 start 参数 |
| 4 | versioned personal template uses the shared direct-copy entr | 1.20s | 0.24s | KEEP | 版本化个人模板走直接复制入口、不建画布 |

#### `src/ip/studio-video-prompt-notes.test.tsx`

| # | 用例(前60字) | 并行耗时 | 串行耗时 | 分类 | 理由 |
|---|---|---|---|---|---|
| 1 | before a run: recognised lines and the option to keep the te | 0.07s | 0.02s | KEEP | 只对会改写的模型、未勾「按原文」时提示；台词识别本身在 studio-video-prompt.test.ts，这里测门控 |
| 2 | after a run: the lines the vendor dropped, said as after-the | 1.24s | 0.18s | KEEP | 出片后说明模型丢了哪些台词 + 查看实际描述入口 |
| 3 | the composer reads the adopted take, else the first take tha | 0.04s | 0.00s | SLOW-NARROW | 纯函数 studioComposerTake（src/ip/studio-video-prompt-notes.tsx），未 render；可挪 node（需把函数拆到 canvas-bridge 或在 .tsx 里 node 也能 import）。0.04s，挪不省时 |
| 4 | the run input view shows what each take was generated from | 0.24s | 0.01s | KEEP | run 输入视图逐候选显示实际描述 |
| 5 | a model or older job without a rewrite report shows nothing  | 0.01s | 0.00s | KEEP | 老任务无改写报告不显示多余内容 |
| 6 | the task list points out a take that lost lines | 0.08s | 0.03s | KEEP | 任务列表标出丢台词的候选（接线） |
| 7 | frame question: three explicit answers; the offer names the  | 3.83s | 0.17s | KEEP | 首帧问题三个显式选项 + 推荐模式；推荐逻辑纯函数已在 studio-video-prompt.test.ts「which mode the frame question suggests」，这里测对话框接线与 cancel/text/bind 回调；串行 <0.25s，并行 3.8s 为首次 antd Modal 渲染 + 争用 |


### 五、汇总

| 分类 | 条数 | 并行耗时合计（timings.tsv） | 串行耗时合计 |
|---|---|---|---|
| KEEP-INCIDENT | 79 | 108.4 s | 24.6 s（含 project-sync 约 14 s 睡眠） |
| KEEP | 129 | 198.7 s | 16.1 s |
| MERGE | 2 | 3.4 s | 0.37 s |
| COPY-ONLY | 1 | 1.8 s | 0.15 s |
| SLOW-NARROW | 5 | 0.2 s | 0.01 s |
| UNSURE | 1 | 3.2 s | 0.33 s |
| **合计** | **217** | **315.7 s**（timings 文件头合计 343 s，差额是 setup/hook） | **41.6 s** |

**能删 / 并掉的**：最多 4 条（2 MERGE + 1 COPY-ONLY + 1 UNSURE 若采纳）。
- `studio-create-home` #6 并进 #1，`project-sync` #3 并进 #1，`demo-admin` #1 的「已下线仍显示」断言并进 #3 后删掉，`ip-management` #1（UNSURE）并进 #7。
- 按 timings.tsv 算约省 **8.4 s**；按串行实测只省约 **0.85 s**。前者是争用放大后的数，后者才是真实成本。
- 失去的保护：没有。合并后断言原样保留；demo-admin #1 只丢标题/region 这类结构断言。

**不删用例、只改写法能省的**（预估真实墙钟）：
- project-sync 改 fake timers：**约 −14 s**（16.5 s → 约 2.5 s），保护不变。
- create-home 删除用例缩小夹具：约 −1.5 s。
- personal-asset-library 搜索防抖用 fake timers：约 −0.4 s。
- 合计约 −16 s 真实耗时。全量并行下这几条在 timings 里的数字会降得更多，因为它们在争用里被放大了。

**最该做的是第二节第 2 条**：限制 jsdom 并发或放宽超时。这一段 343 s 里约 300 s 是争用，删用例解决不了这部分。

**SLOW-NARROW 的 5 条**都是 jsdom 文件里的纯函数用例，每条 <0.1 s，挪到 node 不省时间，只是放对位置。这一段没有「整页渲染只为测一个纯函数、还很慢」的用例：慢的那几条测的都是真交互（翻页请求量、竞态、焦点、拖动、Modal）。

## 附录 D · 其余文件


范围：101 个文件、628 条用例（rank ≥26，扣掉 brief 列出的 studio-dialogue/assistant 等 10 个文件；`studio-assistant.test.tsx` 排名 <26，本来就不在范围内）。
仓库：`apps/web-aiavatar`，只读。

### 先说结论

- 这一段没有大块冗余。628 条里 **180 条 KEEP-INCIDENT**（注释里有事故版本号、Codex 复核、线上数据、或钉着计费 / 幂等 / 不丢数据），**47 条是 wiring 结构测试**（全部保留），**354 条 KEEP**。
- **建议合并 36 条**，几乎全是 node 环境、每条 0.00s 的纯函数用例。合并能少报 36 条，**基本不省时间**（合计 <0.5s）。
- **没有找到要标 COPY-ONLY 的整条用例**。有几条用例在契约断言之外夹带了文案断言，可以删掉那几行（见 §4），用例本身保留。
- **没有找到符合定义的 SLOW-NARROW**（>2s、靠整页渲染测纯函数逻辑）。这一段里 >2s 的 jsdom 用例**都是文件里的第一条**（signed-image 4.50s、studio-analysis-document 4.14s、studio-config-composer 4.01s、studio-node-content 3.97s、canvas-node-video 3.67s、studio-media-generation-state 3.21s…），同一文件后面几条只要 0.0x–0.5s。花的是模块导入和 jsdom 初始化的时间（antd、画布组件），不是这条用例本身。**删 jsdom 文件里的单条用例几乎不省时间，只有删掉或合并整个文件才省。**
- 真正能省时间的只有三处：
  1. `generation.test.ts` 的两条「停止」用例走真实的 1.5s 轮询 sleep（`POLL_MS = 1500`，sleep 不响应 abort）。换成 `vi.useFakeTimers()` 能省约 **3.5s**，用例不删。
  2. **UNSURE：三个文件只在测没有挂上路由的 vendored 页面**（`canvas/pages/canvas/project.tsx` 全仓没有任何地方 import）：`canvas-node-video.test.tsx`（2 条，3.8s）、`canvas-node-prompt-panel.test.tsx`（5 条，2.7s）、`docked-overlays.test.tsx`（4 条，0.8s）。共 11 条、约 **7.3s**。要不要删需要人判断，见 §3。
  3. `studio-media-generation-state.test.tsx` 的 test.each 和 `studio-flow-card.test.tsx` 重复。把剩下那条排队用例挪进 flow-card 文件，整个文件就能删，约省 **3.5s**；只删那两条用例的话只省约 0.3s。

### 汇总

| 分类 | 条数 | 说明 |
|---|---:|---|
| KEEP-INCIDENT | 180 | 原样保留 |
| KEEP | 354 | 原样保留 |
| WIRING（结构测试） | 47 | 原样保留：recovery 9 / publish 12 / conflict 8 / demo-admin 8 / dialogue 6 / video-prompt 3 / select-field 1 |
| MERGE | 36 | 合并或删除（被合并方的断言并进保留方） |
| UNSURE | 11 | 三个只测未挂路由的 vendored 代码的文件 |
| COPY-ONLY | 0 | 只建议删 4 处夹带的文案断言行 |
| SLOW-NARROW | 0 | 另有 fake timers 建议（generation.test.ts） |
| **合计** | **628** | |

- 可删 / 可并：**36 条确定 + 11 条待定 = 47 条**。另有 account-navigation 的 15 条可选（§2.6），那只是少报几条，没有实际意义。
- 可省时间：MERGE 合计 ≈0.5s（app-chrome 0.26s + media-generation-state 0.2–0.3s，其余 0s）；fake timers ≈3.5s；把 media-generation-state 整个文件并进 flow-card ≈3.5s；signed-audio 和 signed-video 合成一个文件 ≈0.7s；UNSURE 三个文件 ≈7.3s。**全部做完最多省 15s 左右，在基线 662s 里不到 3%。** 这一段的时间大头在文件初始化，不在用例条数。
- 会失去什么：MERGE 那 36 条只是并到同文件或别的文件的同一断言里，**不丢保护**，代价是失败信息粒度变粗（比如 test.each 改成一个循环以后，报错只说「这一组里有一个错了」）。UNSURE 那 11 条删掉的话，会失去对 vendored `CanvasNode` / `CanvasNodePromptPanel` / `CanvasNodeHoverToolbar` 里本仓改动的保护；**这些组件今天在 Studio 里没有入口**，以后如果有人把 project.tsx 重新挂上，这些回归（换批时已采用的视频不消失、持久化的待定任务不能再次触发生成、浮层不跟着缩放）就没人守了。

---

### 1. 大文件逐条

#### 1.1 `src/canvas-bridge/video.test.ts`（26 条，node，0.5s）

| 用例 | 耗时 | 分类 | 理由 |
|---|---|---|---|
| 面板上选的时长 / 比例 / 模型都要送到服务端 | 0.02 | KEEP-INCIDENT | v0.176 事故 |
| 节点上选的视频模型（config.model）胜过全局默认 | 0.00 | KEEP-INCIDENT | v0.179；作为下一条的合并目标 |
| 没有 model 时才回落 videoModel；两个都空就不传 | 0.00 | MERGE | 和上一条测同一条优先级链（model → videoModel → 不传）。并成一条三段断言，或一个 `it.each` |
| options 显式给的值优先于 config | 0.00 | KEEP | config 和 options 的优先级（§8.0.1 ④） |
| 比例是 auto 就不传 | 0.00 | KEEP | |
| 真的没有时长时当场说清楚 | 0.01 | KEEP-INCIDENT | v0.176 |
| 全能参考模式我们还没有 —— 明说，不悄悄按首帧跑 | 0.00 | KEEP | 老模型走 reference 模式会被拒，§8.0 |
| generating again or retrying keeps the node's 「按原文生成」 | 0.04 | KEEP-INCIDENT | Codex review 47c057ea |
| a model that does not rewrite never receives the switch | 0.00 | KEEP-INCIDENT | 同上 |
| Codex's repro: text names a first and last frame… | 0.02 | KEEP-INCIDENT | 同上；钉着「不确认就不保存、不提交」 |
| pictures that are actually carried are not asked about… | 0.00 | KEEP-INCIDENT | 同上 |
| uses this endpoint's batch choices before submitting | 0.00 | KEEP | 端点 batchCounts 闸 |
| native frame mode sends two keys, quality, seed and an approved cost | 0.00 | KEEP | maxCost=320（计费上限） |
| reference mode sends image, video and audio keys | 0.00 | KEEP | 不丢参考 |
| submits a configured custom mode, tier, canvas… | 0.01 | KEEP | 自定义模式，maxCost=88 |
| legacy models reject the second reference | 0.00 | KEEP | 不提交只带一半参考的请求 |
| 视频任务轮询路径：打的是 ip-studio 自己的接口 | 0.01 | KEEP-INCIDENT | v0.177，读源码的结构断言 |
| 一键建数字名片 body 传对象 | 0.26 | KEEP-INCIDENT | v0.179。放在 video.test 里位置不对，可以挪到 card 相关的测试，但不建议删 |
| isVideoTaskFailed：服务端明确说失败 = 是 | 0.00 | KEEP-INCIDENT | 作为下面三条的合并目标，改成 `it.each([[VideoTaskFailed,true],[超时,false],[TypeError,false],[Canceled,false]])` |
| isVideoTaskFailed：前端等超时 = 不是 | 0.00 | MERGE | 只换了参数，并进上一条 |
| isVideoTaskFailed：网络抖动 = 不是 | 0.00 | MERGE | 同上；`review-edge-cases.test.ts` 里还有一条一字不差的同样断言（§2.4） |
| isVideoTaskFailed：用户取消 = 不是 | 0.00 | MERGE | 同上 |
| 任务说成了却没有成片地址：按「还没结束」处理 | 0.00 | KEEP | |
| saves the exact request before submitting one four-item batch | 0.00 | KEEP-INCIDENT | 先存再提交、maxCost、幂等 |
| does not submit if persisting the recovery request fails | 0.00 | KEEP-INCIDENT | 存不上就不提交 |
| marks a lost submission response as unconfirmed… | 0.00 | KEEP-INCIDENT | 未确认受理时保留 clientRequestId |

合计：KI 13 / KEEP 9 / MERGE 4。

#### 1.2 `src/canvas-bridge/studio-video.test.ts`（20 条，node，0.3s）

| 用例 | 分类 | 理由 |
|---|---|---|
| uses a configured custom mode for frames, references, label… | KEEP | 和 video.test 的 custom mode 用例不在同一层（这里测 settings/quote/error 纯函数，那边测提交层），不算重复 |
| sends ordered first and last keys and the chosen seed | KEEP | 包括报价 280 |
| preserves mixed references in order and includes image surcharge | KEEP | 加价计费 |
| rejects incomplete uploads and extra references instead of dropping them | KEEP | §8.0 不静默丢参考 |
| unpriced, duplicate, audio only and out of contract input cannot submit | KEEP | |
| adds optimizePrompt=false only when chosen… | KEEP-INCIDENT | 「按原文生成」（2026-10-20） |
| a reopened node restores the choice from its accepted request… | KEEP-INCIDENT | 同上；和 video.test 的「generating again…」测的函数不同（`studioVideoNodeSelection` 和 `studioVideoKeepPrompt`），不算重复 |
| inherits unsent frame selection, native geometry and quantity… | KEEP | |
| reopens the exact custom mode, tier and canvas from the accepted request | KEEP | 作为下面两条的合并目标：三条的期望值完全一样，都是 `{ratio:"2:3",draft:{mode:"product-shot",tier:"portraitX"}}`，只是来源不同（request / preset / 只有 metadata）。改成一个 `it.each` |
| reopens an authored template with a custom ratio before any request | MERGE | 并进上一条 |
| keeps a custom tier when only the native video node metadata remains | MERGE | 并进上一条 |
| uses current control edits and keeps mixed references… | KEEP | |
| treats a selected image as a first frame… | KEEP | |
| starts a storyboard video with the authored shot duration… | KEEP | |
| does not carry an unsupported 3:4 image ratio… | KEEP-INCIDENT | 2026-10-03 厂商把竖屏默认改成 3:4 |
| 末 5 条 video selection across modes / IP library / legacy models | KEEP ×5 | 换模式时不丢、不复活已删的参考，各测一种路径 |

合计：KI 3 / KEEP 15 / MERGE 2。

#### 1.3 `src/canvas-bridge/generation.test.ts`（19 条，node，3.7s）

| 用例 | 耗时 | 分类 | 理由 |
|---|---|---|---|
| 把候选图变成画布认得的形状，并带上存储键 | 0.02 | MERGE | 和「读的是 output.candidates（不是 outputs）」测的是同一件事（done 结果 → storageKey）。把这条的 `dataUrl === 签名地址` 断言并过去，删这条 |
| 只把带存储键的参考图报给服务端 | 0.14 | KEEP | |
| 文生图就是没有参考图的出图 | 0.00 | KEEP | 这是 requestGeneration 的入口，refKeys 为空数组 |
| 把所选张数交给端点规格校验，不在客户端静默截断 | 0.03 | KEEP | |
| 服务端说失败就抛，且带上它给的原因 | 0.03 | MERGE | 「失败时也记」那条已经断言了 `rejects.toThrow(errorMessage)`。删这条，或把 errorCode 放进那条的 fixture |
| 跑完了但一张图都没有，也算失败 | 0.00 | MERGE | 和「真的没有候选时，不许谎称积分已退回」用的是同一个 fixture（done、候选为空）。并成一条：断言 `/没有返回图片/` + 含运行号 + 不含「已退回」 |
| 用户取消抛的是取消，不是失败 | 0.01 | KEEP | 受理前就取消的那条早返回路径 |
| 画布还没打开就点生成，给一句人话 | 0.00 | KEEP | |
| 读的是 output.candidates（不是 outputs） | 0.00 | KEEP-INCIDENT | v0.162；合并目标 |
| 真的没有候选时，不许谎称积分已退回 | 0.00 | KEEP-INCIDENT | 计费如实说明；合并目标 |
| 成功时记下完整提示词与参考图生效情况 | 0.01 | KEEP | |
| 失败时也记 | 0.00 | KEEP | 合并目标 |
| 节点上选的模型胜过全局默认 | 0.00 | KEEP-INCIDENT | v0.179；合并目标 |
| 调用方传的是原始全局 config 时回落到 imageModel | 0.00 | MERGE | 只换了参数，并进上一条（和 video.test 同一个模式） |
| 一个候选都没配时不传 model | 0.00 | MERGE | 同上 |
| 服务端一受理就回调 onAccepted | 0.00 | KEEP-INCIDENT | 刷新时不丢已付费的图 |
| resumeRun 只读运行、绝不重发生成请求 | 0.00 | KEEP-INCIDENT | 不重复扣费 |
| abort 时调 cancelRun，并抛取消 | **1.51** | KEEP-INCIDENT | **用 fake timers**：`generation.ts:109` 的 `setTimeout(POLL_MS=1500)` 不响应 abort，每条都要实打实等 1.5s |
| 取消请求本身失败不改变结论 | **1.98** | KEEP-INCIDENT | 同上；两条加起来约省 3.5s |

合计：KI 7 / KEEP 7 / MERGE 5。

#### 1.4 `src/canvas-bridge/retry-and-resume.test.ts`（19 条，node）

都是 v0.175 / v0.179 / Codex #7 的回归。只建议并两处：
- 「重出的是**别的**候选时仍然不动主图」→ **MERGE** 进「已经有主图时只进候选，不动节点当前显示的那张」。两条的 fixture 逐字相同，前者只多一个 `storageKey` 断言，把它加进后者。
- 「浏览器没给 type 时按扩展名认」→ **MERGE** 进「只收 JPG / PNG」（同一个函数 `isSupportedUploadImage`，只换了参数）。

其余：KI 12（存的是 OSS 存储键、签名换不出也保留、留了运行号的候选不许标失败、混着两种、视频按 videoTaskId 接回、还没有主图时、已经有主图时、节点级 runId 四条、主候选就是这一张）；KEEP 5（外链、不是 edit、没运行号照旧标失败、只收 JPG/PNG、别的节点原样返回）。

#### 1.5 `src/canvas-bridge/studio-nodes.test.ts`（19 条，node）

- 「does not erase the previous adopted image on a failed retry」→ **MERGE** 进「keeps committed candidates when a multi-image run partially fails」。后者已经断言了 `status=error` 加 `storageKey 仍是 first.jpg`；前者只是失败的那次 output 为空。并成一条，喂两个失败 run。
- 其余 18 条：KI 15（都在钉「已采用的媒体 / 用户编辑 / 待定请求不丢」：脚本 Markdown 不被覆盖、排队不丢已采用的图、口型对照、配音 request、助手回复不重复、批次四个槽位、导入的素材保留为一个版本、文字修订不覆盖手改）；KEEP 3（storyboard 命名与顺序、完成的脚本替换 brief 草稿、第二集 episodeNo）。

#### 1.6 `src/shell/account-navigation.test.ts`（19 条，node，0.0s）

18 条来自 3 个 `it.each` 表，外加 1 条普通用例，测的都是 `studioEntryDestination` 和 `accountPageKey`，**全部 KEEP**（v0.230 的入口迁移，每一行是一条要保留的深链）。
可选做法：把 3 张表改成 3 条用例，每条里面一个 `for` 循环，报告上会从 19 条变成 4 条。**没有实际收益**，失败信息也会变模糊，所以不计入 MERGE。

#### 1.7 `src/canvas-bridge/studio-plan-execution.test.ts`（18 条，jsdom，0.1s）

- R6-02 那一组的两条「does not restore outputs this browser already projected…」和「restores outputs on a browser that never projected them」→ **MERGE** 成一条（同一个函数 `executionOutputMissing`、同一个 run，正反两种输入）。后一条的断言和「the canvas-open signal」第一行 `executionOutputMissing(list, [], new Set())===true` 重复；前一条（空画布 + 已投影过）是独有的，保留它的断言和 Codex R6-02 的标注。
- 其余：KI 11（restore 那一组 8 条，fixture 照服务端 DTO 和 e2e D05 写，包括 Codex R7-01；never overwrites text；updates server-owned media but keeps user edits；R6-02 合并后剩下的那条）；KEEP 6。
- 备注：整个文件跑在 jsdom 里，但只有 restore 那一组用到 localStorage。这个文件只花 0.1s，不值得拆。

#### 1.8 `src/shell/layout-mode.test.ts`（17 条，jsdom，1.5s）

| 用例 | 分类 | 理由 |
|---|---|---|
| 「请求桌面版网站」要认得出来（980） | KEEP-INCIDENT | 真实反馈 ① |
| 横屏手机不该被误判成桌面（956） | KEEP-INCIDENT | 同上；作为下一条的合并目标 |
| 竖持手机是手机版（390） | MERGE | 956 已经覆盖了「<960 是手机」。并成一个 `it.each([[956,'mobile'],[390,'mobile']])` 或直接删 |
| 用户显式选过的压过视口宽度 | KEEP | `resolvedLayout` 的路径 |
| 存了别的值当作没选过 | KEEP | |
| 首帧脚本能跑，且写出来的属性与 resolvedLayout 一致 | KEEP | |
| 存的偏好与自动判定一致时会被清掉 | KEEP-INCIDENT | 「永远粘住」 |
| 与自动判定**不同**的偏好要留着 | KEEP | 合并目标 |
| setLayout 只存「与自动不同」的那次 | KEEP | |
| 首帧脚本读得到用户的选择 | MERGE | 上一条已经断言了首帧脚本按用户的选择写出 `data-layout`（390 + desktop），这条只是反方向（1600 + mobile）。并进上一条，两个方向都测 |
| 拖窗口变窄时属性跟着改 | KEEP-INCIDENT | 1.40s，主要是 resetModules 加 testing-library 的导入 |
| 用户显式选过就不跟视口跑 | KEEP-INCIDENT | |
| 没选过时属性与通知都要发生… | KEEP | |
| 4 条「CSS 与 JS 读的是同一个真值」 | KEEP-INCIDENT ×4 | 读源码的结构断言（v0.193 next/script 太晚、真实反馈 ②） |

合计：KI 9 / KEEP 6 / MERGE 2。

#### 1.9 `src/canvas-bridge/flow-document.test.ts`（16 条，node）

16 条测的都是不同的行为（拖拽、尺寸、选中状态不进文档、复制时不带走已受理任务、组移动、整理布局），**全部保留**。KI 4（cannot duplicate an active script edit ×2，因为同一个 `one-paid-key` 不能复制；copies media but never reclaims the accepted task；protects accepted active work），KEEP 12。

#### 1.10 `src/canvas-bridge/studio-video-prompt.test.ts`（15 条，node）

**全部 KEEP-INCIDENT**：2026-10-20 生产提示词的结构，加 Codex review 47c057ea（P2）。`studioFrameIntentCopy` 那几行断言的是给用户看的说明文字，但这些文字本身就是被测的行为（告诉用户模型能干什么、不能干什么），按 ⑩ 的例外保留。

---

### 2. 其余文件（按文件给结论，只列要动的用例）

#### 2.1 确定合并（共 19 条，上面 1.x 节之外的）

| 文件 | 用例 | 耗时 | 分类 | 和谁重复、怎么并 |
|---|---|---|---|---|
| `ip/studio-media-generation-state.test.tsx` | a running image task shows centered visual feedback… | 3.21 | MERGE | `ip/studio-flow-card.test.tsx` 的 test.each「%s generation is centered and disappears…」逐字断言了同样的 `status` 文案和 `progressbar aria-valuenow`。`StudioFlowCard`（`studio-flow-canvas.tsx:78`）内部渲染的就是 `StudioMediaGenerationState`，而 flow-card 那条还多测了「完成后消失」。删 |
| 同上 | a running video task shows… | 0.22 | MERGE | 同上 |
| 同上（建议） | queue and unconfirmed submission do not show misleading percentages | 0.36 | KEEP-INCIDENT | v0.221「不编造进度」。**建议挪进 studio-flow-card.test.tsx**，然后删掉整个文件，省 ≈3.5s |
| `shell/app-chrome.test.tsx` | `/projects/IPP-new?start=video` uses the full canvas viewport… | 0.18 | MERGE | 和 `?start=image` 那条**完全等价**：用例里写的是 `state.path = url.split("?")[0]`，`AppChrome` 读的是 `window.location.search`，而测试里没有设置它。三个 `?start=` 跑的是同一条路径。test.each 里只留 `/projects/IPP-new` 和 `/projects/IPP-copy` |
| 同上 | `/projects/IPP-new?start=script` … | 0.07 | MERGE | 同上 |
| 同上 | `/create` retains normal product navigation | 0.01 | MERGE | 第一组每条都从 `/create` 出发，并断言 `/create` 有导航，已经覆盖。从 retain 表里删掉 `/create` |
| `canvas-bridge/review-edge-cases.test.ts` | 网络错误不能判为视频服务端终态失败并清除任务号 | 0.00 | MERGE | 和 `video.test.ts`「网络抖动 = 不是」逐字相同（`isVideoTaskFailed(new TypeError('Failed to fetch'))===false`）。删这条，保留 video.test 那条（合并后的 it.each） |
| `canvas-bridge/studio-image-upload.test.ts` | rejects unsupported or oversized files before making an upload request | 0.00 | MERGE | `validateStudioImageUpload` 只是从 `studio-image-file.ts` 再导出一遍；`studio-image-file.test.ts`「invalid and excessive originals are rejected before decoding」测的是同一个函数（`prepare` 第一行就调它）。把这条的边界值（8MB 通过、50MB+1、webp）并过去 |
| `canvas-bridge/video-duration.test.ts` | 调用方只有全局 config（没有 model）时才回落 videoModel | 0.00 | MERGE | 并进「用节点上选的模型（config.model）…」（同一条优先级链，同 video.test / generation.test） |
| 同上 | 区间未知（模型候选还没加载）时不拦 | 0.01 | MERGE | 并进「在区间内照常提交，秒数原样送出」：同一个断言 `durationSec` 原样，只是 bounds 换成 undefined |
| `canvas-bridge/models.test.ts` | 下拉值翻成服务端认的 id | 0.00 | MERGE | 并进「翻不出来就不传」：同一个函数 `endpointIdFor`，一正一反，fixture 相同 |
| `canvas-bridge/video-takes.test.ts` | disables navigation when there is only one playable take | 0.00 | MERGE | 并进「wraps only through successful keyed takes…」（同一个函数 `nextStudioVideoTake`） |
| `canvas-bridge/node-title.test.ts` | 本函数自己派生的值也命中 | 0.00 | MERGE | 并进「线上那批 slice(0,32) 的老标题一律命中」（都是 `looksAutoTitled` 应该命中的情况） |
| 同上 | 短名字一律放过 | 0.00 | MERGE | 并进「人手改过的名字不命中」（都是不该命中的情况，只换了参数） |
| 同上 | 没提示词的节点（上传的图）不算 | 0.00 | MERGE | 同上 |
| `canvas-bridge/download-media.test.ts` | MP4（ftyp box 在第 5 字节起） | 0.00 | MERGE | 并进「PNG / JPEG / WebP / GIF / BMP」（`sniffExtension` 只换了参数）。「这就是用户报的那个 bug」那条保留（KI），可以把第一条里重复的 JPEG 那一行删掉 |
| 同上 | 认得常见图 / 视频 / 音频；认不出返回 undefined | 0.00 | MERGE | 和「线上真实数据：key 是 .jpg…」测的是同一个函数 `mimeFromKey`，并成一条，保留线上数据那段注释 |
| `canvas-bridge/bridge.test.ts` | 网络抖动不该让画布上的图消失 | 0.00 | MERGE | 并进「服务端签不出来时返回 fallback」：期望值相同，只是 sign 一个返回 `{}`、一个 reject |
| 同上 | 空值不炸 | 0.00 | MERGE | 并进「能从嵌套结构里把所有 storageKey 找出来」 |
| `lib/datetime.test.ts` | 24 小时制，不出现 AM/PM 也不出现「下午」 | 0.00 | MERGE | 「统一成 年-月-日 时:分:秒」的正则 `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$` 已经排除了 AM/PM 和「下午」。可以把 14:05Z 这个样例并过去 |

（加上 §1 的 17 条，MERGE 一共 36 条。）

#### 2.2 文件级合并建议（条数不变，省文件初始化的时间）

- `canvas-bridge/signed-audio.test.tsx`（3 条）和 `canvas-bridge/signed-video.test.tsx`（3 条）：两个实现是复制粘贴的（`signed-audio.tsx` 和 `signed-video.tsx` 各自独立），所以两边的测试**都要留**。不过两个测试文件逐行对称，可以合成一个文件，用 `test.each([['audio',SignedAudio],['video',SignedVideo]])`（`signed-media.test.tsx` 已经是这么写的），省一个文件的 jsdom 初始化，约 0.7s。
- `ip/studio-media-generation-state.test.tsx`：见上表，并进 studio-flow-card.test.tsx 以后整个文件删掉。

#### 2.3 UNSURE：只测没挂上路由的 vendored 代码（11 条，约 7.3s）

`canvas/pages/canvas/project.tsx`（上游画布页，`export default CanvasPage`）全仓没有任何 import，`builtin-nodes.tsx` 和 `canvas-node-hover-toolbar.tsx` 也只被它引用。`ip/studio-video-prompt-wiring.test.ts` 的注释里自己也写了「the vendored node panel (not routed in Studio today)」。下面这些测试守的都是这条走不到的路径：

| 文件 | 条数 | 耗时 | 守的是什么 |
|---|---:|---:|---|
| `canvas/components/canvas/canvas-node-video.test.tsx` | 2 | 3.8s | `CanvasNode` 换批时已采用的视频不消失 |
| `canvas/components/canvas/canvas-node-prompt-panel.test.tsx` | 5 | 2.7s | `CanvasNodePromptPanel`：持久化的待定任务不能再次触发生成（这是计费不变量）、终态失败后能重新提交、运镜指令不丢 |
| `canvas-bridge/docked-overlays.test.tsx` | 4 | 0.8s | v0.187：浮层停靠在屏幕层（CanvasNodeHoverToolbar 和 project.tsx 的源码断言） |

判断依据：AGENTS.md 说 vendored 代码「尽量少改、改了留注释」，这些测试守的是本仓对 vendored 代码的改动，方便以后合并上游更新。**删不删要由维护画布的人决定**，所以标 UNSURE，不算进确定可删。如果决定保留 project.tsx 作为参考实现，它们就该留；如果确认它已经是死代码，可以连同 `studio-video-prompt-wiring.test.ts` 第 3 条（node panel 那条）一起删。

#### 2.4 全部保留的文件（KEEP / KEEP-INCIDENT，不动）

- **钱、幂等、不丢数据（KEEP-INCIDENT 为主）**：`studio-billing`（9，付款方选择与重放）、`studio-batch`（6，审批上限 / 来源变化）、`saved-assets`（5，账号切换、迟到响应）、`review-edge-cases`（合并 1 条后剩 6 条，Codex 独立复核：冲突后不发布、尾部保存）、`regenerate-in-place`（4，v0.175）、`studio-node-origin`（4，本地 e2e 2026-10-19）、`signed-media`（3，Codex R1）、`studio-speech`（5）、`studio-lip-sync`（2）、`studio-recreation.test.tsx`（9：未知响应不重复扣费、保存失败不提交）、`studio-template-source`（4：报价确认、同一 request id）、`studio-analysis-document`（1：保存失败不丢编辑）、`studio-image-file`（8，其中 test.each 2 条是 2026-10-20 生产事故）、`studio-work-clips`（10，2026-10-19 用户反馈 + IPP-6658ccda）、`studio-entry`（9，2026-10-19 生产命名）、`studio-film-study`（6）、`studio-packaging`（3）、`enterprise-reports`（5）、`studio-errors`（5，冲突不弹 toast）、`studio-floating-panel.interaction`（6，2026-10-19 走查时的 Esc 规则，§8.0.1 ⑭）、`studio-flow-card`（5，Codex R1）、`studio-task-list`（5，v0.221 排队）、`studio-frame-confirm`（1，Codex 47c057ea）。
- **行为契约（KEEP）**：`signed-image`、`studio-material-library`、`studio-config-composer`（IME 输入法组字）、`studio-node-content`、`ip-home`、`studio-flow-video-upload`、`studio-ip-library`（tsx 和 ts 两个）、`select-field`、`studio-distribution`、`invitation-workspace`、`invitation-registration`、`canvas-conflict-dialog`、`studio-generation-controls`、`assets-library`、`studio-script-markdown`、`studio-template-use`、`desktop-top-bar`、`studio-scene-workshop`、`studio-conversation-public`、`studio-conversation-share`、`studio-social-bind`、`canvas-gate-auth`、`studio-node-title`、`studio-video-settings`、`canvas-cover`、`studio-template-publish`、`auth.test`、`wallet-balance`、`studio-video-upload`、`canvas-bridge/studio-recreation.test.ts`、`studio-group-description.test.ts`、`studio-linked-inputs`、`studio-script.test.ts`、`studio-edit-timeline`、`studio-video-selection`、`viewport-placement`、`project-preview`、`studio-media-upload-api`、`studio-attachments`（和 image-file 部分重叠，但测的是附件这条路径，包括 exe 不支持）、`studio-task-title`、`template-projection`、`enterprise-invitation-link`、`studio-floating-panel.test.ts`、`studio-video-references`、`studio-node-command`。
- **WIRING（结构测试，一律保留）**：`recovery-wiring`（9）、`publish-wiring`（12）、`canvas-conflict-wiring`（8）、`demo-admin-wiring`（8）、`studio-dialogue-wiring`（6）、`studio-video-prompt-wiring`（3）、`select-field-wiring`（1）。

---

### 3. 跨文件重复一览（MERGE 的依据）

| 被测函数 / 契约 | 出现位置 | 处理 |
|---|---|---|
| `isVideoTaskFailed(TypeError)` 为 false | `video.test.ts`，`review-edge-cases.test.ts` | 删 review-edge-cases 那条 |
| 「节点上的模型 > 全局默认 > 不传」 | `video.test.ts`（视频）、`generation.test.ts`（图片）、`video-duration.test.ts`（时长区间） | 三处测的是**三个不同的调用点**，都要留；每个文件内部的 2–3 条正反用例各并成一条 |
| `validateStudioImageUpload` 拒收 | `studio-image-file.test.ts`、`studio-image-upload.test.ts`、`studio-attachments.test.ts` | 并掉 image-upload 那条；attachments 测附件路径，保留 |
| 生成中的居中状态和真实进度 | `studio-media-generation-state.test.tsx`、`studio-flow-card.test.tsx` | 删前者的 test.each |
| `studioVideoKeepPrompt` 和 `studioVideoNodeSelection(...).keepPrompt` | `video.test.ts`、`studio-video.test.ts` | 两个函数不同，**不算重复**，都保留 |
| 帧意图「已经带了图就不问」 | `studio-video-prompt.test.ts`（纯函数）、`video.test.ts`（提交层） | 分在两层，都保留 |
| `reorderStudioClips` | `studio-script.test.ts`（没有 order 时规范化）、`studio-work-clips.test.ts`（移动不是交换） | 测的情形不同，都保留 |

### 4. 建议删掉的夹带文案断言（用例保留）

- `ip/studio-ip-library.test.tsx` 第 1 条：`'脸部特写素材将在归档后显示'`、`'尚未填写人物属性'` 这两行只是空态提示文字，可以删。
- `canvas-bridge/studio-frame-confirm.test.ts`：`title` 和 `okText` 两行是逐字比对的文案；真正的契约是「只有选 ok 才 resolve true」，文案那两行可以放宽。
- `ip/canvas-conflict-dialog.test.tsx` 第 1 条：三个选项的顺序和「会丢什么」的说明文字，就是这个弹窗要守的产品行为（⑩ 的例外）。**建议保留**，在这里列出来只是为了完整。
- `canvas/components/canvas/canvas-node-video.test.tsx`：`'本批生成中' / '本批生成失败'` 是文案（这个文件本身是 UNSURE）。
