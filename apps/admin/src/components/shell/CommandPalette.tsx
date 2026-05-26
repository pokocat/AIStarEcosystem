"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, CornerDownLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { visibleNavGroups } from "@/constants/nav";
import { useAdminRole } from "@/lib/useAdminRole";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Hit {
  href: string;
  label: string;
  group: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const role = useAdminRole();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const allHits = React.useMemo<Hit[]>(() => {
    const out: Hit[] = [];
    for (const g of visibleNavGroups(role)) {
      for (const it of g.items) {
        out.push({
          href: it.href,
          label: it.label,
          group: g.label,
          description: it.description,
          icon: it.icon,
        });
      }
    }
    return out;
  }, [role]);

  const filtered = React.useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allHits.slice(0, 24);
    return allHits
      .map((h) => {
        const hay = `${h.label} ${h.group} ${h.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return null;
        // Boost label matches.
        const labelIdx = h.label.toLowerCase().indexOf(q);
        const score = labelIdx >= 0 ? -100 + labelIdx : hay.indexOf(q);
        return { hit: h, score };
      })
      .filter((x): x is { hit: Hit; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 24)
      .map((x) => x.hit);
  }, [allHits, query]);

  // Reset on open.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Slight delay so radix can mount the input.
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Keep active index in range when results change.
  React.useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = filtered[active];
      if (hit) {
        router.push(hit.href);
        onOpenChange(false);
      }
    }
  };

  // Group results.
  const grouped = React.useMemo(() => {
    const map = new Map<string, Hit[]>();
    filtered.forEach((h) => {
      const arr = map.get(h.group) ?? [];
      arr.push(h);
      map.set(h.group, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 p-0 sm:rounded-xl overflow-hidden">
        <DialogTitle className="sr-only">控制台导航搜索</DialogTitle>
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="跳转到页面，例如「秘钥」「授权」「模板」"
            aria-label="跳转到页面"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-surface-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-1.5">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              没有匹配的页面。请尝试「账号」「明星」「分发」等关键词。
            </div>
          )}

          {grouped.map(([groupLabel, items]) => (
            <div key={groupLabel} className="px-1.5 pb-1">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {groupLabel}
              </div>
              {items.map((h) => {
                const idx = filtered.indexOf(h);
                const isActive = idx === active;
                const Icon = h.icon;
                return (
                  <Link
                    key={h.href}
                    href={h.href}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/8 text-foreground"
                        : "text-foreground/85 hover:bg-muted/60"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{h.label}</div>
                      {h.description && (
                        <div className="truncate text-xs text-muted-foreground">{h.description}</div>
                      )}
                    </div>
                    {isActive && (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    {!isActive && (
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-surface-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <span>本搜索覆盖侧栏全部页面。深度业务搜索 (账户/订单/合约) 将于后续版本上线。</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
