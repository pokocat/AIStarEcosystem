"use client";

// /distribution 顶层页面容器：上方账号管理，下方任务列表。
//
// 之所以做容器组件而不是 page.tsx 直接放：未来 drama/music 接入时只需
// 在自己的 (workspace)/distribution/page.tsx 复用 <DistributionPage />，
// 不重复实现 layout。

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { SocialAccount } from "@ai-star-eco/types/social-account";
import { SocialAccountList } from "./SocialAccountList";
import { PublishJobList } from "./PublishJobList";
import { ManualDistributeDialog } from "./ManualDistributeDialog";

export function DistributionPage() {
  // 把账号列表抬到容器：未来若同页要内嵌 DistributeDialog（从这里创建任务），
  // 已经持有 accounts；这一片不需要时也无害。
  const [, setAccounts] = React.useState<SocialAccount[]>([]);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-zinc-800">分发中心</h1>
            <p className="text-xs text-zinc-500 mt-1">
              绑定平台账号 → 从「我的项目」/「混剪库」选视频，或直接手动粘贴 URL 一键分发；任务进度实时同步。
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 手动分发：不依赖项目/混剪库，对应 sau 原生 CLI 路径。 */}
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                         border border-violet-300 text-violet-700 bg-white
                         hover:bg-violet-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              手动分发
            </button>
            {/* v0.15+: 混剪发布工作台入口 */}
            <Link
              href="/mixcut/publish"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                         bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm
                         hover:from-violet-600 hover:to-fuchsia-600 transition-colors"
            >
              从混剪库选视频发布 →
            </Link>
          </div>
        </div>
      </header>
      <SocialAccountList onAccountsChange={setAccounts} />
      <PublishJobList key={refreshNonce} />

      <ManualDistributeDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={() => {
          // 触发 PublishJobList 重挂载 → 立即拉到刚落库的 queued 行
          setRefreshNonce((n) => n + 1);
        }}
      />
    </div>
  );
}
