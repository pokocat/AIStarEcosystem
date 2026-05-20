import { PublishWorkbenchClient } from "./publish-workbench-client";

/**
 * /mixcut/publish — 混剪发布工作台。
 *
 * 列出所有 status=success 的混剪任务，跨任务多选已上传到 CDN 的变体，
 * 一次性配文案 / 账号 / 定时 → 派单。与 mixcut/jobs/[id] 详情页里的「批量发布」按钮
 * 共享 BatchPublishDrawer 组件，区别仅在 items 来自跨任务汇总。
 */
export default function MixcutPublishPage() {
  return <PublishWorkbenchClient />;
}
