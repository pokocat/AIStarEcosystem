"use client";

// /producer/incubator — 已下线（v0.60 收敛：数字人统一在 AiAvatar 创建后引入）。
// 路由保留避免旧书签 404；IncubationWizardV2 源码保留一版，下个版本物理删除。
import { RetiredFeatureNotice } from "../_shared/RetiredFeatureNotice";

export default function ProducerIncubatorPage() {
  return <RetiredFeatureNotice feature="AI 艺人孵化" />;
}
