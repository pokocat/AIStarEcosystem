// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApiError } from '@ai-star-eco/api-client';
import { LibraryExtractionPanel } from './library-extraction-panel';
const api=vi.hoisted(()=>({extract:vi.fn(),task:vi.fn()}));
vi.mock('@/canvas-bridge/asset-library',()=>({extractLibraryAssets:api.extract,saveLibraryExtraction:vi.fn(),libraryFolders:async()=>[],createLibraryFolder:vi.fn(),libraryObjects:async()=>({items:[]}),canvasLibraryFolder:async()=>({folderId:''})}));
vi.mock('@/canvas-bridge/studio-api',()=>({studioCapabilities:async()=>({mock:false,textModelMode:'fixed',textCost:2,textModels:[{endpointId:'text',name:'qwen3.6',creditCost:2,isDefault:true,tokenPricing:{inputCreditsPerK:0.18,outputCreditsPerK:1.08,maxInputTokens:65536,maxOutputTokens:8192,maxCost:21}}]})}));
vi.mock('@/canvas-bridge/api',()=>({readRun:vi.fn()}));
vi.mock('./library-asset-editor',()=>({LibraryAssetEditor:()=>null}));
vi.mock('./studio-overlay',()=>({studioOverlayContainer:()=>document.body}));
vi.mock('antd',()=>({App:{useApp:()=>({message:{success:vi.fn()}})},Modal:({open,children}:any)=>open?<section>{children}</section>:null,
 Button:({icon,loading,type,...p}:any)=><button {...p} disabled={loading||p.disabled}>{icon}{p.children}</button>,
 Input:Object.assign((p:any)=><input {...p}/>,{TextArea:(p:any)=><textarea {...p}/>}),
 Select:({options,onChange,value,...p}:any)=><select {...p} value={value||''} onChange={e=>onChange(e.target.value)}>{options?.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
 Checkbox:({checked,onChange,...p}:any)=><input {...p} type="checkbox" checked={checked} onChange={onChange}/>,Skeleton:()=>null}));
const item={key:'character-1',kind:'character',name:'主角',description:'画家',evidence:'画家'};
const seed={sourceHash:'hash',title:'新剧本',items:[item]};
const done={...seed,run:{id:'run',status:'done',cost:4,output:{assetExtraction:{items:[item]},billing:{inputTokens:2000,outputTokens:3000,credits:4,inputCreditsPerK:0.18,outputCreditsPerK:1.08}}}};
const props={projectId:'p',node:{id:'text',title:'新剧本',type:'text',position:{x:0,y:0},width:300,height:200},onClose:vi.fn(),onTask:api.task,onUse:vi.fn()};
afterEach(cleanup);
beforeEach(()=>{vi.resetAllMocks();api.task.mockResolvedValue(undefined);api.extract.mockImplementation(async(_:string,r:any)=>r.analyze?done:seed);});
test('text extraction hides flat pricing, marks the paid action and reports actual settled credits',async()=>{
 render(<LibraryExtractionPanel {...props as any}/>);
 const analyze=await screen.findByRole('button',{name:'从正文分析提取'});
 await waitFor(()=>expect(analyze.disabled).toBe(false));
 expect(analyze.querySelector('[data-ai-action]')).not.toBeNull();
 expect(screen.queryByText(/2 积分|21 积分|Token|冻结/)).toBeNull();
 expect(screen.getByRole('button',{name:'保存并完善 1 项'}).querySelector('[data-ai-action]')).toBeNull();
 fireEvent.click(analyze);
 expect(await screen.findByText('已消耗 4 积分')).toBeDefined();
 expect(api.extract.mock.calls.find((c:any)=>c[1].analyze)?.[1]).toMatchObject({model:'text',maxCost:21});
});
test('a rejected price clears the unaccepted request so the next click can use current pricing',async()=>{
 api.extract.mockImplementation(async(_:string,r:any)=>{if(!r.analyze)return seed;throw new ApiError({code:'STUDIO_PRICE_CHANGED',message:'计费配置已更新'},409);});
 render(<LibraryExtractionPanel {...props as any}/>);
 const analyze=await screen.findByRole('button',{name:'从正文分析提取'});
 await waitFor(()=>expect(analyze.disabled).toBe(false));fireEvent.click(analyze);
 await screen.findByRole('alert');expect(api.task).toHaveBeenLastCalledWith(undefined);
 const first=api.extract.mock.calls.find((c:any)=>c[1].analyze)?.[1];
 api.extract.mockImplementation(async(_:string,r:any)=>r.analyze?done:seed);fireEvent.click(analyze);
 await screen.findByText('已消耗 4 积分');
 expect(api.extract.mock.calls.at(-1)?.[1].clientRequestId).not.toBe(first.clientRequestId);
});
