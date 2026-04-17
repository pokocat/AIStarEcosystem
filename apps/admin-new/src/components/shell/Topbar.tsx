"use client";

import { Bell, HelpCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TopbarProps {
  operator?: { name: string; role: string; initials: string };
  unread?: number;
}

export function Topbar({
  operator = { name: "张运营", role: "platform_operator", initials: "ZY" },
  unread = 0,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-5 backdrop-blur">
      <div className="flex-1 max-w-xl relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索艺人 / 歌曲 / 订单号 / 合约… (⌘K)"
          className="pl-8 bg-surface-muted border-transparent focus-visible:border-border"
        />
      </div>

      <Button variant="ghost" size="icon" aria-label="帮助">
        <HelpCircle className="h-4 w-4 text-muted-foreground" />
      </Button>

      <Button variant="ghost" size="icon" aria-label="消息" className="relative">
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>

      <div className="flex items-center gap-2.5 pl-2 border-l border-border">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
            {operator.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium">{operator.name}</span>
          <span className="text-xs text-muted-foreground">{operator.role}</span>
        </div>
      </div>
    </header>
  );
}
