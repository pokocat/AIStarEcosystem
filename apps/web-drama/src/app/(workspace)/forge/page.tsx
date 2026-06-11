"use client";

// /forge — 已下线（v0.60 收敛：形象渲染统一在 AiAvatar 完成后引入）。
// 路由保留避免旧书签 404；原锻造炉源码保留一版，下个版本物理删除。
import { RetiredFeatureNotice } from "../_shared/RetiredFeatureNotice";

export default function ForgePage() {
  return <RetiredFeatureNotice feature="形象锻造炉" />;
}
