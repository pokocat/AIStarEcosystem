"use client";
// 工作室（P1 双轨迁移的老版整站宿主）：src/proto 的完整 SPA（创建链路 / 真人刷脸授权 /
// 合成工作台 / 声音克隆 / 设置等所有"写"流程）原样运行在 /studio 下，hash 深链不变。
// 新版读界面（/ /assets /licenses /me）需要进流程时深链到这里；
// 老分享链接与七牛刷脸回调（根路径 hash）由根路由转发过来。
// P3 逐屏迁出后本页退役 —— 见 docs/aiavatar-asset-hub-redesign.md §3.1 / §4。
import { App } from "@/proto/app";

export default function StudioPage() {
  return <App />;
}
