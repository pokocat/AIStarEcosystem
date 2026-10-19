"use client";
import { useEffect, useState } from 'react';
import { ImageOff, Layers } from 'lucide-react';
import type { IpProjectDoc } from '@ai-star-eco/types';
import { CanvasThumb } from './canvas-thumb';
import { projectPreview, type ProjectPreview } from './project-preview';

/** Shared priority: explicit cover, saved image, canvas thumbnail. No canvas editor is mounted. */
export function ProjectCardPreview({ coverUrl, preview, doc, loading, error }: {
  coverUrl?: string | null; preview?: ProjectPreview; doc?: IpProjectDoc; loading?: boolean; error?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => setFailed([]), [doc, coverUrl]);
  const content = preview || (doc ? projectPreview(doc) : undefined);
  const url = [coverUrl, ...(content?.images.map(i => i.url) || [])].find(u => u && !failed.includes(u));
  if (url) return <div className="project-content-cover"><img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(items => [...items, url])}/></div>;
  if (doc) return <CanvasThumb doc={doc} height={146}/>;
  if (loading) return <div className="project-content-placeholder" role="status"><Layers size={25}/><span>正在读取内容…</span></div>;
  return <div className="project-content-placeholder"><ImageOff size={25}/><strong>{error || '预览暂不可用'}</strong><span>可打开画布，或刷新重试</span></div>;
}
