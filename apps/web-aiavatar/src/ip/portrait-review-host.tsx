'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, ConfigProvider, Flex, Modal, Spin, Typography } from 'antd';
import type { VideoPortraitItem, VideoPortraitReview } from '@ai-star-eco/types/video-portrait-library';
import { finishPortraitReview, subscribePortraitReviews, type PortraitReviewRequest } from './portrait-review-events';
import { PortraitDeclaration, PortraitMaterialTable, PortraitPersonModal, PORTRAIT_THEME, usePortraitOverview } from './portrait-review-ui';
import { normalizeStudioError } from './studio-errors';
import * as api from './api/video-portrait-library';
import './video-portrait-library.css';

/** Root-level dialog shared by canvas, AI Video, director and any reference-passing preflight. */
export function PortraitReviewHost() {
  const [requests, setRequests] = useState<PortraitReviewRequest[]>([]), [contexts, setContexts] = useState<VideoPortraitReview[]>([]);
  const [expanded, setExpanded] = useState<string>(), [personLibrary, setPersonLibrary] = useState<string>(), [contextError, setContextError] = useState('');
  const request = requests[0];
  const { overview, error, busy, reload, act } = usePortraitOverview(!!request);
  useEffect(() => subscribePortraitReviews(next => setRequests(old => old.some(r => r.key === next.key) ? old : [...old, next])), []);
  useEffect(() => { setContexts([]); setExpanded(undefined); setContextError(''); }, [request?.key]);
  useEffect(() => {
    if (!request?.links.length) return;
    let alive = true;
    void Promise.all(request.links.map(link => api.portraitReview(link.jobId))).then(next => { if (alive) { setContexts(next); setContextError(''); } }).catch(e => { if (alive) setContextError(normalizeStudioError(e).message); });
    return () => { alive = false; };
  }, [request, overview]);
  const items = useMemo(() => {
    const originals = [...(request?.items || []), ...contexts.flatMap(c => c.items)];
    const latest = new Map(overview?.items.map(item => [item.id, item]) || []);
    return [...new Map(originals.map(item => [item.id, latest.get(item.id) || item])).values()];
  }, [request, contexts, overview]);
  const awaiting = contexts.filter(c => c.awaiting);
  const ready = items.length > 0 && items.every(i => i.status === 'active') && (!request?.links.length || awaiting.length > 0 && awaiting.every(c => c.canContinue));
  const ended = !!request?.links.length && contexts.length === request.links.length && !awaiting.length;
  const changed = useCallback(async () => { await reload(); }, [reload]);
  const close = (done: boolean) => {
    if (!request) return; finishPortraitReview(request.key, done); setRequests(old => old.filter(r => r.key !== request.key)); setPersonLibrary(undefined);
  };
  if (!request) return null;
  return <ConfigProvider theme={PORTRAIT_THEME} button={{ autoInsertSpace: false }}>
    <Modal title="参考人像核验" open width={760} maskClosable={false} onCancel={() => close(false)} footer={<Flex align="center" justify="space-between" gap={12} wrap>
      <Typography.Text type="secondary" className="portrait-secondary">{ended ? '任务状态已更新，请返回查看。' : ready ? '素材已就绪，可继续生成。' : '当前内容已保留，审核通过后继续。'}</Typography.Text>
      <Flex gap={8}><Button onClick={() => close(false)}>{ended ? '返回任务' : '稍后处理'}</Button>{!ended && <Button type="primary" loading={busy} disabled={!ready} onClick={() => void act(async () => {
        for (const context of awaiting) await api.resumePortraitReview(context.jobId);
        close(true);
      })}>继续生成</Button>}</Flex>
    </Flex>}>
      <Flex vertical gap={16}>
        <Typography.Paragraph type="secondary">请确认以下参考人像，无需离开当前页面。</Typography.Paragraph>
        {(error || contextError) && <Alert type="error" title={error || contextError} showIcon action={<Button size="small" onClick={() => void act(changed)}>重试</Button>} />}
        {!overview || request.links.length > 0 && !contexts.length ? <Spin aria-label="正在加载核验素材" /> : <PortraitMaterialTable items={items} expanded={expanded} onExpand={setExpanded}
          onRefresh={item => void act(() => api.refreshPortrait(item.id))} renderEditor={item => <PortraitDeclaration item={item} overview={overview} busy={busy} onPerson={setPersonLibrary}
            onSubmit={async values => { await act(async () => { await api.declarePortrait(item.id, { ...values, accepted: !!values.accepted, agreementVersion: overview.agreement.version }); setExpanded(undefined); }); }} />} />}
      </Flex>
    </Modal>
    <PortraitPersonModal libraryId={personLibrary} overview={overview} onClose={() => setPersonLibrary(undefined)} onChanged={changed} />
  </ConfigProvider>;
}
