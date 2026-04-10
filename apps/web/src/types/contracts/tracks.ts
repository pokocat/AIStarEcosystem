export type TrackStatus = "Published" | "Draft" | "Processing";
export type ChartTrend = "up" | "down" | "same";

export interface TrackSummary {
  id: string;
  title: string;
  style: string;
  durationSec: number;
  durationLabel: string;
  status: TrackStatus;
  date: string;
  plays: number;
}

export interface TrackGenerationRequest {
  prompt: string;
  style: string;
  durationSec: number;
  mode: string;
  singerId?: string;
}

export interface ChartEntry {
  id: string;
  title: string;
  artist: string;
  votes: number;
  trend: ChartTrend;
  coverUrl: string;
}

export interface TrackLyricLine {
  time: number;
  text: string;
}

export interface DiscoverySpotlight {
  badge: string;
  title: string;
  artist: string;
  coverUrl: string;
  subtitle: string;
}

export interface RecommendationTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
}

export interface TrackWorkspacePayload {
  tracks: TrackSummary[];
  chartEntries: ChartEntry[];
  lyrics: TrackLyricLine[];
  discoverySpotlight: DiscoverySpotlight;
  recommendations: RecommendationTrack[];
  generationStages: string[];
}
