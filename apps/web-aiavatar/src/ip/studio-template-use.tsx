'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, ConfigProvider, Modal, Spin } from 'antd';
import dynamic from 'next/dynamic';
import { ArrowLeft, Lock } from 'lucide-react';
import zhCN from 'antd/locale/zh_CN';
import type { IpProjectDoc, IpTemplate } from '@ai-star-eco/types';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { IpStudioApi } from './api';
import { studioOverlayContainer } from './studio-overlay';
import { readTemplateVersion } from '@/canvas-bridge/template-api';
import { templatePreviewDocument } from '@/canvas-bridge/template-preview';

const PreviewCanvas = dynamic(() => import('./studio-template-preview'), { ssr: false, loading: () => <Spin aria-label="正在打开画布"/> });

/** Published templates are viewed without persistence; only an explicit save creates a personal copy. */
export function StudioTemplateUse({ template, onClose, onCreated }: { template: IpTemplate; nodes?: CanvasNodeData[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [error, setError] = useState(''), [loadError, setLoadError] = useState(''), [retry, setRetry] = useState(0);
  const [doc, setDoc] = useState<IpProjectDoc>(), [busy, setBusy] = useState(false);
  const callbacks = useRef({ onCreated }); callbacks.current = { onCreated };
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true; setLoadError(''); setDoc(undefined);
    const preview = template.versionId ? readTemplateVersion(template.versionId).then(templatePreviewDocument) : Promise.resolve(template.doc);
    void preview.then(value => { if (active) setDoc(value); }).catch(e => { if (active) setLoadError(e instanceof Error ? e.message : '模板没有打开成功，请重试'); });
    return () => { active = false; };
  }, [template.id, template.versionId, template.doc, retry]);
  const saveCopy = async () => {
    if (inFlight.current || !doc) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const project = await IpStudioApi.createProject({ templateId: template.id });
      callbacks.current.onCreated(project.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '副本没有保存成功，请重试');
      inFlight.current = false; setBusy(false);
    }
  };
  return <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#495b91', borderRadius: 9, fontFamily: 'var(--ip-font-sans)' } }}>
    <Modal open getContainer={studioOverlayContainer} title={null} footer={null} width="100vw" closable={false}
      className="studio-template-preview-modal ip-surface" style={{ top: 0, paddingBottom: 0, maxWidth: '100vw' }}
      keyboard={!busy} mask={{ closable: false }} onCancel={() => { if (!busy) onClose(); }}>
      <div className="studio-template-preview">
        <header><Button type="text" icon={<ArrowLeft size={18}/>} disabled={busy} onClick={onClose}>返回</Button>
          <div><strong>{template.name}</strong><span><Lock size={13}/>{template.visibility === 'personal' ? '个人模板' : '官方模板'} · 只读{template.version ? ` · v${template.version}` : ''}</span></div>
          <Button type="primary" className="studio-template-preview-copy" loading={busy} disabled={!doc || busy} onClick={() => void saveCopy()}>存为个人副本</Button>
        </header>
        {error && <Alert type="error" title={error} showIcon/>}
        <main>{loadError ? <Alert type="error" title={loadError} showIcon action={<Button onClick={() => setRetry(n => n + 1)}>重新加载</Button>}/>
          : doc ? <PreviewCanvas doc={doc}/> : <div className="studio-template-preview-loading" role="status"><Spin size="small"/><span>正在读取模板…</span></div>}</main>
      </div>
    </Modal>
  </ConfigProvider>;
}
