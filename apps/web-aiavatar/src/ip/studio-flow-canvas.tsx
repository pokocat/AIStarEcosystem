'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Handle, Position, NodeResizer, MiniMap, SelectionMode,
  BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, useViewport, useNodesInitialized, type EdgeProps, type OnConnectEnd, type NodeProps, type NodeChange, type EdgeChange } from '@xyflow/react';
import { App, Button, Dropdown, Input, Modal } from 'antd';
import { ArrowLeft, Copy, Ellipsis, FileText, Group, Hand, ImagePlus, LayoutGrid, Maximize, MousePointer2, Music2, Redo2, Scissors, Search, Trash2, Undo2, Video, X, ZoomIn, ZoomOut } from 'lucide-react';
import { nanoid } from 'nanoid';
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
import { StudioAttachmentPicker } from './studio-attachment-picker';
import { StudioNodeContent } from './studio-node-content';
import { StudioFloatingContext, StudioFloatingPanel } from './studio-floating-panel';
import { StudioWorkspace } from './studio-workspace';
import { StudioFlowImageTools } from './studio-flow-image-tools';
import { studioTaskLabel, studioTaskQueued, studioQueueNotice } from '@/canvas-bridge/studio-task-status';
import { createStudioLinkedNode } from '@/canvas-bridge/studio-linked-inputs';
import { StudioConnectionCreateMenu, type PendingStudioConnection } from './studio-connection-create-menu';

const icons = { image: ImagePlus, video: Video, audio: Music2, text: FileText };
export function StudioFlowCard({ data, selected }: NodeProps<StudioFlowNode>) {
  const node = data.document, meta = node.metadata, Icon = icons[node.type as keyof typeof icons] || FileText;
  if (node.type === CanvasNodeType.Group) return <article className={`studio-flow-group${selected ? ' is-selected' : ''}`} aria-label={`${node.title} · 分组`}>
    {!data.readOnly&&<NodeResizer isVisible={selected} minWidth={220} minHeight={140} onResizeStart={() => window.dispatchEvent(new Event('studio-canvas-checkpoint'))}/>}
    <header className="studio-flow-drag"><Group size={15}/><span>{node.title}</span></header><Handle type="source" position={Position.Right} isConnectable={!data.readOnly} title="拖出连线引用此节点" aria-label="拖出连线引用此节点"/>
  </article>;
  // Template input constraints do not turn a plain text node into a script summary.
  const studioText = node.type === CanvasNodeType.Config || node.type === CanvasNodeType.Text && !!meta?.studio && !meta.studio.templateInput;
  const edit = () => { if(data.readOnly){data.onInspect?.(node);return;} const action=studioNodeCommand(node,true); if(action)dispatchStudioCommand(action,node.id); };
  return <article className={`studio-flow-card${selected ? ' is-selected' : ''}`} aria-label={`${node.title} · ${node.type}`}>
    {!data.readOnly&&<NodeResizer isVisible={selected} minWidth={220} minHeight={140} onResizeStart={() => window.dispatchEvent(new Event('studio-canvas-checkpoint'))}/>}
    <Handle type="target" position={Position.Left} isConnectable={!data.readOnly} title="连接参考节点" aria-label="连接参考节点"/><Handle type="source" position={Position.Right} isConnectable={!data.readOnly} title="拖出连线引用此节点" aria-label="拖出连线引用此节点"/>
    <header className="studio-flow-drag"><Icon size={15}/><span>{node.title}</span>{meta?.status === 'loading' && <small title={studioTaskLabel(meta.studio?.task)}>{studioTaskLabel(meta.studio?.task,true)}</small>}</header>
    <div className={`studio-flow-media ${studioText ? 'studio-flow-business' : ''}`}>
      {studioText ? <div className="nodrag nopan nowheel"><StudioNodeContent node={node} readOnly={data.readOnly}/></div> : node.type === CanvasNodeType.Image && meta?.content ?
        <SignedImage src={meta.content} storageKey={meta.storageKey} alt={node.title}/> : node.type === CanvasNodeType.Video && meta?.content ?
        <SignedVideo className="nodrag nopan" src={meta.content} storageKey={meta.storageKey} controls preload="metadata"/> : node.type === CanvasNodeType.Audio && meta?.content ?
        <div className="studio-flow-audio nodrag nopan"><Music2 size={28}/><SignedAudio src={meta.content} storageKey={meta.storageKey} controls/></div> : node.type === CanvasNodeType.Text ?
        <div className="studio-flow-text nodrag nopan nowheel">{meta?.content || (data.readOnly?'存为个人副本后填写':'双击编辑文字')}</div> :
        <button className="studio-flow-placeholder nodrag nopan" onClick={edit}><Icon size={28}/><span>{data.readOnly?'查看节点设置':meta?.status === 'loading' ? '任务进行中，可继续编辑画布' : `点击创作${node.type === 'video' ? '视频' : node.type==='audio'?'配音':'图片'}`}</span></button>}
    </div>
    {meta?.status === 'loading' && studioTaskQueued(meta.studio?.task) && <p className="studio-flow-queue" aria-label="队列状态">{studioQueueNotice(meta.studio?.task?.queue)}</p>}
    {meta?.status === 'error' && (meta.studio?.task?.errorCode==='IP_RUN_CANCELLED'?<p className="studio-flow-queue">已停止</p>:<p className="studio-flow-node-error" role="alert">{meta.errorDetails || '生成失败，请查看任务'}</p>)}
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
type Snapshot = { nodes: CanvasNodeData[]; connections: CanvasConnection[] };

function FlowWorkspace({ projectId }: { projectId: string }) {
  const project = useCanvasStore(s => s.projects.find(p => p.id === projectId));
  const flow = useReactFlow<StudioFlowNode>(), viewport = useViewport(), { zoom } = viewport, { message } = App.useApp();
  const [selected, setSelected] = useState(new Set<string>()), [hand, setHand] = useState(false), [minimap, setMinimap] = useState(false);
  const [find, setFind] = useState(false), [query, setQuery] = useState(''), [textId, setTextId] = useState<string>(), [renameId, setRenameId] = useState<string>();
  const [textExpanded,setTextExpanded]=useState(false);
  useEffect(()=>{setTextExpanded(false);},[textId]);
  const [referencePick,setReferencePick]=useState(false),referenceOrigin=useRef<string|undefined>(undefined);
  const [pendingFocus, setPendingFocus] = useState<string>(), [selectedEdges, setSelectedEdges] = useState(new Set<string>());
  const [context, setContext] = useState<{ x: number; y: number; nodeId?: string }>();
  const [pendingConnection,setPendingConnection]=useState<PendingStudioConnection>();
  const [pendingCreator,setPendingCreator]=useState<{id:string;sourceId:string;operation:string}>();
  const closeConnectionMenu=useCallback(()=>setPendingConnection(undefined),[]);
  const initialized = useNodesInitialized();
  const [reading, setReading] = useState(false), [historyRevision, refreshHistory] = useState(0);
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
    const restored = next.nodes.map(n => active.has(n.id) ? { ...active.get(n.id)!, position: n.position, width: n.width, height: n.height } : n);
    for (const n of p.nodes) if (studioGenerationPending(n) && !restored.some(r => r.id === n.id)) restored.push(n);
    const ids = new Set(restored.map(n => n.id));
    useCanvasStore.getState().updateProject(projectId, { nodes: restored, connections: next.connections.filter(c => ids.has(c.fromNodeId) && ids.has(c.toNodeId)) });
    setSelected(old => new Set([...old].filter(id => ids.has(id))));
    setSelectedEdges(new Set());
    refreshHistory(v => v + 1);
  }, [current, projectId]);
  const focusNode = useCallback((id: string) => { setSelected(new Set([id])); setSelectedEdges(new Set()); setPendingFocus(id); }, []);
  const connectReference=(source:string,target:string)=>{
    const p=current();if(source===target||!p.nodes.some(n=>n.id===source)||!p.nodes.some(n=>n.id===target)||p.connections.some(c=>c.fromNodeId===source&&c.toNodeId===target))return;
    checkpoint();setConnections(old=>[...old,{id:nanoid(),fromNodeId:source,toNodeId:target}]);
    window.dispatchEvent(new CustomEvent('studio-reference-selected',{detail:{nodeId:source,targetId:target}}));
  };
  useEffect(()=>{
    if(!pendingCreator||!project?.nodes.some(n=>n.id===pendingCreator.id))return;
    const node=project.nodes.find(n=>n.id===pendingCreator.id)!,stage=document.querySelector('.studio-flow-stage')?.getBoundingClientRect();
    if(stage&&(node.position.x*viewport.zoom+viewport.x<76||(node.position.x+node.width)*viewport.zoom+viewport.x>stage.width-16||node.position.y*viewport.zoom+viewport.y<72||(node.position.y+node.height)*viewport.zoom+viewport.y>stage.height-68))
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
  useEffect(() => {
    if (!pendingFocus || !initialized || !flow.viewportInitialized) return;
    const node = project?.nodes.find(n => n.id === pendingFocus); if (!node) return;
    void flow.fitView({ nodes: [{ id: node.id }], padding: .65, maxZoom: 1, duration: 260 });
    setPendingFocus(undefined);
  }, [pendingFocus, initialized, flow, project?.nodes]);
  const closePanel = useCallback(() => { setTextId(undefined); setRenameId(undefined); setContext(undefined); }, []);
  const add = (type: CanvasNodeType, at?: {x:number;y:number}) => {
    checkpoint(); const node = makeStudioNode(type === CanvasNodeType.Video ? 'video' : type === CanvasNodeType.Text ? 'script' : 'image');
    node.type = type; node.title = type === CanvasNodeType.Text ? '文字' : type === CanvasNodeType.Video ? '视频' : '图片';
    if (type === CanvasNodeType.Text) node.metadata = { content: '', status: 'idle' };
    const rect = document.querySelector('.studio-flow-stage')?.getBoundingClientRect();
    node.position = flow.screenToFlowPosition(at || { x: (rect?.left || 0) + (rect?.width || 900) / 2 - 160, y: (rect?.top || 0) + (rect?.height || 700) / 2 - 180 });
    setNodes(old => [...old, placeStudioNode(node,old)]); focusNode(node.id);
    if (type === CanvasNodeType.Text) setTextId(node.id); else dispatchStudioCommand(type, node.id);
  };
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
  const arrange = useCallback(() => { checkpoint(); setNodes(old => arrangeFlowNodes(old, selected.size > 1 ? selected : undefined)); setContext(undefined); requestAnimationFrame(() => void flow.fitView({ padding: .2, duration: 260 })); }, [checkpoint, setNodes, selected, flow]);
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
    const command = (e: Event) => { const detail = (e as CustomEvent<{ action: string; nodeId?: string }>).detail; setContext(undefined); setRenameId(undefined); if (detail.action === 'edit-text') { checkpoint(); setTextId(detail.nodeId); } else setTextId(undefined); };
    const keydown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"],.ant-modal,.ant-drawer,.studio-floating-panel,.studio-flow-reference-menu')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === 'Space') { if((e.target as HTMLElement)?.closest('button'))return;e.preventDefault(); setHand(true); }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); travel(e.shiftKey ? 'future' : 'past'); }
      if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); copy(); }
      if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); paste(); }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); paste(true); }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelected(new Set(current().nodes.map(n => n.id))); }
      if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); group(e.shiftKey); }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void saveStudioDocument(projectId).catch(error => message.error(error.message)); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
      if (e.key === 'Escape') { setSelected(new Set()); setSelectedEdges(new Set()); setFind(false); setTextId(undefined); setContext(undefined); setPendingConnection(undefined); }
    };
    const keyup = (e: KeyboardEvent) => { if (e.code === 'Space') setHand(false); };
    const blur = () => setHand(false);
    window.addEventListener('studio-command', command); window.addEventListener('studio-canvas-checkpoint', checkpoint); window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('studio-reference-mode',referenceMode); window.removeEventListener('studio-command', command); window.removeEventListener('studio-canvas-checkpoint', checkpoint); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
  }, [travel, copy, paste, remove, group, checkpoint, current, projectId, message]);
  const importFiles = async (files: File[]) => {
    if (reading) return; setReading(true); checkpoint(); let last: string | undefined;
    try { for (const file of files) {
      try { const node = await readAssistantAttachment(file, current().nodes, f => importStudioStory(projectId, f), (f, type) => importStudioMedia(projectId, f, type));
        setNodes(old => old.some(n => n.id === node.id) ? old : [...old, node]); last = node.id;
      } catch (e) { message.error(e instanceof Error ? `${file.name}：${e.message}` : '导入失败'); }
    } await saveStudioDocument(projectId); if (last) focusNode(last); } catch (e) { message.error(e instanceof Error ? e.message : '保存失败，请重试'); }
    finally { setReading(false); }
  };
  const graphNodes = useMemo(() => flowNodes(project?.nodes || [], selected), [project?.nodes, selected]);
  const graphEdges = useMemo(() => flowEdges(project?.connections || []).map(e => ({ ...e, type:'reference',selected: selectedEdges.has(e.id) })), [project?.connections, selectedEdges]);
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
  const nodeMenu = target ? [
    { key: 'edit', label: target.type === CanvasNodeType.Group ? '编辑分组名称' : '编辑内容', onClick: () => { if (target.type === CanvasNodeType.Group) { checkpoint(); setRenameId(target.id); } else dispatchStudioCommand(studioNodeCommand(target,true)||'edit-text', target.id); } },
    { key: 'rename', label: '重命名', onClick: () => { checkpoint(); setRenameId(target.id); } },
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
  ];
  return <StudioFloatingContext.Provider value={{viewport,nodes:project.nodes}}><div className="studio-flow-shell" data-history={historyRevision}>
    <header className="studio-flow-header"><a href="/projects" aria-label="返回项目"><ArrowLeft size={18}/></a>
      <Input aria-label="画布名称" variant="borderless" value={project.title} maxLength={80} onChange={e => useCanvasStore.getState().renameProject(projectId, e.target.value)}/>
      <HostActionsSlot/>
    </header>
    <div className={`studio-flow-stage${referencePick?' is-picking-reference':''}`} data-studio-floating-root>
      <ReactFlow<StudioFlowNode> nodes={graphNodes} edges={graphEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={changeNodes} onEdgesChange={changeEdges} onNodeDragStart={checkpoint}
        onConnectStart={()=>{closeConnectionMenu();setContext(undefined);}} onConnectEnd={finishConnection}
        isValidConnection={c=>c.source!==c.target&&!current().connections.some(edge=>edge.fromNodeId===c.source&&edge.toNodeId===c.target)}
        onConnect={c => {if(c.source&&c.target)connectReference(c.source,c.target);}}
        onNodeClick={(event,n)=>{
          if(referencePick){if(referenceOrigin.current)setSelected(new Set([referenceOrigin.current]));window.dispatchEvent(new CustomEvent('studio-reference-selected',{detail:{nodeId:n.id}}));return;}
          if(hand||event.shiftKey||event.metaKey||event.ctrlKey||(event.target as HTMLElement).closest('button,a,input,textarea,audio,video,.react-flow__handle'))return;
          const node=n.data.document;if(node.type==='group')return;
          const action=studioNodeCommand(node);if(action)dispatchStudioCommand(action,n.id);
        }}
        onNodeDoubleClick={(_, n) => { if (n.data.document.type === 'group') { checkpoint(); setRenameId(n.id); } else dispatchStudioCommand(studioNodeCommand(n.data.document,true)||'edit-text', n.id); }}
        onNodeContextMenu={(event, n) => { event.preventDefault(); if (!selected.has(n.id)) setSelected(new Set([n.id])); setContext({ x: event.clientX, y: event.clientY, nodeId: n.id }); }}
        onPaneClick={event => { if(event.detail===2) {setSelected(new Set());setSelectedEdges(new Set());setContext({x:event.clientX,y:event.clientY});} else {setContext(undefined);if(!referencePick)setTextId(undefined);window.dispatchEvent(new Event('studio-dismiss-composer'));} }}
        onPaneContextMenu={event => { event.preventDefault();setSelected(new Set());setSelectedEdges(new Set());setContext({x:event.clientX,y:event.clientY}); }}
        defaultViewport={{ x: project.viewport.x, y: project.viewport.y, zoom: project.viewport.k }}
        onMoveStart={closeConnectionMenu} onMoveEnd={(_, v) => useCanvasStore.getState().updateProject(projectId, { viewport: { x: v.x, y: v.y, k: v.zoom } })}
        panOnDrag={hand ? true : [1, 2]} panOnScroll selectionOnDrag={!hand} selectionMode={SelectionMode.Partial}
        zoomOnScroll={false} zoomOnPinch zoomOnDoubleClick={false} minZoom={.15} maxZoom={2.5} deleteKeyCode={null}
        multiSelectionKeyCode={['Meta', 'Control', 'Shift']} selectionKeyCode={null} panActivationKeyCode={null} snapToGrid snapGrid={[8, 8]}
        nodesDraggable={!hand} defaultEdgeOptions={{ style: { stroke: 'var(--ink-3)', strokeWidth: 1.5 } }}>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--line-3)"/>
        {minimap && <MiniMap pannable zoomable position="bottom-right" nodeColor="var(--paper-2)" maskColor="var(--canvas-mask)"/>}
      </ReactFlow>
      {pendingConnection&&project.nodes.find(n=>n.id===pendingConnection.sourceId)&&<StudioConnectionCreateMenu pending={pendingConnection} source={project.nodes.find(n=>n.id===pendingConnection.sourceId)!} viewport={viewport} onClose={closeConnectionMenu} onCreate={createReference}/>}
      <nav className="studio-flow-tools" aria-label="画布工具">
        <button title="选择工具" aria-label="选择工具" aria-pressed={!hand} onClick={() => setHand(false)}><MousePointer2 size={19}/></button>
        <button title="拖动画布" aria-label="拖动画布" aria-pressed={hand} onClick={() => setHand(v => !v)}><Hand size={19}/></button><hr/>
        <button title="添加文字" aria-label="添加文字" onClick={() => add(CanvasNodeType.Text)}><FileText size={19}/></button>
        <button title="添加图片节点" aria-label="添加图片节点" onClick={() => add(CanvasNodeType.Image)}><ImagePlus size={19}/></button>
        <button title="添加视频节点" aria-label="添加视频节点" onClick={() => add(CanvasNodeType.Video)}><Video size={19}/></button>
        <button title="画布配音" aria-label="画布配音" onClick={() => dispatchStudioCommand('speech')}><Music2 size={19}/></button>
        <button title="查找节点" aria-label="查找节点" aria-pressed={find} onClick={() => setFind(v => !v)}><Search size={19}/></button>
        <button title="整理画布" aria-label="整理画布" onClick={arrange}><LayoutGrid size={19}/></button>
        <Dropdown menu={{ items: nodeMenu }} trigger={['click']} disabled={!selected.size}><button title="更多节点操作" aria-label="更多节点操作" disabled={!selected.size}><Ellipsis size={19}/></button></Dropdown>
        <button title="复制选中节点" aria-label="复制选中节点" disabled={!selected.size} onClick={() => paste(true)}><Copy size={19}/></button>
        <button title="删除选中节点" aria-label="删除选中节点" disabled={!selected.size && !selectedEdges.size} onClick={remove}><Trash2 size={19}/></button>
        <StudioAttachmentPicker locked={reading} reading={reading} onFiles={files => void importFiles(files)} onAssets={async assets => {
          checkpoint(); let last: string | undefined; for (const asset of assets) { const n = attachmentNode(savedAssetPayload(asset), current().nodes); setNodes(old => old.some(x => x.id === n.id) ? old : [...old, n]); last = n.id; }
          await saveStudioDocument(projectId); if (last) focusNode(last);
        }}/>
      </nav>
      <div className="studio-flow-controls" aria-label="视图控制"><button title="撤销" aria-label="撤销" disabled={!history.current.past.length} onClick={() => travel('past')}><Undo2 size={17}/></button><button title="重做" aria-label="重做" disabled={!history.current.future.length} onClick={() => travel('future')}><Redo2 size={17}/></button><hr/>
        <button title="缩小画布" aria-label="缩小画布" onClick={() => void flow.zoomOut()}><ZoomOut size={17}/></button><span>{Math.round(zoom * 100)}%</span><button title="放大画布" aria-label="放大画布" onClick={() => void flow.zoomIn()}><ZoomIn size={17}/></button>
        <button title="适应全部节点" aria-label="适应全部节点" onClick={() => void flow.fitView({ padding: .2, duration: 260 })}><Maximize size={17}/></button><button aria-pressed={minimap} onClick={() => setMinimap(v => !v)}>小地图</button>
      </div>
      {selected.size > 1 && <div className="studio-flow-selection"><span>已选择 {selected.size} 个节点</span><button title="建立分组" aria-label="建立分组" disabled={!canGroupSelectedNodes(selected,project.nodes)} onClick={() => group()}><Group size={16}/></button><button title="整理选中节点" aria-label="整理选中节点" onClick={arrange}><LayoutGrid size={16}/></button><button title="复制选中节点" aria-label="复制选中节点" onClick={() => paste(true)}><Copy size={16}/></button><button title="删除选中节点" aria-label="删除选中节点" onClick={remove}><Trash2 size={16}/></button></div>}
      {context && <div className="studio-flow-context" style={{ left: Math.min(context.x, window.innerWidth - 200), top: Math.min(context.y, window.innerHeight - 330) }}>{(context.nodeId?nodeMenu:paneMenu).map(item => <button key={item.key} onClick={() => { item.onClick(); setContext(undefined); }}>{item.label}</button>)}</div>}
      {find && <aside className="studio-flow-find"><header><strong>查找节点</strong><button title="关闭节点查找" aria-label="关闭节点查找" onClick={() => setFind(false)}><X size={16}/></button></header><Input autoFocus aria-label="搜索画布节点" placeholder="搜索名称或提示词" value={query} onChange={e => setQuery(e.target.value)}/>{project.nodes.filter(n => `${n.title} ${n.metadata?.prompt || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(n => <button key={n.id} onClick={() => focusNode(n.id)}>{n.title}</button>)}</aside>}
    </div>
    <StudioWorkspace projectId={projectId} nodes={project.nodes} connections={project.connections} selectedNodeIds={selected} setNodes={setNodes} setConnections={setConnections}
      onFocusNode={focusNode} onClosePanel={closePanel} onRestorePanel={id=>setSelected(new Set([id]))}/>
    <StudioFlowImageTools nodes={project.nodes} onInsert={async (nodes, connections) => {
      checkpoint(); const p = current(), placed=[...p.nodes];
      // Crop, split and redraw share the same collision avoidance as other automatic additions.
      for(const node of nodes)placed.push(placeStudioNode(node,placed));
      useCanvasStore.getState().updateProject(projectId, { nodes: placed, connections: [...p.connections, ...connections] });
      focusNode(nodes[nodes.length - 1].id);
      // The inserted result survives a save failure; closing the editor prevents re-uploading it on retry.
      try { await saveStudioDocument(projectId); } catch (e) { message.error(e instanceof Error ? `${e.message}；编辑结果已保留，可按 Ctrl/Cmd+S 重试保存` : '编辑结果已保留，请重试保存画布'); }
    }}/>
    <Modal title="重命名节点" open={!!named} onCancel={() => setRenameId(undefined)} footer={<Button type="primary" onClick={() => setRenameId(undefined)}>完成</Button>} getContainer={() => document.querySelector<HTMLElement>('.ip-surface') || document.body}>
      <Input aria-label="节点名称" value={named?.title || ''} maxLength={128} onChange={e => setNodes(old => old.map(n => n.id === renameId ? { ...n, title: e.target.value } : n))}/>
    </Modal>
    <StudioFloatingPanel title="编辑文字" anchorId={textId} open={!!text&&!textExpanded} footer={<><Button onClick={()=>setTextExpanded(true)}>展开编辑</Button><Button type="primary" onClick={() => setTextId(undefined)}>完成</Button></>} onClose={() => setTextId(undefined)}>
      <Input.TextArea aria-label="节点文字" rows={5} value={text?.metadata?.content || ''} onChange={e => setNodes(old => old.map(n => n.id === textId ? { ...n, metadata: { ...n.metadata, content: e.target.value } } : n))}/>
    </StudioFloatingPanel>
    <Modal title="展开文字编辑" open={!!text&&textExpanded} width={960} onCancel={()=>setTextExpanded(false)} footer={<Button type="primary" onClick={()=>setTextExpanded(false)}>收起编辑</Button>} getContainer={()=>document.querySelector<HTMLElement>('.ip-surface')||document.body}>
      <Input.TextArea aria-label="展开节点文字" rows={18} value={text?.metadata?.content||''} onChange={e=>setNodes(old=>old.map(n=>n.id===textId?{...n,metadata:{...n.metadata,content:e.target.value}}:n))}/>
    </Modal>
  </div></StudioFloatingContext.Provider>;
}
export default function StudioFlowCanvas({ projectId }: { projectId: string }) {
  return <ReactFlowProvider><FlowWorkspace key={projectId} projectId={projectId}/></ReactFlowProvider>;
}
