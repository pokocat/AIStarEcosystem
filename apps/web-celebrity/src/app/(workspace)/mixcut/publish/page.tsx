import { redirect } from "next/navigation";

/**
 * /mixcut/publish — v0.16 迁入分发中心；v0.18 路由化为 /distribution。
 *
 * 历史路径保留为 server-side redirect，避免外链 / 收藏夹 / 旧 README 死链。
 * 真正的分发工作台代码在：
 *   apps/web-celebrity/src/components/distribution/DistributeWorkbench.tsx
 */
export default function MixcutPublishRedirect() {
  redirect("/distribution");
}
