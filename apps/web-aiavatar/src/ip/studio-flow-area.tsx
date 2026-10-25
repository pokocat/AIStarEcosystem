'use client';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { NodeResizer, useViewport } from '@xyflow/react';
import { Popover } from 'antd';
import { Check } from 'lucide-react';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { STUDIO_AREA_TONES, studioAreaTone } from '@/canvas-bridge/studio-areas';
import { StudioNodeTitle } from './studio-node-title';
import { StudioGroupDescription } from './studio-group-description';
import { studioOverlayContainer } from './studio-overlay';

export type StudioFlowAreaData = {
  readOnly?: boolean;
  memberCount?: number;
  /** 刚圈出来：名字输入框直接打开，边框从虚线落成实线。 */
  naming?: boolean;
  justDrawn?: boolean;
  /** 正在拖的节点松手会落进这块区域。 */
  dropTarget?: boolean;
  onRename?: (id: string, title: string) => void;
  onNamingEnd?: () => void;
  onDescribeGroup?: (id: string, description: string) => void;
  onToneGroup?: (id: string, tone: string) => void;
};

/**
 * 分组 = 画布上的一块区域。区域本身不挡操作：框里空白的地方照样能平移、框选（`pointer-events:none`），
 * 只有上沿外侧的名字标签能点、能拖（拖它就是拖整块区域）、能改名。标签按缩放反向放大，缩得再小也读得清。
 */
export function StudioFlowArea({ node, selected, data, port }: { node: CanvasNodeData; selected: boolean; data: StudioFlowAreaData; port: ReactNode }) {
  const { zoom } = useViewport();
  const [palette, setPalette] = useState(false);
  const tone = studioAreaTone(node.metadata?.groupTone);
  const scale = Math.min(4, Math.max(.6, 1 / zoom));
  const count = data.memberCount || 0, editable = !data.readOnly;
  const cls = ['studio-flow-group', selected && 'is-selected', data.dropTarget && 'is-drop-target', data.justDrawn && 'is-just-drawn', !count && 'is-empty'].filter(Boolean).join(' ');
  return <article className={cls} style={{ '--studio-area-tone': tone.color } as CSSProperties} aria-label={`${node.title} · 分组`}>
    {editable && <NodeResizer isVisible={selected} minWidth={120} minHeight={80} lineClassName="studio-flow-area-edge" handleClassName="studio-flow-area-handle"
      onResizeStart={() => window.dispatchEvent(new Event('studio-canvas-checkpoint'))}/>}
    <header className="studio-flow-area-label" style={{ transform: `scale(${scale})`, maxWidth: node.width / scale }}>
      <div className="studio-flow-area-chip">
        {editable && data.onToneGroup ? <Popover open={palette} onOpenChange={setPalette} trigger="click" placement="bottomLeft" arrow={false} getPopupContainer={studioOverlayContainer}
          classNames={{ root: 'studio-flow-area-palette' }} content={<div role="group" aria-label="分组颜色">
            {STUDIO_AREA_TONES.map(t => <button key={t.key} type="button" aria-label={t.label} title={t.label} aria-pressed={t.key === tone.key} style={{ '--studio-area-tone': t.color } as CSSProperties}
              onClick={() => { data.onToneGroup!(node.id, t.key); setPalette(false); }}>{t.key === tone.key && <Check size={12} strokeWidth={3}/>}</button>)}
          </div>}>
          <button type="button" className="studio-flow-area-tone nodrag nopan" aria-label={`分组颜色：${tone.label}`} title="分组颜色" onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}/>
        </Popover> : <span className="studio-flow-area-tone" aria-hidden/>}
        <StudioNodeTitle title={node.title} label="分组名称" autoEdit={data.naming} onEditEnd={data.onNamingEnd}
          onRename={editable && data.onRename ? value => data.onRename!(node.id, value) : undefined}/>
        {count > 0 && <span className="studio-flow-area-count" title={`区域里有 ${count} 个节点`} aria-label={`${count} 个节点`}>{count}</span>}
      </div>
    </header>
    {port}
    <StudioGroupDescription title={node.title} description={node.metadata?.groupDescription} onChange={editable && data.onDescribeGroup ? value => data.onDescribeGroup!(node.id, value) : undefined}/>
    {editable && !count && !node.metadata?.groupDescription && <p className="studio-flow-area-empty" aria-hidden>把节点拖进来</p>}
  </article>;
}
