# Critique ignore list

> Detector / critique findings the user explicitly marked "do not re-raise".
> Plain markdown. Each non-empty non-comment line matched case-insensitively against rule name or snippet.

# bg-black on video-frame positions — semantically correct (video canvas is black).
# Decision 2026-05-17: ignore detector "pure-black-white" on these exact 7 locations.
# colorize pass will replace with bg-zinc-950 in same edit; until then, no-op.
template-preview.tsx bg-black
slot-input.tsx bg-black
library/page.tsx bg-black
jobs/page.tsx bg-black
