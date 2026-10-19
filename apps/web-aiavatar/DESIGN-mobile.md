---
name: AiAvatar · 数字人资产平台
description: A mobile digital-human asset platform, run like a bright atelier with a precise ledger.
colors:
  canvas: "#F7F9FB"
  canvas-2: "#EEF2F6"
  surface: "#FFFFFF"
  surface-2: "#F6F8FB"
  surface-3: "#EDF1F5"
  ink: "#14202B"
  ink-2: "#5A6873"
  ink-3: "#8A96A1"
  ink-4: "#BAC4CD"
  line: "#EBEFF3"
  line-2: "#E0E6EC"
  line-3: "#CFD7DF"
  primary: "#12B3DE"
  primary-700: "#0C97BE"
  primary-600: "#10A6CF"
  primary-500: "#4CCBEC"
  primary-soft: "#E6F5FA"
  primary-tint: "#F3FAFD"
  on-primary: "#FFFFFF"
  ok: "#1AA06E"
  ok-soft: "#E2F4EC"
  warn: "#D9920E"
  warn-soft: "#FBF0DA"
  err: "#E0455C"
  err-soft: "#FBE6EA"
  info: "#2BA6E8"
  info-soft: "#E6F2FB"
  # secondary palette (sanctioned v2): identity + wayfinding only, never decoration
  app-music: "#7C5CE6"
  app-commerce: "#E8884A"
  app-drama: "#3E63C8"
  path-ai: "#8F6BFF"
  store-video: "#1AA06E"
  store-3d: "#D9920E"
  store-voice: "#8A6BFF"
typography:
  display:
    fontFamily: "Manrope, 'Noto Sans SC', system-ui, -apple-system, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope, 'Noto Sans SC', system-ui, sans-serif"
    fontSize: "16.5px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope, 'Noto Sans SC', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  asset-name:
    fontFamily: "Newsreader, 'Songti SC', 'Noto Serif SC', Georgia, serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.01em"
  reg:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.04em"
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 500
    letterSpacing: "0.1em"
rounded:
  xs: "7px"
  sm: "9px"
  md: "12px"
  lg: "15px"
  xl: "19px"
  2xl: "24px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-700}"
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-soft:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
  button-danger:
    backgroundColor: "{colors.err-soft}"
    textColor: "{colors.err}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "18px"
  badge:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    height: "23px"
    padding: "0 9px"
  badge-primary:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 14px"
  filter-pill:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    height: "34px"
  filter-pill-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
  modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
---

# Design System: AiAvatar · 数字人资产平台

## 1. Overview

**Creative North Star: "The Atelier Ledger"**

Two voices share one surface. A maker's serif (Newsreader) names each creation with warmth; a registrar's mono (JetBrains Mono) records it with precision; and a calm sans (Manrope) runs the controls in between. The atelier is bright, paper-white, and uncluttered. The ledger is exact: every digital human is an accessioned asset with a serif name, a `REG · DH-2041` number, a version history, a license, and an archival seal. Cyan is the ink reserved for the active entry.

This is a mobile-first H5 product surface (a full-screen SPA, capped at a 480px content column on desktop), not a marketing page. It rejects the SaaS dark-dashboard reflex and decorative color in equal measure. An earlier draft sprayed color across every derivative chip; the shipped "清爽" skin pulls that into a disciplined system: one cyan for action and live state, a small sanctioned secondary palette for identity and wayfinding (downstream apps, creation paths, storage breakdown), and calm gray for dense category chips. Color is never decoration.

The feel is clinical-warm. The clinical comes from cool-white paper, hairline cool-gray rules, and soft diffuse shadows tuned blue (rgba(20,36,55,...)). The warmth comes from the serif identity layer and rounded corners (12 to 15px on everything you touch). It should feel familiar to anyone fluent in HeyGen or a well-built capture studio: the tool disappears into the task.

**Key Characteristics:**
- Cool paper-white surfaces (#F7F9FB canvas, #FFFFFF cards), never pure black-on-white.
- One cyan accent (#12B3DE), touching under a tenth of any screen.
- Three type voices with three jobs: serif identity, mono record, sans control.
- Rounded cards floating on soft, blue-tuned shadows, no harsh elevation.
- Mobile-native: real safe areas, a bottom 5-tab bar with a raised center create key.
- Disciplined color: one cyan for action/live, a small sanctioned secondary palette for identity and wayfinding, calm gray for dense category chips.

## 2. Colors

A cool, paper-white base of ink-blue-gray, with one cyan for action and a small sanctioned secondary palette for identity and wayfinding.

### Primary
- **Studio Cyan** (#12B3DE): The single official ink. Primary buttons, the active tab underline, the current-selection ring, the focus glow, live progress, the "REG" stamp, the raised create key. A settled, slightly desaturated cyan (the V4 skin pulled it back from the brighter #13C0EE of the first draft). Step **Cyan Deep** (#0C97BE, `primary-700`) for hover and press; **Cyan Light** (#4CCBEC, `primary-500`) for light fills.
- **Cyan Wash** (#E6F5FA, `primary-soft`): Backs soft buttons, primary badges, and the REG-prefix tint. **Cyan Mist** (#F3FAFD, `primary-tint`) is the faintest hover bed.

### Neutral
- **Deep Slate Ink** (#14202B): Primary text, and the fill of the "dark" high-emphasis button. A near-black tuned blue, never #000.
- **Muted Slate** (#5A6873, `ink-2`): Secondary text, captions, and (critically) every derivative-category icon.
- **Cool Gray** (#8A96A1, `ink-3`): Tertiary text, placeholders, group labels, inactive tab glyphs.
- **Faint Gray** (#BAC4CD, `ink-4`): Disabled glyphs and the faintest spec-sheet field labels.
- **Paper** (#F7F9FB `canvas`, #FFFFFF `surface`): The two base surfaces. Canvas is the cool floor that lets white cards float; surface is the card. #F6F8FB and #EDF1F5 are the inset and hover-fill steps.
- **Hairline** (#EBEFF3 `line` to #CFD7DF `line-3`): Three cool-gray rule weights for borders, dividers, and dotted leaders.

### Tertiary (semantic, muted)
- **Ledger Green** (#1AA06E on #E2F4EC): Done, ready, signed.
- **Amber** (#D9920E on #FBF0DA): Pending, warning.
- **Rose** (#E0455C on #FBE6EA): Error, destructive, revoke.
- **Info Cyan** (#2BA6E8 on #E6F2FB): Neutral information, kept distinct from the brand primary.

### Secondary (sanctioned: identity + wayfinding)
A small named palette, allowed only to mark identity and aid wayfinding, never decoration:
- **Music Violet** (#7C5CE6), **Commerce Orange** (#E8884A), **Drama Blue** (#3E63C8): the three downstream-app identities in the Apps Center.
- **AI-Original Violet** (#8F6BFF) vs **Real-Person Cyan** (the primary): the two creation paths.
- **Storage classes** (video #1AA06E, 3D #D9920E, voice #8A6BFF; image = cyan, license = ink): the storage-usage breakdown.

### Named Rules
**The One Ink Rule.** Cyan (#12B3DE) is reserved for primary action and live/active state. Selection among options (filter pills, view tabs) is ink, not cyan, so the two signals never blur. Cyan is never decoration; on any given screen it touches under a tenth of the pixels. Its rarity is the meaning.

**The Sanctioned Palette Rule.** Beyond cyan, the secondary palette above is permitted, but only as solid icon, bar, and badge fills sized to the role (app identity, creation path, storage breakdown). Dense derivative-category chips in the asset grid stay Muted Slate (#5A6873) + icon for calm: color is earned by top-level identity surfaces, not by every list row.

**The No-Decorative-Glow Rule.** Secondary colors are solid marks, never full-screen radial-glow beds. No violet or pink blurred blooms behind login, create, or hero screens; at most one faint cyan wash (`var(--primary-tint)`) over paper.

**The No-Pure-Black, No-Pure-White Rule.** Text is Deep Slate Ink (#14202B), not #000. Canvas is cool Paper (#F7F9FB), not #FFF. Every neutral is tuned toward the slate-blue hue.

## 3. Typography

**Display / UI Font:** Manrope (with Noto Sans SC for Chinese, system-ui fallback)
**Asset Identity Font:** Newsreader (with Songti SC, Noto Serif SC, Georgia fallback)
**Record / Mono Font:** JetBrains Mono (with ui-monospace fallback)

**Character:** Three voices, three jobs. Manrope runs the controls: tight, modern, set at -0.02em on headings. Newsreader gives each digital human a warm serif name, the one editorial gesture in an otherwise functional UI. JetBrains Mono records the facts: registration numbers, field labels, counts, step numbers, percentages. Fonts load browser-side via a Google Fonts `<link>` (not next/font) and degrade gracefully to system stacks offline.

### Hierarchy
- **Display** (Manrope 700, letter-spacing -0.02em): Screen and section headings (h1 to h4). Top tabs render at 17px; nav titles at 16.5px (-0.01em).
- **Body** (Manrope 400, 14px, line-height 1.6): Default reading text, with `text-wrap: pretty` on paragraphs. Controls run 13 to 15.5px. Prose caps at 65 to 75ch.
- **Asset Name** (Newsreader 500, line-height 1.04, letter-spacing -0.01em): The serif identity of a digital human. Scales with context (roughly 18 to 28px). The single warm, editorial type gesture.
- **Registration No.** (JetBrains Mono 500, 11px, letter-spacing 0.04em): The `REG · DH-2041` asset number, prefixed by a tinted "REG" chip. Color Cool Gray.
- **Field Label** (JetBrains Mono 500, 10px, letter-spacing 0.1em, UPPERCASE): Spec-sheet field labels in the dossier. Color Faint Gray (#BAC4CD).

### Named Rules
**The Three-Voice Rule.** Serif names assets, mono records facts, sans runs controls. Never cross them: no serif on a button, no mono in a paragraph, no sans on an asset's identity name.

**The Serif-Is-Sacred Rule.** Newsreader appears only as an asset's name. It is the product's one moment of warmth; spending it on headings, buttons, or marketing copy cheapens it.

## 4. Elevation

Surfaces are flat paper that float on soft, diffuse, blue-tuned shadows. There are no hard drop-shadows and no harsh borders. Depth comes from a three-step shadow ramp plus a 1px hairline, all with rgba tuned to the slate-blue ink (rgba(20,36,55,...)) rather than neutral black, so cards read as lifted paper on a cool desk. The V4 skin deliberately lightened every shadow and removed the colored "pop" glow of the first draft.

### Shadow Vocabulary
- **Resting** (`--sh-1`: `0 1px 2px rgba(20,36,55,.035), 0 1px 3px rgba(20,36,55,.04)`): Cards, badges, the default float. Barely there.
- **Raised** (`--sh-2`: `0 2px 6px rgba(20,36,55,.04), 0 8px 20px rgba(20,36,55,.055)`): Card hover and lifted state.
- **Overlay** (`--sh-3`: `0 8px 24px rgba(20,36,55,.07), 0 24px 50px rgba(20,36,55,.09)`): Modals, bottom sheets, toasts.
- **Focus Ring** (`--ring`: `0 0 0 3px rgba(18,179,222,.16)`): The cyan focus glow on inputs and selected cards. The only colored shadow that survived V4.

### Named Rules
**The Lift-On-Touch Rule.** Cards rest at Resting shadow and rise to Raised with a -2 to -3px translateY on hover or press. Elevation is a response to interaction, not a permanent decoration.

**The Blue-Shadow Rule.** Every shadow uses rgba(20,36,55,...), the slate-blue ink, never neutral black. Black shadows would read as a different, colder product.

## 5. Components

Buttons, cards, inputs, and pills share one rounded, paper-on-cyan vocabulary across every screen. Standard affordances, no reinvention.

### Buttons
- **Shape:** Rounded rectangle, `--r-md` (12px), weight 700, no letter-spacing. Heights 32 / 40 / 48 (sm / md / lg).
- **Primary:** Studio Cyan fill, white text, Resting shadow. Hover to Cyan Deep + Raised shadow + translateY(-1px).
- **Dark:** Deep Slate Ink fill, white text, hover to #000. The high-emphasis confirm.
- **Soft:** Cyan Wash background, cyan text. The quiet primary.
- **Line / Ghost:** Surface-3 fill (line) or transparent (ghost), ink text. Secondary actions.
- **Danger:** Rose-soft background, rose text, hover to a deeper rose. Destructive only.

### Chips & Pills
- **Filter Pill:** Pill (`--r-pill`), height 34. Inactive is Surface-3 background with ink-2 text. **Active is Deep Slate Ink background with white text**, not cyan: selection among filters reads as ink, action reads as cyan. Optional trailing mono count.
- **Badge:** Pill, height 23, weight 700, 11.5px. Tones mute / primary / ok / warn / err / info, each a soft-background and saturated-text pair. Optional leading dot.
- **Segmented (Seg):** Surface-3 track with 3px padding; the active segment is a white pill carrying Resting shadow.

### Cards / Containers
- **Corner:** `--r-lg` (15px).
- **Background:** Surface white on a cool canvas.
- **Border:** 1px Hairline; the **selected** state swaps to a cyan border plus the focus ring.
- **Shadow:** Resting at rest, Raised on hover (see Elevation), with translateY(-2px).
- **Internal Padding:** 18px default.

### Inputs / Fields
- **Style:** White background, 1px line-2 border, `--r-md` (12px), height 44, 14px text.
- **Focus:** Border shifts to cyan plus the cyan focus ring (`--ring`). That is the only state change; no other chrome appears.
- **Field wrapper:** A label (13px, ink-2, weight 600) over the control, with an optional hint (12px, ink-3) and a required asterisk in rose.

### Navigation
- **Top bar:** Centered nav title (Manrope 700, 16.5px) with a back chevron at left, sticky on tab screens, on the cool canvas background.
- **Bottom tab bar:** 5 tabs on a frosted white bar (`rgba(255,255,255,.86)` + blur) with a 1px top hairline. Inactive ink-3, active cyan with a bold label. The center is a **raised create key**: a 56px, 20px-radius floating button on a cyan-shadowed art bed, lifted -20px above the bar.
- **Mobile model:** A full-screen fixed `app-root` with real `env(safe-area-inset-*)` top and bottom. Content caps at 480px and centers on desktop behind a hairline plus a soft shadow (a content column, not a phone mockup).

### Signature: The Registry Dossier
The product's defining pattern, expressing the Atelier Ledger North Star directly:
- **Asset Name** (Newsreader serif 500): the digital human's warm identity name.
- **Registration No.** (`.reg-no`): `REG · DH-2041` in mono, with a tinted "REG" chip prefix.
- **Field Label** (`.field-label`): uppercase mono 10px spec-sheet labels.
- **Leader** (`.leader`): a dotted rule that stretches between a label and its value, aligning the spec sheet like a ledger column.
- **Archival Seal** (`.seal`): a rotated (-4deg), pill-outlined mono stamp in Ledger Green, animating in with a slight overshoot. Reserved for "archived / ready" milestones.
- **Dossier Paper** (`.dossier-paper`): a faint 26px grid, radially masked, evoking ledger paper behind a header.

### Loading & State
- **Skeleton** (`.m-skel`): a shimmer over Surface-3 while fetching, never a centered spinner inside content.
- **Progress:** a 6px rounded track with cyan fill and an optional mono percentage.
- **Pull-to-refresh:** a floating cyan dot at the content top.

## 6. Do's and Don'ts

### Do:
- **Do** keep cyan (#12B3DE) under a tenth of any screen, spent only on active, primary, or live state (The One Ink Rule).
- **Do** name digital humans in Newsreader serif, and use serif nowhere else (The Serif-Is-Sacred Rule).
- **Do** keep dense derivative-category chips Muted Slate + icon; reserve the sanctioned secondary palette for identity surfaces (apps, storage, creation paths).
- **Do** tune every neutral and every shadow toward the slate-blue ink (rgba(20,36,55,...)): text #14202B, canvas #F7F9FB.
- **Do** rest cards flat at Resting shadow and lift them -2 to -3px on touch.
- **Do** use real `env(safe-area-inset-*)`; this is a true H5 app, not a framed phone preview.
- **Do** show skeletons (`.m-skel`) while loading, not spinners mid-content.
- **Do** route destructive actions through the `Confirm` dialog and report results with toasts.

### Don't:
- **Don't** use `#000` or `#fff`; both read as a different, colder product.
- **Don't** use decorative full-screen radial-glow beds (violet/pink blurred blooms behind login, create, or hero); at most one faint cyan wash over paper (The No-Decorative-Glow Rule).
- **Don't** color dense derivative-category chips in the asset grid; those stay Muted Slate + icon. Color is for top-level identity surfaces (apps, storage, creation paths), per the Sanctioned Palette Rule.
- **Don't** use `window.confirm`, `alert`, or `prompt`; use the `Confirm` dialog and toasts (a repo-wide rule).
- **Don't** put serif on buttons, headings, or body, put mono in paragraphs, or put sans on an asset's identity name.
- **Don't** add side-stripe borders (`border-left` color accents), gradient text (`background-clip: text`), or decorative glassmorphism. The only blurs are the frosted tab bar and sheet backdrops.
- **Don't** make the active filter pill cyan; selection among filters is ink, action is cyan.
- **Don't** use black or hard drop-shadows; depth is soft, diffuse, and blue-tuned.
- **Don't** revive the iPhone shell or fake WeChat chrome (status bar, capsule, home bar); v0.3 removed them on purpose.
