// ─────────────────────────────────────────────────────────────────────────────
// 素材运营（明星带货 · 脚本视频）跨端契约 —— 唯一事实源（CLAUDE.md §4.1）。
// server mirror：apps/server dto/MaterialVideoModelsDto.java（字段名 1:1）。
// 说明：material-ops 的存量 UI 类型（ScriptAsset / MaterialVideo …）仍在
// apps/web-celebrity/src/components/material-ops/types.ts，整体上移登记在 TODO.md；
// 本文件只承载 v0.132 起新增的 wire 契约类型。
// ─────────────────────────────────────────────────────────────────────────────

/** 端点能力元数据（对齐 server EndpointCapabilityDto / drama EndpointCapability）。 */
export interface VideoModelCapability {
  /** 最多可送参考图张数；null=未知。 */
  maxRefImages?: number | null;
  /** 是否支持首+尾帧关键帧插值；null=未知（按 false）。 */
  supportsFirstLastFrame?: boolean | null;
  /** 是否支持主体（subject）参考；null=未知（按 false）。 */
  supportsSubjectReference?: boolean | null;
  /** 单条视频最大时长（秒）；null=未知。 */
  maxDurationSec?: number | null;
}

/**
 * 带货线「生成模型」候选（GET /material/videos/models）。
 * 与 drama RenderModelOption 的差异：额外携带服务端算好的有效时长区间
 * （= 供应商协议硬边界 ∩ capability.maxDurationSec）——前端只消费有效区间，
 * 不按模型名猜协议；null 表示该侧无已知硬边界。
 */
export interface VideoModelOption {
  endpointId: string;
  /** 端点展示名（用户友好；技术细节进 hover title）。 */
  name: string;
  /** 是否为默认端点（下拉默认选中）。 */
  isDefault: boolean;
  /** capability 未配置（合成默认项）时为 null。 */
  capability: VideoModelCapability | null;
  /** 积分单价（candidate override ?? 带货线默认单价）。 */
  creditCost: number;
  /** per_call=按次；per_second=按视频秒数（实付 = creditCost × duration_sec）。 */
  billingUnit: "per_call" | "per_second";
  /** 有效时长下限（秒）；null=无已知下限。字段恒出 wire（server 恒返回，可为 null）。 */
  effectiveMinDurationSec: number | null;
  /** 有效时长上限（秒）；null=无已知上限。字段恒出 wire（server 恒返回，可为 null）。 */
  effectiveMaxDurationSec: number | null;
  /**
   * true = 存在 candidate 行，可显式携带 endpoint_id 提交（白名单可命中）；
   * false = 合成默认项（无 candidate 行），必须走缺省默认路径，显式传 id 会被 503 拒绝。
   */
  selectableById: boolean;
}

export interface VideoModels {
  video: VideoModelOption[];
}
