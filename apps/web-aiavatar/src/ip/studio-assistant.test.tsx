// @vitest-environment jsdom
import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { mountStudioErrorNotifications } from './testing/studio-notification-harness';

import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {ApiError} from '@ai-star-eco/api-client';
import {StudioAssistant} from './studio-assistant';
import {splitStudioConversations} from '@/canvas-bridge/studio-conversations';
import type {CanvasNodeData} from '@/canvas/types/canvas';
const api=vi.hoisted(()=>({importStudioStory:vi.fn(),importStudioMedia:vi.fn(),submitStudioRun:vi.fn(),saveStudioDocument:vi.fn(),readRun:vi.fn(),success:vi.fn(),error:vi.fn()}));
vi.mock('./studio-floating-panel',()=>({StudioFloatingPanel:({open,title,children,onClose,footer}:any)=>open?<section role="dialog" aria-label={title}><button aria-label={title==='生成视频'||title==='生成图片'||title==='创作剧本'||title==='拆分镜头'?'关闭创作面板':`关闭${title}`} onClick={onClose}>关闭</button>{children}{footer}</section>:null}));
vi.mock('@/canvas-bridge/studio-api',()=>({importStudioStory:api.importStudioStory,importStudioMedia:api.importStudioMedia,submitStudioRun:api.submitStudioRun}));
vi.mock('@/canvas-bridge/studio-save',()=>({saveStudioDocument:api.saveStudioDocument}));
vi.mock('@/canvas-bridge/api',()=>({readRun:api.readRun}));
vi.mock('./studio-conversation-share',()=>({StudioConversationShare:()=>null}));
vi.mock('./studio-attachment-picker',()=>({StudioAttachmentPicker:({locked,reading,onFiles,onAssets}:any)=><div><button disabled={locked}>{reading?'正在导入附件':'添加附件'}</button><input type="file" aria-label="上传创作附件" multiple onChange={e=>onFiles(Array.from(e.target.files||[]))}/><button disabled={locked} onClick={()=>void onAssets([{id:'saved-c',kind:'image',title:'已存角色',data:{storageKey:'own',dataUrl:'/own'}}]).catch(()=>{})}>测试素材库添加</button></div>}));
vi.mock('./library-reference-picker',()=>({LibraryReferencePicker:()=>null}));
vi.mock('antd',()=>({App:{useApp:()=>({message:{success:api.success,error:api.error}})},Drawer:({open,children}:any)=>open?<div role="dialog">{children}</div>:null,
  Button:({loading,icon,...p}:any)=><button {...p} disabled={p.disabled||loading}>{icon}{p.children}</button>,
  Input:{TextArea:forwardRef(({autoSize,...p}:any,ref)=>{const el=useRef<HTMLTextAreaElement>(null);useImperativeHandle(ref,()=>({focus:()=>el.current?.focus()}));return <textarea ref={el} {...p}/>;})},
  Select:({options,value,allowClear,placeholder,onChange,...p}:any)=><select {...p} value={value||''} onChange={e=>onChange(e.target.value||undefined)}><option value="">{placeholder}</option>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>}));
function settingsControl(role:string,name:string) {
  const toggle=screen.getByRole('button',{name:'创作设置与历史'});
  if(toggle.getAttribute('aria-expanded')!=='true')fireEvent.click(toggle);
  return screen.getByRole(role,{name});
}
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();api.saveStudioDocument.mockResolvedValue(undefined);api.submitStudioRun.mockResolvedValue({id:'run',status:'done',output:{plan:{summary:'先整理故事',steps:[],questions:[]}}});});
const character={id:'c',type:'image',title:'角色 A',position:{x:20,y:20},width:320,height:400,metadata:{prompt:'紫发角色'}} as CanvasNodeData;
const text={...character,id:'t',type:'text',title:'故事 B',metadata:{content:'在森林里相遇'}} as CanvasNodeData;
const history={...text,id:'h',title:'导演执导',metadata:{studio:{kind:'assistant',request:{clientRequestId:'old',nodeId:'h',operation:'assistant',prompt:'讨论',contextNodeIds:['t'],model:'two',maxCost:2},conversation:{mode:'director',turns:[{role:'user',content:'讨论'},{role:'assistant',content:'建议'}]}}}} as CanvasNodeData;
function Host({initial=[character,text,history],onSnapshot,onCanvasSnapshot,...p}:any){const split=splitStudioConversations(initial);const[nodes,setNodes]=useState<CanvasNodeData[]>(split.nodes),[conversations,setConversations]=useState<CanvasNodeData[]>(split.assistantConversations);useEffect(()=>{onSnapshot?.([...nodes,...conversations]);onCanvasSnapshot?.(nodes,conversations);},[nodes,conversations,onSnapshot,onCanvasSnapshot]);return <StudioAssistant projectId="p" open conversations={conversations} setConversations={setConversations} nodes={nodes} setNodes={setNodes} setConnections={()=>{}} capabilities={{mock:false,operations:['assistant'],imageCost:8,textCost:2,videoCost:null,textModels:[{endpointId:'one',name:'模型一',isDefault:true,tokenPricing:{inputCreditsPerK:0.18,outputCreditsPerK:1.08,maxInputTokens:65536,maxOutputTokens:8192,maxCost:21}},{endpointId:'two',name:'模型二',isDefault:false,tokenPricing:{inputCreditsPerK:0.18,outputCreditsPerK:1.08,maxInputTokens:65536,maxOutputTokens:8192,maxCost:21}}]}} onClose={()=>{}} selectedIds={['c']} onUseStep={()=>{}} {...p}/>;}
test('history restores its exact reference and model before sending the next turn',async()=>{
  render(<Host/>);fireEvent.change(settingsControl('combobox','对话历史'),{target:{value:'h'}});
  expect(screen.getByRole('button',{name:'移除引用 故事 B'})).toBeDefined();expect(screen.queryByRole('button',{name:'移除引用 角色 A'})).toBeNull();
  expect((settingsControl('combobox','助手模型') as HTMLSelectElement).value).toBe('two');
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'继续讨论'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledOnce());expect(api.submitStudioRun.mock.calls[0][1]).toMatchObject({nodeId:'h',contextNodeIds:['t'],model:'two',mode:'director',prompt:'继续讨论',history:[{role:'user',content:'讨论'},{role:'assistant',content:'建议'}]});
});
const visualCapabilities={mock:false,operations:['assistant'],imageCost:8,textCost:2,videoCost:null,textModels:[{endpointId:'vision',name:'看图模型',isDefault:true,supportsVision:true,tokenPricing:{inputCreditsPerK:0.18,outputCreditsPerK:1.08,maxInputTokens:65536,maxOutputTokens:8192,maxCost:21}},{endpointId:'text',name:'文字模型',isDefault:false,supportsVision:false,tokenPricing:{inputCreditsPerK:0.18,outputCreditsPerK:1.08,maxInputTokens:65536,maxOutputTokens:8192,maxCost:21}}]};
test('a copied conversation opens with its history, no source bindings and a fresh submission',async()=>{
  const copied={...history,id:'copy',metadata:{status:'idle',studioStart:'assistant',studio:{kind:'assistant',conversation:history.metadata!.studio!.conversation}}} as CanvasNodeData;
  render(<Host initial={[copied]} initialNodeId="copy" selectedIds={['copy']}/>);
  expect(screen.getByText('建议')).toBeDefined();expect(screen.queryByText('已删除的画布对象')).toBeNull();
  expect(screen.queryByRole('button',{name:/移除引用/})).toBeNull();
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'继续这个对话'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledOnce());
  expect(api.submitStudioRun.mock.calls[0][1]).toMatchObject({nodeId:'copy',contextNodeIds:[],model:'one',history:history.metadata!.studio!.conversation!.turns});
  expect(api.submitStudioRun.mock.calls[0][1].clientRequestId).not.toBe('old');
});
test('new conversations exclude selected conversation nodes while preserving valid media references',async()=>{
  render(<Host selectedIds={['h','c']} capabilities={visualCapabilities}/>);
  expect(screen.queryByText('已删除的画布对象')).toBeNull();
  expect(screen.getByRole('button',{name:'移除引用 角色 A'})).toBeDefined();
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'讨论所选角色'}});
  fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledOnce());
  expect(api.submitStudioRun.mock.calls[0][1].contextNodeIds).toEqual(['c']);
});
test('visual mode is explicit, labels actual reading and sends the chosen reading mode',async()=>{
  const video={...character,id:'v',type:'video',title:'短片'},audio={...character,id:'a',type:'audio',title:'配音'};
  render(<Host capabilities={visualCapabilities} initial={[character,video,audio]} selectedIds={['c','v','a']}/>);
  const check=settingsControl('checkbox','读取图片与视频画面') as HTMLInputElement;expect(check.checked).toBe(true);
  expect(screen.getByText(/视频 4 帧/)).toBeDefined();expect(screen.getByText(/音频只读取文字设定/)).toBeDefined();
  fireEvent.click(check);expect(check.checked).toBe(false);fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'只讨论设定'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledOnce());expect(api.submitStudioRun.mock.calls[0][1].readVisuals).toBe(false);
});
test('visual history restores exact reading intent and unsupported models visibly become text-only',async()=>{
  const saved={...history,metadata:{...history.metadata,studio:{...history.metadata!.studio!,request:{...history.metadata!.studio!.request!,model:'vision',readVisuals:true}}}};
  render(<Host capabilities={visualCapabilities} initial={[character,text,saved]} initialNodeId="h"/>);
  const check=settingsControl('checkbox','读取图片与视频画面') as HTMLInputElement;expect(check.checked).toBe(true);
  fireEvent.change(settingsControl('combobox','助手模型'),{target:{value:'text'}});expect(check.disabled).toBe(true);expect(check.checked).toBe(false);expect(screen.getByText(/当前模型仅读取文字和设定/)).toBeDefined();
  fireEvent.change(settingsControl('combobox','助手模型'),{target:{value:'vision'}});expect(check.checked).toBe(true);
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'看图讨论'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledOnce());expect(api.submitStudioRun.mock.calls[0][1]).toMatchObject({readVisuals:true,model:'vision'});
});
test('a vision preflight rejection preserves the draft and can be corrected without recovering an unknown request',async()=>{
  api.submitStudioRun.mockRejectedValueOnce(new ApiError({code:'STUDIO_VISUAL_MISSING',message:'所选对象还没有可读画面'},400));render(<Host capabilities={visualCapabilities}/>);
  const input=screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement;fireEvent.change(input,{target:{value:'看图分析'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('没有可读画面'));
  expect(input.value).toBe('看图分析');expect(screen.queryByRole('button',{name:'确认原对话任务'})).toBeNull();fireEvent.click(settingsControl('checkbox','读取图片与视频画面'));fireEvent.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledTimes(2));expect(api.submitStudioRun.mock.calls[1][1].readVisuals).toBe(false);expect(api.submitStudioRun.mock.calls[1][1].clientRequestId).not.toBe(api.submitStudioRun.mock.calls[0][1].clientRequestId);
});
test('keyboard @ selection adds one exact reference and removal changes the submitted IDs',async()=>{
  render(<Host/>);const input=screen.getByRole('textbox',{name:'给创作助手的消息'});
  fireEvent.change(input,{target:{value:'@故事',selectionStart:3}});fireEvent.keyDown(input,{key:'Enter'});
  expect((input as HTMLTextAreaElement).value).toBe('@故事 B ');expect(screen.getByRole('button',{name:'移除引用 故事 B'})).toBeDefined();
  fireEvent.change(input,{target:{value:'@故事 B 继续改编',selectionStart:10}});expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'移除引用 角色 A'}));fireEvent.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledOnce());expect(api.submitStudioRun.mock.calls[0][1].contextNodeIds).toEqual(['t']);
});
test('a deleted reference blocks submission until explicitly removed',()=>{
  render(<Host initial={[character,{...history,metadata:{...history.metadata,studio:{...history.metadata!.studio!,request:{...history.metadata!.studio!.request!,contextNodeIds:['missing']}}}}]} initialNodeId="h"/>);
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'继续'}});expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('已从画布删除');expect((screen.getByRole('button',{name:'发送'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'移除引用 missing'}));expect((screen.getByRole('button',{name:'发送'}) as HTMLButtonElement).disabled).toBe(false);
});
test('story attachment is saved and its node ID is submitted; save failure retains a retryable source',async()=>{
  api.saveStudioDocument.mockRejectedValueOnce(new Error('保存失败，请重试'));render(<Host/>);
  const file=new File(['角色在森林相遇'],'原作.txt',{type:'text/plain'});Object.defineProperty(file,'arrayBuffer',{value:async()=>new TextEncoder().encode('角色在森林相遇').buffer});
  fireEvent.change(screen.getByLabelText('上传创作附件'),{target:{files:[file]}});await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('保存失败'));
  expect(screen.getByRole('button',{name:'移除引用 原作'})).toBeDefined();fireEvent.click(screen.getByRole('button',{name:'重试保存附件'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'重试保存附件'})).toBeNull());fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'改编这个原作'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledOnce());expect(api.saveStudioDocument).toHaveBeenCalledTimes(4);expect(api.submitStudioRun.mock.calls[0][1].contextNodeIds).toHaveLength(2);
});
test('pending recovery reuses the accepted request rather than the edited draft',async()=>{
  const pending={...history,metadata:{...history.metadata,status:'loading'}};render(<Host initial={[character,text,pending]} initialNodeId="h"/>);
  expect((screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'确认原对话任务'}));await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledOnce());expect(api.submitStudioRun.mock.calls[0][1]).toEqual(history.metadata!.studio!.request);
});
test('document text is imported, saved and referenced without sending a paid message',async()=>{
  api.importStudioStory.mockResolvedValueOnce({text:'第一场\n小鹿来到森林。',format:'docx'});
  let snapshot:CanvasNodeData[]=[];render(<Host onSnapshot={(nodes:CanvasNodeData[])=>{snapshot=nodes;}}/>);
  fireEvent.change(screen.getByLabelText('上传创作附件'),{target:{files:[new File(['bytes'],'森林原作.docx')]}});
  await waitFor(()=>expect(api.success).toHaveBeenCalled());
  expect(api.importStudioStory.mock.calls[0][0]).toBe('p');expect(api.saveStudioDocument).toHaveBeenCalledOnce();expect(api.submitStudioRun).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'移除引用 森林原作'})).toBeDefined();expect(snapshot.find(n=>n.title==='森林原作')?.metadata?.content).toBe('第一场\n小鹿来到森林。');
});
test('reading locks the composer and a failed extraction preserves the original draft and references',async()=>{
  let reject!:(error:Error)=>void;api.importStudioStory.mockImplementationOnce(()=>new Promise((_resolve,r)=>{reject=r;}));
  let snapshot:CanvasNodeData[]=[];render(<Host onSnapshot={(nodes:CanvasNodeData[])=>{snapshot=nodes;}}/>);
  const input=screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement;fireEvent.change(input,{target:{value:'保留我的改编想法'}});
  fireEvent.change(screen.getByLabelText('上传创作附件'),{target:{files:[new File(['bytes'],'扫描件.pdf')]}});
  expect(input.disabled).toBe(true);expect(screen.getByRole('button',{name:'正在导入附件'})).toBeDefined();reject(new Error('扫描件请先识别文字'));
  await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('扫描件'));
  expect(input.value).toBe('保留我的改编想法');expect(input.disabled).toBe(false);expect(snapshot).toHaveLength(3);expect(screen.getByRole('button',{name:'移除引用 角色 A'})).toBeDefined();
  expect(api.saveStudioDocument).not.toHaveBeenCalled();expect(api.submitStudioRun).not.toHaveBeenCalled();
});
test('an extraction finishing after the assistant is unmounted never writes a canvas',async()=>{
  let resolve!:(value:{text:string;format:string})=>void;api.importStudioStory.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const host=render(<Host/>);fireEvent.change(screen.getByLabelText('上传创作附件'),{target:{files:[new File(['bytes'],'原作.pdf')]}});host.unmount();
  resolve({text:'原作正文',format:'pdf'});await Promise.resolve();await Promise.resolve();expect(api.saveStudioDocument).not.toHaveBeenCalled();
});
test('a definite context-limit rejection restores draft, references and previous turns for editing',async()=>{
  api.submitStudioRun.mockRejectedValueOnce(new ApiError({code:'STUDIO_CONTEXT_LIMIT',message:'画布上下文过长，请减少引用或按集创作'},400));
  const chapters=Array.from({length:3},(_,i)=>({...text,id:`chapter-${i}`,title:`章节 ${i+1}`,metadata:{content:'字'.repeat(20010)}}));
  render(<Host initial={[...chapters,text,history]} initialNodeId="h"/>);
  fireEvent.click(settingsControl('button','感知画布'));
  const input=screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement;
  fireEvent.change(input,{target:{value:'讨论这三份长故事'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('上下文过长'));
  await waitFor(()=>expect((screen.getByRole('button',{name:'移除引用 章节 3'}) as HTMLButtonElement).disabled).toBe(false));
  expect(input.value).toBe('讨论这三份长故事');expect(input.disabled).toBe(false);
  expect(screen.queryByRole('button',{name:'确认原对话任务'})).toBeNull();expect(screen.getByText('建议')).toBeDefined();
  expect(screen.queryByText('讨论这三份长故事',{selector:'.studio-turn p'})).toBeNull();
  expect((settingsControl('combobox','助手模型') as HTMLSelectElement).disabled).toBe(false);
  const rejectedRequest=api.submitStudioRun.mock.calls[0][1];
  fireEvent.click(screen.getByRole('button',{name:'移除引用 章节 3'}));fireEvent.change(input,{target:{value:'只讨论前两章'}});
  fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledTimes(2));
  expect(api.submitStudioRun.mock.calls[1][1]).toMatchObject({prompt:'只讨论前两章',contextNodeIds:['chapter-0','chapter-1','t'],history:history.metadata!.studio!.conversation!.turns});
  expect(api.submitStudioRun.mock.calls[1][1].clientRequestId).not.toBe(rejectedRequest.clientRequestId);
});
test('an unknown network outcome keeps the draft locked and recovers the exact original request',async()=>{
  api.submitStudioRun.mockRejectedValueOnce(new TypeError('Failed to fetch'));render(<Host/>);
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'继续讨论角色'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(api.error).toHaveBeenCalledWith('Failed to fetch'));
  expect((screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement).disabled).toBe(true);
  expect((screen.getByRole('button',{name:'移除引用 角色 A'}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('避免重复提交');const original=api.submitStudioRun.mock.calls[0][1];
  fireEvent.click(screen.getByRole('button',{name:'确认原对话任务'}));await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledTimes(2));
  expect(api.submitStudioRun.mock.calls[1][1]).toEqual(original);
});
test('save failure before a new submission restores its draft without submitting a run',async()=>{
  api.saveStudioDocument.mockRejectedValueOnce(new Error('画布保存失败'));render(<Host/>);
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'先讨论故事'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('画布保存失败'));
  await waitFor(()=>expect((screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement).disabled).toBe(false));
  expect((screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement).value).toBe('先讨论故事');expect(api.submitStudioRun).not.toHaveBeenCalled();
});
test('save failure during recovery keeps the potentially accepted request pending',async()=>{
  api.saveStudioDocument.mockRejectedValueOnce(new Error('画布保存失败'));
  render(<Host initial={[text,{...history,metadata:{...history.metadata,status:'loading'}}]} initialNodeId="h"/>);
  fireEvent.click(screen.getByRole('button',{name:'确认原对话任务'}));await waitFor(()=>expect(api.error).toHaveBeenCalledWith('画布保存失败'));
  expect((screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement).disabled).toBe(true);expect(api.submitStudioRun).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'确认原对话任务'}));await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledOnce());
  expect(api.submitStudioRun.mock.calls[0][1]).toEqual(history.metadata!.studio!.request);
});
test('a rejected new turn restores all 16 visible messages and the previous plan',async()=>{
  const previous={mode:'director' as const,turns:Array.from({length:16},(_,i)=>({role:i%2?'assistant' as const:'user' as const,content:`原消息 ${i}`})),plan:{summary:'已有建议',questions:['保留之前的节奏建议'],steps:[]}};
  api.submitStudioRun.mockRejectedValueOnce(new ApiError({code:'STUDIO_CONTEXT_LIMIT',message:'上下文过长'},400));
  render(<Host initial={[text,{...history,metadata:{studio:{...history.metadata!.studio!,conversation:previous}}}]} initialNodeId="h"/>);
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'新一轮讨论'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('上下文过长'));
  expect(screen.getByText('原消息 0')).toBeDefined();expect(screen.getByText('原消息 1')).toBeDefined();expect(screen.getByText('原消息 15')).toBeDefined();
  expect(screen.getByText('保留之前的节奏建议')).toBeDefined();expect(api.submitStudioRun.mock.calls[0][1].history).toHaveLength(14);
});
test('recovery rejection restores the full previous conversation from its persisted snapshot',async()=>{
  const previous={mode:'director' as const,turns:Array.from({length:16},(_,i)=>({role:i%2?'assistant' as const:'user' as const,content:`已存消息 ${i}`})),plan:{summary:'已存建议',questions:['已存节奏建议'],steps:[]}};
  let actualNodes:CanvasNodeData[]=[];
  api.submitStudioRun.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockRejectedValueOnce(new ApiError({code:'STUDIO_CONTEXT_LIMIT',message:'上下文过长'},400));
  const first=render(<Host initial={[text,{...history,metadata:{studio:{...history.metadata!.studio!,conversation:previous}}}]} onSnapshot={(nodes:CanvasNodeData[])=>{actualNodes=nodes;}} initialNodeId="h"/>);
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'待确认消息'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(api.error).toHaveBeenCalledWith('Failed to fetch'));
  const persisted=JSON.parse(JSON.stringify(actualNodes));const request=api.submitStudioRun.mock.calls[0][1];
  expect(persisted.find((n:CanvasNodeData)=>n.id==='h').metadata.studio.assistantPreviousConversation).toEqual(previous);
  first.unmount();render(<Host initial={persisted} initialNodeId="h"/>);fireEvent.click(screen.getByRole('button',{name:'确认原对话任务'}));
  await waitFor(()=>expect((screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement).disabled).toBe(false));
  expect(screen.getByText('已存消息 0')).toBeDefined();expect(screen.getByText('已存消息 1')).toBeDefined();expect(screen.getByText('已存消息 15')).toBeDefined();expect(screen.getByText('已存节奏建议')).toBeDefined();
  expect((screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement).value).toBe('待确认消息');expect(api.submitStudioRun.mock.calls[1][1]).toEqual(request);
  expect(screen.queryByText('待确认消息',{selector:'.studio-turn p'})).toBeNull();
});

test('mixed files retain successes and draft after one failure, without calling a model',async()=>{
  api.importStudioMedia.mockResolvedValueOnce({key:'media/video',url:'/video.mp4',mediaType:'video',fileName:'参考片.mp4',mimeType:'video/mp4',bytes:12,width:640,height:360,durationSec:4});
  api.importStudioStory.mockRejectedValueOnce(new Error('扫描件需识别文字')).mockResolvedValueOnce({text:'保留的章节'});
  let snapshot:CanvasNodeData[]=[];render(<Host onSnapshot={(nodes:CanvasNodeData[])=>snapshot=nodes}/>);
  const input=screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement;fireEvent.change(input,{target:{value:'我的想法'}});
  fireEvent.change(screen.getByLabelText('上传创作附件'),{target:{files:[new File(['v'],'参考片.mp4'),new File(['p'],'扫描.pdf'),new File(['d'],'章节.docx')]}});
  await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('扫描.pdf'));
  expect(snapshot.filter(n=>['参考片.mp4','章节'].includes(n.title))).toHaveLength(2);
  expect(screen.getByRole('button',{name:'移除引用 参考片.mp4'})).toBeDefined();expect(screen.getByRole('button',{name:'移除引用 章节'})).toBeDefined();expect(input.value).toBe('我的想法');expect(api.saveStudioDocument).toHaveBeenCalledOnce();expect(api.submitStudioRun).not.toHaveBeenCalled();
});
test('failed attachment save retries the same canvas without reupload and blocks paid send',async()=>{
  api.importStudioMedia.mockResolvedValueOnce({key:'own/audio',url:'/voice.wav',mediaType:'audio',fileName:'声音.wav',mimeType:'audio/wav',bytes:12});
  api.saveStudioDocument.mockRejectedValueOnce(new Error('画布保存失败'));
  let snapshot:CanvasNodeData[]=[];render(<Host onSnapshot={(nodes:CanvasNodeData[])=>snapshot=nodes}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'保留草稿'}});
  fireEvent.change(screen.getByLabelText('上传创作附件'),{target:{files:[new File(['v'],'声音.wav')]}});
  await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('画布保存失败'));
  expect(snapshot.find(n=>n.title==='声音.wav')?.type).toBe('audio');expect((screen.getByRole('button',{name:'发送'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'重试保存附件'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'重试保存附件'})).toBeNull());
  expect(api.importStudioMedia).toHaveBeenCalledOnce();expect(api.saveStudioDocument).toHaveBeenCalledTimes(2);expect(api.submitStudioRun).not.toHaveBeenCalled();expect((screen.getByRole('button',{name:'发送'}) as HTMLButtonElement).disabled).toBe(false);
});
test('saved media already on the canvas is referenced without inserting another node',async()=>{
  let snapshot:CanvasNodeData[]=[];render(<Host initial={[{...character,metadata:{storageKey:'own',content:'/own'}},text]} selectedIds={[]} onSnapshot={(nodes:CanvasNodeData[])=>snapshot=nodes}/>);
  fireEvent.click(screen.getByRole('button',{name:'测试素材库添加'}));await waitFor(()=>expect(api.saveStudioDocument).toHaveBeenCalledOnce());
  expect(snapshot).toHaveLength(2);expect(screen.getByRole('button',{name:'移除引用 角色 A'})).toBeDefined();expect(api.importStudioMedia).not.toHaveBeenCalled();
});
test('full reference list rejects another file before importing it',async()=>{
  render(<Host initial={Array.from({length:16},(_,i)=>({...text,id:`text-${i}`}))} selectedIds={Array.from({length:16},(_,i)=>`text-${i}`)}/>);
  fireEvent.change(screen.getByLabelText('上传创作附件'),{target:{files:[new File(['v'],'片.mp4')]}});
  await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('最多引用 16'));
  expect(api.importStudioMedia).not.toHaveBeenCalled();expect(api.saveStudioDocument).not.toHaveBeenCalled();
});

test('closing and reopening an unsent assistant retains prompt and manually chosen references',()=>{
 const view=render(<Host/>);
 fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'请帮我设计角色的下一场戏'}});
 fireEvent.click(screen.getByRole('button',{name:'移除引用 角色 A'}));
 view.rerender(<Host open={false}/>);view.rerender(<Host open/>);
 expect((screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement).value).toBe('请帮我设计角色的下一场戏');
 expect(screen.queryByRole('button',{name:'移除引用 角色 A'})).toBeNull();expect(api.submitStudioRun).not.toHaveBeenCalled();
});

test('switching history preserves separate unsent drafts, references and models',()=>{
 render(<Host/>);
 const input=screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement;
 const historySelect=settingsControl('combobox','对话历史');
 const modelSelect=settingsControl('combobox','助手模型') as HTMLSelectElement;
 fireEvent.change(input,{target:{value:'新对话的未发送草稿'}});
 fireEvent.click(screen.getByRole('button',{name:'移除引用 角色 A'}));
 fireEvent.change(modelSelect,{target:{value:'two'}});
 fireEvent.change(historySelect,{target:{value:'h'}});
 fireEvent.change(input,{target:{value:'导演对话的另一份草稿'}});
 fireEvent.click(screen.getByRole('button',{name:'移除引用 故事 B'}));
 fireEvent.change(modelSelect,{target:{value:'one'}});
 fireEvent.click(screen.getByRole('button',{name:'新对话'}));
 expect(input.value).toBe('新对话的未发送草稿');expect(modelSelect.value).toBe('two');
 expect(screen.queryByRole('button',{name:/移除引用/})).toBeNull();
 fireEvent.change(historySelect,{target:{value:'h'}});
 expect(input.value).toBe('导演对话的另一份草稿');expect(modelSelect.value).toBe('one');
 expect(screen.getByRole('button',{name:'导演执导'}).getAttribute('aria-pressed')).toBe('true');
 expect(screen.queryByRole('button',{name:/移除引用/})).toBeNull();expect(api.submitStudioRun).not.toHaveBeenCalled();
});

test('actual credits appear on completion without token rates or reserved credits',async()=>{
  let finish!:(value:any)=>void;
  api.submitStudioRun.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  render(<Host capabilities={{...visualCapabilities,textModels:[{endpointId:'vision',name:'看图模型',isDefault:true,tokenPricing:{inputCreditsPerK:0.18,outputCreditsPerK:1.08,maxInputTokens:65536,maxOutputTokens:8192,maxCost:21}}]}}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'继续写故事'}});
  fireEvent.click(screen.getByRole('button',{name:'发送',exact:true}));
  await waitFor(()=>expect(api.submitStudioRun).toHaveBeenCalledOnce());
  expect(api.submitStudioRun.mock.calls[0][1].maxCost).toBe(21);
  expect(screen.queryByText(/已消耗|Token|冻结|21 积分/)).toBeNull();
  finish({id:'run',status:'done',output:{plan:{summary:'先整理故事',steps:[],questions:[]},billing:{inputTokens:1000,outputTokens:1000,credits:2,inputCreditsPerK:0.18,outputCreditsPerK:1.08}}});
  expect(await screen.findByText('已消耗 2 积分')).toBeDefined();
  expect(screen.queryByText(/Token|冻结|21 积分/)).toBeNull();
});

const textPlan={summary:'已补全角色设定，可直接采用。',steps:[{id:'description',operation:'text' as const,title:'末世英雄',prompt:'生成角色描述',content:'林岚，短银发，旧风衣，沉着的废土信使。',referenceNodeIds:['t']}],questions:[]};
const withPlan=(plan:any=textPlan)=>({...history,metadata:{...history.metadata,status:'success',studio:{...history.metadata!.studio!,conversation:{...history.metadata!.studio!.conversation!,plan}}}} as CanvasNodeData);
test('plan suggestions append to an editable draft, focus it, and never send or duplicate automatically',()=>{
  const question='是否需要指定具体的电影风格参考（如《沙丘》的宏大荒凉感）？';
  render(<Host initial={[text,withPlan({...textPlan,questions:[question]})]} initialNodeId="h"/>);
  const input=screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement;
  fireEvent.change(input,{target:{value:'保留暖色调'}});
  fireEvent.click(screen.getByRole('button',{name:question}));
  expect(input.value).toBe(`保留暖色调\n${question}`);expect(document.activeElement).toBe(input);
  fireEvent.click(screen.getByRole('button',{name:question}));expect(input.value).toBe(`保留暖色调\n${question}`);
  expect(screen.getByRole('button',{name:'移除引用 故事 B'})).toBeDefined();
  expect(api.submitStudioRun).not.toHaveBeenCalled();expect(api.saveStudioDocument).not.toHaveBeenCalled();
});
test('default view keeps settings folded and starter actions only prepare an editable message',()=>{
  render(<Host initial={[text]} selectedIds={[]}/>);
  expect(screen.queryByRole('combobox',{name:'对话历史'})).toBeNull();
  expect(screen.queryByRole('checkbox',{name:'读取图片与视频画面'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'搭建创作流程'}));
  expect((screen.getByRole('textbox',{name:'给创作助手的消息'}) as HTMLTextAreaElement).value).toContain('多视角');
  expect(api.submitStudioRun).not.toHaveBeenCalled();
});
test('adopting an edited text result creates one connected node without another paid generation',async()=>{
  let snapshot:CanvasNodeData[]=[];let edges:any[]=[];
  render(<Host initial={[text,withPlan()]} initialNodeId="h" onSnapshot={(n:CanvasNodeData[])=>snapshot=n} setConnections={(fn:any)=>{edges=fn(edges);}}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'结果 末世英雄'}),{target:{value:'修改后的角色设定'}});
  fireEvent.click(screen.getByRole('button',{name:'放入画布'}));
  await waitFor(()=>expect(api.saveStudioDocument).toHaveBeenCalledOnce());
  const added=snapshot.find(n=>n.title==='末世英雄')!;
  expect(added.metadata?.content).toBe('修改后的角色设定');
  expect(snapshot.find(n=>n.id==='t')?.metadata?.content).toBe('在森林里相遇');
  expect(edges).toEqual([expect.objectContaining({fromNodeId:'t',toNodeId:added.id})]);
  expect(snapshot.find(n=>n.id==='h')?.metadata?.studio?.conversation?.plan?.steps[0].resultNodeId).toBe(added.id);
  expect((screen.getByRole('button',{name:'已放入画布'}) as HTMLButtonElement).disabled).toBe(true);
  expect(api.submitStudioRun).not.toHaveBeenCalled();
});
test('explicit text replacement preserves the node identity and writes only the selected text',async()=>{
  let snapshot:CanvasNodeData[]=[];
  render(<Host initial={[text,withPlan()]} initialNodeId="h" onSnapshot={(n:CanvasNodeData[])=>snapshot=n}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'文字放置位置'}),{target:{value:'t'}});
  expect(screen.getByText('将替换该节点正文 · 查看原文')).toBeDefined();
  fireEvent.click(screen.getByRole('button',{name:'替换节点正文'}));
  await waitFor(()=>expect(api.saveStudioDocument).toHaveBeenCalledOnce());
  expect(snapshot).toHaveLength(2);expect(snapshot.find(n=>n.id==='t')?.metadata?.content).toBe(textPlan.steps[0].content);
  expect(api.submitStudioRun).not.toHaveBeenCalled();
});
test('the selected referenced text is the default adoption target and retains its existing graph',async()=>{
  let snapshot:CanvasNodeData[]=[];const setConnections=vi.fn();
  render(<Host initial={[text,withPlan()]} initialNodeId="h" selectedIds={['t']} setConnections={setConnections} onSnapshot={(n:CanvasNodeData[])=>snapshot=n}/>);
  expect((screen.getByRole('combobox',{name:'文字放置位置'}) as HTMLSelectElement).value).toBe('t');
  expect(screen.getByText('将替换该节点正文 · 查看原文')).toBeDefined();
  fireEvent.click(screen.getByRole('button',{name:'替换节点正文'}));
  await waitFor(()=>expect(api.saveStudioDocument).toHaveBeenCalledOnce());
  expect(snapshot).toHaveLength(2);
  expect(snapshot.find(n=>n.id==='t')).toMatchObject({title:text.title,position:text.position,metadata:{content:textPlan.steps[0].content}});
  expect(snapshot.find(n=>n.id==='h')?.metadata?.studio?.conversation?.plan?.steps[0].resultNodeId).toBe('t');
  expect(setConnections).not.toHaveBeenCalled();expect(api.submitStudioRun).not.toHaveBeenCalled();
});
test('explicitly choosing a new text node survives result edits despite an eligible selection',async()=>{
  let snapshot:CanvasNodeData[]=[];
  render(<Host initial={[text,withPlan()]} initialNodeId="h" selectedIds={['t']} onSnapshot={(n:CanvasNodeData[])=>snapshot=n}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'文字放置位置'}),{target:{value:'new'}});
  fireEvent.change(screen.getByRole('textbox',{name:'结果 末世英雄'}),{target:{value:'独立的新设定'}});
  expect((screen.getByRole('combobox',{name:'文字放置位置'}) as HTMLSelectElement).value).toBe('new');
  fireEvent.click(screen.getByRole('button',{name:'放入画布'}));
  await waitFor(()=>expect(api.saveStudioDocument).toHaveBeenCalledOnce());
  expect(snapshot).toHaveLength(3);expect(snapshot.find(n=>n.id==='t')?.metadata?.content).toBe(text.metadata?.content);
  expect(snapshot.find(n=>n.title==='末世英雄')?.metadata?.content).toBe('独立的新设定');
});
test('multiple selected writable texts keep new-node placement until the user picks one',()=>{
  const other={...text,id:'other',title:'另一段故事'};
  const original=withPlan();
  const saved={...original,metadata:{...original.metadata,studio:{...original.metadata!.studio!,request:{...original.metadata!.studio!.request!,contextNodeIds:['t','other']}}}};
  render(<Host initial={[text,other,saved]} initialNodeId="h" selectedIds={['t','other']}/>);
  expect((screen.getByRole('combobox',{name:'文字放置位置'}) as HTMLSelectElement).value).toBe('new');
  expect(screen.queryByText('将替换该节点正文 · 查看原文')).toBeNull();
});
test('failed adoption save retries the same node without duplication',async()=>{
  api.saveStudioDocument.mockRejectedValueOnce(new Error('画布保存失败'));
  let snapshot:CanvasNodeData[]=[];
  render(<Host initial={[text,withPlan()]} initialNodeId="h" onSnapshot={(n:CanvasNodeData[])=>snapshot=n}/>);
  fireEvent.click(screen.getByRole('button',{name:'放入画布'}));
  await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('画布保存失败'));
  const id=snapshot.find(n=>n.title==='末世英雄')?.id;
  fireEvent.click(screen.getByRole('button',{name:'重试保存'}));
  await waitFor(()=>expect(api.saveStudioDocument).toHaveBeenCalledTimes(2));
  expect(snapshot.filter(n=>n.title==='末世英雄').map(n=>n.id)).toEqual([id]);
  expect(api.submitStudioRun).not.toHaveBeenCalled();
});
test('dependent image step waits for text adoption then passes the exact output node to creation',async()=>{
  const plan={...textPlan,steps:[...textPlan.steps,{id:'sheet',operation:'image',title:'多视角设定图',prompt:'绘制角色三视图',referenceNodeIds:[],dependsOn:['description']}]};
  const useStep=vi.fn((_step:any)=>undefined);let snapshot:CanvasNodeData[]=[];
  render(<Host initial={[text,withPlan(plan)]} initialNodeId="h" onUseStep={useStep} onSnapshot={(n:CanvasNodeData[])=>snapshot=n}/>);
  fireEvent.click(screen.getByRole('button',{name:'下一个步骤'}));
  expect((screen.getByRole('button',{name:'创建图片节点'}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('status').textContent).toContain('末世英雄');
  fireEvent.click(screen.getByRole('button',{name:'上一个步骤'}));fireEvent.click(screen.getByRole('button',{name:'放入画布'}));
  await waitFor(()=>expect(api.saveStudioDocument).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button',{name:'下一个步骤'}));fireEvent.click(screen.getByRole('button',{name:'创建图片节点'}));
  await waitFor(()=>expect(useStep).toHaveBeenCalledOnce());
  expect(useStep.mock.calls[0][0].referenceNodeIds).toEqual([snapshot.find(n=>n.title==='末世英雄')!.id]);
  expect(api.submitStudioRun).not.toHaveBeenCalled();
});

test('reopening an adopted result passes resolved dependencies to the generation composer without duplicating nodes',async()=>{
  const image={...character,metadata:{status:'success' as const,storageKey:'own/image'}};
  const video={...image,id:'v',type:'video' as const,title:'动作视频',metadata:{status:'success' as const,storageKey:'own/video'}};
  const plan={summary:'流程',questions:[],steps:[
    {id:'sheet',operation:'image',title:'角色图',prompt:'角色',referenceNodeIds:[],resultNodeId:'c'},
    {id:'video',operation:'video',title:'动作视频',prompt:'挥手',referenceNodeIds:[],dependsOn:['sheet'],unresolvedReferences:['sheet'],resultNodeId:'v'}]};
  const useStep=vi.fn();let snapshot:CanvasNodeData[]=[];
  render(<Host initial={[image,video,withPlan(plan)]} initialNodeId="h" onUseStep={useStep} onSnapshot={(n:CanvasNodeData[])=>snapshot=n}/>);
  fireEvent.click(screen.getByRole('button',{name:'下一个步骤'}));
  fireEvent.click(screen.getByRole('button',{name:'打开节点继续创作'}));
  await waitFor(()=>expect(useStep).toHaveBeenCalledWith(expect.objectContaining({referenceNodeIds:['c'],unresolvedReferences:[],resultNodeId:'v'})));
  expect(snapshot).toHaveLength(3);
  expect(snapshot.find(n=>n.id==='h')?.metadata?.studio?.conversation?.plan?.steps[1].unresolvedReferences).toEqual([]);
  expect(api.submitStudioRun).not.toHaveBeenCalled();
});

beforeEach(() => { mountStudioErrorNotifications(api.error); });

test('sending and reopening history never adds canvas nodes or reference edges until adoption',async()=>{
  let canvas:CanvasNodeData[]=[],records:CanvasNodeData[]=[];const edges=vi.fn();
  const plan={...textPlan,steps:[{...textPlan.steps[0],referenceNodeIds:[]}]};
  api.submitStudioRun.mockResolvedValueOnce({id:'run',status:'done',output:{plan}});
  const view=render(<Host initial={[text]} selectedIds={[]} setConnections={edges} onCanvasSnapshot={(n:CanvasNodeData[],h:CanvasNodeData[])=>{canvas=n;records=h;}}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'给创作助手的消息'}),{target:{value:'生成角色描述'}});
  fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await screen.findByRole('button',{name:'放入画布'});
  expect(canvas.map(n=>n.id)).toEqual(['t']);expect(records).toHaveLength(1);expect(edges).not.toHaveBeenCalled();
  const saved=structuredClone([...canvas,...records]);const id=records[0].id;view.unmount();
  render(<Host initial={saved} initialNodeId={id} selectedIds={[]} onCanvasSnapshot={(n:CanvasNodeData[],h:CanvasNodeData[])=>{canvas=n;records=h;}}/>);
  expect(screen.getByText('生成角色描述')).toBeDefined();expect(canvas).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'放入画布'}));
  await waitFor(()=>expect(canvas).toHaveLength(2));expect(records[0].metadata?.studio?.conversation?.plan?.steps[0].resultNodeId).toBe(canvas[1].id);
  expect(api.submitStudioRun).toHaveBeenCalledOnce();
});
test.each(['image','video','audio'])('selected %s prompt can be adopted in place preserving media, accepted request and graph',async type=>{
  const original={...character,type,metadata:{content:'/existing',storageKey:'own/media',prompt:'旧提示词',studio:{kind:'shot',request:{clientRequestId:'paid',prompt:'受理时提示词'}}}} as CanvasNodeData;
  const plan={summary:'已优化',questions:[],steps:[{...textPlan.steps[0],content:'保持人物，缓缓向镜头挥手。',referenceNodeIds:['c'],editTarget:{nodeId:'c',field:'prompt'}}]};
  const record=withPlan(plan);record.metadata!.studio!.request={...record.metadata!.studio!.request!,contextNodeIds:['c']};
  let canvas:CanvasNodeData[]=[];const edges=vi.fn();
  render(<Host initial={[original,record]} initialNodeId="h" selectedIds={['c']} setConnections={edges} onCanvasSnapshot={(n:CanvasNodeData[])=>canvas=n}/>);
  expect(screen.getByText('将替换该节点提示词 · 查看原文')).toBeDefined();
  fireEvent.click(screen.getByRole('button',{name:'替换节点提示词'}));
  await waitFor(()=>expect(api.saveStudioDocument).toHaveBeenCalledOnce());
  expect(canvas).toHaveLength(1);expect(canvas[0]).toMatchObject({id:'c',type,metadata:{prompt:plan.steps[0].content,content:'/existing',storageKey:'own/media',studio:{request:{prompt:'受理时提示词'}}}});
  expect(edges).not.toHaveBeenCalled();expect(api.submitStudioRun).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'已更新提示词'})).toBeDefined();
});
test('original send snapshot blocks overwriting a prompt manually changed while AI was responding',async()=>{
  const plan={summary:'优化',questions:[],steps:[{...textPlan.steps[0],content:'AI 新提示词',referenceNodeIds:['c'],editTarget:{nodeId:'c',field:'prompt'}}]};
  const record=withPlan(plan);record.metadata!.studio!.request={...record.metadata!.studio!.request!,contextNodeIds:['c']};record.metadata!.studio!.assistantEditSnapshots={c:{prompt:'发送时原提示词'}};
  let canvas:CanvasNodeData[]=[];
  render(<Host initial={[{...character,metadata:{prompt:'用户刚改的提示词'}},record]} initialNodeId="h" selectedIds={['c']} onCanvasSnapshot={(n:CanvasNodeData[])=>canvas=n}/>);
  fireEvent.click(screen.getByRole('button',{name:'替换节点提示词'}));
  await waitFor(()=>expect(screen.getAllByRole('alert').some(n=>n.textContent?.includes('节点内容已有修改'))).toBe(true));
  expect(canvas[0].metadata?.prompt).toBe('用户刚改的提示词');expect(api.saveStudioDocument).not.toHaveBeenCalled();
});
test('text node adoption can explicitly write its prompt instead of replacing its body',async()=>{
  const plan={...textPlan,steps:[{...textPlan.steps[0],content:'优化后的生成指令',editTarget:{nodeId:'t',field:'prompt'}}]};
  let canvas:CanvasNodeData[]=[];
  render(<Host initial={[text,withPlan(plan)]} initialNodeId="h" selectedIds={['t']} onCanvasSnapshot={(n:CanvasNodeData[])=>canvas=n}/>);
  expect((screen.getByRole('combobox',{name:'修改字段'}) as HTMLSelectElement).value).toBe('prompt');
  fireEvent.click(screen.getByRole('button',{name:'替换节点提示词'}));
  await waitFor(()=>expect(api.saveStudioDocument).toHaveBeenCalledOnce());
  expect(canvas[0].metadata).toMatchObject({content:text.metadata?.content,prompt:'优化后的生成指令'});expect(canvas).toHaveLength(1);
});


test.each(['fixed','selectable'])('assistant exposes its single %s model without opening settings',policy=>{
 render(<Host capabilities={{...visualCapabilities,textModelMode:policy,textModels:[visualCapabilities.textModels[0]]}}/>);
 const select=screen.getByRole('combobox',{name:'助手模型'});
 expect(select).toHaveProperty('value','vision');
 expect(select).toHaveProperty('disabled',true);
 expect(screen.getByRole('button',{name:'创作设置与历史'}).getAttribute('aria-expanded')).toBe('false');
 expect(api.submitStudioRun).not.toHaveBeenCalled();
});
