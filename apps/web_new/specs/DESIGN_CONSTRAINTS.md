# Web_new 产品设计约束

> 目标：用一组可执行的规则锁死视觉与交互一致性，避免"黑底白按钮"、"按钮点不动"、"同模型在不同页面不流转"这类体感问题反复出现。新增页面/组件前必读本约束；PR review 以此为清单。

版本：v1 · 适用：`apps/web_new/`

---

## 0. 设计基调

AI Star Eco 的视觉语言是 **近黑深色 + 霓虹强调色**：Cyan(#06b6d4) / Purple(#a855f7) / Pink(#ec4899) 为三主色，Green/Amber/Red 作为状态语义色。整体观感应当偏赛博、冷静、发光感，**禁止**出现纯白大色块 / 浅色卡片 / 高饱和粉彩风格。

---

## 1. 主题与 Token（硬规则）

### 1.1 根节点必须启用 dark

- `<html>` **必须**带 `className="dark"`（见 `src/app/layout.tsx`）。全站默认且当前仅有暗色一套。
- `<body>` 使用 `bg-background text-foreground`，**禁止** `bg-black text-white` 硬编码。
- 新加 shadcn 组件不得切回浅色：所有浅色变量仅留作占位，真实消费走 `.dark` 内定义。

### 1.2 语义 token（`src/styles/globals.css` `.dark` 段）

| Token | 值 | 用途 |
|---|---|---|
| `--background` | `#000000` | 页面最底层 |
| `--foreground` | `#f5f6f8` | 正文 |
| `--card` | `rgba(17,24,39,0.5)` | 卡片统一底 |
| `--popover` | `#0b0b10` | 浮层 / Dialog 容器 |
| `--primary` | `#06b6d4`（cyan-500） | 默认主按钮色 |
| `--primary-foreground` | `#0a0a0a` | 主按钮前景 |
| `--muted-foreground` | `#9ca3af`（gray-400） | 次要文字 |
| `--border` | `rgba(255,255,255,0.08)` | 常规分隔 |
| `--ring` | `rgba(6,182,212,0.6)` | 聚焦环 |

**禁止**：在业务代码中再定义一套色系变量或在组件里写 `#xxxxxx` 硬编码。若需新色，加到 `.dark`。

### 1.3 强调色使用边界

| 色系 | 语义 |
|---|---|
| Cyan | 主 CTA、制作人/数据/分发 |
| Purple | 版权/NFT/发行机构 |
| Pink / Rose | 粉丝侧 / 社群 / 互动 |
| Green | 成功 / 收益 / 已完成 |
| Amber | 待审 / 延迟 / 警告 |
| Red | 失败 / 扣减 / 高危 |

跨领域混用需有明确理由（例如 Finance 中"可用余额"用 cyan/purple 渐变，因其为数据主卡）。

---

## 2. 表面（Surface）

### 2.1 卡片三档

| 档位 | className 模板 | 用途 |
|---|---|---|
| 标准卡片 | `bg-gray-900/50 border border-white/5 rounded-xl` | 页面内所有普通分区 |
| 强调卡片 | `bg-gradient-to-br from-{hue}-500/10 to-{hue2}-500/10 border border-{hue}-500/20 rounded-xl` | 顶部重要概览（余额、总粉丝等） |
| 弹层 / Dialog | `bg-gray-900 border border-white/10 rounded-2xl` | 对话框主体（比常规卡更不透明） |

**禁止**：`bg-zinc-*`、`bg-neutral-*`、`bg-slate-*`、`bg-white/X` 作为卡片底色。统一到 `bg-gray-900/50` 家族。

### 2.2 圆角梯度

- 小元素（badge、小按钮、input）：`rounded-md`
- 按钮 / 标签项：`rounded-lg`
- 卡片 / 列表项：`rounded-xl`
- Dialog / 大容器：`rounded-2xl`

**禁止**：同一屏内混用超过两档；禁止 `rounded-3xl` / `rounded-full` 用于内容容器（仅头像、徽标可用 `rounded-full`）。

### 2.3 边框与分隔

- 卡片内部分隔统一 `border-white/5`；卡片外轮廓 `border-white/10`。
- 分隔线 `<div className="h-px bg-white/5" />`（横）/ `w-px bg-white/10` （竖）。
- Hover 上浮边界 `hover:border-{hue}-500/20`。

---

## 3. 按钮

### 3.1 语义分级（**硬规则**）

| 层级 | 样式 | 用例 |
|---|---|---|
| **Primary CTA** | `bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:opacity-90` | 页面最顶部主操作（提现、一键分发、登记版权、创建活动） |
| **Contextual CTA** | `bg-gradient-to-r from-{hue}-500 to-{hue2}-600 text-white` | 领域内强操作（Finance 绿→cyan、Community 粉→紫） |
| **Secondary** | `<Button variant="outline">` + `border-white/10 text-gray-400` | 导出、取消、次要入口 |
| **Ghost/icon** | `<Button variant="ghost">` + `hover:bg-white/10` | 关闭、展开、小工具 |
| **Destructive** | `<Button variant="destructive">` | 注销、解绑、删除 |

### 3.2 禁用清单

- ❌ `bg-white text-black` / `bg-white text-{hue}-900` —— 暗底大白块永远不协调。若需高对比，用渐变 + 外发光 shadow。
- ❌ `bg-gray-200` / `bg-slate-100` 作按钮底。
- ❌ 同一视野内出现两个相同层级的 Primary CTA。

### 3.3 尺寸

- 页面级主操作：`size="lg"` 或自定义 `h-11 px-6 text-base`
- 常规操作：默认（`h-9 px-4 text-sm`）
- 表格 / 卡片内小操作：`size="sm" h-6-7 text-[10px]`

---

## 4. 文本层级

| 用途 | 类 |
|---|---|
| 页面标题 | `text-3xl font-extrabold tracking-tight` + `style={{fontFamily:"var(--font-display)"}}` |
| 分区标题 | `text-lg font-bold tracking-tight` + display font |
| 卡片标题 | `text-sm font-bold` 或 `text-base font-semibold` |
| 正文 | `text-sm text-gray-300` |
| 次要说明 | `text-xs text-gray-500` 或 `font-light` |
| 极次信息 | `text-[10px] text-gray-600` |

数字型展示（金额、播放量、等级）**必须**使用 display font（Space Grotesk）。

---

## 5. 交互（**硬规则**）

### 5.1 每个可点击元素的四条底线

1. **必须有 `onClick` 或 `href` 或 `type="submit"`**。没想清楚做什么也要接一个 `toast.info('功能建设中')`，不得留空处理器。
2. **禁止裸 `alert()` / 裸 `confirm()` / 裸 `console.log(...)` 作为交互反馈**。统一走 `toast`（见 §6）或对话框。
3. **同一模型在不同页面需可流转**。举例：Dashboard 上某首曲目被点击 → 跳 Studio 且自动选中它；Studio 编辑保存 → Distribution 能看到对应发布状态。新页面加入前先写明入口/出口。
4. **异步动作必须有起止反馈**：点击时立即 toast.info('提交中')/按钮 `disabled`，完成后 toast.success/error。不要让用户面对"似乎没反应"。

### 5.2 表单

- `<input>` 聚焦状态：`focus:border-{hue}-500/40 focus:outline-none`；禁止默认蓝色描边。
- 空值/错值必须行内报错（`text-red-400 text-xs`），不得用 toast 替代。
- 回车键等于点击主按钮（`onKeyDown` 处理 `Enter`）。

### 5.3 列表项

- Hover：`hover:bg-white/[0.02] hover:border-white/10 transition`
- 选中：`bg-{hue}-500/10 border-{hue}-500/30`
- 点击整行可打开详情时，整行需 `cursor-pointer` 且整块响应 click；行内二级按钮需 `e.stopPropagation()`。

### 5.4 弹层 z-index 梯度

| 层级 | 用途 |
|---|---|
| `z-30` | 顶部 Topbar / 侧栏 |
| `z-40` | FAB / 悬浮工具 |
| `z-50` | Dialog / Modal |
| `z-[100]` | 通知遮罩 |
| `z-[110]` | 通知面板本体 |
| `z-[200]` | Toast |

通知/下拉/Popover 绝不能放在 `overflow-hidden` 的祖先里用 `absolute` 定位。用 `fixed` 或 Radix Portal。

---

## 6. Toast 规范

唯一入口：`import { toast } from '@/lib/toast'`。

```ts
toast.success('操作成功');
toast.error('校验失败', { description: '请填写必填项' });
toast.info('功能建设中');
```

- 禁止直接 import `sonner`，避免样式分叉。
- 标题限 12 字以内；长文本进 `description`。
- 成功 = 用户主动触发且完成；info = 状态/提示；error = 用户输入错误或系统失败。

---

## 7. 动画

- 进场：`initial={{opacity:0,y:15}} animate={{opacity:1,y:0}}` + `transition={{delay:i*0.05-0.08}}` 列表交错。
- Hover 微动：`transition-all` + `hover:scale-[1.02]`（不超 3%，避免卡顿感）。
- **禁止**：`duration` 超过 500ms 的进场；无限摇晃/旋转；loading 转圈超过 2s 不给反馈。

---

## 8. 图表

- 使用 Recharts；背景透明，`stroke="#555"`, `fontSize={10-11}`。
- Tooltip 统一：`contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}`。
- Pie / Radar 禁止纯三原色；色系与 §1.3 对齐。

---

## 9. 数据流约定

### 9.1 单一真值

- 艺人身份：`activeArtist` 由 `ProducerDashboard` 持有，通过 props 下传。子页面**只读**；需变更走回调。
- 通知数据：`notifications` 由 `ProducerDashboard` 持有；`NotificationPanel` 只接收 props。红点 = `notifications.filter(n => !n.read).length > 0`。
- 选中项（如 `selectedTrackId`）：由跳转源页面传递，目标页面消费；返回 null 关闭高亮。

### 9.2 跨页面跳转

新建页面间跳转前必须答：
1. 用户带着什么 state 过去？
2. 目标页如何展现这段 state？（如：高亮行、打开详情、滚动定位）
3. 用户退出时 state 是否保留还是清理？

答不上就不加跳转链接。

### 9.3 Mock → API 过渡

- 所有 `@/mocks/*` 是临时种子；向后端迁移时整个文件替换成 `@/api/*`。
- 业务组件**禁止** import mocks，要通过 container / hook 层。（当前代码多处违反，后续迭代逐个拆）

---

## 10. 可访问性基线

- 所有 icon-only 按钮必须有 `aria-label` 或 `title`。
- 对比度：正文 ≥ 4.5:1（`text-gray-300` on `bg-black` 合格；`text-gray-500/600` 仅用于极次信息、不得承载必要信息）。
- 聚焦环：保留 shadcn 默认 `focus-visible:ring`。禁止 `outline-none` 不补 focus 样式。
- Dialog 打开后焦点需进入 Dialog；`Escape` 关闭。

---

## 11. 国际化

- 所有用户可见字符串走 `zh/en` 分支（`const zh = lang === 'zh'`）。
- 不得硬编码中文在按钮/标签/toast 里。
- 日期、金额格式走 `@/lib/format`。

---

## 12. 检查清单（PR 前自查）

- [ ] 页面顶部未硬编码 `bg-black` / `bg-white`；用 token
- [ ] 所有 `<Button>` / `<button>` 都有 onClick/href/submit，无一为空
- [ ] 未出现 `alert(` / `confirm(` / `console.log` 作反馈
- [ ] Toast 走 `@/lib/toast`
- [ ] 新卡片使用 §2.1 标准 className
- [ ] 新按钮符合 §3.1 分级
- [ ] 没有 `bg-white text-black` 组合
- [ ] 数据模型在入口/出口页面均能展现
- [ ] 异步动作有起止 toast / disabled 态
- [ ] i18n 双语覆盖

---

## 附录：历史遗留（逐步清理）

- `ThemeProvider.tsx` 的 8 套主题仅在 Settings 面板作预览，未真正接入全站样式。规划要么下线、要么通过 CSS 变量真正接管 `.dark` 值。
- 多处仍手写 `bg-gray-900/50 border border-white/5 rounded-xl`，后续应提取 `<Surface>` 原子组件。
- `src/components/DistributionPage.tsx` 与 `src/components/producer/DistributionPage.tsx` 同名；需合并或改名。
- `WardrobeSystem.tsx` / `ArtistEditor.tsx` 中仍有大量 `border-white/10 hover:bg-white/5` 次级按钮，符合现规范但欠语义抽象。
