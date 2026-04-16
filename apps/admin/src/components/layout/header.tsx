"use client";

import { ChevronDown, LogOut, Menu, ShieldCheck, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getPageDescription, getPageTitle, SidebarNav } from "@/components/layout/sidebar-nav";
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

function roleLabel(role: string | undefined): string {
  switch (role?.toLowerCase()) {
    case "platform_owner":
      return "平台所有者";
    case "platform_operator":
      return "平台运营";
    case "finance_admin":
      return "财务管理员";
    case "channel_manager":
      return "渠道管理员";
    default:
      return role ?? "未知角色";
  }
}

function roleBadgeVariant(role: string | undefined) {
  switch (role?.toLowerCase()) {
    case "platform_owner":
      return "destructive" as const;
    case "platform_operator":
      return "default" as const;
    case "finance_admin":
      return "info" as const;
    case "channel_manager":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const description = getPageDescription(pathname);
  const { user, logout, isAdmin } = useAuth();

  const displayName = user?.displayName ?? user?.username ?? "管理员";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1520px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Sheet>
          <SheetTrigger asChild>
            <Button aria-label="打开导航菜单" variant="outline" size="icon" className="lg:hidden">
              <Menu className="h-4 w-4" />
              <span className="sr-only">打开导航</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="border-b border-sidebar-border px-5 py-5">
              <p className="text-xs font-semibold tracking-[0.24em] text-sidebar-foreground/45">
                AI Star Eco
              </p>
              <p className="mt-2 text-lg font-semibold">账户与权益后台</p>
            </div>
            <div className="px-3 py-4">
              <SidebarNav />
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
            平台运营控制台
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
            {user && (
              <Badge variant={roleBadgeVariant(user.role)} className="hidden md:inline-flex">
                {roleLabel(user.role)}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 hidden truncate text-[12px] text-muted-foreground md:block">
            {description}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="打开管理员菜单" variant="ghost" className="flex items-center gap-2 rounded-full px-2">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline-flex">{displayName}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.email ?? user?.username}</p>
                <Badge variant={roleBadgeVariant(user?.role)} className="mt-1 w-fit text-[10px]">
                  {isAdmin ? "系统管理员" : roleLabel(user?.role)}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              个人资料
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ShieldCheck className="mr-2 h-4 w-4" />
              登录安全
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
