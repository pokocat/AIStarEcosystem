"use client";

// /producer/appearance — 已下线（v0.60 收敛：形象渲染统一在 AiAvatar 完成后引入）。
// 路由保留避免旧书签 404；AppearanceForgeV3 源码保留一版，下个版本物理删除。
import { RetiredFeatureNotice } from "../_shared/RetiredFeatureNotice";

export default function ProducerAppearancePage() {
  return <RetiredFeatureNotice feature="AI 形象锻造" />;
}
