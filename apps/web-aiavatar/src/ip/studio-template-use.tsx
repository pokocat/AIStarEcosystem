'use client';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

import { useEffect, useRef, useState } from 'react';
import { Button, Modal, Spin } from 'antd';
import dynamic from 'next/dynamic';
import { LayoutTemplate, Play } from 'lucide-react';
import type { IpProjectDoc, IpTemplate } from '@ai-star-eco/types';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { IpStudioApi } from './api';
import { studioOverlayContainer } from './studio-overlay';
import { studioTemplateCopyHref } from './studio-entry';
import { projectPreview } from './project-preview';
import { templateKind, templateNeeds, templatePrompt, templateSpec } from './template-facts';
import { readTemplateVersion } from '@/canvas-bridge/template-api';
import { templatePreviewDocument } from '@/canvas-bridge/template-preview';

const PreviewCanvas = dynamic(() => import('./studio-template-preview'), { ssr: false, loading: () => <Spin aria-label="正在打开画布"/> });
const KIND_LABEL = { video: '视频', image: '图片', canvas: '' } as const;

/**
 * 灵感详情：一个不占满屏幕的弹窗，看效果和要准备什么；点「做同款」才复制一份，并进入画布页。
 * 提示词不在预览里显示（用户 2026-11-06 要求），做同款后的画布里才有。
 * 没有成片的工作流模板直接显示只读画布；有成片的也能切过去看每一步。这里不写任何东西，不会建草稿。
 */
export function StudioTemplateUse({ template, onClose, onCreated }: { template: IpTemplate; nodes?: CanvasNodeData[]; onClose: () => void; onCreated: (href: string) => void }) {
  const [error, setError] = useStudioErrorState(), [loadError, setLoadError] = useStudioErrorState(), [retry, setRetry] = useState(0);
  const [doc, setDoc] = useState<IpProjectDoc>(), [busy, setBusy] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false), [showCanvas, setShowCanvas] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  // The dialog is mounted on demand, so closing unmounts it before antd can hand focus back: return it to the card here.
  const trigger = useRef(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null);
  useEffect(() => () => trigger.current?.focus?.({ preventScroll: true }), []);
  const callbacks = useRef({ onCreated }); callbacks.current = { onCreated };
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true; setLoadError(''); setDoc(undefined);
    const preview = template.versionId ? readTemplateVersion(template.versionId).then(templatePreviewDocument) : Promise.resolve(template.doc);
    void preview.then(value => { if (active) setDoc(value); }).catch(e => { if (active) setLoadError(e); });
    return () => { active = false; };
  }, [template.id, template.versionId, template.doc, retry]);
  const saveCopy = async () => {
    if (inFlight.current || !doc) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const project = await IpStudioApi.createProject({ templateId: template.id });
      callbacks.current.onCreated(studioTemplateCopyHref(project));
    } catch (e) {
      setError(e);
      inFlight.current = false; setBusy(false);
    }
  };
  const media = mediaFailed ? undefined : template.previewVideoUrl ? { video: template.previewVideoUrl, poster: template.coverUrl } : template.coverUrl ? { image: template.coverUrl } : undefined;
  const canvas = !media || showCanvas;
  const facts = doc ?? template.doc;
  const kind = templateKind({ doc: facts });
  const needs = templateNeeds(doc), steps = doc ? projectPreview(doc).steps : [];
  const source = template.visibility === 'personal' ? `个人模板${template.version ? ` · v${template.version}` : ''}` : kind === 'canvas' ? '官方模板' : '官方案例 · AI 生成';
  const meta = [source, KIND_LABEL[kind], templateSpec(facts)].filter(Boolean).join(' · ');
  return <Modal open getContainer={studioOverlayContainer} title={template.name} footer={null} width={1000} centered closable={busy ? false : { 'aria-label': '关闭' }}
    className="studio-template-dialog ip-surface" keyboard={!busy && !inspecting} mask={{ closable: !busy }} onCancel={() => { if (!busy) onClose(); }}>
    <div className="studio-template-dialog-body">
      <div className="studio-template-dialog-media">
        {loadError ? <div className="studio-error-recovery"><StudioErrorNotice error={loadError}/><Button onClick={() => setRetry(n => n + 1)}>重新加载</Button></div>
          : canvas ? (doc ? <PreviewCanvas doc={doc} onInspectingChange={setInspecting}/> : <div className="studio-template-preview-loading" role="status"><Spin size="small"/><span>正在加载内容…</span></div>)
          : media?.video ? <video key={media.video} ref={el => { if (el) el.muted = true; }} src={media.video} poster={media.poster} controls autoPlay muted loop playsInline aria-label={`${template.name} 的示例效果`} onError={() => setMediaFailed(true)}/>
          : <img src={media?.image} alt={`${template.name} 的示例效果`} onError={() => setMediaFailed(true)}/>}
        {media && doc && !loadError && <button type="button" className="studio-template-dialog-toggle" onClick={() => setShowCanvas(on => !on)}>{showCanvas ? <><Play size={14} aria-hidden="true"/>查看效果</> : <><LayoutTemplate size={14} aria-hidden="true"/>查看画布</>}</button>}
      </div>
      <div className="studio-template-dialog-copy">
        <div className="studio-template-dialog-scroll">
          <small>{meta}</small>
          <h2>{template.name}</h2>
          {template.summary && <p>{template.summary}</p>}
          {doc && <section aria-label="需要准备"><h3>需要准备</h3><p>{needs.length ? needs.map(n => `${n.label}${n.optional ? '（选填）' : ''}`).join('、') : '无需准备素材，可直接生成。'}</p></section>}
          {kind === 'canvas' && steps.length > 0 && <section aria-label="创作步骤"><h3>创作步骤</h3><ol className="studio-template-dialog-steps">{steps.map((step, i) => <li key={`${step}-${i}`}>{step}</li>)}</ol></section>}
        </div>
        <footer>
          {error && <StudioErrorNotice error={error}/>}
          <small>将新建一张画布{templatePrompt(doc) ? '，并填好提示词' : ''}。此操作不消耗积分，生成前将显示所需积分。</small>
          <Button type="primary" block size="large" loading={busy} disabled={!doc || busy} onClick={() => void saveCopy()}>做同款</Button>
        </footer>
      </div>
    </div>
  </Modal>;
}
