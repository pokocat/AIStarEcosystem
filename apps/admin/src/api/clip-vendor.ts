// ─────────────────────────────────────────────────────────────────────────────
// api/clip-vendor.ts — 石榴 AI 供应商总览（只读）。
// 对应 AdminClipController#vendorOverview；Java wire 真源 ClipVendorDtos。
// 本模块不提供任何删除 —— 清理孤儿/悬挂要与我方 DB 联动，不在这个视图里做。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";

/**
 * 额度快照。
 *
 * availableAvatar / availableSpeaker 是「可持有数量的**剩余槽位**」，不是可创建次数
 * —— 实证推断，供应商文档未写明（账户里有 3 个 avatar / 2 个 speaker 时二者恰好都是 0，
 * 而 validPoint 还剩 3418）。归零 = 必须先删旧对象才能再建。
 *
 * error 非 null 时其余字段一律 null：读失败与「额度是 0」必须分开渲染。
 */
export interface ClipVendorQuota {
  error: string | null;
  availableAvatar: number | null;
  availableSpeaker: number | null;
  /** 通用点数（TTS / 出片消耗）。 */
  validPoint: number | null;
  /** 套餐有效期，上游原样透传的 "yyyy-MM-dd HH:mm:ss" 字符串。 */
  validToTime: string | null;
  avatarSlotsExhausted: boolean;
  speakerSlotsExhausted: boolean;
}

/** 两边都有 —— 正常。 */
export interface ClipVendorMatchedRow {
  engineRef: string;
  vendorTitle: string | null;
  localId: string;
  ownerUserId: string;
  localName: string;
  engineStatus: string | null;
}

/** 石榴有、我方无 —— 孤儿，白占槽位，可安全清理。 */
export interface ClipVendorOrphanRow {
  engineRef: string;
  vendorTitle: string | null;
}

/** 我方有、石榴无 —— 悬挂，上游被删了但本地没同步。 */
export interface ClipVendorDanglingRow {
  localId: string;
  ownerUserId: string;
  localName: string;
  engineRef: string;
  engineStatus: string | null;
  updatedAt: string | null;
}

/** 不参与对账的本地行：training = 还没拿到 engineRef；mock = mock 时代残留的 ref。 */
export interface ClipVendorUnmatchableRow {
  localId: string;
  ownerUserId: string;
  localName: string;
  engineRef: string | null;
  engineStatus: string | null;
  reason: "training" | "mock";
}

/**
 * 一侧（形象 / 音色）的对账结果。
 *
 * error 非 null 时 vendorCount 为 null 且三类列表全空 —— 表示「石榴侧没读到」，
 * **不是**「石榴侧是空的」。绝不能渲染成「0 个孤儿、全部悬挂」。
 */
export interface ClipVendorReconcile {
  error: string | null;
  vendorCount: number | null;
  localCount: number;
  matched: ClipVendorMatchedRow[];
  orphan: ClipVendorOrphanRow[];
  dangling: ClipVendorDanglingRow[];
  unmatchable: ClipVendorUnmatchableRow[];
}

export interface ClipVendorOverview {
  /** true = 走的是 mock 网关，页面上的额度不是真账。 */
  mock: boolean;
  /** 本次拉取时间（ISO-8601）。实时查询，不是缓存快照。 */
  checkedAt: string;
  quota: ClipVendorQuota;
  avatars: ClipVendorReconcile;
  voices: ClipVendorReconcile;
}

// Mock 故意做成「槽位占满 + 各类都有」的形状（照 2026-08-13 线上实测的额度快照）：
// 这一页的告警态才是它存在的理由，mock 全绿的话这段 UI 永远没人验过。
const MOCK_AVATARS: ClipVendorReconcile = {
  error: null,
  vendorCount: 3,
  localCount: 3,
  matched: [
    { engineRef: "1873243598304171", vendorTitle: "军师数字分身-346584ca84", localId: "DH-a1b2c3d4", ownerUserId: "u-10001", localName: "我的数字分身", engineStatus: "ready" },
    { engineRef: "1873243598304172", vendorTitle: "军师数字分身-7d1e0b9f22", localId: "DH-e5f6a7b8", ownerUserId: "u-10002", localName: "我的数字分身", engineStatus: "ready" },
  ],
  orphan: [{ engineRef: "1873243598304173", vendorTitle: "军师数字分身-c90ab2f451" }],
  dangling: [
    { localId: "DH-99887766", ownerUserId: "u-10003", localName: "我的数字分身", engineRef: "1873243598300000", engineStatus: "ready", updatedAt: "2026-07-02T08:15:00Z" },
  ],
  unmatchable: [],
};

const MOCK_VOICES: ClipVendorReconcile = {
  error: null,
  vendorCount: 2,
  localCount: 4,
  matched: [
    { engineRef: "1873244706649061", vendorTitle: "军师本人音色-555dc050fe", localId: "VC-11aa22bb", ownerUserId: "u-10001", localName: "视频提取 · 7月2日", engineStatus: "ready" },
    { engineRef: "1873244706649061", vendorTitle: "军师本人音色-555dc050fe", localId: "VC-33cc44dd", ownerUserId: "u-10001", localName: "录音上传 · 7月9日", engineStatus: "ready" },
  ],
  orphan: [{ engineRef: "1873244706649062", vendorTitle: "军师本人音色-0f3b7ac118" }],
  dangling: [],
  unmatchable: [
    { localId: "VC-55ee66ff", ownerUserId: "u-10004", localName: "录音上传 · 8月13日", engineRef: null, engineStatus: "training", reason: "training" },
    { localId: "VC-77aa88bb", ownerUserId: "u-10005", localName: "视频提取 · 5月1日", engineRef: "mock-voice-9f2c1a34", engineStatus: "ready", reason: "mock" },
  ],
};

export async function getVendorOverview(): Promise<ClipVendorOverview> {
  if (USE_MOCK) {
    return mockDelay({
      mock: true,
      checkedAt: new Date().toISOString(),
      quota: {
        error: null,
        availableAvatar: 0,
        availableSpeaker: 0,
        validPoint: 3418,
        validToTime: "2027-08-13 15:33:36",
        avatarSlotsExhausted: true,
        speakerSlotsExhausted: true,
      },
      avatars: MOCK_AVATARS,
      voices: MOCK_VOICES,
    });
  }
  return apiFetch<ClipVendorOverview>("/admin/clip/vendor/overview");
}
