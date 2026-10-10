'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Clapperboard, Film, ImagePlus, Layers, Loader2, Mic, Plus, ShoppingBag, Sparkles, UserRound, Video } from 'lucide-react';
import type { IpProject, IpProjectSummary, IpTemplate } from '@ai-star-eco/types';
import { IpStudioApi } from '@/ip/api';
import { createStudioEntry, studioEntries, studioEntryHref, StudioEntrySaveError, type StudioEntry } from '@/ip/studio-entry';
import { StudioTemplateUse } from '@/ip/studio-template-use';
import { CanvasThumb } from '@/ip/canvas-thumb';
import { formatDateTime } from '@/lib/datetime';
import { useHubData } from './data';

const quickEntries = [
  ['image', ImagePlus], ['video', Video], ['script', BookOpen], ['director', Clapperboard], ['work', Film],
  ['commerce', ShoppingBag], ['speech', Mic], ['lip', Clapperboard], ['library', UserRound], ['blank', Layers],
] as const;
const composerModes = [['assistant', '全能创作'], ['image', '图片'], ['video', '视频'], ['script', '剧本']] as const;

export function StudioHome({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<StudioEntry>('assistant');
  const [brief, setBrief] = useState('');
  const [creating, setCreating] = useState<string>();
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [gallery, setGallery] = useState<'official' | 'personal' | 'examples'>('official');
  const [usingTemplate, setUsingTemplate] = useState<IpTemplate>();
  const inFlight = useRef(false);
  const pending = useRef<{ project: IpProject; entry: StudioEntry; brief: string } | undefined>(undefined);
  const projects = useHubData<IpProjectSummary[]>(() => IpStudioApi.listProjects(), [], [refresh], ready);
  const templates = useHubData<IpTemplate[]>(() => IpStudioApi.listTemplates(), [], [refresh], ready);
  const examples = useHubData<IpTemplate[]>(() => IpStudioApi.listDemoExamples(), [], [refresh], ready);

  const start = async (entry: StudioEntry, text = '') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(''); setCreating(entry);
    try {
      const saved = pending.current;
      const project = await createStudioEntry(saved?.entry ?? entry, saved?.brief ?? text, saved?.project);
      const target = saved?.entry ?? entry;
      pending.current = undefined;
      router.push(studioEntryHref(project.id, target));
    } catch (e) {
      if (e instanceof StudioEntrySaveError) pending.current = { project: e.project, entry, brief: text };
      setError(e instanceof Error ? e.message : '画布没有创建成功，请稍后重试');
      setCreating(undefined); inFlight.current = false;
    }
  };
  const useTemplate = async (template: IpTemplate) => {
    if (inFlight.current || template.enabled === false) return;
    if (template.versionId) { setUsingTemplate(template); return; }
    inFlight.current = true; setCreating(template.id); setError('');
    try {
      const project = await IpStudioApi.createProject({ templateId: template.id });
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '模板没有打开成功，请稍后重试');
      setCreating(undefined); inFlight.current = false;
    }
  };
  const catalogue = gallery === 'examples' ? examples : templates;
  const items = catalogue.data.filter(t => t.enabled !== false && (gallery === 'examples' || (gallery === 'personal' ? t.visibility === 'personal' : t.visibility !== 'personal'))).slice(0, 4);

  return <div className="studio-home" aria-label="AI IP Studio 创作首页">
    {usingTemplate && <StudioTemplateUse key={usingTemplate.versionId} template={usingTemplate} onClose={() => setUsingTemplate(undefined)} onCreated={id => router.push(`/projects/${id}`)} />}
    <header className="studio-home-heading">
      <div><h1>AI IP Studio</h1><p>从一个 IP，创作形象、故事和视频。</p></div>
      <Link className="studio-home-text-link" href="/projects">我的画布 <ArrowRight size={16}/></Link>
    </header>

    <form className="studio-home-composer" onSubmit={e => { e.preventDefault(); void start(mode, brief); }}>
      <div className="studio-home-modes" role="group" aria-label="首页创作方式">{composerModes.map(([value, label]) =>
        <button type="button" key={value} aria-pressed={mode === value} disabled={creating !== undefined || !!pending.current} onClick={() => setMode(value)}>{value === 'assistant' && <Sparkles size={16}/>} {label}</button>)}</div>
      <label className="studio-home-input-label" htmlFor="studio-home-brief">想创作什么？</label>
      <textarea id="studio-home-brief" aria-label="创作想法" value={brief} onChange={e => setBrief(e.target.value)} maxLength={4000} disabled={creating !== undefined || !!pending.current}
        placeholder={mode === 'image' ? '描述想打造的 IP、人物设定图或场景，也可以进入画布后添加参考图片…' : mode === 'video' ? '描述人物动作、场景和镜头运动，进入画布后选择首帧与生成参数…' : mode === 'script' ? '一句故事灵感，或一段想改编的文本。进入画布后补充人物和分集设定…' : '一个人物、一段故事，或一支商品视频。告诉 Studio 你的想法…'} />
      <div className="studio-home-composer-footer"><p>先进入画布，确认参考素材、模型和费用后生成。</p><button type="submit" className="studio-home-primary" disabled={creating !== undefined}>{creating === mode ? <Loader2 className="animate-spin" size={17}/> : <ArrowRight size={17}/>} {pending.current ? '继续保存并打开' : '开始创作'}</button></div>
    </form>
    {error && <div className="studio-home-error" role="alert"><p>{error}{pending.current ? ' · 画布已创建，重试会继续保存到同一张画布。' : ''}</p>{pending.current && <Link href={`/projects/${pending.current.project.id}`}>打开已创建的画布</Link>}</div>}

    <nav className="studio-home-tools" aria-label="主要创作功能">{quickEntries.map(([entry, Icon]) => <button key={entry} type="button" disabled={creating !== undefined || !!pending.current} onClick={() => void start(entry)}>
      <Icon size={22}/><span>{studioEntries[entry].title}</span><small>{studioEntries[entry].description}</small></button>)}</nav>

    <section className="studio-home-section" aria-labelledby="recent-canvases-heading"><div className="studio-home-section-heading"><h2 id="recent-canvases-heading">继续创作</h2><Link href="/projects">全部画布 <ArrowRight size={15}/></Link></div>
      {projects.error ? <LoadError message={projects.error} retry={() => setRefresh(n => n + 1)}/> : projects.loading ? <div className="studio-home-loading" role="status">正在加载最近画布…</div> : projects.data.length ?
        <div className="studio-home-projects">{projects.data.slice(0, 4).map(project => <Link className="studio-home-project" key={project.id} href={`/projects/${project.id}`}>
          <div className="studio-home-project-cover">{project.coverUrl ? <img src={project.coverUrl} alt="" loading="lazy"/> : <Layers size={30}/>}</div>
          <div><h3>{project.name}</h3><p>{project.status === 'published' ? '已归档人物' : '画布'} · {formatDateTime(project.updatedAt)}</p></div><ArrowRight size={16}/></Link>)}</div> :
        <div className="studio-home-empty"><p>还没有画布。从上方开始创作，或先选择一套模板。</p><button type="button" disabled={creating !== undefined} onClick={() => void start('blank')}><Plus size={16}/>新建空白画布</button></div>}
    </section>

    <section className="studio-home-section" aria-labelledby="canvas-templates-heading"><div className="studio-home-section-heading"><h2 id="canvas-templates-heading">模板与灵感</h2><Link href="/projects#templates">查看全部 <ArrowRight size={15}/></Link></div>
      <div className="studio-home-gallery-tabs" role="group" aria-label="模板与灵感分类">{([['official', '官方模板'], ['personal', '我的模板'], ['examples', '精选画布']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={gallery === value} onClick={() => setGallery(value)}>{label}</button>)}</div>
      {catalogue.error ? <LoadError message={catalogue.error} retry={() => setRefresh(n => n + 1)}/> : catalogue.loading ? <div className="studio-home-loading" role="status">正在加载模板与画布…</div> : items.length ?
        <div className="studio-home-templates">{items.map(t => <button type="button" className="studio-home-template" key={t.id} disabled={creating !== undefined || !!pending.current} onClick={() => void useTemplate(t)}>
          {t.coverUrl ? <img src={t.coverUrl} alt="" loading="lazy"/> : <CanvasThumb doc={t.doc} height={132}/>}
          <div><h3>{t.name}</h3><p>{t.summary}</p><span>{creating === t.id ? '正在打开…' : t.versionId ? `v${t.version} · 填写输入后查看制作计划` : gallery === 'examples' ? '复制到我的画布' : '从模板开始'} <ArrowRight size={14}/></span></div></button>)}</div> :
        <div className="studio-home-empty"><p>{gallery === 'personal' ? '还没有个人模板。在画布里选择“发布为模板”，以后可以换一个 IP 继续使用。' : gallery === 'examples' ? '精选画布发布后会展示在这里，你可以复制一份继续创作。' : '暂时没有可用的官方模板，可以从空白画布开始。'}</p><Link href="/projects">打开画布目录 <ArrowRight size={15}/></Link></div>}
    </section>
  </div>;
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="studio-home-error" role="alert"><p>{message}</p><button type="button" onClick={retry}>重新加载</button></div>;
}
