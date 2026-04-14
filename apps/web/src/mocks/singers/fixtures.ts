import { localized, type LocalizedText } from "@/mocks/shared";
import type {
  ClothingCategory,
  ExpressionCategory,
  PoseCategory,
  PoseDifficulty,
  SingerQuality,
  SingerStatus
} from "@/types/contracts/singers";

export interface RawSingerFixture {
  id: string;
  name: LocalizedText;
  style: LocalizedText;
  status: SingerStatus;
  quality: SingerQuality;
  avatarUrl: string;
  createdAt: string;
  songsCount: number;
  fansCount: number;
  popularity: number;
  tags: string[];
  parameters: {
    sweetness: number;
    energy: number;
    mystery: number;
  };
}

export interface RawOfficialIpFixture {
  id: string;
  name: LocalizedText;
  nameEn: string;
  style: LocalizedText;
  styleEn: string;
  rarity: SingerQuality;
  avatarUrl: string;
  tags: string[];
  presetParams: {
    sweetness: number;
    energy: number;
    mystery: number;
  };
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface RawPersonaPresetFixture {
  id: string;
  name: LocalizedText;
  icon: string;
  values: {
    sweetness: number;
    energy: number;
    mystery: number;
  };
}

export interface RawWardrobeFixture {
  id: string;
  name: LocalizedText;
  nameEn: string;
  category: ClothingCategory;
  imageUrl: string;
  rarity: SingerQuality;
  price: number;
  tags: string[];
  isLocked: boolean;
  isNew: boolean;
  isTrending: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface RawPoseFixture {
  id: string;
  name: LocalizedText;
  nameEn: string;
  category: PoseCategory;
  thumbnailUrl: string;
  difficulty: PoseDifficulty;
  isLocked: boolean;
  isNew: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface RawExpressionFixture {
  id: string;
  name: LocalizedText;
  nameEn: string;
  emoji: string;
  defaultIntensity: number;
  category: ExpressionCategory;
  sortOrder: number;
  isActive: boolean;
}

export interface RawGestureFixture {
  id: string;
  name: LocalizedText;
  nameEn: string;
  emoji: string;
  sortOrder: number;
  isActive: boolean;
}

export const singerFixtures: RawSingerFixture[] = [
  {
    id: "singer-1",
    name: localized("霓虹战士", "Neon Warrior"),
    style: localized("电子舞曲", "EDM"),
    status: "active",
    quality: "legendary",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
    createdAt: "2026-03-15T00:00:00Z",
    songsCount: 12,
    fansCount: 58200,
    popularity: 95,
    tags: ["cyberpunk", "edm", "female"],
    parameters: { sweetness: 40, energy: 95, mystery: 80 }
  },
  {
    id: "singer-2",
    name: localized("云裳仙子", "Cloud Fairy"),
    style: localized("古风流行", "Ancient Pop"),
    status: "active",
    quality: "epic",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
    createdAt: "2026-03-20T00:00:00Z",
    songsCount: 8,
    fansCount: 32100,
    popularity: 88,
    tags: ["traditional", "pop", "elegant"],
    parameters: { sweetness: 90, energy: 60, mystery: 70 }
  },
  {
    id: "singer-3",
    name: localized("星际漂流", "Stellar Drift"),
    style: localized("太空摇滚", "Space Rock"),
    status: "draft",
    quality: "rare",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400",
    createdAt: "2026-03-28T00:00:00Z",
    songsCount: 3,
    fansCount: 8900,
    popularity: 72,
    tags: ["rock", "space", "experimental"],
    parameters: { sweetness: 55, energy: 82, mystery: 76 }
  },
  {
    id: "singer-4",
    name: localized("午夜DJ", "Midnight DJ"),
    style: localized("深宅电音", "Deep House"),
    status: "active",
    quality: "epic",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
    createdAt: "2026-03-10T00:00:00Z",
    songsCount: 15,
    fansCount: 42300,
    popularity: 90,
    tags: ["house", "electronic", "party"],
    parameters: { sweetness: 62, energy: 91, mystery: 58 }
  }
];

export const officialIpFixtures: RawOfficialIpFixture[] = [
  {
    id: "ip-1",
    name: localized("霓虹战士", "Neon Warrior"),
    nameEn: "Neon Warrior",
    style: localized("电子舞曲", "EDM"),
    styleEn: "EDM",
    rarity: "legendary",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
    tags: ["cyberpunk", "edm"],
    presetParams: { sweetness: 40, energy: 95, mystery: 80 },
    isActive: true,
    sortOrder: 1,
    createdAt: "2026-01-01T00:00:00Z"
  },
  {
    id: "ip-2",
    name: localized("云裳仙子", "Cloud Fairy"),
    nameEn: "Cloud Fairy",
    style: localized("古风流行", "Ancient Pop"),
    styleEn: "Ancient Pop",
    rarity: "epic",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
    tags: ["traditional", "elegant"],
    presetParams: { sweetness: 90, energy: 60, mystery: 70 },
    isActive: true,
    sortOrder: 2,
    createdAt: "2026-01-01T00:00:00Z"
  },
  {
    id: "ip-3",
    name: localized("机械核心", "Mech Core"),
    nameEn: "Mech Core",
    style: localized("工业摇滚", "Industrial Rock"),
    styleEn: "Industrial Rock",
    rarity: "epic",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400",
    tags: ["rock", "mechanical"],
    presetParams: { sweetness: 30, energy: 90, mystery: 85 },
    isActive: true,
    sortOrder: 3,
    createdAt: "2026-01-01T00:00:00Z"
  },
  {
    id: "ip-4",
    name: localized("星辰歌者", "Star Singer"),
    nameEn: "Star Singer",
    style: localized("梦幻流行", "Dream Pop"),
    styleEn: "Dream Pop",
    rarity: "rare",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
    tags: ["dreamy", "pop"],
    presetParams: { sweetness: 85, energy: 70, mystery: 75 },
    isActive: true,
    sortOrder: 4,
    createdAt: "2026-01-01T00:00:00Z"
  }
];

export const personaPresetFixtures: RawPersonaPresetFixture[] = [
  { id: "preset-1", name: localized("甜美少女", "Sweet Girl"), icon: "🌸", values: { sweetness: 95, energy: 75, mystery: 40 } },
  { id: "preset-2", name: localized("冷酷女王", "Cool Queen"), icon: "👑", values: { sweetness: 30, energy: 85, mystery: 90 } },
  { id: "preset-3", name: localized("活力青春", "Energetic Youth"), icon: "⚡", values: { sweetness: 70, energy: 95, mystery: 50 } },
  { id: "preset-4", name: localized("神秘精灵", "Mystic Elf"), icon: "🌙", values: { sweetness: 60, energy: 55, mystery: 95 } }
];

export const wardrobeFixtures: RawWardrobeFixture[] = [
  { id: "t1", name: localized("赛博夹克", "Cyber Jacket"), nameEn: "Cyber Jacket", category: "top", imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300", rarity: "epic", price: 299, tags: ["cyberpunk", "jacket"], isNew: true, isLocked: false, isTrending: false, sortOrder: 1, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "t2", name: localized("霓虹T恤", "Neon Tee"), nameEn: "Neon Tee", category: "top", imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=300", rarity: "common", price: 99, tags: ["casual", "neon"], isNew: false, isLocked: false, isTrending: true, sortOrder: 2, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "t3", name: localized("全息外套", "Holo Coat"), nameEn: "Holo Coat", category: "top", imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300", rarity: "legendary", price: 999, tags: ["hologram", "premium"], isNew: false, isLocked: true, isTrending: false, sortOrder: 3, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "b1", name: localized("霓虹裤", "Neon Pants"), nameEn: "Neon Pants", category: "bottom", imageUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=300", rarity: "common", price: 199, tags: ["pants", "neon"], isNew: false, isLocked: false, isTrending: false, sortOrder: 4, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "b2", name: localized("机械战裤", "Mech Pants"), nameEn: "Mech Pants", category: "bottom", imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=300", rarity: "epic", price: 499, tags: ["mechanical", "combat"], isNew: false, isLocked: false, isTrending: false, sortOrder: 5, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "a1", name: localized("全息护目镜", "Holo Goggles"), nameEn: "Holo Goggles", category: "accessory", imageUrl: "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=300", rarity: "epic", price: 599, tags: ["goggles", "tech"], isNew: false, isLocked: false, isTrending: false, sortOrder: 6, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "a2", name: localized("赛博项圈", "Cyber Collar"), nameEn: "Cyber Collar", category: "accessory", imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300", rarity: "rare", price: 299, tags: ["collar", "neon"], isNew: true, isLocked: false, isTrending: false, sortOrder: 7, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "s1", name: localized("霓虹战靴", "Neon Boots"), nameEn: "Neon Boots", category: "shoes", imageUrl: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=300", rarity: "rare", price: 399, tags: ["boots", "combat"], isNew: false, isLocked: false, isTrending: false, sortOrder: 8, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "s2", name: localized("悬浮鞋", "Hover Shoes"), nameEn: "Hover Shoes", category: "shoes", imageUrl: "https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=300", rarity: "legendary", price: 1499, tags: ["hover", "future"], isNew: false, isLocked: true, isTrending: false, sortOrder: 9, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "h1", name: localized("霓虹双马尾", "Neon Twintails"), nameEn: "Neon Twintails", category: "hair", imageUrl: "https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=300", rarity: "rare", price: 399, tags: ["twintails", "colorful"], isNew: false, isLocked: false, isTrending: false, sortOrder: 10, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "h2", name: localized("量子短发", "Quantum Bob"), nameEn: "Quantum Bob", category: "hair", imageUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300", rarity: "common", price: 199, tags: ["short", "modern"], isNew: true, isLocked: false, isTrending: false, sortOrder: 11, isActive: true, createdAt: "2026-01-01T00:00:00Z" }
];

export const poseFixtures: RawPoseFixture[] = [
  { id: "pose-1", name: localized("自信站姿", "Confident Stand"), nameEn: "Confident Stand", category: "standing", thumbnailUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300", difficulty: "easy", isNew: true, isLocked: false, sortOrder: 1, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "pose-2", name: localized("休闲倚靠", "Casual Lean"), nameEn: "Casual Lean", category: "standing", thumbnailUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300", difficulty: "easy", isNew: false, isLocked: false, sortOrder: 2, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "pose-3", name: localized("超模姿态", "Model Pose"), nameEn: "Model Pose", category: "standing", thumbnailUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300", difficulty: "medium", isNew: false, isLocked: false, sortOrder: 3, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "pose-4", name: localized("优雅端坐", "Elegant Sit"), nameEn: "Elegant Sit", category: "sitting", thumbnailUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300", difficulty: "easy", isNew: false, isLocked: false, sortOrder: 4, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "pose-5", name: localized("爵士舞步", "Jazz Dance"), nameEn: "Jazz Dance", category: "dancing", thumbnailUrl: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=300", difficulty: "hard", isNew: false, isLocked: false, sortOrder: 5, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "pose-6", name: localized("麦克风握姿", "Mic Hold"), nameEn: "Mic Hold", category: "singing", thumbnailUrl: "https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=300", difficulty: "easy", isNew: false, isLocked: false, sortOrder: 6, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "pose-7", name: localized("飞吻动作", "Blow Kiss"), nameEn: "Blow Kiss", category: "action", thumbnailUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300", difficulty: "easy", isNew: false, isLocked: false, sortOrder: 7, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "pose-8", name: localized("战斗姿态", "Combat Stance"), nameEn: "Combat Stance", category: "standing", thumbnailUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300", difficulty: "hard", isNew: false, isLocked: true, sortOrder: 8, isActive: true, createdAt: "2026-01-01T00:00:00Z" }
];

export const expressionFixtures: RawExpressionFixture[] = [
  { id: "exp-1", name: localized("开心", "Happy"), nameEn: "Happy", emoji: "😊", defaultIntensity: 80, category: "happy", sortOrder: 1, isActive: true },
  { id: "exp-2", name: localized("大笑", "Laughing"), nameEn: "Laughing", emoji: "😆", defaultIntensity: 100, category: "happy", sortOrder: 2, isActive: true },
  { id: "exp-3", name: localized("微笑", "Smile"), nameEn: "Smile", emoji: "🙂", defaultIntensity: 60, category: "happy", sortOrder: 3, isActive: true },
  { id: "exp-4", name: localized("悲伤", "Sad"), nameEn: "Sad", emoji: "😢", defaultIntensity: 70, category: "sad", sortOrder: 4, isActive: true },
  { id: "exp-5", name: localized("酷炫", "Cool"), nameEn: "Cool", emoji: "😎", defaultIntensity: 85, category: "cool", sortOrder: 5, isActive: true },
  { id: "exp-6", name: localized("惊讶", "Surprised"), nameEn: "Surprised", emoji: "😲", defaultIntensity: 80, category: "surprised", sortOrder: 6, isActive: true },
  { id: "exp-7", name: localized("害羞", "Shy"), nameEn: "Shy", emoji: "😳", defaultIntensity: 70, category: "other", sortOrder: 7, isActive: true },
  { id: "exp-8", name: localized("爱心", "Love"), nameEn: "Love", emoji: "😍", defaultIntensity: 90, category: "happy", sortOrder: 8, isActive: true }
];

export const gestureFixtures: RawGestureFixture[] = [
  { id: "gesture-1", name: localized("比心", "Heart"), nameEn: "Heart", emoji: "❤️", sortOrder: 1, isActive: true },
  { id: "gesture-2", name: localized("点赞", "Thumbs Up"), nameEn: "Thumbs Up", emoji: "👍", sortOrder: 2, isActive: true },
  { id: "gesture-3", name: localized("和平手势", "Peace"), nameEn: "Peace", emoji: "✌️", sortOrder: 3, isActive: true },
  { id: "gesture-4", name: localized("摇滚手势", "Rock On"), nameEn: "Rock On", emoji: "🤘", sortOrder: 4, isActive: true },
  { id: "gesture-5", name: localized("挥手", "Wave"), nameEn: "Wave", emoji: "👋", sortOrder: 5, isActive: true }
];
