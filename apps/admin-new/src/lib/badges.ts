import { MOCK_ARTISTS } from "@/mocks/artists";
import { SONGS, CONCERTS } from "@/mocks/music";
import { DRAMAS, MOVIES, ADS, VOICE_WORKS } from "@/mocks/film";
import { PLATFORMS } from "@/mocks/distribution";
import { CopyrightPending, DistributionQueue } from "@/mocks/coach";
import { EVENTS } from "@/mocks/community";
import { TRANSACTIONS } from "@/mocks/finance";
import { ACCOUNTS } from "@/mocks/accounts";
import { LICENSE_BATCHES } from "@/mocks/licenses";
import type { SidebarBadges } from "@/components/shell/Sidebar";

/**
 * Count of actionable items across all operational modules.
 * Drives the red pill counts in the sidebar.
 */
export function computeBadges(): SidebarBadges {
  return {
    // 平台账户
    account_suspended: ACCOUNTS.filter((a) => a.status === "suspended").length,
    license_low: LICENSE_BATCHES.filter(
      (b) => b.status === "active" && b.activatedCount / b.totalCount >= 0.9
    ).length,

    // AI 艺人
    artist_trainee: MOCK_ARTISTS.filter((a) => a.status === "trainee" || a.status === "debut").length,

    // AI 作品
    songs_review: SONGS.filter((s) => s.status === "mixing" || s.status === "recording").length,
    concert_selling: CONCERTS.filter((c) => c.status === "selling").length,
    film_post: [
      ...DRAMAS.filter((d) => d.status === "post-production"),
      ...MOVIES.filter((m) => m.status === "post-production"),
      ...ADS.filter((a) => a.status === "negotiating"),
      ...VOICE_WORKS.filter((v) => v.status === "editing"),
    ].length,
    copyright_pending: CopyrightPending.filter((c) => c.status === "pending").length,

    // 分发与变现
    platform_pending: PLATFORMS.filter((p) => p.status === "pending").length,
    dist_reviewing: DistributionQueue.filter((d) => d.status === "reviewing").length,
    txn_actionable: TRANSACTIONS.filter(
      (t) => t.status === "pending" || t.status === "processing"
    ).length,

    // 社群
    event_upcoming: EVENTS.filter((e) => e.status === "upcoming").length,
  };
}

export function badgeTotal(): number {
  return Object.values(computeBadges()).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0;
}
