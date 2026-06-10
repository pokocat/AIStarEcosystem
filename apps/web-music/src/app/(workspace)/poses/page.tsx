"use client";

// /producer/poses — 已下线（v0.60 收敛：动作姿态随形象渲染统一在 AiAvatar 完成）。
// 路由保留避免旧书签 404；PoseLibrary 源码保留一版，下个版本物理删除。
import { RetiredFeatureNotice } from "../_shared/RetiredFeatureNotice";

export default function ProducerPosesPage() {
  return <RetiredFeatureNotice feature="动作姿态" />;
}
