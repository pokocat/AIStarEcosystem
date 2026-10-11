"use client";

import { useMemo, useState, type ReactNode } from 'react';
import { Input } from 'antd';
import type { StudioShot } from '@ai-star-eco/types/ip-studio-workflow';
import { ArrowLeft, FileText, ImagePlus, LocateFixed, Maximize2, Minimize2, Music2, Play, Plus, Shapes, X } from 'lucide-react';
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from '@/canvas/types/canvas';
import { studioStoryboardGroups, studioStoryboardLinks, studioStoryboardStatus } from '@/canvas-bridge/studio-storyboard';
import { SignedImage } from '@/canvas-bridge/signed-image';
import { SignedVideo } from '@/canvas-bridge/signed-video';
import { SignedAudio } from '@/canvas-bridge/signed-audio';
import { studioGenerationPending } from '@/canvas-bridge/studio-nodes';
import { scriptToMarkdown } from '@/canvas-bridge/studio-script-markdown';
import { StudioScriptRichEditor } from './studio-script-rich-editor';
import { studioTaskLabel } from '@/canvas-bridge/studio-task-status';

type Props = {
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
  selectedNodeId?: string;
  changing?: boolean;
  composer?: ReactNode;
  onCloseDetail?: () => void;
  onEditNode?: (node: CanvasNodeData) => void;
  onAcceptText?: (node: CanvasNodeData) => void;
  onOpenNode: (node: CanvasNodeData) => void;
  onFocusNode: (id: string) => void;
  onCreateScript: () => void;
  onSplitScript: (node: CanvasNodeData) => void;
  onBatch: () => void;
  onShotChange: (id: string, changes: Partial<StudioShot>) => void;
  modelName: (node: CanvasNodeData) => string | undefined;
};
const icons = { text: FileText, image: ImagePlus, video: Play, audio: Music2, other: Shapes };

/** A projection of the original document: selecting a node never creates a copy or runs it. */
export function StudioStoryboard({ nodes, connections, selectedNodeId, changing, composer, onCloseDetail, onEditNode, onAcceptText, onOpenNode, onFocusNode, onCreateScript, onSplitScript, onBatch, onShotChange, modelName }: Props) {
  const groups = useMemo(() => studioStoryboardGroups(nodes), [nodes]);
  const [expanded, setExpanded] = useState<string>();
  const selected = nodes.find(n => n.id === selectedNodeId);
  const selectedGroup = selected && groups.find(g => g.nodes.includes(selected));
  const visibleGroups = selectedGroup ? [selectedGroup] : groups.filter(g => !expanded || !groups.some(g => g.type === expanded) || g.type === expanded);
  const back = () => { setExpanded(undefined); onCloseDetail?.(); };
  const preview = (node: CanvasNodeData, detail = false) => {
    const metadata = node.metadata, Icon = icons[(groups.find(g => g.nodes.includes(node))?.type || 'other') as keyof typeof icons];
    const ready = !!(metadata?.content && metadata.storageKey);
    if(node.type === CanvasNodeType.Text) {
      const script = metadata?.studio?.script;
      return script ? <div className="studio-storyboard-document"><StudioScriptRichEditor markdown={metadata.studio?.scriptMarkdown ?? scriptToMarkdown(script)} readOnly toolbarHidden ariaLabel="剧本预览"/></div>
        : <div className="studio-storyboard-text-content">{metadata?.content || <div className="studio-storyboard-placeholder"><FileText size={32}/><span>{studioStoryboardStatus(node)}</span></div>}</div>;
    }
    return <div className={`studio-storyboard-preview${ready ? ' has-media' : ''}${detail ? ' is-detail' : ''}`}>
      {ready && node.type === CanvasNodeType.Image ? <button type="button" aria-label={`编辑图片 ${node.title}`} disabled={changing} onClick={() => onOpenNode(node)}><SignedImage src={metadata.content} storageKey={metadata.storageKey} alt={node.title}/></button>
        : ready && node.type === CanvasNodeType.Video ? <SignedVideo src={metadata.content} storageKey={metadata.storageKey} controls preload="metadata"/>
        : ready && node.type === CanvasNodeType.Audio ? <SignedAudio src={metadata.content} storageKey={metadata.storageKey} controls preload="metadata"/>
        : <button type="button" aria-label={`继续创作 ${node.title}`} disabled={changing} onClick={() => onOpenNode(node)}><Icon size={32}/><span role="status">{studioStoryboardStatus(node)}</span></button>}
    </div>;
  };
  const references = (node: CanvasNodeData) => {
    const incoming = studioStoryboardLinks(node.id, nodes, connections).incoming;
    return !!incoming.length && <div className="studio-storyboard-reference-thumbs" aria-label={`${node.title} 引用素材`}>{incoming.map(ref =>
      <button type="button" key={ref.id} aria-label={`查看引用 ${ref.title}`} title={ref.title} disabled={changing} onClick={() => onOpenNode(ref)}>
        {ref.type === CanvasNodeType.Image && ref.metadata?.content && ref.metadata.storageKey ? <SignedImage src={ref.metadata.content} storageKey={ref.metadata.storageKey} alt={ref.title}/>
          : ref.type === CanvasNodeType.Text ? <FileText size={19}/> : ref.type === CanvasNodeType.Audio ? <Music2 size={19}/> : <Play size={19}/>}
      </button>)}</div>;
  };
  const meta = (node: CanvasNodeData) => {
    const metadata = node.metadata, model = modelName(node);
    return <div className="studio-storyboard-node-meta">{model && <span>{model}</span>}{metadata?.size && <span>{metadata.size}</span>}{metadata?.seconds && <span>{metadata.seconds} 秒</span>}
      {(metadata?.status === 'loading' || metadata?.status === 'error') && metadata.content && <span role="status">{studioStoryboardStatus(node)}</span>}</div>;
  };
  return <div className="studio-storyboard">
    {!selected && <div className="studio-storyboard-intro"><p>查看画布中的全部节点，点击继续创作。</p><div>
      {nodes.some(n => n.type === CanvasNodeType.Image && n.metadata?.studio?.shot) && <button type="button" onClick={onBatch}>连续制作镜头</button>}
      <button type="button" onClick={onCreateScript}><Plus size={16}/>新建剧本</button></div></div>}
    <div className={selected ? 'studio-storyboard-detail-layout' : 'studio-storyboard-columns'} data-expanded={visibleGroups.length === 1}>
      {visibleGroups.map(group => {
        const Icon = icons[group.type as keyof typeof icons];
        return <section key={group.type} className="studio-storyboard-column" aria-label={`${group.label}节点列表`}>
          <header>{selected ? <select aria-label="节点类型" value={group.type} disabled={changing} onChange={e => {
            const next = groups.find(g => g.type === e.target.value);
            if(next?.nodes.length)onOpenNode(next.nodes[0]);else { setExpanded(next?.type); onCloseDetail?.(); }
          }}>{groups.map(g => <option key={g.type} value={g.type}>{g.label} · {g.nodes.length}</option>)}</select> : <h3>{group.label}<span>{group.nodes.length}</span></h3>}
            {!selected && <button type="button" aria-label={expanded === group.type ? '恢复全部节点类型' : `展开${group.label}列表`} onClick={() => setExpanded(expanded === group.type ? undefined : group.type)}>{expanded === group.type ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button>}</header>
          <div className="studio-storyboard-column-body">
            {!group.nodes.length && <p className="studio-storyboard-empty">暂无{group.label}节点</p>}
            {group.nodes.map(node => <article className={`studio-storyboard-node${group.type === 'text' ? ' is-text-row' : ''}${selectedNodeId === node.id ? ' is-selected' : ''}`} key={node.id} aria-label={`故事板节点 ${node.title}`}>
              <div className="studio-storyboard-node-heading"><button type="button" aria-label={`打开节点 ${node.title}`} aria-current={selectedNodeId === node.id ? true : undefined} disabled={changing} onClick={() => onOpenNode(node)}>{group.type === 'text' && <span className="studio-storyboard-text-icon"><Icon size={17}/></span>}<span>{node.title}</span></button></div>
              {group.type === 'text' && node.metadata?.status === 'loading' && <span className="studio-storyboard-text-status" role="status">{studioStoryboardStatus(node)}</span>}
              {group.type !== 'text' && <>{preview(node)}{meta(node)}{references(node)}
                {node.metadata?.status === 'error' && node.metadata.errorDetails && <p className="studio-storyboard-error" role="alert">{node.metadata.errorDetails}</p>}</>}
            </article>)}
          </div>
        </section>;
      })}
      {selected && <section className="studio-storyboard-detail" aria-label={`节点详情 ${selected.title}`}>
        <header><button type="button" aria-label="返回全部节点" disabled={changing} onClick={back}><ArrowLeft size={18}/></button><h3>{selected.title}</h3><div>
          {selected.type === CanvasNodeType.Text && <button type="button" aria-label={`展开编辑 ${selected.title}`} disabled={changing || studioGenerationPending(selected)} onClick={() => onEditNode?.(selected)}><Maximize2 size={18}/></button>}
          <button type="button" aria-label={`定位节点 ${selected.title}`} disabled={changing} onClick={() => onFocusNode(selected.id)}><LocateFixed size={18}/></button>
          <button type="button" aria-label="关闭节点详情" disabled={changing} onClick={back}><X size={19}/></button></div></header>
        <div className="studio-storyboard-detail-body" aria-busy={selected.metadata?.status==='loading'}>
          {selected.type===CanvasNodeType.Text&&selected.metadata?.status==='loading'&&<p className="studio-storyboard-task-status" role="status">{studioTaskLabel(selected.metadata.studio?.task)}</p>}
          {preview(selected, true)}
          {selected.metadata?.studio?.textEditor?.proposal&&<details className="studio-storyboard-text-proposal" open><summary>正文已被修改，AI 结果尚未覆盖原文</summary>
            <div>{selected.metadata.studio.textEditor.proposal.content}</div><button type="button" disabled={changing} onClick={()=>onAcceptText?.(selected)}>采用 AI 修改</button></details>}
          {selected.metadata?.status === 'error' && selected.metadata.errorDetails && <p className="studio-storyboard-error" role="alert">{selected.metadata.errorDetails}</p>}
          {selected.metadata?.studio?.upstreamChanged && <p className="studio-storyboard-note">引用内容已修改，已有产物保留。</p>}
          {selected.metadata?.studio?.shot && <details className="studio-storyboard-shot"><summary>镜头信息</summary>
            <label>画面描述<Input.TextArea aria-label={`${selected.title} 画面描述`} value={selected.metadata.studio.shot.description} autoSize={{ minRows: 2, maxRows: 6 }} onChange={e => onShotChange(selected.id, { description: e.target.value })}/></label>
            <label>台词<Input aria-label={`${selected.title} 台词`} value={selected.metadata.studio.shot.dialogue} onChange={e => onShotChange(selected.id, { dialogue: e.target.value })}/></label>
            <label>时长（秒）<Input type="number" min={1} max={300} aria-label={`${selected.title} 时长`} value={selected.metadata.studio.shot.durationSec} onChange={e => { const durationSec = Number(e.target.value); if (Number.isInteger(durationSec) && durationSec >= 1 && durationSec <= 300) onShotChange(selected.id, { durationSec }); }}/></label>
          </details>}
          {selected.metadata?.studio?.script && <button type="button" className="studio-storyboard-split" disabled={changing || studioGenerationPending(selected)} onClick={() => onSplitScript(selected)}>拆分镜头</button>}
        </div>
        {composer && <div className="studio-storyboard-composer-slot">{composer}</div>}
      </section>}
    </div>
  </div>;
}
