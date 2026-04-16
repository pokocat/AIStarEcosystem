import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { DashboardControlRoom } from "@/components/admin/dashboard-control-room";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="平台概览看板"
        description="围绕统一认证、权益、分销与积分计量平台的核心运行状态，优先展示运营值班最关心的变化与异常。"
        actions={
          <>
            <Button asChild>
              <Link href="/admin/credits/adjust">
                <Sparkles data-icon="inline-start" />
                发起人工调账
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/licenses/create">
                <ArrowRight data-icon="inline-end" />
                新建卡密批次
              </Link>
            </Button>
          </>
        }
      />

      <DashboardControlRoom />
    </>
  );
}
