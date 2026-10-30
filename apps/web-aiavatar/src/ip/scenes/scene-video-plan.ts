import type { StudioVideoSettings } from "@ai-star-eco/types/ip-studio-workflow";
import type { VideoStudioContract, VideoStudioModel, VideoStudioModeSpec } from "@ai-star-eco/types/video-studio";
import { studioVideoSettings, type StudioVideoAsset } from "@/canvas-bridge/studio-video";

/** AI 视频页的一份素材：图（商品 / 门店 / 出镜人物）或声音，带它在草稿画布上的节点。 */
export type SceneVideoMaterial = { key: string; mediaType: "image" | "audio"; title: string; nodeId: string };

/**
 * 按脚本出一条视频时，素材怎么交给所选模型 —— 只在这里判（§8.0.1 ④）：
 * 能全能参考就把图和声音都交给它（按编导写脚本时的编号顺序，图1、图2…）；只能看首帧就用第一张图；都不行就只按脚本出。
 * 用不上的素材写进 note，界面就地说清楚，不悄悄丢。
 */
export function sceneVideoInputs(model: VideoStudioModel, materials: SceneVideoMaterial[]): {
  spec: VideoStudioModeSpec; used: SceneVideoMaterial[]; note?: string; assets: StudioVideoAsset[];
} {
  const modes = model.contract.modes;
  const reference = modes.find(m => m.references && !m.needsFirstFrame && !m.needsLastFrame);
  const firstFrame = modes.find(m => m.needsFirstFrame && !m.needsLastFrame && !m.references);
  const textOnly = modes.find(m => !m.needsFirstFrame && !m.needsLastFrame && !m.references);
  const pictures = materials.filter(m => m.mediaType === "image"), voices = materials.filter(m => m.mediaType === "audio");
  const pick = (spec: VideoStudioModeSpec, used: SceneVideoMaterial[], note?: string) =>
    ({ spec, used, note, assets: used.map(m => ({ mediaType: m.mediaType, storageKey: m.key })) });
  if (reference && (pictures.length || voices.length)) {
    const rules = reference.references!;
    const images = pictures.slice(0, rules.image.maxCount), audios = voices.slice(0, rules.audio.maxCount);
    // 全能参考至少要一份画面；只有声音时退到下面的写法。
    if (images.length >= rules.minVisual) {
      const dropped = pictures.length - images.length + voices.length - audios.length;
      return pick(reference, [...images, ...audios], dropped > 0 ? `这个模型最多用 ${rules.image.maxCount} 张图、${rules.audio.maxCount} 段声音，多出来的不会用上` : undefined);
    }
  }
  if (firstFrame && pictures.length)
    return pick(firstFrame, [pictures[0]], pictures.length > 1 || voices.length ? `这个模型只用第一张图做开头画面${voices.length ? "，声音不会用上" : ""}` : undefined);
  const fallback = textOnly ?? modes[0];
  return pick(fallback, [], materials.length ? "这个模型不看参考素材，只按脚本生成" : undefined);
}

/** 交给接口的视频设置；会先改写描述的模型（H3）一律由我们先按它的写法优化再出片（同创作助手的 auto）。 */
export function sceneVideoSettings(model: VideoStudioModel, tier: string, inputs: ReturnType<typeof sceneVideoInputs>, optimize = true): StudioVideoSettings {
  const settings = studioVideoSettings(inputs.spec.mode, tier, inputs.assets, undefined, inputs.spec);
  if (!model.supportsPromptOptimization) return settings;
  // 优化描述是另一笔文字任务：服务端先按改写模型的上限另外冻结、按实际用量结算，不含在视频价里；
  // 用户确认的 maxCost 只是视频价。关掉就按原文出片（厂商自己的改写也关），只扣视频价。
  return optimize ? { ...settings, rewrite: "auto" } : { ...settings, optimizePrompt: false };
}

/** 时长选项：模型允许的范围里取 5 秒一档，再带上两头。 */
export function sceneVideoDurations(contract: VideoStudioContract): number[] {
  const out = new Set<number>([contract.minSeconds, contract.maxSeconds]);
  for (let s = Math.ceil(contract.minSeconds / 5) * 5; s <= contract.maxSeconds; s += 5) if (s > 0) out.add(s);
  return [...out].filter(s => s >= contract.minSeconds && s <= contract.maxSeconds).sort((a, b) => a - b);
}

/** 场景的默认时长放进模型范围：长了取上限，短了取下限。 */
export const clampSceneDuration = (seconds: number, contract: VideoStudioContract) =>
  Math.min(contract.maxSeconds, Math.max(contract.minSeconds, seconds));
