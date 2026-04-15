"use client";

import { Bell, ChevronDown, Menu, Search, ShieldCheck, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { getPageTitle, SidebarNav } from "@/components/layout/sidebar-nav";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const { user, logout } = useAuth();
  const badgeLabel =
    user?.role === "platform_operator"
      ? "平台运营"
      : user?.role === "finance_admin"
        ? "财务管理员"
        : user?.role === "platform_owner"
          ? "平台所有者"
          : user?.role === "channel_manager"
            ? "渠道经理"
            : "管理员";

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="border-b border-sidebar-border px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sidebar-foreground/45">
                AI Star Eco
              </p>
              <p className="mt-2 text-lg font-semibold">管理后台</p>
            </div>
            <div className="px-3 py-4">
              <SidebarNav />
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            内部工作台
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
            <Badge variant="secondary" className="hidden md:inline-flex">
              {badgeLabel}
            </Badge>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm md:flex">
          <Search className="h-4 w-4" />
          搜索用户、租户、许可证
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 rounded-full px-2">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{user?.username?.slice(0, 1).toUpperCase() ?? "A"}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline-flex">
                {user?.displayName ?? user?.username ?? "管理员"}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>我的账户</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              个人资料
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {badgeLabel}
            </DropdownMenuItem>
            <DropdownMenuItem>偏好设置</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={logout}
            >
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
