import type { StudioCapabilities } from '@ai-star-eco/types/ip-studio-workflow';

export type StudioTextModelOption = NonNullable<StudioCapabilities['textModels']>[number];

/**
 * 文本 / 剧本 / 拆镜请求用哪个文本模型 —— 全仓只在这里判（§8.0.1 ④）。
 * 可选模式下沿用用户选过且仍在候选里的那个；固定模式或已下架时退到默认，再退到第一个。
 */
export function studioChosenTextModel(capabilities: StudioCapabilities | undefined, model: string | undefined): StudioTextModelOption | undefined {
  const options = capabilities?.textModels || [];
  return (capabilities?.textModelMode !== 'fixed' ? options.find(m => m.endpointId === model) : undefined)
    || options.find(m => m.isDefault)
    || options[0];
}
