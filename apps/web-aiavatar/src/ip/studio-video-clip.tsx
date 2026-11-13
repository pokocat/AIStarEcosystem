'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, InputNumber, Modal } from 'antd';
import type { StudioMediaImportResult } from '@ai-star-eco/types';
import { SignedVideo } from '@/canvas-bridge/signed-video';
import { clipStudioVideo, studioVideoInfo } from '@/canvas-bridge/studio-media-jobs';
import { studioOverlayContainer } from './studio-overlay';

export const STUDIO_REFERENCE_SECONDS = 60;

export function StudioVideoClip({ storageKey, src, title, durationSec, onUse, onClose }: {
  storageKey: string; src?: string; title: string; durationSec?: number;
  onUse: (clip: StudioMediaImportResult) => void | Promise<void>; onClose: () => void;
}) {
  const [duration, setDuration] = useState(durationSec);
  const [start, setStart] = useState<number | null>(0);
  const [end, setEnd] = useState<number | null>(durationSec ? Math.min(STUDIO_REFERENCE_SECONDS, Math.floor(durationSec * 10) / 10) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState<StudioMediaImportResult>();
  const preview = useRef<HTMLVideoElement>(null);
  const request = useRef<{ start: number; end: number; id: string }>(undefined);

  useEffect(() => {
    if (durationSec) return;
    let active = true;
    void studioVideoInfo(storageKey).then(info => {
      if (!active) return;
      setDuration(info.durationSec);
      setEnd(Math.min(STUDIO_REFERENCE_SECONDS, Math.floor(info.durationSec * 10) / 10));
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : '无法读取视频时长'); });
    return () => { active = false; };
  }, [durationSec, storageKey]);

  const valid = start != null && end != null && duration != null && start >= 0 && end <= duration
    && end - start >= .5 - .000001 && end - start <= STUDIO_REFERENCE_SECONDS + .000001;

  const submit = async () => {
    if (busy || (!ready && !valid)) return;
    setBusy(true); setError('');
    try {
      if (!request.current || request.current.start !== start || request.current.end !== end) {
        request.current = { start: start!, end: end!, id: crypto.randomUUID() };
      }
      const clip = ready ?? await clipStudioVideo(storageKey, title, start!, end!, request.current.id);
      setReady(clip);
      await onUse(clip);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : '截取未完成，请重试'); }
    finally { setBusy(false); }
  };

  return <Modal open title="截取参考片段" onCancel={busy ? undefined : onClose} closable={!busy} keyboard={!busy}
    mask={{ closable: !busy }} getContainer={studioOverlayContainer} cancelButtonProps={{ disabled: busy }}
    okText={ready ? '重试使用片段' : '截取并使用'} confirmLoading={busy} okButtonProps={{ disabled: !ready && !valid }}
    onOk={() => void submit()} destroyOnHidden>
    <SignedVideo ref={preview} controls playsInline preload="metadata" aria-label="预览原片" src={src} storageKey={storageKey}
      style={{ display: 'block', width: '100%', maxHeight: 300 }}/>
    <p>选择最多 60 秒。片段将单独保存到资产库，原片可以继续使用。</p>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
      <label>起点（秒） <InputNumber<number> aria-label="起点（秒）" min={0} max={duration} step={0.1} precision={1}
        value={start} disabled={busy || !!ready} onChange={value => {
          setStart(value);
          if (value != null && preview.current?.readyState) preview.current.currentTime = value;
        }}/></label>
      <label>终点（秒） <InputNumber<number> aria-label="终点（秒）" min={0} max={duration} step={0.1} precision={1}
        value={end} disabled={busy || !!ready} onChange={setEnd}/></label>
    </div>
    {duration != null && start != null && end != null && !valid && <Alert type="warning" title="请选择原片内 0.5 至 60 秒的范围"/>}
    {error && <Alert type="error" title={error}/>}
  </Modal>;
}
