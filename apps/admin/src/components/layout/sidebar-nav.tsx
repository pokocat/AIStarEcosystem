"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Coins,
  FileText,
  Key,
  LayoutDashboard,
  Package,
  Shield,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  section: string;
};

export const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "运营看板",
    description: "账户与业务总览",
    icon: LayoutDashboard,
    section: "总览",
  },
  {
    href: "/users",
    label: "平台用户",
    description: "AI 歌手、艺人与经纪公司账号",
    icon: Users,
    section: "账户",
  },
  {
    href: "/tenants",
    label: "租户工作区",
    description: "密钥分发渠道与归属管理",
    icon: Building2,
    section: "账户",
  },
  {
    href: "/admins",
    label: "管理员账号",
    description: "后台运营人员账号管理",
    icon: UserCog,
    section: "账户",
  },
  {
    href: "/products",
    label: "产品套餐",
    description: "产品目录与商业方案",
    icon: Package,
    section: "商业",
  },
  {
    href: "/entitlements",
    label: "权益开通",
    description: "功能、额度与有效期",
    icon: Shield,
    section: "商业",
  },
  {
    href: "/licenses",
    label: "卡密批次",
    description: "批次、单码与激活状态",
    icon: Key,
    section: "商业",
  },
  {
    href: "/credits",
    label: "钱包流水",
    description: "积分余额与账本变动",
    icon: Coins,
    section: "商业",
  },
  {
    href: "/audit",
    label: "系统审计",
    description: "操作记录与风险留痕",
    icon: FileText,
    section: "合规",
  },
];

export function getPageTitle(pathname: string) {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact.label;

  const nested = navItems.find(
    (item) => item.href !== "/dashboard" && pathname.startsWith(item.href)
  );
  return nested?.label ?? "管理后台";
}

export function getPageDescription(pathname: string) {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact.description;

  const nested = navItems.find(
    (item) => item.href !== "/dashboard" && pathname.startsWith(item.href)
  );
  return nested?.description ?? "平台内部运营工作台";
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const sections = Array.from(new Set(navItems.map((item) => item.section)));

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section} className="space-y-2">
          <p className="px-3 text-[11px] font-semibold tracking-[0.18em] text-sidebar-foreground/45">
            {section}
          </p>
          <ul className="space-y-1.5">
            {navItems
              .filter((item) => item.section === section)
              .map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_10px_24px_rgba(15,23,42,0.22)]"
                          : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                          isActive
                            ? "border-white/10 bg-white/10"
                            : "border-white/8 bg-white/[0.03] group-hover:bg-white/[0.08]"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{item.label}</span>
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            isActive
                              ? "text-sidebar-primary-foreground/70"
                              : "text-sidebar-foreground/45"
                          )}
                        >
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}
