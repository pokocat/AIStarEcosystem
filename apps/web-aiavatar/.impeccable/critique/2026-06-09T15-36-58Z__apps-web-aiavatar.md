---
target: apps/web-aiavatar
total_score: 27
p0_count: 0
p1_count: 3
timestamp: 2026-06-09T15-36-58Z
slug: apps-web-aiavatar
---
# Critique — web-aiavatar (数字人资产平台)

Target: `apps/web-aiavatar` (mobile H5 SPA). Register: product. North Star: The Atelier Ledger.
Method: Assessment A (independent LLM design review, code-grounded) + Assessment B (impeccable detector + 6-screen live visual pass in mock mode at 375×812).

## Design Health Score (Nielsen)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Strong: live job badges, progress %, skeletons, pull-to-refresh. Builtin-voice 试听 only toasts, no audio. |
| 2 | Match system / real world | 4 | Honest Chinese copy, mock badges, no engine jargon leaked. |
| 3 | User control & freedom | 3 | Real back-stack + hash permalinks + Confirm dialogs; create-wizard cold-start not URL-restorable. |
| 4 | Consistency & standards | 1 | Three active-filter-pill treatments; FilterPill primitive reinvented 5+ times; per-app rainbow. Biggest defect. |
| 5 | Error prevention | 3 | Confirm on destructive ops; photo guards; camera-fail falls back to upload. |
| 6 | Recognition over recall | 3 | Icon+label everywhere; 6 derivative categories are slate-icon-only (hard to tell apart fast). |
| 7 | Flexibility & efficiency | 3 | Quick-gen, presets; no batch/multi-select for power users. |
| 8 | Aesthetic & minimalist | 2 | Clean core; funnel screens pile decorative gradient glows that fight the thesis. |
| 9 | Help users with errors | 3 | Coded toasts + retry on failed tasks; no inline field validation. |
| 10 | Help & documentation | 2 | First-run empty states good; little help beyond that. |
| **Total** | | **27/40** | **Competent, with ship-blocking consistency + color-doctrine debt.** |

## Anti-Patterns Verdict

**AI-slop: product-grade core, slop-contaminated funnel.** The asset/library/dossier surfaces are genuinely distinctive and task-shaped (REG numbers, serif identity, mono records, restrained blue shadows) — nobody would call those AI-generated. BUT login, AI-create entry, and home banners reach for violet/pink/blue radial-glow gradient beds that read as generic "AI app" marketing flash and contradict the app's own one-cyan discipline.

**Deterministic scan (impeccable detect):** 5 findings, all `layout-transition` warnings (animating padding/width/height/max-height): `screen-chain.tsx` ×3 (lines 27/37/40), `screen-real.tsx`, `ui.tsx`. The detector is otherwise near-blind here because screens are `React.createElement` + inline styles, not JSX markup — so it cannot see the color/slop/consistency issues. Those came from the LLM review + visual pass.

**Visual pass (6 screens, mock mode):** confirmed the rainbow violations live — Storage breakdown ships cyan/green/orange/violet/gray per category; Apps Center ships violet/orange/blue per downstream app; the AI-original path icon is violet. Also confirmed: the dark "N" circle seen bottom-left on every screen is the **Next.js dev-tools indicator** (`<nextjs-portal>`), a dev-only artifact, NOT a product issue (checked and dismissed).

## Overall Impression

This is a real, shippable mobile product with one genuinely distinctive idea (the Registry Dossier) executed end-to-end, dragged down by two correctable debts: (1) the cyan accent is overspent (every selected filter pill is cyan) so it stops meaning "live/action," and (2) the "one ink, no category color" doctrine in DESIGN.md is contradicted by several shipped screens that hardcode a secondary palette. The single biggest opportunity: decide whether the doctrine or the screens are right, then enforce one of them.

## What's Working

1. **The Registry Dossier is load-bearing, not decoration.** REG chips, the rotated archival `seal` on signed licenses, mono field rows, serif identity names. The one distinctive idea, and it's executed.
2. **Honesty discipline is wired end-to-end.** `mock`/`预览` badges, downloads gated on real cert URLs, voice-clone "TTS 上线后可用" disclaimers. Matches the anti-illusion principle.
3. **Real mobile mechanics.** True `env(safe-area-inset-*)`, damped pull-to-refresh, hash permalinks with back/forward, real getUserMedia capture. The phone-shell really was removed; this is a product, not a mockup.

## Priority Issues

**[P1] Cyan active-filter pills in the Library overspend the one ink.** The app's most-used browsing surface renders selected pills as cyan (`screen-library.tsx:100,105,181,398,587`), directly breaking DESIGN.md's "active filter pill is ink, not cyan," and the `FilterPill` primitive (`ui.tsx:122`, which correctly uses ink) is bypassed by 5+ inline copies. *Why it matters:* cyan also marks "live/generating," so a filtered library is awash in cyan and the signal collapses; it's the headline consistency failure (Nielsen #4 = 1). *Fix:* route every pill through `UI.FilterPill`; add a `tone="quiet"` variant if a bordered look is needed, don't fork it.

**[P1] Decorative gradient-glow beds on the funnel screens are the slop tell, on the first screen users see.** `screen-login.tsx:137-139`, `screen-aicreate.tsx:73-76`, and home banner gradients lay violet/pink/cyan radial blooms the V4 skin explicitly killed. *Why it matters:* login is the first live impression and it matches nothing else in the app. *Fix:* paper/`--canvas` + at most one faint cyan wash (the pattern `MAssetEmpty` already uses correctly).

**[P1] Apps + Storage screens hardcode per-category / per-app color.** `data.ts:552-557` (per-app brand colors) and `data.ts:608-611` (per-storage-category colors) paint icons/bars/glows by category, the exact Collapsed-Rainbow violation, hardcoded so the V4 cascade can't neutralize it. *Why it matters:* it's either a doctrine break or a sign the doctrine is wrong (these distinctions may be legitimately useful). *Fix (if doctrine stands):* neutralize the color fields to `--ink-2`/`--primary`, distinguish by icon. *Or:* relax DESIGN.md to permit a named secondary palette in these specific roles.

**[P2] Absolute-ban + Serif-Is-Sacred hits in the detail screen.** `screen-library.tsx:382` wraps the 设定语 quote with `border-left: 2px solid` cyan (a hard side-stripe ban) AND sets it in Newsreader serif (serif reserved for asset names); `screen-lictaskme.tsx:75` also serifs a license subject's legal name. *Fix:* full border or background tint for the quote; restrict serif to asset identity only.

**[P2] Layout-property animations jank on low-end phones.** Detector: `screen-chain.tsx` (padding/width/height/max-height), `screen-real.tsx`, `ui.tsx`. *Fix:* animate `transform`/`opacity`, or `grid-template-rows` for height reveals.

## Persona Red Flags

**First-time creator on a phone (core persona):** lands on a login header with a purple/pink gradient matching nothing else; picking "AI 设计" hits `AIForm` with ~8 fields / ~24 option targets at once, colliding with the "约 15 秒生成第一版" promise; the builtin-voice 试听 button looks playable but only toasts.

**Power user managing many assets:** no batch ops or multi-select; a heavily-filtered Library is awash in cyan (same color as "live"), defeating at-a-glance scanning; 6 derivative categories are slate-icon-only, so telling 表情/场景/换装 thumbnails apart at speed leans on small gray glyphs.

**Low-vision / reduced-motion user:** `layout.tsx:15-16` disables pinch-zoom (`maximumScale:1,userScalable:false`); several captions are 10–11.5px on `--ink-3/--ink-4`; `prefers-reduced-motion` is unhandled (PRODUCT.md claims a one-click animation kill, but `html.anim` is never toggled and `.m-fade/.m-stagger/.m-page-in` run unconditionally).

## Minor Observations

- Modal backdrop `rgba(26,25,34,.42)` (`ui.tsx:228`) is a near-black/violet scrim, off the Blue-Shadow ethos the sheet backdrops follow.
- `EngineTag` is tombstoned to `null` yet `DERIVS`/`PATHS` still carry dead `engine:` fields.
- Footer version strings show "v4.1" while repo docs are at v0.56 (staleness smell).
- Dead `--c-atlas…--c-ward` rainbow palette + `.home-glow`/`.m-stage` glow CSS still in `globals.css` (a loaded gun).
- Home tab does two avatar fetches (`MHome` + shared `useApi`).

## Questions to Consider

- Is the "one cyan, no category color" doctrine actually right, or should DESIGN.md permit a defined secondary palette for downstream-app identity and creation-path? The screens have already voted with color.
- What would a confident login screen look like with zero gradient and one cyan mark?
- Should the 6 derivative categories earn a sanctioned tint (recognition) rather than 6 gray glyphs?
