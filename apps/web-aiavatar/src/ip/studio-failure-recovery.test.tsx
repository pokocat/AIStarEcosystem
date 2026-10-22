// @vitest-environment jsdom
import {setupSelectFieldDom,createSelectFieldUser} from '../../../../scripts/vitest/select-field';
setupSelectFieldDom();
const selectFieldValue=createSelectFieldUser({fireEvent,screen});
import {useEffect,useState} from 'react';
import { mountStudioErrorNotifications } from './testing/studio-notification-harness';

import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {ApiError} from '@ai-star-eco/api-client';
import type {CanvasNodeData,CanvasConnection} from '@/canvas/types/canvas';
import {StudioWorkspace} from './studio-workspace';
import {useCanvasStore} from '@/canvas/stores/canvas/use-canvas-store';
const api=vi.hoisted(()=>({capabilities:vi.fn(),models:vi.fn(),videoModels:vi.fn(),submit:vi.fn(),speech:vi.fn(),lip:vi.fn(),save:vi.fn(),read:vi.fn(),project:vi.fn(),history:vi.fn(),error:vi.fn(),info:vi.fn(),success:vi.fn(),download:vi.fn(),cancel:vi.fn()}));
vi.mock('./studio-floating-panel',()=>({StudioFloatingPanel:({open,title,children,onClose,footer,embedded}:any)=>open?<section role={embedded?"region":"dialog"} aria-label={title}>{!embedded&&<button aria-label={title==='生成视频'||title==='生成图片'||title==='创作剧本'||title==='拆分镜头'?'关闭创作面板':`关闭${title}`} onClick={onClose}>关闭</button>}{children}{footer}</section>:null}));
vi.mock('@/canvas-bridge/download-media',()=>({downloadMedia:api.download}));
vi.mock('./api',()=>({IpStudioApi:{listProjectRuns:api.history}}));
vi.mock('./studio-template-library',()=>({StudioTemplateLibrary:({open,scope}:any)=>open?<section role="dialog" aria-label="画布模板">{scope}</section>:null}));
vi.mock('@/canvas-bridge/studio-api',()=>({studioCapabilities:api.capabilities,readStudioProject:api.project,submitStudioRun:api.submit,submitStudioSpeech:api.speech,submitStudioLipSync:api.lip,listStudioIps:async()=>[],listStudioIpAssets:async()=>[]}));
vi.mock('@/canvas-bridge/studio-save',()=>({saveStudioDocument:api.save}));
vi.mock('@/canvas-bridge/api',()=>({readRun:api.read,cancelRun:api.cancel,fetchModels:api.models,fetchStudioVideoModels:api.videoModels}));
vi.mock('@/canvas-bridge/models',()=>({SERVER_CHANNEL_ID:'server',endpointIdFor:()=> 'model'}));
vi.mock('@/canvas-bridge/config-store',()=>({encodeChannelModel:(_:string,m:string)=>m}));
vi.mock('./studio-script-rich-editor',async()=>{
 const {forwardRef}=await import('react');
 return {StudioScriptRichEditor:forwardRef(({markdown,onChange,readOnly}:any,_ref:any)=>readOnly?<article>{markdown}</article>:<textarea aria-label="剧本文档" value={markdown} onChange={e=>onChange(e.target.value)}/>)};
});
vi.mock('antd',()=>{
 const Input=({children,...p}:any)=><input {...p}/>;Input.TextArea=({autoSize,...p}:any)=><textarea {...p}/>;
 const message={error:api.error,info:api.info,success:api.success};
 return {InputNumber:({value,onChange,min,max,precision,controls,suffix,...p}:any)=><input type="number" {...p} min={min} max={max} value={value??''} onChange={e=>onChange(e.target.value?Number(e.target.value):null)}/>,App:{useApp:()=>({message})},Input, Segmented:({options,value,onChange}:any)=><div>{options.map((o:string)=><button key={o} aria-pressed={o===value} onClick={()=>onChange(o)}>{o}</button>)}</div>,
 Button:({loading,block,type,icon,size,...p}:any)=><button {...p} disabled={loading||p.disabled}>{p.children}</button>,
 Drawer:({open,title,children,onClose,footer}:any)=>open?<section role="dialog" aria-label={title}><button aria-label="关闭创作面板" onClick={onClose}>关闭</button>{children}{footer}</section>:null,
 Modal:({open,title,children,onCancel,footer,afterClose}:any)=>{useEffect(()=>{if(!open)afterClose?.();},[open]);return open?<section role="dialog" aria-label={title||'剧本编辑器'}>{onCancel&&<button aria-label={`关闭${title}`} onClick={onCancel}>关闭</button>}{children}{footer}</section>:null;},
 Select:({options,value,onChange,mode,...p}:any)=><select multiple={mode==='multiple'} aria-label={p['aria-label']} disabled={p.disabled} value={value??(mode==='multiple'?[]:'')} onChange={e=>onChange(mode==='multiple'?Array.from(e.target.selectedOptions).map(o=>o.value):options.find((o:any)=>String(o.value)===e.target.value)?.value)}>{(options||[]).map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
 Checkbox:({children,...p}:any)=><label><input type="checkbox" {...p}/>{children}</label>,Dropdown:({children,menu}:any)=><div>{children}{menu?.items?.map((item:any)=><button key={item.key} onClick={()=>menu.onClick({key:item.key})}>{item.label}</button>)}</div>,Tabs:({items}:any)=><>{items.map((item:any)=><section key={item.key}>{item.children}</section>)}</>,
  // Like Dropdown above, the overflow 「⋯」 content renders inline so existing action tests reach every action; the split itself is tested separately.
  Popover:({children,content}:any)=><>{children}{content}</>};
});
vi.mock('./studio-commerce',()=>({StudioCommerce:()=>null}));
vi.mock('./studio-speech',()=>({StudioSpeech:()=>null}));
vi.mock('./studio-voice-adopt',()=>({StudioVoiceAdopt:()=>null}));
vi.mock('./studio-lip-sync',()=>({StudioLipSync:({open,initialNodeId}:any)=>open?<section role="dialog" aria-label="人物口型同步"><span data-testid="lip-origin">{initialNodeId||'no origin'}</span></section>:null}));
vi.mock('./studio-assistant',()=>({StudioAssistant:({open,initialNodeId}:any)=>open?<section role="dialog" aria-label="AI 创作助手">{initialNodeId}</section>:null}));
vi.mock('./studio-batch-panel',()=>({StudioBatchPanel:({open,initialNodeId}:any)=>open?<section role="dialog" aria-label="制作计划">{initialNodeId}</section>:null}));
vi.mock('./studio-ip-library',()=>({StudioIpLibrary:()=>null}));
vi.mock('./studio-video-controls',()=>({StudioVideoControls:()=>null,StudioVideoSeedControl:()=>null}));
vi.mock('./studio-motion-prompt',()=>({StudioMotionPrompt:({value,onChange,references}:any)=><textarea data-references={JSON.stringify(references.map((r:any)=>[r.nodeId,r.label]))} aria-label="创作要求" value={value} onChange={e=>onChange(e.target.value)}/>}));
vi.mock('@/canvas-bridge/signed-image',()=>({SignedImage:()=>null}));
vi.mock('@/canvas-bridge/signed-video',()=>({SignedVideo:()=>null}));
vi.mock('@/shell/layout-mode',async orig=>({...await orig<object>(),useLayoutMode:()=>'desktop'}));
const advancedTimeline=vi.hoisted(()=>({width:720,height:1280,clips:[{storageKey:'take.mp4',start:0,end:3,from:0.5,volume:0}],audios:[{storageKey:'voice.wav',start:0,end:3,from:0,volume:1}],texts:[{text:'限时优惠',start:0,end:2,x:0,y:-400,fontSize:48,color:'#FFFFFF'}],captions:[]}));
// 高级编辑（Twick）经 next/dynamic 按需加载；这里换成一个只会「导出成片」的替身。
vi.mock('next/dynamic',()=>({default:()=>function AdvancedStub(p:any){return p.onExport?<section role="dialog" aria-label="高级编辑">
  <button onClick={()=>void p.onExport(advancedTimeline,{engine:'twick',savedAt:'2026-10-19T03:00:00Z',project:{tracks:[],version:1}}).then((ok:boolean)=>{if(ok)p.onClose();})}>导出成片</button></section>:null;}}));
const node:CanvasNodeData={id:'v',type:'video' as never,title:'old adopted',width:320,height:400,position:{x:0,y:0},metadata:{status:'success',prompt:'saved prompt',storageKey:'old.mp4',content:'/old.mp4',primaryVideoId:'old',videos:[{id:'old',status:'success',storageKey:'old.mp4',content:'/old.mp4'}],model:'model',seconds:'8',videoCount:'4',size:'768x1365',vquality:'768',studio:{kind:'shot',episodeNo:2,order:3,includeInWork:false}}};
const request={clientRequestId:'original-key',nodeId:'v',operation:'video' as const,prompt:'original prompt',model:'model',count:4,durationSec:8,aspectRatio:'9:16',maxCost:320};
const done={id:'accepted',projectId:'p',nodeId:'v',kind:'studio-video',status:'done',pct:100,cost:320,inputs:request,output:{videoCandidates:[{index:0,jobId:'job',status:'done',pct:100,durationSec:8,storageKey:'new.mp4',url:'/new.mp4'}]},createdAt:''};
let snapshot:CanvasNodeData[]=[];
let connectionSnapshot:CanvasConnection[]=[];
function Host({initial=node,initialNodes,initialConnections=[],textEditingNodeId,renderTextEditor}:any){const[nodes,setNodes]=useState<CanvasNodeData[]>(initialNodes||[initial]);snapshot=nodes;const[connections,setConnections]=useState<CanvasConnection[]>(initialConnections);connectionSnapshot=connections;return <StudioWorkspace projectId="p" nodes={nodes} connections={connections} selectedNodeIds={new Set(['v'])} setNodes={setNodes} setConnections={setConnections} onFocusNode={()=>{}} onClosePanel={()=>{}} onRestorePanel={()=>{}} textEditingNodeId={textEditingNodeId} renderTextEditor={renderTextEditor}/>;}
const openVideo=()=>{fireEvent(window,new CustomEvent('studio-command',{detail:{action:'video',nodeId:'v'}}));const summary=document.querySelector('.studio-composer-settings summary');if(summary)fireEvent.click(summary);};
afterEach(cleanup);
beforeEach(()=>{vi.resetAllMocks();api.videoModels.mockResolvedValue([]);api.capabilities.mockResolvedValue({mock:false,operations:['video'],videoCost:80,textModels:[{endpointId:'a',name:'文本 A',isDefault:true,tokenPricing:{inputCreditsPerK:0.18,outputCreditsPerK:1.08,maxInputTokens:65536,maxOutputTokens:8192,maxCost:21}}]});api.models.mockResolvedValue({image:[],video:[{endpointId:'model',name:'model',creditCost:80,capability:{minDurationSec:5,maxDurationSec:15}}]});api.download.mockResolvedValue(undefined);api.save.mockResolvedValue('saved');api.project.mockResolvedValue({runsById:{}});api.history.mockResolvedValue({items:[],hasMore:false});api.submit.mockResolvedValue(done);api.read.mockResolvedValue(done);});

// ── 2026-10-20 production follow-ups: failed drafts and spoken specs ────────────────────────────────────────────────
// The video node as production left it: user-made, a description with 16:9 / 4 秒, defaults 9:16 / 8 s, one picture.
const retiredFailure={...node,storageKey:undefined,metadata:{status:'error' as const,prompt:'画幅 16:9，时长 4 秒',model:'model',seconds:'8',size:'720x1280',
  studio:{kind:'shot' as const,request:{...request,model:'retired-seedance',prompt:'画幅 16:9，时长 4 秒'},runId:'IPR-fde32da6c2cc4664974f',
    task:{status:'failed' as const,stage:'failed',pct:100,errorCode:'VIDEO_MODEL_RETIRED',errorMessage:'这个视频模型已被提供方下架，不能再用它生成，请换一个模型',logId:'M64E8LSCR77Q'}}}};
test('a draft whose model was retired offers 换模型重试 only, and the composer does not reuse that model',async()=>{
 api.models.mockResolvedValue({image:[],video:[{endpointId:'retired-seedance',name:'Seedance（已下架）',creditCost:80},{endpointId:'h3',name:'H3',isDefault:true,creditCost:40,capability:{minDurationSec:5,maxDurationSec:15}}]});
 render(<Host initial={retiredFailure}/>);openVideo();
 await waitFor(()=>expect(api.models).toHaveBeenCalled());
 await waitFor(()=>expect(screen.getByRole('button',{name:'换模型重试'})).toBeDefined());
 expect(screen.queryByRole('button',{name:'重新生成',exact:true})).toBeNull();
 expect(screen.queryByRole('button',{name:'重新生成视频',exact:true})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'换模型重试'}));
 const panel=await screen.findByRole('dialog',{name:'生成视频'});
 await waitFor(()=>expect(within(panel).getByRole('button',{name:'生成模型'}).textContent).toContain('H3'));
 expect(within(panel).getByText(/上次用的模型已不可用，这次改用「H3」/)).toBeDefined();
 expect(api.submit).not.toHaveBeenCalled();
});
test('retry never resubmits to a model the last failure proved gone',async()=>{
 api.models.mockResolvedValue({image:[],video:[{endpointId:'h3',name:'H3',isDefault:true,creditCost:40}]});
 const failed={...retiredFailure,metadata:{...retiredFailure.metadata,studio:{...retiredFailure.metadata.studio,task:{...retiredFailure.metadata.studio.task,errorCode:'VIDEO_SUBMIT_FAILED'}}}};
 render(<Host initial={failed}/>);openVideo();
 await waitFor(()=>expect(api.models).toHaveBeenCalled());
 // the old model is no longer offered at all: the same request is not sent again
 await waitFor(()=>expect(screen.getByRole('button',{name:'换模型重试'})).toBeDefined());
 expect(api.submit).not.toHaveBeenCalled();
});
test('an outage exposes one saved-request retry inside the editor without a duplicate editor launcher',async()=>{
 const busy={...retiredFailure,metadata:{...retiredFailure.metadata,studio:{...retiredFailure.metadata.studio,request:{...request},task:{status:'failed' as const,stage:'failed',pct:100,errorCode:'DAP_MODEL_HTTP_503',errorMessage:'模型服务暂时不可用（上游 503），请稍后重试'}}}};
 render(<Host initial={busy}/>);openVideo();
 await waitFor(()=>expect(api.models).toHaveBeenCalled());
 await waitFor(()=>expect(screen.getAllByRole('button',{name:'重新生成'})).toHaveLength(1));
 expect(screen.queryByRole('button',{name:'换模型重试'})).toBeNull();
 expect(screen.queryByRole('button',{name:'重新生成视频',exact:true})).toBeNull();
});
test('the assistant spec opens the composer at 16:9 / 4 秒; a duration the model cannot do blocks with a fix instead of being clamped',async()=>{
 api.models.mockResolvedValue({image:[],video:[{endpointId:'model',name:'model',isDefault:true,creditCost:80,capability:{minDurationSec:5,maxDurationSec:15}}]});
 const draft={...node,metadata:{status:'idle' as const,prompt:'两人分坐沙发两侧，时长 4 秒',size:'720x1280',seconds:'8',
   studio:{kind:'shot' as const,spec:{aspectRatio:'16:9',durationSec:4,source:'assistant' as const,updatedAt:'2026-10-20T15:11:27Z'}}}};
 render(<Host initial={draft}/>);
 await waitFor(()=>expect(api.models).toHaveBeenCalled());
 openVideo();
 const panel=await screen.findByRole('dialog',{name:'生成视频'});
 await waitFor(()=>expect(snapshot[0].metadata?.studio?.composerDraft).toMatchObject({aspectRatio:'16:9',durationSec:4}));
 const blocker=within(panel).getByRole('alert');
 expect(blocker.textContent).toContain('没有 4 秒');
 expect((within(panel).getByRole('button',{name:'生成视频'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(within(blocker).getByRole('button',{name:'改成 5 秒'}));
 await waitFor(()=>expect(snapshot[0].metadata?.studio?.composerDraft?.durationSec).toBe(5));
 expect(within(panel).queryByRole('alert')).toBeNull();
 // The description still says 4 秒: asked before paying, and keeping the settings sends exactly them.
 fireEvent.click(within(panel).getByRole('button',{name:'生成视频'}));
 const ask=await screen.findByRole('dialog',{name:'描述和设置不一致'});
 expect(ask.textContent).toContain('4 秒');expect(api.submit).not.toHaveBeenCalled();
 fireEvent.click(within(ask).getByRole('button',{name:'按当前设置生成'}));
 await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());
 expect(api.submit.mock.calls[0][1]).toMatchObject({durationSec:5,aspectRatio:'16:9'});
});
test('a description that names another ratio is asked about; adopting it changes the settings and sends nothing',async()=>{
 const draft={...node,metadata:{status:'idle' as const,prompt:'用人物和客厅图片做视频，画幅 16:9',studio:{kind:'shot' as const}}};
 render(<Host initial={draft}/>);
 await waitFor(()=>expect(api.models).toHaveBeenCalled());
 openVideo();
 const panel=await screen.findByRole('dialog',{name:'生成视频'});
 fireEvent.click(within(panel).getByRole('button',{name:'生成视频'}));
 const ask=await screen.findByRole('dialog',{name:'描述和设置不一致'});
 fireEvent.click(within(ask).getByRole('button',{name:'按描述改设置'}));
 await waitFor(()=>expect(snapshot[0].metadata?.studio?.composerDraft?.aspectRatio).toBe('16:9'));
 expect(api.submit).not.toHaveBeenCalled();
});
