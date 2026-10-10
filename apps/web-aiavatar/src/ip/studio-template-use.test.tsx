// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { StudioTemplateVersion } from '@ai-star-eco/types';
import { StudioTemplateUse } from './studio-template-use';
import * as api from '@/canvas-bridge/template-api';
import * as studioApi from '@/canvas-bridge/studio-api';
import * as modelApi from '@/canvas-bridge/api';

vi.mock('antd',()=>({
  ConfigProvider:({children}:any)=>children,
  Modal:({open,children,title,footer}:any)=>open?<div role="dialog">{title}{children}{footer}</div>:null,
  Alert:({title}:any)=><p>{title}</p>,Spin:()=>null,
  Button:({children,loading,icon,type,block,...p}:any)=><button {...p} disabled={p.disabled||loading}>{icon}{children}</button>,
  Input:Object.assign(({allowClear,...p}:any)=><input {...p}/>,{TextArea:({autoSize,...p}:any)=><textarea {...p}/>}),
  Select:({options,onChange,value,...p}:any)=><select aria-label={p['aria-label']} value={value??''} onChange={e=>onChange(e.target.value)}><option value="">请选择</option>{options?.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
}));
const version:StudioTemplateVersion={id:'v1',templateId:'t',version:1,name:'人物包',summary:'',visibility:'personal',doc:{nodes:[],connections:[]},createdAt:'today',recipe:{inputs:[{id:'brief',nodeId:'n',label:'人物设定',type:'text',required:true}],steps:[{id:'main',nodeId:'image',title:'主形象',operation:'image',prompt:'{{brief}}',references:[],size:'768x1024',outputRole:'main',requiresAdoption:true}]}};
vi.mock('@/canvas-bridge/template-api',()=>({readTemplateVersion:vi.fn(),previewTemplate:vi.fn(),instantiateTemplate:vi.fn()}));
vi.mock('@/canvas-bridge/studio-api',()=>({listStudioIpAssets:vi.fn().mockResolvedValue([]),studioAssetCatalog:vi.fn().mockResolvedValue({products:[]}),studioVoiceProfiles:vi.fn().mockResolvedValue({performers:[],profiles:[]}),classifyStudioIpAsset:vi.fn()}));
vi.mock('@/canvas-bridge/signed-image',()=>({SignedImage:({storageKey,src,...p}:any)=><img {...p} src={src}/>}));
vi.mock('@/canvas-bridge/signed-audio',()=>({SignedAudio:()=>null}));
vi.mock('@/canvas-bridge/api',()=>({fetchModels:vi.fn().mockResolvedValue({image:[{endpointId:'real-image',name:'真实图片模型',isDefault:true}],video:[]}),uploadImage:vi.fn()}));
afterEach(cleanup);
beforeEach(()=>{
  vi.clearAllMocks();vi.mocked(api.readTemplateVersion).mockResolvedValue(version);
  vi.mocked(studioApi.listStudioIpAssets).mockResolvedValue([]);
  vi.mocked(studioApi.studioAssetCatalog).mockResolvedValue({products:[]} as any);
  vi.mocked(modelApi.fetchModels).mockResolvedValue({image:[{endpointId:'real-image',name:'真实图片模型',isDefault:true}],video:[]} as any);
  vi.mocked(api.previewTemplate).mockResolvedValue({versionId:'v1',version:1,model:'real-image',imageCount:2,totalCost:16,steps:[{id:'main',nodeId:'image',title:'主形象',outputRole:'main',cost:8,status:'ready',dependsOn:[],requiresAdoption:true}]});
});
test('creating requires a current preview; changing inputs invalidates it',async()=>{
  const created=vi.fn();render(<StudioTemplateUse template={{id:'t',versionId:'v1',name:'人物包',summary:'',lookCount:0,estimatedCredits:0,doc:{nodes:[],connections:[]}}} onClose={()=>{}} onCreated={created}/>);
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'人物设定'})).toBeDefined());
  expect(screen.queryByRole('button',{name:'免费创建画布'})).toBeNull();
  fireEvent.change(screen.getByRole('textbox',{name:'人物设定'}),{target:{value:'自己的设定'}});
  fireEvent.click(screen.getByRole('button',{name:'预览制作计划'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'免费创建画布'})).toBeDefined());
  expect(api.previewTemplate).toHaveBeenCalledWith({versionId:'v1',name:'人物包',inputs:{brief:{text:'自己的设定'}},model:'real-image'});
  fireEvent.change(screen.getByRole('textbox',{name:'人物设定'}),{target:{value:'另一人物'}});
  expect(screen.queryByRole('button',{name:'免费创建画布'})).toBeNull();expect(api.instantiateTemplate).not.toHaveBeenCalled();
});
test('newer publication prevents creating from an old preview and asks for a refresh',async()=>{
  vi.mocked(api.instantiateTemplate).mockRejectedValue(new Error('模板已有新版本，请重新打开并预览制作计划'));
  render(<StudioTemplateUse template={{id:'t',versionId:'v1',name:'人物包',summary:'',lookCount:0,estimatedCredits:0,doc:{nodes:[],connections:[]}}} onClose={()=>{}} onCreated={vi.fn()}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'预览制作计划'})).toBeDefined());
  fireEvent.change(screen.getByRole('textbox',{name:'人物设定'}),{target:{value:'自己的设定'}});
  fireEvent.click(screen.getByRole('button',{name:'预览制作计划'}));await waitFor(()=>expect(screen.getByRole('button',{name:'免费创建画布'})).toBeDefined());
  fireEvent.click(screen.getByRole('button',{name:'免费创建画布'}));
  await waitFor(()=>expect(screen.getByText('模板已有新版本，请重新打开并预览制作计划')).toBeDefined());expect(screen.queryByRole('button',{name:'免费创建画布'})).toBeNull();
});

 test('template reference uses the shared person dossier and keeps the selected look/version',async()=>{
  const main={ipId:'ip-1',avatarId:'avatar-1',version:3,storageKey:'main-key',url:'main-url',name:'小紫',characterName:'小紫',current:true,path:'ai' as const,assetRole:'main' as const};
  const sheet={...main,current:false,storageKey:'sheet-key',url:'sheet-url',lookId:'look-sheet',name:'整张设定图',assetRole:'sheet' as const};
  vi.mocked(studioApi.listStudioIpAssets).mockResolvedValue([main,sheet]);
  vi.mocked(api.readTemplateVersion).mockResolvedValue({...version,recipe:{...version.recipe,inputs:[{id:'reference',nodeId:'n',label:'角色参考',type:'character',required:true}]}});
  render(<StudioTemplateUse template={{id:'t',versionId:'v1',name:'人物包',summary:'',lookCount:0,estimatedCredits:0,doc:{nodes:[],connections:[]}}} onClose={()=>{}} onCreated={vi.fn()}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'角色参考选择 IP'})).toBeDefined());
  fireEvent.click(screen.getByRole('button',{name:'角色参考选择 IP'}));
  fireEvent.click(screen.getByRole('button',{name:'查看人物 小紫'}));
  fireEvent.click(screen.getByRole('button',{name:'选择整张设定图 · 人物设定图'}));
  fireEvent.click(screen.getByRole('button',{name:'引用选中素材'}));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'引用选中素材'})).toBeNull());
  fireEvent.click(screen.getByRole('button',{name:'预览制作计划'}));
  await waitFor(()=>expect(api.previewTemplate).toHaveBeenCalledWith(expect.objectContaining({inputs:{reference:{reference:{ipId:'ip-1',avatarId:'avatar-1',version:3,lookId:'look-sheet',storageKey:'sheet-key',role:'character'}}}})));
  expect(api.instantiateTemplate).not.toHaveBeenCalled();
});

test('commerce image input reuses a canvas product with a visible preview and no character identity',async()=>{
  vi.mocked(api.readTemplateVersion).mockResolvedValue({...version,recipe:{...version.recipe,inputs:[{id:'product',nodeId:'product',label:'商品参考',type:'image',required:true}]}});
  render(<StudioTemplateUse template={{id:'t',versionId:'v1',name:'商品视频',summary:'',lookCount:0,estimatedCredits:0,doc:{nodes:[],connections:[]}}} nodes={[{id:'cup',type:'image',title:'杯子',position:{x:0,y:0},width:300,height:300,metadata:{status:'success',storageKey:'owned/cup.png',content:'/cup.png'}}] as any} onClose={()=>{}} onCreated={vi.fn()}/>);
  fireEvent.change(await screen.findByRole('combobox',{name:'已有商品参考'}),{target:{value:'owned/cup.png'}});
  expect(screen.queryByRole('button',{name:'商品参考选择 IP'})).toBeNull();
  expect(screen.getByRole('img',{name:'商品参考'}).getAttribute('src')).toBe('/cup.png');
  fireEvent.click(screen.getByRole('button',{name:'预览制作计划'}));
  await waitFor(()=>expect(api.previewTemplate).toHaveBeenCalledWith(expect.objectContaining({inputs:{product:{reference:{storageKey:'owned/cup.png',role:'frame'}}}})));
  expect(api.instantiateTemplate).not.toHaveBeenCalled();
});

test('required references gate preview; failed replacement keeps the selected image and removal invalidates the plan',async()=>{
  vi.mocked(api.readTemplateVersion).mockResolvedValue({...version,recipe:{...version.recipe,inputs:[{id:'product',nodeId:'product',label:'商品参考',type:'image',required:true}]}});
  vi.mocked(modelApi.uploadImage).mockResolvedValueOnce({key:'owned/product.png',url:'/product.png'} as any).mockRejectedValueOnce(new Error('上传失败，请重试'));
  render(<StudioTemplateUse template={{id:'t',versionId:'v1',name:'商品视频',summary:'',lookCount:0,estimatedCredits:0,doc:{nodes:[],connections:[]}}} onClose={()=>{}} onCreated={vi.fn()}/>);
  const preview=await screen.findByRole('button',{name:'预览制作计划'});
  expect(preview.hasAttribute('disabled')).toBe(true);
  const file=screen.getByLabelText('上传商品参考');
  fireEvent.change(file,{target:{files:[new File(['image'],'product.png',{type:'image/png'})]}});
  await waitFor(()=>expect(preview.hasAttribute('disabled')).toBe(false));
  fireEvent.click(preview);await screen.findByRole('button',{name:'免费创建画布'});
  fireEvent.change(file,{target:{files:[new File(['image'],'new.png',{type:'image/png'})]}});
  await screen.findByText('上传失败，请重试');
  expect(screen.getByRole('img',{name:'商品参考'}).getAttribute('src')).toBe('/product.png');
  fireEvent.click(screen.getByRole('button',{name:'商品参考移除参考'}));
  expect(screen.queryByRole('button',{name:'免费创建画布'})).toBeNull();
  expect(screen.getByRole('button',{name:'预览制作计划'}).hasAttribute('disabled')).toBe(true);
  expect(api.instantiateTemplate).not.toHaveBeenCalled();
});

test('template loading failure can be retried without submitting or creating a canvas',async()=>{
  vi.mocked(api.readTemplateVersion).mockRejectedValueOnce(new Error('模板暂时无法读取')).mockResolvedValueOnce(version);
  render(<StudioTemplateUse template={{id:'t',versionId:'v1',name:'人物包',summary:'',lookCount:0,estimatedCredits:0,doc:{nodes:[],connections:[]}}} onClose={()=>{}} onCreated={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button',{name:'重新加载模板'}));
  await screen.findByRole('textbox',{name:'人物设定'});
  expect(screen.queryByText('模板暂时无法读取')).toBeNull();
  expect(api.previewTemplate).not.toHaveBeenCalled();expect(api.instantiateTemplate).not.toHaveBeenCalled();
});
test('video-only template works without an image model and sends the explicitly chosen video model',async()=>{
  vi.mocked(api.readTemplateVersion).mockResolvedValue({...version,recipe:{...version.recipe,steps:[{id:'video',nodeId:'v',title:'视频',operation:'video',prompt:'{{brief}}',references:[],outputRole:'video',durationSec:5,aspectRatio:'9:16',requiresAdoption:true}]}});
  vi.mocked(modelApi.fetchModels).mockResolvedValue({image:[],video:[{endpointId:'real-video',name:'视频模型',isDefault:true,creditCost:20,billingUnit:'per_call'}]} as any);
  vi.mocked(api.previewTemplate).mockResolvedValue({versionId:'v1',version:1,imageCount:0,videoCount:1,videoModel:'real-video',totalCost:20,steps:[]});
  render(<StudioTemplateUse template={{id:'t',versionId:'v1',name:'人物包',summary:'',lookCount:0,estimatedCredits:0,doc:{nodes:[],connections:[]}}} onClose={()=>{}} onCreated={vi.fn()}/>);
  await waitFor(()=>expect(screen.getByRole('combobox',{name:'模板视频模型'})).toBeDefined());expect(screen.queryByRole('combobox',{name:'模板图片模型'})).toBeNull();
  fireEvent.change(screen.getByRole('textbox',{name:'人物设定'}),{target:{value:'视频要求'}});fireEvent.click(screen.getByRole('button',{name:'预览制作计划'}));
  await waitFor(()=>expect(api.previewTemplate).toHaveBeenCalledWith({versionId:'v1',name:'人物包',inputs:{brief:{text:'视频要求'}},model:undefined,videoModel:'real-video'}));
  expect(screen.getByText('0 张图片 · 1 条视频 · 制作预计 20 积分')).toBeDefined();expect(api.instantiateTemplate).not.toHaveBeenCalled();
});
