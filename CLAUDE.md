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

Product spec: 双源 — `product_spec.md`（数字人/数字 IP 主线，v2.7）+ `product_spec_ai_celebrity.md`（AI 明星带货线，v0.5.x，独立维护）。完整文档地图见 `docs/INDEX.md`。

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

Full step-by-step file list in [`AGENTS.md` → 新增领域 SOP](./AGENTS.md#新增领域-sop). The non-negotiables that bite if skipped:

1. **TS types are truth source.** `apps/web/src/types/<domain>.ts` first; Spring `*Dto` field names must mirror exactly.
2. **Touched `apps/web/src/api/*.ts`? Update `specs/openapi.yaml` in the same change** — every `apiFetch(...)` URL needs a matching path. There's no separate diff doc anymore; drift is caught at PR time by the contract checker (`apps/web/scripts/check-api-contract.mjs`).
3. **Four gates before committing**:
   ```bash
   (cd apps/web   && npx tsc --noEmit)
   (cd apps/admin && npx tsc --noEmit)
   (cd apps/server && ./mvnw compile -q -o)
   (cd apps/web   && npm run check:api-contract)
   ```

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
/api/admin/**              → hasAnyRole("SUPER_ADMIN", "OPERATOR")
```

Dev admin credentials (seeded by `DataInitializer`): `admin / admin123` (SUPER_ADMIN), `operator / operator123` (OPERATOR).

> Source of truth: `apps/server/src/main/java/com/aistareco/aep/model/AdminUser.java` enum `AdminRole = { SUPER_ADMIN, OPERATOR }` + `apps/server/src/main/java/com/aistareco/aep/config/AepSecurityConfig.java` `.hasAnyRole("SUPER_ADMIN","OPERATOR")` + `DataInitializer.java` 76-91.
>
> Future plan (v0.6+): split into `PLATFORM_OPERATOR` / `FINANCE_ADMIN` for separation of duties. To do that, sync 4 places: `AdminUser.AdminRole` enum / `AepSecurityConfig.hasAnyRole` / `DataInitializer` seed / `apps/admin/src/types/account.ts`. Until then, all four match `SUPER_ADMIN/OPERATOR`.

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
- `apps/web/README.md` — version log with per-release deltas (currently at v2.7, 2026-05-06; v0.5.x not affecting web).
- `.claude/skills/figma-migrate/SKILL.md` — invoked automatically when the user mentions Figma updates.
- **完整文档地图**：[`docs/INDEX.md`](docs/INDEX.md) — single-page map by "what you want to do".

## 文档同步纪律（**Strict — agent 必读**）

> 每次大版本迭代（在 `product_spec*.md` 追加一个新版本节，比如 v0.5.x → v0.6.0）必须在**同一个 commit** 里同步以下文档。文档与代码分离的 commit 是 **drift 的源头**，禁止。

**大版本变更后必更新清单：**

1. **`product_spec*.md` 自身** —— 顶部追加新版本节（不删历史）
2. **受影响的 `apps/*/README.md`** —— 末尾"版本日志"段加新版条目
3. **`AGENTS.md`** —— 如新增实体 / 服务 / 路由，更新「v0.5+ 增量」节或加新节
4. **`docs/INDEX.md`** —— 如新增 / 删除文档，更新对应行；总是更新 `last-reviewed` 日期
5. **`apps/server/README.md`** —— 如新增表 / 接口 / 环境变量
6. **`specs/openapi.yaml`** —— 如新增 / 改路径，跑 `npm run check:api-contract` 确认通过

**加新文档**：必须同时在 `docs/INDEX.md` 加一行。

**删旧文档**：先 `git grep -n '<filename>' -- '*.md'` 检查站内引用并改指真源；然后 `git rm`，依赖 git history 留底。
