import type { ScriptMeta } from "@/api/short-drama";
import type { ShortContinuityManifest } from "@/api/short-drama";
import type { ShortVisualBible } from "@/api/shorts";

export interface ShortRenderPromptShot {
  visual: string;
  size?: string;
  move?: string;
  beat?: string;
  voWho?: string;
  voText?: string;
  sfx?: string;
  bgm?: string;
  fx?: string;
  /** 提示词直出线：本镜出场人物名 / 场景名（缺失 = 未标注 → 全员 / 主场景）。 */
  castNames?: string[];
  sceneName?: string;
}

interface BuildShortRenderVarsInput {
  meta: ScriptMeta | null;
  shot: ShortRenderPromptShot;
  styleName: string;
  manifest?: ShortContinuityManifest | null;
  shotId?: string;
  /**
   * v0.143 提示词直出：用户自己写的全片画面基调。人物与场景锚点已经由服务端写进
   * manifest（characters[].visualTraits / scenes[].visualTraits），这里只补「基调」这一层，
   * 否则用户提示词里的光影、色调、镜头语言到不了图像与视频模型。
   */
  visualBible?: ShortVisualBible | null;
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function sentence(label: string, value: string | null | undefined): string {
  const text = clean(value);
  return text ? `${label}：${text}` : "";
}

/**
 * 全片共享的只能是视觉设定。人物 description 可能混入口头禅、性格和剧情，
 * 在 ContinuityManifest 落地前一律不放进逐镜全局前缀，防止一句台词污染所有镜头。
 */
export function buildShortVisualMetaPrefix(meta: ScriptMeta | null): string {
  if (!meta) return "";
  const parts = [
    meta.style?.length ? `风格：${meta.style.map(clean).filter(Boolean).join("、")}` : "",
    sentence("固定场景", meta.scene),
    meta.character?.name ? `固定主角：${clean(meta.character.name)}` : "",
  ].filter(Boolean);
  return parts.length ? `【全片视觉设定】${parts.join("；")}。` : "";
}

function buildManifestVisualPrefix(manifest: ShortContinuityManifest | null | undefined, shotId?: string): string {
  if (!manifest) return "";
  const shot = manifest.shots.find((item) => item.id === shotId);
  const scene = manifest.scenes.find((item) => item.id === shot?.sceneId) ?? manifest.scenes[0];
  const cast = (shot?.castIds ?? []).map((id) => manifest.characters.find((item) => item.id === id)).filter(Boolean);
  const parts = [
    scene?.visualTraits ? `固定场景：${clean(scene.visualTraits)}` : "",
    ...cast.map((character) => character?.visualTraits ? `固定角色：${clean(character.visualTraits)}` : ""),
  ].filter(Boolean);
  return parts.length ? `【本镜连续性锚点】${parts.join("；")}。` : "";
}

function buildVisual(shot: ShortRenderPromptShot): string {
  return [
    sentence("本镜叙事节拍", shot.beat),
    sentence("画面", shot.visual),
    sentence("景别", shot.size),
    sentence("运镜", shot.move),
    sentence("画面效果", shot.fx),
  ].filter(Boolean).join("。") + "。";
}

function buildStyleSuffix(styleName: string): string {
  const style = clean(styleName) || "风格短片";
  return `竖屏风格短片，${style}。保持主角外观、服装、道具和场景连续一致。`;
}

/** 全片画面基调（提示词直出线）：接在人物 / 场景锚点之后，先锚人物再定基调。 */
function buildUniversalPrefix(bible: ShortVisualBible | null | undefined): string {
  const universal = clean(bible?.universal);
  return universal ? `【全片画面基调】${universal}。` : "";
}

/**
 * 提示词直出线的本镜锚点：直接从 visualBible + 本镜 castNames / sceneName 推导，
 * **不经 continuityManifest** —— manifest 由服务端在保存/预检时重建，用户刚改完人物外观
 * 或刚重拆完就出图时本地 manifest 可能是旧的甚至为空，那会把用户写的外貌设定丢在半路。
 * 规则与服务端 DramaShortContinuityService.ensureDraft 对齐：
 * castNames 缺失 = 未标注 → 全员；显式空数组 = 本镜确实没人；sceneName 命中不到 → 第一个场景。
 */
function buildBibleVisualPrefix(bible: ShortVisualBible | null | undefined, shot: ShortRenderPromptShot): string {
  const characters = (bible?.characters ?? []).filter((c) => clean(c.name) || clean(c.visual));
  const scenes = bible?.scenes ?? [];
  if (!characters.length && !scenes.length) return "";
  const cast = shot.castNames
    ? characters.filter((c) => shot.castNames?.includes(c.name))
    : characters;
  const scene = scenes.find((s) => s.name === shot.sceneName) ?? scenes[0];
  const parts = [
    scene?.visual ? `固定场景：${clean(scene.visual)}` : "",
    ...cast.map((c) => {
      const visual = clean(c.visual);
      const name = clean(c.name);
      return visual ? `固定角色：${name ? `${name}，${visual}` : visual}` : name ? `固定角色：${name}` : "";
    }),
  ].filter(Boolean);
  return parts.length ? `【本镜连续性锚点】${parts.join("；")}。` : "";
}

export function buildShortFrameVars(input: BuildShortRenderVarsInput): Record<string, string> {
  const anchors =
    buildBibleVisualPrefix(input.visualBible, input.shot) ||
    buildManifestVisualPrefix(input.manifest, input.shotId) ||
    buildShortVisualMetaPrefix(input.meta);
  return {
    metaPrefix: `${anchors}${buildUniversalPrefix(input.visualBible)}`,
    visual: buildVisual(input.shot),
    styleSuffix: buildStyleSuffix(input.styleName),
  };
}

export function buildShortClipVars(input: BuildShortRenderVarsInput): Record<string, string> {
  return {
    ...buildShortFrameVars(input),
    // 视觉模型只负责无字画面。对白、SFX/BGM 时间线和精确字幕由平台后期确定性处理，
    // 不把台词原文重复送入视频 prompt，既防画面烧字，也节省输入 token。
    lineClause: "本镜只生成无字视觉表演；不要生成画面文字、字幕、Logo 或水印。台词与声音由平台后期合成。",
  };
}
