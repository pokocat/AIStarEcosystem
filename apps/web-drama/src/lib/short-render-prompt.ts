import type { ScriptMeta } from "@/api/short-drama";
import type { ShortContinuityManifest } from "@/api/short-drama";

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
}

interface BuildShortRenderVarsInput {
  meta: ScriptMeta | null;
  shot: ShortRenderPromptShot;
  styleName: string;
  manifest?: ShortContinuityManifest | null;
  shotId?: string;
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

export function buildShortFrameVars(input: BuildShortRenderVarsInput): Record<string, string> {
  return {
    metaPrefix: buildManifestVisualPrefix(input.manifest, input.shotId) || buildShortVisualMetaPrefix(input.meta),
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
