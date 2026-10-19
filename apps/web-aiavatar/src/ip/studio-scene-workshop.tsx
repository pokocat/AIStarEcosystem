'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import type { IpTemplate } from '@ai-star-eco/types';
import { PlatformGateScreen, useRequireAuth } from '@/components/hub/auth';
import { IpStudioApi } from './api';
import { StudioPage } from './studio-page';
import { GalleryState, useStudioList } from './studio-gallery';
import { StudioTemplateUse } from './studio-template-use';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';
import { sceneTemplate, studioScenes } from './studio-scenes';
import { formatDateTime } from '@/lib/datetime';

export function StudioSceneWorkshop() {
  const router = useRouter();
  const auth = useRequireAuth();
  const templates = useStudioList(IpStudioApi.listTemplates, auth === 'ok');
  const projects = useStudioList(IpStudioApi.listProjects, auth === 'ok');
  const [preview, setPreview] = useState<IpTemplate>();
  const [starting, setStarting] = useState<string>();
  const [error, setError] = useStudioErrorState();
  const lock = useRef(false);
  const start = async (template: IpTemplate) => {
    if (lock.current) return;
    lock.current = true; setStarting(template.id); setError('');
    try {
      const project = await IpStudioApi.createProject({ templateId: template.id });
      router.push(`/projects/${encodeURIComponent(project.id)}`);
    } catch (e) { setError(e); lock.current = false; setStarting(undefined); }
  };
  if (auth === 'no-platform' || templates.notEnrolled || projects.notEnrolled) return <PlatformGateScreen/>;
  const recent = [...projects.data].filter(p => studioScenes.some(s => s.templateId && s.templateId === p.templateId)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0,4);
  return <StudioPage title="场景工坊" description="选一个方向，开启新的创作。" className="studio-scenes-page">
    {preview && <StudioTemplateUse template={preview} onClose={() => setPreview(undefined)} onCreated={id => router.push(`/projects/${encodeURIComponent(id)}`)}/>}
    {auth !== 'ok' ? <GalleryState loading/> : <>
      {templates.error && <GalleryState error={templates.error} retry={templates.reload}/>}
      {error && <div className="studio-gallery-action-error"><StudioErrorNotice error={error}/></div>}
      <div className="studio-scene-grid">{studioScenes.map(scene => {
        const template = sceneTemplate(templates.data, scene.templateId);
        return <article key={scene.id} className="studio-scene-card">
          <div className="studio-scene-visual"><Image src={scene.image} alt="" width={960} height={640} sizes="(min-width: 960px) 25vw, 50vw"/></div>
          <div className="studio-scene-copy"><h2>{scene.title}</h2><p>{scene.description}</p>
            <button className="ip-brand-button" disabled={!template || starting !== undefined || templates.loading} onClick={() => template && void start(template)}>{starting === template?.id && starting ? <><Loader2 size={16} className="studio-gallery-spinner"/>正在打开</> : template ? <>开始创作<ArrowRight size={16}/></> : templates.loading && scene.templateId ? '正在读取…' : '【待建设】'}</button>
            {template ? <button className="studio-scene-preview" disabled={starting !== undefined} onClick={() => setPreview(template)}>预览模板</button> : <small>{scene.templateId ? '模板上线后开放' : '创作能力后续接入'}</small>}
            {template && scene.id === "commerce" && <small>商品选品与融合【待建设】</small>}
          </div>
        </article>;
      })}</div>
      <p className="studio-scene-note">从这里起步，按你的想法自由创作。</p>
      <section className="studio-scene-recent"><div className="studio-gallery-panel-heading"><div><h2>继续创作</h2><p>从上次停下的地方，继续。</p></div><button className="studio-page-refresh" aria-label="刷新最近画布" disabled={projects.loading} onClick={projects.reload}><RefreshCw size={16}/></button></div>
        {projects.error ? <GalleryState error={projects.error} retry={projects.reload}/> : projects.loading ? <GalleryState loading/> : recent.length ? <div className="studio-recent-list">{recent.map(p => <Link key={p.id} href={`/projects/${encodeURIComponent(p.id)}`}><div><strong title={p.name}>{p.name}</strong><span>{formatDateTime(p.updatedAt)}</span></div><span>继续创作<ArrowRight size={16}/></span></Link>)}</div> : <div className="studio-workspace-empty"><p>新的创作，将从这里留下第一笔。</p><Link href="/projects">查看项目<ArrowRight size={16}/></Link></div>}
      </section>
    </>}
  </StudioPage>;
}
