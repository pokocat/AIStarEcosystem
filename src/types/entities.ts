export type Locale = 'zh' | 'en';

/**
 * 顶层应用视图：Landing + 三个角色工作台
 */
export type ViewMode = 'home' | 'producer' | 'fan' | 'coach';

/**
 * Producer 工作台主区块（兼容「编辑器 / Studio / 孵化器」等复杂场景）
 */
export type ActiveSection =
  | 'dashboard'
  | 'mcn'
  | 'incubator'
  | 'persona'
  | 'studio'
  | 'mint'
  | 'editor'
  | 'distribution'
  | 'matrixDistribution'
  | 'community'
  | 'finance';

export type SingerStatus = 'active' | 'draft' | 'archived';
export type QualityTier = 'common' | 'rare' | 'epic' | 'legendary';

export type StudioMode =
  | 'text'
  | 'melody'
  | 'advanced'
  | 'interactive'
  | 'lyricsToSong'
  | 'inspiration'
  | 'imageToSong'
  | 'remixHit'
  | 'funMode'
  | 'acrostic'
  | 'giftSong';

export type GenerationStage =
  | 'idle'
  | 'analyzing'
  | 'composing'
  | 'arranging'
  | 'mastering'
  | 'finalizing'
  | 'success'
  | 'error';

export type WardrobeCategory =
  | 'top'
  | 'bottom'
  | 'accessory'
  | 'shoes'
  | 'hair'
  | 'outfit';

export type PoseCategory = 'standing' | 'sitting' | 'dancing' | 'singing' | 'action';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type ExpressionCategory = 'happy' | 'sad' | 'cool' | 'surprised' | 'other';

export interface GlobalAudioState {
  currentTrackId: string | null;
  queue: string[];
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  volume: number; // 0-1
  isMuted: boolean;
  repeatMode: 'off' | 'one' | 'all';
  shuffle: boolean;
}

export interface Persona {
  singerId: string;
  sweetness: number; // 0-100
  energy: number; // 0-100
  mystery: number; // 0-100
  preset?: 'sweetGirl' | 'coolQueen' | 'youthful' | 'mysticElf' | null;
  traits: string[];
  voiceTone?: string;
  language: Locale;
}

export interface SingerStats {
  songs: number;
  fans: number;
  popularity: number; // 0-100
}

export interface WardrobeItem {
  id: string;
  name: string;
  category: WardrobeCategory;
  imageUrl: string;
  rarity: QualityTier;
  price: number;
  tags: string[];
  isLocked?: boolean;
  isNew?: boolean;
  isTrending?: boolean;
}

export interface WardrobeLoadout {
  top?: string;
  bottom?: string;
  accessory?: string;
  shoes?: string;
  hair?: string;
  outfit?: string;
}

export interface PoseState {
  poseId?: string;
  poseCategory?: PoseCategory;
  expressionId?: string;
  expressionIntensity?: number; // 0-100
  gestureId?: string;
}

export interface Singer {
  id: string;
  name: string;
  avatar: string;
  style: string;
  status: SingerStatus;
  quality: QualityTier;
  createdAt: string; // ISO
  tags: string[];
  stats: SingerStats;
  persona: Persona;
  wardrobe: WardrobeLoadout;
  wardrobeInventory: WardrobeItem[];
  favoriteWardrobeItemIds: string[];
  savedOutfitIds: string[];
  pose: PoseState;
}

export interface Track {
  id: string;
  singerId: string;
  title: string;
  mode: StudioMode;
  status: 'draft' | 'processing' | 'published' | 'failed';
  generationStage: GenerationStage;
  bpm?: number;
  key?: string;
  durationSec?: number;
  lyrics?: string;
  prompt?: string;
  audioUrl?: string;
  waveformUrl?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface MintMetadata {
  collectionName: string;
  tokenName: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  externalUrl?: string;
  animationUrl?: string;
  supply: number;
  royaltyPercent: number;
  rarity: QualityTier;
  chain: 'ethereum' | 'polygon' | 'solana';
  contractAddress?: string;
}

export interface FinancialRecord {
  id: string;
  type: 'streaming' | 'nftSale' | 'tip' | 'withdrawal' | 'platformFee' | 'other';
  amount: number;
  currency: 'CNY' | 'USD' | 'ETH';
  direction: 'in' | 'out';
  status: 'completed' | 'processing' | 'failed';
  timestamp: string; // ISO
  referenceId?: string;
  description: string;
  counterparty?: string;
}
