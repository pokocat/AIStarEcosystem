"use client";

export const dynamic = "force-dynamic";

// v0.197：这一页原来是已下线的「形象锻造炉」—— 按钮写着消耗 200 积分，实际只在前端画 4 块渐变色、
// 余额不动，属于 §8.0 禁止的假产物。整页换成下线提示，引导去 AiAvatar（数字人平台）做新造型。
// 路由保留，避免旧书签 404。
import { RetiredFeatureNotice } from "@/app/(workspace)/_shared/RetiredFeatureNotice";

export default function ArtistGeneratePage() {
  return <RetiredFeatureNotice feature="给演员做新造型" />;
}
