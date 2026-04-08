import { localized, type LocalizedText } from "@/mocks/shared";
import type { ChartTrend, TrackStatus } from "@/types/contracts/tracks";

export interface RawTrackFixture {
  id: string;
  title: LocalizedText;
  style: string;
  durationSec: number;
  durationLabel: string;
  status: TrackStatus;
  date: string;
  plays: number;
}

export interface RawChartFixture {
  id: string;
  title: string;
  artist: string;
  votes: number;
  trend: ChartTrend;
  coverUrl: string;
}

export const trackFixtures: RawTrackFixture[] = [
  { id: "track-101", title: localized("Neon Tears", "Neon Tears"), style: "Synthwave", durationSec: 214, durationLabel: "3:34", status: "Published", date: "2026-03-10", plays: 450000 },
  { id: "track-102", title: localized("Cyber City Vibe", "Cyber City Vibe"), style: "Future Bass", durationSec: 188, durationLabel: "3:08", status: "Draft", date: "2026-03-12", plays: 0 },
  { id: "track-103", title: localized("Electric Dreams", "Electric Dreams"), style: "Cyberpunk Pop", durationSec: 205, durationLabel: "3:25", status: "Published", date: "2026-03-18", plays: 980000 }
];

export const chartFixtures: RawChartFixture[] = [
  { id: "chart-1", title: "Neon Rain", artist: "Neon V", votes: 12450, trend: "up", coverUrl: "https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=400&q=80" },
  { id: "chart-2", title: "Cyber Heartbeat", artist: "Project: Zero", votes: 10890, trend: "up", coverUrl: "https://images.unsplash.com/photo-1514525253440-b393452e2347?w=400&q=80" },
  { id: "chart-3", title: "Digital Tears", artist: "Luna Soft", votes: 9800, trend: "down", coverUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80" },
  { id: "chart-4", title: "Void Echo", artist: "Echo Bot", votes: 8500, trend: "same", coverUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&q=80" },
  { id: "chart-5", title: "System Error", artist: "Glitch Gang", votes: 7200, trend: "up", coverUrl: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&q=80" }
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

export const generationStageFixtures = ["Analyzing", "Composing", "Arranging", "Mastering", "Finalizing"];
