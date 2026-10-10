"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileImage, Film, FolderOpen, LoaderCircle, Sparkles, UserRound } from "lucide-react";
import type { IpProjectSummary } from "@ai-star-eco/types";
import { auth, USE_MOCK } from "@/proto/api";
import { DesktopTopBar } from "@/shell/desktop-top-bar";
import { IpStudioApi } from "@/ip/api";
import { createStudioEntry, studioEntryHref, type StudioEntry } from "@/ip/studio-entry";
import { formatDateTime } from "@/lib/datetime";

const features: { title: string; description: string; entry: StudioEntry; art: string; icon: typeof Sparkles }[] = [
  { title: "数字人形象", description: "找到角色的样子，延展视角与表情", entry: "image", art: "ip-feature-character", icon: UserRound },
  { title: "AI 图片创作", description: "角色写真、场景设计，让灵感成形", entry: "image", art: "ip-scene-architecture", icon: FileImage },
  { title: "AI 视频生成", description: "让 IP 动起来，讲述新的故事", entry: "video", art: "ip-scene-meadow", icon: Film },
  { title: "短剧创作", description: "从故事与剧本，走向分镜和成片", entry: "script", art: "ip-scene-film", icon: Sparkles },
];
const stories: { title: string; description: string; art: string; entry: StudioEntry }[] = [
  { title: "角色的日常", description: "让想象更温柔", art: "ip-story-character", entry: "image" },
  { title: "角色 × 世界观", description: "创造属于你的故事", art: "ip-scene-castle", entry: "script" },
  { title: "从形象到短剧", description: "让角色真正活起来", art: "ip-scene-meadow", entry: "director" },
];

/** Reference-led home. Public and signed-in desktop share one composition. */
export function IpHome({ header = true }: { header?: boolean }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [creating, setCreating] = useState<StudioEntry>();
  const createLock = useRef(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<IpProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => { setAuthed(USE_MOCK || auth.isAuthed()); }, []);
  useEffect(() => {
    if (!authed) return;
    let active = true;
    setLoading(true); setProjectError("");
    void IpStudioApi.listProjects().then(items => {
      if (active) setProjects(items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3));
    }).catch(e => { if (active) setProjectError(e instanceof Error ? e.message : "近期画布未读取"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authed, revision]);
  const start = async (entry: StudioEntry) => {
    if (createLock.current) return;
    if (!authed) { router.push("/login?next=%2Fdashboard"); return; }
    createLock.current = true;
    setCreating(entry); setError("");
    try { const project = await createStudioEntry(entry); router.push(studioEntryHref(project.id, entry)); }
    catch (e) { setError(e instanceof Error ? e.message : "画布没有创建成功，请重试"); setCreating(undefined); createLock.current = false; }
  };
  return <div className="ip-brand-surface ip-home">
    {header && <><DesktopTopBar publicMode /><header className="ip-home-mobile-header"><Link href="/" aria-label="IP Studio · 声量引擎旗下首页"><img src="/brand/ip-studio-logo.png" width={34} height={34} alt="" /><strong>IP Studio <small>· 声量引擎旗下</small></strong></Link><Link href={authed ? "/dashboard" : "/login"}>{authed ? "工作台" : "登录"}</Link></header></>}
    <main>
      <section className="ip-home-hero">
        <img className="ip-home-hero-image" src="https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/ipstudio/landing/ip-canvas-hero-v3.png" alt="晨光中回望城市的写实人物，AI 创作示意" fetchPriority="high" />
        <div className="ip-home-hero-copy">
          <h1>让灵感成形<br />让 IP 出圈</h1>
          <p>从一个灵感开始，创造数字人、图片、视频与故事。<br className="ip-home-desktop-break" />让你的 IP 拥有形象、声音与作品。</p>
          <button className="ip-brand-button ip-home-start" disabled={!!creating} onClick={() => void start("assistant")}>
            {creating === "assistant" ? <LoaderCircle className="ip-loading-icon" size={19} /> : null}
            {creating === "assistant" ? "正在打开画布" : "开始创作"}<ArrowRight size={22} aria-hidden="true" />
          </button>
          <div className="ip-home-paths" aria-label="创作方向">{features.map(f => <button key={f.title} disabled={!!creating} onClick={() => void start(f.entry)}><f.icon size={18} aria-hidden="true" /><strong>{f.title.replace("AI ", "")}</strong><span>{f.entry === "image" ? "创造形象" : f.entry === "video" ? "让角色动起来" : "编写新故事"}</span></button>)}</div>
        </div>
        <span className="ip-home-hero-note">一个角色，无限可能</span>
      </section>
      {error && <div className="ip-brand-error" role="alert">{error}<button onClick={() => setError("")}>关闭</button></div>}
      <div className="ip-home-content">
        <section className="ip-home-features" aria-label="开始创作">
          {features.map(f => <button key={f.title} className="ip-home-feature" disabled={!!creating} onClick={() => void start(f.entry)}>
            <div className={"ip-scene-art " + f.art} role="img" aria-label={f.title + "创作示意"} />
            <div className="ip-home-feature-copy"><h2>{f.title}</h2><p>{f.description}</p><span className="ip-home-arrow">{creating === f.entry ? <LoaderCircle size={17} className="ip-loading-icon" /> : <ArrowRight size={19} aria-hidden="true" />}</span></div>
          </button>)}
        </section>
        {authed && <section className="ip-home-recent">
          <div className="ip-home-section-heading"><div><h2>继续创作</h2><p>你的灵感，留在每一张画布里</p></div><Link href="/create">全部画布<ArrowRight size={17} /></Link></div>
          {loading ? <div className="ip-brand-state" role="status">正在读取近期画布…</div> : projectError ? <div className="ip-brand-error" role="alert">{projectError}<button onClick={() => setRevision(v => v + 1)}>重新加载</button></div> : projects.length ? <div className="ip-home-recent-grid">{projects.map(p => <Link className="ip-home-recent-card" href={"/projects/" + encodeURIComponent(p.id)} key={p.id}><div>{p.coverUrl ? <img src={p.coverUrl} alt={p.name} loading="lazy" /> : <FolderOpen size={28} aria-hidden="true" />}</div><section><h3>{p.name}</h3><p>{formatDateTime(p.updatedAt)}</p></section><ArrowRight size={17} aria-hidden="true" /></Link>)}</div> : <div className="ip-home-first-canvas"><p>还没有个人画布。从一个角色或一个故事开始吧。</p><button className="ip-brand-text-button" disabled={!!creating} onClick={() => void start("blank")}>创建空白画布<ArrowRight size={17} /></button></div>}
        </section>}
        <section className="ip-home-stories">
          <div className="ip-home-section-heading"><div><h2>灵感故事</h2><p>探索角色、世界与故事的更多可能 · 创作示意</p></div><Link href="/templates">探索模板<ArrowRight size={17} /></Link></div>
          <div className="ip-home-story-grid">{stories.map(s => <button key={s.title} className="ip-home-story" disabled={!!creating} onClick={() => void start(s.entry)}><div className={"ip-scene-art " + s.art} role="img" aria-label={s.title + "创作示意"} /><div><h3>{s.title}</h3><p>{s.description}</p></div><ArrowRight size={22} aria-hidden="true" /></button>)}</div>
        </section>
      </div>
    </main>
    <footer className="ip-home-footer"><span>IP Studio · 声量引擎旗下</span><p>让灵感成形，让 IP 出圈。</p><Link href="/ips">管理我的 IP<ArrowRight size={15} /></Link></footer>
  </div>;
}
