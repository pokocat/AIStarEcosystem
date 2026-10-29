'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Clapperboard, Film, ImagePlus, Layers, Loader2, Mic, Plus, ShoppingBag, UserRound, Video } from 'lucide-react';
import type { IpProjectSummary, IpTemplate } from '@ai-star-eco/types';
import { IpStudioApi } from '@/ip/api';
import { createStudioEntry, studioBriefNeedsReference, studioEntries, studioEntryHref, type StudioEntry } from '@/ip/studio-entry';
import { StudioConversationStart } from '@/ip/studio-conversation-start';
import { StudioTemplateUse } from '@/ip/studio-template-use';
import { CanvasThumb } from '@/ip/canvas-thumb';
import { useStartNewCanvas } from '@/ip/use-start-new-canvas';
import { useStudioFailure } from '@/ip/studio-errors';
import { formatDateTime } from '@/lib/datetime';
import { useHubData } from './data';
import { homeGoals } from '@/ip/scenes/scene-catalog';
import { SceneThumb } from '@/ip/scenes/scene-layout';

const quickEntries = [
  ['image', ImagePlus], ['video', Video], ['script', BookOpen], ['director', Clapperboard], ['work', Film],
  ['commerce', ShoppingBag], ['speech', Mic], ['lip', Clapperboard], ['library', UserRound], ['blank', Layers],
] as const;


export function StudioHome({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [gallery, setGallery] = useState<'official' | 'personal' | 'examples'>('official');
  const [usingTemplate, setUsingTemplate] = useState<IpTemplate>();
  const inFlight = useRef(false);
  const projects = useHubData<IpProjectSummary[]>(() => IpStudioApi.listProjects(), [], [refresh], ready);
  const templates = useHubData<IpTemplate[]>(() => IpStudioApi.listTemplates(), [], [refresh], ready);
  const examples = useHubData<IpTemplate[]>(() => IpStudioApi.listDemoExamples(), [], [refresh], ready);
  // 「新建空白画布」 and the 「空白画布」 tool are the shared 「新建」 (docs/ip-studio-new-canvas-and-threads.md §2.1).
  const newCanvas = useStartNewCanvas();
  const busy = creating !== undefined || newCanvas.creating;
  // 新建画布没成功：弹错误弹窗说清楚（原来只在页面中部挂一行字，用户在页面上方点按钮时看不到）。
  const showFailure = useStudioFailure();
  useEffect(() => {
    if (newCanvas.error === undefined) return;
    showFailure({ action: '新建画布', error: newCanvas.error, next: '可以再点一次「新建」；反复失败的话展开「错误详情」复制后发给我们。' });
    newCanvas.clearError();
  }, [newCanvas.error]); // eslint-disable-line react-hooks/exhaustive-deps
  const startBlank = () => { if (inFlight.current) return; void newCanvas.start(); };

  const start = async (entry: StudioEntry) => {
    if (inFlight.current || newCanvas.creating) return;
    inFlight.current = true;
    setCreating(entry);
    try {
      const project = await createStudioEntry(entry);
      router.push(studioEntryHref(project.id, entry));
    } catch (e) {
      showFailure({ action: '新建画布', error: e, next: '可以再点一次；反复失败的话展开「错误详情」复制后发给我们。' });
      setCreating(undefined); inFlight.current = false;
    }
  };
  const startConversation = async (brief: string) => {
    if (inFlight.current || newCanvas.creating) return;
    inFlight.current = true;
    setCreating('assistant');
    try {
      const project = await createStudioEntry('assistant', brief);
      router.push(studioEntryHref(project.id, 'assistant', { send: !!brief.trim() && !studioBriefNeedsReference(brief) }));
    } catch (e) {
      showFailure({ action: '用这句话新建画布', error: e, next: '输入的内容还在框里，可以再点一次「开始对话」。' });
      setCreating(undefined); inFlight.current = false;
    }
  };
  const useTemplate = (template: IpTemplate) => {
    if (inFlight.current || template.enabled === false) return;
    setUsingTemplate(template);
  };
  const catalogue = gallery === 'examples' ? examples : templates;
  const items = catalogue.data.filter(t => t.enabled !== false && (gallery === 'examples' || (gallery === 'personal' ? t.visibility === 'personal' : t.visibility !== 'personal'))).slice(0, 4);

  return <div className="studio-home" aria-label="AI IP Studio 创作首页">
    {usingTemplate && <StudioTemplateUse key={usingTemplate.versionId} template={usingTemplate} onClose={() => setUsingTemplate(undefined)} onCreated={id => router.push(`/projects/${id}`)} />}
    <header className="studio-home-heading">
      <div><h1>AI IP Studio</h1><p>从一个 IP，创作形象、故事和视频。</p></div>
      <Link className="studio-home-text-link" href="/projects">我的画布 <ArrowRight size={16}/></Link>
    </header>

    <StudioConversationStart compact heading="今天想做点什么？" creating={creating === 'assistant'} onStart={brief => void startConversation(brief)}/>
    <p className="studio-home-more"><Link href="/create">更多创作方式 <ArrowRight size={15}/></Link></p>

    <section className="studio-home-section" aria-labelledby="home-goals-heading"><div className="studio-home-section-heading"><h2 id="home-goals-heading">你想做什么？</h2><Link href="/video">全部场景 <ArrowRight size={15}/></Link></div>
      <div className="home-goal-track studio-home-goals">{homeGoals.map(g => <Link key={g.id} href={g.href} className="home-goal">
        <span className="home-goal-art" aria-hidden="true"><SceneThumb id={g.covers[0]} title={g.title} size={120}/><SceneThumb id={g.covers[1]} title={g.title} size={120}/></span>
        <span className="home-goal-copy"><strong>{g.title}</strong><small>{g.description}</small></span></Link>)}</div>
    </section>

    <nav className="studio-home-tools" aria-label="主要创作功能">{quickEntries.map(([entry, Icon]) => <button key={entry} type="button" disabled={busy} aria-busy={entry === 'blank' ? newCanvas.creating : creating === entry} onClick={() => entry === 'blank' ? startBlank() : void start(entry)}>
      <Icon size={22}/><span>{studioEntries[entry].title}</span><small>{studioEntries[entry].description}</small></button>)}</nav>

    <section className="studio-home-section" aria-labelledby="recent-canvases-heading"><div className="studio-home-section-heading"><h2 id="recent-canvases-heading">继续创作</h2><Link href="/projects">全部画布 <ArrowRight size={15}/></Link></div>
      {projects.error ? <LoadError message={projects.error} retry={() => setRefresh(n => n + 1)}/> : projects.loading ? <div className="studio-home-loading" role="status">正在加载最近画布…</div> : projects.data.length ?
        <div className="studio-home-projects">{projects.data.slice(0, 4).map(project => <Link className="studio-home-project" key={project.id} href={`/projects/${project.id}`}>
          <div className="studio-home-project-cover">{project.coverUrl ? <img src={project.coverUrl} alt="" loading="lazy"/> : <Layers size={30}/>}</div>
          <div><h3>{project.name}</h3><p>{project.status === 'published' ? '已归档人物' : '画布'} · {formatDateTime(project.updatedAt)}</p></div><ArrowRight size={16}/></Link>)}</div> :
        <div className="studio-home-empty"><p>还没有画布。从上方开始创作，或先选择一套模板。</p><button type="button" disabled={busy} aria-busy={newCanvas.creating} onClick={startBlank}>{newCanvas.creating ? <Loader2 size={16} className="studio-gallery-spinner" aria-hidden="true"/> : <Plus size={16}/>}新建空白画布</button></div>}
    </section>

    <section className="studio-home-section" aria-labelledby="canvas-templates-heading"><div className="studio-home-section-heading"><h2 id="canvas-templates-heading">模板与灵感</h2><Link href="/templates">查看全部 <ArrowRight size={15}/></Link></div>
      <div className="studio-home-gallery-tabs" role="group" aria-label="模板与灵感分类">{([['official', '官方模板'], ['personal', '我的模板'], ['examples', '精选画布']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={gallery === value} onClick={() => setGallery(value)}>{label}</button>)}</div>
      {catalogue.error ? <LoadError message={catalogue.error} retry={() => setRefresh(n => n + 1)}/> : catalogue.loading ? <div className="studio-home-loading" role="status">正在加载模板与画布…</div> : items.length ?
        <div className="studio-home-templates">{items.map(t => <button type="button" className="studio-home-template" key={t.id} disabled={busy} onClick={() => void useTemplate(t)}>
          {t.coverUrl ? <img src={t.coverUrl} alt="" loading="lazy"/> : <CanvasThumb doc={t.doc} height={132}/>}
          <div><h3>{t.name}</h3><p>{t.summary}</p><span>只读预览 · 存为个人副本后编辑 <ArrowRight size={14}/></span></div></button>)}</div> :
        <div className="studio-home-empty"><p>{gallery === 'personal' ? '还没有个人模板。在画布里选择“发布为模板”，以后可以换一个 IP 继续使用。' : gallery === 'examples' ? '精选画布发布后会展示在这里，你可以复制一份继续创作。' : '暂时没有可用的官方模板，可以从空白画布开始。'}</p><Link href="/projects">打开项目 <ArrowRight size={15}/></Link></div>}
    </section>
  </div>;
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="studio-home-error" role="alert"><p>{message}</p><button type="button" onClick={retry}>重新加载</button></div>;
}
