// ─────────────────────────────────────────────────────────────────────────────
// asset.ts — 数字资产库（视频 / 图片 / 音频 / 3D 模型 / 素材包）。
// 与 wardrobe.ts（戏服 / 道具）分开：wardrobe 是艺人造型相关；asset 是 MCN 通用素材库。
// 来源：figma mcn/AssetVault.tsx（P0 新增页面，素材中心子 tab）。
//
// 跨域引用（暂用 string label，后续相关页面迁入时升级为 ID）：
//   - partnerName  → 合作主体（celebrity / brand / mcn / agent）的显示名
//   - authContract → 关联的内容授权合同名（content-license）
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";

export type AssetType = "video" | "image" | "audio" | "model_3d" | "material";

export type AssetStatus = "available" | "reviewing" | "frozen" | "disputed";

/** 派生授权状态（取自关联的内容授权合同） */
export type AssetAuthStatus = "authorized" | "expiring" | "expired" | "none";

export interface Asset {
  id: ID;
  title: string;
  type: AssetType;
  status: AssetStatus;
  authStatus: AssetAuthStatus;
  /** 合作主体显示名（暂不强 ID） */
  partnerName: string;
  /** 视频 / 音频时长（秒；图片 / 模型 / 素材包 为空） */
  duration?: number;
  /** 版本号（递增；版本回滚见 versionHistory，本 MVP 未拆） */
  versions: number;
  /** 累计使用次数（被混剪 / 切片任务等引用计数） */
  usageCount: number;
  /** 显示用主题色 hex，徽标背景；后端可由 type 派生 */
  thumbColor: string;
  tags: string[];
  uploadDate: ISODate;
  /** 文件大小（已格式化为带单位字符串，如 "8.4 GB"；MVP 不存原始字节数） */
  fileSize: string;
  /** 视频 / 图片分辨率（"1080p" / "4K" / "1920x1080"） */
  resolution?: string;
}

export interface AssetUploadInput {
  title: string;
  type: AssetType;
  partnerName: string;
  tags: string[];
  /** 真后端用 multipart 上传；MVP mock 仅记录文件名 */
  fileName: string;
  fileSize: string;
  duration?: number;
  resolution?: string;
}
