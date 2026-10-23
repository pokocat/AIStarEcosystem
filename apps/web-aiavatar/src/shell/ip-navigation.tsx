"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { studioNavigation, studioNavigationCurrent } from "./studio-navigation";
import { Clapperboard, FolderOpen, LayoutTemplate, Settings2, SquarePen, Shapes, Send, Home } from "lucide-react";

export const ipNavigation = studioNavigation.map(n => ({...n, icon: n.href === '/scenes' ? Shapes : n.href === '/director' ? Clapperboard : n.href === '/distribution' ? Send : n.href === '/create' ? SquarePen : n.href === '/templates' ? LayoutTemplate : n.href === '/assets' || n.href === '/projects' ? FolderOpen : Home}));

export function IpNavigation() {
  const pathname = usePathname();
  return <aside className="ip-management-navigation">
    <nav aria-label="工作空间导航">
      {ipNavigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href}
        aria-current={studioNavigationCurrent(href,pathname || "") ? "page" : undefined}><Icon size={18} aria-hidden="true" />{label}</Link>)}
      <Link href="/studio#/settings"><Settings2 size={18} aria-hidden="true" />设置</Link>
    </nav>
    <div className="ip-navigation-art">
      <div className="ip-scene-art ip-scene-castle" role="img" aria-label="暖色山谷里的城堡，创作示意" />
      <strong>让想象力<br />创造更大的世界</strong>
      <small>从一个灵感开始</small>
    </div>
  </aside>;
}
