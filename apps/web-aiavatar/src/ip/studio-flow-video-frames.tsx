'use client';
// 抽帧 (2026-10-21): pick the first, last or current frame of a video node and get an image node linked to it. Free and
// done in the browser: the clip is read through the backend as a Blob (production OSS has no CORS, a signed URL would
// taint the canvas), one frame is drawn, and the picture is uploaded as the user's own image.
// While that runs the new node is only a local placeholder (`pending`, drawn by the canvas, never in the document): a loading
// status or any studio task field would make task recovery and 「确认原任务」 treat it as a generation.
import { useStudioApp } from './studio-errors';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Button, Radio } from 'antd';
import { nanoid } from 'nanoid';
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from '@/canvas/types/canvas';
import { imageMetadata } from '@/canvas/lib/canvas/canvas-node-factory';
import { uploadImage } from '@/canvas-bridge/image-storage';
import { fetchAssetBlob } from '@/canvas-bridge/api';
import { placeStudioNode } from '@/canvas-bridge/flow-document';
import { studioGenerationPending } from '@/canvas-bridge/studio-nodes';
import { STUDIO_CARD_BORDER_X, STUDIO_CARD_CHROME, studioVideoSize } from '@/canvas-bridge/studio-media-fit';
import { captureStudioVideoFrame, formatFrameTime, framePositionLabel, StudioFrameError, type StudioFramePosition } from '@/canvas-bridge/studio-video-frame';
import { USE_MOCK } from '@/ip/api/_client';
import { StudioFloatingPanel } from './studio-floating-panel';

export type StudioPendingFrame = { node: CanvasNodeData; connection: CanvasConnection };
type Props = {
  nodes: CanvasNodeData[];
  pending: StudioPendingFrame[];
  onPendingChange: Dispatch<SetStateAction<StudioPendingFrame[]>>;
  onInsert: (nodes: CanvasNodeData[], connections: CanvasConnection[]) => Promise<void>;
  /** 演示模式 cannot read or upload files; tests flip it. */
  demo?: boolean;
};

/** The `<video>` a node shows on the canvas (its playhead is the 「当前帧」). */
const canvasVideo = (nodeId: string) =>
  document.querySelector<HTMLVideoElement>(`.react-flow__node[data-id="${CSS.escape(nodeId)}"] .studio-flow-media video`);
const MIN_HEIGHT = 140;
const shapeHeight = (width: number, w?: number, h?: number) => w && h ? Math.max(MIN_HEIGHT, Math.round((width - STUDIO_CARD_BORDER_X) * h / w + STUDIO_CARD_CHROME)) : undefined;
const busy = (node: CanvasNodeData) => node.metadata?.status === 'loading' || studioGenerationPending(node);

export function StudioFlowVideoFrames({ nodes, pending, onPendingChange, onInsert, demo = USE_MOCK }: Props) {
  const { message } = useStudioApp();
  const [sourceId, setSourceId] = useState<string>();
  const [position, setPosition] = useState<StudioFramePosition>('first');
  const [time, setTime] = useState(0);
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  const pendingRef = useRef(pending); pendingRef.current = pending;
  const source = nodes.find(n => n.id === sourceId);
  useEffect(() => {
    const listener = (event: Event) => {
      const { action, nodeId } = (event as CustomEvent<{ action: string; nodeId?: string }>).detail;
      // Following the assistant's work or focusing a node is not leaving the panel.
      if (action === 'reveal' || action === 'focus') return;
      if (action !== 'video-frames') { setSourceId(undefined); return; }
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (!node || node.type !== CanvasNodeType.Video || !node.metadata?.storageKey) { setSourceId(undefined); return; }
      if (busy(node)) { message.info('视频正在生成，完成后再抽帧'); return; }
      setPosition('first'); setSourceId(node.id);
    };
    window.addEventListener('studio-command', listener); return () => window.removeEventListener('studio-command', listener);
  }, [message]);
  // The node's action bar sits where this panel opens; the workspace hides it while the panel is up.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('studio-video-frames', { detail: { nodeId: sourceId } }));
  }, [sourceId]);
  useEffect(() => () => { window.dispatchEvent(new CustomEvent('studio-video-frames', { detail: { nodeId: undefined } })); }, []);
  // 「截当前帧」 follows the playhead of the clip on the canvas while the panel is open.
  useEffect(() => {
    if (!sourceId) return;
    const video = canvasVideo(sourceId), read = () => setTime(video?.currentTime || 0);
    read();
    if (!video) return;
    video.addEventListener('timeupdate', read); video.addEventListener('seeked', read);
    return () => { video.removeEventListener('timeupdate', read); video.removeEventListener('seeked', read); };
  }, [sourceId]);
  // The node went away or started generating: nothing to capture from.
  useEffect(() => { if (sourceId && (!source || busy(source))) setSourceId(undefined); }, [sourceId, source]);
  const close = () => setSourceId(undefined);
  const submit = () => {
    if (!source?.metadata?.storageKey || demo) return;
    const storageKey = source.metadata.storageKey, at = position === 'current' ? canvasVideo(source.id)?.currentTime || 0 : 0;
    const size = studioVideoSize(source), width = source.width;
    const placeholder = placeStudioNode({ id: nanoid(), type: CanvasNodeType.Image, title: `${source.title} · ${framePositionLabel(position, at)}`,
      position: { x: source.position.x + source.width + 80, y: source.position.y }, width,
      height: shapeHeight(width, size?.width, size?.height) ?? source.height, metadata: {} }, [...nodesRef.current, ...pendingRef.current.map(p => p.node)]);
    const entry: StudioPendingFrame = { node: placeholder, connection: { id: nanoid(), fromNodeId: source.id, toNodeId: placeholder.id } };
    onPendingChange(list => [...list, entry]); close();
    const drop = () => onPendingChange(list => list.filter(p => p !== entry));
    void (async () => {
      let clip: Blob;
      try { clip = await fetchAssetBlob(storageKey); }
      catch { drop(); message.error(new Error('无法读取这条视频，请重试')); return; }
      let frame: Blob;
      try { frame = await captureStudioVideoFrame(clip, position, at); }
      catch (e) { drop(); message.error(e instanceof StudioFrameError ? e : new Error('没能截出画面，请重试')); return; }
      try {
        const image = await uploadImage(frame);
        const node: CanvasNodeData = { ...placeholder, height: shapeHeight(width, image.width, image.height) ?? placeholder.height,
          metadata: { ...imageMetadata(image), origin: 'derived' } };
        drop(); await onInsert([node], [entry.connection]);
      } catch (e) { drop(); message.error(e); }
    })();
  };
  return <StudioFloatingPanel title="抽帧" open={!!source} anchorId={sourceId} width={400} onClose={close} className="studio-video-frames"
    footer={<div className="studio-video-frames-footer"><span>免费，不消耗积分</span><Button onClick={close}>取消</Button><Button type="primary" disabled={demo} onClick={submit}>提交</Button></div>}>
    <div className="studio-director-form">
      <p>截取一帧画面，生成一张连着这条视频的图片。</p>
      <div className="studio-video-frames-choice"><span id="studio-video-frames-label">帧选择</span>
        <Radio.Group aria-labelledby="studio-video-frames-label" optionType="button" value={position} onChange={e => setPosition(e.target.value)} options={[
          { value: 'first', label: '截首帧' }, { value: 'last', label: '截尾帧' }, { value: 'current', label: `截当前帧 ${formatFrameTime(time)}` },
        ]}/></div>
      {position === 'current' && <p>当前帧是画布上这条视频播放到的位置，可以先拖动进度条再提交。</p>}
      {demo && <p role="status">演示模式不能抽帧，连上服务后可用。</p>}
    </div>
  </StudioFloatingPanel>;
}
