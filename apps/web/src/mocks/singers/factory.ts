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
    createdAt: singer.createdAt,
    songsCount: singer.songsCount,
    fansCount: singer.fansCount,
    popularity: singer.popularity,
    tags: singer.tags,
    parameters: singer.parameters
  }));

  const officialIpTemplates: OfficialIpTemplate[] = officialIpFixtures.map((template) => ({
    id: template.id,
    name: pickLocalizedText(lang, template.name),
    style: pickLocalizedText(lang, template.style),
    rarity: template.rarity,
    avatarUrl: template.avatarUrl,
    tags: template.tags,
    preset: template.preset
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
    category: item.category,
    imageUrl: item.imageUrl,
    rarity: item.rarity,
    price: item.price,
    tags: item.tags,
    isLocked: item.isLocked,
    isNew: item.isNew,
    isTrending: item.isTrending
  }));

  const poseCatalog: PosePreset[] = poseFixtures.map((pose) => ({
    id: pose.id,
    name: pickLocalizedText(lang, pose.name),
    category: pose.category,
    thumbnail: pose.thumbnail,
    difficulty: pose.difficulty,
    isLocked: pose.isLocked,
    isNew: pose.isNew
  }));

  const expressionCatalog: ExpressionPreset[] = expressionFixtures.map((expression) => ({
    id: expression.id,
    name: pickLocalizedText(lang, expression.name),
    emoji: expression.emoji,
    intensity: expression.intensity,
    category: expression.category
  }));

  const gestureCatalog: GesturePreset[] = gestureFixtures.map((gesture) => ({
    id: gesture.id,
    name: pickLocalizedText(lang, gesture.name),
    icon: gesture.icon,
    category: gesture.category
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
