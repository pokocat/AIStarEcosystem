'use client';

import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, useReactFlow, useViewport, useNodesInitialized } from '@xyflow/react';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import type { IpProjectDoc } from '@ai-star-eco/types';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { flowNodes, flowEdges } from '@/canvas-bridge/flow-document';
import { StudioFlowCard } from './studio-flow-canvas';
import { StudioFloatingContext, StudioFloatingPanel } from './studio-floating-panel';

const nodeTypes = { studio: StudioFlowCard };
function Preview({ doc }: { doc: IpProjectDoc }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [inspecting, setInspecting] = useState<CanvasNodeData>();
  const viewport = useViewport(), flow = useReactFlow();
  const initialized = useNodesInitialized();
  useEffect(() => {
    if (!initialized) return;
    // The fullscreen container must be measured before fitting its published graph.
    const frame = requestAnimationFrame(() => void flow.fitView({ padding: .2, maxZoom: 1 }));
    return () => cancelAnimationFrame(frame);
  }, [initialized, flow]);
  const nodes = useMemo(() => flowNodes(doc.nodes as CanvasNodeData[], new Set(inspecting ? [inspecting.id] : []))
    .map(n => ({ ...n, data: { ...n.data, readOnly: true, onInspect: setInspecting } })), [doc, inspecting]);
  const edges = useMemo(() => flowEdges(doc.connections), [doc]);
  return <StudioFloatingContext.Provider value={viewport}>
    <div ref={setRoot} className="studio-flow-shell studio-template-preview-canvas" aria-label="只读模板画布">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false}
        edgesReconnectable={false} deleteKeyCode={null} selectionKeyCode={null} multiSelectionKeyCode={null}
        onNodeClick={(_, node) => setInspecting(node.data.document)} onNodeDoubleClick={(_, node) => setInspecting(node.data.document)}
        onPaneClick={() => setInspecting(undefined)} onPaneContextMenu={e => e.preventDefault()}
        fitView fitViewOptions={{ padding: .2, maxZoom: 1 }} minZoom={.15} maxZoom={2.5}>
        <Background variant={BackgroundVariant.Dots} color="#c9cbd4" gap={24} size={1}/>
      </ReactFlow>
      <nav className="studio-flow-controls" aria-label="模板查看工具">
        <button type="button" aria-label="缩小" onClick={() => void flow.zoomOut()}><ZoomOut size={18}/></button>
        <span>{Math.round(viewport.zoom * 100)}%</span>
        <button type="button" aria-label="放大" onClick={() => void flow.zoomIn()}><ZoomIn size={18}/></button>
        <hr/><button type="button" aria-label="适应全部节点" onClick={() => void flow.fitView({ padding: .2, maxZoom: 1 })}><Maximize size={18}/></button>
      </nav>
      <StudioFloatingPanel open={!!inspecting} container={root} anchorId={inspecting?.id} title="节点设置 · 只读" width={420}
        onClose={() => setInspecting(undefined)} footer={<span>存为个人副本后，可替换素材、编辑和生成。</span>}>
        <strong>{inspecting?.title}</strong>
        <p className="studio-template-preview-prompt">{inspecting?.metadata?.prompt || inspecting?.metadata?.content || '此节点等待填写内容或添加参考素材。'}</p>
        {inspecting?.metadata?.size && <p>画幅 / 尺寸：{inspecting.metadata.size}{inspecting.metadata.seconds ? ` · ${inspecting.metadata.seconds} 秒` : ''}</p>}
      </StudioFloatingPanel>
    </div>
  </StudioFloatingContext.Provider>;
}
export default function StudioTemplatePreview({ doc }: { doc: IpProjectDoc }) {
  return <ReactFlowProvider><Preview doc={doc}/></ReactFlowProvider>;
}
