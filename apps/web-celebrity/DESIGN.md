---
name: AI Star Eco · Celebrity (Creator Theme)
description: Cream-paper creator workstation for AI celebrity commerce production, quietly premium, violet used as signal.
colors:
  electric-violet: "#7c5cff"
  electric-violet-strong: "#5b3fe0"
  cream: "#faf7f2"
  paper-white: "#ffffff"
  sand: "#f3efe7"
  well: "#ebe5d8"
  line: "#e8e1d3"
  line-strong: "#d8cfba"
  ink: "#1f1a14"
  graphite: "#3a3329"
  clay: "#7a6f5d"
  ash: "#a89e88"
  teal: "#22b59a"
  amber: "#f0a83a"
  rose: "#ff5b8a"
  peach: "#ff8a5b"
typography:
  display:
    fontFamily: "AEP Manrope, PingFang SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "AEP Manrope, PingFang SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "AEP Inter, PingFang SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "AEP Inter, PingFang SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "AEP JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.1em"
  accent-serif:
    fontFamily: "AEP Instrument Serif, Times New Roman, Songti SC, ui-serif, serif"
    fontSize: "20px"
    fontWeight: 400
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
components:
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.pill}"
    padding: "9px 18px"
    height: "36px"
  button-accent:
    backgroundColor: "{colors.electric-violet}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.pill}"
    padding: "9px 18px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "9px 18px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    rounded: "{rounded.pill}"
    padding: "9px 18px"
    height: "36px"
  card:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  chip-accent:
    textColor: "{colors.electric-violet}"
    rounded: "{rounded.pill}"
    padding: "3px 11px"
  well:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
---

# Design System: AI Star Eco · Celebrity (Creator Theme)

> Scope: `apps/web-celebrity` only. This app runs the `creator` theme (cream paper + violet), which is distinct from the other surfaces in the monorepo (admin, web-music, web-drama share a different generation). Tokens live in `apps/web-celebrity/src/styles/tokens.css`; interaction utilities in `apps/web-celebrity/src/styles/app.css`.

## 1. Overview

**Creative North Star: "The Quiet Studio"**

This is a workstation, not a showcase. The surface is warm cream paper, the kind a producer keeps notes on, and the chrome stays out of the way so the work (scripts, products, generated video, distribution) is the only thing that carries color and weight. Confidence comes from structure and restraint, not from spectacle: a creator working against a deadline should always know what the next action is and where the editable surface lives, without the interface raising its voice.

The palette is deliberately quiet so that a single accent can mean something. Electric Violet is the one chromatic voice; everything else is a tinted warm neutral. Status colors (teal, amber, rose) are reserved for genuine state (pass, warning, banned), never for decoration. Depth is conveyed by stepping through four cream tones and 1px hairlines, not by stacked shadows. The result reads as quietly premium: precise, calm, professional.

This system explicitly rejects the flashy-AI-demo look: no neon gradients, no sci-fi glassmorphism, no novelty effects, no surfaces that look generated rather than designed. It is not a dark futuristic dashboard and not a trend-chasing startup landing page. When in doubt, it chooses the calmer, more legible option.

**Key Characteristics:**
- Cream-paper canvas (#faf7f2), four-step tonal layering for depth.
- One accent (Electric Violet) used as signal, not surface; status hues reserved for real state.
- Flat by default; shadows appear only as a response to state.
- Pill buttons, generous radii (10–16px), 1px warm hairlines everywhere.
- Mono eyebrows and tabular numerals give an operational, instrument-like precision.

## 2. Colors

A warm cream-and-graphite neutral base, with one saturated violet voice and a small reserved set of status hues.

### Primary
- **Electric Violet** (#7c5cff): The single chromatic voice. Used for the primary action, the selected/active state, the highest tier ("爆款"), focus rings, and accent chips. On the cream ground its saturation reads as energy; its rarity is what makes it legible.
- **Electric Violet Strong** (#5b3fe0): The accent button's lower border and pressed/hover deepening. Never a fill on its own.

### Secondary
- **Teal** (#22b59a): Success, info, and "pass / 通过" states. Also the secondary positive metric tone (completion, scores).
- **Amber** (#f0a83a): Warning, medium-risk, and the "黄金 3s" hook marker. The one tint allowed on the timeline.
- **Rose** (#ff5b8a): Danger, banned-word flags, hard-block compliance. Always paired with text or icon, never color-alone.

### Tertiary
- **Peach** (#ff8a5b) and Lime (#c4e34a): Reserved extras for business taxonomy (persona tags, drama genres). Used sparingly; not part of the core working palette.

### Neutral
- **Ink** (#1f1a14): Primary text and the dark button fill. The heaviest mark on the page.
- **Graphite** (#3a3329): Strong secondary text.
- **Clay** (#7a6f5d): Tertiary text, mono eyebrows, muted classification labels.
- **Ash** (#a89e88): Faintest text, disabled, placeholder-adjacent.
- **Cream** (#faf7f2): The page canvas (`--bg-0`).
- **Paper White** (#ffffff): Raised surfaces, cards, and editable wells (`--bg-1`).
- **Sand** (#f3efe7): Recessed trays and toolbars (`--bg-2`).
- **Well** (#ebe5d8): Deepest recess, track backgrounds, toggles off-state (`--bg-3`).
- **Line** (#e8e1d3) / **Line Strong** (#d8cfba): Hairline dividers and input strokes.

### Named Rules
**The One Voice Rule.** Electric Violet is the only chromatic accent on a working screen, and it stays under ~10% of the surface. If a second saturated color appears, it must be carrying real state (teal pass, amber warning, rose danger), never decoration.

**The Reserved Status Rule.** Teal / amber / rose are forbidden as classification or branding colors. Categories, tabs, and taxonomy labels resolve to neutral or the single accent. This is why shot-kind tags and asset-type tags are all neutral: color is spent only on state.

## 3. Typography

**Display Font:** AEP Manrope (with PingFang SC / Microsoft YaHei CJK fallback)
**Body Font:** AEP Inter (with PingFang SC / Microsoft YaHei CJK fallback)
**Label / Mono Font:** AEP JetBrains Mono
**Accent Font:** AEP Instrument Serif (italic only)

**Character:** Manrope gives headings a confident, slightly geometric weight; Inter keeps body text neutral and highly legible at small sizes and in dense forms. JetBrains Mono handles every label, ID, timestamp, and numeric readout, which is what gives the interface its precise, instrument-like feel. Instrument Serif italic is a rare editorial grace note, used for human-voice phrases, never for UI chrome.

### Hierarchy
- **Display** (Manrope 700, 22px, line-height 1.2, -0.01em): Page and editor titles (e.g. the script-workshop heading). The largest type on a working screen.
- **Headline** (Manrope 600, 16px, 1.3): Card titles, hero product name, section leads.
- **Title** (Inter 500, 14px, 1.4): Inline editable labels, shot-block names, row primary text.
- **Body** (Inter 400, 13.5px, 1.75): Script text, descriptions, help copy. The generous 1.75 line-height is deliberate for editable prose. Cap reading measures at 65–75ch.
- **Label** (JetBrains Mono 400, 10px, 0.1em, UPPERCASE): The `.eyebrow` pattern, plus IDs, durations, metric units, timestamps. Always Clay (#7a6f5d) or fainter.
- **Accent Serif** (Instrument Serif italic, ~20px): Rare human-voice highlight only.

### Named Rules
**The Mono Numeral Rule.** Every number that can change (durations, scores, counts, prices, percentages) is set in JetBrains Mono with `font-variant-numeric: tabular-nums`, so figures stay column-aligned and read as data, not prose.

**The Eyebrow Rule.** Section context is a 10px uppercase mono eyebrow in Clay, never a bold heading. Hierarchy is carried by the title beneath it, not by shouting the label.

## 4. Elevation

Flat by default, with depth built from tonal layering rather than shadow stacking. The four cream steps (Cream → Paper White → Sand → Well) plus 1px warm hairlines do almost all the structural work: a raised card is white-on-cream with a hairline, a recessed toolbar is sand-on-white. Shadows are reserved and intentionally faint, appearing as a response to state (hover lift, floating layers) rather than as ambient decoration. There is no glassmorphism.

### Shadow Vocabulary
- **Soft** (`box-shadow: 0 1px 2px rgba(31,26,20,0.04)`): The resting card lift against cream. Barely perceptible; just enough to separate white from cream.
- **Lift** (`box-shadow: 0 6px 20px rgba(31,26,20,0.06)`): Hover state for interactive cards and product tiles, paired with a 2px upward translate.
- **Pop** (`box-shadow: 0 20px 48px rgba(31,26,20,0.08)`): Floating layers only: drawers, popovers, dropdown menus.

All shadows are tinted toward Ink (warm), never neutral gray or black.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. If an element has a shadow heavier than Soft without being hovered or floating, it is wrong. Reach for a tonal step or a hairline before reaching for a shadow.

## 5. Components

### Buttons
- **Shape:** Fully pill (`--radius-pill`, 999px). Heights 30 / 36 / 42px for sm / md / lg.
- **Dark (default):** Ink fill (#1f1a14), white text. The strongest CTA, used for confirm/save.
- **Accent:** Electric Violet fill, white text, Violet Strong lower border. The single colored CTA; one per context.
- **Secondary:** Paper-white fill, Ink text, Line-Strong border. The neutral workhorse.
- **Ghost:** Transparent, Graphite text, transparent border. Tertiary actions.
- **Icon / Danger:** Square-ish icon button (white, hairline); Danger is transparent with a Rose border and Rose text, for destructive actions only.
- **Hover / Focus:** 120ms ease on background / border / opacity. No scale on standard buttons.

### Chips
- **Style:** Pill, sans, 11.5px medium. Background is a 14% `color-mix` of the tone over transparent; text is the full tone. Quiet tint, saturated label.
- **State:** Accent chip (violet) marks selection or primary tag. Status chips (success / warning / danger) carry real state. Business-taxonomy tones (romance / drama / slice) exist but stay rare.

### Cards / Containers
- **Corner Style:** Large radius (`--radius-lg`, 16px).
- **Background:** Paper White (#ffffff) on the Cream canvas.
- **Shadow Strategy:** Soft at rest (see Elevation). Never heavier unless hovered/floating.
- **Border:** 1px Line (#e8e1d3).
- **Internal Padding:** 16px default; toolbars and headers use 14–22px. Never nest a card inside a card.

### Inputs / Fields
- **Style:** Sand fill (#f3efe7), Line-Strong stroke (#d8cfba), 10px radius. Mono uppercase label above when labelled.
- **Focus:** Border shifts to Electric Violet plus a 3px `--accent-soft` ring. No glow, no animation beyond the 130ms border/shadow ease.
- **The Well variant:** For editable surfaces sitting *inside* a recessed tray (e.g. the script editor's 口播 / 画面指令 fields), the input must be **Paper White**, not transparent. White-on-sand is the affordance that says "type here." Carries the banned-word highlight overlay beneath a transparent textarea.

### Navigation
- Workspace sidebar + topbar in the `(workspace)` route group. Active item carries the Electric Violet accent (tinted background + accent text); inactive items are Clay, hover to Graphite. Mono section labels.

### Signature: Material-Ops Interaction Utilities
A small set of global utility classes in `app.css` (`.mo-row`, `.mo-card`, `.mo-well`, `.mo-ghost`) exist because the material-ops surface is built with inline styles, which cannot express `:hover` / `:focus-visible`. They encode the resting → hover → focus states centrally:
- **`.mo-row`**: list rows. Hover to Sand; focus-visible accent ring. Selected state stays inline (tint + inset ring).
- **`.mo-card`**: 2px hover lift + Lift shadow, 170ms ease-out.
- **`.mo-well`**: the white editable well described above.
- **`.mo-ghost`**: neutral action chip that reveals its semantic tone (`--mo-tone`) only on hover/focus, so secondary per-item actions don't out-shout content.

All respect `prefers-reduced-motion`. Easing is `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart family); no bounce, no elastic.

### Signature: ProductThumb
Product imagery comes from the real backend (`Product.images[0]`); when absent, it falls back to a first-character monogram on the product's accent gradient. Never emoji. This is the canonical product-preview affordance across the material-ops surface.

## 6. Do's and Don'ts

### Do:
- **Do** spend Electric Violet sparingly: one accent per context, under ~10% of the surface. Its rarity is the point.
- **Do** build depth from the four cream steps (Cream / Paper White / Sand / Well) and 1px hairlines before reaching for a shadow.
- **Do** keep editable surfaces Paper White so the affordance is obvious, especially when they sit inside a recessed tray.
- **Do** set every changeable number in JetBrains Mono with tabular numerals.
- **Do** reserve teal / amber / rose for genuine state (pass / warning / danger), and always pair status color with text or shape, never color alone.
- **Do** use the shared primitives (`Button`, `Card`, `Chip`, `Input`) and the `.mo-*` utilities instead of re-styling inline.

### Don't:
- **Don't** make this feel like a flashy AI demo: no neon gimmicks, no sci-fi clichés, no novelty-first effects, no surfaces that look generated rather than designed.
- **Don't** use glassmorphism, decorative blurs, or glass cards. Depth is tonal, not glassy.
- **Don't** use gradient text (`background-clip: text`); emphasize with weight or size on a solid color.
- **Don't** use a colored side-stripe (`border-left`/`border-right` > 1px) on cards, rows, or callouts. Use a full hairline, a tonal step, or a leading number/icon.
- **Don't** color classification or taxonomy with status hues; categories resolve to neutral or the single accent.
- **Don't** put gray text on a colored fill; use a shade of that color or a transparency of it (the Chip pattern).
- **Don't** reach for a modal as the first thought; exhaust inline and drawer alternatives (the per-shot action drawer is the established pattern).
- **Don't** stack shadows or use a shadow heavier than Soft at rest. If it looks like a 2014 app, the shadow is too dark.
- **Don't** use em dashes in copy.
