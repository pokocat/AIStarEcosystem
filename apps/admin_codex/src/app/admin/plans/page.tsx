import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { plans } from "@/lib/admin-data";

export default function PlansPage() {
  return (
    <>
      <PageHeader eyebrow="Plans" title="套餐配置" description="按 free / pro / enterprise 展示价格、配额和功能点，避免业务规则硬编码在站点内部。" />
      <div className="grid gap-4 xl:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="border-white/70 bg-white/84 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <CardHeader className="gap-2">
              <StatusBadge kind="plan" value={plan.name} />
              <CardTitle className="text-2xl">{plan.name.toUpperCase()}</CardTitle>
              <CardDescription>月付 {plan.monthlyPrice} · 年付 {plan.yearlyPrice}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="rounded-2xl border bg-secondary/35 p-4">AI 歌手名额：{plan.singers}</div>
              <div className="rounded-2xl border bg-secondary/35 p-4">音乐点数：{plan.monthlyCredits}</div>
              <div className="rounded-2xl border bg-secondary/35 p-4">NFT 限额：{plan.nftLimit}</div>
              <div className="rounded-2xl border bg-secondary/35 p-4">分发渠道：{plan.channels}</div>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-2">
              {plan.features.map((feature) => (
                <p key={feature} className="text-sm text-muted-foreground">
                  · {feature}
                </p>
              ))}
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}
