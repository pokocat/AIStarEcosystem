// ─────────────────────────────────────────────────────────────────────────────
// useSidebarBadges — 侧栏红点角标实时取数 hook。
//
// 设计原则：**每个 badge 必须与对应页面看到的数据严格一致**。
// 因此使用「和对应页面同一份 API 拉取 → 同一份过滤条件」。
// 这样避免「角标显示 2，但点进去是空」的不一致。
//
// 角标 key 与页面 / 过滤逻辑对照：
//   account_suspended  → /platform/accounts        users.status === "suspended"
//   license_low        → /platform/licenses        status=active 且 activated/total ≥ 90%
//   artist_trainee     → /artists/lifecycle        status ∈ {trainee, debut}
//   songs_review       → /content/songs            status ∈ {recording, mixing}
//   concert_selling    → /content/concerts         status === "selling"
//   copyright_pending  → /content/copyright        status === "pending"
//   platform_pending   → /distribution/platforms   status === "pending"
//   dist_reviewing     → /distribution/queue       status === "reviewing"
//   txn_actionable     → /finance/ledger           status ∈ {pending, processing}
//   event_upcoming     → /community/events         status === "upcoming"
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import type { SidebarBadges } from "@/components/shell/Sidebar";
import { listUsers } from "@/api/users";
import { listBatches } from "@/api/licenses";
import { listDigitalIps } from "@/api/digital-ips";
import { listSongs, listConcerts } from "@/api/music";
import { listPendingCopyright, listDistributionQueue } from "@/api/coach";
import { listPlatforms } from "@/api/distribution";
import { listTransactions } from "@/api/finance";
import { listEvents } from "@/api/community";

export function useSidebarBadges(enabled = true): SidebarBadges {
  const [badges, setBadges] = React.useState<SidebarBadges>({});

  React.useEffect(() => {
    if (!enabled) {
      setBadges({});
      return;
    }

    let alive = true;

    (async () => {
      const safe = <T,>(p: Promise<T[]>): Promise<T[]> =>
        p.then((v) => v ?? []).catch(() => [] as T[]);

      const [
        users, batches, artists, songs, concerts,
        copyright, platforms, queue, txns, events,
      ] = await Promise.all([
        safe(listUsers(0, 500)),
        safe(listBatches(0, 200)),
        safe(listDigitalIps(0, 500)),
        safe(listSongs()),
        safe(listConcerts()),
        safe(listPendingCopyright()),
        safe(listPlatforms()),
        safe(listDistributionQueue()),
        safe(listTransactions()),
        safe(listEvents()),
      ]);

      if (!alive) return;

      setBadges({
        account_suspended: users.filter((u) => u.status === "suspended").length,
        license_low: batches.filter(
          (b) => b.status === "active" && b.totalCount > 0 && b.activatedCount / b.totalCount >= 0.9
        ).length,
        artist_trainee: artists.filter((a) => a.status === "trainee" || a.status === "debut").length,
        songs_review: songs.filter((s) => s.status === "recording" || s.status === "mixing").length,
        concert_selling: concerts.filter((c) => c.status === "selling").length,
        copyright_pending: copyright.filter((c) => c.status === "pending").length,
        platform_pending: platforms.filter((p) => p.status === "pending").length,
        dist_reviewing: queue.filter((d) => d.status === "reviewing").length,
        txn_actionable: txns.filter((t) => t.status === "pending" || t.status === "processing").length,
        event_upcoming: events.filter((e) => e.status === "upcoming").length,
      });
    })();

    return () => { alive = false; };
  }, [enabled]);

  return badges;
}
