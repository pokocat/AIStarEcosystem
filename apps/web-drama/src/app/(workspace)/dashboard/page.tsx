"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Clock,
  Film,
  PlayCircle,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { Drama, DramaStatus } from "@ai-star-eco/types/film";
import type { Artist } from "@ai-star-eco/types/artist";
import { Button, Card, Chip, KpiCard, Meter } from "@/components/premium";
import { SectionHeader, ViewHeader, StatusBadge, LoadingBlock, ErrorBlock } from "@/components/common";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ArtistsApi, FilmApi } from "@/api";
import { deriveCastView } from "@/lib/cast-derive";
import { NewProjectDialog } from "../projects/_dialogs/NewProjectDialog";
import { NewScriptDialog } from "../scripts/_dialogs/NewScriptDialog";
import { NewArtistDialog } from "../cast/_dialogs/NewArtistDialog";

type ProjectTone = "accent" | "success" | "warning" | "danger" | "info" | "violet" | "neutral";

const DRAMA_STATUS_LABEL: Record<DramaStatus, string> = {
  released: "在线",
  filming: "制作中",
  "post-production": "首映 T-3",
  casting: "选角",
};
const DRAMA_STATUS_TONE: Record<DramaStatus, ProjectTone> = {
  released: "success",
  filming: "info",
  "post-production": "accent",
  casting: "violet",
};

function deriveSched(d: Drama): string {
  if (d.status === "released") return d.releaseDate ? `首播 ${d.releaseDate.slice(0, 10)}` : "已上线";
  if (d.status === "filming") return "拍摄中";
  if (d.status === "post-production")
    return d.releaseDate ? `首映 ${d.releaseDate.slice(0, 10)}` : "后期制作";
  return "选角中";
}

export default function DashboardPage() {
  const router = useRouter();

  const dramasQ = useAsync<Drama[]>("/film/dramas", () => FilmApi.listDramas());
  const artistsQ = useAsync<Artist[]>("/me/artists", () => ArtistsApi.listArtists());

  const [showNewProject, setShowNewProject] = React.useState(false);
  const [showNewScript, setShowNewScript] = React.useState(false);
  const [showNewArtist, setShowNewArtist] = React.useState(false);

  const dramas = dramasQ.data ?? [];
  const artists = artistsQ.data ?? [];

  const dramaMain = dramas.filter((d) => d.id.startsWith("d-"));
  const releasedCount = dramaMain.filter((d) => d.status === "released").length;
  const filmingCount = dramaMain.filter((d) => d.status === "filming").length;

  const totalViews = dramaMain.reduce((s, d) => s + d.views, 0);
  const totalRevenue = dramaMain.reduce((s, d) => s + d.revenue, 0);

  const activeArtists = artists.filter((a) => a.status === "active");
  const castPreview = activeArtists.slice(0, 4).map(deriveCastView);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <ViewHeader
        eyebrow="AI 短剧 · 生产中台"
        title={
          <>
            今天的{" "}
            <span
              className="text-gradient-gold"
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontWeight: 400,
              }}
            >
              片场
            </span>
          </>
        }
        meta={`${dramaMain.length} 部在产剧集 · ${activeArtists.length} 位演员 IP 在线 · 同步于 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`}
        action={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => toast.info("排期日历功能即将上线", { description: "v0.7 排期与工时" })}
            >
              <Clock size={14} />
              排期日历
            </Button>
            <Button variant="primary" size="md" onClick={() => setShowNewProject(true)}>
              <Sparkles size={14} />
              创建新项目
            </Button>
          </>
        }
      />

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <Link href="/cast" style={{ textDecoration: "none" }}>
          <KpiCard
            label="演员 IP · 在线"
            value={String(activeArtists.length)}
            delta={`共 ${artists.length} 个 IP`}
            tone="accent"
            spark={[42, 50, 48, 60, 68, 70, 84]}
          />
        </Link>
        <Link href="/projects" style={{ textDecoration: "none" }}>
          <KpiCard
            label="在产剧集"
            value={String(dramaMain.length)}
            delta={`${releasedCount} 在线 · ${filmingCount} 制作`}
            tone="violet"
            spark={[22, 26, 30, 36, 38, 44, 48]}
          />
        </Link>
        <Link href="/insights" style={{ textDecoration: "none" }}>
          <KpiCard
            label="累计播放"
            value={totalViews >= 1_000_000 ? `${(totalViews / 1_000_000).toFixed(1)}M` : `${(totalViews / 1000).toFixed(0)}K`}
            delta="+14.2% vs 上月"
            tone="info"
            spark={[30, 38, 42, 48, 56, 64, 72]}
          />
        </Link>
        <Link href="/finance" style={{ textDecoration: "none" }}>
          <KpiCard
            label="累计营收"
            value={`¥${(totalRevenue / 10_000).toFixed(1)}万`}
            delta="+9.6% vs 上月"
            tone="success"
            spark={[28, 30, 36, 40, 48, 54, 62]}
          />
        </Link>
      </div>

      {/* cast + quick draw */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card style={{ padding: "22px 24px" }}>
          <SectionHeader
            eyebrow="cast & roster"
            title="演员 IP 阵容"
            right={
              <Link
                href="/cast"
                style={{
                  fontSize: 12,
                  color: "var(--accent)",
                  fontFamily: "var(--font-mono)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                查看全部 <ArrowUpRight size={12} />
              </Link>
            }
          />
          {artistsQ.isLoading && <LoadingBlock rows={2} height={92} />}
          {!!artistsQ.error && (
            <ErrorBlock
              message="演员 IP 加载失败"
              onRetry={artistsQ.refetch}
            />
          )}
          {!artistsQ.isLoading && !artistsQ.error && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {castPreview.map((c) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/cast/${encodeURIComponent(c.id)}`)}
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: 14,
                    borderRadius: "var(--radius-md)",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--line)",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "var(--fg-0)",
                    fontFamily: "var(--font-sans)",
                    transition: "border-color 140ms ease, background 140ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "color-mix(in srgb, var(--accent) 30%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 80,
                      borderRadius: "var(--radius-sm)",
                      background: c.gradient,
                      flexShrink: 0,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.4))",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "var(--fg-0)",
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        {c.name}
                      </div>
                      <Chip tone={c.tone}>{c.fidelity}</Chip>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginBottom: 10, lineHeight: 1.4 }}>
                      {c.role}
                    </div>
                    <div
                      className="mono"
                      style={{
                        display: "flex",
                        gap: 12,
                        fontSize: 10.5,
                        color: "var(--fg-3)",
                        letterSpacing: 0.3,
                      }}
                    >
                      <span>{c.series} 部剧集</span>
                      <span style={{ color: "var(--fg-2)" }}>{c.plays}</span>
                      <span style={{ color: "var(--accent)" }}>{c.revenue}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: "22px 22px" }}>
            <SectionHeader eyebrow="system pulse" title="工作台状态" />
            <Meter label="渲染队列利用" value={62} tone="accent" hint="GPU · 渲染剧集 · 02 上线" />
            <Meter label="形象保真度" value={88} tone="success" hint="平均 · 全部 A 类演员" />
            <Meter label="授权额度" value={34} tone="warning" hint="≈ 22 天剩余" />
            <Meter label="脚本审稿" value={76} tone="info" hint="本周 18 / 24 已审" />
          </Card>

          <Card glass style={{ padding: "22px 22px" }}>
            <SectionHeader eyebrow="quick draw" title="快速动作" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button
                variant="primary"
                size="md"
                style={{ width: "100%" }}
                onClick={() => setShowNewProject(true)}
              >
                <Wand2 size={14} />
                启动新剧集
              </Button>
              <Button
                variant="secondary"
                size="md"
                style={{ width: "100%" }}
                onClick={() => setShowNewScript(true)}
              >
                <Film size={14} />
                新建脚本
              </Button>
              <Button
                variant="secondary"
                size="md"
                style={{ width: "100%" }}
                onClick={() => setShowNewArtist(true)}
              >
                <Sparkles size={14} />
                新增演员 IP
              </Button>
              <Button
                variant="ghost"
                size="md"
                style={{ width: "100%" }}
                onClick={() => router.push("/finance")}
              >
                <PlayCircle size={14} />
                查看授权台账
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* projects */}
      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="project pipeline"
          title="项目流水线"
          right={
            <Link
              href="/projects"
              style={{
                fontSize: 12,
                color: "var(--accent)",
                fontFamily: "var(--font-mono)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              查看全部 <ArrowUpRight size={12} />
            </Link>
          }
        />
        {dramasQ.isLoading && <LoadingBlock rows={3} height={48} />}
        {!!dramasQ.error && <ErrorBlock onRetry={dramasQ.refetch} />}
        {!dramasQ.isLoading && !dramasQ.error && (
          <div
            style={{
              overflow: "hidden",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--line)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["剧名", "类型", "集数", "主演", "状态", "排期"].map((h) => (
                    <th
                      key={h}
                      className="eyebrow"
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--line)",
                        color: "var(--fg-2)",
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dramaMain.map((p, i) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/projects/${encodeURIComponent(p.id)}`)}
                    style={{
                      borderBottom: i < dramaMain.length - 1 ? "1px solid var(--line)" : "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        "rgba(255,255,255,0.02)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                    }}
                  >
                    <td
                      style={{
                        padding: "14px 16px",
                        color: "var(--fg-0)",
                        fontWeight: 500,
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {p.title}
                    </td>
                    <td style={{ padding: "14px 16px", color: "var(--fg-1)" }}>{p.genre}</td>
                    <td className="mono" style={{ padding: "14px 16px", color: "var(--fg-1)", fontSize: 12 }}>
                      {p.episodes > 0 ? `${p.episodes} 集` : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", color: "var(--fg-1)" }}>{p.role}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge tone={DRAMA_STATUS_TONE[p.status]}>{DRAMA_STATUS_LABEL[p.status]}</StatusBadge>
                    </td>
                    <td
                      className="mono"
                      style={{ padding: "14px 16px", color: "var(--fg-2)", fontSize: 12 }}
                    >
                      {deriveSched(p)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewProjectDialog
        open={showNewProject}
        onOpenChange={setShowNewProject}
        onCreated={(d) => {
          invalidate("/film/dramas");
          toast.success(`项目「${d.title}」已创建`);
          router.push(`/projects/${encodeURIComponent(d.id)}`);
        }}
      />
      <NewScriptDialog
        open={showNewScript}
        onOpenChange={setShowNewScript}
        onCreated={(s) => {
          invalidate("/me/scripts");
          toast.success(`脚本「${s.title}」已创建`);
          router.push(`/scripts/${encodeURIComponent(s.id)}`);
        }}
      />
      <NewArtistDialog
        open={showNewArtist}
        onOpenChange={setShowNewArtist}
        onCreated={(a) => {
          invalidate("/me/artists");
          toast.success(`演员「${a.name}」已加入阵容`);
          router.push(`/cast/${encodeURIComponent(a.id)}`);
        }}
      />
    </div>
  );
}
