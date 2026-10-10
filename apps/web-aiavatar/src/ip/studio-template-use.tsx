'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, ConfigProvider, Modal, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { IpProject, IpTemplate } from '@ai-star-eco/types';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { IpStudioApi } from './api';
import { studioOverlayContainer } from './studio-overlay';

/** All entry points copy the template into an ordinary personal canvas, with no input or quote gate. */
export function StudioTemplateUse({ template, onClose, onCreated }: { template: IpTemplate; nodes?: CanvasNodeData[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const callbacks = useRef({ onCreated }); callbacks.current = { onCreated };
  const attempt = useRef<{ id: string; retry: number; promise: Promise<IpProject>; delivered?: boolean } | undefined>(undefined);
  useEffect(() => {
    let active = true; setError('');
    // React Strict Mode and parent rerenders reuse one accepted free creation request.
    if (!attempt.current || attempt.current.id !== template.id || attempt.current.retry !== retry)
      attempt.current = { id: template.id, retry, promise: IpStudioApi.createProject({ templateId: template.id }) };
    const current = attempt.current;
    void current.promise.then(project => { if (active && !current.delivered) { current.delivered = true; callbacks.current.onCreated(project.id); } }).catch(e => { if (active) setError(e instanceof Error ? e.message : '模板没有打开成功，请重试'); });
    return () => { active = false; };
  }, [template.id, retry]);
  return <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#495b91', borderRadius: 9, fontFamily: 'var(--ip-font-sans)' } }}>
    <Modal open centered getContainer={studioOverlayContainer} title={error ? '模板没有打开成功' : '正在打开模板'} width={420} closable={!!error} keyboard={!!error} mask={{ closable: !!error }} onCancel={onClose} footer={error ? <><Button onClick={onClose}>返回</Button><Button type="primary" onClick={() => setRetry(n => n + 1)}>重试</Button></> : null}>
      {error ? <Alert type="error" title={error} showIcon /> : <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBlock: 16 }}><Spin size="small" /><span>正在创建你的画布副本…</span></div>}
    </Modal>
  </ConfigProvider>;
}
