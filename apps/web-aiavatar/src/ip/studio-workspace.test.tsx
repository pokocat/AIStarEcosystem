// @vitest-environment jsdom
import {useState} from 'react';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {ApiError} from '@ai-star-eco/api-client';
import type {CanvasNodeData,CanvasConnection} from '@/canvas/types/canvas';
import {StudioWorkspace} from './studio-workspace';
import {useCanvasStore} from '@/canvas/stores/canvas/use-canvas-store';
const api=vi.hoisted(()=>({submit:vi.fn(),speech:vi.fn(),lip:vi.fn(),save:vi.fn(),read:vi.fn(),project:vi.fn(),history:vi.fn(),error:vi.fn(),info:vi.fn(),success:vi.fn(),download:vi.fn(),cancel:vi.fn()}));
vi.mock('./studio-floating-panel',()=>({StudioFloatingPanel:({open,title,children,onClose,footer}:any)=>open?<section role="dialog" aria-label={title}><button aria-label={title==='生成视频'||title==='生成图片'||title==='创作剧本'||title==='拆分镜头'?'关闭创作面板':`关闭${title}`} onClick={onClose}>关闭</button>{children}{footer}</section>:null}));
vi.mock('@/canvas-bridge/download-media',()=>({downloadMedia:api.download}));
vi.mock('./api',()=>({IpStudioApi:{listProjectRuns:api.history}}));
vi.mock('./studio-template-library',()=>({StudioTemplateLibrary:({open,scope}:any)=>open?<section role="dialog" aria-label="画布模板">{scope}</section>:null}));
vi.mock('@/canvas-bridge/studio-api',()=>({studioCapabilities:async()=>({mock:false,operations:['video'],videoCost:80}),readStudioProject:api.project,submitStudioRun:api.submit,submitStudioSpeech:api.speech,submitStudioLipSync:api.lip,listStudioIps:async()=>[],listStudioIpAssets:async()=>[]}));
vi.mock('@/canvas-bridge/studio-save',()=>({saveStudioDocument:api.save}));
vi.mock('@/canvas-bridge/api',()=>({readRun:api.read,cancelRun:api.cancel,fetchModels:async()=>({image:[],video:[{endpointId:'model',name:'model',creditCost:80,capability:{minDurationSec:5,maxDurationSec:15}}]}),fetchStudioVideoModels:async()=>[]}));
vi.mock('@/canvas-bridge/models',()=>({SERVER_CHANNEL_ID:'server',endpointIdFor:()=> 'model'}));
vi.mock('@/canvas-bridge/config-store',()=>({encodeChannelModel:(_:string,m:string)=>m}));
vi.mock('./studio-script-rich-editor',async()=>{
 const {forwardRef}=await import('react');
 return {StudioScriptRichEditor:forwardRef(({markdown,onChange,readOnly}:any,_ref:any)=>readOnly?<article>{markdown}</article>:<textarea aria-label="剧本文档" value={markdown} onChange={e=>onChange(e.target.value)}/>)};
});
vi.mock('antd',()=>{
 const Input=({children,...p}:any)=><input {...p}/>;Input.TextArea=({autoSize,...p}:any)=><textarea {...p}/>;
 const message={error:api.error,info:api.info,success:api.success};
 return {App:{useApp:()=>({message})},Input, Segmented:({options,value,onChange}:any)=><div>{options.map((o:string)=><button key={o} aria-pressed={o===value} onClick={()=>onChange(o)}>{o}</button>)}</div>,
 Button:({loading,block,type,icon,size,...p}:any)=><button {...p} disabled={loading||p.disabled}>{p.children}</button>,
 Drawer:({open,title,children,onClose,footer}:any)=>open?<section role="dialog" aria-label={title}><button aria-label="关闭创作面板" onClick={onClose}>关闭</button>{children}{footer}</section>:null,
 Modal:({open,title,children,onCancel}:any)=>open?<section role="dialog" aria-label={title||'剧本编辑器'}>{onCancel&&<button aria-label={`关闭${title}`} onClick={onCancel}>关闭</button>}{children}</section>:null,
 Select:({options,value,onChange,mode,...p}:any)=><select multiple={mode==='multiple'} aria-label={p['aria-label']} value={value??(mode==='multiple'?[]:'')} onChange={e=>onChange(mode==='multiple'?Array.from(e.target.selectedOptions).map(o=>o.value):options.find((o:any)=>String(o.value)===e.target.value)?.value)}>{(options||[]).map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
 Checkbox:({children,...p}:any)=><label><input type="checkbox" {...p}/>{children}</label>,Dropdown:({children}:any)=>children,Tabs:({items}:any)=><>{items.map((item:any)=><section key={item.key}>{item.children}</section>)}</>};
});
vi.mock('./studio-commerce',()=>({StudioCommerce:()=>null}));
vi.mock('./studio-speech',()=>({StudioSpeech:()=>null}));
vi.mock('./studio-voice-adopt',()=>({StudioVoiceAdopt:()=>null}));
vi.mock('./studio-lip-sync',()=>({StudioLipSync:({open,initialNodeId}:any)=>open?<section role="dialog" aria-label="人物口型同步"><span data-testid="lip-origin">{initialNodeId||'no origin'}</span></section>:null}));
vi.mock('./studio-assistant',()=>({StudioAssistant:({open,initialNodeId}:any)=>open?<section role="dialog" aria-label="AI 创作助手">{initialNodeId}</section>:null}));
vi.mock('./studio-batch-panel',()=>({StudioBatchPanel:({open,initialNodeId}:any)=>open?<section role="dialog" aria-label="制作计划">{initialNodeId}</section>:null}));
vi.mock('./studio-ip-library',()=>({StudioIpLibrary:()=>null}));
vi.mock('./studio-video-controls',()=>({StudioVideoControls:()=>null}));
vi.mock('./studio-motion-prompt',()=>({StudioMotionPrompt:({value,onChange,references}:any)=><textarea data-references={JSON.stringify(references.map((r:any)=>[r.nodeId,r.label]))} aria-label="创作要求" value={value} onChange={e=>onChange(e.target.value)}/>}));
vi.mock('@/canvas-bridge/signed-image',()=>({SignedImage:()=>null}));
vi.mock('@/canvas-bridge/signed-video',()=>({SignedVideo:()=>null}));
const node:CanvasNodeData={id:'v',type:'video' as never,title:'old adopted',width:320,height:400,position:{x:0,y:0},metadata:{status:'success',prompt:'saved prompt',storageKey:'old.mp4',content:'/old.mp4',primaryVideoId:'old',videos:[{id:'old',status:'success',storageKey:'old.mp4',content:'/old.mp4'}],model:'model',seconds:'8',videoCount:'4',size:'768x1365',vquality:'768',studio:{kind:'shot',episodeNo:2,order:3,includeInWork:false}}};
const request={clientRequestId:'original-key',nodeId:'v',operation:'video' as const,prompt:'original prompt',model:'model',count:4,durationSec:8,aspectRatio:'9:16',maxCost:320};
const done={id:'accepted',projectId:'p',nodeId:'v',kind:'studio-video',status:'done',pct:100,cost:320,inputs:request,output:{videoCandidates:[{index:0,jobId:'job',status:'done',pct:100,durationSec:8,storageKey:'new.mp4',url:'/new.mp4'}]},createdAt:''};
let snapshot:CanvasNodeData[]=[];
let connectionSnapshot:CanvasConnection[]=[];
function Host({initial=node,initialNodes,initialConnections=[]}:any){const[nodes,setNodes]=useState<CanvasNodeData[]>(initialNodes||[initial]);snapshot=nodes;const[connections,setConnections]=useState<CanvasConnection[]>(initialConnections);connectionSnapshot=connections;return <StudioWorkspace projectId="p" nodes={nodes} connections={connections} selectedNodeIds={new Set(['v'])} setNodes={setNodes} setConnections={setConnections} onFocusNode={()=>{}} onClosePanel={()=>{}} onRestorePanel={()=>{}}/>;}
const openVideo=()=>{fireEvent(window,new CustomEvent('studio-command',{detail:{action:'video',nodeId:'v'}}));const summary=document.querySelector('.studio-composer-settings summary');if(summary)fireEvent.click(summary);};
afterEach(cleanup);
beforeEach(()=>{vi.resetAllMocks();api.download.mockResolvedValue(undefined);api.save.mockResolvedValue('saved');api.project.mockResolvedValue({runsById:{}});api.history.mockResolvedValue({items:[],hasMore:false});api.submit.mockResolvedValue(done);api.read.mockResolvedValue(done);});
test('a lost submit response replaces ordinary generation with same-key confirmation even after editing the draft',async()=>{
 api.submit.mockRejectedValueOnce(new TypeError('Failed to fetch'));render(<Host/>);openVideo();
 await waitFor(()=>expect((screen.getByRole('button',{name:'生成视频',exact:true}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'生成视频',exact:true}));await waitFor(()=>expect(api.error).toHaveBeenCalledWith('Failed to fetch'));
 expect(screen.queryByRole('button',{name:'生成视频',exact:true})).toBeNull();const original=api.submit.mock.calls[0][1];expect(snapshot[0].metadata?.storageKey).toBe('old.mp4');expect(snapshot[0].metadata?.studio?.request).toEqual(original);
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'changed after timeout'}});
 fireEvent.click(screen.getAllByRole('button',{name:'确认原任务'})[0]);await waitFor(()=>expect(api.submit).toHaveBeenCalledTimes(2));expect(api.submit.mock.calls[1][1]).toEqual(original);
 await waitFor(()=>expect(snapshot[0].metadata?.status).toBe('success'));expect(snapshot[0].metadata).toMatchObject({storageKey:'old.mp4',primaryVideoId:'old'});expect(snapshot[0].metadata?.studio).toMatchObject({episodeNo:2,order:3,includeInWork:false});
});
test('refresh restores cancelled queue semantics without replaying adopted results or submitting work',async()=>{
 const cancelled={...done,status:'failed',stage:'cancelled',pct:0,errorCode:'IP_RUN_CANCELLED',errorMessage:'已停止排队'};
 api.project.mockResolvedValue({runsById:{accepted:cancelled}});
 render(<Host initial={{...node,metadata:{...node.metadata,status:'error',errorDetails:'已停止排队',studio:{...node.metadata!.studio,request,runId:'accepted',task:{status:'failed',stage:'cancelled',pct:0}}}}}/>);
 await waitFor(()=>expect(snapshot[0].metadata?.studio?.task).toMatchObject({status:'failed',errorCode:'IP_RUN_CANCELLED',queue:null}));
 expect(snapshot[0].metadata).toMatchObject({storageKey:'old.mp4',content:'/old.mp4',primaryVideoId:'old'});
 expect(api.submit).not.toHaveBeenCalled();expect(api.read).not.toHaveBeenCalled();
});
test('refresh with an active accepted batch offers its existing task rather than a new submit',async()=>{
 render(<Host initial={{...node,metadata:{...node.metadata,status:'loading',studio:{...node.metadata!.studio,request,runId:'accepted'}}}}/>);openVideo();
 expect(screen.queryByRole('button',{name:'生成视频',exact:true})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'查看原任务'}));await waitFor(()=>expect(screen.getByRole('dialog',{name:'创作任务'})).toBeDefined());expect(api.submit).not.toHaveBeenCalled();expect(snapshot[0].metadata?.studio?.request).toEqual(request);
});
test('refresh of an unknown outcome confirms the original body; repeated network failures do not unlock a new key',async()=>{
 api.submit.mockRejectedValue(new TypeError('network'));render(<Host initial={{...node,metadata:{...node.metadata,status:'loading',studio:{...node.metadata!.studio,request}}}}/>);openVideo();fireEvent.click(screen.getAllByRole('button',{name:'确认原任务'})[0]);await waitFor(()=>expect(api.error).toHaveBeenCalledWith('network'));expect(api.submit.mock.calls[0][1]).toEqual(request);expect(screen.queryByRole('button',{name:'生成视频',exact:true})).toBeNull();expect(snapshot[0].metadata?.studio?.request?.clientRequestId).toBe('original-key');
});
test('a definite unaccepted server rejection permits an edited request with a new key',async()=>{
 api.submit.mockRejectedValueOnce(new ApiError({code:'STUDIO_PRICE_CHANGED',message:'price changed'},409));render(<Host/>);openVideo();await waitFor(()=>expect((screen.getByRole('button',{name:'生成视频',exact:true}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'生成视频',exact:true}));await waitFor(()=>expect(api.error).toHaveBeenCalledWith('price changed'));const old=api.submit.mock.calls[0][1];fireEvent.change(screen.getByRole('textbox'),{target:{value:'edited after rejection'}});fireEvent.click(screen.getByRole('button',{name:'生成视频',exact:true}));await waitFor(()=>expect(api.submit).toHaveBeenCalledTimes(2));expect(api.submit.mock.calls[1][1].clientRequestId).not.toBe(old.clientRequestId);expect(api.submit.mock.calls[1][1].prompt).toBe('edited after rejection');
});
test('polling failure on an accepted batch keeps the original task locked without posting a replacement',async()=>{
 const active={...done,status:'running',pct:20,output:{videoCandidates:[{index:0,jobId:'job',status:'running',pct:20,durationSec:8}]}};
 api.project.mockResolvedValue({runsById:{accepted:active}});api.read.mockRejectedValue(new TypeError('polling network failure'));
 render(<Host initial={{...node,metadata:{...node.metadata,status:'loading',studio:{...node.metadata!.studio,request,runId:'accepted'}}}}/>);openVideo();
 await waitFor(()=>expect(api.read).toHaveBeenCalledWith('accepted'),{timeout:3500});expect(screen.queryByRole('button',{name:'生成视频',exact:true})).toBeNull();expect(screen.getByRole('button',{name:'查看原任务'})).toBeDefined();expect(snapshot[0].metadata?.status).toBe('loading');expect(snapshot[0].metadata?.studio?.request).toEqual(request);expect(api.submit).not.toHaveBeenCalled();
});
test.each(['save offline','document conflict'])('a local %s during unknown-task recovery retains the saved request and keeps ordinary generation locked',failure=>{
 return (async()=>{
  api.save.mockRejectedValueOnce(new Error(failure));render(<Host initial={{...node,metadata:{...node.metadata,status:'loading',studio:{...node.metadata!.studio,request}}}}/>);openVideo();fireEvent.click(screen.getAllByRole('button',{name:'确认原任务'})[0]);await waitFor(()=>expect(api.error).toHaveBeenCalledWith(failure));
  expect(api.submit).not.toHaveBeenCalled();expect(snapshot[0].metadata?.status).toBe('loading');expect(snapshot[0].metadata?.studio?.request).toEqual(request);expect(screen.queryByRole('button',{name:'生成视频',exact:true})).toBeNull();
  fireEvent.click(screen.getAllByRole('button',{name:'确认原任务'})[0]);await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());expect(api.submit.mock.calls[0][1]).toEqual(request);expect(snapshot[0].metadata?.studio?.request?.clientRequestId).toBe('original-key');
 })();
});
test('a known active batch keeps ordinary generation locked when local saving is unavailable',async()=>{
 api.save.mockRejectedValue(new Error('save offline'));render(<Host initial={{...node,metadata:{...node.metadata,status:'loading',studio:{...node.metadata!.studio,request,runId:'accepted'}}}}/>);openVideo();fireEvent.click(screen.getByRole('button',{name:'查看原任务'}));await waitFor(()=>expect(screen.getByRole('dialog',{name:'创作任务'})).toBeDefined());expect(api.submit).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled();expect(snapshot[0].metadata?.status).toBe('loading');expect(snapshot[0].metadata?.studio).toMatchObject({request,runId:'accepted'});
});
test.each(['speech','lip'])('an unknown %s task retains its original identity across a failed save and a lost confirmation response',async kind=>{
 const original={clientRequestId:'original-native-key',nodeId:'v',model:'tts',speaker:'Vivian',text:'奶白杯身，浅紫杯盖。',maxCost:8,...(kind==='lip'?{videoStorageKey:'clip.mp4',audioStorageKey:'voice.wav'}:{})};
 const submit=kind==='speech'?api.speech:api.lip;submit.mockRejectedValueOnce(new TypeError('confirmation response lost'));
 api.save.mockRejectedValueOnce(new Error('save offline'));
 render(<Host initial={{...node,type:kind==='speech'?'audio':'video',metadata:{status:'loading',studio:{kind:'audio',...(kind==='speech'?{speechRequest:original}:{lipSyncRequest:original})}}}}/>);
 fireEvent.click(screen.getByRole('button',{name:'查看创作任务'}));
 fireEvent.click((await screen.findAllByRole('button',{name:'确认原任务'}))[0]);
 await waitFor(()=>expect(api.error).toHaveBeenCalledWith('save offline'));
 expect(submit).not.toHaveBeenCalled();expect(snapshot[0].metadata?.status).toBe('loading');
 fireEvent.click(screen.getAllByRole('button',{name:'确认原任务'})[0]);
 await waitFor(()=>expect(api.error).toHaveBeenCalledWith('confirmation response lost'));
 expect(submit.mock.calls[0][1]).toEqual(original);expect(snapshot[0].metadata?.status).toBe('loading');
 submit.mockResolvedValueOnce({...done,nodeId:'v',kind:kind==='speech'?'studio-audio':'studio-lip-sync',cost:8,output:{}});
 fireEvent.click(screen.getAllByRole('button',{name:'确认原任务'})[0]);
 await waitFor(()=>expect(submit).toHaveBeenCalledTimes(2));expect(submit.mock.calls[1][1]).toEqual(original);
 expect(snapshot).toHaveLength(1);expect(api.submit).not.toHaveBeenCalled();
});
test('video generation persists and submits the full edited camera instruction as prompt text',async()=>{
 render(<Host/>);openVideo();await waitFor(()=>expect((screen.getByRole('button',{name:'生成视频',exact:true}) as HTMLButtonElement).disabled).toBe(false));
 const full='人物走向橱窗。镜头缓慢向前推进，逐渐靠近主体，保持主体在画面中央。';
 fireEvent.change(screen.getByRole('textbox',{name:'创作要求'}),{target:{value:full}});fireEvent.click(screen.getByRole('button',{name:'生成视频',exact:true}));
 await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());expect(api.submit.mock.calls[0][1].prompt).toBe(full);expect(snapshot[0].metadata?.prompt).toBe(full);expect(snapshot[0].metadata?.studio?.request?.prompt).toBe(full);expect(api.save).toHaveBeenCalled();
});

test('closing and reopening the unified editor preserves an editable draft without changing or submitting the accepted request',async()=>{
 render(<Host/>);
 openVideo();
 await screen.findByRole('textbox',{name:'创作要求'});
 fireEvent.change(screen.getByRole('textbox',{name:'创作要求'}),{target:{value:'镜头缓慢推进，保留人物服装'}});
 fireEvent.click(screen.getByRole('button',{name:'关闭创作面板'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'生成视频'})).toBeNull());
 openVideo();
 await waitFor(()=>expect((screen.getByRole('textbox',{name:'创作要求'}) as HTMLTextAreaElement).value).toBe('镜头缓慢推进，保留人物服装'));
 expect(snapshot[0].metadata?.studio?.composerDraft?.prompt).toBe('镜头缓慢推进，保留人物服装');
 expect(api.submit).not.toHaveBeenCalled();expect(snapshot[0].metadata?.storageKey).toBe('old.mp4');
});

test('opening immediately after adding a node resolves the new document node before React props catch up',async()=>{
 const fresh={...node,id:'fresh-video',metadata:{...node.metadata,prompt:'刚新增节点的创作要求'}};
 const spy=vi.spyOn(useCanvasStore,'getState').mockReturnValue({projects:[{id:'p',nodes:[fresh]}]} as never);
 try {
  render(<Host/>);
  fireEvent(window,new CustomEvent('studio-command',{detail:{action:'video',nodeId:'fresh-video'}}));
  await waitFor(()=>expect((screen.getByRole('textbox',{name:'创作要求'}) as HTMLTextAreaElement).value).toBe('刚新增节点的创作要求'));
  expect(api.submit).not.toHaveBeenCalled();
 }finally{spy.mockRestore();}
});

test('closing the editor waits for cloud save and keeps the draft actionable after a save failure',async()=>{
 api.save.mockRejectedValueOnce(new Error('草稿保存失败'));
 render(<Host/>);openVideo();
 fireEvent.change(await screen.findByRole('textbox',{name:'创作要求'}),{target:{value:'可重试的镜头草稿'}});
 fireEvent.click(screen.getByRole('button',{name:'关闭创作面板'}));
 await waitFor(()=>expect(api.error).toHaveBeenCalledWith('草稿保存失败'));
 expect(screen.getByRole('dialog',{name:'生成视频'})).toBeDefined();expect(snapshot[0].metadata?.studio?.composerDraft?.prompt).toBe('可重试的镜头草稿');
 fireEvent.click(screen.getByRole('button',{name:'关闭创作面板'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'生成视频'})).toBeNull());
 expect(api.save).toHaveBeenCalledTimes(2);expect(api.submit).not.toHaveBeenCalled();
});

test('a new canvas script resumes its saved draft and generation fills that same node',async()=>{
 const script={title:'花园里的小紫',outline:'发现花朵并浇水',characters:[],scenes:[],props:[],episodes:[{no:1,title:'清晨',content:'小紫给花浇水。'}],shots:[]};
 api.submit.mockImplementation(async(_project,body)=>({...done,nodeId:body.nodeId,kind:'studio-script',inputs:body,output:{script}}));
 render(<Host initialNodes={[]}/>);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'script'}}));
 const input=await screen.findByRole('textbox',{name:'创作要求'});
 fireEvent.change(input,{target:{value:'小紫给花浇水，两个镜头。'}});
 await waitFor(()=>expect(snapshot).toHaveLength(1));const id=snapshot[0].id;
 fireEvent.click(screen.getByRole('button',{name:'关闭创作面板'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'创作剧本'})).toBeNull());
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'script',nodeId:id}}));
 expect((await screen.findByRole('textbox',{name:'创作要求'}) as HTMLTextAreaElement).value).toBe('小紫给花浇水，两个镜头。');
 fireEvent.click(screen.getByRole('button',{name:'创作剧本',exact:true}));
 await waitFor(()=>expect(snapshot[0].metadata?.studio?.script?.title).toBe('花园里的小紫'));
 expect(api.submit).toHaveBeenCalledOnce();expect(api.submit.mock.calls[0][1].nodeId).toBe(id);
 expect(snapshot).toHaveLength(1);expect(snapshot[0].metadata?.studio?.composerDraft).toBeUndefined();
});

test('a lost script rewrite response confirms its successor request instead of creating another paid node',async()=>{
 const script={title:'Original',outline:'Keep this',characters:[],scenes:[],props:[],episodes:[{no:1,title:'One',content:'Edited body'}],shots:[]};
 api.submit.mockRejectedValueOnce(new TypeError('script response lost'));
 render(<Host initial={{...node,type:'text',metadata:{status:'success',studio:{kind:'script',script}}}}/>);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'script',nodeId:'v'}}));
 fireEvent.click(await screen.findByRole('button',{name:'创作剧本',exact:true}));
 await waitFor(()=>expect(api.error).toHaveBeenCalledWith('script response lost'));
 const original=api.submit.mock.calls[0][1];expect(original.nodeId).not.toBe('v');expect(snapshot).toHaveLength(2);
 expect(screen.queryByRole('button',{name:'创作剧本',exact:true})).toBeNull();
 fireEvent.click(screen.getAllByRole('button',{name:'确认原任务'})[0]);
 await waitFor(()=>expect(api.submit).toHaveBeenCalledTimes(2));expect(api.submit.mock.calls[1][1]).toEqual(original);
 expect(snapshot).toHaveLength(2);expect(snapshot[0].metadata?.studio?.script).toEqual(script);
});

test('saving an existing script is free and retries the same draft after a cloud-save failure',async()=>{
 api.save.mockRejectedValueOnce(new Error('import save failed'));render(<Host initialNodes={[]}/>);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'script'}}));
 fireEvent.change(await screen.findByRole('textbox',{name:'创作要求'}),{target:{value:'My script\nA complete scene.'}});
 fireEvent.click(screen.getByRole('checkbox',{name:'直接保存已有剧本'}));
 expect(screen.getByText('保存剧本 · 免费')).toBeDefined();
 const id=snapshot[0].id;fireEvent.click(screen.getByRole('button',{name:'保存并编辑剧本'}));
 await waitFor(()=>expect(api.error).toHaveBeenCalledWith('import save failed'));
 expect(snapshot).toHaveLength(1);expect(snapshot[0].metadata?.studio?.script?.episodes[0].content).toBe('My script\nA complete scene.');
 fireEvent.click(screen.getByRole('button',{name:'保存并编辑剧本'}));
 await screen.findByRole('dialog',{name:'剧本编辑器'});expect(snapshot).toHaveLength(1);expect(snapshot[0].id).toBe(id);
 expect(snapshot[0].metadata?.studio?.parentNodeId).toBeUndefined();expect(api.submit).not.toHaveBeenCalled();
});

test('editor save failure retains edited script and splitting after another edit cannot restore obsolete content',async()=>{
 const script={title:'Original',outline:'Outline',characters:[],scenes:[],props:[],episodes:[{no:1,title:'One',content:'Old scene'}],shots:[]};
 const composerDraft={operation:'storyboard',prompt:'obsolete split snapshot',referenceNodeIds:[],aspectRatio:'9:16',count:1,durationSec:5,settings:{},video:{mode:'t2v',tier:'768p'}};
 api.save.mockRejectedValueOnce(new Error('editor save failed'));
 render(<Host initial={{...node,type:'text',metadata:{status:'success',studio:{kind:'script',script,composerDraft}}}}/>);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'editor',nodeId:'v'}}));
 const markdown=await screen.findByRole('textbox',{name:'剧本文档'}) as HTMLTextAreaElement;
 fireEvent.change(markdown,{target:{value:markdown.value.replace('Old scene','Newest edited scene')}});
 fireEvent.click(screen.getByRole('button',{name:'返回画布'}));
 await waitFor(()=>expect(api.error).toHaveBeenCalledWith('editor save failed'));
 expect(screen.getByRole('dialog',{name:'剧本编辑器'})).toBeDefined();
 fireEvent.click(screen.getByRole('button',{name:'返回画布'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'剧本编辑器'})).toBeNull());
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'split',nodeId:'v'}}));
 const prompt=(await screen.findByRole('textbox',{name:'创作要求'}) as HTMLTextAreaElement).value;
 expect(prompt).toContain('Newest edited scene');expect(prompt).not.toContain('obsolete split snapshot');expect(api.submit).not.toHaveBeenCalled();
});

test('task history retains a replaced failure after refresh and paginates without offering to resubmit that old request',async()=>{
 const previous={...done,id:'failed-before-retry',status:'failed',cost:0,createdAt:'2026-10-08T00:00:00Z'};
 const latest={...done,createdAt:'2026-10-08T00:01:00Z'};
 api.project.mockResolvedValue({runsById:{accepted:latest}});
 api.history.mockResolvedValueOnce({items:[latest,previous],hasMore:true}).mockResolvedValueOnce({items:[{...done,id:'older-history',createdAt:'2026-10-07T00:00:00Z'}],hasMore:false});
 render(<Host initial={{...node,metadata:{...node.metadata,studio:{...node.metadata!.studio,runId:'accepted'}}}}/>);
 fireEvent.click(screen.getByRole('button',{name:'查看创作任务'}));
 await screen.findByText('生成失败');expect(screen.getByText('0 积分')).toBeDefined();expect(screen.queryByRole('button',{name:'重新生成',exact:true})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'加载更多任务'}));
 await waitFor(()=>expect(api.history).toHaveBeenLastCalledWith('p',1));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'加载更多任务'})).toBeNull());expect(api.submit).not.toHaveBeenCalled();
});

test('reopening reconciles added/removed graph references with the saved draft, and reference edits update the graph without submitting',async()=>{
 const a:CanvasNodeData={...node,id:'a',type:'image' as never,title:'old frame',metadata:{storageKey:'a.png',content:'/a.png',status:'success'}};
 const b:CanvasNodeData={...a,id:'b',title:'new frame',metadata:{...a.metadata,storageKey:'b.png'}};
 const draft={operation:'video' as const,prompt:'preserved direction',referenceNodeIds:['a'],connectedReferenceNodeIds:['a'],aspectRatio:'9:16',model:'model',count:1,durationSec:8,settings:{},video:{mode:'i2v' as const,tier:'768p',firstId:'a'}};
 render(<Host initialNodes={[{...node,metadata:{...node.metadata,studio:{kind:'shot',composerDraft:draft}}},a,b]} initialConnections={[{id:'new-edge',fromNodeId:'b',toNodeId:'v'}]}/>);openVideo();
 await waitFor(()=>expect(snapshot[0].metadata?.studio?.composerDraft?.referenceNodeIds).toEqual(['b']));
 expect((screen.getByRole('textbox',{name:'创作要求'}) as HTMLTextAreaElement).value).toBe('preserved direction');
 fireEvent.change(screen.getByRole('listbox',{name:'参考素材'}),{target:{value:'a'}});
 await waitFor(()=>expect(connectionSnapshot.map(c=>c.fromNodeId)).toEqual(['a']));
 expect(snapshot[0].metadata?.storageKey).toBe('old.mp4');expect(api.submit).not.toHaveBeenCalled();
});

test('a text wired into a video is visible and its current content is snapshotted in the submitted prompt',async()=>{
 const text:CanvasNodeData={...node,id:'story',type:'text' as never,title:'动作设定',metadata:{content:'人物抬手、转身，镜头保持平稳。'}};
 render(<Host initialNodes={[node,text]} initialConnections={[{id:'text-edge',fromNodeId:'story',toNodeId:'v'}]}/>);openVideo();
 await screen.findByRole('button',{name:'移除文本引用 动作设定'});
 await waitFor(()=>expect((screen.getByRole('button',{name:'生成视频',exact:true}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'生成视频',exact:true}));
 await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());
 expect(api.submit.mock.calls[0][1].prompt).toContain('【引用文本：动作设定】\n人物抬手、转身，镜头保持平稳。');
 expect(snapshot[0].metadata?.studio?.request?.prompt).toBe(api.submit.mock.calls[0][1].prompt);
});

test('removing a wired text from the composer removes its edge before generating',async()=>{
 const text:CanvasNodeData={...node,id:'story',type:'text' as never,title:'动作设定',metadata:{content:'不再使用的动作'}};
 render(<Host initialNodes={[node,text]} initialConnections={[{id:'text-edge',fromNodeId:'story',toNodeId:'v'}]}/>);openVideo();
 fireEvent.click(await screen.findByRole('button',{name:'移除文本引用 动作设定'}));
 await waitFor(()=>expect(connectionSnapshot).toEqual([]));
 fireEvent.click(screen.getByRole('button',{name:'生成视频',exact:true}));
 await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());expect(api.submit.mock.calls[0][1].prompt).not.toContain('不再使用的动作');
});

test('cutting an incoming media edge updates an open composer without submitting',async()=>{
 const image:CanvasNodeData={...node,id:'frame',type:'image' as never,title:'首帧',metadata:{storageKey:'frame.png',content:'/frame.png'}};
 render(<Host initialNodes={[node,image]} initialConnections={[{id:'frame-edge',fromNodeId:'frame',toNodeId:'v'}]}/>);openVideo();
 await waitFor(()=>expect(snapshot[0].metadata?.studio?.composerDraft?.referenceNodeIds).toContain('frame'));
 fireEvent(window,new CustomEvent('studio-reference-removed',{detail:{nodeId:'frame',targetId:'v'}}));
 await waitFor(()=>expect(snapshot[0].metadata?.studio?.composerDraft?.referenceNodeIds).toEqual([]));
 await waitFor(()=>expect(connectionSnapshot).toEqual([]));expect(api.submit).not.toHaveBeenCalled();
});

test.each(['image','video'])('a template %s node opens its execution step without opening or submitting the ordinary generator',async operation=>{
 const listener=vi.fn();window.addEventListener('studio-template-step',listener);
 try {
  render(<Host initial={{...node,type:operation,metadata:{status:'idle',templateStepId:'locked-step',prompt:'template instruction'}}}/>);
  fireEvent(window,new CustomEvent('studio-command',{detail:{action:operation,nodeId:'v'}}));
  expect(listener).toHaveBeenCalledOnce();expect(listener.mock.calls[0][0].detail).toEqual({projectId:'p',stepId:'locked-step'});
  expect(screen.queryByRole('dialog',{name:operation==='video'?'生成视频':'生成图片'})).toBeNull();expect(api.submit).not.toHaveBeenCalled();
 } finally {window.removeEventListener('studio-template-step',listener);}
});

test('blank and unaccepted template videos cannot enter assembly; server acceptance makes the clip available',async()=>{
 const pending={...node,metadata:{...node.metadata,templateStepId:'video',studio:{...node.metadata!.studio,kind:'shot',templateAccepted:false}}};
 render(<Host initial={pending}/>);
 expect((screen.getByRole('button',{name:'加入成片'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'work'}}));
 expect(screen.getByText('还没有视频片段')).toBeDefined();expect(screen.queryByRole('button',{name:'合成作品'})).toBeNull();
 cleanup();render(<Host initial={{...pending,metadata:{...pending.metadata,studio:{...pending.metadata.studio,kind:'shot',templateAccepted:true}}}}/>);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'work'}}));
 expect(screen.getByRole('button',{name:'合成作品'})).toBeDefined();expect(api.submit).not.toHaveBeenCalled();
});

test('work settings survive remount without assembly, and a failed save keeps the editor open for retry',async()=>{
 render(<Host/>);fireEvent(window,new CustomEvent('studio-command',{detail:{action:'work'}}));
 fireEvent.click(screen.getByRole('checkbox',{name:'添加品牌文字与字幕'}));
 fireEvent.change(screen.getByRole('textbox',{name:'成片标题文字'}),{target:{value:'新商品介绍'}});
 fireEvent.change(screen.getByRole('textbox',{name:'成片字幕时间与文字'}),{target:{value:'0-5: 日常随行'}});
 fireEvent.change(screen.getByRole('combobox',{name:'作品画幅'}),{target:{value:'16:9'}});
 const persisted=JSON.parse(JSON.stringify(snapshot));cleanup();render(<Host initialNodes={persisted}/>);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'work'}}));
 expect((screen.getByRole('textbox',{name:'成片标题文字'}) as HTMLInputElement).value).toBe('新商品介绍');
 expect((screen.getByRole('textbox',{name:'成片字幕时间与文字'}) as HTMLInputElement).value).toBe('0-5: 日常随行');
 expect((screen.getByRole('combobox',{name:'作品画幅'}) as HTMLSelectElement).value).toBe('16:9');
 api.save.mockRejectedValueOnce(new Error('成片配置保存失败'));
 fireEvent.click(screen.getByRole('button',{name:'返回画布'}));await waitFor(()=>expect(api.error).toHaveBeenCalledWith('成片配置保存失败'));
 expect(screen.getByRole('region',{name:'成片编辑器'})).toBeDefined();
 fireEvent.click(screen.getByRole('button',{name:'返回画布'}));await waitFor(()=>expect(screen.queryByRole('region',{name:'成片编辑器'})).toBeNull());
 expect(api.submit).not.toHaveBeenCalled();expect(snapshot.filter(n=>n.metadata?.studio?.workDraft)).toHaveLength(1);
});

test('assembly resumes saved packaging and adds the actual audio dependency without changing its settings',async()=>{
 const audio={id:'voice',type:'audio',title:'配音',position:{x:500,y:500},width:300,height:150,metadata:{status:'success',storageKey:'voice.wav'}};
 const draft={id:'draft',type:'text',title:'成片方案',position:{x:900,y:500},width:360,height:230,metadata:{studio:{kind:'work',workDraft:{aspectRatio:'16:9',packagingEnabled:true,brand:'杯子',title:'随行',cta:'了解更多',captionText:'0-5: 日常随行',voiceoverStorageKey:'voice.wav'}}}};
 api.submit.mockImplementation(async(_project,body)=>({...done,kind:'studio-assemble',nodeId:body.nodeId,inputs:body,output:{storageKey:'work.mp4',url:'/work.mp4'}}));
 render(<Host initialNodes={[{...node,metadata:{...node.metadata,studio:{...node.metadata!.studio!,includeInWork:true}}},audio,draft]}/>);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'work'}}));
 fireEvent.click(screen.getByRole('button',{name:'合成作品',exact:true}));await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());
 const body=api.submit.mock.calls[0][1];expect(body).toMatchObject({operation:'assemble',aspectRatio:'16:9',references:[{storageKey:'old.mp4',role:'clip'}],packaging:{brand:'杯子',title:'随行',cta:'了解更多',captions:[{start:0,end:5,text:'日常随行'}],voiceoverStorageKey:'voice.wav'}});
 expect(connectionSnapshot.some(c=>c.fromNodeId==='voice'&&c.toNodeId===body.nodeId)).toBe(true);
 expect(snapshot.find(n=>n.id==='draft')?.metadata?.studio?.workDraft).toEqual(draft.metadata.studio.workDraft);
});

test('selected episode survives saving the Markdown editor, closing and remounting a storyboard draft',async()=>{
 const script={title:'Two episodes',outline:'Original outline',characters:[{name:'小紫',description:'Same character'}],scenes:[],props:[],episodes:[{no:1,title:'One',content:'First episode stays'},{no:2,title:'Two',content:'Second episode to edit'}],shots:[]};
 render(<Host initial={{...node,type:'text',metadata:{status:'success',studio:{kind:'script',script}}}}/>);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'editor',nodeId:'v'}}));
 fireEvent.click(await screen.findByRole('button',{name:'创作面板'}));
 fireEvent.click(screen.getByRole('button',{name:'素材',exact:true}));
 fireEvent.change(await screen.findByRole('combobox',{name:'生成分镜的分集'}),{target:{value:'2'}});
 fireEvent.click(within(screen.getByRole('dialog',{name:'剧本编辑器'})).getByRole('button',{name:'生成分镜',exact:true}));
 fireEvent.change(await screen.findByRole('textbox',{name:'创作要求'}),{target:{value:'Only split episode two; preserve episode one.'}});
 fireEvent.click(screen.getByRole('button',{name:'关闭创作面板'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'拆分镜头'})).toBeNull());
 const persisted=JSON.parse(JSON.stringify(snapshot));cleanup();render(<Host initialNodes={persisted}/>);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'storyboard',nodeId:'v'}}));
 expect((await screen.findByRole('combobox',{name:'拆分分集'}) as HTMLSelectElement).value).toBe('2');
 expect((screen.getByRole('textbox',{name:'创作要求'}) as HTMLTextAreaElement).value).toBe('Only split episode two; preserve episode one.');
 expect(snapshot[0].metadata?.studio?.script).toEqual(script);expect(api.submit).not.toHaveBeenCalled();
});

test('an adaptation draft restores its mode, chosen story and settings, then snapshots current story text into the real request',async()=>{
 const story={id:'story',type:'text',title:'原故事',width:360,height:240,position:{x:0,y:0},metadata:{content:'小紫在花园发现一株花。'}};
 render(<Host initialNodes={[story]}/>);fireEvent(window,new CustomEvent('studio-command',{detail:{action:'script'}}));
 fireEvent.change(await screen.findByRole('textbox',{name:'创作要求'}),{target:{value:'保留发现花朵的情节，改成两集。'}});
 fireEvent.change(screen.getByRole('combobox',{name:'剧本创作模式'}),{target:{value:'adapt'}});
 fireEvent.change(screen.getByRole('combobox',{name:'改编素材'}),{target:{value:'story'}});
 fireEvent.change(screen.getByRole('textbox',{name:'人物与关系'}),{target:{value:'小紫，喜欢照顾花草。'}});
 fireEvent.change(screen.getByRole('textbox',{name:'叙事结构'}),{target:{value:'发现—照顾—回馈。'}});
 const id=snapshot[1].id;fireEvent.click(screen.getByRole('button',{name:'关闭创作面板'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'创作剧本'})).toBeNull());
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'script',nodeId:id}}));
 expect((await screen.findByRole('combobox',{name:'剧本创作模式'}) as HTMLSelectElement).value).toBe('adapt');
 expect((screen.getByRole('combobox',{name:'改编素材'}) as HTMLSelectElement).value).toBe('story');
 expect((screen.getByRole('textbox',{name:'人物与关系'}) as HTMLTextAreaElement).value).toBe('小紫，喜欢照顾花草。');
 fireEvent.click(screen.getByRole('button',{name:'创作剧本',exact:true}));await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());
 expect(api.submit.mock.calls[0][1]).toMatchObject({nodeId:id,mode:'adapt',settings:{characterBrief:'小紫，喜欢照顾花草。',structure:'发现—照顾—回馈。'}});
 expect(api.submit.mock.calls[0][1].prompt).toContain('小紫在花园发现一株花。');expect(snapshot[0].metadata).toEqual(story.metadata);expect(connectionSnapshot).toEqual(expect.arrayContaining([expect.objectContaining({fromNodeId:'story',toNodeId:id})]));
});

test('completed-script settings can be edited without changing the accepted request and are carried into the next split',async()=>{
 const script={title:'花园故事',outline:'发现花朵',characters:[],scenes:[],props:[],episodes:[{no:1,title:'清晨',content:'小紫浇花。'}],shots:[]};
 const accepted={...request,operation:'script',settings:{genre:'都市治愈',core:'old'}};
 render(<Host initial={{...node,type:'text',metadata:{status:'success',studio:{kind:'script',script,settings:accepted.settings,request:accepted}}}}/>);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'editor',nodeId:'v'}}));
 fireEvent.click(await screen.findByRole('button',{name:'创作面板'}));
 fireEvent.click(screen.getByRole('button',{name:'创作设定',exact:true}));
 fireEvent.change(await screen.findByRole('textbox',{name:'核心看点'}),{target:{value:'照顾与回馈'}});
 expect(snapshot[0].metadata?.studio?.request).toEqual(accepted);expect(snapshot[0].metadata?.studio?.script).toEqual(script);
 fireEvent.click(screen.getByRole('button',{name:'返回画布'}));await waitFor(()=>expect(screen.queryByRole('dialog',{name:'剧本编辑器'})).toBeNull());
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'split',nodeId:'v'}}));
 expect((await screen.findByRole('textbox',{name:'核心看点'}) as HTMLTextAreaElement).value).toBe('照顾与回馈');
 fireEvent.click(screen.getByRole('button',{name:'拆分镜头',exact:true}));await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());
 expect(api.submit.mock.calls[0][1].model).toBe(accepted.model);expect(api.submit.mock.calls[0][1].settings.core).toBe('照顾与回馈');expect(api.submit.mock.calls[0][1].prompt).toContain('小紫浇花。');
});

test('editing or removing a plain story flags its adaptation and retained work without changing an accepted request',async()=>{
 const script={title:'改编故事',outline:'发现花朵',characters:[],scenes:[],props:[],episodes:[{no:1,title:'清晨',content:'小紫浇花。'}],shots:[]};
 const story:CanvasNodeData={...node,id:'story',type:'text' as never,metadata:{content:'原故事正文'}};
 const adapted:CanvasNodeData={...node,type:'text' as never,metadata:{status:'success',studio:{kind:'script',script,scriptSourceNodeId:'story',request:{...request,operation:'script'}}}};
 const work:CanvasNodeData={...node,id:'work',metadata:{storageKey:'accepted-work.mp4',studio:{kind:'work',parentNodeId:'v'}}};
 function StoryHost(){
  const[nodes,setNodes]=useState([story,adapted,work]);snapshot=nodes;
  const[connections,setConnections]=useState<CanvasConnection[]>([]);connectionSnapshot=connections;
  return <><button onClick={()=>setNodes(list=>list.map(n=>n.id==='story'?{...n,metadata:{content:'已修改的正文'}}:n))}>修改原故事</button><button onClick={()=>setNodes(list=>list.filter(n=>n.id!=='story'))}>移除原故事</button><StudioWorkspace projectId="p" nodes={nodes} connections={connections} selectedNodeIds={new Set(['v'])} setNodes={setNodes} setConnections={setConnections} onFocusNode={()=>{}} onClosePanel={()=>{}} onRestorePanel={()=>{}}/></>;
 }
 render(<StoryHost/>);expect(snapshot.every(n=>!n.metadata?.studio?.upstreamChanged)).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'修改原故事'}));
 await waitFor(()=>expect(snapshot.find(n=>n.id==='v')?.metadata?.studio?.upstreamChanged).toBe(true));
 expect(snapshot.find(n=>n.id==='work')?.metadata).toMatchObject({storageKey:'accepted-work.mp4',studio:{upstreamChanged:true}});
 expect(snapshot.find(n=>n.id==='v')?.metadata?.studio?.request).toEqual(adapted.metadata!.studio!.request);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'editor',nodeId:'v'}}));
 expect(await screen.findByText('来源内容已修改。当前剧本和成片保留，可基于新内容再次改编。')).toBeDefined();
 fireEvent.click(screen.getByRole('button',{name:'移除原故事'}));
 expect(snapshot.find(n=>n.id==='work')?.metadata?.storageKey).toBe('accepted-work.mp4');expect(api.submit).not.toHaveBeenCalled();
});

test.each(['image','video'])('the %s download uses the newly adopted take and never creates another run',type=>{
 const takes=[{id:'old',status:'success',storageKey:'old-media',content:'/old'},{id:'new',status:'success',storageKey:'new-media',content:'/new'}];
 render(<Host initial={{...node,type,metadata:{status:'success',storageKey:'old-media',content:'/old',...(type==='image'?{images:takes,primaryImageId:'old'}:{videos:takes,primaryVideoId:'old'}),studio:{kind:'shot'}}}}/>);
 fireEvent.change(screen.getByRole('combobox',{name:'采用版本'}),{target:{value:'new'}});
 fireEvent.click(screen.getByRole('button',{name:type==='image'?'下载图片':'下载视频',exact:true}));
 expect(api.download).toHaveBeenCalledWith('/new','old adopted',undefined,'new-media');expect(api.submit).not.toHaveBeenCalled();
});

test('a queued video shows waiting instead of fake progress and can be stopped without a new submission',async()=>{
 const waiting={...done,status:'running',stage:'endpoint.queued',pct:0,output:{}};
 api.history.mockResolvedValue({items:[waiting],hasMore:false});api.cancel.mockResolvedValue({...waiting,status:'failed',errorCode:'IP_RUN_CANCELLED',cost:0});
 render(<Host/>);fireEvent.click(screen.getByRole('button',{name:'查看创作任务'}));
 expect(await screen.findByText('排队中 · 有空位后自动开始')).toBeDefined();
 expect(screen.queryByText('生成中 0%')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'停止排队'}));
 await waitFor(()=>expect(api.cancel).toHaveBeenCalledWith('accepted'));expect(api.submit).not.toHaveBeenCalled();
});

test('queue polling advances the displayed position and stops after the original task is cancelled',async()=>{
 const queued={...done,status:'running',stage:'endpoint.queued',pct:0,output:{},queue:{position:3,waiting:3,running:1,concurrencyLimit:1}};
 api.history.mockResolvedValue({items:[queued],hasMore:false});
 api.read.mockResolvedValue({...queued,queue:{...queued.queue,position:1,waiting:1}});
 api.cancel.mockResolvedValue({...queued,status:'failed',errorCode:'IP_RUN_CANCELLED',cost:0,queue:null});
 const pendingNode={...node,metadata:{...node.metadata,status:'loading',studio:{...node.metadata!.studio,runId:'accepted'}}};
 render(<Host initial={pendingNode}/>);fireEvent.click(screen.getByRole('button',{name:'查看创作任务'}));
 expect(await screen.findByText('排队提醒：当前模型请求量较高，你目前排在第 3 位。')).toBeDefined();
 expect(await screen.findByText('排队提醒：当前模型请求量较高，你目前排在第 1 位。',{}, {timeout:3000})).toBeDefined();
 expect(snapshot[0].metadata?.studio?.task?.queue?.position).toBe(1);
 fireEvent.click(screen.getByRole('button',{name:'停止排队'}));
 expect(await screen.findByText('已停止')).toBeDefined();
 expect(snapshot[0].metadata?.studio?.task?.queue).toBeNull();
 expect(api.cancel).toHaveBeenCalledWith('accepted');expect(api.submit).not.toHaveBeenCalled();
});

test('canvas reference picking keeps the original draft and creates one real upstream connection without submitting',async()=>{
 const image={id:'i',type:'image',title:'draft image',position:{x:0,y:0},width:320,height:240,metadata:{status:'idle',studio:{kind:'shot'}}} as CanvasNodeData;
 const ref={...image,id:'ref',title:'character reference',metadata:{status:'success',storageKey:'own-ref',content:'/ref.png'}} as CanvasNodeData;
 render(<Host initialNodes={[image,ref]}/>);
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'image',nodeId:'i'}}));
 fireEvent.change(screen.getByRole('textbox',{name:'创作要求'}),{target:{value:'保留角色，制作街头画面'}});
 fireEvent.click(screen.getByRole('button',{name:'参考',exact:true}));
 fireEvent(window,new CustomEvent('studio-reference-selected',{detail:{nodeId:'ref'}}));
 await waitFor(()=>expect(snapshot.find(n=>n.id==='i')?.metadata?.studio?.composerDraft).toMatchObject({prompt:'保留角色，制作街头画面',referenceNodeIds:['ref']}));
 expect(connectionSnapshot.filter(c=>c.fromNodeId==='ref'&&c.toNodeId==='i')).toHaveLength(1);
 fireEvent(window,new CustomEvent('studio-reference-selected',{detail:{nodeId:'ref'}}));
 expect(connectionSnapshot.filter(c=>c.fromNodeId==='ref'&&c.toNodeId==='i')).toHaveLength(1);expect(api.submit).not.toHaveBeenCalled();
});
test('switching node composers preserves each independent draft without a request or extra node',async()=>{
 const other={...node,id:'v2',title:'second',metadata:{...node.metadata,prompt:'second prompt'}};
 render(<Host initialNodes={[node,other]}/>);openVideo();
 fireEvent.change(screen.getByRole('textbox',{name:'创作要求'}),{target:{value:'first draft'}});
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'video',nodeId:'v2'}}));
 expect((screen.getByRole('textbox',{name:'创作要求'}) as HTMLTextAreaElement).value).toBe('second prompt');
 fireEvent.change(screen.getByRole('textbox',{name:'创作要求'}),{target:{value:'second draft'}});openVideo();
 expect((screen.getByRole('textbox',{name:'创作要求'}) as HTMLTextAreaElement).value).toBe('first draft');
 expect(snapshot).toHaveLength(2);expect(snapshot[1].metadata?.studio?.composerDraft?.prompt).toBe('second draft');expect(api.submit).not.toHaveBeenCalled();
});

test('a previous panel save cannot close a newly selected node composer',async()=>{
 const other={...node,id:'v2',title:'second',metadata:{...node.metadata,prompt:'second prompt'}};
 let saved!:()=>void;api.save.mockImplementationOnce(()=>new Promise<void>(resolve=>{saved=resolve;}));
 render(<Host initialNodes={[node,other]}/>);openVideo();
 fireEvent.click(screen.getByRole('button',{name:'关闭创作面板'}));
 fireEvent(window,new CustomEvent('studio-command',{detail:{action:'video',nodeId:'v2'}}));
 saved();await waitFor(()=>expect((screen.getByRole('textbox',{name:'创作要求'}) as HTMLTextAreaElement).value).toBe('second prompt'));
 expect(screen.getByRole('dialog',{name:'生成视频'})).toBeDefined();expect(api.submit).not.toHaveBeenCalled();
});
test('task utility stays visible when a node composer opens',async()=>{
 render(<Host/>);fireEvent(window,new CustomEvent('studio-command',{detail:{action:'tasks'}}));
 await screen.findByRole('dialog',{name:'创作任务'});openVideo();
 expect(screen.getByRole('dialog',{name:'创作任务'})).toBeDefined();expect(screen.getByRole('dialog',{name:'生成视频'})).toBeDefined();expect(api.submit).not.toHaveBeenCalled();
});

 test.each(['assistant','batch'])('legacy editor entry opens the %s business node without the script editor',async kind=>{
  render(<Host initial={{...node,id:'special',type:'text',metadata:{studio:{kind}}}}/>);
  fireEvent(window,new CustomEvent('studio-command',{detail:{action:'editor',nodeId:'special'}}));
  expect(await screen.findByRole('dialog',{name:kind==='assistant'?'AI 创作助手':'制作计划'})).toBeDefined();
  expect(screen.queryByRole('dialog',{name:'剧本编辑器'})).toBeNull();expect(api.submit).not.toHaveBeenCalled();
 });
 test('ordinary node opening keeps lip sync anchored to its explicit opening node',async()=>{
  const audio={...node,id:'a',type:'audio' as never};render(<Host initialNodes={[node,audio]}/>);
  fireEvent(window,new CustomEvent('studio-command',{detail:{action:'lip',nodeId:'v'}}));
  expect(screen.getByTestId('lip-origin').textContent).toBe('v');
  fireEvent(window,new CustomEvent('studio-command',{detail:{action:'video',nodeId:'v'}}));
  await screen.findByRole('dialog',{name:'生成视频'});
  expect(screen.getByRole('dialog',{name:'人物口型同步'})).toBeDefined();expect(screen.getByTestId('lip-origin').textContent).toBe('v');expect(api.lip).not.toHaveBeenCalled();
 });
 test('removing an earlier video reference preserves surviving mentions and requires repairing removed ones',async()=>{
  const refs=['r1','r2'].map(id=>({...node,id,type:'image' as never,title:id,metadata:{storageKey:id+'.png',content:'/'+id+'.png'}}));
  render(<Host initialNodes={[{...node,metadata:{...node.metadata,prompt:'@图1 的衣服，@图2 的场景'}},...refs]} initialConnections={refs.map(r=>({id:r.id,fromNodeId:r.id,toNodeId:'v'}))}/>);openVideo();
  const input=await screen.findByRole('textbox',{name:'创作要求'});
  expect(input.getAttribute('data-references')).toBe(JSON.stringify([['r1','@图1'],['r2','@图2']]));
  fireEvent.click(screen.getByRole('button',{name:'移除参考 r1'}));
  await waitFor(()=>expect((input as HTMLTextAreaElement).value).toBe('[已移除参考：r1] 的衣服，@图1 的场景'));
  expect(input.getAttribute('data-references')).toBe(JSON.stringify([['r2','@图1']]));
  expect((screen.getByRole('button',{name:'生成视频',exact:true}) as HTMLButtonElement).disabled).toBe(true);expect(api.submit).not.toHaveBeenCalled();
 });

test('opening and reopening a template draft keeps empty upstream slots and checks them before submission',async()=>{
 const empty:CanvasNodeData={...node,id:'frame',type:'image' as never,title:'人物参考',metadata:{status:'idle',studio:{templateInput:{required:true,label:'人物参考'}}}};
 const brief:CanvasNodeData={...node,id:'brief',type:'text' as never,title:'创作要求输入',metadata:{content:'',studio:{templateInput:{required:true,label:'创作要求输入'}}}};
 const draft={...node,metadata:{prompt:'保持同一人物',status:'idle',studio:{kind:'shot' as const}}};
 render(<Host initialNodes={[draft,empty,brief]} initialConnections={[{id:'frame-edge',fromNodeId:'frame',toNodeId:'v'},{id:'brief-edge',fromNodeId:'brief',toNodeId:'v'}]}/>);openVideo();
 await screen.findByRole('button',{name:'移除参考 人物参考'});await screen.findByRole('button',{name:'移除文本引用 创作要求输入'});
 await waitFor(()=>expect(connectionSnapshot).toHaveLength(2));
 fireEvent.click(within(screen.getByRole('dialog',{name:'生成视频'})).getByRole('button',{name:'生成视频',exact:true}));await waitFor(()=>expect(api.error).toHaveBeenCalledWith('请先为「人物参考」添加或生成图片'));expect(api.submit).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'关闭创作面板'}));await waitFor(()=>expect(screen.queryByRole('dialog',{name:'生成视频'})).toBeNull());openVideo();
 await screen.findByRole('button',{name:'移除参考 人物参考'});expect(connectionSnapshot).toHaveLength(2);
 fireEvent.click(screen.getByRole('button',{name:'移除参考 人物参考'}));await waitFor(()=>expect(connectionSnapshot.map(c=>c.fromNodeId)).toEqual(['brief']));
 fireEvent.click(within(screen.getByRole('dialog',{name:'生成视频'})).getByRole('button',{name:'生成视频',exact:true}));await waitFor(()=>expect(api.error).toHaveBeenCalledWith('请先填写「创作要求输入」'));expect(api.submit).not.toHaveBeenCalled();
});
