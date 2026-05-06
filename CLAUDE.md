# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Primary reference**: [`AGENTS.md`](./AGENTS.md) contains the full repository overview, three-end data-flow architecture, domain alignment table (20 domains × web / admin / server), and the new-domain SOP. Read it before non-trivial work. This file only captures the fast-path commands and pitfalls that don't live there.
>
> **Staleness check**: `AGENTS.md` has drifted before. Before trusting a fact from it, verify against the source of truth:
> - **Ports** → `apps/web/package.json` + `apps/admin/package.json` (the `dev` script's `-p` flag).
> - **Admin role names** → `apps/server/src/main/java/com/aistareco/aep/config/AepSecurityConfig.java` and the `Role` enum in `apps/server/src/main/java/com/aistareco/aep/model/`.
> - **Seed accounts / credentials** → `apps/server/src/main/java/com/aistareco/aep/config/DataInitializer.java`.
> - **Domain inventory** → the actual `src/types/` directories in web/admin; the AGENTS.md table is a snapshot.
>
> If you find drift, fix both `AGENTS.md` and this file in the same change.

## Repository in one paragraph

**AI Star Eco** — AI virtual-artist incubation & distribution platform. Three frontends share one backend:

- `apps/server` — Spring Boot 3.3.5 / Java 17, port **8080**, JPA + JWT (JJWT 0.12.6), H2 (dev) or MySQL (prod).
- `apps/web` — Next.js 14 (App Router) user-facing frontend, port **3002** (`npm run dev`). Talks to the server via Next rewrites of `/api/*`.
- `apps/admin` — Next.js 14 admin console, port **3003** (`npm run dev`). Calls `/api/admin/*`.
- `figma/` — one-shot Figma Make export; **UI reference only**, not source.
- `specs/openapi.yaml` — backend interface contract (paths + schemas).
- `specs/BUSINESS_RULES.md` — openapi-can't-express constraints: validation rules, calculation formulas, state-machine timing, error codes.
- `apps/web/scripts/check-api-contract.mjs` — CI gate: every `apiFetch(...)` URL must have a matching openapi path. Run via `npm run check:api-contract` from `apps/web/`.

Product spec: `product_spec.md` (root) — updated most recently; prefer it over `product.md`.

## Daily commands

```bash
# Server (Spring Boot)
cd apps/server
./mvnw spring-boot:run                                    # dev profile, H2 in-memory, seeds on boot
./mvnw spring-boot:run -Dspring.profiles.active=mysql     # MySQL profile
./mvnw compile -q -o                                      # offline compile check (fast)
./mvnw test                                               # JUnit tests
./mvnw -Dtest=ClassName#method test                       # single test

# Web (user frontend, port 3002)
cd apps/web
npm install
npm run dev
npx tsc --noEmit         # type-check (required green)
npm run build
npm test                 # vitest run (unit tests, see src/lib/*.test.ts)
npx vitest run path/to/file.test.ts   # single test file

# Admin (management console, port 3003)
cd apps/admin
npm install
npm run dev
npm run typecheck        # alias for tsc --noEmit
npm run build
```

**Three-end compile gate** — before claiming done, all three must pass:

```bash
(cd apps/web && npx tsc --noEmit) && \
(cd apps/admin && npx tsc --noEmit) && \
(cd apps/server && ./mvnw compile -q -o)
```

## Mock vs. live switch

Both frontends honour `NEXT_PUBLIC_USE_MOCK` in `.env.local`:
- `=1` → `api/*.ts` short-circuits to `mocks/*.ts` static data. No network.
- `=0` → real `apiFetch` through Next rewrites to `apps/server` on 8080.

**Pitfall**: components should import `mocks/` directly for SSR/SSG or default-view fixtures; hitting `api/*` with `USE_MOCK=0` but no server running yields 404. Prefer `import { DATA } from "@/mocks/xxx"` for component defaults and use `api/*` only for user actions.

## The two hard rules

1. **Frontend types are the single source of truth.** `apps/web/src/types/*` is the contract. `apps/admin/src/types/*` is kept identical (straight copy), with admin-only extensions as `interface AdminXxx extends Xxx` or separate files (e.g. `audit.ts`). Spring Boot `*Dto` record field names **must match** the TS interface field names exactly — mapping from JPA entities happens inside DTO `from()` methods. Enums are lowercased on the wire; hyphenated values use the `wire` pattern.

2. **Credits are ledger-only.** All wallet balance changes flow through immutable `LedgerEntry` rows. Never UPDATE a balance column directly. `total_balance = license + recharge + gift` (the `pending` bucket is excluded). See `apps/server/src/.../aep/service/CreditService.java`.

## Adding or changing a domain

See `AGENTS.md` → "新增领域 SOP" for the full 13-file checklist (types / mocks / api / constants on both frontends + entity / repository / dto / controller on server, plus API index re-exports). Skipping any file breaks the three-end compile gate.

For Figma prototype updates, invoke the `figma-migrate` skill — it codifies the five-piece-per-domain layout (types / mocks / constants / api / component) and the web → admin → server sync.

## API response envelopes

- Single resource: `{ success: true, data: T, message?: string }` via `ApiResponse<T>`.
- Paged list: `{ success: true, data: T[], pagination: { page, limit, total, totalPages, hasNext, hasPrev } }` via `PageEnvelope<T>` — **not** wrapped in `ApiResponse`.
- Frontend `apiFetch` unwraps `data` for you; call sites see `T` / `T[]`.

## Security model (server)

```
/api/auth/**               → permitAll (license activation)
/api/admin/auth/login      → permitAll
/api/me/**                 → authenticated (JWT; controller must check ownerUserId == principal.id)
/api/admin/**              → hasAnyRole("PLATFORM_OPERATOR", "FINANCE_ADMIN")
```

Dev admin credentials (seeded by `DataInitializer`): `admin / admin123` (PLATFORM_OPERATOR), `finance / finance123` (FINANCE_ADMIN).

> Note: `AGENTS.md` uses the older role names `SUPER_ADMIN / OPERATOR`. The server code and `apps/server/README.md` are authoritative — the actual role enum values are **`PLATFORM_OPERATOR`** and **`FINANCE_ADMIN`**.

## Conventions that bite if ignored

- **Numeric fields stay as raw integers.** `fans: 128_000`, not `"128K"`. Formatting lives in `apps/web/src/lib/format.ts` (`formatCompactNumber`, `formatCredits`, `formatCurrency`, `formatDuration`).
- **Chinese monolingual.** Remove any `{ zh, en }` dictionaries or `lang === 'zh' ? ... : ...` ternaries you encounter. Legacy `src/translations.ts` is tombstoned; don't read from it.
- **shadcn/ui primitives** live under `components/ui/` — don't hand-edit them; extend via wrappers.
- **`"use client"`** is already on every component under `apps/web/src/components/` (a historic Figma-port fix); keep it when creating new client components.
- **`apps/web/src/api/*` signatures** are `async function xxx(): Promise<T>` and are aggregated as namespaces in `api/index.ts` (`MusicApi`, `ArtistsApi`, …). Follow that shape when adding new endpoints.

## Where to look for domain context

- `product_spec.md` (root, ~52KB, most current) — canonical product-level spec, referenced by version logs in web/admin READMEs.
- `specs/openapi.yaml` — backend interface contract; 142 paths grouped by tag.
- `specs/BUSINESS_RULES.md` — validation rules, calculation formulas, error codes, state-machine timing (the openapi-can't-express stuff).
- When you add a new domain or endpoint, the order is: (1) `apps/web/src/types/<domain>.ts` (truth source), (2) `apps/web/src/api/<domain>.ts` (apiFetch URLs), (3) `specs/openapi.yaml` (path + schema). The `npm run check:api-contract` gate fails if step 3 is skipped — there's no separate "diff doc" to update anymore.
- `apps/web/README.md` — version log with per-release deltas (currently at v2.4.0, 2026-04-19).
- `.claude/skills/figma-migrate/SKILL.md` — invoked automatically when the user mentions Figma updates.
