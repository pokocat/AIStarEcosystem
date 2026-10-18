"use client";
import { useState } from 'react';
import { FileText, Film, ImageOff, Layers, Mic, Plus } from 'lucide-react';
import type { ProjectPreview } from './project-preview';

export function ProjectCardPreview({ coverUrl, preview, loading, error }: { coverUrl?: string; preview?: ProjectPreview; loading?: boolean; error?: string }) {
  const [failedUrl, setFailedUrl] = useState('');
  const url = coverUrl || preview?.images.find(i => i.url)?.url;
  if (url && failedUrl !== url) return <div className="project-content-cover"><img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(url)}/><span className="project-content-kind">{preview?.videoTitle && !preview.images.length ? <><Film size={12}/>{preview.duration ? `${Math.round(preview.duration * 10) / 10} 秒` : "视频"}</> : "项目封面"}</span></div>;
  if (loading) return <div className="project-content-placeholder" role="status"><Layers size={25}/><span>正在读取内容…</span></div>;
  if (error || url && failedUrl === url) return <div className="project-content-placeholder"><ImageOff size={25}/><strong>预览暂不可用</strong><span>可打开画布，或刷新重试</span></div>;
  if (preview?.videoTitle) return <div className="project-content-document is-video"><Film size={26}/><strong>{preview.videoTitle}</strong><span>{preview.duration ? `${Math.round(preview.duration * 10) / 10} 秒 · ` : ''}视频内容</span><p>进入画布查看视频</p></div>;
  if (preview?.excerpt) return <div className="project-content-document"><FileText size={22}/><p>{preview.excerpt}</p><span>文字预览</span></div>;
  if (preview?.audioTitle) return <div className="project-content-document"><Mic size={26}/><strong>{preview.audioTitle}</strong><span>音频内容</span><p>进入画布试听</p></div>;
  if (preview?.empty) return <div className="project-content-placeholder"><Plus size={28}/><strong>尚未添加内容</strong><span>打开画布，开始创作</span></div>;
  return <div className="project-content-document"><Layers size={22}/><div className="project-content-steps">{preview?.steps.slice(0, 3).map((s, i) => <span key={i}>{s}</span>)}</div><span>创作流程 · 尚无作品</span></div>;
}
