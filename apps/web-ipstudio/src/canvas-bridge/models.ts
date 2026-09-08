"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 画布的模型下拉 ← 服务端候选。
//
// 上游是单机工具：用户自己在浏览器里填厂商 Key，模型名也自己维护，所以它的
// `defaultConfig.channels` 里写死了 gpt-image-2 之类。本仓把这条链整个放在服务端
// （`AiAppBinding` + `ai_app_endpoint_candidate`，后台可配），浏览器里没有 Key。
//
// 于是必须把两头接上，否则就是 v0.157 之后生产上的样子：下拉里列着我们根本没有的
// 模型，选哪个 preflight 都回 503 ENDPOINT_NOT_ALLOWED —— 画布出不了图。
//
// **模型名直接对外**：下拉里显示的就是后台配的端点名（agnes-image、MiniMax H3 · 768P），
// 不做遮掩 —— 用户有权知道自己在用哪个模型、按什么价扣费。藏起来的只有 Key。
// 传给服务端的是 endpointId（端点主键），显示名与 id 的对应关系留在下面这张表里。
// ─────────────────────────────────────────────────────────────────────────────

import { fetchModels, type IpModelOption } from "./api";
import {
  decodeChannelModel,
  encodeChannelModel,
  useConfigStore,
  type ChannelModel,
} from "./config-store";

/** 服务端候选放在这个频道下 —— 与用户自建频道区分开。 */
export const SERVER_CHANNEL_ID = "server";

/** 显示名 → endpointId。出图/出片时按它把下拉选中的值翻回服务端认的 id。 */
const endpointIdByName = new Map<string, string>();
/** endpointId → 单价，属性面板要显示「这一张多少积分」。 */
const creditByEndpointId = new Map<string, number>();
/**
 * endpointId → 视频时长可提交区间。
 *
 * 时长下限只有厂商协议知道（聚算媒体 5 秒起），后台那张候选表里没有这一列，
 * 运营也填不出来。不把它拿到前端，时长滑杆就还是写死的 4–30 秒：
 * 用户选个 4 秒点发送，服务端 400 —— 一次白跑（v0.176）。
 */
const durationBoundsByEndpointId = new Map<string, { min?: number; max?: number }>();

let loaded = false;

/**
 * 选中的下拉值 → 服务端要的 endpointId。
 *
 * 拿不到就返回 undefined（而不是瞎猜一个）—— 服务端收不到 endpointId 时走后台配的
 * 默认端点，这是 D-11 允许的：用户没指定就用默认。**不允许的是指定了却悄悄换一个**。
 */
export function endpointIdFor(value: string | undefined | null): string | undefined {
  const raw = (value ?? "").trim();
  if (!raw) return undefined;
  const name = decodeChannelModel(raw)?.model ?? raw;
  return endpointIdByName.get(name);
}

/**
 * 这个模型出一张图多少积分（后台可配，`creditCostOverride` 优先）。
 *
 * ⚠️ **目前没有任何调用者**（v0.179 复核确认）：模型下拉与参数面板都不显示单价，
 * 所以「界面按选中的模型标价」这件事**还没有发生** —— 用户选错模型时看不到差价，
 * 只能事后对账本。留着这个函数是因为它就是「把单价显示出来」唯一缺的一块
 * （数据服务端已经给了：`GET /v1/ip-studio/models` 的 `creditCost`）；
 * 接不接是产品决定，记在 TODO 里，不在本轮改动范围内。
 */
export function creditCostFor(value: string | undefined | null): number | undefined {
  const id = endpointIdFor(value);
  return id ? creditByEndpointId.get(id) : undefined;
}

export function serverModelsLoaded() {
  return loaded;
}

/**
 * 这个视频模型能提交的时长区间（秒）。拿不到就返回 undefined ——
 * 调用方按画布自己的默认范围显示，不臆造一个区间去限制用户。
 */
export function videoDurationBoundsFor(value: string | undefined | null): { min?: number; max?: number } | undefined {
  const id = endpointIdFor(value);
  return id ? durationBoundsByEndpointId.get(id) : undefined;
}

function toChannelModels(list: IpModelOption[], capability: ChannelModel["capability"]): ChannelModel[] {
  return list.map((m) => {
    endpointIdByName.set(m.name, m.endpointId);
    creditByEndpointId.set(m.endpointId, m.creditCost);
    const min = m.capability?.minDurationSec ?? undefined;
    const max = m.capability?.maxDurationSec ?? undefined;
    if (min != null || max != null) durationBoundsByEndpointId.set(m.endpointId, { min: min ?? undefined, max: max ?? undefined });
    return { name: m.name, capability };
  });
}

function pickDefault(list: IpModelOption[]): string {
  const chosen = list.find((m) => m.isDefault) ?? list[0];
  return chosen ? encodeChannelModel(SERVER_CHANNEL_ID, chosen.name) : "";
}

/**
 * 把服务端候选灌进画布的配置 store。进画布时调一次。
 *
 * 一个候选都没有（后台没配端点）时**不塞任何假模型** —— 画布的就绪判断会因此为 false，
 * 用户点运行会看到「不可用」，而不是选了一个不存在的模型跑起来再失败（§8.0）。
 */
export async function loadServerModels(): Promise<{ image: number; video: number }> {
  const models = await fetchModels();
  endpointIdByName.clear();
  creditByEndpointId.clear();
  durationBoundsByEndpointId.clear();

  const image = toChannelModels(models.image ?? [], "image");
  const video = toChannelModels(models.video ?? [], "video");

  const config = useConfigStore.getState().config;
  // 只替换服务端频道，用户自建的频道（如果将来允许）不动
  const others = (config.channels ?? []).filter((c) => c.id !== SERVER_CHANNEL_ID);
  const serverChannel = {
    id: SERVER_CHANNEL_ID,
    name: "平台模型",
    // baseUrl / apiKey 在本仓没有意义：调用发生在服务端。留空字符串，
    // 就绪判断已经改成只看「选中的模型是不是服务端候选」（见 config-store.isAiConfigReady）。
    baseUrl: "",
    apiKey: "",
    apiFormat: config.apiFormat,
    models: [...image, ...video],
  };

  // store 只暴露 updateConfig(key, value)；这里是一次性整体替换，直接写 state 更清楚。
  useConfigStore.setState({
    config: {
      ...config,
      channels: [serverChannel, ...others],
      models: [...image, ...video].map((m) => encodeChannelModel(SERVER_CHANNEL_ID, m.name)),
      imageModel: pickDefault(models.image ?? []),
      videoModel: pickDefault(models.video ?? []),
      model: pickDefault(models.image ?? []),
    },
  });

  loaded = true;
  return { image: image.length, video: video.length };
}
