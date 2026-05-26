# DESIGN.md — 运营工作台 admin

> Register: **product**. Designed to disappear into the operator's task.
> Brand personality: 沉静、克制、可信。No spectacle.

This file is the source of truth for design decisions in `apps/admin`. When in
doubt, prefer existing tokens and component patterns over inventing new ones.

## Color strategy

**Restrained.** Tinted neutrals plus the brand primary used sparingly for
primary action, current selection, and state indicators only.

Pure `#000` / `#fff` are banned. Every neutral is tinted toward the brand hue
(`h ≈ 264`) with `c = 0.003–0.010`. The result is a calm, slightly cool
white that reads as "工具" not as "marketing".

### Tokens

All defined in `src/styles/globals.css` via OKLCH. Always reference via the
CSS variable / Tailwind alias, never hard-code colors at the call site.

| Role | Var | Tailwind alias | Notes |
|---|---|---|---|
| Page background | `--background` | `bg-background` | `oklch(0.987 0.005 264)` |
| Surface (cards, popovers, dialog) | `--surface`, `--card`, `--popover` | `bg-surface` / `bg-card` | One step above background |
| Sunken / muted surface | `--surface-muted`, `--muted` | `bg-surface-muted`, `bg-muted` | Use for read-only zones, code blocks, search trigger pill |
| Sidebar surface | `--sidebar` | `bg-sidebar` | Slightly cooler than content |
| Foreground (primary text) | `--foreground` | `text-foreground` | `oklch(0.2 0.025 264)` |
| Muted foreground | `--muted-foreground` | `text-muted-foreground` | For secondary copy, table sublabels, hints |
| Border | `--border` | `border-border` | Hairline 1px. **Never** as a >1px side stripe. |
| Primary | `--primary` (indigo) | `bg-primary`, `text-primary` | Primary action, current nav, focus ring |
| Destructive | `--destructive` | `bg-destructive`, `text-destructive` | Delete/revoke/abort |
| Success | `--success` | `bg-success`, `text-success` | "已联通", "在售", "已启用" |
| Warning | `--warning` | `bg-warning`, `text-warning` | "审核中", "in-memory" advisories |
| Info | `--info` | `bg-info`, `text-info` | Neutral informational chips |

Tints (badges, alerts, ghost surfaces):

- Use `/8` for the surface tint (`bg-success/8`, `bg-warning/8`, `bg-destructive/8`).
- Use `/25–/40` for border / ring opacity.
- Text uses the full saturation token.

This is the only "gradient" allowed: a single semantic color, fading via opacity.
True multi-stop `bg-gradient-*` is reserved for the absolute exception (never on
a brand mark, button, or card by default).

## Typography

- One family. System stack: `ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`.
- `--font-size: 14px` root. Tight, data-dense scale.
- `font-feature-settings: "cv11", "ss01"` for clean numerals in Inter-likes.
- `font-variant-numeric: tabular-nums` on every table and `.tabular` cell.
- Hierarchy via weight + size, never ratio gymnastics:
  - Page title `text-xl font-semibold tracking-tight`
  - Card title `text-base font-semibold`
  - Section label `text-sm font-medium`
  - Body / table cell `text-sm`
  - Hint / tertiary `text-xs text-muted-foreground`
  - Raw id / wire string `text-[10px] font-mono text-muted-foreground`

## Components

### Buttons

`src/components/ui/button.tsx` — only seven variants: `default`, `destructive`,
`outline`, `secondary`, `ghost`, `link`, `success`, `warning`. Don't invent new
button styles. Sizes: `default | sm | lg | icon`.

### Cards

`src/components/ui/card.tsx` — use for the primary chunking of dense data, not
for everything. Two rules:

1. Nested cards are always wrong.
2. If the content is one sentence + one action, it's probably a row, not a card.

### Feedback

Two providers mount globally in `src/app/layout.tsx` via `FeedbackProviders`.
**Native browser dialogs are banned.** Always use:

- `useToast()` from `@/components/feedback` → transient bottom-right toasts.
  Methods: `info`, `success`, `warning`, `danger`, `dismiss(id)`. The toast
  surface is built in-house (no extra dependency) and lives in
  `src/components/feedback/Toaster.tsx`.
- `useConfirm()` from `@/components/feedback` → Promise-based confirm wrapping
  the existing `ActionDialog`. Returns `{ ok, reason }`. Always supply
  `tone`, `affected` (a short summary of the object being acted on), and
  `requireReason: true` for destructive + auditable actions.

```ts
const res = await confirm({
  title: "删除商品",
  tone: "danger",
  confirmLabel: "确认删除",
  requireReason: true,
  reasonPlaceholder: "例如：密钥泄漏 / 已迁移",
  affected: <div className="font-medium">{p.name}</div>,
});
if (!res.ok) return;
```

### Shell

- `AppShell` in `src/components/shell/AppShell.tsx` mounts the sidebar +
  topbar + main; hides itself on `/login`.
- `Sidebar` has a flat monogram mark (`AS` in `bg-primary text-primary-foreground`).
  **Do not** reintroduce the indigo→violet gradient logo.
- `Topbar` has:
  - A real `CommandPalette` (Cmd/Ctrl+K, also clickable). Searches every
    visible sidebar item by label + group + description. Below `md` it
    collapses to an icon-only trigger.
  - Help opens a per-route help dialog using the matched nav item's
    description, plus the keyboard hint and a support email.
  - The bell is a real `<Link href="/notifications">` with the unread count.
- `PageHeader` is responsive: actions wrap to a new row below `sm`. Supply
  short descriptions (operator-language, not field names).

### Tables

`src/components/ui/table.tsx`. Conventions:

- Column heads are short Chinese labels. **Not** field names. Field names live
  in `<span className="font-mono text-[10px] text-muted-foreground">` as
  secondary text under the primary cell value.
- Right-align numeric columns and add `tabular-nums`.
- Action column is the last column, right-aligned, with `space-x-1` between
  small `Button` variants.
- Status is a `Badge` with the project tone vocabulary (`success | warning |
  danger | info | neutral | primary`). Never use raw text status like `✓` /
  `✗`.

## Page composition rules

1. **No raw English field names in primary copy.** `providerType` →「服务商类型」,
   `baseUrl` →「调用地址」, `apiKey` →「API 密钥」, `templateId` →「模板编号」,
   `userId` →「用户编号」. The wire format keeps the field names; only the UI
   relabels.
2. **Progressive disclosure for the long tail.** Settings forms expose basic
   fields by default; rare flags (`apiVersion`, `priority`, custom DSN parts)
   collapse behind a `Settings2 → 高级` toggle.
3. **Hints, not jargon.** Each form field gets one short hint line under it.
   Sample: "服务端用 AES-GCM 加密落库" beats a bare label. The technical detail
   is welcome; the implementation idiom is not.
4. **Speak in operator outcomes.** "已下架" / "已联通" / "已吊销" / "已发布"
   read as states, not commands.
5. **Affected-object summaries on confirm.** Every destructive confirm shows
   the human-readable object name plus the id in mono.

## Mobile

- Below `lg`: sidebar becomes a drawer; the topbar has a menu trigger.
- Below `md`: topbar search collapses to icon; help is hidden.
- Below `sm`: PageHeader actions wrap to a second row; the avatar block hides;
  only the bell, command trigger, and logout remain.

## Motion

- 150 ms ease-out on hover / state transitions.
- Toasts slide in from bottom (`slide-in-from-bottom-2`) at 150 ms.
- Dialogs fade + scale via Radix defaults; no orchestrated entry animations.
- No bounce, no elastic.

## Banned patterns (PR review reject)

- `window.alert` / `window.confirm` / `window.prompt`, or the bare globals.
  Always toast / `useConfirm` / inline form input.
- Side-stripe borders > 1px as a colored accent.
- Multi-stop background gradients (incl. `bg-gradient-*`) on chrome.
- `bg-clip-text` gradient text.
- Decorative glassmorphism / heavy backdrop blurs (the topbar's mild
  `backdrop-blur-md` is the one exception, behind a translucent surface).
- "Hero metric" stat-card-grid templates for non-dashboard pages.
- Raw English enum values rendered to operators (`SCRIPT_DRAFT`, `OPENAI_COMPATIBLE`).
  Always pass through a `*_LABEL` map.
- Em dashes in copy. Use commas, periods, colons, semicolons, parentheses.

## Open follow-ups

- Apply the same domain-label pass to the remaining secondary admin pages
  (artists, content/songs, distribution/jobs, etc) — same toast + confirm +
  Chinese-relabel discipline.
- Build out the "global business search" (账户 / 订单 / 合约) as a second
  source in the command palette once a backend endpoint exists.
- Adopt ShedLock for `MixcutOutputCleanupScheduler` once multi-instance prod
  comes online (also flagged in CLAUDE.md).
