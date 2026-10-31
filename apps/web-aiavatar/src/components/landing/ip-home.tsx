"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, AudioLines, Boxes, ChevronLeft, ChevronRight, Clapperboard, Image as ImageIcon, LayoutTemplate, LoaderCircle, MicVocal, Scan, Sparkles, SquareDashedMousePointer, SwatchBook, Video } from "lucide-react";
import type { IpTemplate } from "@ai-star-eco/types";
import { auth, USE_MOCK } from "@/proto/api";
import { DesktopTopBar } from "@/shell/desktop-top-bar";
import { IpStudioApi } from "@/ip/api";
import { createStudioEntry, studioEntryHref, type StudioEntry } from "@/ip/studio-entry";
import { StudioConversationStart } from "@/ip/studio-conversation-start";
import { useStartNewCanvas } from "@/ip/use-start-new-canvas";
import { useStudioFailure } from "@/ip/studio-errors";
import { StudioTemplateUse } from "@/ip/studio-template-use";
import { ProjectCardPreview } from "@/ip/project-card-preview";
import { projectPreview } from "@/ip/project-preview";
import { sceneHref, useSceneHomeCards } from "@/ip/scenes/scene-catalog";
import { SceneThumb } from "@/ip/scenes/scene-layout";
import { useUiVersion } from "@/shell/ui-version";
import { UiVersionSwitch } from "@/shell/ui-version-switch";
import { IpHomeClassic } from "./ip-home-classic";

/** 一个入口：要么是独立页面，要么是带某个面板打开的新画布。 */
type HomeStart = { entry: StudioEntry } | { href: string } | { blank: true };
/** 每个入口一种颜色（studio-home-scenes.css 的 data-tone），一眼分得出八个功能。 */
const tools: { title: string; icon: typeof Video; start: HomeStart; tone: string }[] = [
  { title: "画布", icon: SquareDashedMousePointer, start: { blank: true }, tone: "indigo" },
  { title: "短剧导演台", icon: Clapperboard, start: { href: "/director" }, tone: "rose" },
  { title: "商品白底图", icon: SwatchBook, start: { href: "/image?scene=white-background" }, tone: "teal" },
  { title: "图片精修", icon: Sparkles, start: { href: "/image?scene=retouch" }, tone: "amber" },
  { title: "人物真人感", icon: Scan, start: { href: "/image?scene=realism" }, tone: "violet" },
  { title: "人物配音", icon: MicVocal, start: { entry: "speech" }, tone: "sky" },
  { title: "数字人口型", icon: AudioLines, start: { entry: "lip" }, tone: "coral" },
  { title: "IP 人物库", icon: Boxes, start: { href: "/assets?tab=ips" }, tone: "green" },
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
 * 再往下是灵感（官方模板与精选案例，原来单独一页，现在放在首页上；点开先预览画布，「做同款」才复制）。
 */
function IpHomeNext({ header = true }: { header?: boolean }) {
  const router = useRouter();
  // 「你想做什么？」的卡片由运营在 Studio 后台配，公开接口读，没登录也显示。
  const homeCards = useSceneHomeCards();
  // 首页只在客户端画（/ 和 /dashboard 都先等挂载），这里直接读登录态：登录用户不会先闪一下公开顶栏。
  const [authed, setAuthed] = useState(() => USE_MOCK || auth.isAuthed());
  const [creating, setCreating] = useState<StudioEntry>();
  const createLock = useRef(false);
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
  // 有成图的排前面：灵感墙先让人看到做出来的东西，只有步骤的模板跟在后面（2026-10-30 线上走查：前几屏大半是没有图的卡）。
  const feed = useMemo(() => (templates ?? []).filter(t => tab === "all" || (tab === "canvas" ? true : templateKind(t) === tab))
    .map((t, i) => ({ t, i, pictured: hasPicture(t) })).sort((a, b) => Number(b.pictured) - Number(a.pictured) || a.i - b.i).map(x => x.t), [templates, tab]);
  const scrollGoals = (direction: number) => goals.current?.scrollBy({ left: direction * goals.current.clientWidth * .8, behavior: "smooth" });

  return <div className="ip-brand-surface ip-home studio-scene-home studio-next-page">
    {/* 登录后电脑上的导航由外壳给（新版是左侧一列，见 shell/app-chrome.tsx），这里只给没登录的访客画公开顶栏。 */}
    {header && <>{!authed && <DesktopTopBar publicMode />}<header className="ip-home-mobile-header"><Link href="/" aria-label="IP Studio · 声量引擎旗下首页"><img src="/brand/ip-studio-logo.png" width={34} height={34} alt="" /><strong>IP Studio <small>· 声量引擎旗下</small></strong></Link><Link href={authed ? "/dashboard" : "/login"}>{authed ? "工作台" : "登录"}</Link></header></>}
    {using && <StudioTemplateUse key={using.versionId || using.id} template={using} onClose={() => setUsing(undefined)} onCreated={id => router.push(`/projects/${encodeURIComponent(id)}`)}/>}
    <main>
      <section className="home-hero">
        {authed && <UiVersionSwitch inline/>}
        <h1><span>声量引擎</span>，让灵感成形，让 IP 出圈</h1>
        <StudioConversationStart creating={creating === "assistant"} onStart={brief => void startConversation(brief)}/>
      </section>

      <nav className="home-tools" aria-label="常用工具">{tools.map(t => {
        const Icon = t.icon;
        const pending = "entry" in t.start && creating === t.start.entry || "blank" in t.start && newCanvas.creating;
        return <button key={t.title} type="button" data-tone={t.tone} disabled={busy} aria-busy={pending || undefined} onClick={() => void start(t.start)}>
          <span>{pending ? <LoaderCircle size={22} className="ip-loading-icon"/> : <Icon size={24} strokeWidth={1.9}/>}</span>{t.title}
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

      {authed && <section className="home-feed" aria-labelledby="home-feed-title">
        <div className="home-section-heading"><h2 id="home-feed-title">灵感</h2><p>点开先看画布，喜欢就做同款</p><Link href="/templates">更多灵感<ArrowRight size={16}/></Link></div>
        <div className="home-feed-tabs" role="group" aria-label="灵感分类">{feedTabs.map(t => <button key={t.value} type="button" aria-pressed={tab === t.value} onClick={() => setTab(t.value)}>{t.label}</button>)}</div>
        {templates === undefined ? <div className="ip-brand-state" role="status">正在读取灵感…</div>
          : feedError ? <div className="ip-brand-error" role="alert">灵感暂时没读出来，稍后刷新再看。</div>
          : feed.length ? <FeedWall>{feed.slice(0, 15).map((t, i) => <FeedCard key={t.id} template={t} shape={i} onOpen={setUsing}/>)}</FeedWall>
          : <div className="ip-brand-state">这一类还没有内容，先看看别的分类。</div>}
      </section>}
    </main>
    <footer className="ip-home-footer"><span>IP Studio · 声量引擎旗下</span><p>让灵感成形，让 IP 出圈。</p><Link href="/assets?tab=ips">管理我的 IP<ArrowRight size={15} /></Link></footer>
  </div>;
}

/**
 * 灵感墙：按行轮流分到各列（第 1 张进第 1 列，第 2 张进第 2 列……），排在前面的就在第一行。
 * 原来用 CSS columns，是一列从上往下排满再排下一列：有图的排到前面以后，图全挤在左边几列（2026-10-30 线上）。
 */
function FeedWall({ children }: { children: ReactNode[] }) {
  const wall = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  useEffect(() => {
    const el = wall.current;
    if (!el) return;
    const fit = () => setColumns(Math.max(2, Math.min(5, Math.floor((el.clientWidth + 14) / (220 + 14)))));
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return <div ref={wall} className="home-feed-wall">{Array.from({ length: columns }, (_, c) =>
    <div key={c} className="home-feed-column">{children.filter((_, i) => i % columns === c)}</div>)}</div>;
}

/** 灵感墙上的一张：图铺满，底下压一行类型和名字（参考站登录后的样子）。点开是只读预览，存为副本再改。 */
const FEED_SHAPES = ["3 / 4", "4 / 5", "1 / 1", "9 / 13"];
/** 首页按版本二选一：默认旧版，拿到 `?ui=new` 的人看新版。 */
export function IpHome(props: { header?: boolean }) {
  return useUiVersion() === "next" ? <IpHomeNext {...props}/> : <IpHomeClassic {...props}/>;
}

const hasPicture = (t: IpTemplate) => !!t.coverUrl || projectPreview(t.doc).images.length > 0;

function FeedCard({ template, shape, onOpen }: { template: IpTemplate; shape: number; onOpen: (t: IpTemplate) => void }) {
  const kind = templateKind(template);
  const Icon = kind === "video" ? Video : kind === "image" ? ImageIcon : LayoutTemplate;
  return <button type="button" className="home-feed-card" style={{ aspectRatio: FEED_SHAPES[shape % FEED_SHAPES.length] }} aria-label={`预览模板 ${template.name}`} title={template.summary || template.name} onClick={() => onOpen(template)}>
    <span className="home-feed-media"><ProjectCardPreview key={template.coverUrl || template.versionId || template.id} doc={template.doc} coverUrl={template.coverUrl} stepsFirst/></span>
    <span className="home-feed-caption"><Icon size={15} aria-hidden="true"/><strong>{template.name}</strong></span>
  </button>;
}
