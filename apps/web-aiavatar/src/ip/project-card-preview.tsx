"use client";
import { useEffect, useState } from 'react';
import { FileText, ImageOff, Layers, Video } from 'lucide-react';
import type { IpProjectDoc } from '@ai-star-eco/types';
import { projectPreview, type ProjectPreview } from './project-preview';

/** Shared priority: explicit cover, saved image, then what the canvas holds in words. No canvas editor is mounted. */
export function ProjectCardPreview({ coverUrl, preview, doc, loading, error, stepsFirst = false }: {
  coverUrl?: string | null; preview?: ProjectPreview; doc?: IpProjectDoc; loading?: boolean; error?: string;
  /** 模板先列步骤：模板里的文字多是填写说明或空字段，摘出来像一张没填的表。 */
  stepsFirst?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => setFailed([]), [doc, coverUrl]);
  const content = preview || (doc ? projectPreview(doc) : undefined);
  const url = [coverUrl, ...(content?.images.map(i => i.url) || [])].find(u => u && !failed.includes(u));
  if (url) return <div className="project-content-cover"><img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(items => [...items, url])}/></div>;
  if (content && (doc || !loading)) return <ProjectWordsCover content={content} stepsFirst={stepsFirst}/>;
  if (loading) return <div className="project-content-placeholder" role="status"><Layers size={25}/><span>正在读取内容…</span></div>;
  return <div className="project-content-placeholder"><ImageOff size={25}/><strong>{error || '预览暂不可用'}</strong><span>可打开画布，或刷新重试</span></div>;
}

/**
 * 没有图时用字说清画布里有什么：有正文摘一段，没有就列出每一步，什么都没有写「空白画布」。
 * 原来画的是节点位置示意图（灰蓝方块），2026-10-30 线上走查：灵感墙和项目页大半是它，看着像图没加载出来，也说明不了内容。
 */
function ProjectWordsCover({ content, stepsFirst }: { content: ProjectPreview; stepsFirst: boolean }) {
  const video = !!content.videoTitle;
  const steps = content.steps.length ? <div className="project-content-placeholder is-plan">
    <Layers size={22} aria-hidden="true"/><strong>{content.steps.length} 个步骤</strong>
    {/* 一段字而不是一排胶囊：窄卡片里胶囊一行只放一个，上下都被切掉（2026-10-30 手机两列）。 */}
    <p className="project-content-step-list">{content.steps.join(' · ')}</p>
  </div> : null;
  if (stepsFirst && steps) return steps;
  if (content.excerpt) return <div className={'project-content-document' + (video ? ' is-video' : '')}>
    {video ? <Video size={18} aria-hidden="true"/> : <FileText size={18} aria-hidden="true"/>}<p>{content.excerpt}</p>
  </div>;
  if (steps) return steps;
  return <div className="project-content-placeholder"><Layers size={22} aria-hidden="true"/><strong>空白画布</strong></div>;
}
