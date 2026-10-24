'use client';
import { useStudioApp, StudioErrorNotice, studioNodeError } from './studio-errors';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction, type SyntheticEvent } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Handle, Position, NodeResizer, MiniMap, SelectionMode,
  BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, useViewport, type EdgeProps, type OnConnectEnd, type NodeProps, type NodeChange, type EdgeChange } from '@xyflow/react';
import { App, Button, Dropdown, Input, Modal, type GetRef } from 'antd';
import { AlertCircle, AlignLeft, ArrowLeft, Copy, FileText, Group, Hand, ImagePlus, LayoutGrid, Maximize, Minus, MousePointer2, Music2, Plus, RotateCcw, Scissors, Search, ShoppingBag, Trash2, Upload, Video, X } from 'lucide-react';
import { AiMark } from './studio-ai-icon';
import { nanoid } from 'nanoid';
import { useIdentity } from '@/proto/api';
import { WalletBadge } from '@/shell/wallet-badge';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from '@/canvas/types/canvas';
import { HostActionsSlot } from '@/canvas-bridge/host-actions';
import { flowNodes, flowEdges, changeFlowNodes, changeFlowEdges, copyFlowSelection, arrangeFlowNodes, placeStudioNode, type StudioFlowNode } from '@/canvas-bridge/flow-document';
import { applyGroupSelection, applyUngroupSelection, canGroupSelectedNodes, canUngroupSelectedNodes, collectGroupMemberNodes, getGroupWrapRect } from '@/canvas/lib/canvas/canvas-node-geometry';
import { SignedImage } from '@/canvas-bridge/signed-image';
import { SignedVideo } from '@/canvas-bridge/signed-video';
import { SignedAudio } from '@/canvas-bridge/signed-audio';
import { studioNodeCommand } from './studio-node-command';
import { makeStudioNode, dispatchStudioCommand, studioGenerationPending } from '@/canvas-bridge/studio-nodes';
import { useTemplateProjection } from '@/canvas-bridge/template-projection';
import { useFlowLegacyTasks } from '@/canvas-bridge/flow-legacy-tasks';
import { saveStudioDocument } from '@/canvas-bridge/studio-save';
import { attachmentNode, readAssistantAttachment, savedAssetPayload } from '@/canvas-bridge/studio-attachments';
import { importStudioMedia, importStudioStory } from '@/canvas-bridge/studio-api';
import { studioAiMade, studioUploadedByUser } from '@/canvas-bridge/studio-node-origin';
import { fitStudioNodeToMedia, fitStudioVideoToResize, studioVideoFitted, studioVideoSize } from '@/canvas-bridge/studio-media-fit';
import { studioFailedWithoutMedia, studioFailureReason } from '@/canvas-bridge/studio-node-failure';
import { StudioAttachmentPicker, type AttachmentPickerActions } from './studio-attachment-picker';
import { StudioNodeContent } from './studio-node-content';
import { StudioFloatingContext, StudioFloatingPanel } from './studio-floating-panel';
import { StudioWorkspace } from './studio-workspace';
import { StudioDocumentEditor } from './studio-document-editor';
import { StudioFlowImageTools } from './studio-flow-image-tools';
import { StudioFlowVideoFrames, type StudioPendingFrame } from './studio-flow-video-frames';
import { studioTaskNeedsReview, studioTaskLabel, studioTaskQueued, studioQueueNotice } from '@/canvas-bridge/studio-task-status';
import { createStudioLinkedNode } from '@/canvas-bridge/studio-linked-inputs';
import { StudioConnectionCreateMenu, type PendingStudioConnection } from './studio-connection-create-menu';
import { replaceStudioImage, STUDIO_IMAGE_UPLOAD_ACCEPT, validateStudioImageUpload } from '@/canvas-bridge/studio-image-upload';
import { placeNodeInViewport } from '@/canvas-bridge/viewport-placement';
import { StudioNodeTitle } from './studio-node-title';
import { replaceStudioVideo, STUDIO_VIDEO_UPLOAD_ACCEPT, validateStudioVideoUpload } from '@/canvas-bridge/studio-video-upload';
import { StudioMediaGenerationState } from './studio-media-generation-state';
import { StudioGroupDescription } from './studio-group-description';
import { describeStudioGroup } from '@/canvas-bridge/studio-group-description';

const icons = { image: ImagePlus, video: Video, audio: Music2, text: FileText };
export function StudioFlowCard({ data, selected }: NodeProps<StudioFlowNode>) {
  const node = data.document, meta = node.metadata, Icon = icons[node.type as keyof typeof icons] || FileText;
  const { zoom } = useViewport();
  // Scale the visual/hit area, not the measured Handle: React Flow's edge anchor must remain stable.
  const port = (type: 'source' | 'target') => <Handle type={type} position={type === 'source' ? Position.Right : Position.Left} isConnectable={!data.readOnly}
    className={data.readOnly ? undefined : 'studio-flow-port'} style={data.readOnly ? undefined : { '--studio-port-scale': Math.max(1, 1 / zoom) } as CSSProperties}
    title={type === 'source' ? '拖出连线引用此节点' : '连接参考节点'} aria-label={type === 'source' ? '拖出连线引用此节点' : '连接参考节点'}>
    {!data.readOnly && <span className="studio-flow-port-icon" aria-hidden><Plus size={16}/></span>}
  </Handle>;
  const title = <StudioNodeTitle title={node.title} onRename={!data.readOnly && data.onRename ? value => data.onRename!(node.id, value) : undefined}/>;
  if (node.type === CanvasNodeType.Group) return <article className={`studio-flow-group${selected ? ' is-selected' : ''}`} aria-label={`${node.title} · 分组`}>
    {!data.readOnly&&<NodeResizer isVisible={selected} minWidth={220} minHeight={140} onResizeStart={() => window.dispatchEvent(new Event('studio-canvas-checkpoint'))}/>}
    <header className="studio-flow-drag"><Group size={15}/>{title}</header>{port('source')}
    <StudioGroupDescription title={node.title} description={meta?.groupDescription} onChange={!data.readOnly && data.onDescribeGroup ? value => data.onDescribeGroup!(node.id, value) : undefined}/>
  </article>;
  // Template input constraints do not turn a plain text node into a script summary.
  const studioText = node.type === CanvasNodeType.Config || node.type === CanvasNodeType.Text && !!meta?.studio && !meta.studio.templateInput;
  const imageLocked = data.uploading || studioGenerationPending(node);
  const mediaGenerating = (node.type===CanvasNodeType.Image||node.type===CanvasNodeType.Video) && meta?.status === 'loading';
  // AI 做的 / 正在做的节点带记号；没有记号 = 用户自己放的。
  const aiMade = studioAiMade(node);
  const generating = meta?.status === 'loading' && !data.uploading;
  // 设计稿 · Language 画板：媒体是你自己传上来的就标「你上传的」；从素材库、人物库引用的，裁剪出来的，空白占位和文字都不标。
  const uploaded = studioUploadedByUser(node);
  const failed = studioFailedWithoutMedia(node);
  const uploadImage = () => dispatchStudioCommand('upload-image', node.id);
  const uploadVideo = () => dispatchStudioCommand('upload-video', node.id);
  const edit = () => { if(data.readOnly){data.onInspect?.(node);return;} const action=studioNodeCommand(node,true); if(action)dispatchStudioCommand(action,node.id); };
  // The real size of what is shown: the node records it and a result that just landed takes its shape (§6.2).
  const sized = (width: number, height: number) => { if (!data.readOnly && width > 0 && height > 0) data.onMediaSize?.(node.id, { width, height, storageKey: meta?.storageKey }); };
  const imageLoaded = (event: SyntheticEvent<HTMLImageElement>) => sized(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
  const videoLoaded = (event: SyntheticEvent<HTMLVideoElement>) => sized(event.currentTarget.videoWidth, event.currentTarget.videoHeight);
  // 视频节点铺满：a video whose real size is known keeps that shape while being resized (exact at the end, same undo step)
  // and is drawn edge to edge once the box is in shape.
  const videoShaped = node.type === CanvasNodeType.Video && !!studioVideoSize(node);
  const videoFitted = videoShaped && studioVideoFitted(node);
  if (data.processing) return <article className="studio-flow-card is-processing" aria-label={`${node.title} · 处理中`} aria-busy="true">
    {port('target')}
    <header className="studio-flow-drag"><Icon size={15}/><StudioNodeTitle title={node.title}/></header>
    <div className="studio-flow-media"><div className="studio-flow-placeholder" role="status"><span className="studio-flow-processing-spin" aria-hidden/><span>处理中</span></div></div>
  </article>;
  return <article className={`studio-flow-card${node.type === CanvasNodeType.Video ? ' studio-flow-video-card' : ''}${videoFitted ? ' is-fitted' : ''}${selected ? ' is-selected' : ''}${aiMade ? ' is-ai' : ''}${generating ? ' is-generating' : ''}${data.fresh ? ' is-fresh' : ''}`} aria-label={`${node.title} · ${node.type}`}>
    {!data.readOnly&&<NodeResizer isVisible={selected} minWidth={220} minHeight={140} keepAspectRatio={videoShaped} onResizeStart={() => window.dispatchEvent(new Event('studio-canvas-checkpoint'))} onResizeEnd={videoShaped ? () => data.onVideoResized?.(node.id) : undefined}/>}
    {port('target')}{port('source')}
    <header className="studio-flow-drag"><Icon size={15}/>{title}{aiMade ? <span className="studio-flow-ai-badge" title={generating ? 'AI 正在生成' : 'AI 生成的'}><AiMark size={10}/>{generating ? studioTaskNeedsReview(meta?.studio?.task) ? '需处理' : '生成中' : 'AI'}</span> : uploaded && <span className="studio-flow-origin">你上传的</span>}{data.uploading ? <small role="status">上传中…</small> : meta?.status === 'loading' && !mediaGenerating && <small title={studioTaskLabel(meta.studio?.task)}>{(meta.studio?.kind==='recreation'?studioTaskLabel(meta.studio?.task,true).replace('生成','拆解'):studioTaskLabel(meta.studio?.task,true))}</small>}</header>
    <div className={`studio-flow-media${studioText ? ' studio-flow-business' : ''}${mediaGenerating ? ' is-generating-media' : ''}`}>
      {studioText ? <div className="nowheel"><StudioNodeContent node={node} readOnly={data.readOnly}/></div> : mediaGenerating ?
        <>{meta?.content && (node.type===CanvasNodeType.Video ? <SignedVideo src={meta.content} storageKey={meta.storageKey} preload="metadata" onLoadedMetadata={videoLoaded}/> : <SignedImage draggable={false} src={meta.content} storageKey={meta.storageKey} alt={node.title} onLoad={imageLoaded}/>)}<StudioMediaGenerationState media={node.type===CanvasNodeType.Video?'video':'image'} task={meta?.studio?.task} confirmed={!!(meta?.studio?.runId||meta?.runId||meta?.videoTaskId||meta?.images?.some(t=>t.runId))}/></> : node.type === CanvasNodeType.Image && (meta?.content||meta?.storageKey) ?
        <><SignedImage draggable={false} src={meta.content} storageKey={meta.storageKey} alt={node.title} onLoad={imageLoaded}/>{!data.readOnly&&<button type="button" className="studio-flow-replace-image nodrag nopan" disabled={imageLocked} onClick={uploadImage}><Upload size={14}/>{data.uploading?'上传中…':'替换图片'}</button>}</> : node.type === CanvasNodeType.Video && (meta?.content || meta?.storageKey) ?
        <><SignedVideo className="nodrag nopan" src={meta.content} storageKey={meta.storageKey} controls preload="metadata" onLoadedMetadata={videoLoaded}/>{!data.readOnly&&<button type="button" className="studio-flow-replace-image nodrag nopan" disabled={imageLocked} onClick={uploadVideo}><Upload size={14}/>{data.uploading?'上传处理中…':'替换视频'}</button>}</> : node.type === CanvasNodeType.Audio && (meta?.content || meta?.storageKey) ?
        <div className="studio-flow-audio"><Music2 size={28}/><SignedAudio className="nodrag nopan" src={meta.content} storageKey={meta.storageKey} controls/></div> : node.type === CanvasNodeType.Text ?
        <div className="studio-flow-text nowheel">{meta?.content || (data.readOnly?'存为个人副本后填写':'单击编辑文字')}</div> :
        // A failed draft is not an empty one: say it failed and why, offer one way back (the prompt and references are kept).
        failed && !data.readOnly ? <div className="studio-flow-placeholder studio-flow-failure" role="group" aria-label="生成失败">
          <AlertCircle size={22}/><strong>没有生成出来</strong><span title={meta?.studio?.task?.errorMessage || meta?.errorDetails || undefined}>{studioFailureReason(node)}</span>
          <div className="studio-flow-image-actions"><button type="button" className="nodrag nopan" disabled={imageLocked} onClick={edit}><RotateCcw size={15}/>修改后重试</button>
            <button type="button" className="nodrag nopan studio-flow-failure-upload" disabled={imageLocked} onClick={node.type === CanvasNodeType.Image ? uploadImage : uploadVideo}><Upload size={15}/>改为上传</button></div></div> :
        node.type === CanvasNodeType.Image && !data.readOnly ? <div className="studio-flow-placeholder studio-flow-image-placeholder"><ImagePlus size={28}/><span>上传图片或使用 AI 创作</span><div className="studio-flow-image-actions"><button type="button" className="nodrag nopan" disabled={imageLocked} onClick={uploadImage}><Upload size={15}/>{data.uploading?'上传中…':'上传图片'}</button><button type="button" className="nodrag nopan" disabled={imageLocked} onClick={edit}><ImagePlus size={15}/>生成图片</button></div></div> :
        node.type === CanvasNodeType.Video && !data.readOnly ? <div className="studio-flow-placeholder studio-flow-image-placeholder"><Video size={28}/><span>上传视频，开始解析或拉片</span><div className="studio-flow-image-actions"><button type="button" className="nodrag nopan" disabled={imageLocked} onClick={uploadVideo}><Upload size={15}/>{data.uploading?'上传处理中…':'上传视频'}</button><button type="button" className="nodrag nopan" disabled={imageLocked} onClick={edit}><Video size={15}/>生成视频</button></div><small>MP4 · 最长 60 秒 · 最大 128 MB</small></div> :
        <div className="studio-flow-placeholder"><button type="button" className="studio-flow-media-action nodrag nopan" onClick={edit}><Icon size={28}/><span>{data.readOnly?'查看节点设置':meta?.status === 'loading' ? '任务进行中，可继续编辑画布' : `点击创作${node.type === 'video' ? '视频' : node.type==='audio'?'配音':'图片'}`}</span></button></div>}
    </div>
    {meta?.status === 'loading' && !mediaGenerating && studioTaskQueued(meta.studio?.task) && <p className="studio-flow-queue" aria-label="队列状态">{studioQueueNotice(meta.studio?.task?.queue)}</p>}
    {meta?.status === 'error' && (meta.studio?.task?.errorCode==='IP_RUN_CANCELLED'?<p className="studio-flow-queue">已停止</p>:<div className="studio-flow-node-error"><StudioErrorNotice error={studioNodeError(node)} once={`run:${meta.studio?.runId || meta.runId || node.id}`} label={failed ? "查看错误详情" : "生成失败 · 查看错误"} autoReport={false}/></div>)}
  </article>;
}
const nodeTypes = { studio: StudioFlowCard };
function ReferenceEdge(props:EdgeProps) {
  const flow=useReactFlow(),[hover,setHover]=useState(false);
  const [path,x,y]=getBezierPath(props);
  return <g onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
    <BaseEdge id={props.id} path={path} style={props.style} interactionWidth={24}/>
    <EdgeLabelRenderer><button type="button" className={`studio-flow-cut-edge nodrag nopan${hover||props.selected?' is-visible':''}`}
      style={{transform:`translate(-50%, -50%) translate(${x}px,${y}px)`}} aria-label="删除引用连线" title="删除引用连线"
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onClick={()=>void flow.deleteElements({edges:[{id:props.id}]})}><Scissors size={16}/></button></EdgeLabelRenderer>
  </g>;
}
const edgeTypes={reference:ReferenceEdge};
/**
 * Fit into the part of the stage the user can actually see: the view switch on top, the zoom bar below, the rail on the
 * left (desktop) and a docked panel on the right. Fitting to the whole stage put 「在画布上看」 targets and nodes the assistant
 * had just placed behind the docked assistant (2026-10-19 walkthrough).
 */
export function visibleFitPadding(shell: HTMLElement | null, room = 24) {
  const dock = shell?.classList.contains('has-docked-panel') ? parseFloat(shell.style.getPropertyValue('--studio-docked-panel')) || 0 : 0;
  const rail = document.documentElement.dataset.layout === 'desktop' ? 56 : 0;
  const px = (n: number) => `${Math.round(n)}px` as const;
  return { top: px(64 + room), bottom: px(64 + room), left: px(rail + room), right: px(dock + room) };
}
/** How long a single click on a node title waits for a second one (a double click renames). */
export const STUDIO_TITLE_CLICK_MS = 300;
type Snapshot = { nodes: CanvasNodeData[]; connections: CanvasConnection[] };

function FlowWorkspace({ projectId }: { projectId: string }) {
  const identity = useIdentity();
  const project = useCanvasStore(s => s.projects.find(p => p.id === projectId));
  const flow = useReactFlow<StudioFlowNode>(), viewport = useViewport(), { zoom } = viewport, { message } = useStudioApp();
  const picker = useRef<AttachmentPickerActions>(null), shellRef = useRef<HTMLDivElement>(null);
  // Nodes the assistant just put on the canvas glow for a moment (studio-command: reveal).
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const freshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [selected, setSelected] = useState(new Set<string>()), [handTool, setHandTool] = useState(true), [spaceHeld, setSpaceHeld] = useState(false), [minimap, setMinimap] = useState(false);
  const hand = handTool || spaceHeld;
  const [find, setFind] = useState(false), [query, setQuery] = useState(''), [textId, setTextId] = useState<string>(), [renameId, setRenameId] = useState<string>();
  const [textExpanded,setTextExpanded]=useState(false);
  useEffect(()=>{setTextExpanded(false);},[textId]);
  // A text node made from a 「文字」 entry (empty-canvas guide, the rail's 「＋添加」, the pane menu) is made to be typed in:
  // the caret lands in its editor as soon as the editor mounts. Only once per new node, and never taken from another field
  // the user is typing in; opening an existing node's editor leaves focus where it is.
  const focusNewText = useRef<string | undefined>(undefined);
  const textEditorRef = useCallback((editor: GetRef<typeof Input.TextArea> | null) => {
    if (!editor || !textId || focusNewText.current !== textId) return;
    focusNewText.current = undefined;
    const active = document.activeElement as HTMLElement | null;
    if (active?.closest?.('input,textarea,select,[contenteditable="true"]') && !active.closest('.studio-plain-text-editor')) return;
    editor.focus({ preventScroll: true, cursor: 'end' });
  }, [textId]);
  const [referencePick,setReferencePick]=useState(false),referenceOrigin=useRef<string|undefined>(undefined);
  // A single click on a node title waits out the double-click window before opening the panel: opening it also brings
  // the node into view, and a view that moves under the second click turned a rename into a click somewhere else.
  const titleClick=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const cancelTitleClick=useCallback(()=>{clearTimeout(titleClick.current);titleClick.current=undefined;},[]);
  useEffect(()=>cancelTitleClick,[cancelTitleClick]);
  const [pendingFocus, setPendingFocus] = useState<string>(), [selectedEdges, setSelectedEdges] = useState(new Set<string>());
  const [context, setContext] = useState<{ x: number; y: number; nodeId?: string }>();
  const [pendingConnection,setPendingConnection]=useState<PendingStudioConnection>();
  const [pendingCreator,setPendingCreator]=useState<{id:string;sourceId?:string;operation:string}>();
  const closeConnectionMenu=useCallback(()=>setPendingConnection(undefined),[]);
  const [reading, setReading] = useState(false), [historyRevision, refreshHistory] = useState(0);
  const [uploadingImageId, setUploadingImageId] = useState<string>();
  const videoUploadInput = useRef<HTMLInputElement>(null), videoUploadTarget = useRef<string | undefined>(undefined), videoUploadBusy = useRef(false);
  const imageUploadInput = useRef<HTMLInputElement>(null), imageUploadTarget = useRef<string | undefined>(undefined);
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const clipboard = useRef<Snapshot | undefined>(undefined);
  const current = useCallback(() => useCanvasStore.getState().projects.find(p => p.id === projectId)!, [projectId]);
  const setNodes: Dispatch<SetStateAction<CanvasNodeData[]>> = useCallback(update => {
    const old = current().nodes; const next = typeof update === 'function' ? update(old) : update;
    if (next !== old) useCanvasStore.getState().updateProject(projectId, { nodes: next });
  }, [current, projectId]);
  const setConnections: Dispatch<SetStateAction<CanvasConnection[]>> = useCallback(update => {
    const old = current().connections; const next = typeof update === 'function' ? update(old) : update;
    if (next !== old) {
      useCanvasStore.getState().updateProject(projectId, { connections: next });
      for(const removed of old.filter(c=>!next.some(n=>n.fromNodeId===c.fromNodeId&&n.toNodeId===c.toNodeId)))window.dispatchEvent(new CustomEvent('studio-reference-removed',{detail:{nodeId:removed.fromNodeId,targetId:removed.toNodeId}}));
    }
  }, [current, projectId]);
  useTemplateProjection(projectId, setNodes);
  useFlowLegacyTasks(projectId, setNodes);
  const checkpoint = useCallback(() => {
    const p = current(); history.current.past.push(structuredClone({ nodes: p.nodes, connections: p.connections }));
    history.current.past = history.current.past.slice(-40); history.current.future = []; refreshHistory(v => v + 1);
  }, [current]);
  const travel = useCallback((direction: 'past' | 'future') => {
    const stack = history.current[direction], next = stack.pop(); if (!next) return;
    const p = current();
    // Keep task results current while undoing layout/content; never resurrect a removed accepted run.
    const active = new Map(p.nodes.filter(n => n.metadata?.studio?.runId || studioGenerationPending(n)).map(n => [n.id, n]));
    history.current[direction === 'past' ? 'future' : 'past'].push(structuredClone({ nodes: p.nodes, connections: p.connections }));
    const restored = next.nodes.map(n => active.has(n.id) ? { ...active.get(n.id)!, title: n.title, position: n.position, width: n.width, height: n.height } : n);
    for (const n of p.nodes) if (studioGenerationPending(n) && !restored.some(r => r.id === n.id)) restored.push(n);
    const ids = new Set(restored.map(n => n.id));
    useCanvasStore.getState().updateProject(projectId, { nodes: restored, connections: next.connections.filter(c => ids.has(c.fromNodeId) && ids.has(c.toNodeId)) });
    setSelected(old => new Set([...old].filter(id => ids.has(id))));
    setSelectedEdges(new Set());
    refreshHistory(v => v + 1);
  }, [current, projectId]);
  const renameNode = useCallback((id: string, title: string) => {
    if (!title.trim() || current().nodes.find(n => n.id === id)?.title === title.trim()) return;
    checkpoint(); setNodes(old => old.map(n => n.id === id ? { ...n, title: title.trim() } : n));
  }, [current, checkpoint, setNodes]);
  const describeGroup = useCallback((id: string, description: string) => {
    if ((current().nodes.find(n => n.id === id)?.metadata?.groupDescription || '') === description.trim()) return;
    checkpoint(); setNodes(old => describeStudioGroup(old, id, description));
  }, [current, checkpoint, setNodes]);
  const focusNode = useCallback((id: string) => { setSelected(new Set([id])); setSelectedEdges(new Set()); setPendingFocus(id); }, []);
  const connectReference=(source:string,target:string)=>{
    const p=current();if(source===target||!p.nodes.some(n=>n.id===source)||!p.nodes.some(n=>n.id===target)||p.connections.some(c=>c.fromNodeId===source&&c.toNodeId===target))return;
    checkpoint();setConnections(old=>[...old,{id:nanoid(),fromNodeId:source,toNodeId:target}]);
    window.dispatchEvent(new CustomEvent('studio-reference-selected',{detail:{nodeId:source,targetId:target}}));
  };
  useEffect(()=>{
    if(!pendingCreator||!project?.nodes.some(n=>n.id===pendingCreator.id))return;
    const node=project.nodes.find(n=>n.id===pendingCreator.id)!,stage=document.querySelector('.studio-flow-stage')?.getBoundingClientRect();
    if(pendingCreator.sourceId&&stage&&(node.position.x*viewport.zoom+viewport.x<76||(node.position.x+node.width)*viewport.zoom+viewport.x>stage.width-16||node.position.y*viewport.zoom+viewport.y<72||(node.position.y+node.height)*viewport.zoom+viewport.y>stage.height-68))
      void flow.fitView({nodes:[{id:pendingCreator.sourceId},{id:node.id}],padding:.2,maxZoom:viewport.zoom,duration:260});
    // Dispatch only after the child workspace receives both the node and its reference edge.
    dispatchStudioCommand(pendingCreator.operation,pendingCreator.id);setPendingCreator(undefined);
  },[pendingCreator,project?.nodes,project?.connections,flow,viewport]);
  const finishConnection:OnConnectEnd<StudioFlowNode>=(event,state)=>{
    if(state.isValid||state.fromHandle?.type!=='source'||!state.fromNode)return;
    const point='changedTouches' in event?event.changedTouches[0]:event;
    if(!point)return;
    const under=document.elementFromPoint(point.clientX,point.clientY);
    const target=under?.closest('.react-flow__node')?.getAttribute('data-id');
    if(target){connectReference(state.fromNode.id,target);return;}
    if(state.toNode)return;
    if(!under?.closest('.react-flow__pane'))return;
    setContext(undefined);setSelected(new Set([state.fromNode.id]));
    setPendingConnection({sourceId:state.fromNode.id,screen:{x:point.clientX,y:point.clientY},position:flow.screenToFlowPosition({x:point.clientX,y:point.clientY})});
  };
  const createReference=(type:CanvasNodeType.Text|CanvasNodeType.Image|CanvasNodeType.Video)=>{
    if(!pendingConnection)return;const p=current();
    const result=createStudioLinkedNode(pendingConnection.sourceId,type,pendingConnection.position,p.nodes);
    if(!result){closeConnectionMenu();return;}checkpoint();
    useCanvasStore.getState().updateProject(projectId,{nodes:[...p.nodes,result.node],connections:[...p.connections,{id:nanoid(),fromNodeId:pendingConnection.sourceId,toNodeId:result.node.id}]});
    setSelected(new Set([result.node.id]));setSelectedEdges(new Set());closeConnectionMenu();
    setPendingCreator({id:result.node.id,sourceId:pendingConnection.sourceId,operation:result.operation});
  };
  // Wait only for React Flow to know the target node. Nodes are controlled with explicit width/height, so React Flow's own
  // `measured` stays empty and React Flow's nodes-initialized hook is never true — gating on it meant focusing (「在画布上看」, new results,
  // task links) silently never moved the view (2026-10-19 walkthrough). Bounds come from the explicit size.
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => {
    if (!pendingFocus || !flow.viewportInitialized) return;
    const node = project?.nodes.find(n => n.id === pendingFocus); if (!node) return;
    if (!flow.getInternalNode(node.id)) { const frame = requestAnimationFrame(() => setFocusTick(t => t + 1)); return () => cancelAnimationFrame(frame); }
    void flow.fitView({ nodes: [{ id: node.id }], padding: visibleFitPadding(shellRef.current, 80), maxZoom: 1, duration: 260 });
    setPendingFocus(undefined);
  }, [pendingFocus, flow, flow.viewportInitialized, project?.nodes, focusTick]);
  const closePanel = useCallback(() => { setTextId(undefined); setRenameId(undefined); setContext(undefined); }, []);
  const modalContainer = () => document.querySelector<HTMLElement>('.studio-flow-shell')?.closest<HTMLElement>('.ip-surface') || document.body;
  const placeVisibleNode = (node: CanvasNodeData, existing: CanvasNodeData[], at?: {x:number;y:number}) => {
    const rect = document.querySelector('.studio-flow-stage')?.getBoundingClientRect();
    // A docked assistant covers the stage's right edge: new nodes land in the part the user can see (same rule as visibleFitPadding).
    const shell = shellRef.current, dock = shell?.classList.contains('has-docked-panel') ? parseFloat(shell.style.getPropertyValue('--studio-docked-panel')) || 0 : 0;
    const left = (rect?.left || 0) + 80, top = (rect?.top || 0) + 72;
    const start = flow.screenToFlowPosition({ x: left, y: top });
    const end = flow.screenToFlowPosition({ x: Math.max(left, (rect?.right || 900) - 24 - dock), y: (rect?.bottom || 700) - 68 });
    return placeNodeInViewport(node, existing, { ...start, width: Math.max(0, end.x - start.x), height: Math.max(0, end.y - start.y) }, at && flow.screenToFlowPosition(at));
  };
  const add = (type: CanvasNodeType, at?: {x:number;y:number}) => {
    setContext(undefined);
    checkpoint(); const node = makeStudioNode(type === CanvasNodeType.Video ? 'video' : type === CanvasNodeType.Text ? 'script' : 'image');
    node.type = type; node.title = type === CanvasNodeType.Text ? '文字' : type === CanvasNodeType.Video ? '视频' : '图片';
    if (type === CanvasNodeType.Text) node.metadata = { content: '', status: 'idle' };
    setNodes(old => [...old, placeVisibleNode(node, old, at)]);
    setSelected(new Set([node.id])); setSelectedEdges(new Set()); setPendingFocus(undefined);
    if (type === CanvasNodeType.Text) { focusNewText.current = node.id; setTextId(node.id); } else setPendingCreator({ id: node.id, operation: type });
  };
  const addRef = useRef(add); addRef.current = add;
  const copy = useCallback(() => {
    const p = current(), groups = new Set(p.nodes.filter(n => selected.has(n.id) && n.type === CanvasNodeType.Group).map(n => n.id));
    clipboard.current = { nodes: p.nodes.filter(n => selected.has(n.id) || groups.has(n.metadata?.groupId || '')), connections: p.connections };
  }, [current, selected]);
  const paste = useCallback((duplicate = false) => {
    const p = current(), source = duplicate ? p : clipboard.current; if (!source) return;
    const result = copyFlowSelection(source.nodes, source.connections, duplicate ? selected : new Set(source.nodes.map(n => n.id)),new Set(p.nodes.map(n=>n.id)));
    if (!result.nodes.length) return; checkpoint(); setNodes(old => [...old, ...result.nodes]); setConnections(old => [...old, ...result.connections]);
    setSelected(new Set(result.nodes.map(n => n.id)));
  }, [current, selected, checkpoint, setNodes, setConnections]);
  const group = useCallback((release = false) => {
    const p = current();
    const members = collectGroupMemberNodes(selected, p.nodes), rect = getGroupWrapRect(members);
    const frame: CanvasNodeData = { id: nanoid(), type: CanvasNodeType.Group, title: '分组', position: { x: rect.x, y: rect.y }, width: rect.width, height: rect.height, metadata: { status: 'idle' } };
    const result = release ? applyUngroupSelection(selected, p.nodes, p.connections) : applyGroupSelection(selected, p.nodes, p.connections, frame);
    if (!result) return; checkpoint(); useCanvasStore.getState().updateProject(projectId, { nodes: result.nodes, connections: result.connections }); setSelected(new Set(result.selectedIds)); setContext(undefined);
  }, [current, selected, checkpoint, projectId]);
  const arrange = useCallback(() => { checkpoint(); setNodes(old => arrangeFlowNodes(old, selected.size > 1 ? selected : undefined)); setContext(undefined); requestAnimationFrame(() => void flow.fitView({ padding: visibleFitPadding(shellRef.current), duration: 260 })); }, [checkpoint, setNodes, selected, flow]);
  const remove = useCallback(() => {
    const p = current(), blocked = p.nodes.filter(n => selected.has(n.id) && studioGenerationPending(n));
    const ids = new Set(p.nodes.filter(n => selected.has(n.id) && !studioGenerationPending(n)).map(n => n.id));
    if (blocked.length) message.info('生成中的节点保留，请先在任务中心处理原任务');
    if (!ids.size && !selectedEdges.size) return; checkpoint();
    setNodes(old => old.filter(n => !ids.has(n.id)).map(n => ids.has(n.metadata?.groupId || '') ? { ...n, metadata: { ...n.metadata, groupId: undefined } } : n));
    setConnections(old => old.filter(c => !selectedEdges.has(c.id) && !ids.has(c.fromNodeId) && !ids.has(c.toNodeId))); setSelected(new Set()); setSelectedEdges(new Set()); setContext(undefined);
  }, [current, selected, selectedEdges, message, checkpoint, setNodes, setConnections]);
  useEffect(() => {
    const referenceMode=(e:Event)=>{const detail=(e as CustomEvent<{active:boolean;originId?:string}>).detail;setReferencePick(detail.active);referenceOrigin.current=detail.originId;};
    window.addEventListener('studio-reference-mode',referenceMode);
    const command = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string; nodeId?: string }>).detail;
      setContext(undefined); setRenameId(undefined);
      if (detail.action === 'upload-video') {
        const node = current().nodes.find(n => n.id === detail.nodeId);
        if (reading || videoUploadBusy.current) { message.info('素材正在上传，请完成后再添加'); return; }
        if (!node || node.type !== CanvasNodeType.Video) return;
        if (node.metadata?.status === 'loading' || studioGenerationPending(node)) { message.info('当前节点正在生成，请等待任务完成后再替换视频'); return; }
        videoUploadTarget.current = node.id; videoUploadInput.current?.click();
      } else if (detail.action === 'upload-image') {
        const node = current().nodes.find(n => n.id === detail.nodeId);
        if (reading) { message.info('素材正在上传，请完成后再添加'); return; }
        if (!node || node.type !== CanvasNodeType.Image) return;
        if (studioGenerationPending(node)) { message.info('当前节点正在生成，请等待任务完成后再替换图片'); return; }
        imageUploadTarget.current = node.id; imageUploadInput.current?.click();
      }
      // The empty-canvas guide (studio-canvas-guide.tsx) lives in the workspace overlay; its entries run the rail's 「＋添加」 here.
      else if (detail.action === 'add-text') addRef.current(CanvasNodeType.Text);
      else if (detail.action === 'add-image') addRef.current(CanvasNodeType.Image);
      else if (detail.action === 'add-video') addRef.current(CanvasNodeType.Video);
      else if (detail.action === 'upload') picker.current?.upload();
      else if (detail.action === 'edit-text') { checkpoint(); setTextId(detail.nodeId); }
      else if (detail.action === 'focus') { if (detail.nodeId && current().nodes.some(n => n.id === detail.nodeId)) focusNode(detail.nodeId); }
      // 'reveal' only brings nodes into view (the assistant following its own work); the selection is left alone.
      else if (detail.action === 'reveal') { const ids = (detail.nodeId || '').split(',').filter(id => current().nodes.some(n => n.id === id)); if (ids.length) { void flow.fitView({ nodes: ids.map(id => ({ id })), padding: visibleFitPadding(shellRef.current, 48), maxZoom: 1, duration: 320 }); setFresh(new Set(ids)); clearTimeout(freshTimer.current); freshTimer.current = setTimeout(() => setFresh(new Set()), 2400); } }
      else setTextId(undefined);
    };
    const keydown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"],.ant-modal,.ant-drawer,.studio-floating-panel,.studio-flow-reference-menu')) return;
      // Storyboard/work views must not edit a hidden canvas selection through global shortcuts.
      if (document.querySelector('.studio-focused-view')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === 'Space') { if((e.target as HTMLElement)?.closest('button'))return;e.preventDefault(); setSpaceHeld(true); }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); travel(e.shiftKey ? 'future' : 'past'); }
      if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); copy(); }
      if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); paste(); }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); paste(true); }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelected(new Set(current().nodes.map(n => n.id))); }
      if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); group(e.shiftKey); }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void saveStudioDocument(projectId).catch(error => message.error(error)); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
      if (e.key === 'Escape') { setSelected(new Set()); setSelectedEdges(new Set()); setFind(false); setTextId(undefined); setContext(undefined); setPendingConnection(undefined); }
    };
    const keyup = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    const blur = () => setSpaceHeld(false);
    window.addEventListener('studio-command', command); window.addEventListener('studio-canvas-checkpoint', checkpoint); window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('studio-reference-mode',referenceMode); window.removeEventListener('studio-command', command); window.removeEventListener('studio-canvas-checkpoint', checkpoint); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
  }, [travel, copy, paste, remove, group, checkpoint, current, projectId, message, reading, flow]);
  const uploadImageIntoNode = async (file: File) => {
    const nodeId = imageUploadTarget.current;
    if (!nodeId || reading) return;
    let inserted = false;
    try {
      validateStudioImageUpload(file); setReading(true); setUploadingImageId(nodeId);
      const image = await importStudioMedia(projectId, file, 'image');
      // Resolve the current document after upload; deletion or a newly started generation must not be overwritten.
      const nodes = replaceStudioImage(current().nodes, current().connections, nodeId, image);
      checkpoint(); setNodes(nodes); inserted = true; dispatchStudioCommand('image-uploaded', nodeId);
      await saveStudioDocument(projectId); focusNode(nodeId); message.success('图片已添加');
    } catch (e) {
      const reason = e instanceof Error ? e.message : '图片上传失败，请重试';
      // The error itself keeps the server's code and log id; a plain string was reported as CLIENT_ERROR.
      message.error(inserted ? `图片已添加；${reason}，可按 Ctrl/Cmd+S 重试保存画布` : e);
    } finally { setReading(false); setUploadingImageId(undefined); }
  };
  const uploadVideoIntoNode = async (file: File) => {
    const nodeId = videoUploadTarget.current;
    if (!nodeId || reading || videoUploadBusy.current) return;
    let inserted = false;
    try {
      validateStudioVideoUpload(file); videoUploadBusy.current = true; setReading(true); setUploadingImageId(nodeId);
      const video = await importStudioMedia(projectId, file, 'video');
      const nodes = replaceStudioVideo(current().nodes, current().connections, nodeId, video);
      checkpoint(); setNodes(nodes); inserted = true; dispatchStudioCommand('video-uploaded', nodeId);
      await saveStudioDocument(projectId); focusNode(nodeId); message.success('视频已添加，可开始解析或拉片');
    } catch (e) {
      const reason = e instanceof Error ? e.message : '视频上传失败，请重试';
      message.error(inserted ? `视频已添加；${reason}，可按 Ctrl/Cmd+S 重试保存画布` : e);
    } finally { videoUploadBusy.current = false; setReading(false); setUploadingImageId(undefined); }
  };
  const importFiles = async (files: File[]) => {
    if (reading) return; setReading(true); checkpoint(); let last: string | undefined;
    try { for (const file of files) {
      try { const node = await readAssistantAttachment(file, current().nodes, f => importStudioStory(projectId, f), (f, type) => importStudioMedia(projectId, f, type));
        setNodes(old => old.some(n => n.id === node.id) ? old : [...old, placeVisibleNode(node, old)]); last = node.id;
      } catch (e) { message.error(e instanceof Error ? `${file.name}：${e.message}` : '导入失败'); }
    } await saveStudioDocument(projectId); if (last) focusNode(last); } catch (e) { message.error(e); }
    finally { setReading(false); }
  };
  // Not an undo step: the size of what a node shows is a fact about the file, not an edit.
  const mediaSize = useCallback((id: string, size: { width: number; height: number; storageKey?: string }) => {
    setNodes(old => { let changed = false; const next = old.map(n => { if (n.id !== id) return n; const fitted = fitStudioNodeToMedia(n, size); changed ||= fitted !== n; return fitted; }); return changed ? next : old; });
  }, [setNodes]);
  // The resize itself was the undo step (checkpoint at resize start); squaring the height with the clip belongs to it.
  const videoResized = useCallback((id: string) => {
    setNodes(old => { let changed = false; const next = old.map(n => { if (n.id !== id) return n; const fitted = fitStudioVideoToResize(n); changed ||= fitted !== n; return fitted; }); return changed ? next : old; });
  }, [setNodes]);
  // 抽帧 placeholders live only here (never in the document, so autosave and task recovery never see them).
  const [pendingFrames, setPendingFrames] = useState<StudioPendingFrame[]>([]);
  const graphNodes = useMemo(() => [
    ...flowNodes(project?.nodes || [], selected).map(n => ({ ...n, data: { ...n.data, uploading: n.id === uploadingImageId, fresh: fresh.has(n.id), onRename: renameNode, onDescribeGroup: describeGroup, onMediaSize: mediaSize, onVideoResized: videoResized } })),
    ...flowNodes(pendingFrames.map(p => p.node), new Set()).map(n => ({ ...n, draggable: false, selectable: false, connectable: false, deletable: false, data: { ...n.data, readOnly: true, processing: true } })),
  ], [project?.nodes, selected, uploadingImageId, fresh, renameNode, describeGroup, mediaSize, videoResized, pendingFrames]);
  const graphEdges = useMemo(() => [
    ...flowEdges(project?.connections || []).map(e => ({ ...e, type:'reference',selected: selectedEdges.has(e.id) })),
    ...flowEdges(pendingFrames.map(p => p.connection)).map(e => ({ ...e, selectable: false, deletable: false })),
  ], [project?.connections, selectedEdges, pendingFrames]);
  const changeNodes = useCallback((changes: NodeChange<StudioFlowNode>[]) => {
    setNodes(old => changeFlowNodes(old, changes));
    const selection = changes.filter(c => c.type === 'select');
    if (selection.length) setSelected(old => { const next = new Set(old); for (const c of selection) if (c.type === 'select') c.selected ? next.add(c.id) : next.delete(c.id); return next; });
  }, [setNodes]);
  const changeEdges = useCallback((changes: EdgeChange[]) => {
    if (changes.some(c => c.type === 'remove')) checkpoint(); setConnections(old => changeFlowEdges(old, changes));
    const selections = changes.filter(c => c.type === 'select');
    if (selections.length) setSelectedEdges(old => { const next = new Set(old); selections.forEach(c => { if (c.type === 'select') c.selected ? next.add(c.id) : next.delete(c.id); }); return next; });
  }, [setConnections, checkpoint]);
  if (!project) return null;
  const text = project.nodes.find(n => n.id === textId);
  const named = project.nodes.find(n => n.id === renameId), target = project.nodes.find(n => n.id === (context?.nodeId || [...selected][0]));
  // 右键菜单是一排平铺的按钮，每项都要有 onClick；不支持 children（「素材拆解」曾因此点了就报错）。
  const nodeMenu = target ? [
    { key: 'edit', label: target.type === CanvasNodeType.Group ? '编辑分组名称' : '编辑内容', onClick: () => { if (target.type === CanvasNodeType.Group) { checkpoint(); setRenameId(target.id); } else dispatchStudioCommand(studioNodeCommand(target,true)||'edit-text', target.id); } },
    ...(target.type===CanvasNodeType.Video&&target.metadata?.storageKey?[{key:'video-frames',label:'抽帧',onClick:()=>dispatchStudioCommand('video-frames',target.id)}]:[]),
    ...(target.type===CanvasNodeType.Video&&target.metadata?.storageKey?[{key:'analyze',label:'解析视频',onClick:()=>dispatchStudioCommand('recreation',target.id)},{key:'film-study',label:'拉片',onClick:()=>dispatchStudioCommand('film-study',target.id)}]:[]),
    { key: 'rename', label: '重命名', onClick: () => { checkpoint(); setRenameId(target.id); } },
    ...(target.type === CanvasNodeType.Video ? [{ key: 'upload-video', label: target.metadata?.storageKey ? '替换视频' : '上传视频', onClick: () => dispatchStudioCommand('upload-video', target.id) }] : []),
    ...(target.type === CanvasNodeType.Image ? [{ key: 'upload', label: target.metadata?.storageKey ? '替换图片' : '上传图片', onClick: () => dispatchStudioCommand('upload-image', target.id) }] : []),
    ...(target.type === 'image' && target.metadata?.storageKey ? ['crop', 'mask', 'split-image'].map(action => ({ key: action, label: { crop: '裁剪图片', mask: '局部重绘', 'split-image': '拆分图片' }[action], onClick: () => dispatchStudioCommand(action, target.id) })) : []),
    { key: 'copy', label: '复制节点', onClick: () => paste(true) },
    ...(canGroupSelectedNodes(selected, project.nodes) ? [{ key: 'group', label: '建立分组', onClick: () => group() }] : []),
    ...(canUngroupSelectedNodes(selected, project.nodes) ? [{ key: 'ungroup', label: '解除分组', onClick: () => group(true) }] : []),
    { key: 'delete', label: '删除节点', onClick: remove, danger: true },
  ] : [];
  const paneMenu = [
    {key:'text',label:'添加文字',onClick:()=>add(CanvasNodeType.Text,context)},
    {key:'image',label:'添加图片',onClick:()=>add(CanvasNodeType.Image,context)},
    {key:'video',label:'添加视频',onClick:()=>add(CanvasNodeType.Video,context)},
    {key:'templates',label:'套用画布模板',onClick:()=>dispatchStudioCommand('templates')},
    // 画布页改版：缩放条只留缩放和适应（设计稿 Main 画板），撤销 / 重做 / 小地图挪到这里；快捷键 Ctrl/Cmd+Z、Shift+Ctrl/Cmd+Z 照旧。
    ...(history.current.past.length?[{key:'undo',label:'撤销',onClick:()=>travel('past')}]:[]),
    ...(history.current.future.length?[{key:'redo',label:'重做',onClick:()=>travel('future')}]:[]),
    {key:'minimap',label:minimap?'隐藏小地图':'显示小地图',onClick:()=>setMinimap(v=>!v)},
  ];
  return <StudioFloatingContext.Provider value={{viewport,nodes:project.nodes}}><div ref={shellRef} className="studio-flow-shell" data-history={historyRevision}>
    <header className="studio-flow-header"><a href="/projects" aria-label="返回项目"><ArrowLeft size={18}/></a>
      <Input aria-label="画布名称" variant="borderless" value={project.title} maxLength={80} onChange={e => useCanvasStore.getState().renameProject(projectId, e.target.value)}/>
      <HostActionsSlot/>
      <div className="studio-canvas-credit"><WalletBadge account={identity?.uid ?? null} location={`/projects/${projectId}`}/></div>
    </header>
    <div className={`studio-flow-stage${referencePick?' is-picking-reference':''}`} data-studio-floating-root>
      <ReactFlow<StudioFlowNode> nodes={graphNodes} edges={graphEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} elevateNodesOnSelect={false}
        onNodesChange={changeNodes} onEdgesChange={changeEdges} onNodeDragStart={checkpoint}
        onConnectStart={()=>{closeConnectionMenu();setContext(undefined);}} onConnectEnd={finishConnection}
        isValidConnection={c=>c.source!==c.target&&!current().connections.some(edge=>edge.fromNodeId===c.source&&edge.toNodeId===c.target)}
        onConnect={c => {if(c.source&&c.target)connectReference(c.source,c.target);}}
        onNodeClick={(event,n)=>{
          if(event.button!==0)return;
          cancelTitleClick();
          setContext(undefined);
          if(referencePick){if(referenceOrigin.current)setSelected(new Set([referenceOrigin.current]));window.dispatchEvent(new CustomEvent('studio-reference-selected',{detail:{nodeId:n.id}}));return;}
          // A click on the clip itself (<video> / <audio>, native controls included) plays as usual *and* opens the node's
          // panel: a fitted video fills the whole card, so skipping media left no place to click (2026-10-23). Real controls
          // on the card (replace, upload, retry, links, ports) still keep their own click. The title is a button only for its
          // double click / F2 rename; a single click on it is a click on the node.
          if(event.shiftKey||event.metaKey||event.ctrlKey||(event.target as HTMLElement).closest('button:not(.studio-flow-title),a,input,textarea,select,.react-flow__handle'))return;
          const node=n.data.document;if(node.type==='group')return;
          const action=studioNodeCommand(node);if(!action)return;
          if((event.target as HTMLElement).closest('.studio-flow-title')){
            if(event.detail>1)return;
            titleClick.current=setTimeout(()=>{titleClick.current=undefined;dispatchStudioCommand(action,n.id);},STUDIO_TITLE_CLICK_MS);
            return;
          }
          dispatchStudioCommand(action,n.id);
        }}
        onNodeDoubleClick={(event, n) => { if ((event.target as HTMLElement).closest('.studio-flow-title,.studio-flow-title-input')) return; if (n.data.document.type === 'group') { checkpoint(); setRenameId(n.id); } else dispatchStudioCommand(studioNodeCommand(n.data.document,true)||'edit-text', n.id); }}
        onNodeContextMenu={(event, n) => { event.preventDefault(); cancelTitleClick(); setTextId(undefined); window.dispatchEvent(new Event('studio-node-context-menu')); if (!selected.has(n.id)) setSelected(new Set([n.id])); setContext({ x: event.clientX, y: event.clientY, nodeId: n.id }); }}
        onPaneClick={event => { cancelTitleClick(); if(event.detail===2) {setSelected(new Set());setSelectedEdges(new Set());setContext({x:event.clientX,y:event.clientY});} else {setContext(undefined);if(!referencePick)setTextId(undefined);window.dispatchEvent(new Event('studio-dismiss-composer'));} }}
        onPaneContextMenu={event => { event.preventDefault();setSelected(new Set());setSelectedEdges(new Set());setContext({x:event.clientX,y:event.clientY}); }}
        defaultViewport={{ x: project.viewport.x, y: project.viewport.y, zoom: project.viewport.k }}
        onMoveStart={closeConnectionMenu} onMoveEnd={(_, v) => useCanvasStore.getState().updateProject(projectId, { viewport: { x: v.x, y: v.y, k: v.zoom } })}
        panOnDrag={hand ? true : [1, 2]} panOnScroll selectionOnDrag={!hand} selectionMode={SelectionMode.Partial}
        zoomOnScroll={false} zoomOnPinch zoomOnDoubleClick={false} minZoom={.15} maxZoom={2.5} deleteKeyCode={null}
        multiSelectionKeyCode={['Meta', 'Control', 'Shift']} selectionKeyCode={null} panActivationKeyCode={null} snapToGrid snapGrid={[8, 8]}
        nodesDraggable={!spaceHeld /* Pan the background with the hand tool; reserve whole-canvas panning for Space. */}>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--line-3)"/>
        {minimap && <MiniMap pannable zoomable position="bottom-right" nodeColor="var(--paper-2)" maskColor="var(--canvas-mask)"/>}
      </ReactFlow>
      {pendingConnection&&project.nodes.find(n=>n.id===pendingConnection.sourceId)&&<StudioConnectionCreateMenu pending={pendingConnection} source={project.nodes.find(n=>n.id===pendingConnection.sourceId)!} viewport={viewport} onClose={closeConnectionMenu} onCreate={createReference}/>}
      <nav className="studio-flow-tools" aria-label="画布工具">
        <button aria-label="拖动画布" title="平移" aria-pressed={hand} onClick={() => setHandTool(true)}><Hand size={19} strokeWidth={1.75}/><span className="studio-flow-tool-label">平移</span></button>
        <button aria-label="选择工具" title="选择" aria-pressed={!hand} onClick={() => setHandTool(false)}><MousePointer2 size={19} strokeWidth={1.75}/><span className="studio-flow-tool-label">选择</span></button><hr/>
        {/* 画布页改版（2026-10-19，设计稿 Main 画板）：贴边通高的一列，七个工具 —— 平移、选择、＋添加、素材库、模板、查找、整理；
            创作任务在这列最底下（工作台渲染，见 studio-tasks-launch）。复制、删除、更多节点操作只在右键菜单和多选条里。
            原第二排「更多」里的四项都有去处：商品 / 数字人视频模板在「模板」里，解析视频、口型同步在视频节点的「⋯」里，
            从资产库添加在「素材库 → 素材」里。 */}
        <Dropdown trigger={['click']} placement="rightTop" getPopupContainer={modalContainer} classNames={{ root: 'studio-flow-add-menu' }} menu={{ items: [
          { key: 'text', label: '文字', icon: <FileText size={16}/>, onClick: () => add(CanvasNodeType.Text) },
          { key: 'image', label: '图片', icon: <ImagePlus size={16}/>, onClick: () => add(CanvasNodeType.Image) },
          { key: 'video', label: '视频', icon: <Video size={16}/>, onClick: () => add(CanvasNodeType.Video) },
          { key: 'speech', label: '声音', icon: <Music2 size={16}/>, onClick: () => dispatchStudioCommand('speech') },
          { type: 'divider' },
          { key: 'upload', label: '上传文件', icon: <Upload size={16}/>, onClick: () => picker.current?.upload() },
        ] }}><button aria-label="添加内容" title="添加" className="studio-flow-add"><Plus size={20} strokeWidth={2}/><span className="studio-flow-tool-label">添加</span></button></Dropdown>
        <button aria-label="素材库" title="素材库" onClick={() => dispatchStudioCommand('library')}><ShoppingBag size={19} strokeWidth={1.75}/><span className="studio-flow-tool-label">素材库</span></button>
        <button aria-label="画布模板" title="模板" onClick={() => dispatchStudioCommand('templates')}><LayoutGrid size={19} strokeWidth={1.75}/><span className="studio-flow-tool-label">模板</span></button><hr/>
        <button aria-label="查找节点" title="查找" aria-pressed={find} onClick={() => setFind(v => !v)}><Search size={19} strokeWidth={1.75}/><span className="studio-flow-tool-label">查找</span></button>
        <button aria-label="整理画布" title="整理" onClick={arrange}><AlignLeft size={19} strokeWidth={1.75}/><span className="studio-flow-tool-label">整理</span></button>
        <div hidden><StudioAttachmentPicker projectId={projectId} variant="canvas" locked={reading} reading={reading} actions={picker} onFiles={files => void importFiles(files)} onAssets={async assets => {
          checkpoint(); let last: string | undefined; for (const asset of assets) { const n = attachmentNode(savedAssetPayload(asset), current().nodes); setNodes(old => old.some(x => x.id === n.id) ? old : [...old, placeVisibleNode(n, old)]); last = n.id; }
          await saveStudioDocument(projectId); if (last) focusNode(last);
        }}/></div>
      </nav>
      <input ref={videoUploadInput} type="file" hidden accept={STUDIO_VIDEO_UPLOAD_ACCEPT} aria-label="上传节点视频" onChange={e => { const file=e.target.files?.[0]; e.target.value=''; if(file)void uploadVideoIntoNode(file); }}/>
      <input ref={imageUploadInput} type="file" hidden accept={STUDIO_IMAGE_UPLOAD_ACCEPT} aria-label="上传节点图片" onChange={e => { const file=e.target.files?.[0]; e.target.value=''; if(file)void uploadImageIntoNode(file); }}/>
      {/* 设计稿 Main 画板：缩放条只有 − 百分比 + 适应；撤销 / 重做 / 小地图在画布空白处的右键菜单里。 */}
      <div className="studio-flow-controls" aria-label="视图控制">
        <button title="缩小画布" aria-label="缩小画布" onClick={() => void flow.zoomOut()}><Minus size={15} strokeWidth={1.75}/></button><span>{Math.round(zoom * 100)}%</span><button title="放大画布" aria-label="放大画布" onClick={() => void flow.zoomIn()}><Plus size={15} strokeWidth={1.75}/></button>
        <button title="适应全部节点" aria-label="适应全部节点" onClick={() => void flow.fitView({ padding: visibleFitPadding(shellRef.current), duration: 260 })}><Maximize size={15} strokeWidth={1.75}/></button>
      </div>
      {selected.size > 1 && <div className="studio-flow-selection"><span>已选择 {selected.size} 个节点</span><button title="建立分组" aria-label="建立分组" disabled={!canGroupSelectedNodes(selected,project.nodes)} onClick={() => group()}><Group size={16}/></button><button title="整理选中节点" aria-label="整理选中节点" onClick={arrange}><AlignLeft size={16}/></button><button title="复制选中节点" aria-label="复制选中节点" onClick={() => paste(true)}><Copy size={16}/></button><button title="删除选中节点" aria-label="删除选中节点" onClick={remove}><Trash2 size={16}/></button></div>}
      {context && <div className="studio-flow-context" style={{ left: Math.min(context.x, window.innerWidth - 200), top: Math.min(context.y, window.innerHeight - 330) }}>{(context.nodeId?nodeMenu:paneMenu).map(item => <button key={item.key} onClick={() => { item.onClick(); setContext(undefined); }}>{item.label}</button>)}</div>}
      {find && <aside className="studio-flow-find"><header><strong>查找节点</strong><button title="关闭节点查找" aria-label="关闭节点查找" onClick={() => setFind(false)}><X size={16}/></button></header><Input autoFocus aria-label="搜索画布节点" placeholder="搜索名称或提示词" value={query} onChange={e => setQuery(e.target.value)}/>{project.nodes.filter(n => `${n.title} ${n.metadata?.prompt || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(n => <button key={n.id} onClick={() => focusNode(n.id)}>{n.title}</button>)}</aside>}
    </div>
    <StudioWorkspace projectId={projectId} nodes={project.nodes} connections={project.connections} selectedNodeIds={selected} setNodes={setNodes} setConnections={setConnections}
      onFocusNode={focusNode} onClosePanel={closePanel} onRestorePanel={id=>setSelected(new Set([id]))}
      textEditingNodeId={text?.id} renderTextEditor={actions => <>
        <StudioFloatingPanel title="编辑文字" anchorId={textId} open={!!text&&!textExpanded} className="studio-plain-text-editor" footer={<><Button onClick={()=>setTextExpanded(true)}>展开编辑</Button><Button type="primary" onClick={() => setTextId(undefined)}>完成</Button></>} onClose={() => setTextId(undefined)}>
          {actions}
          <Input.TextArea ref={textEditorRef} aria-label="节点文字" rows={5} value={text?.metadata?.content || ''} onChange={e => setNodes(old => old.map(n => n.id === textId ? { ...n, metadata: { ...n.metadata, content: e.target.value } } : n))}/>
        </StudioFloatingPanel>
        {text&&textExpanded&&<StudioDocumentEditor key={text.id} title={text.title||'文字'} closeLabel="收起编辑" actions={actions}
          value={text.metadata?.content||''} onChange={content=>setNodes(old=>old.map(n=>n.id===text.id?{...n,metadata:{...n.metadata,content}}:n))}
          onSave={async()=>{await saveStudioDocument(projectId);}} onClose={()=>setTextExpanded(false)}/>}
      </>}/>
    <StudioFlowVideoFrames nodes={project.nodes} pending={pendingFrames} onPendingChange={setPendingFrames} onInsert={async (nodes, connections) => {
      checkpoint(); const p = current(), placed=[...p.nodes];
      for(const node of nodes)placed.push(placeStudioNode(node,placed));
      useCanvasStore.getState().updateProject(projectId, { nodes: placed, connections: [...p.connections, ...connections] });
      focusNode(nodes[nodes.length - 1].id);
      try { await saveStudioDocument(projectId); } catch (e) { message.error(e instanceof Error ? `${e.message}；截出的图片已保留，可按 Ctrl/Cmd+S 重试保存` : '截出的图片已保留，请重试保存画布'); }
    }}/>
    <StudioFlowImageTools nodes={project.nodes} onInsert={async (nodes, connections) => {
      checkpoint(); const p = current(), placed=[...p.nodes];
      // Crop, split and redraw share the same collision avoidance as other automatic additions.
      for(const node of nodes)placed.push(placeStudioNode(node,placed));
      useCanvasStore.getState().updateProject(projectId, { nodes: placed, connections: [...p.connections, ...connections] });
      focusNode(nodes[nodes.length - 1].id);
      // The inserted result survives a save failure; closing the editor prevents re-uploading it on retry.
      try { await saveStudioDocument(projectId); } catch (e) { message.error(e instanceof Error ? `${e.message}；编辑结果已保留，可按 Ctrl/Cmd+S 重试保存` : '编辑结果已保留，请重试保存画布'); }
    }}/>
    <Modal title="重命名节点" open={!!named} onCancel={() => setRenameId(undefined)} footer={<Button type="primary" onClick={() => setRenameId(undefined)}>完成</Button>} getContainer={modalContainer}>
      <Input aria-label="节点名称" value={named?.title || ''} maxLength={128} onChange={e => setNodes(old => old.map(n => n.id === renameId ? { ...n, title: e.target.value } : n))}/>
    </Modal>
  </div></StudioFloatingContext.Provider>;
}
export default function StudioFlowCanvas({ projectId }: { projectId: string }) {
  return <ReactFlowProvider><FlowWorkspace key={projectId} projectId={projectId}/></ReactFlowProvider>;
}
