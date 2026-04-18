---
name: figma-migrate
description: 将 figma/ 目录（Figma Make 导出原型）里新增或变更的页面/组件迁移到 apps/web_new，遵循 types/mocks/constants/api/component 五件套 + 中文单语约束。触发场景：用户提到"figma 更新了"、"figma 新增了 X 页面"、"把 figma 的 Y 同步到 web_new"、"迁移 figma 新原型"、"figma 原型做了改动需要同步工程"。完成后必须更新 README 版本日志与 FRONTEND_CONTRACT_DIFF.md。
---

# Figma → apps/web_new 迁移手册

本技能指导将 `figma/src/**`（Figma Make 导出的一次性 React 产物）里新增或变更的页面 / 组件同步进 `apps/web_new`（长期维护的 Next.js 14 工程）。

> **前置文档**：`apps/web_new/FIGMA_MIGRATION_GUIDE.md` 是全量首迁手册；本 Skill 聚焦"增量迭代"场景（Figma 做了改动，仅需把新增/变更部分落到 web_new）。首迁时仍以 `FIGMA_MIGRATION_GUIDE.md` 为准。

---

## 0. 硬约束（违反即回退）

1. **中文单语**。删除所有 `{ zh: 'X', en: 'Y' }` 字典、`lang === 'zh' ? ... : ...` 三元；只保留中文分支。`Lang` prop 形参可保留以兼容兄弟组件签名，但运行时不读取。
2. **五件套齐全**。新页面必须同时落：
   - `apps/web_new/src/types/<domain>.ts`
   - `apps/web_new/src/mocks/<domain>.ts`
   - `apps/web_new/src/constants/<domain>-ui.ts`
   - `apps/web_new/src/api/<domain>.ts` 并在 `apps/web_new/src/api/index.ts` 追加 `export * as XxxApi from "./<domain>";`
   - `apps/web_new/src/components/<...>/<Component>.tsx`
3. **数据模型抽象**。组件里**严禁内联数组 / 字典 / 颜色串**。模版、选项清单、枚举配色全部外化到 types/mocks/constants。
4. **日期字段用 `ISODateTime`（字符串），不用 `Date` 对象**。金额数字保留，不要预格式化后丢失原值。
5. **可选字段访问必须守护**。例：`date ? new Date(date).toLocaleDateString('zh-CN') : ''`，不要写 `date?.toLocaleDateString(...)`（Date 方法在字符串上不存在）。
6. **Array mutation 必前置 spread**：`[...arr].sort(...)`。
7. **lucide-react 图标按需 import**。清理后跑 tsc，删除未使用图标。
8. **无需改后端代码**。发现接口缺口 → 记录到 `apps/web_new/specs/FRONTEND_CONTRACT_DIFF.md`。
9. **组件只读 `@/mocks/`，不在 UI 路径上调 API 层**（详见步骤 5 / 6）。
10. **Skill 自更新义务**。每次迭代结束，回顾本次踩到的新坑、发现的新模式、纠正的旧指引；只要"下次再遇同类场景会复用"，**必须把经验沉淀回本 SKILL.md**（见章节 5）。

---

## 1. 流程（增量迭代 SOP）

### 步骤 1 — 识别改动

```bash
# 列出 figma/src/components 下最近修改的文件
ls -lt figma/src/components/ | head -20

# diff figma 与 web_new 同名组件
diff figma/src/components/<X>.tsx apps/web_new/src/components/<X>.tsx
```

**判断**：
- 纯样式 / 文案 → 改 `constants/<domain>-ui.ts` 即可，不碰组件逻辑。
- 新增字段 / 新枚举 → 改 `types/` → 补 `mocks/` → 视需要扩 `constants/`。
- **新增整页 / 新组件 → 走步骤 2~7 全套。**

### 步骤 2 — 抽取类型 `types/<domain>.ts`

把 Figma 组件里内联的 `interface`、`type`、字符串联合全搬到 `@/types/<domain>.ts`；复用 `_shared.ts` 里的 `ID` / `ISODateTime` / `Rarity` / `Money`。导出完整一组类型（请求、响应、子结构），供 mocks / api / 组件共用。

**选项清单抽象原则**（针对 Figma 常见的下拉选项）：
- 若多组选项结构一致（`{ zh, en }` → `{ id, label, ?color }`），定义一个 `LabeledOption` 复用。
- Slider 等带 key 的控件定义 `interface XxxSlider { id; label }`，避免使用 index 作为 key。

### 步骤 3 — 生成样本数据 `mocks/<domain>.ts`

- 把 Figma 里 `const TEMPLATES = [...]`、`const OPTIONS = [...]` 整体搬到 `mocks/<domain>.ts`。
- `{ zh, en }` 形态 → 只保留 `zh` 值，重命名字段为 `label`/`name`。
- `new Date('...')` → `"2026-04-18T00:00:00Z"`。
- 3~20 条示例即可；保留有代表性的边界值（有/无图、锁定/未锁定、不同分类）。
- 把分散选项汇聚到一个 `XXX_OPTIONS: DomainOptions` 对象便于 API 层一次返回。

### 步骤 4 — 静态 UI 配置 `constants/<domain>-ui.ts`

- 模式 / 状态 / 稀有度等**带 icon + 颜色 + 文案**的映射放这里。`Record<Enum, { icon, gradient, label, desc }>` 是最常见结构。
- 复用 Tailwind 颜色串的组合（`text-xxx bg-xxx/10 border-xxx/20`）一律抽成 `STYLES: Record<Key, { color, bg, border }>`。
- 伪异步耗时、历史上限等"tweakable 常量"也放这里。
- **图标必须从 lucide-react 导入到本文件**；`types/` 不能 import 运行时值。

### 步骤 5 — API 封装 `api/<domain>.ts`（**仅作为后端对接钩子**，组件不直接调用）

仓库当前现状（2026-04-18）：**`NEXT_PUBLIC_USE_MOCK` 默认 `false`**，未显式配 `.env.local` 时 `apiFetch` 会打到实际不存在的后端并抛 "Invalid JSON from /xxx"。所有兄弟组件（DistributionPage / WardrobePage / FinancePage / ...）因此**都直接消费 `@/mocks/`**，没有一个通过 `XxxApi.listXxx()` 调起 API 层。

所以 `api/<domain>.ts` 的职责是：**预埋后端对接的单点入口**。写好、加到 `api/index.ts`，但**组件不调用它**。等后端就绪再把组件里的 mock 直接读切换为 API 调用即可。

模板（按此结构写，但组件不 import）：

```ts
import type { XxxOptions, XxxRequest, XxxResult } from "@/types/<domain>";
import { XXX_OPTIONS } from "@/mocks/<domain>";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function getXxxOptions(): Promise<XxxOptions> {
  if (USE_MOCK) return mockDelay(XXX_OPTIONS);
  return apiFetch<XxxOptions>("/<domain>/options");
}

export async function runXxx(req: XxxRequest): Promise<XxxResult> {
  if (USE_MOCK) return mockDelay({ /* 按 req 合成伪结果 */ }, 2000);
  return apiFetch<XxxResult>("/<domain>/run", { method: "POST", body: req });
}
```

**然后**：在 `apps/web_new/src/api/index.ts` 追加命名空间：

```ts
export * as XxxApi from "./<domain>";
```

### 步骤 6 — 组件落地 `components/<...>/<Component>.tsx`

- 顶部加 `"use client";`（web_new 使用 App Router，业务组件默认是 Server Components，带状态/事件的组件必须声明）。
- 从 `@/types`、`@/mocks`、`@/constants` 按需 import；**不要再有内联数据**。
- **直接读取 `@/mocks/<domain>`** 做静态选项，**不要** `useEffect + XxxApi.getXxxOptions()`——会在默认 `USE_MOCK=false` 时抛 "Invalid JSON from /xxx"。
- 异步动作（生成 / 保存）在组件里用 `setTimeout` 合成结果，真实延迟常量复用 `constants/<domain>-ui.ts` 里的 `MOCK_XXX_DURATION_MS`。
- `api/<domain>.ts` 的函数仍然导出、仍然注册到 `api/index.ts`——供未来后端就绪时作为切换锚点，但本次迭代不在组件里 import。
- 接受 `lang: Lang` prop 但不读取（保持与兄弟组件签名一致，便于 ProducerDashboard 等路由壳统一透传）。
- 所有文案、占位符、toast 文案直接写中文。删除 `zh ? 'X' : 'Y'` 三元。

### 步骤 7 — 路由挂接

1. 根据页面归属（producer / coach / fan / portal）找到对应"宿主"组件（通常是 `ProducerDashboard.tsx` 这类带侧栏 + router 的壳）。
2. 在 `SIDEBAR_GROUPS` / 对应菜单里新增 `{ id, icon, zh, en }`（为兼容老字段，`en` 填与 `zh` 相同的中文也可）。
3. 在 `renderPage()` / `switch (activePage)` 里新增 `case 'xxx': return <NewComponent lang={lang} activeArtist={activeArtist} />;`。
4. 确保宿主组件的 `import` 增补了新组件。
5. 如果是全新路由（而非子页面），则在 `apps/web_new/src/app/<route>/page.tsx` 新建一个 Next App Router 路由壳。

### 步骤 8 — 验收

```bash
cd apps/web_new
./node_modules/.bin/tsc --noEmit        # 必须 0 error
# 在 worktree 中若无 node_modules，可 symlink：
#   ln -sf <repo>/apps/web_new/node_modules <worktree>/apps/web_new/node_modules
```

可选：`npm run build` 检查 bundle 体积；如果只做一个页面且没有引新大依赖，跳过也可。

### 步骤 9 — 文档沉淀

**必改**两份：

1. `apps/web_new/README.md`
   - 顶部"当前版本"段 → 升一位小版本（v2.0 → v2.1），写一句话变更。
   - "版本日志"段倒序追加一条，逐项列清：新增哪些 types / mocks / constants / api / component / 路由 / 契约差异。

2. `apps/web_new/specs/FRONTEND_CONTRACT_DIFF.md`
   - 在文末追加一个"附录 · <新域名>"小节。
   - 表格列出新增的前端类型，`OpenAPI Schema` 列写 ❌ 无、`状态` 列写 ❌ 不存在（新域）或 ⚠️ 部分一致（补充字段）。
   - 列出新增的 REST 路径与推荐的后端实现策略。

---

## 2. 快速命令速查

```bash
# 查当前 figma 新增了什么
ls -lt figma/src/components/ | head -20
ls -lt figma/src/components/producer/ | head -10

# 反向 diff 找改动点
diff -r figma/src/components/ apps/web_new/src/components/ | head -40

# 残留 i18n 审计
grep -RIn "{ zh:\|lang === 'en'\|lang === 'zh'" apps/web_new/src/components/<domain>/ apps/web_new/src/components/<Component>.tsx

# tsc 验收（注意 worktree 需要先 symlink node_modules）
cd apps/web_new && ./node_modules/.bin/tsc --noEmit
```

---

## 3. 常见坑（直接抄作业）

1. **Figma 组件形参用 `lang: Lang`**：迁移时**保留形参**、**删掉 `const zh = lang === 'zh'`**，文案直接写中文。
2. **`{ zh, en }` 对象 → `{ id, label }`**：统一命名是 `label`（不是 `name`，除非本来就是专有名如"艺人姓名"）。
3. **`index as React key` → 稳定 id**：顺便让下游 `selected: number` 改为 `selected: string | null`。
4. **`motion.div layoutId` 在模式切换时复用 id**：Figma 常用 `layoutId="foo-glow"` 复用高亮框；迁移后保留即可。
5. **FileReader DataURL 直接传后端不合适**：在 types/api 里给字段加注释"真实后端应替换为 assetId"；mock 模式下随便传。
6. **Lucide 图标名稳定性**：Figma 原型偶尔 import 了不存在的图标（如 `Peace`）。不要沉默替换 —— 找 lucide-react 真实名（如 `HandMetal`）并保留别名注释。
7. **Tailwind 渐变类名在 class 字符串里插值**：用 `bg-gradient-to-r ${conf.gradient}`（gradient 是 `from-xxx to-yyy`）。**不要**把 `from-xxx-500` 这种动态拼接写成部分字符串拼接（Tailwind JIT 要求完整类名），整段渐变建议直接作为完整字符串存入 `MODE_CONFIG.gradient`。
8. **`AnimatePresence` + `motion.div key` 切换**：迁移保留；若出现"切换后不见了"通常是 key 重复或 `mode="wait"` 丢了。
9. **页面外包 `<AnimatePresence>` 做路由淡入**：Next App Router 按路由单独渲染，跨页动画会消失，这是已知差异（见 README "与 Figma 原型的已知差异"一节）。
10. **组件在 mount 时 `useEffect` 调 `XxxApi.getXxxOptions()` 会崩**：`USE_MOCK` 默认 `false`，请求打到不存在的 `/api/<domain>/options` 返回 404 HTML，`apiFetch.json()` 解析失败抛 "Invalid JSON from /xxx"。→ 组件直接 `import { XXX_OPTIONS } from "@/mocks/<domain>"`，别走 API 层（2026-04-18 踩坑）。

---

## 4. 完成清单（交付前自检）

- [ ] `types/<domain>.ts` 中所有 interface 导出，字段注释清晰
- [ ] `mocks/<domain>.ts` 有 ≥ 3 条样本，无 `Date` 对象
- [ ] `constants/<domain>-ui.ts` 抽尽 Tailwind 串 + 图标映射
- [ ] `api/<domain>.ts` 每个函数都走 `if (USE_MOCK)` 分支；`api/index.ts` 追加命名空间
- [ ] `components/<path>/<Component>.tsx` 顶部 `"use client"`；全中文；无内联数据；**直接读 mocks**（不在 UI 路径调 API 层）
- [ ] 宿主组件（ProducerDashboard / CoachDashboard / ...）的 SIDEBAR 与 switch-case 都加了新条目
- [ ] `tsc --noEmit` 0 error
- [ ] `npm run dev` 打开新页面不抛 "Invalid JSON from /xxx" 这类运行时错误
- [ ] `README.md` 版本号 + 版本日志 已追加
- [ ] `specs/FRONTEND_CONTRACT_DIFF.md` 附录已追加
- [ ] `grep -RIn "{ zh:" apps/web_new/src/components/<path>` 无命中
- [ ] **本次迭代有新复用价值的经验已沉淀回本 SKILL.md**（章节 5）

---

## 5. Skill 自更新（每次迭代必做）

本 Skill 是**活文档**，不是一次性模板。每次跑完一次迁移，在提交 PR 之前问自己：

1. **指引被推翻了吗？**（用户否定了某条做法 / 运行时抛错让我改方向 / 发现既有指令与实际代码模式冲突）
   → 修正对应章节，并在被改段落旁标注「YYYY-MM-DD 修正」，便于追溯。
2. **出现了之前没讲过、但下次还会遇到的新模式？**（新的组件模板、新的命名约定、新的避坑套路、新的工程约束）
   → 加到第 3 章"常见坑"（一句话说清症状 + 一句话给对策），必要时扩写主流程。
3. **出现了值得抄的命令 / grep 正则 / 一键清理脚本？**
   → 加到第 2 章"快速命令速查"。
4. **硬约束有增删？**（比如本次确立的"组件不走 API 层"就是从经验里提炼出的硬约束）
   → 加到第 0 章。
5. **完成清单漏了什么检查点？**（如果这次是因为跳过某步才出事）
   → 加到第 4 章。

**判断标准**：只要"下次再遇到同类场景我会希望过去的自己提醒我"，就沉淀下来。宁可偏多，也不要让后人再踩同一个坑。

**反模式**：
- 把一次性决策（"这次选了 cyan 色调"）当成通用规则写进来 —— 不写。
- 记流水账（"今天改了 X 文件"）—— 写 PR 描述，不是 Skill。
- 写抽象废话（"注意代码质量"）—— 无操作性，不写。

更新完 SKILL.md 后，和本次业务代码在**同一个 commit**里一起提交，commit message 加 `chore(skill):` 前缀或放在 `feat(xxx):` 的 body 里，方便追溯"经验与代码同源"。
