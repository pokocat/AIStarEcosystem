import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Key, Coins, Package, FileText } from "lucide-react";
import { DashboardStats } from "@/types";

interface StatsCardsProps {
  stats: DashboardStats;
}

const statConfig = [
  {
    key: "totalUsers" as keyof DashboardStats,
    label: "Total Users",
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    key: "activeTenants" as keyof DashboardStats,
    label: "Active Tenants",
    icon: Building2,
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    key: "activeLicenses" as keyof DashboardStats,
    label: "Active Licenses",
    icon: Key,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    key: "totalCreditsIssued" as keyof DashboardStats,
    label: "Credits Issued",
    icon: Coins,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    key: "products" as keyof DashboardStats,
    label: "Products",
    icon: Package,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    key: "auditEvents" as keyof DashboardStats,
    label: "Audit Events",
    icon: FileText,
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
];

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {statConfig.map(({ key, label, icon: Icon, color, bg }) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {label}
            </CardTitle>
            <div className={`rounded-md p-2 ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats[key].toLocaleString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
