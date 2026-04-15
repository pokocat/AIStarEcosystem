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
    label: "总用户数",
    description: "平台内已注册的全部身份账号",
    icon: Users,
    color: "text-sky-700",
    bg: "bg-sky-100",
  },
  {
    key: "activeTenants" as keyof DashboardStats,
    label: "活跃租户",
    description: "组织空间、渠道空间与创作者工作区",
    icon: Building2,
    color: "text-emerald-700",
    bg: "bg-emerald-100",
  },
  {
    key: "activeLicenses" as keyof DashboardStats,
    label: "有效许可证",
    description: "已激活且仍在有效期内的许可证能力",
    icon: Key,
    color: "text-amber-700",
    bg: "bg-amber-100",
  },
  {
    key: "totalCreditsIssued" as keyof DashboardStats,
    label: "累计发放积分",
    description: "所有钱包累计授予的积分总量",
    icon: Coins,
    color: "text-violet-700",
    bg: "bg-violet-100",
  },
  {
    key: "products" as keyof DashboardStats,
    label: "商品数量",
    description: "已上架的产品与商业化方案数量",
    icon: Package,
    color: "text-orange-700",
    bg: "bg-orange-100",
  },
  {
    key: "auditEvents" as keyof DashboardStats,
    label: "审计事件",
    description: "已记录的操作与安全审计事件数量",
    icon: FileText,
    color: "text-rose-700",
    bg: "bg-rose-100",
  },
];

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {statConfig.map(({ key, label, description, icon: Icon, color, bg }) => {
        const value = Number.isFinite(stats[key]) ? stats[key] : 0;

        return (
          <Card key={key} className="border-border/80 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <CardDescription className="max-w-[22ch] text-xs leading-5">
                  {description}
                </CardDescription>
              </div>
              <div className={`rounded-xl p-2.5 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-slate-950">
                {formatCount(value)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
