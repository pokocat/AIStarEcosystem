# Figma → 正式项目 迁移指南

> 本文档总结 `apps/web_new` 的建立过程，用作以后从 Figma 再次生成全量前端、或只针对单一功能做迭代时的作业手册。
> 约束前提：**前端即唯一事实源**；所有后端契约按本目录下的类型文件倒推补齐。**仅中文，不做多语言**。

---

## 0. 心智模型

```
Figma / Make 导出的 React 工程（一次性产物）
           │
           ▼
 apps/web_new  ──  生产目录（长期演进）
           │
           ▼
  types/  +  mocks/  +  constants/  +  api/  +  components/
   (契约)    (示例数据)    (UI 配置)    (网络)    (渲染)
```

- **Figma 产物是"视觉 + 交互"的草稿**：样式、布局、动画、组件层级可直接复用；所有硬编码文案 / 数据 / 颜色 / 图标映射都必须外化。
- **数据先于 UI**：每个领域先定好 `types/<domain>.ts`，再有 `mocks/<domain>.ts`，最后 `components/` 才消费。
- **多语言在第一步就砍掉**：Figma 导出通常带 `{ zh, en }` 字典，迁移第一件事是把 `en` 分支全部丢弃，`text[key]` 改为直接 `S.key`。

---

## 1. 目录骨架（记熟即可照搬）

```
apps/web_new/src/
├── types/
│   ├── _shared.ts             # ID / ISODateTime / Rarity / Money / ApiResponse 等跨域基元
│   ├── index.ts               # 桶式导出（组件侧只从 "@/types" 进单一入口）
│   └── <domain>.ts            # 每个业务域一个文件：artist / music / film / coach / fan / ...
├── mocks/
│   └── <domain>.ts            # 与 types 同名，给出 3~20 条中文示例数据
├── constants/
│   └── <domain>-ui.ts         # 图标映射 / 颜色表 / 选项列表 / 静态文案常量
├── api/
│   ├── _client.ts             # apiFetch / USE_MOCK / mockDelay / ApiError
│   └── <domain>.ts            # 每个域一个，函数内部按 USE_MOCK 切换
├── components/                # 保持 Figma 原有命名；仅改内部实现
└── app/                       # Next.js App Router 路由入口
```

三件套（**types / mocks / constants**）一旦在某域齐备，组件内部就应当只做渲染 + 交互，不再出现"内联数组"或"内联字典"。

---

## 2. 标准迁移流程（六步走）

每条新 Figma 产物都按这个顺序推进；已完成的域在后续迭代中只执行与本次改动相关的步骤即可。

### P0 · 规划与清洗（小时级）

1. 把 Figma 导出的目录拷到临时工作区，先 `npm run build` 跑通，确认无编译错误。
2. 全仓 grep 一次 `{ zh:`、`lang === 'en'`、`text[` —— 这些是翻译字典的锚点，盘出总数。
3. 创建 `src/types/_shared.ts`（参见本目录同名文件）：`ID`、`ISODateTime`、`Rarity`、`Money`、`ApiResponse` 要最先落，后续所有域都依赖它们。
4. 如果 Figma 里带 i18n 切换按钮，决定是保留"外观"还是直接干掉；本项目选择保留按钮但不实际绑定语言（UI 一致性），`zh` 布尔值改为纯粹的"调试切换"。

### P1 · 逐域抽取类型与数据

对每个业务域（一次只做一个，按屏幕切分：producer / coach / fan / portal）：

1. 新建 `types/<domain>.ts`：列出所有 interface、枚举（status/category/role 之类）；日期类字段统一用 `ISODateTime` 字符串（不要 `Date` 对象，序列化不稳定）。
2. 新建 `mocks/<domain>.ts`：把原组件里的内联数组整体搬过来，把 `new Date('...')` 改成 ISO 字符串；金额用数字（展示时在 constants 里或组件里 `toLocaleString`）。
3. 新建 `constants/<domain>-ui.ts`：图标（lucide-react）映射、状态颜色表、分类选项。**原则：任何写死的 Tailwind 颜色串如果在 2 处以上出现，立刻抽。**
4. 改造对应 `components/<...>.tsx`：
   - 删除内联数据 / 字典；改为 import。
   - 把 `t = { zh: {...}, en: {...} }` 压成 `S = {...}`（单对象，纯中文），删 `const text = t[lang]`。
   - 三元 `lang === 'zh' ? 'X' : 'Y'` 全部替换为 `'X'`。
   - 属性列表里把 `lang?: 'zh' | 'en'` 删掉；如果外部还在传，批量改掉调用处。
5. 每完成一个域就跑 `npx tsc --noEmit`；组件规模大（>500 行）时再跑 `npm run build`。

> 经验值：一个典型业务组件（500~900 行、带 50+ 条翻译）人工做 30~45 分钟；若只剩三元清理这类机械活，可以起 Explore 子代理并行做。

### P2 · 特殊文件处理

- **复合/跨域常量**（如 `Rarity` 同时被 wardrobe / NFT / fan 使用）：放在 `_shared.ts`，`constants/` 侧只写"该域特化"的配色或图标。
- **带图标的枚举映射**（NFT 稀有度的 Star/Sparkles/Crown/Zap）：图标必须进 `constants/` 文件而非 `types/`（类型文件不能 import 运行时值）。
- **大型对话框文案**（如 `NFTMintingDialog`）：文案独立成 `constants/<feature>-strings.ts` 或 `-ui.ts`，组件里 `import { NFT_DIALOG_STRINGS as S }` 然后 `{S.title}` 即可；别再用索引字符串 `text[\`step${n}\`]`，改 switch-case 更安全。

### P3 · 对齐后端契约

1. 用 Grep 列出 `src/types/` 下所有 `export interface` 与 `export type`。
2. 打开 `specs/openapi.yaml`，按域对照每个前端类型：
   - **字段完全一致** → 在 diff 文档里标 ✅
   - **字段差异** → 列出多/少/改名的字段，标记是后端待补还是前端设计扩展
   - **仅前端存在**（如影视 Drama/Movie）→ 记录成"后端 P0 缺口"
   - **仅后端存在**（如 SuccessResponse 响应壳）→ 在 api 层封装，类型不下沉
3. 直接更新 `specs/openapi.yaml`（path + schema）；该文件就是接口契约的真值源。运行 `npm run check:api-contract` 校验。「契约 diff 文档」已废弃。

### P4 · 建立 API 层

1. `src/api/_client.ts` 提供 `apiFetch<T>(path, opts)`、`USE_MOCK` 常量（读 `NEXT_PUBLIC_USE_MOCK`）、`mockDelay` 工具、`ApiError` 类。
2. 每个域建 `src/api/<domain>.ts`，函数体模板：
   ```ts
   export async function listXxx(): Promise<Xxx[]> {
     if (USE_MOCK) return mockDelay(MOCK_XXX);
     return apiFetch<Xxx[]>("/xxx");
   }
   ```
3. 组件从"直接 import mocks"切换为"import api 函数"后，就天然具备了真实后端接入能力；`.env.local` 里 `NEXT_PUBLIC_USE_MOCK=1` 与 `=0` 一键切换。
4. 响应信封拆解（`{ success, data }` → `T`）在 `_client.ts` 内部做一次；上层永远拿到干净的 T。

### P5 · 单次 Build 验收

```bash
cd apps/web_new
npx tsc --noEmit         # 必须零错误
npm run build            # 关注 warning（未使用的 import / any）
```

build 报告里记录：**每条路由的 First Load JS**。后续迭代时对比体积，防止误引入大依赖。

### P6 · README 与版本记录

`apps/web_new/README.md` 必须每次迭代都更新。硬规则：

- 顶部一个"当前版本"段，写明版本号 + 一句话变更。
- "版本历史"段倒序追加；每条写清：新增 types、新增 mocks、新增 constants、重构组件、契约变化。
- 结构发生调整时（新增 `api/` 目录、引入新基元）把 `src/` 树状图同步更新。

---

## 3. 从 Figma 再次生成全量前端（重置流程）

触发条件：Figma 做了大改（换导航、换主色、换屏幕拓扑），增量 merge 成本高于重跑。

1. **保留 types/mocks/constants/api 四个目录不动**——它们是真值源，不是视觉产物。
2. 新建临时分支 `figma-regen/<日期>`，把新 Figma 产物解到 `apps/figma-new-import/`（不要盖 `web_new`）。
3. 按域 diff：
   - 先 `diff apps/figma-new-import/src/components/X.tsx apps/web_new/src/components/X.tsx`
   - 视觉侧新增 / 调整 → 合并到 `web_new`
   - 数据侧（新字段、新枚举值）→ 更新 `types/`、补 `mocks/`、必要时扩 `constants/`
4. **永远不要用 Figma 产物的 i18n 字典覆盖已经中文化的组件**；每次合并前先跑一遍全局 `{ zh:` grep 确认干净。
5. 再跑一次 P3（契约校验）：`npm run check:api-contract` 验证 `apiFetch` URL 与 `specs/openapi.yaml` 对齐。新接口直接写进 openapi.yaml。
6. README 记录一条重置条目。

---

## 4. 局部功能迭代 SOP

日常开发最常见场景：只改一两个页面或加一个对话框。

| 改动类型 | 必经步骤 |
|---|---|
| 只调样式 / 动画 | 直接改 components；README 记一条 |
| 改文案 | 改 `constants/<domain>-ui.ts` 或 `<feature>-strings.ts`，不碰组件 |
| 新增枚举值 | 先改 `types/`，再补 `constants/` 颜色/标签，最后改组件；同步 `specs/openapi.yaml` 的 schema |
| 新增字段 | `types/` 加，`mocks/` 填 3 条示例值，组件渲染，api 函数无需改（壳一致） |
| 新增一个对话框 / 页面 | 走 P1 五步，独立 types/mocks/constants/api/component |
| 接入真实后端 | `.env.local` 设 `NEXT_PUBLIC_USE_MOCK=0`，按报错逐个调 api 函数路径 |

---

## 5. 踩过的坑 / 经验值

1. **Figma 产物里 `Date` 对象到处飞**：JSON 序列化后变成字符串，类型对不上。统一用 `ISODateTime = string`，渲染时 `new Date(x).toLocaleDateString('zh-CN')`。
2. **`toLocaleDateString` 在可选字段上爆炸**：`song.releaseDate?.toLocaleDateString(...)` 看起来没问题，其实字段是字符串，方法不存在。写成 `song.releaseDate ? new Date(song.releaseDate).toLocaleDateString('zh-CN') : ''`。
3. **Array mutation 偷偷改 mock 源**：组件里 `SignedArtists.sort(...)` 会就地改 module-level 数组，翻页/切 tab 后顺序错乱。凡 `.sort()` / `.reverse()` 全部前置 `[...arr].sort(...)`。
4. **Tailwind 颜色串重复**：`text-gray-400 bg-gray-500/10 border-gray-500/20` 这种三件套抽进 `RARITY_STYLES: Record<Rarity, {color, bg, border}>`，组件里 `const s = RARITY_STYLES[rarity]`。
5. **翻译索引 `text[\`step${n}\`]` 丢类型安全**：TS 会拿到 `string | undefined`；替换为 `switch` 或单独函数，同时更好读。
6. **Explore 子代理拒绝"改进代码"**：Figma 产物常被系统判定可能含未知逻辑，子代理会拒绝"augment code"。对策：主代理自己做类型抽取，只把"把 50 个三元表达式压成一元"这种机械清理甩给子代理。
7. **lucide-react 图标按需 import**：清理三元表达式后常残留未用图标；跑 `tsc --noEmit` 过不了要 prune。
8. **`EquipSlot` 不等于 `ClothingCategory`**：衣橱里 `outfit` 是整套而非可装备槽位；类型要用 `Exclude<ClothingCategory, "outfit">` 表达，别用 `as keyof typeof equipped`。

---

## 6. 关键命令速查

```bash
# 类型检查（最常用）
cd apps/web_new && npx tsc --noEmit

# 全量 build（发版前）
cd apps/web_new && npm run build

# 检查还残留多少多语言
grep -RIn "lang === 'en'\|{ zh:\|{zh:" apps/web_new/src

# 列出所有域导出
grep -RIn "^export \(interface\|type\|const\)" apps/web_new/src/types apps/web_new/src/mocks apps/web_new/src/constants

# Mock ↔ 真后端切换
echo "NEXT_PUBLIC_USE_MOCK=1" > apps/web_new/.env.local  # 本地纯前端
echo "NEXT_PUBLIC_USE_MOCK=0" > apps/web_new/.env.local  # 连后端
```

---

## 7. 关联文档

- `apps/web_new/README.md` — 结构说明 + 版本历史（每次迭代必改）
- `specs/openapi.yaml` — 后端接口契约（path + schema 真值源）
- `specs/BUSINESS_RULES.md` — openapi 表达不了的业务约束（校验规则、扣费公式、状态机）
- `apps/web/scripts/check-api-contract.mjs` — `npm run check:api-contract` CI 漂移校验
- `product_spec.md` — 产品口径说明（数字人/数字 IP 主线，v2.7 canonical）
- `product_spec_ai_celebrity.md` — AI 明星带货产品规格（独立文档，v0.5.x）
