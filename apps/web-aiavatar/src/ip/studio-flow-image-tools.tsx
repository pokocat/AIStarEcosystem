'use client';
import { useEffect, useState } from 'react';
import { App, Modal, Spin } from 'antd';
import { nanoid } from 'nanoid';
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from '@/canvas/types/canvas';
import { CanvasNodeCropDialog, type CanvasImageCropRect } from '@/canvas/components/canvas/canvas-node-crop-dialog';
import { CanvasNodeMaskEditDialog, type CanvasImageMaskEditPayload } from '@/canvas/components/canvas/canvas-node-mask-edit-dialog';
import { CanvasNodeSplitDialog, type CanvasImageSplitParams } from '@/canvas/components/canvas/canvas-node-split-dialog';
import { cropDataUrl, splitDataUrl } from '@/canvas/lib/canvas/canvas-image-data';
import { imageMetadata } from '@/canvas/lib/canvas/canvas-node-factory';
import { uploadImage } from '@/canvas-bridge/image-storage';
import { fetchAssetBlob } from '@/canvas-bridge/api';
import { dispatchStudioCommand } from '@/canvas-bridge/studio-nodes';

type Edit = { operation: 'crop' | 'mask' | 'split-image'; source: CanvasNodeData; url?: string };
export function StudioFlowImageTools({ nodes, onInsert }: { nodes: CanvasNodeData[]; onInsert: (nodes: CanvasNodeData[], connections: CanvasConnection[]) => Promise<void> }) {
  const [edit, setEdit] = useState<Edit>(), [busy, setBusy] = useState(false);
  const { message } = App.useApp();
  useEffect(() => {
    const listener = (event: Event) => {
      const { action, nodeId } = (event as CustomEvent<{ action: string; nodeId?: string }>).detail;
      const source = nodes.find(n => n.id === nodeId);
      if (busy) return;
      if (['crop', 'mask', 'split-image'].includes(action) && source?.type === CanvasNodeType.Image && source.metadata?.storageKey)
        setEdit({ operation: action as Edit['operation'], source });
      else setEdit(undefined);
    };
    window.addEventListener('studio-command', listener); return () => window.removeEventListener('studio-command', listener);
  }, [nodes, busy]);
  useEffect(() => {
    if (!edit || edit.url) return;
    let active = true, objectUrl: string | undefined;
    // Read the owned asset through the backend; temporary URLs cannot taint the crop/mask canvas.
    void fetchAssetBlob(edit.source.metadata!.storageKey!).then(blob => {
      if (!active) return; objectUrl = URL.createObjectURL(blob);
      setEdit(current => current && current.source.id === edit.source.id && current.operation === edit.operation ? { ...current, url: objectUrl } : current);
    }).catch(e => { if (active) { message.error(e.message); setEdit(undefined); } });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [edit?.source.id, edit?.operation, message]);
  const run = async (operation: () => Promise<void>) => {
    if (busy) return; setBusy(true);
    try { await operation(); setEdit(undefined); } catch (e) { message.error(e instanceof Error ? e.message : '图片编辑失败，请重试'); }
    finally { setBusy(false); }
  };
  const imageNode = async (url: string, title: string, x: number, y: number, width: number): Promise<CanvasNodeData> => {
    const image = await uploadImage(url);
    return { id: nanoid(), type: CanvasNodeType.Image, title, position: { x, y }, width,
      height: Math.max(140, width * image.height / Math.max(1, image.width) + 36), metadata: { ...imageMetadata(image), prompt: edit?.source.metadata?.prompt } };
  };
  const crop = (rect: CanvasImageCropRect) => void run(async () => {
    const { source, url } = edit!;
    const child = await imageNode(await cropDataUrl(url!, rect), `${source.title} · 裁剪`, source.position.x + source.width + 80, source.position.y, Math.min(360, source.width));
    await onInsert([child], [{ id: nanoid(), fromNodeId: source.id, toNodeId: child.id }]);
  });
  const split = (params: CanvasImageSplitParams) => void run(async () => {
    const { source, url } = edit!, width = Math.max(220, Math.min(360, source.width / params.columns));
    const pieces = await splitDataUrl(url!, params);
    const children: CanvasNodeData[] = []; let rowY = source.position.y, rowHeight = 0;
    for (const piece of pieces) {
      if (piece.column === 0 && children.length) { rowY += rowHeight + 40; rowHeight = 0; }
      const node = await imageNode(piece.dataUrl, `${source.title} · ${piece.row + 1}-${piece.column + 1}`, source.position.x + source.width + 80 + piece.column * (width + 40), rowY, width);
      rowHeight = Math.max(rowHeight, node.height); children.push(node);
    }
    await onInsert(children, children.map(n => ({ id: nanoid(), fromNodeId: source.id, toNodeId: n.id })));
  });
  const mask = (payload: CanvasImageMaskEditPayload) => void run(async () => {
    const { source } = edit!;
    const overlay = await imageNode(payload.maskDataUrl, `${source.title} · 编辑区域`, source.position.x, source.position.y + source.height + 80, source.width);
    const child: CanvasNodeData = { id: nanoid(), type: CanvasNodeType.Image, title: `${source.title} · 局部修改`, position: { x: source.position.x + source.width + 80, y: source.position.y }, width: source.width, height: source.height,
      metadata: { status: 'idle', prompt: `参考图1是原始图片，参考图2标明需要修改的区域。只修改标记区域，保留其他内容、人物身份及构图。修改要求：${payload.prompt}` } };
    await onInsert([overlay, child], [source.id, overlay.id].map(id => ({ id: nanoid(), fromNodeId: id, toNodeId: child.id })));
    if (payload.generate) requestAnimationFrame(() => dispatchStudioCommand('image', child.id));
  });
  const close = () => { if (!busy) setEdit(undefined); };
  return <>
    {edit && !edit.url && <Modal open title="正在读取图片" footer={null} onCancel={close}><Spin aria-label="正在读取图片"/></Modal>}
    {edit?.url && edit.operation === 'crop' && <CanvasNodeCropDialog dataUrl={edit.url} open onClose={close} onConfirm={crop}/>}
    {edit?.url && edit.operation === 'mask' && <CanvasNodeMaskEditDialog dataUrl={edit.url} open onClose={close} onConfirm={mask} generationLabel="下一步：确认生成"/>}
    {edit?.url && edit.operation === 'split-image' && <CanvasNodeSplitDialog dataUrl={edit.url} open onClose={close} onConfirm={split}/>}
    {busy && <div className="studio-flow-edit-progress" role="status"><Spin size="small"/>正在保存编辑结果…</div>}
  </>;
}
