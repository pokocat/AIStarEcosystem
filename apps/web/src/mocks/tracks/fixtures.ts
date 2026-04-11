import { localized, type LocalizedText } from "@/mocks/shared";
import type { ChartEntry, GenerationStage, TrackStatus } from "@/types/contracts/tracks";

export interface RawTrackFixture {
  id: string;
  title: LocalizedText;
  style: string;
  durationSec: number;
  status: TrackStatus;
  createdAt: string;
  playCount: number;
}

export const trackFixtures: RawTrackFixture[] = [
  { id: "track-101", title: localized("Neon Tears", "Neon Tears"), style: "Synthwave", durationSec: 214, status: "published", createdAt: "2026-03-10T00:00:00Z", playCount: 450000 },
  { id: "track-102", title: localized("Cyber City Vibe", "Cyber City Vibe"), style: "Future Bass", durationSec: 188, status: "draft", createdAt: "2026-03-12T00:00:00Z", playCount: 0 },
  { id: "track-103", title: localized("Electric Dreams", "Electric Dreams"), style: "Cyberpunk Pop", durationSec: 205, status: "published", createdAt: "2026-03-18T00:00:00Z", playCount: 980000 }
];

export const chartFixtures: ChartEntry[] = [
  { id: "chart-1", chartId: "chart-weekly", trackId: "track-201", singerId: "singer-1", title: "Neon Rain", artistName: "Neon V", votes: 12450, trend: "up", coverUrl: "https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=400&q=80", rank: 1, prevRank: 2, updatedAt: "2026-04-11T00:00:00Z" },
  { id: "chart-2", chartId: "chart-weekly", trackId: "track-202", singerId: "singer-2", title: "Cyber Heartbeat", artistName: "Project: Zero", votes: 10890, trend: "up", coverUrl: "https://images.unsplash.com/photo-1514525253440-b393452e2347?w=400&q=80", rank: 2, prevRank: 4, updatedAt: "2026-04-11T00:00:00Z" },
  { id: "chart-3", chartId: "chart-weekly", trackId: "track-203", singerId: "singer-3", title: "Digital Tears", artistName: "Luna Soft", votes: 9800, trend: "down", coverUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80", rank: 3, prevRank: 1, updatedAt: "2026-04-11T00:00:00Z" },
  { id: "chart-4", chartId: "chart-weekly", trackId: "track-204", singerId: "singer-4", title: "Void Echo", artistName: "Echo Bot", votes: 8500, trend: "same", coverUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&q=80", rank: 4, prevRank: 4, updatedAt: "2026-04-11T00:00:00Z" },
  { id: "chart-5", chartId: "chart-weekly", trackId: "track-205", singerId: "singer-1", title: "System Error", artistName: "Glitch Gang", votes: 7200, trend: "up", coverUrl: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&q=80", rank: 5, prevRank: 7, updatedAt: "2026-04-11T00:00:00Z" }
];

export const lyricFixtures = [
  { time: 0, text: "Neon rain falling down..." },
  { time: 4, text: "Washing away the dust of this town." },
  { time: 8, text: "I see your ghost in the hologram," },
  { time: 12, text: "Running through the wires, who I am?" },
  { time: 16, text: "(Instrumental Break)" },
  { time: 24, text: "Cyber heart, beating slow," },
  { time: 28, text: "Where the data streams, there I go." }
];

export const generationStageFixtures: GenerationStage[] = [
  "analyzing",
  "composing",
  "arranging",
  "mixing",
  "mastering",
  "finalizing"
];
