"use client";
// 新版左侧导航栏：鼠标停在「AI 视频 / AI 图片」上，右边弹出全部场景，点一个直接进那个场景（2026-10-31 用户反馈：
// 原来要先进页面、点场景名、再点「全部场景」才看得到）。点导航项本身照旧进页面。
// 场景目录只读服务端那一份（loadSceneCatalog，页面里已经读过就直接用缓存）；键盘聚焦也能打开，Esc 关。
// 列表就是场景页的「全部场景」（SceneDrawer），同一个组件、同一份固定状态：在这里点固定，场景页那一列跟着出来
//（2026-11-01 用户：两个地方用同一个组件，不要单独写）。
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StudioSceneCatalog } from "@ai-star-eco/types";
import { FREE_SCENE_ID, loadSceneCatalog } from "@/ip/scenes/scene-catalog";
import { SceneDrawer, useSceneDrawerPin } from "@/ip/scenes/scene-layout";

const OPEN_DELAY = 120, CLOSE_DELAY = 220;
type Kind = "video" | "image";

function sceneLists(catalog: StudioSceneCatalog, kind: Kind) {
  const groups = kind === "video" ? catalog.videoGroups : catalog.imageGroups;
  const scenes = kind === "video" ? catalog.video : catalog.image;
  const free = kind === "image" ? scenes.find(s => s.id === FREE_SCENE_ID) : undefined;
  return { free, groups: groups.map(g => ({ id: g.id, title: g.title, items: scenes.filter(s => s.group === g.id && s.id !== FREE_SCENE_ID) })).filter(g => g.items.length) };
}

/** 包住导航项：悬停 / 聚焦时在导航栏右边弹出场景列表。 */
export function RailSceneFlyout({ kind, label, enabled, children }: { kind: Kind; label: string; enabled: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<StudioSceneCatalog>();
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState<string>();
  const [pinned, pin] = useSceneDrawerPin(kind);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const box = useRef<HTMLDivElement>(null);
  // Esc 关掉后焦点回到导航项，这一次聚焦不要再把它打开。
  const quiet = useRef(false);
  const later = (fn: () => void, ms: number) => { clearTimeout(timer.current); timer.current = setTimeout(fn, ms); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    // 当前在哪个场景：只在打开时读一次地址（导航栏挂在整站外层，不用 useSearchParams）。
    const params = new URLSearchParams(window.location.search);
    setCurrent(window.location.pathname === `/${kind}` ? params.get("scene") || (kind === "image" ? FREE_SCENE_ID : undefined) : undefined);
    if (catalog) return;
    let live = true;
    setFailed(false);
    loadSceneCatalog().then(c => { if (live) setCatalog(c); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [open, catalog, kind]);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); quiet.current = true; box.current?.querySelector<HTMLElement>(".rail-flyout-trigger a")?.focus(); quiet.current = false; } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  if (!enabled) return <>{children}</>;
  const lists = catalog && sceneLists(catalog, kind);
  // 固定：那一列在场景页里，不在这个页面就带过去（当前场景不变）；取消固定只改设置。
  const onPin = (on: boolean) => {
    pin(on);
    if (!on) return;
    setOpen(false);
    if (window.location.pathname !== `/${kind}`) router.push(`/${kind}`);
  };
  return <div ref={box} className="rail-flyout-host"
    onPointerEnter={() => later(() => setOpen(true), OPEN_DELAY)} onPointerLeave={() => later(() => setOpen(false), CLOSE_DELAY)}
    onFocus={() => { clearTimeout(timer.current); if (!quiet.current) setOpen(true); }}
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) later(() => setOpen(false), CLOSE_DELAY); }}>
    <div className="rail-flyout-trigger">{children}</div>
    {open && <SceneDrawer flyout heading={label} title={label} groups={lists?.groups ?? []} top={lists?.free} current={current}
      hrefFor={id => `/${kind}?scene=${encodeURIComponent(id)}`} pinned={pinned} onPin={onPin} onClose={() => setOpen(false)}
      status={lists ? undefined : failed ? "场景暂时读不到，点「" + label + "」进页面看" : "正在读取场景…"}/>}
  </div>;
}
