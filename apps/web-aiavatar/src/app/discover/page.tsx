// 「发现」页的官方形象已并入资产页的「官方形象」标签（2026-11-10），旧链接跳过去。
import { redirect } from "next/navigation";

export default function DiscoverPage() {
  redirect("/assets?tab=official");
}
