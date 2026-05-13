import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  Megaphone,
  PieChart as PieIcon,
  Play,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Video,
} from "lucide-react";
import { Button, Card, Chip, KpiCard } from "@/components/creator";
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

// console/page.tsx 路由：
//   /console          → Creator-Friendly 总览（自有视图，不依赖业务组件）
//   /console?tab=xxx  → 原 celebrity-zone 业务组件，用深色 surface 包裹
// 业务组件本身用深色 Tailwind 类（cyan / purple / amber 等），保留不动。

interface PageProps {
  searchParams?: Promise<{ tab?: string }>;
}

function resolveTab(raw?: string): ZoneTabId | "overview" {
  if (
    raw === "market" ||
    raw === "projects" ||
    raw === "library" ||
    raw === "data" ||
    raw === "products"
  )
    return raw;
  return "overview";
}

export default async function CelebrityConsolePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const active = resolveTab(sp.tab);

  if (active === "overview") {
    return <OverviewView />;
  }

  // 业务组件已被批量染色为 Creator-Friendly light 风（紫罗兰 + 浅色卡），
  // 不再需要深色 surface 包裹，直接渲染。
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

// ─── Creator-Friendly 总览视图 ─────────────────────────────────────────────

function OverviewView() {
  const topStars = MARKET_STARS.slice(0, 4);
  const recentProjects = CELEBRITY_PROJECTS.slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* hero */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
        }}
      >
        <div>
          <div className="creator-eyebrow">明星带货 · 工作总览</div>
          <h1
            style={{
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              margin: "10px 0 8px",
              lineHeight: 1.05,
              color: "var(--fg-0)",
            }}
          >
            欢迎回来{" "}
            <span
              className="creator-text-gradient"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              ,
            </span>{" "}
            今天有 3 件事要做。
          </h1>
          <div style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.6 }}>
            12 位签约明星 · 8 条在产项目 · 3 条待审切片 — 同步于 2 分钟前
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/console?tab=library">
            <Button variant="secondary" size="md">
              <Video size={14} /> 视频中心
            </Button>
          </Link>
          <Link href="/console?tab=projects">
            <Button variant="primary" size="md">
              <Sparkles size={14} /> 新建项目
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
        <KpiCard
          label="签约明星"
          value={String(ZONE_OVERVIEW.hero.activeStars ?? topStars.length)}
          delta="+2 / 月"
          tone="accent"
          spark={[42, 50, 48, 60, 68, 70, 84]}
        />
        <KpiCard
          label="30 日 GMV"
          value="¥8.42M"
          delta="+12.4% vs 上月"
          tone="success"
          spark={[28, 30, 36, 40, 48, 54, 62]}
        />
        <KpiCard
          label="累计播放"
          value={ZONE_OVERVIEW.hero.totalPlays}
          delta="本周新增 8.6M"
          tone="peach"
          spark={[30, 38, 42, 48, 56, 64, 72]}
        />
        <KpiCard
          label="累计转化"
          value={ZONE_OVERVIEW.hero.totalConversions}
          delta="转化率 1.86%"
          tone="lime"
          spark={[22, 26, 30, 36, 38, 44, 48]}
        />
      </div>

      {/* 主体两列：明星集 + 近期项目 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
        {/* 明星集 */}
        <Card xl elevated style={{ padding: "26px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <div>
              <div className="creator-eyebrow">头部明星</div>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  marginTop: 6,
                  color: "var(--fg-0)",
                }}
              >
                本月 GMV 前 4 名
              </div>
            </div>
            <Link
              href="/console?tab=market"
              style={{
                fontSize: 12.5,
                color: "var(--accent)",
                fontFamily: "var(--font-mono)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              查看全部 <ArrowUpRight size={12} />
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {topStars.map((s, i) => (
              <Link
                key={s.id}
                href={`/console/star/${s.id}`}
                style={{ textDecoration: "none" }}
              >
                <Card style={{ padding: 0, overflow: "hidden", cursor: "pointer", transition: "transform 200ms" }}>
                  <div
                    style={{
                      height: 130,
                      background: i % 2 === 0 ? "var(--gradient-violet)" : "var(--gradient-peach)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.35))",
                      }}
                    />
                    <div style={{ position: "absolute", top: 12, left: 12 }}>
                      <Chip solid tone={i === 0 ? "lime" : "accent"}>
                        TOP {i + 1}
                      </Chip>
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 10,
                        left: 14,
                        right: 14,
                        color: "#ffffff",
                      }}
                    >
                      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font-display)" }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                        {s.category ?? "明星 IP"}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div className="creator-mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>
                      {s.stats?.totalPlays ? `播放 ${s.stats.totalPlays}` : s.startingPrice}
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 13,
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        color: "var(--accent)",
                      }}
                    >
                      详情 <ArrowRight size={12} />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </Card>

        {/* 右栏：近期项目 + 快捷动作 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card xl elevated style={{ padding: "24px 26px" }}>
            <div className="creator-eyebrow" style={{ marginBottom: 6 }}>近期项目</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                marginBottom: 18,
                color: "var(--fg-0)",
              }}
            >
              进行中（{recentProjects.length}）
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recentProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/console/projects/${p.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-2)",
                      border: "1px solid var(--line)",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-sm)",
                        background: "var(--gradient-violet)",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--fg-0)",
                          marginBottom: 3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        {p.name}
                      </div>
                      <div className="creator-mono" style={{ fontSize: 10.5, color: "var(--fg-2)" }}>
                        {p.starName} · {p.status}
                      </div>
                    </div>
                    <ArrowRight size={14} color="var(--fg-3)" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card xl elevated style={{ padding: "24px 26px" }}>
            <div className="creator-eyebrow" style={{ marginBottom: 6 }}>快捷动作</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                marginBottom: 14,
                color: "var(--fg-0)",
              }}
            >
              今日待办
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/console?tab=projects" style={{ textDecoration: "none" }}>
                <Button variant="primary" size="md" style={{ width: "100%" }}>
                  <Sparkles size={14} /> 新建项目
                </Button>
              </Link>
              <Link href="/console?tab=library" style={{ textDecoration: "none" }}>
                <Button variant="secondary" size="md" style={{ width: "100%" }}>
                  <Play size={14} /> 审核切片
                </Button>
              </Link>
              <Link href="/console?tab=data" style={{ textDecoration: "none" }}>
                <Button variant="ghost" size="md" style={{ width: "100%" }}>
                  <PieIcon size={14} /> 查看数据
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* 模块快速访问 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <ModuleCard
          icon={Star}
          label="明星市场"
          desc="12 位明星可选"
          href="/console?tab=market"
          tone="accent"
        />
        <ModuleCard
          icon={Megaphone}
          label="我的项目"
          desc="8 条在产"
          href="/console?tab=projects"
          tone="peach"
        />
        <ModuleCard
          icon={Video}
          label="视频中心"
          desc="42K 切片"
          href="/console?tab=library"
          tone="lime"
        />
        <ModuleCard
          icon={ShoppingBag}
          label="商品库"
          desc="168 件 SKU"
          href="/console?tab=products"
          tone="info"
        />
      </div>
    </div>
  );
}

function ModuleCard({
  icon: Icon,
  label,
  desc,
  href,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  href: string;
  tone: "accent" | "peach" | "lime" | "info";
}) {
  const colorVar =
    tone === "accent" ? "var(--accent)" :
    tone === "peach" ? "var(--extra-peach)" :
    tone === "lime" ? "var(--extra-lime)" :
    "var(--info)";
  const bgVar =
    tone === "accent" ? "var(--accent-soft)" :
    tone === "peach" ? "color-mix(in srgb, var(--extra-peach) 12%, transparent)" :
    tone === "lime" ? "color-mix(in srgb, var(--extra-lime) 22%, transparent)" :
    "color-mix(in srgb, var(--info) 10%, transparent)";
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <Card elevated style={{ padding: "20px 22px", cursor: "pointer" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "var(--radius-md)",
            background: bgVar,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          <Icon size={20} color={colorVar} />
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "var(--font-display)",
            color: "var(--fg-0)",
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div className="creator-mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>
          {desc}
        </div>
      </Card>
    </Link>
  );
}
