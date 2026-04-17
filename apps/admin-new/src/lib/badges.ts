import { MOCK_ARTISTS } from "@/mocks/artists";
import { SignedArtists, DistributionQueue, CopyrightPending } from "@/mocks/coach";
import { SONGS, CONCERTS } from "@/mocks/music";
import { DRAMAS, MOVIES, ADS, VOICE_WORKS } from "@/mocks/film";
import { PLATFORMS } from "@/mocks/distribution";
import { EVENTS } from "@/mocks/community";
import { TRANSACTIONS } from "@/mocks/finance";
import type { SidebarBadges } from "@/components/shell/Sidebar";

/**
 * Count of actionable items across all operational modules.
 * Drives the red pill counts in the sidebar.
 */
export function computeBadges(): SidebarBadges {
  return {
    artist_trainee: MOCK_ARTISTS.filter((a) => a.status === "trainee" || a.status === "debut").length,
    contract_expiring: SignedArtists.filter(
      (a) => a.status === "expiring" || a.status === "negotiating"
    ).length,
    dist_reviewing: DistributionQueue.filter((d) => d.status === "reviewing").length,
    copyright_pending: CopyrightPending.filter((c) => c.status === "pending").length,
    songs_review: SONGS.filter((s) => s.status === "mixing" || s.status === "recording").length,
    concert_selling: CONCERTS.filter((c) => c.status === "selling").length,
    film_post: [
      ...DRAMAS.filter((d) => d.status === "post-production"),
      ...MOVIES.filter((m) => m.status === "post-production"),
      ...ADS.filter((a) => a.status === "negotiating"),
      ...VOICE_WORKS.filter((v) => v.status === "editing"),
    ].length,
    platform_pending: PLATFORMS.filter((p) => p.status === "pending").length,
    event_upcoming: EVENTS.filter((e) => e.status === "upcoming").length,
    txn_actionable: TRANSACTIONS.filter(
      (t) => t.status === "pending" || t.status === "processing"
    ).length,
  };
}

export function badgeTotal(): number {
  return Object.values(computeBadges()).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0;
}
