"use client";

// AI 艺人孵化 · 总览：孵化流程 + 在孵艺人 + 孵化工具箱。路演演示版，数据来自 mocks/incubation。

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { formatCompactNumber } from "@ai-star-eco/api-client/format";
import { Button, Card, Chip } from "@/components/creator";
import { PageHeader } from "@/components/material-ops/shared";
import { INCUBATION_STAGES, INCUBATION_TOOLBOX, stageIndex } from "@/constants/incubation-ui";
import { INCUBATION_ARTISTS, artistTotals, type IncubationArtist, type IncubationStageId } from "@/mocks/incubation";
import { useComingSoon } from "./ComingSoon";
import { ArtistPortrait, DemoBadge, PlatformBadge, SectionTitle, StageBar, StatCell } from "./shared";

export function IncubationHome() {
  const comingSoon = useComingSoon();
  const [stage, setStage] = React.useState<IncubationStageId | "all">("all");

  const artists = stage === "all" ? INCUBATION_ARTISTS : INCUBATION_ARTISTS.filter((a) => a.stage === stage);
  const totals = React.useMemo(() => {
    const all = INCUBATION_ARTISTS.map(artistTotals);
    return {
      accounts: all.reduce((s, t) => s + t.accounts, 0),
      followers: all.reduce((s, t) => s + t.followers, 0),
      plays7d: all.reduce((s, t) => s + t.plays7d, 0),
      deals: all.reduce((s, t) => s + t.deals, 0),
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1180 }}>
      <PageHeader
        eyebrow="AI 艺人孵化"
        title="AI 艺人孵化"
        sub="从一张形象图到一个能接商单的艺人：形象、人设、内容、账号矩阵和商单，都在这里推进。"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <DemoBadge />
            <Button
              variant="accent"
              size="sm"
              onClick={() => comingSoon({ title: "孵化新艺人", desc: "从形象定制开始，一步步建出一个新的 AI 艺人。" })}
            >
              <Plus size={14} /> 孵化新艺人
            </Button>
          </div>
        }
      />

      <Card style={{ padding: 20 }}>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}
        >
          <StatCell label="在孵艺人" value={INCUBATION_ARTISTS.length} sub={`${totals.deals} 个商单进行中`} />
          <StatCell label="矩阵账号" value={totals.accounts} sub="覆盖 6 个平台" />
          <StatCell label="矩阵总粉丝" value={formatCompactNumber(totals.followers)} />
          <StatCell label="近 7 日播放" value={formatCompactNumber(totals.plays7d)} />
        </div>
      </Card>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionTitle title="孵化流程" sub="每个艺人都走这五步，点一步只看这一步的艺人" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          {INCUBATION_STAGES.map((s, i) => {
            const count = INCUBATION_ARTISTS.filter((a) => a.stage === s.id).length;
            const active = stage === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => setStage(active ? "all" : s.id)}
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: "var(--radius-lg)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                  background: active ? "var(--accent-soft)" : "var(--bg-1)",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  boxShadow: "var(--shadow-soft)",
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                    0{i + 1}
                  </span>
                  <span style={{ fontSize: 11.5, color: active ? "var(--accent-strong)" : "var(--fg-2)" }}>{count} 人</span>
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--fg-0)", marginTop: 6 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 4, lineHeight: 1.5 }}>{s.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionTitle
          title={stage === "all" ? "在孵艺人" : `在孵艺人 · ${INCUBATION_STAGES[stageIndex(stage)].label}`}
          sub="点卡片看艺人的矩阵账号、数字资产和作品"
          right={
            stage !== "all" ? (
              <Button variant="ghost" size="sm" onClick={() => setStage("all")}>
                看全部
              </Button>
            ) : undefined
          }
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
          {artists.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionTitle title="孵化工具箱" sub="孵化一个艺人要用到的能力，按环节分好了" />
        {INCUBATION_TOOLBOX.map((group) => (
          <div key={group.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-0)" }}>{group.title}</span>
              <span style={{ fontSize: 12, color: "var(--fg-2)" }}>{group.sub}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
              {group.tools.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => comingSoon({ title: t.title, desc: t.desc })}
                    className="incubation-tool"
                    style={{
                      textAlign: "left",
                      padding: 14,
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--line)",
                      background: "var(--bg-1)",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      minWidth: 0,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg-2)",
                        color: "var(--fg-1)",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)" }}>{t.title}</span>
                      <span style={{ display: "block", fontSize: 12, color: "var(--fg-2)", marginTop: 3, lineHeight: 1.5 }}>
                        {t.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function ArtistCard({ artist }: { artist: IncubationArtist }) {
  const t = artistTotals(artist);
  const stageLabel = INCUBATION_STAGES[stageIndex(artist.stage)].label;
  const platforms = Array.from(new Set(artist.accounts.map((x) => x.platform)));
  return (
    <Link
      href={`/incubation/${artist.id}`}
      className="incubation-card"
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--line)",
        background: "var(--bg-1)",
        boxShadow: "var(--shadow-soft)",
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        minWidth: 0,
      }}
    >
      <ArtistPortrait artist={artist} height={200} radius={0}>
        <div style={{ position: "absolute", top: 10, left: 10 }}>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: "var(--radius-pill)",
              background: "rgba(31,26,20,0.72)",
              color: "#fff",
              fontSize: 11.5,
              fontWeight: 500,
            }}
          >
            {stageLabel}
          </span>
        </div>
        <ArrowUpRight
          size={16}
          aria-hidden
          style={{ position: "absolute", top: 12, right: 12, color: "rgba(255,255,255,0.9)" }}
        />
      </ArtistPortrait>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--fg-0)" }}>
              {artist.name}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--fg-2)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
              title={artist.tagline}
            >
              {artist.tagline}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {artist.tags.map((tag) => (
              <Chip key={tag} tone="neutral" size="sm">
                {tag}
              </Chip>
            ))}
          </div>
        </div>
        <StageBar stage={artist.stage} progress={artist.stageProgress} compact />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            paddingTop: 10,
            borderTop: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {platforms.length > 0 ? (
              platforms.map((p) => <PlatformBadge key={p} platform={p} size={20} />)
            ) : (
              <span style={{ fontSize: 12, color: "var(--fg-3)" }}>还没开账号</span>
            )}
          </div>
          <span style={{ fontSize: 12, color: "var(--fg-2)", whiteSpace: "nowrap" }}>
            {t.accounts > 0 ? (
              <>
                {t.accounts} 个账号 · <b style={{ color: "var(--fg-0)" }}>{formatCompactNumber(t.followers)}</b> 粉丝
              </>
            ) : (
              `${artist.assets.length} 项资产`
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
