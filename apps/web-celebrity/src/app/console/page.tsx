import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  Chip,
  GradientBlock,
  KpiCard,
  Tabs,
} from "@/components/creator";
import { CelebrityMarketHero } from "@/components/celebrity-zone/CelebrityMarketHero";
import { CelebrityMarket } from "@/components/celebrity-zone/CelebrityMarket";
import { CelebrityMyProjects } from "@/components/celebrity-zone/CelebrityMyProjects";
import { CelebrityVideoLibrary } from "@/components/celebrity-zone/CelebrityVideoLibrary";
import { CelebrityDataCenter } from "@/components/celebrity-zone/CelebrityDataCenter";
import { CelebrityProductLibrary } from "@/components/celebrity-zone/CelebrityProductLibrary";
import {
  MARKET_STARS,
  CELEBRITY_PROJECTS,
  PROJECT_VIDEOS_MAP,
  ZONE_OVERVIEW,
} from "@/mocks/celebrity-zone";
import type { ZoneTabId } from "@/constants/celebrity-zone-ui";

interface PageProps {
  searchParams?: Promise<{ tab?: string }>;
}

function resolveTab(raw?: string): ZoneTabId | "overview" | "cast" {
  if (raw === "market" || raw === "projects" || raw === "library" || raw === "data" || raw === "products" || raw === "cast")
    return raw;
  return "overview";
}

export default async function CelebrityConsolePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const active = resolveTab(sp.tab);

  if (active === "overview" || active === "cast") {
    return <OverviewView highlightCast={active === "cast"} />;
  }

  const allVideos = Object.values(PROJECT_VIDEOS_MAP).flat();
  return (
    <div className="flex flex-col gap-6">
      {active === "market" && (
        <div className="flex flex-col gap-6">
          <CelebrityMarketHero
            totalPlays={ZONE_OVERVIEW.hero.totalPlays}
            totalConversions={ZONE_OVERVIEW.hero.totalConversions}
            activeStars={ZONE_OVERVIEW.hero.activeStars}
          />
          <CelebrityMarket stars={MARKET_STARS} />
        </div>
      )}

      {active === "projects" && (
        <CelebrityMyProjects initialProjects={CELEBRITY_PROJECTS} stars={MARKET_STARS} />
      )}

      {active === "products" && <CelebrityProductLibrary />}

      {active === "library" && (
        <CelebrityVideoLibrary videos={allVideos} stars={MARKET_STARS} projects={CELEBRITY_PROJECTS} />
      )}

      {active === "data" && <CelebrityDataCenter overview={ZONE_OVERVIEW} />}
    </div>
  );
}

// ─── 总览页（仿参考图 Dashboard · AI Short Drama） ──────────────────────────

const DATE_LINE = "WEDNESDAY · MAY 14";

const KPIS = [
  { label: "Series in flight", value: "6", delta: "+1 this week", gradient: "violet" as const },
  { label: "Scenes rendered · 7d", value: "142", delta: "+38% pace", gradient: "peach" as const },
  { label: "Views · 7d", value: "12.8M", delta: "top: 暮色未央", gradient: "rose" as const },
  { label: "Cast ready", value: "14 / 18", delta: "4 in training", gradient: "teal" as const },
];

interface ProjectCardData {
  id: string;
  title: string;
  ep: string;
  status: "filming" | "rendering" | "scripting" | "draft" | "editing" | "published";
}

const ACTIVE_SERIES: ProjectCardData[] = [
  { id: "暮色未央",    title: "暮色未央",       ep: "EP 09 · today",  status: "filming" },
  { id: "盛夏来信",    title: "盛夏来信",       ep: "EP 12 · fri",    status: "rendering" },
  { id: "夏夜协议",    title: "夏夜协议",       ep: "EP 05 · F1",     status: "scripting" },
  { id: "都市灰阶",    title: "都市灰阶",       ep: "EP 01 · Mon",    status: "draft" },
  { id: "晨间合约",    title: "晨间合约",       ep: "EP 03 · Tue",    status: "filming" },
  { id: "镜花棱镜",    title: "镜花棱镜",       ep: "EP 02 · Wed",    status: "editing" },
];

const CAST_ROWS = [
  { id: "Hana",  name: "Hana",  role: "Lead · Romance",  state: "ready"    as const },
  { id: "Riku",  name: "Riku",  role: "Lead · Drama",    state: "ready"    as const },
  { id: "Mei",   name: "Mei",   role: "Lead · Comedy",   state: "ready"    as const },
  { id: "Sora",  name: "Sora",  role: "Support",         state: "training" as const },
  { id: "Jun",   name: "Jun",   role: "Lead · Office",   state: "ready"    as const },
  { id: "Aya",   name: "Aya",   role: "Lead · Slice",    state: "ready"    as const },
];

const QUEUE_COLUMNS = [
  {
    id: "scripting", label: "Scripting", tone: "scripting" as const, count: 3,
    items: [
      { title: "Mid-summer Pact · EP 02", meta: "Mei · Jun · cafe",  seed: "Mei" },
      { title: "City of Ash · EP 01 sc 01", meta: "Sora · alley",     seed: "Sora" },
      { title: "Sunday Pages · EP 03 sc 04", meta: "Aya · garden",    seed: "Aya" },
    ],
  },
  {
    id: "filming", label: "Filming", tone: "filming" as const, count: 2,
    items: [
      { title: "Roof of Tokyo · EP 09 sc 03", meta: "Hana · roof, dusk", seed: "Hana" },
      { title: "Sunday Pages · EP 03 sc 02", meta: "Aya · Jun · porch", seed: "Aya" },
    ],
  },
  {
    id: "editing", label: "Editing", tone: "editing" as const, count: 2,
    items: [
      { title: "Glass Garden · EP 02 sc 05", meta: "Mei · greenhouse",   seed: "Mei" },
      { title: "Roof of Tokyo · EP 08 sc 09", meta: "Hana · sun 3",      seed: "Hana" },
    ],
  },
  {
    id: "published", label: "Published", tone: "published" as const, count: 1,
    items: [
      { title: "Last Train Home · EP 12 sc 12", meta: "5.1M views · ↑",  seed: "Riku" },
    ],
  },
];

function OverviewView({ highlightCast }: { highlightCast: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* hero —— 仿参考图 mono 日期 + 大标题 + serif 斜体高亮 + 按钮 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
        }}
      >
        <div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--fg-2)",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {DATE_LINE}
          </div>
          <h1
            style={{
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              margin: 0,
              lineHeight: 1.15,
              color: "var(--fg-0)",
            }}
          >
            Good morning, {highlightCast ? "Cast" : "Ami"}.
            <span
              className="serif-italic"
              style={{
                color: "var(--accent)",
                marginLeft: 10,
                fontSize: 32,
              }}
            >
              let&rsquo;s shoot something today.
            </span>
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md">Import script</Button>
          <Button variant="dark" size="md">▶ Open studio</Button>
        </div>
      </div>

      {/* KPI 4 张渐变卡 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {KPIS.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            delta={k.delta}
            gradient={k.gradient}
          />
        ))}
      </div>

      {/* 主体两栏：左 Active series + Cast / 右 Cast list */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
        {/* Active drama series */}
        <Card style={{ padding: "22px 22px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)" }}>
                Active drama series
              </div>
              <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 4 }}>
                6 in production · sorted by next deadline
              </div>
            </div>
            <Link
              href="/console?tab=projects"
              style={{
                fontSize: 12,
                color: "var(--accent)",
                fontFamily: "var(--font-mono)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                textDecoration: "none",
              }}
            >
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {ACTIVE_SERIES.map((s) => (
              <GradientBlock
                key={s.id}
                seed={s.id}
                height={132}
                topRight={<Chip tone={s.status} size="sm">{s.status}</Chip>}
                bottom={
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#ffffff",
                      }}
                    >
                      {s.title}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        color: "rgba(255,255,255,0.85)",
                        marginTop: 2,
                        letterSpacing: 0.4,
                      }}
                    >
                      {s.ep}
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        </Card>

        {/* Your cast */}
        <Card style={{ padding: "22px 22px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)" }}>
                Your cast
              </div>
              <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 4 }}>
                14 ready · 4 training
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <Plus size={12} /> Cast
            </Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {CAST_ROWS.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar seed={c.id} size={32} shape="square" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)" }}>
                    {c.name}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 10.5, color: "var(--fg-2)", letterSpacing: 0.3, marginTop: 2 }}
                  >
                    {c.role}
                  </div>
                </div>
                <Chip tone={c.state === "ready" ? "published" : "filming"} size="sm">
                  {c.state}
                </Chip>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Today's scene queue —— kanban 4 列 */}
      <Card style={{ padding: "22px 22px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)" }}>
              Today&rsquo;s scene queue
              <span className="serif-italic" style={{ color: "var(--fg-2)", marginLeft: 8, fontSize: 14 }}>
                what we&rsquo;re shooting
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 4 }}>
              Drag between columns to reschedule
            </div>
          </div>
          <Tabs
            items={[
              { id: "board", label: "Board" },
              { id: "timeline", label: "Timeline" },
              { id: "list", label: "List" },
            ]}
            active="board"
            size="sm"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {QUEUE_COLUMNS.map((col) => (
            <div key={col.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 4px 12px",
                  borderBottom: "1px solid var(--line)",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: `var(--${
                        col.tone === "filming" ? "extra-amber"
                          : col.tone === "scripting" ? "extra-peach"
                          : col.tone === "editing" ? "extra-teal"
                          : col.tone === "published" ? "success"
                          : "fg-3"
                      })`,
                    }}
                  />
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-0)" }}>
                    {col.label}
                  </div>
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 11, color: "var(--fg-3)" }}
                >
                  {col.count}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.items.map((it, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 12px",
                      background: "var(--bg-1)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-md)",
                      boxShadow: "var(--shadow-soft)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Avatar seed={it.seed} size={20} shape="square" />
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-0)", flex: 1, minWidth: 0 }}>
                        {it.title}
                      </div>
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 10.5, color: "var(--fg-2)", letterSpacing: 0.3, paddingLeft: 28 }}
                    >
                      {it.meta}
                    </div>
                  </div>
                ))}
                <button
                  style={{
                    padding: "8px 12px",
                    background: "transparent",
                    border: "1px dashed var(--line-2)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--fg-3)",
                    fontSize: 12,
                    fontFamily: "var(--font-sans)",
                    cursor: "pointer",
                  }}
                >
                  + Add scene
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
