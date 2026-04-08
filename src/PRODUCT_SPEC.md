# AI Star Eco — Product & Technical Specification Document
**Version**: 2.5.1  
**Document Type**: Product Requirements + Technical Architecture  
**Last Updated**: 2026-04-08  
**Status**: Phase 2 Complete / Phase 3 Planning  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [User Roles & Personas](#2-user-roles--personas)
3. [User Flows & Logic](#3-user-flows--logic)
4. [Functional Requirements](#4-functional-requirements)
5. [Technical Specifications](#5-technical-specifications)
6. [UI States & Component Behavior](#6-ui-states--component-behavior)
7. [Theme & Design System](#7-theme--design-system)
8. [Edge Cases & Constraints](#8-edge-cases--constraints)
9. [Phase Roadmap](#9-phase-roadmap)

---

## 1. Executive Summary

### Core Value Proposition

**AI Star Eco** is a full-stack, AIGC-powered virtual idol incubation and monetization operating system. It is positioned as the **world's first decentralized virtual artist incubation network**, merging:

- **AIGC Tooling** — AI-generated music, persona creation, image generation
- **Blockchain Ownership** — NFT badge minting, on-chain asset fingerprinting
- **Fan Economy** — voting, collectible markets, Fan DAO governance
- **Multi-Role Ecosystem** — three distinct workspaces for Fans, Producers, and MCN Coaches

### Primary User Problem Being Solved

Traditional music and virtual idol industries are **linear, closed, and gatekept** by large agencies. Independent creators lack:
1. A unified workspace to create, launch, and monetize AI-generated singers
2. Tools to build a fan economy around virtual artists without enterprise resources
3. A value-sharing network where fan engagement directly translates to producer revenue

AI Star Eco replaces this fragmented workflow with a **single, self-running economic platform** built around the Create → Distribute → Monetize loop.

---

## 2. User Roles & Personas

The application supports three distinct user portals, each with a dedicated workspace:

### 2.1 Fan (星际听众 / Galactic Listener)
- **Goal**: Discover AI music, vote on charts, collect limited NFT badges
- **Entry Point**: Landing page → "进入秀场 / Enter Show"
- **Key Actions**: Browse charts, vote for tracks, mint/collect badges, discover new artists
- **Monetization Involvement**: Passive — purchases badges/merch, participates in Fan DAO

### 2.2 Producer / Maker (造梦架构师 / Dream Architect)
- **Goal**: Incubate AI singers from scratch, produce music, distribute globally, monetize
- **Entry Point**: Landing page → "开始创作 / Start Creating" → Full Dashboard
- **Key Actions**: Create AI singer personas, generate music tracks, distribute to DSPs, mint NFT collections, manage earnings
- **Monetization**: Active — earns streaming royalties, NFT sales, fan tips

### 2.3 MCN Coach (生态领航员 / Ecosystem Navigator)
- **Goal**: Manage a squad of producers/trainees, monitor KPIs, distribute tasks, earn ecosystem dividends
- **Entry Point**: Landing page → "管理后台 / Coach Hub" → Coach Dashboard
- **Key Actions**: Monitor trainee progress, approve/reject submissions, message producers, review analytics
- **Monetization**: Residual — earns a % cut from trainee success

---

## 3. User Flows & Logic

### 3.1 Landing Page → Role Selection
```
Landing Page (Home)
├── Nav: Features | Showcase | Workflow | About | Enter Console
├── Hero Section (Particle Background, Mouse Parallax)
├── Workflow Section (Create → Distribute → Monetize)
├── Features Section (SaaS Workspace | On-Chain Assets | Fan DAO)
└── Portal Selection Cards
    ├── Fan Portal → FanApp View
    ├── Producer Portal → ProducerApp View (active: 'dashboard')
    └── Coach Portal → CoachApp View
```

### 3.2 Producer Main Flow
```
ProducerApp
├── Sidebar Navigation (persistent)
│   ├── 经纪大盘 → OverviewSection (default)
│   ├── MCN与孵化 → MCN Section (locked unless unlocked)
│   ├── AI歌手孵化 → AIIncubator Component
│   ├── 创作与确权 → Persona Engine (inline)
│   ├── 音乐与MV工坊 → AI Studio (11 generation modes)
│   ├── 版权与链上资产 → NFT Minting Section
│   ├── 发行与运营 → DistributionPage Component
│   ├── 全网矩阵分发 → DistributionPage (Matrix view)
│   ├── 粉丝社群 → Community (locked)
│   └── 商业变现 → Earnings/Finance Section
└── Main Content Area (context-sensitive)
```

### 3.3 AI Singer Incubation Flow (Core Flow)
```
AIIncubator (Main Gallery)
├── View existing singer cards (gallery grid)
├── Search & Filter (by status: all/active/draft/archived)
├── "Create New Singer" → creates draft Singer → navigates to SingerEditor
└── "Edit" on existing card → SingerEditor

SingerEditor (6-Tab Workspace)
├── Tab 1: 官方IP库 (Official IP Gallery)
│   └── Select preset IP → applies name, avatar, style, tags, persona params
├── Tab 2: 参数调节 (Parameter Tuner)
│   ├── Quick Presets (甜美少女 / 冷酷女王 / 活力青春 / 神秘精灵)
│   ├── Core Parameters: Sweetness / Energy / Mystery (0–100 sliders)
│   └── Basic Info: Name, Style (text inputs)
├── Tab 3: 基因混合 (Genetic Lab)
│   └── [Planned] Select two parent singers → mix ratio → generate offspring
├── Tab 4: 图片定制 (Image Upload)
│   └── [Planned] Upload reference image → AI generates singer from image
├── Tab 5: 服装换装 (WardrobeSystem)
│   ├── Category filter: All / Top / Bottom / Accessory / Shoes / Hair
│   ├── Search across clothing library (200+ items)
│   ├── Rarity system: Common / Rare / Epic / Legendary
│   ├── Equip/Unequip items per slot
│   ├── Favorites management
│   ├── Random Outfit generator
│   ├── Save Outfit as named preset
│   └── Live preview panel (singer + equipped items)
└── Tab 6: 姿态动作 (PoseLibrary)
    ├── Sub-Tab: 姿态库 (Pose Library)
    │   ├── Categories: Standing / Sitting / Dancing / Singing / Action
    │   ├── 16 poses (some locked), difficulty: Easy / Medium / Hard
    │   └── Select pose → preview → "Apply Pose"
    ├── Sub-Tab: 表情 (Expressions)
    │   ├── 12 expressions across 5 categories
    │   ├── Intensity slider (0–100)
    │   └── "Apply Expression"
    └── Sub-Tab: 手势 (Gestures)
        ├── 8 hand gestures (emoji-based)
        └── "Apply Gesture"
```

### 3.4 Music Production Flow
```
AI Studio (11 Generation Modes)
├── Text Mode: prompt + style → generate
├── Melody Mode: upload melody audio + style description
├── Advanced Mode: structure + BPM + key + style
├── Interactive Mode: conversational AI music dialogue
├── Lyrics2Song: paste lyrics → generate track
├── Inspiration Mode: freeform idea → AI interprets
├── Image2Song: upload image → AI generates soundtrack
├── Remix Hit: original song reference → transform style
├── Fun Modes: theme + core phrase → quirky generation
├── Acrostic: hidden word + topic → acrostic song
└── Gift a Song: To / Occasion / Message → personalized track

Generation States: input → generating (with progress stages) → preview → success
Stages: Analyzing → Composing → Arranging → Mastering → Finalizing
```

### 3.5 NFT Minting Flow
```
NFTMintingDialog
├── Step 1: config — Name, Supply, Price (ETH), Royalty %, Rarity, Airdrop toggle
├── Step 2: wallet — Connect wallet (MetaMask / WalletConnect / Coinbase)
├── Step 3: minting — Progress bar with blockchain confirmations
└── Step 4: success — View on Explorer, Share, Download certificate
```

### 3.6 Music Distribution Flow
```
DistributionPage
├── Track Selection (from generated songs library)
├── Channel Selection (multi-select)
│   ├── 国内AI专属通道 (Tencent Music / NetEase)
│   ├── 全球流媒体发行 (DistroKid / TuneCore)
│   ├── 短视频平台矩阵 (Douyin / TikTok)
│   └── YouTube Music 专区
├── Account Binding Status (per required platform)
├── Release Scheduling (date + time picker, pre-save toggle)
└── Publish → multi-platform distribution trigger
```

### 3.7 Artist Signing Flow (MCN / Marketplace)
```
ArtistListingDialog → Browse marketplace singers
└── ArtistSigningDialog
    ├── Step 1: details — Artist info (style, works, followers, creator)
    ├── Step 2: contract — Terms review, checkbox agreement
    │   └── Revenue split: 70% operator / 30% original creator
    ├── Step 3: payment — Signing fee confirmation
    └── Step 4: success — Signed artist added to producer roster
```

### 3.8 Coach Dashboard Flow
```
CoachApp
├── Header: Region (APAC Node) + Eco Total Value
├── Squad Monitor
│   ├── KPI cards: New Songs (week) / Success Rate / Pending Reviews
│   ├── Producer table: Name / Status / Weekly Progress / Revenue / Actions
│   └── Row actions: View Profile / Send Task
├── Producer Detail Panel (slide-in)
│   ├── Profile tab: avatar, stats, skills radar chart
│   ├── Latest Submission: track info + Approve / Reject actions
│   └── Message button
└── Sidebar: Command Center / Trainees / Messages / Settings / Logout
```

### 3.9 Fan Portal Flow
```
FanApp
├── Bottom Nav: Discover / Charts / Market / Me
├── Discover Tab: "You Might Like" artist cards
├── Charts Tab (星际金曲榜 / Star Charts)
│   ├── Ranked track list (rank, title, artist, votes, trend indicator)
│   └── Vote button per track (triggers vote counter)
├── Market Tab (限量勋章市场 / Badge Market)
│   ├── NFT badge grid (remaining supply, price, mint button)
│   └── Mint CTA → MintingDialog or connected flow
└── Me Tab: User profile, owned badges, listening history
```

---

## 4. Functional Requirements

### 4.1 Global / Cross-Cutting

| ID | Feature | Description |
|----|---------|-------------|
| G-01 | Bilingual Support | Full zh/en toggle via `Lang` type; all UI text driven by `TRANSLATIONS` object |
| G-02 | Theme Switching | 6 design themes switchable at runtime: Cyberpunk, Glassmorphism, Gradient, Neumorphism, Terminal, Minimal |
| G-03 | Particle Background | Canvas-based particle system with cyan dots and purple connecting lines |
| G-04 | Motion Animations | All major transitions use `motion/react` (AnimatePresence, spring, scroll transforms) |
| G-05 | Global Audio Player | Persistent bottom player: play/pause, skip, seek, volume, mute, repeat, shuffle, visualizer |
| G-06 | Onboarding Guide | First-launch modal with step-by-step feature walkthrough |
| G-07 | Toast Notifications | Success/error/info toasts via custom `ToastNotification` component |
| G-08 | Responsive Layout | Mobile-first grid layouts; sidebar collapses on mobile |

### 4.2 Landing Page

| ID | Feature | Description |
|----|---------|-------------|
| LP-01 | Sticky Nav | Logo + nav links + lang toggle + "Enter Console" CTA |
| LP-02 | Mouse Parallax Hero | Title block moves with mouse cursor via `useMotionValue` |
| LP-03 | Hero Stats | Live counters: 50k+ Creators, 1.2M+ Songs |
| LP-04 | Workflow Section | 3-step loop (Create / Distribute / Monetize) with animated step cards |
| LP-05 | Features Section | 3 feature cards (Super-SaaS / On-Chain / Fan DAO) |
| LP-06 | Role Portal Section | 3 entry cards (Fan / Maker / Coach) each with dedicated CTA |

### 4.3 Producer Dashboard

| ID | Module | Key Inputs | Key Actions |
|----|--------|-----------|-------------|
| PD-01 | Overview / Dashboard | — | View eco value, royalty, badge holders, streams, fans; Recharts bar/area chart; AI task suggestions |
| PD-02 | AI Singer Incubator | Search query, status filter | Create, Edit, Delete, Archive singers; navigate to SingerEditor |
| PD-03 | Singer Editor — Official IP | IP card selection | Apply preset name/avatar/style/tags/params |
| PD-04 | Singer Editor — Parameters | Sweetness/Energy/Mystery sliders (0–100), Name, Style inputs | Apply quick preset, manual tune, save |
| PD-05 | Singer Editor — Genetic Lab | Parent A, Parent B selection, mix ratio slider | Generate offspring (Phase 3) |
| PD-06 | Singer Editor — Image Upload | Image file upload | AI image-to-persona generation (Phase 3) |
| PD-07 | Singer Editor — Wardrobe | Category filter, search, clothing card selection | Equip/unequip per slot, favorite, random outfit, save outfit, export |
| PD-08 | Singer Editor — Poses | Pose category filter, pose card selection, expression emoji, intensity slider, gesture | Apply pose/expression/gesture combo, preview, save |
| PD-09 | AI Studio | 11 mode tabs; per-mode form fields (prompt, style, BPM, key, lyrics, image, etc.) | Generate track (costs 5 credits), preview in audio player, add to library |
| PD-10 | NFT Minting | Collection name, supply, ETH price, royalty %, rarity, airdrop toggle | Connect wallet, mint, view on explorer |
| PD-11 | Distribution | Track selection, channel multi-select, account binding, release date/time, pre-save | Publish to selected platforms |
| PD-12 | Finance / Earnings | — | View balance, revenue breakdown (streaming/NFT/tips), transaction history, withdraw |
| PD-13 | NLE Editor | Audio/Video mode toggle | Play/pause, split, delete track segments, edit lyrics, drag FX, export |
| PD-14 | MCN Section | Artist listing | Sign artists, view detail, manage roster (locked for non-enterprise) |
| PD-15 | Community | — | Fan messaging (locked for non-enterprise) |

### 4.4 MCN Coach Dashboard

| ID | Feature | Description |
|----|---------|-------------|
| C-01 | Squad Monitor | Real-time table of producers with status, progress bar, revenue |
| C-02 | KPI Summary | Weekly new songs, success rate %, pending reviews count |
| C-03 | Producer Detail Panel | Profile + latest submission + approve/reject + skills radar |
| C-04 | Task Distribution | Issue tasks to individual producers |
| C-05 | Message | Direct messaging CTA to producer |
| C-06 | Ecosystem Value Header | Aggregate eco value display, region node label |

### 4.5 Fan Portal

| ID | Feature | Description |
|----|---------|-------------|
| F-01 | Music Charts | Ranked list with vote count, trend indicator (up/down/same), vote action |
| F-02 | Badge Market | NFT card grid with remaining supply, price, mint CTA |
| F-03 | Discovery Feed | "You Might Like" curated artist cards |
| F-04 | Profile / Me | User badge inventory, listening history |

---

## 5. Technical Specifications

### 5.1 Technology Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 + TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | Motion/React (formerly Framer Motion) |
| Charts | Recharts (BarChart, AreaChart) |
| Icons | Lucide-React |
| UI Components | Custom shadcn/ui-style component library (`/components/ui/`) |
| Routing | State-based view switching (no React Router; single SPA) |
| Backend | Supabase (Hono server on Deno, KV store) |
| Audio | Native HTML5 `<audio>` API |
| Canvas | Native Canvas API (particle background) |

### 5.2 Application Architecture

```
App.tsx (Root)
├── ThemeProvider (Context)
├── Home (Landing Page)  [view = 'home']
├── ProducerApp           [view = 'producer']
│   ├── Sidebar (persistent)
│   ├── OverviewSection
│   ├── AIIncubator → SingerEditor
│   │   ├── WardrobeSystem
│   │   └── PoseLibrary
│   ├── PersonaSection (Inline)
│   ├── StudioSection (11 modes)
│   ├── MintSection
│   ├── EditorSection (NLE)
│   ├── DistributionPage
│   ├── FinanceSection
│   └── LockedSection
├── FanApp                [view = 'fan']
├── CoachApp              [view = 'coach']
├── GlobalAudioPlayer (floating, persistent)
├── MusicGenerationDialog (modal)
├── NFTMintingDialog (modal)
├── ArtistSigningDialog (modal)
├── ArtistDetailDialog (modal)
├── ArtistListingDialog (modal)
├── OnboardingGuide (modal)
├── ThemeSwitcher (floating)
└── ThemeShowcase (modal)
```

### 5.3 Core Data Entities

#### Singer (AI歌手)
```typescript
interface Singer {
  id: string;                          // UUID / timestamp string
  name: string;                        // Display name (bilingual)
  avatar: string;                      // Image URL
  style: string;                       // Music genre label
  status: 'active' | 'draft' | 'archived';
  quality: 'common' | 'rare' | 'epic' | 'legendary';
  createdAt: Date;
  stats: {
    songs: number;                     // Total tracks produced
    fans: number;                      // Total fan count
    popularity: number;                // 0–100 popularity score
  };
  tags: string[];                      // Searchable taxonomy
}
```

#### PersonaParams (人格参数)
```typescript
interface PersonaParams {
  sweetness: number;   // 0–100; drives LLM persona sweetness dimension
  energy: number;      // 0–100; drives LLM persona energy dimension
  mystery: number;     // 0–100; drives LLM persona mystery dimension
}
```

#### ClothingItem (服装单品)
```typescript
interface ClothingItem {
  id: string;
  name: string;
  category: 'top' | 'bottom' | 'accessory' | 'shoes' | 'hair' | 'outfit';
  imageUrl: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  price: number;                       // Virtual currency price
  tags: string[];
  isLocked?: boolean;                  // Requires upgrade to unlock
  isNew?: boolean;                     // NEW badge indicator
  isTrending?: boolean;                // HOT badge indicator
}
```

#### Pose (姿态)
```typescript
interface Pose {
  id: string;
  name: string;
  category: 'standing' | 'sitting' | 'dancing' | 'singing' | 'action';
  thumbnail: string;
  difficulty: 'easy' | 'medium' | 'hard';
  isLocked?: boolean;
  isNew?: boolean;
  animation?: string;                  // Reserved for future animation data
}
```

#### Expression (表情)
```typescript
interface Expression {
  id: string;
  name: string;
  emoji: string;
  intensity: number;                   // 0–100 blend strength
  category: 'happy' | 'sad' | 'cool' | 'surprised' | 'other';
}
```

#### Song / Track
```typescript
interface Song {
  id: string;
  title: string;
  date: string;                        // ISO date string
  status: 'Published' | 'Draft' | 'Processing';
  plays?: string;                      // Display string (e.g., "12.4K")
  audioUrl?: string;                   // Actual audio file URL
}
```

#### Artist (Marketplace Listing)
```typescript
interface Artist {
  id: number;
  name: string;
  style: string;
  avatar: string;
  price: string;                       // Signing fee display string
  owner: string;                       // Original creator username
  songs: number;
  followers: string;                   // Display string (e.g., "58.2K")
}
```

#### Transaction
```typescript
interface Transaction {
  id: number;
  date: string;                        // ISO date
  desc: string;                        // Description
  amount: string;                      // Display string (e.g., "+ ¥12,450.00")
  status: 'Completed' | 'Processing' | 'Failed';
}
```

#### Distribution Channel
```typescript
interface ChannelConfig {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;                      // Tailwind gradient class
  requiredAccounts: string[];          // Account IDs that must be connected
  benefits: string[];                  // zh benefit list
  benefitsEn: string[];               // en benefit list
}
```

### 5.4 State Management

State is managed entirely via React `useState` hooks at the `App.tsx` level, with prop drilling down to child components. No external state management library (e.g., Zustand, Redux) is currently used.

**Root-level state in `App.tsx`:**
```typescript
const [view, setView] = useState<'home' | 'fan' | 'producer' | 'coach'>('home');
const [lang, setLang] = useState<'zh' | 'en'>('zh');
const [activeSection, setActiveSection] = useState<string>('dashboard');
const [activeSinger, setActiveSinger] = useState<Singer | null>(MOCK_SINGERS[0]);
const [personaParams, setPersonaParams] = useState<PersonaParams>({
  sweetness: 70, energy: 80, mystery: 50
});
const [isPlaying, setIsPlaying] = useState(false);
const [currentSong, setCurrentSong] = useState<Song | null>(null);
const [generatedSongs, setGeneratedSongs] = useState<Song[]>([]);
const [showMusicDialog, setShowMusicDialog] = useState(false);
const [showNFTDialog, setShowNFTDialog] = useState(false);
const [showSigningDialog, setShowSigningDialog] = useState(false);
// ... additional dialog/modal state
```

**Theme state** is managed by `ThemeProvider` context, surfaced via `useTheme()` hook.

### 5.5 Business Logic & Calculation Rules

#### Rarity System (Quality Tiers)
| Tier | Visual | Star Count | Glow Color | Unlock |
|------|--------|-----------|-----------|--------|
| Common | Gray | 2 stars | None | Free |
| Rare | Blue | 3 stars | Blue glow | Free |
| Epic | Purple | 4 stars | Purple glow | Free |
| Legendary | Gold | 5 stars + Crown | Yellow glow + pulse | Free (some locked) |

#### Genetic Mixing Probability (Planned — Phase 3)
```
Rarity Outcome Probabilities:
Common = 60%
Rare   = 30%
Epic   = 9%
Legendary = 1%
Mutation events (5% random chance) can bump rarity by one tier.
Mutations: holographic_effect | dual_tone_hair | heterochromia | cybernetic_implant | elemental_aura
```

#### Music Generation Credit System
- Each generation action **costs 5 credits**
- Credits are consumed at time of "Generate" button press
- No credit refund on generation failure in current implementation (mock)
- Credit balance tracked per-session (not persisted to backend in Phase 2)

#### Revenue Distribution (Artist Signing)
```
Signed Artist Revenue Split:
- Operator (buyer/MCN): 70%
- Original Creator: 30%
- Platform fee: not specified (to be defined in Phase 3 commercial model)
```

#### NFT Royalty Logic
- Creator sets royalty % (configurable at mint time)
- Royalty applies to **secondary market** trades only
- Primary sale revenue goes 100% to minting producer
- Rarity affects display and perceived value but not economic formula directly

#### Distribution Platform Incentives (Domestic)
- Play incentives: approximately ¥30–80 per 10,000 streams (platform estimate)
- AI-created tag auto-applied for Tencent / NetEase channels
- Global DSPs (via DistroKid): standard industry royalty rates apply

#### Popularity Score Calculation (Mock)
```
Currently: static mock value (0–100)
Planned: popularity = weighted_average(
  plays_rank * 0.4 +
  fan_growth_rate * 0.3 +
  badge_sales_velocity * 0.2 +
  social_mentions * 0.1
)
```

### 5.6 API Endpoints (Backend — Supabase / Hono)

Current backend implementation is minimal. The Hono server (`/supabase/functions/server/index.tsx`) exposes:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/make-server-62916cbc/health` | Health check, returns `{ status: "ok", version: "2.5.1" }` |

**Planned API Endpoints (Phase 3):**
```
POST   /api/singers              Create new AI singer
GET    /api/singers/my           Get authenticated user's singers
PUT    /api/singers/:id          Update singer data
DELETE /api/singers/:id          Archive/delete singer

POST   /api/tracks/generate      Trigger AI music generation
GET    /api/tracks/my            Get user's track library

POST   /api/nft/mint             Initiate NFT minting
GET    /api/nft/collections      Get user's NFT collections

POST   /api/distribution/publish Publish track to selected platforms

GET    /api/marketplace/listings Get community IP marketplace
POST   /api/marketplace/sign     Sign/purchase an artist

GET    /api/analytics/dashboard  Aggregate dashboard metrics
```

### 5.7 Supabase Database Schema (Planned)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  avatar_url VARCHAR(500),
  role ENUM('fan', 'producer', 'coach') DEFAULT 'producer',
  plan ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
  credits INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Singers
CREATE TABLE ai_singers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500),
  style VARCHAR(50),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'archived')),
  quality VARCHAR(20) DEFAULT 'common' CHECK (quality IN ('common', 'rare', 'epic', 'legendary')),
  parameters JSONB,       -- PersonaParams: sweetness, energy, mystery
  tags TEXT[],
  equipped_wardrobe JSONB, -- Current clothing slot state
  active_pose VARCHAR(50),
  active_expression VARCHAR(50),
  parent_a_id UUID REFERENCES ai_singers(id),
  parent_b_id UUID REFERENCES ai_singers(id),
  genetic_ratio INT,
  is_public BOOLEAN DEFAULT FALSE,
  songs_count INT DEFAULT 0,
  fans_count INT DEFAULT 0,
  popularity INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracks
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID REFERENCES users(id),
  singer_id UUID REFERENCES ai_singers(id),
  title VARCHAR(200) NOT NULL,
  audio_url VARCHAR(500),
  cover_url VARCHAR(500),
  generation_mode VARCHAR(50), -- 'text', 'melody', 'lyrics', 'image', etc.
  prompt TEXT,
  style VARCHAR(100),
  bpm INT,
  key VARCHAR(10),
  duration_sec INT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'published')),
  play_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NFT Collections
CREATE TABLE nft_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  track_id UUID REFERENCES tracks(id),
  name VARCHAR(100) NOT NULL,
  supply INT NOT NULL,
  price_eth DECIMAL(18, 8),
  royalty_pct INT CHECK (royalty_pct BETWEEN 0 AND 100),
  rarity VARCHAR(20),
  contract_address VARCHAR(66),
  minted_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50), -- 'royalty', 'nft_sale', 'tip', 'signing_fee', 'withdrawal', 'ai_credit'
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketplace Listings
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES users(id),
  singer_id UUID REFERENCES ai_singers(id),
  title VARCHAR(100),
  description TEXT,
  price DECIMAL(10, 2),
  license_type VARCHAR(20) CHECK (license_type IN ('exclusive', 'non-exclusive')),
  views INT DEFAULT 0,
  sales INT DEFAULT 0,
  rating DECIMAL(3, 2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'sold', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MCN Coach-Trainee Relationships
CREATE TABLE coach_trainees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES users(id),
  trainee_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'active',
  revenue_share_pct INT DEFAULT 10,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wardrobe Inventory
CREATE TABLE wardrobe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  item_id VARCHAR(50) NOT NULL,          -- Maps to ClothingItem.id
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  is_equipped BOOLEAN DEFAULT FALSE,
  equipped_on_singer UUID REFERENCES ai_singers(id)
);
```

---

## 6. UI States & Component Behavior

### 6.1 MusicGenerationDialog States

| State | UI Behavior |
|-------|-------------|
| `input` | Form visible; all input fields editable; "Generate" CTA active |
| `generating` | Progress bar animating; stage label updating (Analyzing → Composing → Arranging → Mastering → Finalizing); form hidden; cancel button available |
| `preview` | Generated track metadata displayed; audio player controls visible; "Use This Track" / "Regenerate" options |
| `success` | Confirmation animation; "Download", "Share", "Add to Library" CTAs; auto-close timer |

### 6.2 NFTMintingDialog States

| State | UI Behavior |
|-------|-------------|
| `config` | Configuration form; all fields editable; step indicator at 1/4 |
| `wallet` | Wallet selection grid (MetaMask / WalletConnect / Coinbase); connect button; "Connected" state |
| `minting` | Animated progress bar; blockchain confirmation messages; cannot be dismissed |
| `success` | Confetti/celebration animation; NFT preview card; "View on Explorer", "Share" CTAs |

### 6.3 ArtistSigningDialog States

| State | UI Behavior |
|-------|-------------|
| `details` | Artist card with stats; "Next Step" CTA enabled |
| `contract` | Scrollable contract terms; checkbox required before proceeding; "Agree & Continue" |
| `payment` | Price breakdown; "Confirm Payment" button; cancel available |
| `success` | Animation; "View Artist", "Close" CTAs; updates artist roster |

### 6.4 AIIncubator View States

| State | UI Behavior |
|-------|-------------|
| Gallery (default) | Singer card grid; search/filter bar; create CTA |
| Empty state | Centered Sparkles icon; "No Singers Found" message; "Create New" CTA |
| Editing | SingerEditor replaces gallery (no modal — full view swap) |
| Saving | Brief loading state on Save button; optimistic UI update |

### 6.5 WardrobeSystem States

| State | UI Behavior |
|-------|-------------|
| Default | All clothing visible; no items equipped |
| Item equipped | Card border highlighted; "Equipped" badge; slot in preview panel updated |
| Item locked | Lock icon overlay; click shows upgrade prompt |
| Favorites | Heart icon highlighted; items persisted in favorites array |
| Random outfit | All slots filled with random available items; preview updates |
| Outfit saved | Named outfit entry added to savedOutfits list |

### 6.6 Locked Module State

When a sidebar section requires enterprise plan:
- `LockedSection` component renders
- Lock icon + "模块未解锁 / Module Locked" heading
- "升级到企业版 / Upgrade to Enterprise" CTA
- "返回总览 / Return to Dashboard" link

### 6.7 Distribution Page Account States

| Account State | Visual |
|--------------|--------|
| Connected | Green checkmark + account email displayed |
| Not connected | Red/amber indicator + "Connect" button |
| Required but missing | Warning badge on channel card; publish blocked |

---

## 7. Theme & Design System

### 7.1 Available Themes

| Theme ID | Name (ZH) | Name (EN) | Design Signature |
|---------|-----------|-----------|-----------------|
| `cyberpunk` | 赛博朋克强化版 | Cyberpunk Enhanced | Neon glow + Scanlines + Glitch effects |
| `glassmorphism` | 玻璃态现代风 | Glassmorphism | Frosted glass + Background blur + Light layers |
| `gradient` | 渐变流体风格 | Gradient Fluid | Dynamic gradient + Fluid animation + Colorful halo |
| `neumorphism` | 新拟态风格 | Neumorphism | Soft shadows + Embossed surfaces + Elegant texture |
| `terminal` | 终端黑客风 | Terminal Hacker | Green-on-black + Monospace + CRT scanlines |
| `minimal` | 极简科技风 | Minimal Tech | Clean lines + High contrast + Information density |

### 7.2 Theme-Driven Sidebar Token Map

Each theme provides a sidebar config object:
```typescript
{
  bg: string;          // Background class
  itemBase: string;    // Default nav item style
  itemActive: string;  // Selected nav item style
  sectionTitle: string; // Section label color
  border: string;      // Border color class
  glow: string;        // Glow/shadow effect class
}
```

### 7.3 Core Color System (Cyberpunk — Default)

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `cyan-500` (#06b6d4) | Active states, CTAs, glow |
| Secondary | `purple-500` (#a855f7) | Accents, gradients |
| Accent | `pink-500` (#ec4899) | Destructive accents, special highlights |
| Background | `#0c0c0e` | Card/panel backgrounds |
| Surface | `rgba(255,255,255,0.05)` | Hover states |
| Border | `rgba(255,255,255,0.1)` | Dividers, card borders |

### 7.4 Typography Guidelines

- Headings: `font-black` (900 weight), tight tracking (`tracking-tighter`)
- Body: system font stack, `text-gray-400` for secondary text
- Monospace: Used in financial figures and code-like displays
- No custom font import (relies on system fonts + Tailwind defaults)

### 7.5 Animation Principles

| Element | Animation | Spec |
|---------|-----------|------|
| Page transitions | `AnimatePresence` fade + slide | duration: 300ms, ease: easeOut |
| Card hover | `whileHover: { scale: 1.02 }` | spring: stiffness 300 |
| Card tap | `whileTap: { scale: 0.98 }` | instant |
| List items | Staggered `opacity: 0 → 1, y: 20 → 0` | delay: index × 50ms |
| Progress bars | Spring-animated width | stiffness: 100, damping: 30 |
| Floating glows | CSS `animate-pulse` / `animate-ping` | native CSS |
| Mouse parallax | `useMotionValue` → `useSpring` → `style.x/y` | damping: 25 |

---

## 8. Edge Cases & Constraints

### 8.1 Data Validation Edge Cases

| Scenario | Current Handling | Recommended Handling |
|----------|-----------------|---------------------|
| Singer name empty on save | No validation; saves empty string | Required field validation; min 1 char |
| Singer name > 100 chars | No truncation | Max length constraint |
| Persona params set to 0 on all axes | Valid state; renders "flat" persona | Minimum floor of 1 per param or warning |
| Credit balance = 0, user attempts generation | No guard; mock succeeds | Block with upgrade CTA |
| Duplicate singer names | Allowed (IDs are unique) | Warn user if name collision detected |
| NFT supply set to 0 | No frontend validation | Min value: 1 |
| NFT royalty > 100% | No cap validation | Max: 100%, warn at >30% |
| Release date in the past | No validation | Prevent scheduling in the past |

### 8.2 API & Network Edge Cases

| Scenario | Current Handling | Recommended Handling |
|----------|-----------------|---------------------|
| AI music generation fails | Silent; no error state in mock | Show error toast; refund credit; offer retry |
| Generation times out (>60s) | Not handled (mock) | Timeout at 60s; notify user; add to retry queue |
| Distribution channel API down | Not handled | Per-channel status badge; partial publish with failure report |
| Wallet connection rejected | Not handled | Show rejection message; offer alternative wallets |
| NFT minting tx rejected on chain | Not handled | Parse tx error; show human-readable message |
| Image upload fails | Not handled | File size limit (max 10MB), format validation (JPG/PNG/WebP) |
| Audio file too large | Not handled | Limit to 50MB; support MP3/WAV/FLAC |

### 8.3 Permission & Access Constraints

| Feature | Free Tier | Pro Tier | Enterprise |
|---------|-----------|----------|-----------|
| AI Singer creation | Up to 3 | Up to 20 | Unlimited |
| Music generation | 5 credits/day | 50 credits/day | Unlimited |
| NFT minting | ❌ Locked | ✅ Up to 10/month | ✅ Unlimited |
| Distribution channels | Domestic only | All channels | All + Priority |
| Community module | ❌ Locked | ✅ | ✅ |
| MCN management | ❌ Locked | ❌ | ✅ |
| Genetic Lab | ❌ Locked | ✅ | ✅ |
| Legendary clothing items | ❌ Locked | Purchasable | Included |

### 8.4 State Persistence Gaps (Current Phase 2 Limitations)

- All state is **in-memory only** — page refresh resets all data
- Singer gallery reverts to 4 hardcoded mock singers on reload
- Generated tracks are not persisted after session
- Wardrobe equipped state not persisted per singer
- Persona params reset to defaults on singer switch

### 8.5 Concurrency & Race Conditions

| Scenario | Risk | Mitigation |
|----------|------|-----------|
| User rapidly creates multiple singers | Timestamp-based IDs could collide within 1ms | Use `crypto.randomUUID()` |
| Multiple track generations simultaneously | No queue; mock allows parallel | Server-side queue with concurrency limit per user |
| Rapid stat updates (votes) | UI vote count can desync from server | Optimistic update + server confirmation |
| Theme switch during animation | Visual artifacts possible | Wrap theme transitions in `AnimatePresence` |

### 8.6 Boundary Values

| Field | Min | Max | Notes |
|-------|-----|-----|-------|
| Persona params (sweetness/energy/mystery) | 0 | 100 | Integer steps |
| NFT supply | 1 | 10,000 | Recommended max: 1,000 for scarcity |
| NFT price (ETH) | 0.001 | 100 | Floor to prevent dust amounts |
| NFT royalty | 0 | 100 | Platform recommendation: 5–15% |
| BPM | 40 | 240 | Music production standard range |
| Track duration | 30s | 600s | 10 minutes max |
| Singer tags | 0 | 10 | Shown truncated to 3 in gallery |
| Clothing item price | 0 | 9,999 | Virtual currency, no real transaction |
| Expression intensity | 0 | 100 | Integer steps |

### 8.7 Accessibility Gaps

- Color-coded rarity system (gray/blue/purple/gold) has no non-color indicator for color-blind users → **Add text labels**
- Animated particle background has no `prefers-reduced-motion` media query → **Wrap in motion preference check**
- No keyboard navigation map for complex drag-drop editor
- Toast notifications have no ARIA live region announcement
- Some icon-only buttons (trash, eye, save) lack `aria-label`

### 8.8 IP & Legal Constraints

- AI-generated content must comply with platform content moderation policies for each DSP
- Genetic mixing of official IP templates may create licensing ambiguity if commercialized → Require explicit license agreement per IP template
- NFT contracts must be audited before mainnet deployment
- Airdrop feature in NFT minting may be subject to securities regulations in certain jurisdictions

---

## 9. Phase Roadmap

### Phase 1 — MVP (Complete ✅)
- Landing page + role portals
- Producer dashboard (10+ modules)
- Basic AI singer persona engine
- Mock music generation + library
- NFT minting mock flow
- Fan portal (charts, market)
- Coach portal (squad monitor)
- 6-theme design system

### Phase 2 — Enhancement (Complete ✅)
- AI Incubator Phase 2 architecture (AIIncubator.tsx + SingerEditor.tsx)
- WardrobeSystem (200+ items, 5 slots, rarity system)
- PoseLibrary (30+ poses, 12 expressions, 8 gestures)
- DistributionPage (multi-channel, account binding)
- MusicGenerationDialog (11 modes)
- NFTMintingDialog (4-step flow)
- ArtistSigningDialog + ArtistDetailDialog + ArtistListingDialog
- GlobalAudioPlayer
- OnboardingGuide

### Phase 3 — Advanced Ecosystem (Planned 📅)
| Feature | Priority | Complexity |
|---------|----------|-----------|
| Community IP Marketplace | ⭐⭐⭐⭐⭐ | High |
| Real AI Generation API Integration (Replicate/SDXL) | ⭐⭐⭐⭐⭐ | High |
| Genetic Mixing Algorithm (real feature) | ⭐⭐⭐⭐ | High |
| Supabase Data Persistence (all entities) | ⭐⭐⭐⭐⭐ | Medium |
| User Authentication (Supabase Auth) | ⭐⭐⭐⭐⭐ | Medium |
| AI Dialogue Generator (character persona chat) | ⭐⭐⭐⭐ | High |
| 3D Face Sculpting Tool | ⭐⭐⭐ | Very High |
| VRM Export (Unity/VRChat compatible) | ⭐⭐⭐ | Very High |
| Brand IP Collaboration System | ⭐⭐⭐⭐ | Medium |
| Fan DAO Governance Module | ⭐⭐⭐ | High |
| Real Blockchain Integration (EVM) | ⭐⭐⭐ | Very High |
| Zustand State Management Upgrade | ⭐⭐⭐⭐ | Low |
| React Router Integration (multi-page) | ⭐⭐⭐ | Medium |
| Unit + E2E Test Suite | ⭐⭐⭐⭐ | Medium |
| Performance: Virtual Scrolling for large libraries | ⭐⭐⭐ | Low |

### Phase 3 Technical Requirements

#### AI Image Generation Integration
```typescript
// Required environment variables
REPLICATE_API_TOKEN=<token>
OPENAI_API_KEY=<token>        // DALL-E 3 fallback

// Recommended model: stability-ai/sdxl or black-forest-labs/flux-schnell
// Prompt construction: concat(style_prefix, personaParams_to_text, quality_suffix)
```

#### Supabase Auth Integration
```typescript
// Auth providers to support:
// - Email/Password
// - Google OAuth (major user segment)
// - WeChat OAuth (China market critical path)
// - MetaMask wallet (Web3 users)
```

#### Real-Time Features (Phase 3)
```typescript
// Supabase Realtime subscriptions needed for:
// - Live fan vote updates on charts
// - Coach squad activity feed
// - NFT minting status updates
// - Track processing progress
```

---

## Appendix A: Mock Data Reference

### Mock Singers (App.tsx MOCK_SINGERS)
```
1. Neon V         — Cyberpunk   — Active
2. Luna Soft      — Lo-Fi Pop   — Dev
3. Project: Zero  — Rock        — Plan
```

### Mock Chart Tracks (CHART_DATA)
```
1. "Neon Rain"        — Neon V          — 12,450 votes — ↑
2. "Cyber Heartbeat"  — Project: Zero   — 10,890 votes — ↑
3. "Digital Tears"    — Luna Soft       —  9,800 votes — ↓
4. "Void Echo"        — Echo Bot        —  8,500 votes — →
5. "System Error"     — Glitch Gang     —  7,200 votes — ↑
```

### Mock Financial Data (TRANSACTIONS)
```
1. 2024-03-15  Royalty Payout - Feb 2024         +¥12,450.00  Completed
2. 2024-03-14  Mint Revenue - Genesis Badge       +¥8,920.00   Completed
3. 2024-03-12  AI Service Fee (Suno API)           -¥200.00    Completed
4. 2024-03-10  Withdrawal to Wallet (0x8...2a)    -¥5,000.00   Processing
```

---

## Appendix B: Component File Map

| File | Purpose | Lines (approx.) |
|------|---------|----------------|
| `/App.tsx` | Root component, all views, translations, mock data | 2500+ |
| `/components/AIIncubator.tsx` | Singer gallery, search/filter, create/delete | 415 |
| `/components/SingerEditor.tsx` | 6-tab singer editor | 365 |
| `/components/WardrobeSystem.tsx` | Clothing library + equip system | 800+ |
| `/components/PoseLibrary.tsx` | Pose/expression/gesture library | 700+ |
| `/components/DistributionPage.tsx` | Multi-channel distribution UI | 400+ |
| `/components/MusicGenerationDialog.tsx` | 11-mode music generation modal | 300+ |
| `/components/NFTMintingDialog.tsx` | 4-step NFT minting modal | 300+ |
| `/components/ArtistSigningDialog.tsx` | 4-step artist signing modal | 250+ |
| `/components/ArtistDetailDialog.tsx` | Artist analytics modal | 200+ |
| `/components/ArtistListingDialog.tsx` | Marketplace browse modal | 200+ |
| `/components/GlobalAudioPlayer.tsx` | Floating audio player | 200+ |
| `/components/OnboardingGuide.tsx` | First-launch walkthrough | 150+ |
| `/components/ThemeProvider.tsx` | Theme context + 6 theme configs | 150+ |
| `/components/ThemeSwitcher.tsx` | Floating theme switcher UI | 100+ |
| `/components/ThemeShowcase.tsx` | Theme preview modal | 100+ |
| `/supabase/functions/server/index.tsx` | Hono API server (Deno) | 30 |

---

*End of Document — AI Star Eco Product & Technical Specification v2.5.1*
