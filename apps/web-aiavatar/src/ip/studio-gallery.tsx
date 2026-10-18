"use client";
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, LayoutTemplate, Loader2 } from "lucide-react";
import type { IpProjectDoc, IpProjectSummary, IpTemplate } from "@ai-star-eco/types";
import { isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { IpStudioApi } from "./api";
import { CanvasThumb } from "./canvas-thumb";
import { StudioPageSearch } from './studio-page';

/** Each catalogue can fail independently: unavailable templates must not hide personal canvases. */
export function useStudioList<T>(load: () => Promise<T[]>, ready: boolean) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useStudioErrorState();
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true); setError(""); setNotEnrolled(false);
    void load().then(items => { if (active) setData(items); }).catch(e => {
      if (!active) return;
      if (isProductNotEnrolledError(e)) setNotEnrolled(true);
      else setError(e);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, ready, revision]);
  return { data, setData, loading, error, notEnrolled, reload: () => setRevision(n => n + 1) };
}

export function GalleryState({ loading, error, retry, children }: {
  loading?: boolean; error?: string; retry?: () => void; children?: React.ReactNode;
}) {
  return <div className="studio-gallery-state" role={loading ? "status" : undefined}>
    {loading ? <><Loader2 size={22} className="studio-gallery-spinner" /><p>正在加载…</p></> : error ? <><p><StudioErrorNotice error={error}/></p><button type="button" className="ip-brand-secondary" onClick={retry}>重新加载</button></> : children}
  </div>;
}

export function GallerySearch({ value, onChange, label, placeholder }: {
  value: string; onChange: (value: string) => void; label: string; placeholder: string;
}) {
  return <StudioPageSearch value={value} onChange={onChange} label={label} placeholder={placeholder}/>;
}

export function TemplateCard({ template, onOpen, children }: {
  template: IpTemplate; onOpen: (template: IpTemplate) => void; children?: React.ReactNode;
}) {
  return <article className="studio-gallery-template-card">
    <button type="button" className="studio-template-open" disabled={template.enabled === false} onClick={() => onOpen(template)} aria-label={`预览模板 ${template.name}`}>
      <div className="studio-gallery-preview"><CanvasThumb doc={template.doc} height={146} /><span className="studio-gallery-preview-label"><LayoutTemplate size={12} />{template.doc.nodes.length} 个节点</span></div>
      <div className="studio-template-copy"><h3>{template.name}</h3><p>{template.summary || "从这套画布流程开始创作。"}</p><div className="studio-template-meta"><span>{template.visibility === "personal" ? "个人模板" : "官方模板"}</span><span>{template.enabled === false ? "已停用" : "只读预览"}</span><ArrowRight size={15} aria-hidden="true" /></div></div>
    </button>
    {children}
  </article>;
}

type Preview = { doc?: IpProjectDoc; error?: string };

/** The list DTO has no document. Fetch only visible covers, at most two at a time,
 * and retain signed media only in memory. Explicit refresh also refreshes expiring URLs. */
export function useCanvasPreviews(projects: IpProjectSummary[]) {
  const cache = useRef(new Map<string, Promise<IpProjectDoc>>());
  const pool = useRef({ running: 0, waiting: [] as (() => void)[] });
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [revision, setRevision] = useState(0);
  const signature = projects.map(p => `${p.id}:${p.updatedAt}`).join("|");
  const request = useCallback((project: IpProjectSummary) => {
    const key = `${project.id}:${project.updatedAt}`;
    const existing = cache.current.get(key);
    if (existing) return existing;
    const promise = new Promise<IpProjectDoc>((resolve, reject) => {
      const run = () => {
        pool.current.running++;
        void IpStudioApi.getProject(project.id).then(p => resolve(p.doc)).catch(e => { cache.current.delete(key); reject(e); }).finally(() => {
          pool.current.running--;
          pool.current.waiting.shift()?.();
        });
      };
      if (pool.current.running < 2) run();
      else pool.current.waiting.push(run);
    });
    cache.current.set(key, promise);
    return promise;
  }, []);
  useEffect(() => {
    let active = true;
    for (const project of projects) {
      const key = `${project.id}:${project.updatedAt}`;
      void request(project).then(doc => {
        if (active) setPreviews(p => ({ ...p, [key]: { doc } }));
      }).catch(() => {
        if (active) setPreviews(p => ({ ...p, [key]: { error: "预览暂不可用" } }));
      });
    }
    return () => { active = false; };
    // Content requests are keyed by the persisted update time, not the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, revision, request]);
  return { previews, retry: () => { cache.current.clear(); setPreviews({}); setRevision(n => n + 1); } };
}
