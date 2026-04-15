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
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section: string;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "总览看板", icon: LayoutDashboard, section: "概览" },
  { href: "/users", label: "用户管理", icon: Users, section: "运营" },
  { href: "/tenants", label: "租户空间", icon: Building2, section: "运营" },
  { href: "/products", label: "产品与套餐", icon: Package, section: "目录" },
  { href: "/entitlements", label: "权益配置", icon: Shield, section: "目录" },
  { href: "/licenses", label: "许可证", icon: Key, section: "商业" },
  { href: "/credits", label: "积分钱包", icon: Coins, section: "商业" },
  { href: "/audit", label: "审计日志", icon: FileText, section: "合规" },
];

export function getPageTitle(pathname: string) {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact.label;

  const nested = navItems.find(
    (item) => item.href !== "/dashboard" && pathname.startsWith(item.href)
  );
  return nested?.label ?? "管理后台";
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const sections = Array.from(new Set(navItems.map((item) => item.section)));

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section} className="space-y-2">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/45">
            {section}
          </p>
          <ul className="space-y-1">
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
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_12px_24px_rgba(15,23,42,0.22)]"
                          : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                          isActive
                            ? "border-white/10 bg-white/10"
                            : "border-white/8 bg-white/[0.03] group-hover:bg-white/[0.08]"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{item.label}</span>
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
