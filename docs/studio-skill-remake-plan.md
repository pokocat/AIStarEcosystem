# Studio 全能创作 · 技能（Skill）与受控自动制作 · 以「参考视频换主体」为第一份技能

> **状态**：规划稿 v1（2026-10-18），基于 `codex/unified-ip-studio` 当前代码，无任何实现。
> **范围**：只做 Studio（`apps/web-aiavatar` 的统一画布 + `apps/server` 的 `ipstudio` 包）。不碰 drama / celebrity 的页面与表。
> **一句话**：全能创作（助手 `general` 模式）今天只能「给建议、等用户逐步采用」；目标是让它按一份人能读、可版本化的**技能**，
> 把「看懂参考视频 → 决定怎么做 → 搭画布 → 出片 → 检查 → 局部重做 → 交付」整条链在**用户一次确认预算后自己跑完**，
> 方法固定、方案现场定；第一份技能是「参考视频换商品 / 换人」。
>
> 规划稿 v0 曾误把入口定位到 web-celebrity 并计划新建画布与运行时；本版作废 v0，全部改为在现有 Studio 能力上做增量。

---

## 0. 结论先行

1. **九成积木已经在线上**。全能创作（2026-10-13 发布）、视频解析与拉片（2026-10-16 发布）、原生视频全能参考（H3 一条参考视频 + ≤8 图 + ≤3 音频；
   Seedance 2.0 端点已配、协议已支持参考素材但未经付费验证）、多候选、采用、合成（`studio-assemble` + 包装）、企业付款、按端点排队、
   模板执行引擎（依赖 / 人工采用 / 费用上限 / CAS 重做 / 同键恢复）、连续制作（镜头批次 + 整批费用上限）。本方案**不新建第二套生成链、不新建画布**。
2. **真正缺的是四样**：
   - **技能协议**：助手没有任何「方法」可加载（LibTV 对齐表 P1 待办「Skill 协议与调用范围」）。
   - **助手不会自己调解析 / 拉片、检查、合成**：`StudioPlan.steps[].operation` 只许 `text|script|storyboard|image|video`。
   - **没有服务端的多步执行器**：方案要用户逐步「采用 → 打开面板 → 确认费用」；连续制作是客户端顺序提交、固定「首帧→视频→合成」三件事。
   - **没有检查环**：出片之后没人看一眼「商品换对了没」；助手「读取画面」（四帧）是现成的原语，但没接到产出上。
3. **方案 = 在现有助手上加三层**：**技能**（方法与边界，服务端资源 + 表 + 后台管理）→ **可执行计划**（`StudioPlan` 扩操作、带预算与执行方式）
   → **计划执行器**（服务端照模板执行引擎的样子按依赖跑步骤、写回文档保留区、前端投影成节点）。检查与修正是执行器里的两种步骤，不是新系统。
4. **厂商单次 15 秒是硬天花板**：拉片现在最多 8 段、每段长度由模型定，可能超过 15 秒。技能里要写「段长 ≤ 所选视频模型的上限、超了再切」，
   拉片接口加一个 `maxSegmentSec` 约束（服务端已经约束「有限、连续、覆盖片尾」，再加一个上限是同一处）。
5. **先实测再开发**（S0）。整条链成立的前提是「全能参考拿着拉片切出来的片段 + 商品图，真能把主体换掉并保住运镜」。
   这件事今天用现有界面就能手工跑（拉片 → 片段 → 原生视频全能参考），一行代码不写先跑 10 条。过线再做 S1。

---

## 1. 现状对照（代码即证据）

| 用户要的 | 今天有什么 | 差什么 |
|---|---|---|
| 上传参考视频、说一句要换什么 | 助手「添加附件」收 MP4（≤128 MiB / 60 秒），成为普通视频节点并进引用；文字需求是普通文字节点 | 无 |
| AI 理解原片的创意 / 脚本 / 手法 | `operation=recreation`：Hypit 选帧 ≤64 → 分页观察 → 全片拆解 Markdown（创意命题 / 视觉基因 / 反复元素 / 保留要点 / 创作骨架 / 核心手法）；`mode=segments` 拉片：1–8 段真实裁切 MP4 + 逐段镜头表 + **每段一条视频生成 Prompt** + 原声 WAV | 助手不能自己发起它（只能用户点视频节点菜单）；不读音轨；段长没有上限约束 |
| 结合新素材动态写提示词 | 助手 `general` 模式产出 `StudioPlan`（≤12 步，带 `referenceNodeIds` / `dependsOn` / `editTarget`），`StudioPlanValidator` 剥无效引用 | 没有「换主体」的方法指导，提示词质量全靠一次对话；步骤类型不含拉片 / 检查 / 合成 |
| 搭建并操作画布 | 拉片按稳定 id 增量落组、节点、连线（服务端产物 → 前端投影）；采用步骤建节点并连参考；模板执行引擎把 `execution` 指针写进文档保留区 | 助手的步骤要用户逐个点「采用」 |
| 生成 | `studio-runs` → `IpRunService.generateVideoBatch` → `VideoStudioService.prepareCanvas`（归属 / 字节 / 模式 / 合同 / 报价）→ `MaterialVideoJob` | 无（全能参考 + 多候选 + 费用上限齐备） |
| 检查 | 助手 `readVisuals`：选中图片的候选 + 60 秒内视频抽四帧给看图模型 | 没有「对照清单打分」的步骤，也没有把结论回写到节点 |
| 局部调整 | 原生视频节点就地重新生成；模板执行引擎的「显式 CAS 重做」 | 没有「检查不过 → 改提示词 → 自动重做（限次）」 |
| 交付 | `studio-assemble`（`DramaAssembleService` 拼接 + 包装：品牌 / 标题 / CTA / 字幕 / 配音）、作品库、存为模板版本 | 无 |
| 沉淀为可复用方法 | 模板（固定配方 + 输入槽，`IpTemplateVersion` 不可变版本）、`DramaRecipe`（短剧配方） | **模板存的是具体提示词和素材，不是方法**；缺「按素材现场决定」的那一层 |

**产品边界（沿用 `docs/ip-studio-unified-canvas-plan.md` §6，不改）**：模型输出是可编辑建议，不是执行权限；大批量执行前展示范围与报价、只跑用户确认的步骤；
失败不能用占位冒充成功。本方案把「确认」从「每一步」收成「每次创作一次（总费用上限 + 自动修正上限）」，边界不变。

---

## 2. 用户看到什么

入口不变：画布里打开全能创作（或创作页的「全能创作」卡）。变化只有四处：

1. **输入框工具条多一个「技能」**（LibTV 同位置）：默认「自动」，有多份技能时可指定；只有一份时不显示选择，只在方案卡上写「按技能：参考视频换主体 v1」。
2. **方案卡变成「制作计划」**：以前是「建议 N 步，每步一个采用按钮」；现在是
   「我看了原片（4 镜，23 秒）… 打算这么做：拉片 4 段 → 每段用全能参考换成图 1 → 每段检查 → 拼成成片。
   预计 1 080 积分（含拉片约 20、出片 4 × 240、检查约 20）；自动重做上限 2 段（最多再花 480）。」
   两个按钮：**「开始制作（≤1 560 积分）」/「先改改」**（改需求 / 改段数 / 换模型 / 调上限，然后重新规划，规划这一步按助手单次对话计价）。
   需要用户拍板的事（「第 2 镜的人要保留还是也换？」）仍放 `questions`，不自作主张。
3. **执行中**：助手里一条进度（拉片 → 出片 2/4 → 检查 → 合成），画布上节点随步骤增量出现（拉片产物照今天；每段出片是普通视频节点、连着片段视频与商品图；
   检查结论挂在该节点上：「AI 判断：商品已替换，但 logo 看不清 → 已按技能改词重做 1 次」）。用户可随时**暂停**（排队中的取消，已交厂商的说「停不下来」），
   也可以在任何节点上手动改提示词 / 换参考后点「只重做这一段」（这是今天已有的就地重新生成）。
4. **完成**：成片节点 + 下载 + 「存为模板版本」（已有）+ 一句总结（花了多少、哪几段重做过、哪一条没过检查用户要不要自己看）。

文案口径：界面上叫**「技能」**「制作计划」「第 N 段」「检查」「重做这一段」；不出现 Skill / plan / run / step 这些词（§8「不是翻译腔」）。
不新增页面路由；后台多一页「平台 → Studio 技能」。

---

## 3. 技能（Skill）协议

### 3.1 定位
技能 = **给模型读的制作方法 + 给服务端读的边界**。方法是 Markdown，边界是 YAML 头；服务端**只信边界**，方法只影响模型怎么想。
它不是模板：模板是「具体提示词 + 具体素材 + 固定步骤」，技能是「遇到什么素材先看什么、怎么拆、提示词怎么组织、必须检查什么、不过先换什么」。
同一份技能对不同原片搭出不同的计划；一次成功的计划可以照旧「存为模板」，那是技能的**产物**。

### 3.2 文件形状（`apps/server/src/main/resources/studio/skills/remake-subject.md`）
```
---
key: studio.remake-subject
name: 参考视频换主体
version: 1
status: active            # draft | active | withdrawn
operations: [recreation, video, check, assemble, text]       # 这份技能的计划里允许出现的步骤类型
limits:
  maxSegments: 8          # 与拉片上限对齐
  maxSegmentSec: model    # model = 取所选视频模型合同的最大秒数（H3 15）
  maxRefImagesPerSegment: 4
  maxAutoFixPerSegment: 2
  maxSourceSec: 60        # 与解析 / 拉片的输入上限对齐；超了让用户先剪
videoModes: [universal_reference_video]
visuals: required         # 规划与检查都需要看图模型；没有就不接单
---
## 适用与不适用
## 看片：先确认什么（主体是什么、能不能换、口播镜 / 纯展示镜怎么分）
## 分段规则（合并 <3 秒碎段；一段 ≤ 模型上限；口播段保留人物只换手里的东西）
## 每段提示词骨架（「以视频1 的运镜、节奏、光线为准；把 <原主体> 替换为 图1 所示的 <新主体>，保持大小比例与接触方式；其余不变」+ 禁止项）
## 检查清单（主体换到位 / 原主体残留 / 人物一致 / 场景一致 / 字幕文字 / 时长 ±1 秒；每条写判法与「不确定」时怎么说）
## 修正优先级（措辞 → 参考顺序 → 清晰度 → 建议用户换更干净的商品图）
## 对用户怎么说（方案卡 / 检查没过 / 超预算三种场景；报价必须带数字）
## 示例（两条脱敏样例：原片一句话描述 → 最终计划摘要）
```
### 3.3 存储与管理
- 表 `ip_skill`（key UNIQUE, name, version, status, frontmatter_json, body_md, updated_by, created_at, updated_at）+ `ip_skill_version`。迁移编号现场核对（分支当前最大 **V59**）。
- 启动 `seedIfAbsent` + 「基线未改动则重 seed」，照 `PromptService` 的做法；方法本身进 git 评审。
- 后台「平台 → Studio 技能」：列表 / 查看 / 编辑 / 版本回滚 / 试跑（给一份拆解 Markdown，看规划输出），形态照「Prompt 管理」。S1 只读，S3 可编辑。
- 用户侧 S1 只有一份技能，入口即它；S3 多份时由模型按素材与一句话意图路由（路由规则本身也是一份技能）。
- `GET /v1/ip-studio/studio/skills`（当前用户可用的技能：名字、版本、一句话、需要的能力）；`StudioRunRequest` 加 `skillKey`。

### 3.4 怎么写出第一版（S0 的真正产出）
不凭空写。S0 用现有界面手工跑 10 条（饮品 / 美妆 / 3C / 服饰；有人 / 无人；口播 / 纯展示），每条记：拉片切得对不对、提示词改了几版、哪些检查项真出过问题。
10 条的共性进正文，个性进「示例」。**每条规则都能指到一次真实失败**（与 AGENTS.md §8.0.1 同一个精神）。

---

## 4. 可执行计划（`StudioPlan` 升级）

```ts
// packages/types/src/ip-studio-workflow.ts（追加字段，旧字段不动）
type StudioPlanOperation = "text"|"script"|"storyboard"|"image"|"video"|"recreation"|"check"|"assemble";
interface StudioPlanStep {
  …原有…;
  operation: StudioPlanOperation;
  /** auto = 执行器在预算内自动跑；confirm = 跑到这里停下来等用户（默认 auto，技能可指定） */
  execution?: "auto"|"confirm";
  /** 服务端报价后填，模型不填 */ quotedCost?: number;
  /** recreation：{mode:"segments", maxSegmentSec} · video：StudioVideoSettings 的子集（模式、清晰度、秒数由服务端按合同校验） · check：{checklist:string[], targetStepId} */
  settings?: Record<string,unknown>;
}
interface StudioPlan { …原有…; skillKey?: string; skillVersion?: number; budget?: { estimated:number; autoFixCap:number } }
```
- `StudioPlanValidator` 扩：操作白名单来自**技能的 `operations`**（不是全局常量）；`check.targetStepId` 必须指向更早的 `video` 步；`recreation` 的来源必须是上下文里的视频节点；
  模型照旧不许填 `resultNodeId` / `quotedCost` / 执行状态。
- **报价在服务端**：规划 run 成功后，`StudioWorkflowService` 对每步调现有报价（拉片 = 文本 token 上限价；视频 = `StudioVideoService.quote`；检查 = 文本 token 上限价；合成 0），
  写 `quotedCost` 与 `budget.estimated`；`autoFixCap` = `maxAutoFixPerSegment × 视频段数 × 单段价`，用户可改小。
- 规划提示词：`dap.ip_studio_assistant` 不动；新增 `dap.ip_studio_skill_plan`（技能正文 + 拆解 Markdown + 用户需求 + 素材清单 → 计划 JSON）与
  `dap.ip_studio_skill_check`（检查清单 + 产出帧 → 判定 JSON）。都进后台 Prompt 管理。

---

## 5. 计划执行器（服务端）

**照 `StudioTemplateExecutionService` 的样子做，而不是另起一个 agent 框架**：它已经有「步骤依赖、人工采用、费用上限、CAS 重做、同键恢复、执行指针写进文档保留区」。
区别只有两点：步骤来自一份 AI 现场写的计划（不是不可变模板版本）；步骤默认自动推进。

- **一次确认，整份计划**：`POST /projects/{id}/plan-executions`（body：`planRunId`（规划那次 run）、`budgetCap`、`autoFixCap`、`clientRequestId`）。
  服务端校验计划仍是当次规划的原文（指纹）、技能仍在架、所有引用仍归本人、总报价 ≤ `budgetCap`；落 `ip_plan_execution`（见下）后 `afterCommit` 派发。
- **执行器 `StudioPlanExecutor`（@Async，独立线程池）**：按 `dependsOn` 拓扑顺序，每步构造一条今天就有的 `StudioRunRequest`，经 **`StudioWorkflowService.submit`** 受理
  （同一套 owner 行锁 / 幂等 / hold / 队列 / worker）；每步的 `clientRequestId` = `执行id-步骤id-第n次`，重启后按它接回。
  - `recreation(segments)`：复用拉片，传 `maxSegmentSec`；产物节点照今天的稳定 id 增量落地。
  - `video`：每段一条请求（参考 = 该段裁切视频 + 技能指定的图；多候选数由技能定，默认 1）。
  - `check`：等目标 `video` 成功 → 对成片抽帧（复用 `StudioVisualContext` 的四帧采样，不读音轨）→ `dap.ip_studio_skill_check` → 判定 JSON `{pass, items[], suggestion}`
    写回目标节点 `metadata.studio.check`。不过且 `autoFixCap` 够 → 执行器让模型按技能「修正优先级」改写该段提示词（文本 run）→ 再提交一次 `video`（CAS 替换，旧版本保留可切换）；
    次数或预算用完 → 步骤置 `needs_user`，整体暂停并在助手里说清楚。
  - `assemble`：全部段成功（或用户对没过的段点了「就用这版」）→ 复用 `studio-assemble`。
- **写回**：每步状态、runId、费用、检查结论写进文档保留区 `/planExecutions/{id}`（照模板执行的 `/execution` 指针）；**执行器不改节点正文**，节点由前端按指针投影
  （拉片与采用今天就是这样）。用户在执行中手改了某段的提示词 / 参考 → 该段的 `sourceSnapshot` 对不上 → 执行器跳过它并标「你改过，等你点重做」（连续制作的现成规则）。
- **钱**：执行器自己**一分钱不冻结**，所有冻结 / 结算 / 退回都在被它调用的 run 里（§4.2 账本不可变）；`budgetCap` 是它提交每步时的 `maxCost` 来源，
  累计 `spent` 超了就停。用户暂停 → 排队中的 run 走现有 cancel；已交厂商的照旧跑完并结算。
- **恢复**：服务重启 / 刷新 → 执行器按 `ip_plan_execution.status in (running, paused)` 扫，逐步按 `clientRequestId` 回查原 run，不重复提交（现有「同键回原任务」）。
- **超时**：整份执行 90 分钟上限（与画布运行一致，远早于 180 分钟冻结回收）；到点标 `partial` 并说明哪些段没做。

```
ip_plan_execution   id, project_id, owner_user_id, plan_run_id, skill_key, skill_version, status(running|paused|needs_user|done|partial|failed|canceled),
                    budget_cap, auto_fix_cap, spent, steps_json LONGTEXT(每步 status/runIds[]/attempt/cost/check), client_request_id,
                    created_at, updated_at, finished_at        UNIQUE(owner_user_id, client_request_id)
```
接口：`POST /projects/{id}/plan-executions` · `GET /projects/{id}/plan-executions/{eid}` · `POST …/{eid}/pause|resume|cancel` · `POST …/{eid}/steps/{sid}/accept`（「就用这版」）。
全部挂 `/api/v1/ip-studio/**`，走 aiavatar 开通；契约进 `specs/openapi.yaml`。

错误码（新增）：`STUDIO_SKILL_NOT_FOUND` · `STUDIO_SKILL_OPERATION_NOT_ALLOWED`（计划含技能不许的步骤，400，不冻结）· `STUDIO_PLAN_STALE`（409）·
`STUDIO_PLAN_BUDGET_EXCEEDED`（402）· `STUDIO_PLAN_EXECUTION_BUSY`（409，一张画布同时只跑一份）· `STUDIO_SEGMENT_TOO_LONG`（拉片段超模型上限且无法再切，400）。
视觉 / 定价 / 模型未配的沿用 `STUDIO_VISION_UNAVAILABLE` / `AI_TOKEN_PRICE_NOT_CONFIGURED` / `VIDEO_STUDIO_PRICE_NOT_CONFIGURED`，**不回落、不产假结果**（§8.0）。

---

## 6. 前端（`apps/web-aiavatar`）

- `studio-assistant.tsx`：工具条加「技能」；方案卡改为「制作计划」卡（`studio-assistant-plan.tsx` 扩：总价 / 上限可改 / 「开始制作」）；执行中显示进度条与暂停。
- `canvas-bridge/studio-plan-execution.ts`（新，纯函数 + 测试）：把 `/planExecutions/{id}` 指针投影成节点 / 连线 / 检查标记；同 id 幂等；不覆盖用户编辑（拉片的 `studio-film-study.ts` 范式）。
- 视频节点多一块「检查结论」（AI 判断 + 条目 + 「就用这版」/「重做这一段」）。
- 入口与按钮要有结构测试钉住（§8.0.1 ⑥）；mock 照服务端形状（§8.0.1 ⑦）；375 宽实测（§8.0.1 ⑫）。
- 不加路由、不加画布库、不改 `.ip-surface` 令牌。

---

## 7. S0 前置实测（决定做不做）

用**现有线上界面**手工跑，不写代码：

| 要验的 | 怎么验 | 过线 |
|---|---|---|
| 全能参考能不能「换主体保运镜」 | 拉片 → 取片段视频 + 商品图 → 原生视频全能参考（H3；Seedance 2.0 各跑一半）→ 按 §3.2 骨架写提示词 | 10 条里 ≥7 条两次内可用；逐条记失败原因（这就是技能的「修正优先级」） |
| 段长与 15 秒 | 看拉片 8 段里有几段 > 15 秒 | 确定 `maxSegmentSec` 该怎么落（拉片加约束 vs 再切） |
| 音频怎么办 | 三种：不给 / 给该段原声 ≤15 秒作参考 / 成片后用原片原声覆盖（拉片已提取 WAV） | 选默认，另两种进技能分支 |
| 检查可靠性 | 把 10 条成片（含故意失败的）用「读取画面」+ 清单让 Qwen3.6 判，与人工对比 | 误判率可接受；不可接受就把检查降为「给用户看的提示」，不驱动自动重做 |
| 费用 | 记每条实际积分（拉片 + 出片 + 检查） | 方案卡报价的参考 |

结论写回本文 §7。不过线：退到「单段版」（原片 ≤15 秒不拉片，直接一段全能参考）或等厂商。

---

## 8. 分期

| 期 | 交付 | 不做 |
|---|---|---|
| **S0 实测** | §7 五项结论 + 技能初稿（仓里 md）+ 本文更新 | 代码 |
| **S1 技能规划** | 技能协议 + 表 + seed + 只读后台；`StudioPlan` 扩操作与报价；助手按技能出「制作计划」卡；拉片加 `maxSegmentSec`；**执行仍是今天的逐步采用** | 执行器、检查 |
| **S2 受控自动制作** | `ip_plan_execution` + 执行器（依赖 / 预算 / 恢复 / 暂停）；检查步 + 预算内自动重做；前端投影与进度 | 多技能、技能编辑 |
| **S3 沉淀与推广** | 后台技能可编辑 + 版本 + 试跑；第二、三份技能（商品图起片 / 口播换词 / 爆款复刻场景接技能）；意图路由；从成功画布「蒸馏技能草稿」（照 `DramaRecipe` 抽配方的思路，上游画布的「从当前对话生成 Skill 草稿」界面保留关闭） | 远端插件 / 第三方技能市场（`AGENTS.md` 已判：必须我方托管 + 签名 + 白名单） |

---

## 9. 风险与不做

- **厂商能力是天花板**：换主体保真度、15 秒、同素材不可重复、音频 ≤15 秒总长都不是我们能改的；技能里把「不适用」写清，收到素材时就先判并直说。
- **检查是模型打分，不是真值**：结论标「AI 判断」，用户永远可以「就用这版」。S0 若误判率高，检查只提示不驱动重做。
- **解析 / 拉片不读音轨**（线上口径）：口播内容来自字幕 OCR 或用户说明；ASR 是音频节点的后续独立能力，不纳入本方案。
- **不做**：自由 agent（任意一句话做任何事；§6 边界）、换脸换声（真人授权走 modelink）、从链接抓视频、去水印、整画布分享。
- **mock 照真厂商写**：S0 拿到真响应再写 mock。

---

## 10. 验证
- 服务端：技能加载与边界、计划校验（技能白名单 / `check` 指向）、执行器（拓扑、预算、CAS、恢复、暂停、超时）、`EntityIdentifierTest` 覆盖新实体、Testcontainers 跑迁移。
- 前端：投影纯函数、结构测试、USE_MOCK 全流程、375 宽。
- 端到端：本机 + 测试响应跑一份 2 段计划到合成；再**真厂商一条**，看 `[upstream-io]` 里参考视频与图确实发出（§8.0.1 ②）。
- 四门 + PR 看 CI 结论再报完成（§8.0.1 ③）。

## 11. 分工与文件所有权
| 角色 | 负责 | 只许动 |
|---|---|---|
| 主模型 | 本文、`ip-studio-workflow.ts` 类型、`openapi.yaml`、技能初稿、S0 主持、收口 | 契约与文档 |
| 开发 A（server） | `ipstudio/service/StudioSkill*`、`StudioPlanExecutor`、`StudioPlanValidator` 扩、拉片 `maxSegmentSec`、迁移、两个 prompt key | server |
| 开发 B（web） | 助手工具条 / 计划卡 / 进度 / 投影 / 检查块 + 测试 | web-aiavatar |
| 开发 C（admin，S3） | 「Studio 技能」页 | admin |
| Codex | 每期只读评审：计费顺序、幂等、归属闸、§8.0 降级、§8.0.1 ① 日志 | 不改代码 |

## 12. 文档同步（落地时同 commit）
`apps/web-aiavatar/PRODUCT.md`（全能创作节追加「技能与制作计划」）· `apps/web-aiavatar/README.md` 版本日志 · `apps/server/README.md`（两张表 + 错误码）·
`specs/openapi.yaml` + `specs/BUSINESS_RULES.md`（预算、幂等、技能白名单）· `docs/ip-studio-libtv-alignment.md`（Skill 行从 P1 待办改为实现记录）·
`docs/ip-studio-recreation.md`（`maxSegmentSec`）· `AGENTS.md` §8.0 审计表加「技能规划 / 检查：模型未配 → 503，不产假判定」· `docs/VERSION_HISTORY.md` · `docs/INDEX.md` · `TODO.md`。
