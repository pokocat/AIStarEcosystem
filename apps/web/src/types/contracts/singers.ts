export interface PersonaParams {
  sweetness: number;
  energy: number;
  mystery: number;
}

export type SingerStatus = "active" | "draft" | "archived";
export type SingerQuality = "common" | "rare" | "epic" | "legendary";

export interface SingerSummary {
  id: string;
  name: string;
  style: string;
  status: SingerStatus;
  avatarUrl: string;
}

export interface SingerDetail extends SingerSummary {
  quality: SingerQuality;
  createdAt: string;
  songsCount: number;
  fansCount: number;
  popularity: number;
  tags: string[];
  parameters: PersonaParams;
}

export interface OfficialIpTemplate {
  id: string;
  name: string;
  avatarUrl: string;
  style: string;
  rarity: SingerQuality;
  tags: string[];
  preset: PersonaParams;
}

export interface PersonaPreset {
  id: string;
  name: string;
  icon: string;
  values: PersonaParams;
}

export type WardrobeCategory = "top" | "bottom" | "accessory" | "shoes" | "hair" | "outfit";

export interface WardrobeItem {
  id: string;
  name: string;
  category: WardrobeCategory;
  imageUrl: string;
  rarity: SingerQuality;
  price: number;
  tags: string[];
  isLocked?: boolean;
  isNew?: boolean;
  isTrending?: boolean;
}

export type PoseCategory = "standing" | "sitting" | "dancing" | "singing" | "action";
export type PoseDifficulty = "easy" | "medium" | "hard";

export interface PosePreset {
  id: string;
  name: string;
  category: PoseCategory;
  thumbnail: string;
  difficulty: PoseDifficulty;
  isLocked?: boolean;
  isNew?: boolean;
}

export type ExpressionCategory = "happy" | "sad" | "cool" | "surprised" | "other";

export interface ExpressionPreset {
  id: string;
  name: string;
  emoji: string;
  intensity: number;
  category: ExpressionCategory;
}

export interface GesturePreset {
  id: string;
  name: string;
  icon: string;
  category: string;
}

export interface SingerWorkspacePayload {
  singers: SingerDetail[];
  officialIpTemplates: OfficialIpTemplate[];
  personaPresets: PersonaPreset[];
  wardrobeCatalog: WardrobeItem[];
  poseCatalog: PosePreset[];
  expressionCatalog: ExpressionPreset[];
  gestureCatalog: GesturePreset[];
}
