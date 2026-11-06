"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderOpen, LoaderCircle } from "lucide-react";
import type { IpProjectSummary } from "@ai-star-eco/types";
import { auth, USE_MOCK } from "@/proto/api";
import { DesktopTopBar } from "@/shell/desktop-top-bar";
import { IpStudioApi } from "@/ip/api";
import { createStudioEntry, studioEntryHref, type StudioEntry } from "@/ip/studio-entry";
import { StudioConversationStart } from "@/ip/studio-conversation-start";
import { useStartNewCanvas } from "@/ip/use-start-new-canvas";
import { useStudioFailure } from "@/ip/studio-errors";
import { formatDateTime } from "@/lib/datetime";

/** A start is a canvas entry, or a page of its own (短剧 is made in AI 导演台, not on a canvas). */
type HomeStart = StudioEntry | { href: string };
const features: { title: string; description: string; entry: HomeStart; art: string }[] = [
  { title: "数字人形象", description: "设计角色形象，生成多视角与表情", entry: "ip", art: "ip-feature-character" },
  { title: "AI 图片创作", description: "角色写真与场景设计", entry: "image", art: "ip-scene-architecture" },
  { title: "AI 视频生成", description: "由图片或文字生成视频片段", entry: "video", art: "ip-scene-meadow" },
  { title: "短剧创作", description: "从剧本到分镜与成片", entry: { href: "/director" }, art: "ip-scene-film" },
];
const stories: { title: string; description: string; art: string; entry: HomeStart }[] = [
  { title: "角色的日常", description: "日常写真与场景", art: "ip-story-character", entry: "image" },
  { title: "角色 × 世界观", description: "世界观与人物设定", art: "ip-scene-castle", entry: "script" },
  { title: "从形象到短剧", description: "从形象延伸到短剧", art: "ip-scene-meadow", entry: { href: "/director" } },
];

/**
 * 旧版首页：改版前线上那一版，原样保留（见 shell/ui-version.ts）。全部用户切到新版之后删掉这个文件。
 * Reference-led home. Public and signed-in desktop share one composition.
 */
export function IpHomeClassic({ header = true }: { header?: boolean }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [creating, setCreating] = useState<StudioEntry>();
  const createLock = useRef(false);
  const [projects, setProjects] = useState<IpProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [revision, setRevision] = useState(0);
  // 「新建画布」 is the shared 「新建」 (docs/ip-studio-new-canvas-and-threads.md §2.2).
  const newCanvas = useStartNewCanvas();
  const busy = !!creating || newCanvas.creating;
  // 新建画布没成功：弹错误弹窗说清楚，不在页面中部挂一行字。
  const showFailure = useStudioFailure();
  useEffect(() => {
    if (newCanvas.error === undefined) return;
    showFailure({ action: "新建画布", error: newCanvas.error, next: "请重试。多次失败时，可复制「错误详情」反馈给我们。" });
    newCanvas.clearError();
  }, [newCanvas.error]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAuthed(USE_MOCK || auth.isAuthed()); }, []);
  useEffect(() => {
    if (!authed) return;
    let active = true;
    setLoading(true); setProjectError("");
    void IpStudioApi.listProjects().then(items => {
      if (active) setProjects(items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3));
    }).catch(e => { if (active) setProjectError(e instanceof Error ? e.message : "近期画布加载失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authed, revision]);
  /** Dialogue-first start: the brief is saved into a new canvas and sent as the first message there. */
  const startConversation = async (brief: string) => {
    if (createLock.current || newCanvas.creating) return;
    if (!authed) { router.push("/login?next=%2Fdashboard"); return; }
    createLock.current = true;
    setCreating("assistant");
    try { const project = await createStudioEntry("assistant", brief); router.push(studioEntryHref(project.id, "assistant", { send: !!brief.trim() })); }
    catch (e) { showFailure({ action: "开始对话", error: e, next: "输入的内容已保留，请再次点击「开始对话」。" }); setCreating(undefined); createLock.current = false; }
  };
  const startBlank = () => {
    if (createLock.current) return;
    if (!authed) { router.push("/login?next=%2Fdashboard"); return; }
    void newCanvas.start();
  };
  const start = async (target: HomeStart) => {
    if (createLock.current || newCanvas.creating) return;
    if (typeof target !== "string") { router.push(authed ? target.href : `/login?next=${encodeURIComponent(target.href)}`); return; }
    const entry = target;
    if (!authed) { router.push("/login?next=%2Fdashboard"); return; }
    createLock.current = true;
    setCreating(entry);
    try { const project = await createStudioEntry(entry); router.push(studioEntryHref(project.id, entry)); }
    catch (e) { showFailure({ action: "新建画布", error: e, next: "请重试。多次失败时，可复制「错误详情」反馈给我们。" }); setCreating(undefined); createLock.current = false; }
  };
  return <div className="ip-brand-surface ip-home">
    {header && <><DesktopTopBar publicMode /><header className="ip-home-mobile-header"><Link href="/" aria-label="IP Studio · 声量引擎旗下首页"><img src="/brand/ip-studio-logo.png" width={34} height={34} alt="" /><strong>IP Studio <small>· 声量引擎旗下</small></strong></Link><Link href={authed ? "/dashboard" : "/login"}>{authed ? "工作台" : "登录"}</Link></header></>}
    <main>
      <section className="ip-home-hero">
        <Image className="ip-home-hero-image" src="/landing/ip-canvas-hero-v3.webp" alt="晨光中回望城市的写实人物，AI 创作示意" fill sizes="100vw" preload />
        <div className="ip-home-hero-copy">
          <h1>一个 IP，无限可能</h1>
          <p>制作形象、图片、视频和短剧。</p>
          <StudioConversationStart creating={creating === "assistant"} onStart={brief => void startConversation(brief)}/>
        </div>
      </section>
      <div className="ip-home-content">
        <section className="ip-home-features" aria-label="开始创作">
          {features.map(f => <button key={f.title} className="ip-home-feature" disabled={busy} onClick={() => void start(f.entry)}>
            <div className={"ip-scene-art " + f.art} role="img" aria-label={f.title + "创作示意"} />
            <div className="ip-home-feature-copy"><h2>{f.title}</h2><p>{f.description}</p><span className="ip-home-arrow">{creating === f.entry ? <LoaderCircle size={17} className="ip-loading-icon" /> : <ArrowRight size={19} aria-hidden="true" />}</span></div>
          </button>)}
        </section>
        {authed && <section className="ip-home-recent">
          <div className="ip-home-section-heading"><div><h2>继续创作</h2><p>最近编辑的画布</p></div><Link href="/projects">全部画布<ArrowRight size={17} /></Link></div>
          {loading ? <div className="ip-brand-state" role="status">正在加载近期画布…</div> : projectError ? <div className="ip-brand-error" role="alert">{projectError}<button onClick={() => setRevision(v => v + 1)}>重新加载</button></div> : projects.length ? <div className="ip-home-recent-grid">{projects.map(p => <Link className="ip-home-recent-card" href={"/projects/" + encodeURIComponent(p.id)} key={p.id}><div>{p.coverUrl ? <img src={p.coverUrl} alt={p.name} loading="lazy" /> : <FolderOpen size={28} aria-hidden="true" />}</div><section><h3>{p.name}</h3><p>{formatDateTime(p.updatedAt)}</p></section><ArrowRight size={17} aria-hidden="true" /></Link>)}</div> : <div className="ip-home-first-canvas"><p>还没有个人画布。</p><button className="ip-brand-text-button" disabled={busy} aria-busy={newCanvas.creating} onClick={startBlank}>新建画布{newCanvas.creating ? <LoaderCircle size={17} className="ip-loading-icon" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}</button></div>}
        </section>}
        <section className="ip-home-stories">
          <div className="ip-home-section-heading"><div><h2>灵感故事</h2><p>角色、世界观与故事示例 · 创作示意</p></div><Link href="/templates">探索模板<ArrowRight size={17} /></Link></div>
          <div className="ip-home-story-grid">{stories.map(s => <button key={s.title} className="ip-home-story" disabled={busy} onClick={() => void start(s.entry)}><div className={"ip-scene-art " + s.art} role="img" aria-label={s.title + "创作示意"} /><div><h3>{s.title}</h3><p>{s.description}</p></div><ArrowRight size={22} aria-hidden="true" /></button>)}</div>
        </section>
      </div>
    </main>
    <footer className="ip-home-footer"><span>IP Studio · 声量引擎旗下</span><p>一个 IP，无限可能。</p><Link href="/ips">管理我的 IP<ArrowRight size={15} /></Link></footer>
  </div>;
}
