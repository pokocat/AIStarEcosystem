"use client";

// 资产总库（任务书 §7）：卡片/列表/画廊三视图 + 搜索 + 按状态/含3D 筛选 + 进行中任务条 + 存储用量 + 新建入口。
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
          <h1 className="text-xl font-semibold">资产总库</h1>
          <p className="mt-0.5 text-sm text-zinc-500">管理全部AiAvatar形象资产 · {stats.total} 个</p>
        </div>
        <div className="flex items-center gap-2">
          <StatChip label="已定稿" value={stats.finalized} />
          <StatChip label="含 3D" value={stats.with3d} icon={<Cuboid className="h-3.5 w-3.5" />} />
          <StatChip label="含视频" value={stats.withVideo} icon={<Video className="h-3.5 w-3.5" />} />
        </div>
      </div>

      {/* 进行中任务条 */}
      {activeJobs.length > 0 && (
        <Link href="/jobs" className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm">
          <span className="flex h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <span className="text-amber-300">{activeJobs.length} 个任务进行中</span>
          <span className="font-mono text-xs text-amber-400/70">{activeJobs.map((j) => j.capabilityLabel).slice(0, 3).join(" · ")}</span>
          <span className="ml-auto text-xs text-amber-400">查看任务中心 →</span>
        </Link>
      )}

      {/* 工具条 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-[var(--bg-1)] px-3">
          <Search className="h-4 w-4 text-zinc-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索名称 / 风格"
            className="w-44 bg-transparent py-1.5 text-sm text-zinc-100 outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AiAvatarStatus | "all")}
          className="rounded-lg border border-zinc-700 bg-[var(--bg-1)] px-3 py-1.5 text-sm text-zinc-200">
          <option value="all">全部状态</option>
          {(Object.keys(STATUS_META) as AiAvatarStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <button onClick={() => setOnly3d((v) => !v)}
          className={cn("rounded-lg border px-3 py-1.5 text-sm", only3d ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-zinc-700 text-zinc-300")}>
          仅含 3D
        </button>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-zinc-700 p-0.5">
          <ViewBtn active={view === "card"} onClick={() => setView("card")}><Grid3x3 className="h-4 w-4" /></ViewBtn>
          <ViewBtn active={view === "list"} onClick={() => setView("list")}><LayoutList className="h-4 w-4" /></ViewBtn>
          <ViewBtn active={view === "gallery"} onClick={() => setView("gallery")}><Images className="h-4 w-4" /></ViewBtn>
        </div>
        <Link href="/create" className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
          <Plus className="h-4 w-4" /> 新建
        </Link>
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
    <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[var(--bg-1)] px-3 py-1.5">
      {icon}
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="font-mono text-sm font-semibold text-zinc-100">{value}</span>
    </div>
  );
}

function ViewBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("rounded-md p-1.5", active ? "bg-amber-500/15 text-amber-300" : "text-zinc-500 hover:text-zinc-200")}>
      {children}
    </button>
  );
}

function Cover({ avatar, className }: { avatar: AiAvatar; className?: string }) {
  if (avatar.coverUrl) {
    return <SafeImg src={avatar.coverUrl} alt={avatar.name} className={className} imgClassName="h-full w-full object-cover" />;
  }
  return <div className={cn("ph flex items-center justify-center", className)}><Boxes className="h-8 w-8 text-zinc-600" /></div>;
}

function CardView({ avatars }: { avatars: AiAvatar[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {avatars.map((a) => (
        <Link key={a.id} href={`/avatar/${a.id}`}
          className="group overflow-hidden rounded-xl border border-zinc-800 bg-[var(--bg-1)] transition hover:border-zinc-600">
          <div className="relative aspect-[3/4]">
            <Cover avatar={a} className="h-full w-full" />
            <div className="absolute left-2 top-2"><StatusPill status={a.status} /></div>
            <div className="absolute bottom-2 right-2 flex gap-1">
              {a.has3d && <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-amber-300">3D</span>}
              {a.hasVideo && <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-amber-300">视频</span>}
            </div>
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between">
              <h3 className="truncate text-sm font-medium text-zinc-100">{a.name}</h3>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
              <span>{a.mode === "real_clone" ? "真人复刻" : "AI 原创"}</span>
              {a.styleCategory && <><span>·</span><span>{a.styleCategory}</span></>}
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
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-2)] text-left text-xs text-zinc-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">名称</th>
            <th className="px-4 py-2.5 font-medium">模式</th>
            <th className="px-4 py-2.5 font-medium">链路</th>
            <th className="px-4 py-2.5 font-medium">状态</th>
            <th className="px-4 py-2.5 font-medium">更新</th>
          </tr>
        </thead>
        <tbody>
          {avatars.map((a) => (
            <tr key={a.id} className="border-t border-zinc-800 hover:bg-white/[0.02]">
              <td className="px-4 py-2.5">
                <Link href={`/avatar/${a.id}`} className="flex items-center gap-2.5">
                  <Cover avatar={a} className="h-10 w-8 rounded" />
                  <span className="font-medium text-zinc-100">{a.name}</span>
                </Link>
              </td>
              <td className="px-4 py-2.5 text-zinc-400">{a.mode === "real_clone" ? "真人复刻" : "AI 原创"}</td>
              <td className="px-4 py-2.5"><PipelineStepper status={a.status} className="max-w-md" /></td>
              <td className="px-4 py-2.5"><StatusPill status={a.status} /></td>
              <td className="px-4 py-2.5 text-zinc-500">{relativeTime(a.updatedAt)}</td>
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
        <Link key={a.id} href={`/avatar/${a.id}`} className="mb-3 block break-inside-avoid overflow-hidden rounded-xl border border-zinc-800">
          <div className="relative">
            <Cover avatar={a} className="w-full" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-2">
              <span className="truncate text-xs font-medium text-zinc-100">{a.name}</span>
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
        <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-zinc-800/50" />
      ))}
    </div>
  );
}

function EmptyState({ onCreate, hasAny }: { onCreate: () => void; hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 py-20 text-center">
      <Boxes className="mb-3 h-10 w-10 text-zinc-600" />
      <p className="text-zinc-300">{hasAny ? "没有符合筛选条件的AiAvatar" : "还没有AiAvatar 资产"}</p>
      <p className="mt-1 text-sm text-zinc-500">从真人照片复刻，或用一句人设文案 AI 原创</p>
      <button onClick={onCreate} className="mt-4 flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
        <Plus className="h-4 w-4" /> 新建AiAvatar
      </button>
    </div>
  );
}
