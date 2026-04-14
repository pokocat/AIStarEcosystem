import { pickLocalizedText } from "@/mocks/shared";
import type { Lang } from "@/types/app";
import type {
  ExpressionPreset,
  GesturePreset,
  OfficialIpTemplate,
  PersonaPreset,
  PosePreset,
  SingerDetail,
  SingerWorkspacePayload,
  WardrobeItem
} from "@/types/contracts/singers";
import {
  expressionFixtures,
  gestureFixtures,
  officialIpFixtures,
  personaPresetFixtures,
  poseFixtures,
  singerFixtures,
  wardrobeFixtures
} from "@/mocks/singers/fixtures";

export function buildSingerWorkspace(lang: Lang): SingerWorkspacePayload {
  const singers: SingerDetail[] = singerFixtures.map((singer) => ({
    id: singer.id,
    name: pickLocalizedText(lang, singer.name),
    style: pickLocalizedText(lang, singer.style),
    status: singer.status,
    quality: singer.quality,
    avatarUrl: singer.avatarUrl,
    ownerId: "user-demo",
    tags: singer.tags,
    parameters: singer.parameters,
    equippedWardrobe: {
      top: null,
      bottom: null,
      accessory: null,
      shoes: null,
      hair: null
    },
    activePoseId: null,
    activeExpressionId: null,
    activeGesture: null,
    parentAId: null,
    parentBId: null,
    geneticRatio: null,
    isPublic: singer.status === "active",
    stats: {
      songs: singer.songsCount,
      fans: singer.fansCount,
      popularity: singer.popularity
    },
    createdAt: singer.createdAt,
    updatedAt: singer.createdAt
  }));

  const officialIpTemplates: OfficialIpTemplate[] = officialIpFixtures.map((template) => ({
    id: template.id,
    name: pickLocalizedText(lang, template.name),
    nameEn: template.nameEn,
    style: pickLocalizedText(lang, template.style),
    styleEn: template.styleEn,
    rarity: template.rarity,
    avatarUrl: template.avatarUrl,
    tags: template.tags,
    presetParams: template.presetParams,
    isActive: template.isActive,
    sortOrder: template.sortOrder,
    createdAt: template.createdAt
  }));

  const personaPresets: PersonaPreset[] = personaPresetFixtures.map((preset) => ({
    id: preset.id,
    name: pickLocalizedText(lang, preset.name),
    icon: preset.icon,
    values: preset.values
  }));

  const wardrobeCatalog: WardrobeItem[] = wardrobeFixtures.map((item) => ({
    id: item.id,
    name: pickLocalizedText(lang, item.name),
    nameEn: item.nameEn,
    category: item.category,
    imageUrl: item.imageUrl,
    rarity: item.rarity,
    price: item.price,
    tags: item.tags,
    isLocked: item.isLocked,
    isNew: item.isNew,
    isTrending: item.isTrending,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    createdAt: item.createdAt
  }));

  const poseCatalog: PosePreset[] = poseFixtures.map((pose) => ({
    id: pose.id,
    name: pickLocalizedText(lang, pose.name),
    nameEn: pose.nameEn,
    category: pose.category,
    thumbnailUrl: pose.thumbnailUrl,
    animationUrl: null,
    difficulty: pose.difficulty,
    isLocked: pose.isLocked,
    isNew: pose.isNew,
    sortOrder: pose.sortOrder,
    isActive: pose.isActive,
    createdAt: pose.createdAt
  }));

  const expressionCatalog: ExpressionPreset[] = expressionFixtures.map((expression) => ({
    id: expression.id,
    name: pickLocalizedText(lang, expression.name),
    nameEn: expression.nameEn,
    emoji: expression.emoji,
    defaultIntensity: expression.defaultIntensity,
    category: expression.category,
    sortOrder: expression.sortOrder,
    isActive: expression.isActive
  }));

  const gestureCatalog: GesturePreset[] = gestureFixtures.map((gesture) => ({
    id: gesture.id,
    name: pickLocalizedText(lang, gesture.name),
    nameEn: gesture.nameEn,
    emoji: gesture.emoji,
    sortOrder: gesture.sortOrder,
    isActive: gesture.isActive
  }));

  return {
    singers,
    officialIpTemplates,
    personaPresets,
    wardrobeCatalog,
    poseCatalog,
    expressionCatalog,
    gestureCatalog
  };
}
