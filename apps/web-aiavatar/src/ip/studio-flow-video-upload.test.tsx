// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';
import StudioFlowCanvas from './studio-flow-canvas';
const api=vi.hoisted(()=>({upload:vi.fn(),save:vi.fn(),error:vi.fn(),success:vi.fn(),info:vi.fn()}));
vi.mock('@/canvas-bridge/studio-api',()=>({importStudioMedia:api.upload,importStudioStory:vi.fn()}));
vi.mock('@/canvas-bridge/studio-save',()=>({saveStudioDocument:api.save}));
vi.mock('./studio-errors',()=>({useStudioApp:()=>({message:{error:api.error,success:api.success,info:api.info}}),StudioErrorNotice:()=>null}));
vi.mock('@/proto/api',()=>({useIdentity:()=>({})}));
vi.mock('@/shell/wallet-badge',()=>({WalletBadge:()=>null}));
vi.mock('@/canvas-bridge/host-actions',()=>({HostActionsSlot:()=>null}));
vi.mock('@/canvas-bridge/template-projection',()=>({useTemplateProjection:()=>{}}));
vi.mock('@/canvas-bridge/flow-legacy-tasks',()=>({useFlowLegacyTasks:()=>{}}));
vi.mock('./studio-workspace',()=>({StudioWorkspace:()=>null}));
vi.mock('./studio-flow-image-tools',()=>({StudioFlowImageTools:()=>null}));
vi.mock('./studio-attachment-picker',()=>({StudioAttachmentPicker:()=>null}));
vi.mock('@/canvas-bridge/signed-video',()=>({SignedVideo:({storageKey,...props}:any)=><video {...props}/>}));
vi.mock('@xyflow/react',()=>{
 const viewport={x:0,y:0,zoom:1},flow={viewportInitialized:true,fitView:vi.fn(),screenToFlowPosition:(p:any)=>p,getInternalNode:(id:string)=>({id})};
 return {ReactFlowProvider:({children}:any)=>children,ReactFlow:({nodes,nodeTypes,onNodeClick,onNodeContextMenu}:any)=><div>{nodes.map((n:any)=>{const Card=nodeTypes.studio;return <div key={n.id} data-testid={`card-${n.id}`} onClick={e=>onNodeClick(e,n)} onContextMenu={e=>onNodeContextMenu(e,n)}><Card data={n.data} selected/></div>;})}</div>,
 useReactFlow:()=>flow,useViewport:()=>viewport,Background:()=>null,MiniMap:()=>null,Handle:()=>null,NodeResizer:()=>null,
 Position:{Right:'right',Left:'left'},SelectionMode:{Partial:'partial'},BackgroundVariant:{Dots:'dots'}};
});
beforeEach(()=>{
 vi.clearAllMocks();api.save.mockResolvedValue('saved');
 useCanvasStore.setState({projects:[{id:'p',title:'上传验收',nodes:[{id:'source',title:'参考视频',type:'video',position:{x:0,y:0},width:360,height:270,metadata:{status:'idle'}}],connections:[],viewport:{x:0,y:0,k:1}} as any]});
});
afterEach(cleanup);
test('the node picker uploads video, shows pending state and saves a reusable source in that same node',async()=>{
 let resolve!:(v:any)=>void;api.upload.mockImplementation(()=>new Promise(r=>resolve=r));
 render(<StudioFlowCanvas projectId="p"/>);
 const picker=screen.getByLabelText('上传节点视频');const click=vi.spyOn(picker,'click');
 fireEvent.click(screen.getByRole('button',{name:'上传视频'}));expect(click).toHaveBeenCalledOnce();
 const file=new File(['video'],'我的视频.mp4',{type:'video/mp4'});fireEvent.change(picker,{target:{files:[file]}});
 await waitFor(()=>expect(api.upload).toHaveBeenCalledWith('p',file,'video'));
 expect(screen.getByRole('button',{name:'上传处理中…'})).toHaveProperty('disabled',true);
 resolve({key:'own/video.mp4',url:'/video.mp4',mediaType:'video',mimeType:'video/mp4',bytes:5,width:720,height:1280,durationSec:15});
 await waitFor(()=>expect(api.save).toHaveBeenCalledWith('p'));
 const nodes=useCanvasStore.getState().projects[0].nodes;
 expect(nodes).toHaveLength(1);expect(nodes[0]).toMatchObject({id:'source',metadata:{storageKey:'own/video.mp4',durationMs:15000}});
 expect(screen.getByRole('button',{name:'替换视频'})).toBeDefined();expect(api.error).not.toHaveBeenCalled();
});
test('a rejected upload keeps the empty slot available for retry without saving or generating',async()=>{
 api.upload.mockRejectedValue(new Error('temporary upload failure'));
 render(<StudioFlowCanvas projectId="p"/>);fireEvent.click(screen.getByRole('button',{name:'上传视频'}));
 fireEvent.change(screen.getByLabelText('上传节点视频'),{target:{files:[new File(['x'],'my.mp4')]}});
 await waitFor(()=>expect(api.error).toHaveBeenCalled());expect(api.save).not.toHaveBeenCalled();
 expect(useCanvasStore.getState().projects[0].nodes[0].metadata?.storageKey).toBeUndefined();
 expect(screen.getByRole('button',{name:'上传视频'})).toHaveProperty('disabled',false);
});

test('right-click only opens the menu; left-click clears it and requests the node editor',()=>{
 const commands=vi.fn(),dismiss=vi.fn();
 window.addEventListener('studio-command',commands);window.addEventListener('studio-node-context-menu',dismiss);
 try {
  render(<StudioFlowCanvas projectId="p"/>);
  fireEvent.contextMenu(screen.getByTestId('card-source'),{button:2,clientX:100,clientY:100});
  expect(screen.getByRole('button',{name:'编辑内容'})).toBeDefined();
  expect(dismiss).toHaveBeenCalledOnce();expect(commands).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('card-source'),{button:0});
  expect(screen.queryByRole('button',{name:'编辑内容'})).toBeNull();
  expect(commands).toHaveBeenCalledOnce();expect(commands.mock.calls[0][0].detail).toEqual({action:'video',nodeId:'source'});
 } finally {window.removeEventListener('studio-command',commands);window.removeEventListener('studio-node-context-menu',dismiss);}
});
