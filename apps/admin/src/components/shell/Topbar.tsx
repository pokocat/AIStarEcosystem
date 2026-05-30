"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, HelpCircle, LogOut, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setAuthToken } from "@/api/_client";
import { CommandPalette } from "./CommandPalette";
import { visibleNavGroups } from "@/constants/nav";
import { useAdminIdentity } from "@/lib/useAdminRole";
import { cn } from "@/lib/utils";

interface TopbarProps {
  operator?: { name: string; role: string; initials: string };
  unread?: number;
  onMenuClick?: () => void;
}

export function Topbar({
  operator = { name: "张运营", role: "平台运营", initials: "ZY" },
  unread = 0,
  onMenuClick,
}: TopbarProps) {
  const pathname = usePathname();
  const identity = useAdminIdentity();
  const { role, accountSource } = identity;
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform));
  }, []);

  // Global Cmd/Ctrl+K → open palette.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = () => {
    setAuthToken(null);
    window.location.assign("/admin/login");
  };

  // Find the nav item that matches the current route, for the help panel.
  const currentNav = React.useMemo(() => {
    const all = visibleNavGroups(role, accountSource).flatMap((g) =>
      g.items.map((it) => ({ ...it, group: g.label }))
    );
    return (
      all.find((it) => pathname === it.href) ??
      all.find((it) => it.href !== "/" && pathname.startsWith(it.href + "/")) ??
      all.find((it) => it.href === "/")
    );
  }, [pathname, role, accountSource]);

  const displayName = identity.displayName || identity.username || operator.name;
  const roleLabel =
    role === "SUPER_ADMIN"
      ? "超级管理员"
      : role === "OPERATOR"
        ? "平台运营"
        : operator.role;
  const initials = getInitials(displayName, operator.initials);

  return (
    <TooltipProvider delayDuration={200}>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface/85 px-3 backdrop-blur-md md:px-5">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden -ml-1"
          aria-label="打开菜单"
          onClick={onMenuClick}
        >
          <Menu className="h-4 w-4" />
        </Button>

        {/* Search trigger. Below md: icon-only. md+: full pill with hint. */}
        <button
          type="button"
          aria-label="搜索页面"
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "group inline-flex items-center gap-2 rounded-md border border-transparent bg-surface-muted text-muted-foreground transition-colors",
            "hover:border-border hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            // Mobile: 36×36 icon.
            "h-9 w-9 justify-center",
            // md+: expand to a real-looking pill ~360px max.
            "md:h-9 md:w-auto md:max-w-md md:flex-1 md:justify-start md:px-3"
          )}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline text-sm">搜索页面</span>
          <span className="hidden md:ml-auto md:inline-flex items-center gap-1">
            <kbd className="inline-flex h-5 items-center rounded border border-border bg-surface px-1.5 font-mono text-[10px] text-muted-foreground">
              {isMac ? "⌘" : "Ctrl"}
            </kbd>
            <kbd className="inline-flex h-5 items-center rounded border border-border bg-surface px-1.5 font-mono text-[10px] text-muted-foreground">
              K
            </kbd>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="本页指南"
                className="hidden md:inline-flex"
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">本页指南</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/notifications"
                aria-label={unread > 0 ? `消息中心，${unread} 条未读` : "消息中心"}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
                    aria-hidden
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">消息中心{unread > 0 ? `（${unread} 未读）` : ""}</TooltipContent>
          </Tooltip>
        </div>

        <Link
          href="/profile"
          className="hidden sm:flex items-center gap-2.5 pl-2 ml-1 border-l border-border rounded-md outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="个人设置"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium">{displayName}</span>
            <span className="text-xs text-muted-foreground">{roleLabel}</span>
          </div>
        </Link>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="退出登录" onClick={handleLogout}>
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">退出登录</TooltipContent>
        </Tooltip>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>本页指南</DialogTitle>
            <DialogDescription>
              {currentNav ? `${currentNav.group} · ${currentNav.label}` : "运营工作台"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {currentNav?.description ? (
              <p className="text-foreground/90 leading-6">{currentNav.description}</p>
            ) : (
              <p className="text-muted-foreground leading-6">
                本页暂无单页说明。如对此操作有疑问，请联系平台值班或在「审计日志」查找历史操作。
              </p>
            )}
            <div className="rounded-md border border-border bg-surface-muted/40 px-3 py-2.5">
              <div className="text-xs font-medium text-muted-foreground">快捷操作</div>
              <ul className="mt-1.5 space-y-1 text-xs leading-5 text-foreground/80">
                <li>
                  <kbd className="inline-flex h-4 items-center rounded border border-border bg-surface px-1 font-mono text-[10px]">
                    {isMac ? "⌘" : "Ctrl"}
                  </kbd>{" "}
                  +{" "}
                  <kbd className="inline-flex h-4 items-center rounded border border-border bg-surface px-1 font-mono text-[10px]">
                    K
                  </kbd>{" "}
                  打开页面搜索
                </li>
                <li>
                  <kbd className="inline-flex h-4 items-center rounded border border-border bg-surface px-1 font-mono text-[10px]">
                    Esc
                  </kbd>{" "}
                  关闭弹层
                </li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              对接帮助：<a className="text-primary hover:underline" href="mailto:platform@aistar.example">platform@aistar.example</a>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function getInitials(name: string, fallback: string): string {
  const trimmed = name.trim();
  if (!trimmed) return fallback;
  const asciiParts = trimmed.split(/\s+/).filter(Boolean);
  if (asciiParts.length > 1) {
    return asciiParts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || fallback;
  }
  return trimmed.slice(0, 2).toUpperCase();
}
