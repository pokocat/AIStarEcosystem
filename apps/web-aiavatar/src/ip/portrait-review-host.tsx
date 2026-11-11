'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Avatar, Button, ConfigProvider, Flex, Image, Modal, Segmented, Spin, Typography } from 'antd';
import { UserRound } from 'lucide-react';
import type { VideoPortraitItem, VideoPortraitReview } from '@ai-star-eco/types/video-portrait-library';
import { finishPortraitReview, subscribePortraitReviews, type PortraitReviewRequest } from './portrait-review-events';
import { PortraitFooterBar, PortraitGuide, portraitNeedsAction, portraitStatus, PORTRAIT_NO_FOOTER, PORTRAIT_THEME, usePortraitFooter, usePortraitOverview } from './portrait-review-ui';
import { normalizeStudioError } from './studio-errors';
import * as api from './api/video-portrait-library';
import './video-portrait-library.css';

/** Root-level dialog shared by canvas, AI Video, director and any reference-passing preflight. */
export function PortraitReviewHost() {
  const [requests, setRequests] = useState<PortraitReviewRequest[]>([]), [contexts, setContexts] = useState<VideoPortraitReview[]>([]);
  const [current, setCurrent] = useState<string>(), [contextError, setContextError] = useState('');
  const request = requests[0];
  const { overview, error, busy, reload, act } = usePortraitOverview(!!request, !request?.links.length);
  const footer = usePortraitFooter();
  useEffect(() => subscribePortraitReviews(next => setRequests(old => old.some(r => r.key === next.key) ? old : [...old, next])), []);
  useEffect(() => { setContexts([]); setCurrent(undefined); setContextError(''); }, [request?.key]);
  useEffect(() => {
    if (!request?.links.length) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const next = await Promise.all(request.links.map(link => api.portraitReview(link.jobId)));
        if (alive) { setContexts(next); setContextError(''); }
      } catch (e) {
        if (alive) setContextError(normalizeStudioError(e).message);
      } finally {
        if (alive) timer = setTimeout(read, 5000);
      }
    };
    void read();
    return () => { alive = false; clearTimeout(timer); };
  }, [request, overview]);
  const matches = !!request?.links.length && request.links.length === contexts.length
    && request.links.every(link => contexts.some(context => context.jobId === link.jobId));
  const items = useMemo(() => {
    if (request?.links.length) return matches ? [...new Map(contexts.flatMap(c => c.items).map(item => [item.id, item])).values()] : [];
    const latest = new Map(overview?.items.map(item => [item.id, item]) || []);
    return (request?.items ?? []).map(item => latest.get(item.id) ?? item);
  }, [request, contexts, matches, overview]);
  // Open on the first photo that needs the user; when it is submitted, move on to the next one.
  const pendingBefore = useRef(new Map<string, boolean>());
  useEffect(() => {
    const before = pendingBefore.current;
    pendingBefore.current = new Map(items.map(item => [item.id, portraitNeedsAction(item)]));
    const here = items.find(item => item.id === current);
    if (!here) { const first = items.find(portraitNeedsAction) || items[0]; if (first?.id !== current) setCurrent(first?.id); return; }
    if (before.get(here.id) && !portraitNeedsAction(here)) { const next = items.find(portraitNeedsAction); if (next) setCurrent(next.id); }
  }, [items, current]);
  const ready = items.length > 0 && items.every(i => i.status === 'active');
  const ended = matches && contexts.every(c => !c.awaiting);
  const changed = useCallback(async () => { await reload(); }, [reload]);
  const close = useCallback((done: boolean) => {
    if (!request) return; finishPortraitReview(request.key, done); setRequests(old => old.filter(r => r.key !== request.key));
  }, [request]);
  useEffect(() => {
    // Preflight already has the original Generate click. Submitted jobs resume on the server.
    if (request && !busy && (ended || (!request.links.length && ready))) close(ready);
  }, [request, ended, ready, busy, close]);
  if (!request) return null;
  const loading = !overview || !!request.links.length && !matches;
  const passed = items.filter(i => i.status === 'active').length;
  const note = loading || ended ? '' : ready ? '审核已通过，正在继续生成。'
    : `${items.length > 1 ? `已通过 ${passed}/${items.length}。` : ''}素材全部通过后将自动继续生成。`;
  return <ConfigProvider theme={PORTRAIT_THEME} button={{ autoInsertSpace: false }}>
    <Modal title="确认参考人像" open width={720} mask={{ closable: false }} onCancel={() => close(false)} footer={<PortraitFooterBar footer={footer}
      note={note && <Typography.Text type="secondary" className="portrait-secondary" role="status">{note}</Typography.Text>}>
      <Button onClick={() => close(false)}>{request.links.length ? '关闭' : '暂不生成'}</Button>
    </PortraitFooterBar>}>
      <Flex vertical gap={20}>
        <Typography.Text type="secondary">含人脸的参考图需要先确认人像来源，才能用于生成视频。</Typography.Text>
        {(error || contextError) && <Alert type="error" title={error || contextError} showIcon action={<Button size="small" onClick={() => void act(changed)}>重试</Button>} />}
        {loading ? <Flex justify="center" className="portrait-loading"><Spin aria-label="正在加载核验素材" /></Flex> : <>
          {items.length > 1 && <Segmented<string> value={current} onChange={setCurrent} className="portrait-switcher" options={items.map(item => ({ value: item.id, label: <Flex vertical align="center" gap={4} className="portrait-switcher-item">
            {item.previewUrl ? <Image src={item.previewUrl} alt={item.label} width={40} height={50} preview={false} style={{ objectFit: 'cover', borderRadius: 6 }} /> : <Avatar shape="square" size={40} icon={<UserRound size={16} />} />}
            <span>{portraitStatus[item.status] || '待确认'}</span>
          </Flex> }))} />}
          {items.map(item => <div key={item.id} hidden={item.id !== current}>
            <PortraitGuide item={item} overview={overview} busy={busy} act={act} footer={item.id === current ? footer.slots : PORTRAIT_NO_FOOTER} />
          </div>)}
        </>}
      </Flex>
    </Modal>
  </ConfigProvider>;
}
