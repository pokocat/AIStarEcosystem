// ─────────────────────────────────────────────────────────────────────────────
// app.ts — UI-only types (routing state, language, view enums)
// Domain data types live in src/types/contracts/
// ─────────────────────────────────────────────────────────────────────────────

export type Lang = "zh" | "en";

export type RootView =
  | "home"
  | "portal"
  | "fan"
  | "producer_intro"
  | "producer_app"
  | "coach";

export type ProducerPage =
  | "overview"
  | "persona"
  | "studio"
  | "editor"
  | "distribution"
  | "nft_mint"
  | "earnings"
  | "community";
