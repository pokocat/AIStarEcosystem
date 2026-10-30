"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, AudioLines, Boxes, ChevronLeft, ChevronRight, Clapperboard, FolderOpen, Image as ImageIcon, LayoutTemplate, LoaderCircle, MicVocal, Scan, Sparkles, SquareDashedMousePointer, SwatchBook, Video } from "lucide-react";
import type { IpProjectSummary, IpTemplate } from "@ai-star-eco/types";
import { auth, USE_MOCK } from "@/proto/api";
import { DesktopTopBar } from "@/shell/desktop-top-bar";
import { IpStudioApi } from "@/ip/api";
import { createStudioEntry, studioEntryHref, type StudioEntry } from "@/ip/studio-entry";
import { StudioConversationStart } from "@/ip/studio-conversation-start";
import { useStartNewCanvas } from "@/ip/use-start-new-canvas";
import { useStudioFailure } from "@/ip/studio-errors";
import { StudioTemplateUse } from "@/ip/studio-template-use";
import { ProjectCardPreview } from "@/ip/project-card-preview";
import { sceneHref, useSceneHomeCards } from "@/ip/scenes/scene-catalog";
import { SceneThumb } from "@/ip/scenes/scene-layout";
import { formatDateTime } from "@/lib/datetime";
import { useUiVersion } from "@/shell/ui-version";
import { IpHomeClassic } from "./ip-home-classic";

/** 一个入口：要么是独立页面，要么是带某个面板打开的新画布。 */
type HomeStart = { entry: StudioEntry } | { href: string } | { blank: true };
const tools: { title: string; icon: typeof Video; start: HomeStart }[] = [
  { title: "画布", icon: SquareDashedMousePointer, start: { blank: true } },
  { title: "导演台", icon: Clapperboard, start: { href: "/director" } },
  { title: "商品白底图", icon: SwatchBook, start: { href: "/image?scene=white-background" } },
  { title: "图片精修", icon: Sparkles, start: { href: "/image?scene=retouch" } },
  { title: "人物真人感", icon: Scan, start: { href: "/image?scene=realism" } },
  { title: "人物配音", icon: MicVocal, start: { entry: "speech" } },
  { title: "数字人口型", icon: AudioLines, start: { entry: "lip" } },
  { title: "IP 人物库", icon: Boxes, start: { href: "/assets?tab=ips" } },
];

type FeedTab = "all" | "video" | "image" | "canvas";
const feedTabs: { value: FeedTab; label: string }[] = [
  { value: "all", label: "发现" }, { value: "video", label: "视频" }, { value: "image", label: "图片" }, { value: "canvas", label: "画布" },
];
/** 模板里实际放着什么：有视频算视频，只有图算图片，都没有就是一套画布流程。 */
function templateKind(t: IpTemplate): "video" | "image" | "canvas" {
  const nodes = t.doc?.nodes ?? [];
  if (nodes.some(n => n.type === "video" && (n.metadata?.storageKey || n.metadata?.content))) return "video";
  if (nodes.some(n => n.type === "image" && (n.metadata?.storageKey || n.metadata?.content))) return "image";
  return "canvas";
}

/**
 * 新版首页（公开落地页与登录后的桌面首页，参考 docs/studio-scene-creation.md §3）：一句话开始、常用工具、按目标选场景、
 * 接着做上次的画布，再往下是灵感（官方模板与精选案例，原来单独一页，现在放在首页上）。
 */
function IpHomeNext({ header = true }: { header?: boolean }) {
  const router = useRouter();
  // 「你想做什么？」的卡片由运营在 Studio 后台配，公开接口读，没登录也显示。
  const homeCards = useSceneHomeCards();
  const [authed, setAuthed] = useState(false);
  const [creating, setCreating] = useState<StudioEntry>();
  const createLock = useRef(false);
  const [projects, setProjects] = useState<IpProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [revision, setRevision] = useState(0);
  const [templates, setTemplates] = useState<IpTemplate[]>();
  const [feedError, setFeedError] = useState(false);
  const [tab, setTab] = useState<FeedTab>("all");
  const [using, setUsing] = useState<IpTemplate>();
  const goals = useRef<HTMLDivElement>(null);
  // 「创建空白画布」和左栏「画布」是同一个「新建」 (docs/ip-studio-new-canvas-and-threads.md §2.2).
  const newCanvas = useStartNewCanvas();
  const busy = !!creating || newCanvas.creating;
  const showFailure = useStudioFailure();
  useEffect(() => {
    if (newCanvas.error === undefined) return;
    showFailure({ action: "新建画布", error: newCanvas.error, next: "可以再点一次；反复失败的话展开「错误详情」复制后发给我们。" });
    newCanvas.clearError();
  }, [newCanvas.error]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAuthed(USE_MOCK || auth.isAuthed()); }, []);
  useEffect(() => {
    if (!authed) return;
    let active = true;
    setLoading(true); setProjectError("");
    void IpStudioApi.listProjects().then(items => {
      if (active) setProjects(items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4));
    }).catch(e => { if (active) setProjectError(e instanceof Error ? e.message : "近期画布未读取"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authed, revision]);
  useEffect(() => {
    if (!authed) return;
    let active = true;
    // 模板和案例各自失败不连累对方：有一份就先展示。
    void Promise.allSettled([IpStudioApi.listDemoExamples(), IpStudioApi.listTemplates()]).then(([examples, official]) => {
      if (!active) return;
      const rows = [examples, official].flatMap(r => r.status === "fulfilled" ? r.value : [])
        .filter(t => t.enabled !== false && t.visibility !== "personal");
      setTemplates(rows); setFeedError(examples.status === "rejected" && official.status === "rejected");
    });
    return () => { active = false; };
  }, [authed]);

  const toLogin = (next = "/dashboard") => router.push(`/login?next=${encodeURIComponent(next)}`);
  /** Dialogue-first start: the brief is saved into a new canvas and sent as the first message there. */
  const startConversation = async (brief: string) => {
    if (createLock.current || newCanvas.creating) return;
    if (!authed) { toLogin(); return; }
    createLock.current = true;
    setCreating("assistant");
    try { const project = await createStudioEntry("assistant", brief); router.push(studioEntryHref(project.id, "assistant", { send: !!brief.trim() })); }
    catch (e) { showFailure({ action: "用这句话新建画布", error: e, next: "输入的内容还在框里，可以再点一次「开始对话」。" }); setCreating(undefined); createLock.current = false; }
  };
  const startBlank = () => {
    if (createLock.current) return;
    if (!authed) { toLogin(); return; }
    void newCanvas.start();
  };
  const start = async (target: HomeStart) => {
    if (createLock.current || newCanvas.creating) return;
    if ("blank" in target) { startBlank(); return; }
    if ("href" in target) { if (authed) router.push(target.href); else toLogin(target.href); return; }
    if (!authed) { toLogin(); return; }
    createLock.current = true;
    setCreating(target.entry);
    try { const project = await createStudioEntry(target.entry); router.push(studioEntryHref(project.id, target.entry)); }
    catch (e) { showFailure({ action: "新建画布", error: e, next: "可以再点一次；反复失败的话展开「错误详情」复制后发给我们。" }); setCreating(undefined); createLock.current = false; }
  };
  const feed = useMemo(() => (templates ?? []).filter(t => tab === "all" || (tab === "canvas" ? true : templateKind(t) === tab)), [templates, tab]);
  const scrollGoals = (direction: number) => goals.current?.scrollBy({ left: direction * goals.current.clientWidth * .8, behavior: "smooth" });

  return <div className="ip-brand-surface ip-home studio-scene-home">
    {header && <><DesktopTopBar publicMode /><header className="ip-home-mobile-header"><Link href="/" aria-label="IP Studio · 声量引擎旗下首页"><img src="/brand/ip-studio-logo.png" width={34} height={34} alt="" /><strong>IP Studio <small>· 声量引擎旗下</small></strong></Link><Link href={authed ? "/dashboard" : "/login"}>{authed ? "工作台" : "登录"}</Link></header></>}
    {using && <StudioTemplateUse key={using.versionId || using.id} template={using} onClose={() => setUsing(undefined)} onCreated={id => router.push(`/projects/${encodeURIComponent(id)}`)}/>}
    <main>
      <section className="home-hero">
        <h1><span>IP Studio</span>，让灵感成形，让 IP 出圈</h1>
        <p>商品图、带货视频、IP 形象，选个场景就能做；也可以直接说想做什么。</p>
        <StudioConversationStart creating={creating === "assistant"} onStart={brief => void startConversation(brief)}/>
      </section>

      <nav className="home-tools" aria-label="常用工具">{tools.map(t => {
        const Icon = t.icon;
        const pending = "entry" in t.start && creating === t.start.entry || "blank" in t.start && newCanvas.creating;
        return <button key={t.title} type="button" disabled={busy} aria-busy={pending || undefined} onClick={() => void start(t.start)}>
          <span>{pending ? <LoaderCircle size={22} className="ip-loading-icon"/> : <Icon size={22} strokeWidth={1.6}/>}</span>{t.title}
        </button>;
      })}</nav>

      {homeCards.length > 0 && <section className="home-goals" aria-labelledby="home-goals-title">
        <div className="home-section-heading"><h2 id="home-goals-title">你想做什么？</h2><p>按目标选一个场景，直接开始</p>
          <span className="home-goals-arrows"><button type="button" aria-label="向左看更多场景" onClick={() => scrollGoals(-1)}><ChevronLeft size={18}/></button><button type="button" aria-label="向右看更多场景" onClick={() => scrollGoals(1)}><ChevronRight size={18}/></button></span></div>
        <div className="home-goal-track" ref={goals}>{homeCards.map(g => <Link key={g.id} href={authed ? sceneHref(g) : `/login?next=${encodeURIComponent(sceneHref(g))}`} className="home-goal">
          <span className="home-goal-art" aria-hidden="true">{g.covers.slice(0, 2).map(c => <SceneThumb key={c.sceneId} id={c.sceneId} cover={c.coverUrl} title={g.title} size={180}/>)}</span>
          <span className="home-goal-copy">{g.kind === "video" ? <Video size={16} aria-hidden="true"/> : <ImageIcon size={16} aria-hidden="true"/>}<strong>{g.title}</strong><small>{g.description}</small></span>
        </Link>)}</div>
      </section>}

      {authed && <section className="home-recent">
        <div className="home-section-heading"><h2>继续创作</h2><p>上次停下的地方</p><Link href="/projects">全部画布<ArrowRight size={16} /></Link></div>
        {loading ? <div className="ip-brand-state" role="status">正在读取近期画布…</div>
          : projectError ? <div className="ip-brand-error" role="alert">{projectError}<button onClick={() => setRevision(v => v + 1)}>重新加载</button></div>
          : <div className="home-recent-grid">
            {projects.map(p => <Link className="home-recent-card" href={"/projects/" + encodeURIComponent(p.id)} key={p.id}><span>{p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" /> : <FolderOpen size={26} aria-hidden="true" />}</span><strong title={p.name}>{p.name}</strong><small>{formatDateTime(p.updatedAt)}</small></Link>)}
            <button type="button" className="home-recent-card is-new" aria-label="创建空白画布" disabled={busy} aria-busy={newCanvas.creating} onClick={startBlank}><span>{newCanvas.creating ? <LoaderCircle size={24} className="ip-loading-icon" aria-hidden="true" /> : <SquareDashedMousePointer size={24} aria-hidden="true"/>}</span><strong>创建空白画布</strong><small>自由组合文字、图片和视频</small></button>
          </div>}
      </section>}

      {authed && <section className="home-feed" aria-labelledby="home-feed-title">
        <div className="home-section-heading"><h2 id="home-feed-title">灵感</h2><p>官方模板和精选案例，点开预览，存成自己的画布再改</p><Link href="/templates">更多灵感<ArrowRight size={16}/></Link></div>
        <div className="home-feed-tabs" role="group" aria-label="灵感分类">{feedTabs.map(t => <button key={t.value} type="button" aria-pressed={tab === t.value} onClick={() => setTab(t.value)}>{t.label}</button>)}</div>
        {templates === undefined ? <div className="ip-brand-state" role="status">正在读取灵感…</div>
          : feedError ? <div className="ip-brand-error" role="alert">灵感暂时没读出来，稍后刷新再看。</div>
          : feed.length ? <div className="home-feed-wall">{feed.slice(0, 15).map((t, i) => <FeedCard key={t.id} template={t} shape={i} onOpen={setUsing}/>)}</div>
          : <div className="ip-brand-state">这一类还没有内容，先看看别的分类。</div>}
      </section>}
    </main>
    <footer className="ip-home-footer"><span>IP Studio · 声量引擎旗下</span><p>让灵感成形，让 IP 出圈。</p><Link href="/assets?tab=ips">管理我的 IP<ArrowRight size={15} /></Link></footer>
  </div>;
}

/** 灵感墙上的一张：图铺满，底下压一行类型和名字（参考站登录后的样子）。点开是只读预览，存为副本再改。 */
const FEED_SHAPES = ["3 / 4", "4 / 5", "1 / 1", "9 / 13"];
/** 首页按版本二选一：默认旧版，拿到 `?ui=new` 的人看新版。 */
export function IpHome(props: { header?: boolean }) {
  return useUiVersion() === "next" ? <IpHomeNext {...props}/> : <IpHomeClassic {...props}/>;
}

function FeedCard({ template, shape, onOpen }: { template: IpTemplate; shape: number; onOpen: (t: IpTemplate) => void }) {
  const kind = templateKind(template);
  const Icon = kind === "video" ? Video : kind === "image" ? ImageIcon : LayoutTemplate;
  return <button type="button" className="home-feed-card" style={{ aspectRatio: FEED_SHAPES[shape % FEED_SHAPES.length] }} aria-label={`预览模板 ${template.name}`} title={template.summary || template.name} onClick={() => onOpen(template)}>
    <span className="home-feed-media"><ProjectCardPreview key={template.coverUrl || template.versionId || template.id} doc={template.doc} coverUrl={template.coverUrl}/></span>
    <span className="home-feed-caption"><Icon size={15} aria-hidden="true"/><strong>{template.name}</strong></span>
  </button>;
}
