// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import type { StudioNodeMetadata } from '@ai-star-eco/types/ip-studio-workflow';
import { scriptFramework, markdownToScript } from '@/canvas-bridge/studio-script-markdown';
import { StudioScriptEditor } from './studio-script-editor';
const api=vi.hoisted(()=>({submit:vi.fn(),read:vi.fn(),save:vi.fn(),commit:vi.fn(),close:vi.fn(),visual:vi.fn(),storyboard:vi.fn(),error:vi.fn(),info:vi.fn(),success:vi.fn()}));
vi.mock('@/canvas-bridge/studio-api',()=>({submitStudioRun:api.submit}));
vi.mock('@/canvas-bridge/api',()=>({readRun:api.read,cancelRun:vi.fn()}));
vi.mock('@/canvas-bridge/studio-save',()=>({saveStudioDocument:api.save}));
vi.mock('./studio-script-settings',()=>({StudioScriptSettingsForm:()=>null}));
vi.mock('./studio-script-rich-editor',async()=>{
 const {forwardRef}=await import('react');
 return {StudioScriptRichEditor:forwardRef(({markdown,onChange,readOnly}:any,_ref:any)=>readOnly?<article>{markdown}</article>:<textarea aria-label="剧本文档" value={markdown} onChange={e=>onChange(e.target.value)}/>)};
});
vi.mock('antd',()=>{
 const Input=({autoSize,...p}:any)=><input {...p}/>;Input.TextArea=({autoSize,...p}:any)=><textarea {...p}/>;
 return {App:{useApp:()=>({message:{error:api.error,info:api.info,success:api.success}})},Input,
 Modal:({children}:any)=><section role="dialog" aria-label="剧本编辑器">{children}</section>,
 Button:({icon,loading,type,size,...p}:any)=><button {...p} disabled={loading||p.disabled}>{p.children}</button>,
 Select:({options,value,onChange,...p}:any)=><select {...p} value={value||''} onChange={e=>onChange(e.target.value)}>{options?.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
 Segmented:({options,value,onChange}:any)=><div>{options.map((o:string)=><button key={o} aria-pressed={o===value} onClick={()=>onChange(o)}>{o}</button>)}</div>};
});
const document=scriptFramework('雨夜');
const accepted={clientRequestId:'original-script-generation',nodeId:'script',operation:'script' as const,prompt:'原始要求'};
const original:CanvasNodeData={id:'script',type:'text' as never,title:'雨夜',position:{x:35,y:74},width:480,height:300,metadata:{status:'success',studio:{kind:'script',script:markdownToScript(document),scriptMarkdown:document,request:accepted}}};
const done=(markdown=document.replace('核心冲突：','核心冲突：丢失的钥匙。'))=>({id:'revision-1',projectId:'p',nodeId:'script',kind:'studio-assistant',status:'done',stage:'done',pct:100,cost:2,inputs:{},output:{scriptRevision:{summary:'增强了开场冲突。',markdown}},createdAt:''});
let snapshot:CanvasNodeData;
function Host({initial=original}: {initial?:CanvasNodeData}) {
 const[node,setNode]=useState(initial);snapshot=node;
 return <StudioScriptEditor projectId="p" node={node} capabilities={{mock:false,operations:['assistant'],imageCost:8,textCost:2,videoCost:40,textModels:[{endpointId:'text',name:'文本模型',isDefault:true}]}}
 onState={state=>setNode(n=>({...n,metadata:{...n.metadata,studio:{...n.metadata!.studio!,scriptEditor:state}}}))}
 onSettings={()=>{}} onCommit={async(markdown,script)=>{setNode(n=>({...n,title:script.title,metadata:{...n.metadata,studio:{...n.metadata!.studio!,script,scriptMarkdown:markdown}}}));await api.commit(markdown,script);}}
 onClose={api.close} onVisual={api.visual} onStoryboard={api.storyboard}/>;
}
beforeEach(()=>{vi.resetAllMocks();api.submit.mockResolvedValue(done());api.save.mockResolvedValue(undefined);api.commit.mockResolvedValue(undefined);vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>setTimeout(callback,0));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const openAssistant=()=>{const toggle=screen.getByRole('button',{name:'创作面板'});if(toggle.getAttribute('aria-expanded')!=='true')fireEvent.click(toggle);};
const composer=()=>{openAssistant();return screen.getByRole('textbox',{name:'剧本改稿要求'});};
const send=async()=>{fireEvent.change(composer(),{target:{value:'加强第 1 集开场冲突，保留其他章节。'}});fireEvent.click(screen.getByRole('button',{name:'发送 · 2 积分'}));await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());};
test('blank nodes open the full document framework; saving updates the same node and keeps its position and accepted task',async()=>{
 render(<Host initial={{...original,metadata:{studio:{kind:'script',request:accepted}}}}/>);
 expect((screen.getByRole('textbox',{name:'剧本文档'}) as HTMLTextAreaElement).value).toContain('## 人物小传');
 fireEvent.click(screen.getByRole('button',{name:'保存剧本'}));await waitFor(()=>expect(api.commit).toHaveBeenCalledOnce());expect(snapshot.id).toBe('script');expect(snapshot.position).toEqual(original.position);expect(snapshot.metadata?.studio?.request).toEqual(accepted);
});
test('save errors retain the editor and latest local draft instead of closing it',async()=>{
 api.commit.mockRejectedValue(new Error('保存冲突'));render(<Host/>);fireEvent.change(screen.getByRole('textbox',{name:'剧本文档'}),{target:{value:document+'\n手动补充。'}});fireEvent.click(screen.getByRole('button',{name:'返回画布'}));await waitFor(()=>expect(api.error).toHaveBeenCalledWith('保存冲突'));expect(api.close).not.toHaveBeenCalled();expect(snapshot.metadata?.studio?.scriptEditor?.draft).toContain('手动补充');expect(screen.getByText(/保存失败，草稿保留/)).toBeDefined();expect(screen.queryByText(/^已保存到画布/)).toBeNull();
});
test('AI produces a persisted proposal with quote and bounded history, and only explicit adoption changes the draft',async()=>{
 render(<Host/>);await send();await screen.findByText('AI 建议版本 · 尚未采纳');expect(api.submit.mock.calls[0][1]).toMatchObject({nodeId:'script',operation:'assistant',scriptEdit:{markdown:document},maxCost:2,model:'text'});expect(api.save.mock.invocationCallOrder[0]).toBeLessThan(api.submit.mock.invocationCallOrder[0]);expect(snapshot.metadata?.studio?.scriptMarkdown).toBe(document);expect(snapshot.metadata?.studio?.scriptEditor?.draft).toBe(document);
 fireEvent.click(screen.getByRole('button',{name:'采纳修改'}));expect(snapshot.metadata?.studio?.scriptEditor?.draft).toContain('丢失的钥匙');expect(snapshot.metadata?.studio?.scriptMarkdown).toBe(document);
 fireEvent.click(screen.getByRole('button',{name:'撤销采纳'}));expect(snapshot.metadata?.studio?.scriptEditor?.draft).toBe(document);
});
test('manual edits during an AI response disable ordinary adoption; explicit replacement remains reversible',async()=>{
 let resolve!:(value:any)=>void;api.submit.mockImplementation(()=>new Promise(r=>{resolve=r;}));render(<Host/>);await send();const edited=document+'\n手写结尾。';fireEvent.change(screen.getByRole('textbox',{name:'剧本文档'}),{target:{value:edited}});resolve(done());await screen.findByText('AI 建议版本 · 尚未采纳');expect((screen.getByRole('button',{name:'采纳修改'}) as HTMLButtonElement).disabled).toBe(true);expect(snapshot.metadata?.studio?.scriptEditor?.draft).toBe(edited);
 fireEvent.click(screen.getByRole('button',{name:'用 AI 版本替换当前稿'}));fireEvent.click(screen.getByRole('button',{name:'撤销采纳'}));expect(snapshot.metadata?.studio?.scriptEditor?.draft).toBe(edited);
});
test('an unknown submission result recovers with the original key and document despite later draft edits and reload',async()=>{
 api.submit.mockRejectedValueOnce(new TypeError('网络中断'));render(<Host/>);await send();await screen.findByRole('alert');const pending=snapshot.metadata!.studio!.scriptEditor!.pending!;expect(pending.runId).toBeUndefined();const persisted=structuredClone(snapshot);cleanup();render(<Host initial={persisted}/>);openAssistant();fireEvent.change(screen.getByRole('textbox',{name:'剧本文档'}),{target:{value:document+'\n后续手改。'}});fireEvent.click(screen.getByRole('button',{name:'确认原改稿任务'}));await waitFor(()=>expect(api.submit).toHaveBeenCalledTimes(2));expect(api.submit.mock.calls[1][1]).toEqual(pending.request);await screen.findByText('AI 建议版本 · 尚未采纳');expect(snapshot.metadata?.studio?.scriptEditor?.draft).toContain('后续手改');expect(snapshot.metadata?.studio?.request).toEqual(accepted);
});
test('accepted jobs resume by run ID without submitting or charging another task',async()=>{
 const state:NonNullable<StudioNodeMetadata['scriptEditor']>={draft:document,turns:[{role:'user',content:'增强冲突'}],pending:{request:{...accepted,operation:'assistant',scriptEdit:{markdown:document}},baseMarkdown:document,runId:'revision-1'}};
 api.read.mockResolvedValue(done());render(<Host initial={{...original,metadata:{...original.metadata,studio:{...original.metadata!.studio!,scriptEditor:state}}}}/>);await screen.findByText('AI 建议版本 · 尚未采纳');expect(api.read).toHaveBeenCalledWith('revision-1');expect(api.submit).not.toHaveBeenCalled();
});
test('draft-only return preserves incomplete Markdown and leaves the saved script intact',async()=>{
 render(<Host/>);fireEvent.change(screen.getByRole('textbox',{name:'剧本文档'}),{target:{value:'# 草稿\n\n正在重写'}});fireEvent.click(screen.getByRole('button',{name:'返回画布'}));await waitFor(()=>expect(api.close).toHaveBeenCalledOnce());expect(api.commit).not.toHaveBeenCalled();expect(snapshot.metadata?.studio?.scriptMarkdown).toBe(document);expect(snapshot.metadata?.studio?.scriptEditor?.draft).toContain('正在重写');
});
test('reference-image actions save the edited projection first and carry the exact asset description',async()=>{
 render(<Host/>);openAssistant();fireEvent.click(screen.getByRole('button',{name:'素材',exact:true}));fireEvent.click(screen.getAllByRole('button',{name:'生成参考图'})[0]);await waitFor(()=>expect(api.visual).toHaveBeenCalledOnce());expect(api.visual).toHaveBeenCalledWith('characters',expect.objectContaining({name:'主角',description:expect.stringContaining('性格与目标')}));expect(api.commit.mock.invocationCallOrder[0]).toBeLessThan(api.visual.mock.invocationCallOrder[0]);
});
test('invalid model output leaves the original draft available and releases the UI lock',async()=>{
 api.submit.mockResolvedValue(done('# 不完整的稿子'));render(<Host/>);await send();await screen.findByRole('alert');expect(snapshot.metadata?.studio?.scriptEditor?.pending).toBeUndefined();expect(snapshot.metadata?.studio?.scriptEditor?.draft).toBe(document);expect(snapshot.metadata?.studio?.scriptEditor?.proposal).toBeUndefined();
});
test('a legacy node copy cannot recover a revision task belonging to its source node',async()=>{
 const pending={request:{...accepted,operation:'assistant' as const},baseMarkdown:document,runId:'source-task'};
 render(<Host initial={{...original,id:'copy',metadata:{...original.metadata,studio:{...original.metadata!.studio!,scriptEditor:{draft:document,turns:[],pending}}}}}/>);
 openAssistant();await screen.findByRole('alert');expect(api.read).not.toHaveBeenCalled();expect(api.submit).not.toHaveBeenCalled();expect(snapshot.metadata?.studio?.scriptEditor?.pending).toBeUndefined();expect(snapshot.metadata?.studio?.scriptEditor?.draft).toBe(document);
});

test('the document opens without a creation panel, and toggling that panel preserves the document and chat draft',()=>{
 render(<Host/>);expect(screen.queryByRole('complementary',{name:'剧本创作面板'})).toBeNull();
 fireEvent.change(composer(),{target:{value:'保留这条未发送的改稿要求'}});
 fireEvent.click(screen.getByRole('button',{name:'创作面板'}));expect(screen.queryByRole('textbox',{name:'剧本改稿要求'})).toBeNull();
 openAssistant();expect((composer() as HTMLTextAreaElement).value).toBe('保留这条未发送的改稿要求');
 expect((screen.getByRole('textbox',{name:'剧本文档'}) as HTMLTextAreaElement).value).toBe(document);expect(api.submit).not.toHaveBeenCalled();
});
