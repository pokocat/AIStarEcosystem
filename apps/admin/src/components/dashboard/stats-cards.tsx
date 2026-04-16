import { Building2, Coins, FileText, Key, Package, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardStats } from "@/types";
import { formatCount } from "@/lib/utils";

interface StatsCardsProps {
  stats: DashboardStats;
}

const statConfig = [
  {
    key: "totalUsers" as keyof DashboardStats,
    label: "账户总数",
    description: "平台内已注册账号",
    icon: Users,
    color: "text-sky-700",
    bg: "bg-sky-100",
  },
  {
    key: "activeTenants" as keyof DashboardStats,
    label: "活跃工作区",
    description: "正常状态的租户空间",
    icon: Building2,
    color: "text-emerald-700",
    bg: "bg-emerald-100",
  },
  {
    key: "activeLicenses" as keyof DashboardStats,
    label: "已激活卡密",
    description: "处于激活状态的单码",
    icon: Key,
    color: "text-amber-700",
    bg: "bg-amber-100",
  },
  {
    key: "totalCreditsIssued" as keyof DashboardStats,
    label: "累计发放积分",
    description: "账本累计入账总额",
    icon: Coins,
    color: "text-violet-700",
    bg: "bg-violet-100",
  },
  {
    key: "products" as keyof DashboardStats,
    label: "产品套餐数",
    description: "已配置的产品与方案",
    icon: Package,
    color: "text-orange-700",
    bg: "bg-orange-100",
  },
  {
    key: "auditEvents" as keyof DashboardStats,
    label: "审计事件数",
    description: "平台侧操作留痕总量",
    icon: FileText,
    color: "text-rose-700",
    bg: "bg-rose-100",
  },
];

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {statConfig.map(({ key, label, description, icon: Icon, color, bg }) => {
        const value = Number.isFinite(stats[key]) ? stats[key] : 0;

        return (
          <Card key={key} className="border-border/80 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
              <div className="space-y-1">
                <CardTitle className="text-[13px] font-semibold text-slate-900">{label}</CardTitle>
                <CardDescription className="text-[12px] leading-5">{description}</CardDescription>
              </div>
              <div className={`rounded-xl p-2 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="tabular-nums text-3xl font-semibold tracking-tight text-slate-950">
                {formatCount(value)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
