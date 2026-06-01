"use client";

// 资产库：IA 主线的家。卡片 / 列表 / 画廊三视图 + 搜索 + 状态/含3D 筛选 + 进行中任务条 + 新建入口。
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, Cuboid, Grid3x3, Images, LayoutList, Plus, Search, Video } from "lucide-react";
import type { AiAvatar, AiAvatarStatus } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { StatusPill } from "@/components/common/status-pill";
import { PipelineStepper } from "@/components/common/pipeline-stepper";
import { relativeTime } from "@/lib/format";
import { STATUS_META } from "@/constants/aiavatar-ui";
import { useJobList } from "@/lib/use-job-poll";
import { SafeImg } from "@/components/common/safe-img";

type View = "card" | "list" | "gallery";

export default function LibraryPage() {
  const router = useRouter();
  const [avatars, setAvatars] = React.useState<AiAvatar[] | null>(null);
  const [view, setView] = React.useState<View>("card");
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<AiAvatarStatus | "all">("all");
  const [only3d, setOnly3d] = React.useState(false);
  const { jobs } = useJobList(3000);

  const load = React.useCallback(() => {
    AiAvatarApi.listAvatars().then(setAvatars).catch(() => setAvatars([]));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const activeJobs = jobs.filter((j) => j.status === "running" || j.status === "queued");

  const filtered = (avatars ?? []).filter((a) => {
    if (q && !a.name.toLowerCase().includes(q.toLowerCase()) && !(a.styleCategory ?? "").includes(q)) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (only3d && !a.has3d) return false;
    return true;
  });

  const stats = {
    total: avatars?.length ?? 0,
    finalized: avatars?.filter((a) => a.status === "finalized_2d" || a.status === "deriving" || a.status === "archived").length ?? 0,
    with3d: avatars?.filter((a) => a.has3d).length ?? 0,
    withVideo: avatars?.filter((a) => a.hasVideo).length ?? 0,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* 头部 + 统计 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">资产库</h1>
          <p className="mt-0.5 text-sm text-[var(--fg-2)]">管理全部 AiAvatar 形象资产 · 共 <span className="num">{stats.total}</span> 个</p>
        </div>
        <div className="flex items-center gap-2">
          <StatChip label="已定稿" value={stats.finalized} />
          <StatChip label="含 3D" value={stats.with3d} icon={<Cuboid className="h-3.5 w-3.5" />} />
          <StatChip label="含视频" value={stats.withVideo} icon={<Video className="h-3.5 w-3.5" />} />
        </div>
      </div>

      {/* 进行中任务条（语义蓝，不抢琥珀）*/}
      {activeJobs.length > 0 && (
        <Link href="/jobs" className="flex items-center gap-3 rounded-xl border border-[var(--info-soft)] bg-[var(--info-soft)] px-4 py-2.5 text-sm">
          <span className="dot animate-pulse" style={{ background: "var(--info)" }} />
          <span className="font-medium" style={{ color: "var(--info)" }}><span className="num">{activeJobs.length}</span> 个任务进行中</span>
          <span className="meta truncate">{activeJobs.map((j) => j.capabilityLabel).slice(0, 3).join(" · ")}</span>
          <span className="ml-auto text-xs" style={{ color: "var(--info)" }}>查看任务中心 →</span>
        </Link>
      )}

      {/* 工具条 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-3 focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_3px_var(--brand-soft)]">
          <Search className="h-4 w-4 text-[var(--fg-3)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索名称 / 风格"
            className="w-44 bg-transparent py-2 text-sm text-[var(--fg-0)] outline-none placeholder:text-[var(--fg-3)]" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AiAvatarStatus | "all")} className="aa-select w-auto">
          <option value="all">全部状态</option>
          {(Object.keys(STATUS_META) as AiAvatarStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <button onClick={() => setOnly3d((v) => !v)} className="chip" data-on={only3d}>仅含 3D</button>

        <div className="ml-auto flex items-center gap-2">
          <div className="seg">
            <button onClick={() => setView("card")} data-on={view === "card"} className="seg-item" title="卡片"><Grid3x3 className="h-4 w-4" /></button>
            <button onClick={() => setView("list")} data-on={view === "list"} className="seg-item" title="列表"><LayoutList className="h-4 w-4" /></button>
            <button onClick={() => setView("gallery")} data-on={view === "gallery"} className="seg-item" title="画廊"><Images className="h-4 w-4" /></button>
          </div>
          <Link href="/create" className="btn btn-primary btn-sm"><Plus className="h-4 w-4" /> 新建</Link>
        </div>
      </div>

      {/* 内容 */}
      {avatars === null ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => router.push("/create")} hasAny={(avatars?.length ?? 0) > 0} />
      ) : view === "list" ? (
        <ListView avatars={filtered} />
      ) : view === "gallery" ? (
        <GalleryView avatars={filtered} />
      ) : (
        <CardView avatars={filtered} />
      )}
    </div>
  );
}

function StatChip({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-3 py-1.5">
      {icon && <span className="text-[var(--fg-3)]">{icon}</span>}
      <span className="text-xs text-[var(--fg-2)]">{label}</span>
      <span className="num text-sm font-semibold text-[var(--fg-0)]">{value}</span>
    </div>
  );
}

function Cover({ avatar, className }: { avatar: AiAvatar; className?: string }) {
  if (avatar.coverUrl) {
    return <SafeImg src={avatar.coverUrl} alt={avatar.name} className={className} imgClassName="h-full w-full object-cover" />;
  }
  return <div className={cn("ph flex items-center justify-center", className)}><Boxes className="h-8 w-8 text-[var(--fg-3)]" /></div>;
}

function MediaBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{children}</span>;
}

function CardView({ avatars }: { avatars: AiAvatar[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {avatars.map((a) => (
        <Link key={a.id} href={`/avatar/${a.id}`}
          className="group overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-1)] transition hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-md)]">
          <div className="relative aspect-[3/4]">
            <Cover avatar={a} className="h-full w-full" />
            <div className="absolute left-2 top-2"><StatusPill status={a.status} /></div>
            <div className="absolute bottom-2 right-2 flex gap-1">
              {a.has3d && <MediaBadge>3D</MediaBadge>}
              {a.hasVideo && <MediaBadge>视频</MediaBadge>}
            </div>
          </div>
          <div className="p-3">
            <h3 className="truncate text-sm font-medium text-[var(--fg-0)]">{a.name}</h3>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--fg-2)]">
              <span>{a.mode === "real_clone" ? "真人复刻" : "AI 原创"}</span>
              {a.styleCategory && <><span className="text-[var(--fg-3)]">·</span><span>{a.styleCategory}</span></>}
            </div>
            <div className="meta mt-1.5">更新 {relativeTime(a.updatedAt)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ListView({ avatars }: { avatars: AiAvatar[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-2)] text-left text-xs text-[var(--fg-2)]">
          <tr>
            <th className="px-4 py-2.5 font-medium">名称</th>
            <th className="px-4 py-2.5 font-medium">模式</th>
            <th className="hidden px-4 py-2.5 font-medium lg:table-cell">链路</th>
            <th className="px-4 py-2.5 font-medium">状态</th>
            <th className="px-4 py-2.5 font-medium">更新</th>
          </tr>
        </thead>
        <tbody>
          {avatars.map((a) => (
            <tr key={a.id} className="border-t border-[var(--line)] transition hover:bg-[var(--bg-2)]">
              <td className="px-4 py-2.5">
                <Link href={`/avatar/${a.id}`} className="flex items-center gap-2.5">
                  <Cover avatar={a} className="aspect-[3/4] w-8 overflow-hidden rounded" />
                  <span className="font-medium text-[var(--fg-0)]">{a.name}</span>
                </Link>
              </td>
              <td className="px-4 py-2.5 text-[var(--fg-2)]">{a.mode === "real_clone" ? "真人复刻" : "AI 原创"}</td>
              <td className="hidden px-4 py-2.5 lg:table-cell"><PipelineStepper status={a.status} showLabels={false} size="sm" className="max-w-xs" /></td>
              <td className="px-4 py-2.5"><StatusPill status={a.status} /></td>
              <td className="px-4 py-2.5 text-[var(--fg-3)]">{relativeTime(a.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GalleryView({ avatars }: { avatars: AiAvatar[] }) {
  return (
    <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
      {avatars.map((a) => (
        <Link key={a.id} href={`/avatar/${a.id}`} className="mb-3 block break-inside-avoid overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="relative">
            <Cover avatar={a} className="w-full" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent p-2">
              <span className="truncate text-xs font-medium text-white">{a.name}</span>
              <StatusPill status={a.status} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-[var(--bg-2)]" />
      ))}
    </div>
  );
}

function EmptyState({ onCreate, hasAny }: { onCreate: () => void; hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--bg-1)] py-20 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-2)] text-[var(--fg-3)]"><Boxes className="h-6 w-6" /></span>
      <p className="font-medium text-[var(--fg-1)]">{hasAny ? "没有符合筛选条件的 AiAvatar" : "还没有 AiAvatar 资产"}</p>
      <p className="mt-1 text-sm text-[var(--fg-2)]">从真人照片复刻，或用一句人设文案 AI 原创</p>
      <button onClick={onCreate} className="btn btn-primary mt-4"><Plus className="h-4 w-4" /> 新建 AiAvatar</button>
    </div>
  );
}
