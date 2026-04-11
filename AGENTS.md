# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm i          # Install dependencies
npm run dev    # Start dev server (Vite)
npm run build  # Production build
```

There is no test runner configured. No lint script is defined in `package.json`.

## Architecture Overview

This is a **React 18 + TypeScript** SPA built with Vite and Tailwind CSS v4. It is an AI virtual singer incubation platform ("AI Star Eco") with bilingual (Chinese/English) support.

### Key Architectural Decisions

**`src/App.tsx` is the central hub** — it is extremely large (~300KB) and contains:
- All `TRANSLATIONS` (zh/en) as a single `TRANSLATIONS` object with `Lang = 'zh' | 'en'` type
- All major view-level logic and UI sections (landing page, fan portal, producer dashboard, etc.)
- State-based "routing" via `useState` — there is no React Router; views switch via conditional rendering

**Three user roles** with distinct views:
- **Fan** (星际听众) — music discovery, charts, NFT badge market
- **Producer/Maker** (造梦架构师) — full dashboard with sidebar navigation
- **Coach** (生态领航员) — agency management backend

**Incubator module** uses a two-level navigation pattern (no router):
- `AIIncubator.tsx` — singer gallery/library (main page)
- `SingerEditor.tsx` — singer creation/editing tool with 6 module tabs; rendered by replacing AIIncubator via conditional render when `editingSinger` state is set

**Theme system** is custom (`src/components/ThemeProvider.tsx`), not next-themes. Six themes: `cyberpunk`, `glassmorphism`, `gradient`, `neumorphism`, `terminal`, `minimal`. Use `useTheme()` hook and `themeConfig` object to apply theme-aware Tailwind classes.

### Directory Structure

```
src/
  App.tsx                    # Main app — all translations, views, and top-level state
  main.tsx                   # React DOM entry point
  components/
    ui/                      # shadcn/ui primitives — do not modify directly
    figma/                   # Figma Make image helpers
    AIIncubator.tsx          # Singer gallery (list/manage singers)
    SingerEditor.tsx         # Singer editor (6-tab creation tool)
    WardrobeSystem.tsx       # Costume/styling module
    PoseLibrary.tsx          # Pose/action library module
    DistributionPage.tsx     # Music distribution UI
    GlobalAudioPlayer.tsx    # Persistent audio player
    MusicGenerationDialog.tsx
    NFTMintingDialog.tsx
    ThemeProvider.tsx        # Custom theme context + themeConfig
    ThemeSwitcher.tsx
    OnboardingGuide.tsx
    ToastNotification.tsx
  supabase/functions/server/
    index.tsx                # Hono-based edge function server (Deno runtime)
    kv_store.tsx             # Key-value store helpers
  styles/globals.css
  index.css
```

### Core Dependencies

- **UI components**: `src/components/ui/` — shadcn/ui (Radix UI primitives + Tailwind)
- **Animations**: `motion/react` (Framer Motion) — used heavily throughout App.tsx
- **Charts**: `recharts` — BarChart, AreaChart in producer dashboard
- **Icons**: `lucide-react`
- **Backend**: Hono server deployed as a Supabase edge function (Deno runtime, `npm:` imports)
- **Data**: `@jsr/supabase__supabase-js` for Supabase client

### Singer Data Model

```typescript
interface Singer {
  id: string;
  name: string;
  avatar: string;
  style: string;
  status: 'active' | 'draft' | 'archived';
  quality: 'common' | 'rare' | 'epic' | 'legendary';
  createdAt: Date;
  stats: { songs: number; fans: number; popularity: number };
  tags: string[];
}
```

### Adding Translations

All UI strings live in the `TRANSLATIONS` object at the top of `App.tsx`. Both `zh` and `en` keys must be updated together. Strings are accessed via `t.key` where `t = TRANSLATIONS[lang]`.
