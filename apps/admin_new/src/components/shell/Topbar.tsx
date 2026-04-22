"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Bell, Search, ChevronRight, ShieldCheck } from "lucide-react";
import { findNavItemByPath } from "@/constants/nav";
import { cn } from "@/lib/utils";

interface TopbarProps {
  unread?: number;
  onMenuClick?: () => void;
}

export function Topbar({ unread = 0, onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const nav = findNavItemByPath(pathname);
  const groupLabel = nav?.group ?? "";
  const itemLabel = nav?.item.label ?? "运营总览";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur md:px-6">
      <button
        type="button"
        aria-label="打开菜单"
        onClick={onMenuClick}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <nav className="flex items-center gap-1 text-sm min-w-0">
        <Link href="/" className="text-muted-foreground hover:text-foreground">主页</Link>
        {groupLabel && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-muted-foreground truncate">{groupLabel}</span>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
        <span className="font-medium text-foreground truncate">{itemLabel}</span>
      </nav>

      <div className="flex-1" />

      <div className="hidden md:flex items-center h-9 w-[280px] rounded-md border border-border bg-input px-3 gap-2 text-sm">
        <Search className="h-4 w-4 text-muted-foreground/70" />
        <input
          type="search"
          placeholder="搜索账号 / 艺人 / 作品 / 订单号"
          className="bg-transparent outline-none flex-1 placeholder:text-muted-foreground/60"
        />
        <kbd className="hidden lg:inline-flex text-[10px] text-muted-foreground/70 border border-border rounded px-1.5 py-0.5">⌘K</kbd>
      </div>

      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        aria-label="通知"
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className={cn(
            "absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white bg-destructive ring-2 ring-background tabular-nums"
          )}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <div className="h-8 w-px bg-border" />

      <div className="flex items-center gap-2.5 pr-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary ring-1 ring-primary/15">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="hidden sm:flex flex-col leading-tight">
          <span className="text-sm font-medium">平台运营</span>
          <span className="text-[11px] text-muted-foreground">PLATFORM_OPERATOR</span>
        </div>
      </div>
    </header>
  );
}
