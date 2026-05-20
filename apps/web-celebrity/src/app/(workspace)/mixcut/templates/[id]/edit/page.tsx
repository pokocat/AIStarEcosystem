// /mixcut/templates/[id]/edit —— 模板编辑模式独立路由。
// URL 本身即"编辑中",刷新/返回的语义比 ?edit=1 query 更稳。
// 复用 TemplateDetailClient,只是 initialEdit=true 强制进入编辑态。

import { TemplateDetailClient } from "../template-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TemplateEditPage({ params }: PageProps) {
  const { id } = await params;
  return <TemplateDetailClient id={id} initialEdit />;
}
