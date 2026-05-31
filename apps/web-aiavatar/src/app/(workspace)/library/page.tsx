"use client";
// ============================================================
// 资产总库首页 — 卡片 / 列表 / 画廊 三视图 + 进行中任务条 + 搜索 / 筛选。
// （从原型 screens-library.jsx 移植，接 useApi(listAvatars)。）
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatar, AiAvatarJob } from "@ai-star-eco/types/ai-avatar";
import { Btn, IconBtn, StatusPill, Tag, Portrait, Progress, Seg, Avatar } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { useApi } from "@/lib/hooks";
import { listAvatars, listJobs } from "@/api/ai-avatar";
import { modeLabel } from "@/constants/aiavatar-ui";
import { hueFor } from "@/lib/hue";
import { fmtDate } from "@/lib/format";

type View = "card" | "list" | "gallery";
type Filter = "all" | "real" | "ai" | "3d";

const badgeStyle: React.CSSProperties = { width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", background: "rgba(10,11,14,0.7)", backdropFilter: "blur(6px)", border: "1px solid var(--line-2)", color: "var(--ink-0)" };

export default function LibraryHome() {
  const router = useRouter();
  const { data: avatars } = useApi(() => listAvatars(), []);
  const { data: jobs } = useApi(() => listJobs(), []);
  const [view, setView] = React.useState<View>("card");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");

  const all = avatars ?? [];
  const progressOf = React.useCallback(
    (id: string): number | null => {
      const j = (jobs ?? []).find((x) => x.avatarId === id && x.status === "running");
      return j ? Math.round(j.progress) : null;
    },
    [jobs],
  );

  let list = all;
  if (filter === "real") list = list.filter((a) => a.mode === "real_clone");
  if (filter === "ai") list = list.filter((a) => a.mode === "ai_original");
  if (filter === "3d") list = list.filter((a) => a.has3d);
  if (q) list = list.filter((a) => a.name.includes(q) || a.id.toLowerCase().includes(q.toLowerCase()));

  const open = (a: AiAvatar) => router.push(`/avatars/${a.id}`);
  const filters: [Filter, string][] = [["all", "全部"], ["real", "真人复刻"], ["ai", "AI 原创"], ["3d", "含 3D"]];
  const archived = all.filter((a) => a.status === "archived").length;

  return (
    <div style={{ padding: "28px 36px 60px", maxWidth: 1480, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--accent)", marginBottom: 8 }}>ASSET LIBRARY</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em" }}>资产总库</h1>
          <div style={{ fontSize: 13.5, color: "var(--ink-1)", marginTop: 6 }}>
            共 <span className="mono" style={{ color: "var(--ink-0)" }}>{all.length}</span> 个数字人资产 · <span className="mono" style={{ color: "var(--ink-0)" }}>{archived}</span> 个已归档
          </div>
        </div>
        <Btn variant="pri" size="lg" icon={Icons.plus} onClick={() => router.push("/create")}>新建数字人</Btn>
      </div>

      <ActiveStrip jobs={jobs ?? []} onTasks={() => router.push("/tasks")} />

      {/* 工具栏 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "0 0 280px" }}>
          <Icons.search size={16} style={{ position: "absolute", left: 12, top: 11, color: "var(--ink-2)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索名称 / 资产 ID" style={{ width: "100%", padding: "9px 12px 9px 36px", background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", color: "var(--ink-0)", fontSize: 13, outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {filters.map(([k, lbl]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ padding: "8px 14px", fontSize: 13, cursor: "pointer", borderRadius: "var(--r-md)", border: "1px solid " + (filter === k ? "var(--accent-line)" : "var(--line)"), background: filter === k ? "var(--accent-soft)" : "transparent", color: filter === k ? "var(--accent-hi)" : "var(--ink-1)" }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Seg<View> value={view} onChange={setView} options={[{ value: "card", icon: Icons.grid, label: "卡片" }, { value: "list", icon: Icons.list, label: "列表" }, { value: "gallery", icon: Icons.gallery, label: "画廊" }]} />
        </div>
      </div>

      {list.length === 0 ? (
        <Empty onCreate={() => router.push("/create")} />
      ) : view === "card" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))", gap: 20 }}>
          {list.map((a) => <AssetCard key={a.id} a={a} progress={progressOf(a.id)} onOpen={open} />)}
        </div>
      ) : view === "list" ? (
        <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "44px 1.6fr 1fr 1fr 1.2fr 0.8fr 40px", gap: 16, padding: "11px 18px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-2)", textTransform: "uppercase" }}>
            <span /><span>名称 / ID</span><span>类型</span><span>风格</span><span>状态</span><span>创建者</span><span />
          </div>
          {list.map((a) => <AssetRow key={a.id} a={a} progress={progressOf(a.id)} onOpen={open} />)}
        </div>
      ) : (
        <div style={{ columns: 4, columnGap: 18 }}>
          {list.map((a, i) => (
            <div key={a.id} style={{ breakInside: "avoid", marginBottom: 18 }}>
              <GalleryCard a={a} tall={i % 3 === 0} onOpen={open} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCard({ a, progress, onOpen }: { a: AiAvatar; progress: number | null; onOpen: (a: AiAvatar) => void }) {
  const inProg = progress != null;
  return (
    <div
      onClick={() => onOpen(a)}
      style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", cursor: "pointer", transition: "all .18s", display: "flex", flexDirection: "column" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--line-3)"; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "var(--shadow-2)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ position: "relative" }}>
        <Portrait hue={hueFor(a.id)} src={a.coverUrl} ratio="4 / 3" label={inProg ? "生成中" : "主形象图"} style={{ borderRadius: 0, border: "none", borderBottom: "1px solid var(--line)" }} dim={inProg} />
        <div style={{ position: "absolute", top: 10, left: 10 }}><StatusPill status={a.status} /></div>
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 5 }}>
          {a.has3d && <span style={badgeStyle}><Icons.cube size={12} /></span>}
          {a.hasVideo && <span style={badgeStyle}><Icons.film size={12} /></span>}
        </div>
        {inProg && (
          <div style={{ position: "absolute", left: 14, right: 14, bottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--signal)", marginBottom: 6 }}>
              <span>渲染中</span><span>{progress}%</span>
            </div>
            <Progress pct={progress!} />
          </div>
        )}
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{a.name}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>{a.id}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Tag>{modeLabel(a.mode)}</Tag>
          {a.styleCategory && <Tag>{a.styleCategory}</Tag>}
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Avatar name="陈墨" size={20} hue={hueFor(a.id)} />
            <span style={{ fontSize: 12, color: "var(--ink-1)" }}>陈墨</span>
          </div>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>{fmtDate(a.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function AssetRow({ a, progress, onOpen }: { a: AiAvatar; progress: number | null; onOpen: (a: AiAvatar) => void }) {
  const inProg = progress != null;
  return (
    <div
      onClick={() => onOpen(a)}
      style={{ display: "grid", gridTemplateColumns: "44px 1.6fr 1fr 1fr 1.2fr 0.8fr 40px", alignItems: "center", gap: 16, padding: "12px 18px", borderBottom: "1px solid var(--line)", cursor: "pointer", transition: "background .15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Portrait hue={hueFor(a.id)} src={a.coverUrl} ratio="1 / 1" label="" style={{ borderRadius: 8 }} />
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{a.name}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>{a.id}</div>
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-1)" }}>{modeLabel(a.mode)}</div>
      <div style={{ fontSize: 13, color: "var(--ink-1)" }}>{a.styleCategory ?? "—"}</div>
      <div>{inProg ? <div style={{ maxWidth: 120 }}><Progress pct={progress!} /><span className="mono" style={{ fontSize: 10.5, color: "var(--signal)" }}>{progress}%</span></div> : <StatusPill status={a.status} />}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar name="陈墨" size={22} hue={hueFor(a.id)} /><span style={{ fontSize: 12.5, color: "var(--ink-1)" }}>陈墨</span></div>
      <div style={{ display: "flex", gap: 4, color: "var(--ink-2)" }}>{a.has3d && <Icons.cube size={14} />}{a.hasVideo && <Icons.film size={14} />}</div>
    </div>
  );
}

function GalleryCard({ a, tall, onOpen }: { a: AiAvatar; tall: boolean; onOpen: (a: AiAvatar) => void }) {
  return (
    <div onClick={() => onOpen(a)} style={{ position: "relative", cursor: "pointer", borderRadius: "var(--r-lg)", overflow: "hidden", transition: "transform .2s" }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.015)")} onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}>
      <Portrait hue={hueFor(a.id)} src={a.coverUrl} ratio={tall ? "3 / 4" : "4 / 5"} label="" style={{ borderRadius: "var(--r-lg)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,11,14,0.85) 0%, transparent 42%)" }} />
      <div style={{ position: "absolute", top: 12, left: 12 }}><StatusPill status={a.status} /></div>
      <div style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{a.name}</div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-1)" }}>{a.id}</div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}><Tag>{modeLabel(a.mode)}</Tag>{a.styleCategory && <Tag>{a.styleCategory}</Tag>}</div>
      </div>
    </div>
  );
}

function ActiveStrip({ jobs, onTasks }: { jobs: AiAvatarJob[]; onTasks: () => void }) {
  const running = jobs.filter((t) => t.status === "running");
  if (!running.length) return null;
  return (
    <div style={{ display: "flex", gap: 14, padding: 16, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", marginBottom: 24, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, paddingRight: 16, borderRight: "1px solid var(--line)" }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--signal)", animation: "pulse 1.6s infinite" }} />
        <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{running.length} 个任务进行中</span>
      </div>
      <div style={{ display: "flex", gap: 12, flex: 1, overflow: "hidden" }}>
        {running.slice(0, 3).map((t) => (
          <div key={t.id} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--signal)" }}>{Math.round(t.progress)}%</span>
            </div>
            <Progress pct={t.progress} />
          </div>
        ))}
      </div>
      <Btn variant="line" size="sm" onClick={onTasks} iconR={Icons.chevR}>任务中心</Btn>
    </div>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ padding: "80px 0", textAlign: "center", color: "var(--ink-2)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, marginBottom: 16 }}>暂无匹配的数字人资产</div>
      <Btn variant="pri" icon={Icons.plus} onClick={onCreate}>新建数字人</Btn>
    </div>
  );
}
