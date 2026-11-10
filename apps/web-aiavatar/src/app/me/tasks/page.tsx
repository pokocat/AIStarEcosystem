import type { StudioTaskStatus } from "@ai-star-eco/types";
import { AccountRoute } from "@/account/account-page";

const STATUSES: StudioTaskStatus[] = ["running", "done", "failed"];

/** ?status=running：只看进行中；?raw=all：打开「全部原文」（导演台的「生成原文」入口）。 */
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; raw?: string }> }) {
  const { status, raw } = await searchParams;
  return <AccountRoute page="tasks" status={STATUSES.find(s => s === status)} rawAll={raw === "all"} />;
}
