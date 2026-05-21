"use client";

// 分发中心顶层容器（v0.18 IA 升级：tabs → 左侧子菜单）。
//
// 用户行为路径：「批量制作视频 → 绑定账号 → 分发视频」中的「绑定 + 分发」一体化在这里收口。
//
// 与 v0.16 区别：
//   v0.16  /distribution + ?tab=workbench|accounts|tracking（顶部 tab 切换）
//   v0.18  /distribution（工作台）/ /distribution/accounts / /distribution/jobs（独立路由）
//          侧栏在 /distribution/* 时展开子菜单，深 SEO 化每个子页
//
// shell 仍持有共享 header（状态条 + 手动分发按钮），三个子 page 复用。

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { SocialAccount } from "@ai-star-eco/types/social-account";
import type { PublishJob } from "@ai-star-eco/types/publish-job";
import { SocialAccountApi, PublishJobApi } from "@ai-star-eco/api-client";
import { MixcutApi } from "@/api";
import type { RenderJob, RenderOutput } from "@/components/mixcut-zone/types";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { SocialAccountList } from "./SocialAccountList";
import { BatchTrackingTab } from "./BatchTrackingTab";
import { ManualDistributeDialog } from "./ManualDistributeDialog";
import { DistributeWorkbench } from "./DistributeWorkbench";

export type DistributionSubpage = "workbench" | "accounts" | "jobs";

interface Props {
  subpage: DistributionSubpage;
  /** 工作台从混剪任务深链进入时的预选 jobId。仅 subpage=workbench 用 */
  fromJobId?: string;
}

const SUBPAGE_LABEL: Record<DistributionSubpage, string> = {
  workbench: "分发工作台",
  accounts: "账号管理",
  jobs: "分发进度",
};

const SUBPAGE_DESC: Record<DistributionSubpage, string> = {
  workbench: "挑选已生成的视频，绑账号、配文案，一次分发到多个平台。",
  accounts: "管理已绑定的社交账号，新增绑定 / 解绑 / 重新验证。",
  jobs: "查看每条分发任务的实时进度，按状态过滤，可重试或取消。",
};

export function DistributionShell({ subpage, fromJobId }: Props) {
  const router = useRouter();
  const [manualOpen, setManualOpen] = React.useState(false);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  // 集中拉一次三个数据源算 stats；子路由切换由 Next router 处理，
  // shell 在客户端是同一个 React tree 实例（共享 (workspace)/layout shell），所以状态在切换时不丢
  const [accounts, setAccounts] = React.useState<SocialAccount[]>([]);
  const [publishJobs, setPublishJobs] = React.useState<PublishJob[]>([]);
  const [mixcutJobs, setMixcutJobs] = React.useState<RenderJob[]>([]);

  const refreshStats = React.useCallback(async () => {
    const [acc, pubs, mix] = await Promise.allSettled([
      SocialAccountApi.listSocialAccounts(),
      PublishJobApi.listPublishJobs({}),
      MixcutApi.listJobs(),
    ]);
    if (acc.status === "fulfilled") setAccounts(acc.value ?? []);
    if (pubs.status === "fulfilled") setPublishJobs(pubs.value ?? []);
    if (mix.status === "fulfilled") setMixcutJobs(mix.value ?? []);
  }, []);

  React.useEffect(() => {
    void refreshStats();
  }, [refreshStats, refreshNonce]);

  const activeAccounts = accounts.filter((a) => a.status === "active");
  const eligibleVariants = React.useMemo(() => {
    let count = 0;
    for (const j of mixcutJobs) {
      if (j.status !== "success") continue;
      for (const o of (j.outputs ?? []) as Array<RenderOutput & { cdn_url?: string }>) {
        if (o.cdn_url) count++;
      }
    }
    return count;
  }, [mixcutJobs]);
  const inflightCount = publishJobs.filter(
    (j) => j.status !== "live" && j.status !== "failed" && j.status !== "cancelled",
  ).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-zinc-800">
              分发中心 · {SUBPAGE_LABEL[subpage]}
            </h1>
            <p className="text-xs text-zinc-500 mt-1 max-w-xl">
              {SUBPAGE_DESC[subpage]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className={cn(CTA_SECONDARY, "shrink-0")}
            title="不走视频库，直接粘贴外部视频链接分发"
          >
            <Plus className="h-3.5 w-3.5" />
            上传链接分发
          </button>
        </div>

        {/* 状态条：所有子页可见 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <StatChip
            label="已绑账号"
            value={activeAccounts.length}
            total={accounts.length}
            tone="violet"
            hint="active / 总数"
            active={subpage === "accounts"}
            onClick={() => router.push("/distribution/accounts")}
          />
          <StatChip
            label="可分发视频"
            value={eligibleVariants}
            tone="sky"
            hint="已生成 · 可立即分发"
            active={subpage === "workbench"}
            onClick={() => router.push("/distribution")}
          />
          <StatChip
            label="进行中任务"
            value={inflightCount}
            tone={inflightCount > 0 ? "amber" : "zinc"}
            hint="正在分发到各平台"
            active={subpage === "jobs"}
            onClick={() => router.push("/distribution/jobs")}
          />
        </div>
      </header>

      {/* 主区：按 subpage 渲染。v0.22 起 jobs tab 用 BatchTrackingTab（按 projectId 聚合 + 分页）。 */}
      {subpage === "workbench" && <DistributeWorkbench fromJobId={fromJobId} />}
      {subpage === "accounts" && <SocialAccountList onAccountsChange={setAccounts} />}
      {subpage === "jobs" && <BatchTrackingTab key={refreshNonce} />}

      <ManualDistributeDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={() => {
          setManualOpen(false);
          // 派单后跳到任务追踪页并触发 PublishJobList 重挂载
          router.push("/distribution/jobs");
          setRefreshNonce((n) => n + 1);
        }}
      />
    </div>
  );
}

// ─── 状态条 chip ─────────────────────────────────────────────────────────
function StatChip({
  label,
  value,
  total,
  tone,
  hint,
  active,
  onClick,
}: {
  label: string;
  value: number;
  total?: number;
  tone: "violet" | "sky" | "amber" | "zinc";
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const toneCls = {
    violet: "from-violet-50 to-violet-50/40 border-violet-200 text-violet-700",
    sky: "from-sky-50 to-sky-50/40 border-sky-200 text-sky-700",
    amber: "from-amber-50 to-amber-50/40 border-amber-200 text-amber-700",
    zinc: "from-zinc-50 to-zinc-50/40 border-zinc-200 text-zinc-700",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group text-left rounded-2xl border bg-gradient-to-br px-4 py-3 transition-all hover:shadow-[var(--shadow-soft)]",
        toneCls,
        active && "ring-2 ring-current/40 shadow-[var(--shadow-soft)]",
      )}
    >
      <div className="text-[11px] text-zinc-500 font-medium">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {total != null && total !== value && (
          <span className="text-xs text-zinc-400 font-mono">/ {total}</span>
        )}
      </div>
      {hint && <div className="text-[10px] text-zinc-500 mt-1">{hint}</div>}
    </button>
  );
}
