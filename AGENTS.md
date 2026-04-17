# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Repository Overview

**AI Star Eco** — an AI virtual singer incubation and distribution platform with bilingual (Chinese/English) support. Three user roles: Fan（粉丝）, Producer（制作人）, Coach（掌门人/MCN）.

***

## Monorepo Structure

```
ai-singer/
├── apps/
│   ├── server/          # Backend: Spring Boot 3.3.5 (Java 17) — port 8080
│   ├── web/             # Frontend: Next.js 14 (TypeScript) — port 3000
│   └── admin/           # Admin console: planned independent Next.js app (not yet created)
├── specs/
│   ├── openapi.yaml                           # OpenAPI 3.1 — shared API contract
│   └── unified-account-entitlement-platform.md  # Full platform architecture spec
└── figma/                 # ⚠️ Figma prototype only — NOT real application code
    └── App.tsx          # Single-file Figma Make export for UI prototyping
```

> **IMPORTANT**: The `src/` directory at the repo root is a **Figma prototyping workspace** (exported by Figma Make). It is NOT part of the real application. `src/PRODUCT_SPEC.md` and `src/BACKEND_API_SPEC.md` contain product requirements and serve as reference, not implementation. All real code lives in `apps/`.

***

## apps/server — Spring Boot Backend

### Commands

```bash
cd apps/server
./mvnw spring-boot:run    # Start dev server on port 8080
./mvnw test               # Run tests
./mvnw package            # Build JAR
```

### Tech Stack

- **Spring Boot 3.3.5** + **Java 17**
- **Spring Data JPA** — ORM layer
- **H2 (file mode)** — dev/test database (`./data/aistareco.mv.db`). Must be replaced with PostgreSQL for production.
- **Lombok** — boilerplate reduction
- **Spring Boot Validation** — `@Valid` on request DTOs

### Package Structure

```
com.aistareco/
├── AiStarEcoApplication.java
├── common/
│   ├── ApiResponse.java          # Unified response wrapper: { data: T }
│   ├── ApiErrorBody.java         # Error payload: { code, message }
│   ├── BusinessException.java    # Domain-level checked exception
│   └── GlobalExceptionHandler.java
├── config/
│   └── CorsConfig.java           # CORS (currently open; restrict in prod)
├── controller/                   # REST controllers (one per domain)
│   ├── SingerController.java
│   ├── TrackController.java
│   ├── MarketplaceController.java
│   ├── DistributionController.java
│   ├── NftController.java
│   └── AnalyticsController.java
├── service/                      # Business logic
├── repository/                   # Spring Data JPA repositories
├── model/                        # JPA entities
│   ├── Singer.java
│   ├── Track.java
│   ├── MarketplaceListing.java
│   ├── NftCollection.java
│   └── ...
└── dto/                          # Request/response DTOs
```

### Response Convention

All endpoints return `ApiResponse<T>` (`{ "data": ... }`) on success, or `ApiErrorBody` (`{ "error": { "code": "...", "message": "..." } }`) on error. Match this in any new endpoints.

### Current Status

The backend currently has **no authentication**. All controllers are open. Authentication integration (Spring Security + JWT) is planned as Phase 1 of the unified account platform.

### Planned Additions (Phase 1 — authentication platform)

```xml
spring-boot-starter-security
spring-security-oauth2-resource-server   <!-- JWT Bearer verification -->
spring-security-oauth2-jose              <!-- JWT signing/parsing -->
postgresql                               <!-- production database driver -->
flyway-core                              <!-- DB migrations -->
spring-boot-starter-data-redis           <!-- nonce cache, rate limiting -->
```

New packages to be added:

- `identity/` — auth, token, OAuth
- `tenant/` — tenant, membership
- `authz/` — RBAC roles/permissions
- `entitlement/` — plans, features, subscriptions
- `credit/` — wallet, ledger, metering
- `audit/` — audit log (AOP-based)

***

## apps/web — Next.js Frontend

### Commands

```bash
cd apps/web
npm install
npm run dev           # Dev server on port 3000
npm run build         # Production build
npm run test          # Vitest unit tests
npm run codegen       # Generate TypeScript types from specs/openapi.yaml
```

### Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Radix UI primitives in `src/components/ui/`)
- **Recharts** — charts and data visualizations
- **Lucide React** — icons
- **Motion (Framer Motion)** — animations
- **Vitest** — unit testing (`src/lib/http/fetcher.test.ts`)
- **openapi-typescript** — generates `src/api/generated/schema.ts` from `specs/openapi.yaml`

### Directory Structure

```
apps/web/src/
├── app/
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page
│   ├── portal/               # Role selection page (fan / producer / coach)
│   ├── fan/                  # Fan view
│   ├── producer-intro/       # Producer onboarding
│   ├── producer/             # Producer dashboard (requires layout.tsx shell)
│   │   ├── layout.tsx        # Producer shell with sidebar nav
│   │   ├── overview/         # Dashboard overview
│   │   ├── incubator/        # AI singer gallery
│   │   ├── editor/           # Singer editor
│   │   ├── studio/           # Music generation
│   │   ├── distribution/     # Music publishing
│   │   ├── mint/             # NFT minting
│   │   ├── earnings/         # Revenue & transactions
│   │   └── community/        # Community / charts
│   ├── coach/                # Coach (MCN) dashboard
│   └── api/                  # Next.js Route Handlers (BFF layer — currently returns mock data)
│       ├── singers/          # POST /api/singers, GET /api/singers/my, etc.
│       ├── tracks/
│       ├── marketplace/
│       ├── nft/
│       ├── distribution/
│       └── analytics/
├── api/                      # Typed API client functions (call route handlers)
│   ├── singers.ts
│   ├── tracks.ts
│   └── ...
├── components/
│   ├── ui/                   # shadcn/ui primitives — do NOT modify directly
│   ├── AIIncubator.tsx       # Singer gallery
│   ├── SingerEditor.tsx      # Singer creation/edit (6-tab tool)
│   ├── ArtistSigningDialog.tsx
│   ├── ArtistDetailDialog.tsx
│   ├── ArtistListingDialog.tsx
│   ├── DistributionPage.tsx
│   ├── MusicGenerationDialog.tsx
│   ├── NFTMintingDialog.tsx
│   ├── ThemeProvider.tsx     # Custom theme context (6 themes)
│   └── GlobalAudioPlayer.tsx
├── features/                 # Domain-scoped hooks and providers
│   ├── producer/
│   │   ├── hooks/use-producer-workspace.ts
│   │   └── providers/producer-workspace-provider.tsx
│   ├── singers/hooks/use-singers.ts
│   ├── tracks/hooks/use-tracks.ts
│   ├── marketplace/hooks/
│   ├── nft/hooks/
│   ├── analytics/hooks/
│   └── shared/
│       ├── components/page-feedback.tsx  # LoadingPanel, ErrorPanel
│       └── hooks/use-dictionary.ts       # i18n (zh/en)
├── lib/
│   └── http/fetcher.ts       # Base HTTP client — wraps fetch, parses { data } envelope
├── mocks/                    # MSW-style mock resolvers (used by route handlers in dev)
│   ├── singers/{factory,fixtures,resolver}.ts
│   ├── tracks/
│   └── ...
├── providers/
│   ├── app-providers.tsx     # Root providers tree
│   └── app-preferences-provider.tsx
├── types/
│   ├── app.ts                # UI-only types: Lang, RootView, ProducerPage
│   └── contracts/            # Domain types (generated or hand-written from openapi)
│       ├── singers.ts
│       ├── tracks.ts
│       └── ...
└── views/                    # Top-level page view components (used by app/*/page.tsx)
    ├── HomePage.tsx
    ├── PortalPage.tsx
    ├── FanAppPage.tsx
    ├── ProducerIntroPage.tsx
    └── CoachDashboardPage.tsx
```

### BFF Layer (Route Handlers)

`app/api/**` are Next.js Route Handlers acting as a BFF (Backend-for-Frontend). They currently return mock data from `src/mocks/`. When authentication is implemented, they will proxy requests to `apps/server` with the user's JWT.

Current mock flow: `Page → feature hook → api/*.ts client → app/api/** route handler → mocks/*/resolver.ts`

Target flow (post-auth): `Page → feature hook → api/*.ts client → app/api/** route handler → apps/server (Spring Boot) with Bearer JWT`

### Theme System

Six themes defined in `ThemeProvider.tsx`: `cyberpunk`, `glassmorphism`, `gradient`, `neumorphism`, `terminal`, `minimal`. Use `useTheme()` hook. UI is predominantly **dark** — CSS custom properties drive color tokens.

### i18n

`useDictionary()` hook provides `copy` object with all UI strings in `zh` (default) and `en`. Dictionary source is in `mocks/i18n/dictionary.ts`. Both keys must be updated together when adding new strings.

### Current Status

All data is **mocked** — no real API calls to `apps/server` yet. Authentication is not implemented. Route Handlers return fixture data.

***

## specs/openapi.yaml — API Contract

Shared OpenAPI 3.1 spec. **This is the source of truth for API shapes.**

- Backend: `apps/server` (eventually validated via `springdoc-openapi`)
- Frontend: run `npm run codegen` in `apps/web` to regenerate `src/api/generated/schema.ts`

When adding new endpoints, always update `openapi.yaml` first, then regenerate types.

***

## apps/admin — Admin Console (Planned)

An independent Next.js application for platform operators. **Not yet created.**

Key decisions:

- **Separate from** **`apps/web`** — different bundle, can be deployed to internal network / behind VPN
- **Reuses** **`apps/server`** **backend** — same Spring Boot, same `/api/admin/**` endpoints, different JWT role requirement (`platform_operator` or above)
- **UI style**: lighter/data-dense UI suitable for admin operations (vs the dark cyberpunk theme of apps/web)

Planned route structure: `/admin` (dashboard), `/admin/users`, `/admin/tenants`, `/admin/plans`, `/admin/credits/adjust`, `/admin/licenses`, `/admin/audit`, `/admin/risk`

See `specs/unified-account-entitlement-platform.md` Appendix B for full Admin Console page-by-page design spec.

***

## Platform Architecture (Unified Account & Entitlement)

Full spec: `specs/unified-account-entitlement-platform.md`

### Three-Phase Roadmap

**Phase 1 (current) — Core flow:**

1. Account registration (email + Google OAuth + WeChat OAuth)
2. Create virtual AI singer (with ownership binding + quota enforcement)
3. Generate music / MV video (with credit pre-deduction + settlement)
4. Public distribution (platform-internal publish)

**Phase 2 — Copyright & channels:**

- DistroKid / Tencent Music / NetEase Music OAuth binding (business layer, NOT auth center)
- ISRC copyright registration
- Revenue flow, MCN Coach-trainee system

**Phase 3 — NFT & Web3:**

- MetaMask / WalletConnect login (EIP-4361 signature auth)
- NFT minting (ERC-721/ERC-1155)
- Fan DAO governance

### User Roles

| Role       | Chinese | Access                                                 |
| ---------- | ------- | ------------------------------------------------------ |
| `fan`      | 星际听众    | Music discovery, charts, NFT badge market              |
| `producer` | 造梦架构师   | Full dashboard — singer creation, studio, distribution |
| `coach`    | 生态领航员   | MCN management backend, trainee oversight              |

### Plans & Credit Limits

| Feature               | free          | pro            | enterprise     |
| --------------------- | ------------- | -------------- | -------------- |
| AI singers            | ≤ 3           | ≤ 20           | unlimited      |
| Music generation      | 5 credits/day | 50 credits/day | unlimited      |
| NFT minting           | —             | ≤ 10/month     | unlimited      |
| Distribution channels | domestic only | all            | all + priority |
| Market signing        | —             | —              | ✅              |

Credit costs: music generation = 5 credits/task; registration grants 100 gift credits.

### Key Domain Entities (planned, not yet implemented)

```
User → Membership → Tenant → Entitlement
                           → Wallet → LedgerEntry (immutable ledger)
Plan → Feature (permission points)
LicenseBatch → LicenseKey → Activation
Meter + PriceRule → ConsumeOrder (pre-deduct → settle → refund on failure)
AuditLog (append-only)
```

### Admin Roles (platform operators)

`platform_owner` > `platform_operator` > `finance_admin` / `channel_manager`

***

## Key Conventions

- **API response envelope**: `{ "data": T }` for success; `{ "error": { "code": string, "message": string } }` for errors. Never return raw values.
- **No direct balance mutation**: All credit changes must go through `LedgerEntry` (immutable ledger). Never update a balance field directly.
- **Ownership checks**: Once auth is in place, every singer/track mutation must verify `ownerUserId == currentUser.id`.
- **OpenAPI first**: Define the endpoint in `specs/openapi.yaml` before implementing it, then run `npm run codegen` in `apps/web`.
- **Mock isolation**: Mocks in `apps/web/src/mocks/` are dev-only. Route Handlers (`app/api/`) proxy to mocks today, will proxy to Spring Boot after auth is wired.
- **No test runner in apps/server yet**: `apps/web` uses Vitest. `apps/server` has `spring-boot-starter-test` but no test files yet.

