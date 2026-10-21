// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApiError } from '@ai-star-eco/api-client';
import { createHash, webcrypto } from 'node:crypto';
import { StrictMode } from 'react';
import { mountStudioErrorNotifications } from './testing/studio-notification-harness';

import { LibraryExtractionPanel } from './library-extraction-panel';
const api=vi.hoisted(()=>({extract:vi.fn(),task:vi.fn(),save:vi.fn(),read:vi.fn(),objects:vi.fn(),folders:vi.fn(),preference:vi.fn()}));
vi.mock('@/canvas-bridge/asset-library',()=>({extractLibraryAssets:api.extract,saveLibraryExtraction:api.save,libraryFolders:api.folders,createLibraryFolder:vi.fn(),libraryObjects:api.objects,canvasLibraryFolder:api.preference,mainLibraryVersion:(asset:any)=>asset.versions.find((v:any)=>v.id===asset.mainVersionId)}));
vi.mock('@/canvas-bridge/studio-api',()=>({studioCapabilities:async()=>({mock:false,textModelMode:'fixed',textCost:2,textModels:[{endpointId:'text',name:'qwen3.6',creditCost:2,isDefault:true,tokenPricing:{inputCreditsPerK:0.18,outputCreditsPerK:1.08,maxInputTokens:65536,maxOutputTokens:8192,maxCost:21}}]})}));
vi.mock('@/canvas-bridge/api',()=>({readRun:api.read}));
vi.mock('./library-asset-editor',()=>({LibraryAssetEditor:({assets,onClose,onChange}:any)=><section aria-label="编辑素材"><p>{assets[0].name}详情</p><button onClick={()=>{onChange();onClose();}}>返回素材列表</button></section>}));
vi.mock('./studio-overlay',()=>({studioOverlayContainer:()=>document.body}));
vi.mock('antd',()=>({App:{useApp:()=>({message:{success:vi.fn()}})},Modal:({open,children}:any)=>open?<section>{children}</section>:null,
 Button:({icon,loading,type,...p}:any)=><button {...p} disabled={loading||p.disabled}>{icon}{p.children}</button>,
 Input:Object.assign((p:any)=><input {...p}/>,{TextArea:(p:any)=><textarea {...p}/>}),
 Select:({options,onChange,value,...p}:any)=><select {...p} value={value||''} onChange={e=>onChange(e.target.value)}>{options?.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
 Checkbox:({checked,onChange,...p}:any)=><input {...p} type="checkbox" checked={checked} onChange={onChange}/>,Skeleton:()=>null,
 Tabs:({items,activeKey,onChange}:any)=><><div role="tablist">{items.map((item:any)=><button key={item.key} role="tab" aria-selected={item.key===activeKey} onClick={()=>onChange(item.key)}>{item.label}</button>)}</div><div role="tabpanel">{items.find((item:any)=>item.key===activeKey)?.children}</div></>,
 Segmented:({options,value,onChange,...p}:any)=><select {...p} value={value} onChange={e=>onChange(e.target.value)}>{options.map((item:any)=><option key={item.value} value={item.value}>{item.label}</option>)}</select>}));
const item={key:'character-1',kind:'character',name:'主角',description:'画家',evidence:'画家'};
const seed={sourceHash:'hash',title:'新剧本',items:[item]};
const done={...seed,run:{id:'run',status:'done',cost:4,output:{assetExtraction:{items:[item]},billing:{inputTokens:2000,outputTokens:3000,credits:4,inputCreditsPerK:0.18,outputCreditsPerK:1.08}}}};
const props={projectId:'p',node:{id:'text',title:'新剧本',type:'text',position:{x:0,y:0},width:300,height:200},onClose:vi.fn(),onTask:api.task,onUse:vi.fn()};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('crypto',webcrypto);api.folders.mockResolvedValue([{id:'folder',name:'梵高'}]);api.preference.mockResolvedValue({folderId:''});api.objects.mockResolvedValue({items:[],hasMore:false,total:0,page:0});api.task.mockResolvedValue(undefined);api.save.mockResolvedValue([]);api.extract.mockImplementation(async(_:string,r:any)=>r.analyze?done:seed);});
test('text extraction hides flat pricing, marks the paid action and reports actual settled credits',async()=>{
 render(<LibraryExtractionPanel {...props as any}/>);
 const analyze=await screen.findByRole('button',{name:'从正文分析提取'});
 await waitFor(()=>expect(analyze.disabled).toBe(false));
 expect(analyze.querySelector('[data-ai-action]')).not.toBeNull();
 expect(screen.queryByText(/2 积分|21 积分|Token|冻结/)).toBeNull();
 expect(screen.getByRole('button',{name:'保存所选 1 项'}).querySelector('[data-ai-action]')).toBeNull();
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

const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const resumedProps=()=>({...props,node:{...props.node,metadata:{studio:{assetExtraction:{clientRequestId:'accepted',sourceHash:'obsolete-before-save',title:'新剧本',maxCost:2,runId:'run'}}}}});
test('refresh recovers the actual accepted source and saves existing candidates without another analysis',async()=>{
 const source='主角是一位画家。\n\n场景：池边。';
 api.extract.mockResolvedValue({...seed,sourceHash:hash(source)});
 api.read.mockResolvedValue({...done.run,inputs:{operation:'asset-extract',scriptEdit:{markdown:source}}});
 render(<LibraryExtractionPanel {...resumedProps() as any}/>);
 const save=await screen.findByRole('button',{name:'保存所选 1 项'});
 await waitFor(()=>expect(save.disabled).toBe(false));fireEvent.click(save);
 await waitFor(()=>expect(api.save).toHaveBeenCalledWith('p',expect.objectContaining({sourceHash:hash(source),items:[item]})));
 expect(api.extract.mock.calls.some((c:any)=>c[1].analyze)).toBe(false);
});
test('a genuinely changed document never relabels old extraction results with the latest fingerprint',async()=>{
 const accepted='画家在池边。',current='画家去了另一座城市。';
 api.extract.mockResolvedValue({...seed,sourceHash:hash(current)});
 api.read.mockResolvedValue({...done.run,inputs:{operation:'asset-extract',scriptEdit:{markdown:accepted}}});
 api.save.mockRejectedValue(new ApiError({code:'IP_LIBRARY_CHANGED',message:'剧本已改变'},409));
 render(<LibraryExtractionPanel {...resumedProps() as any}/>);
 const save=await screen.findByRole('button',{name:'保存所选 1 项'});
 await waitFor(()=>expect(save.disabled).toBe(false));fireEvent.click(save);
 await screen.findByRole('alert');
 expect(api.save).toHaveBeenCalledWith('p',expect.objectContaining({sourceHash:hash(accepted)}));
 expect(api.save.mock.calls[0][1].sourceHash).not.toBe(hash(current));
});
test('newly accepted extraction persists the returned fingerprint after the document is saved',async()=>{
 api.extract.mockImplementation(async(_:string,r:any)=>r.analyze?{...done,sourceHash:'accepted-after-save'}:seed);
 render(<LibraryExtractionPanel {...props as any}/>);
 const analyze=await screen.findByRole('button',{name:'从正文分析提取'});
 await waitFor(()=>expect(analyze.disabled).toBe(false));fireEvent.click(analyze);
 await screen.findByText('已消耗 4 积分');
 expect(api.task).toHaveBeenLastCalledWith(expect.objectContaining({runId:'run',sourceHash:'accepted-after-save'}));
});
const savedAsset=(id='asset',name='文森特·梵高')=>({id,name,kind:'character',description:'已保存的画家设定',prompt:'画家',folderId:'folder',versions:[],sources:[],createdAt:'2026-10-12',updatedAt:'2026-10-12'});
test('saved assets appear on opening without clicking an improve button or rerunning analysis',async()=>{
 const asset=savedAsset();
 api.objects.mockImplementation(async(q:any)=>({items:q?.projectId?[asset]:[],hasMore:false,total:1,page:0}));
 render(<LibraryExtractionPanel {...props as any}/>);
 expect(await screen.findByRole('article',{name:'已保存资产 文森特·梵高'})).toBeDefined();
 expect(screen.getByText('1 项资产已保存')).toBeDefined();
 expect(screen.getByText('1 项尚未配图，文字设定已可用于创作。')).toBeDefined();
 expect(screen.getByText('梵高')).toBeDefined();
 expect(screen.queryByRole('button',{name:'从正文分析提取'})).toBeNull();
 expect(screen.queryByRole('button',{name:/完善本剧已有资产/})).toBeNull();
 expect(api.extract.mock.calls.some((c:any)=>c[1].analyze)).toBe(false);
 fireEvent.click(screen.getByRole('tab',{name:'提取与核对'}));
 expect(screen.getByRole('button',{name:'保存所选 1 项'})).toBeDefined();
});
test('saving returns to the visible saved collection rather than hiding it behind the editor',async()=>{
 api.save.mockResolvedValue([savedAsset()]);
 render(<LibraryExtractionPanel {...props as any}/>);
 const save=await screen.findByRole('button',{name:'保存所选 1 项'});
 await waitFor(()=>expect(save.disabled).toBe(false));fireEvent.click(save);
 expect(await screen.findByRole('article',{name:'已保存资产 文森特·梵高'})).toBeDefined();
 expect(screen.queryByRole('region',{name:'编辑素材'})).toBeNull();
 expect(screen.getByRole('tab',{name:'已保存资产 1'}).getAttribute('aria-selected')).toBe('true');
});
test('editing returns to the collection with the latest saved description',async()=>{
 let asset=savedAsset();
 api.objects.mockImplementation(async(q:any)=>({items:q?.projectId?[asset]:[],hasMore:false,total:1,page:0}));
 render(<LibraryExtractionPanel {...props as any}/>);
 fireEvent.click(await screen.findByRole('button',{name:'编辑与配图 文森特·梵高'}));
 expect(screen.getByText('文森特·梵高详情')).toBeDefined();
 asset={...asset,description:'编辑后保存的设定'};
 fireEvent.click(screen.getByRole('button',{name:'返回素材列表'}));
 expect(await screen.findByText('编辑后保存的设定')).toBeDefined();
});
test('source-scoped assets are not silently limited to the first page',async()=>{
 api.objects.mockImplementation(async(q:any)=>{
  if(!q?.projectId)return {items:[],hasMore:false,total:0,page:0};
  return q.page===0?{items:Array.from({length:24},(_,i)=>savedAsset(String(i),`人物${i}`)),hasMore:true,total:25,page:0}:{items:[savedAsset('last','第25个人物')],hasMore:false,total:25,page:1};
 });
 render(<LibraryExtractionPanel {...props as any}/>);
 expect(await screen.findByText('25 项资产已保存')).toBeDefined();
 expect(screen.getByRole('article',{name:'已保存资产 第25个人物'})).toBeDefined();
 expect(api.objects).toHaveBeenCalledWith({projectId:'p',nodeId:'text',page:1});
});
test('an analysis setup error does not hide already saved assets',async()=>{
 api.objects.mockImplementation(async(q:any)=>({items:q?.projectId?[savedAsset()]:[],hasMore:false,total:1,page:0}));
 api.extract.mockRejectedValue(new Error('分析暂不可用'));
 render(<LibraryExtractionPanel {...props as any}/>);
 expect(await screen.findByRole('article',{name:'已保存资产 文森特·梵高'})).toBeDefined();
 expect(await screen.findByRole('alert')).toBeDefined();
 expect(screen.getByRole('button',{name:'编辑与配图 文森特·梵高'}).disabled).toBe(false);
});
test.each(['folders','preference'] as const)('a failed optional %s request keeps the saved collection and exposes retry',async resource=>{
 api.objects.mockImplementation(async(q:any)=>({items:q?.projectId?[savedAsset()]:[],hasMore:false,total:1,page:0}));
 api[resource].mockRejectedValue(new Error('读取失败'));
 render(<LibraryExtractionPanel {...props as any}/>);
 expect(await screen.findByRole('article',{name:'已保存资产 文森特·梵高'})).toBeDefined();
 expect(await screen.findByRole('alert')).toBeDefined();
 expect(screen.getByRole('button',{name:'重新读取'})).toBeDefined();
 expect(screen.queryByText('素材暂时无法读取')).toBeNull();
 if(resource==='folders')expect(screen.getByText('文件夹名称暂不可用')).toBeDefined();
});
test('a cancelled StrictMode initialization does not duplicate the recovery message',async()=>{
 api.objects.mockImplementation(async(q:any)=>({items:q?.projectId?[savedAsset()]:[],hasMore:false,total:1,page:0}));
 api.folders.mockRejectedValue(new Error('读取失败'));
 render(<StrictMode><LibraryExtractionPanel {...props as any}/></StrictMode>);
 await screen.findByRole('article',{name:'已保存资产 文森特·梵高'});
 const alert=await screen.findByRole('alert');
 expect(alert.textContent?.split('文件夹名称暂时无法读取').length).toBe(2);
});

beforeEach(() => { mountStudioErrorNotifications(); });
