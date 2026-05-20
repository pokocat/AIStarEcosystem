import { DistributionShell } from "@/components/distribution/DistributionPage";

export const dynamic = "force-dynamic";

/**
 * /distribution — 分发工作台（默认子页）。
 *
 * 深链：?from_job=<mixcutJobId> 透传给工作台预选目标任务全部变体。
 * 其它子页 /distribution/{accounts,jobs} 不读 query。
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from_job?: string }>;
}) {
  const sp = await searchParams;
  return <DistributionShell subpage="workbench" fromJobId={sp.from_job} />;
}
