// ─────────────────────────────────────────────────────────────────────────────
// singers.ts — 与 specs/openapi.yaml 对齐，一切以 BACKEND_API_SPEC.md 为准
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

export type SingerStatus = "active" | "draft" | "archived";

export type SingerQuality = "common" | "rare" | "epic" | "legendary";

export type ClothingCategory = "top" | "bottom" | "accessory" | "shoes" | "hair" | "outfit";

export type PoseCategory = "standing" | "sitting" | "dancing" | "singing" | "action";

export type PoseDifficulty = "easy" | "medium" | "hard";

export type ExpressionCategory = "happy" | "sad" | "cool" | "surprised" | "other";

// ── 2.3 PersonaParams ────────────────────────────────────────────────────────

export interface PersonaParams {
  sweetness: number; // 0–100，默认 70
  energy: number;    // 0–100，默认 80
  mystery: number;   // 0–100，默认 50
}

// ── 2.2 Singer ───────────────────────────────────────────────────────────────

export interface SingerStats {
  songs: number;      // 已制作曲目数
  fans: number;       // 粉丝数量
  popularity: number; // 人气值 0–100
}

/** 装备槽位（存储各槽位已装备的 ClothingItem.id） */
export interface EquippedItems {
  top: string | null;
  bottom: string | null;
  accessory: string | null;
  shoes: string | null;
  hair: string | null;
}

/** 列表摘要视图 */
export interface SingerSummary {
  id: string;
  name: string;
  style: string;
  status: SingerStatus;
  avatarUrl: string;
}

/** 完整详情视图（扩展自摘要） */
export interface SingerDetail extends SingerSummary {
  ownerId: string;
  quality: SingerQuality;
  tags: string[];                    // 最多 10 个
  parameters: PersonaParams;
  equippedWardrobe: EquippedItems;
  activePoseId: string | null;
  activeExpressionId: string | null;
  activeGesture: string | null;
  parentAId: string | null;          // 基因混合父本 A
  parentBId: string | null;
  geneticRatio: number | null;       // 0=纯A，100=纯B
  isPublic: boolean;
  stats: SingerStats;
  createdAt: string;
  updatedAt: string;
}

// ── 2.4 OfficialIP ───────────────────────────────────────────────────────────

export interface OfficialIpTemplate {
  id: string;
  name: string;
  nameEn: string;
  avatarUrl: string;
  style: string;
  styleEn: string;
  rarity: SingerQuality;
  tags: string[];
  presetParams: PersonaParams;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

// ── 快速预设 ──────────────────────────────────────────────────────────────────

export interface PersonaPreset {
  id: string;
  name: string;
  icon: string;
  values: PersonaParams;
}

// ── 2.5 Wardrobe ─────────────────────────────────────────────────────────────

export interface WardrobeItem {
  id: string;
  name: string;
  nameEn: string;
  category: ClothingCategory;
  imageUrl: string;
  rarity: SingerQuality;
  price: number;        // 虚拟货币，0–9999
  tags: string[];
  isLocked: boolean;
  isNew: boolean;
  isTrending: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface SavedOutfit {
  id: string;
  singerId: string;
  ownerId: string;
  name: string;
  items: EquippedItems;
  createdAt: string;
}

export interface UserWardrobeItem {
  id: string;
  userId: string;
  itemId: string;
  isFavorited: boolean;
  isUnlocked: boolean;
  acquiredAt: string;
}

// ── 2.6 Pose / Expression / Gesture ─────────────────────────────────────────

export interface PosePreset {
  id: string;
  name: string;
  nameEn: string;
  category: PoseCategory;
  thumbnailUrl: string;
  animationUrl: string | null; // Phase 3 预留
  difficulty: PoseDifficulty;
  isLocked: boolean;
  isNew: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface ExpressionPreset {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  defaultIntensity: number; // 0–100，默认 80
  category: ExpressionCategory;
  sortOrder: number;
  isActive: boolean;
}

export interface GesturePreset {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  sortOrder: number;
  isActive: boolean;
}

/** 歌手当前姿态/表情/手势配置 */
export interface SingerPoseConfig {
  singerId: string;
  poseId: string | null;
  expressionId: string | null;
  expressionIntensity: number; // 0–100，默认 80
  gestureId: string | null;
  updatedAt: string;
}

// ── Workspace payload ────────────────────────────────────────────────────────

export interface SingerWorkspacePayload {
  singers: SingerDetail[];
  officialIpTemplates: OfficialIpTemplate[];
  personaPresets: PersonaPreset[];
  wardrobeCatalog: WardrobeItem[];
  poseCatalog: PosePreset[];
  expressionCatalog: ExpressionPreset[];
  gestureCatalog: GesturePreset[];
}
