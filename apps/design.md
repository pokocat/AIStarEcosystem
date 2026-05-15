# Frontend conventions

## 设计来源

完整设计稿见 `./design/AI IP Design Directions.html`（design\_canvas 形式）。
三套方向：tech（暗色企业）/ creator（奶油暖调）/ premium（影院金）。
**任何 UI 修改必须保持遵守主题设计规范**

## 设计 Token 契约（强制）

所有颜色/圆角/字体必须通过 `./design/src/styles/tokens.css` 里的 CSS 变量引用：

- 颜色：var(--bg-0..3) / var(--fg-0..3) / var(--line) / var(--line-2)
- 强调：var(--accent) / var(--success) / var(--warning) / var(--danger) / var(--info)
- 字体：var(--font-sans) / var(--font-display) / var(--font-mono) / var(--font-serif)
- 圆角：var(--radius-sm/md/lg/xl)
- 阴影：var(--shadow-sm/md/lg)
- 间距：var(--space-1..12)（4px 基准）

❌ 严禁直接写死十六进制颜色、px 圆角、固定字体名。
❌ 严禁新增不在 tokens.css 里的颜色变量；如必须新增，加到主题块里。

## 组件库

`./design/src/components/ui/` 下是基础组件，**优先复用**：
Button / Input / Chip / Card / Meter / KpiCard / DataTable / Sidebar / Topbar

新建业务组件时：

1. 组合上述基础组件
2. 只用 token 变量

## 参考页面

`./design/src/pages/PersonasOverview.tsx` 是完整范例（KPI grid + meter + 表格 + 操作）。
新页面以它为模板。

## 检查清单（每次改前端 PR 前）

- [ ] 没有写死颜色
- [ ] 用了已有基础组件，没重复造轮子
- [ ] 字体走 var(--font-\*)

