// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioMaterialLibrary } from './studio-material-library';
const api=vi.hoisted(()=>({voices:vi.fn(),folders:vi.fn(),objects:vi.fn(),materials:vi.fn(),canvasFolder:vi.fn()}));
vi.mock('@/canvas-bridge/studio-api',()=>({studioVoiceProfiles:api.voices,classifyStudioIpAsset:vi.fn()}));
vi.mock('@/canvas-bridge/asset-library',()=>({libraryFolders:api.folders,libraryObjects:api.objects,libraryMaterials:api.materials,canvasLibraryFolder:api.canvasFolder,mainLibraryVersion:(object:any)=>object.versions.find((v:any)=>v.id===object.mainVersionId)}));
vi.mock('./studio-errors',()=>({StudioErrorNotice:({error}:any)=><span role="alert">{String(error?.message||error)}</span>,useStudioErrorState:()=>{const React=require('react');return React.useState('');}}));
vi.mock('@/canvas-bridge/signed-image',()=>({SignedImage:({alt}:any)=><span role="img" aria-label={alt}/>}));
vi.mock('@/canvas-bridge/signed-audio',()=>({SignedAudio:()=>null}));
vi.mock('antd',()=>({
  Modal:({open,title,children}:any)=>open?<div role="dialog" aria-label={title}>{children}</div>:null,
  Button:({loading,block,type,...p}:any)=><button {...p} disabled={loading||p.disabled}/>,
  Input:({prefix,allowClear,...p}:any)=><input {...p}/>,Skeleton:()=> <p>正在加载</p>,
  Checkbox:({onChange,checked,...p}:any)=><input type="checkbox" {...p} checked={checked} onChange={onChange}/>,
  Select:({options,onChange,value,allowClear,...p}:any)=><select {...p} value={value||''} onChange={e=>onChange(e.target.value)}>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
  Tabs:({items,activeKey,onChange}:any)=><div role="tablist">{items.map((i:any)=><button key={i.key} role="tab" disabled={i.disabled} aria-selected={i.key===activeKey} onClick={()=>onChange(i.key)}>{i.label}</button>)}</div>,
}));
const asset={id:'scene',name:'雨后街道',kind:'scene',description:'宁静的城市街道',folderId:'folder',mainVersionId:'v2',sources:[],createdAt:'',updatedAt:'',versions:[{id:'v1',storageKey:'old-key',url:'/old'},{id:'v2',storageKey:'new-key',url:'/new'}]};
const props=()=>({open:true,projectId:'project',assets:[],loading:false,error:'',onClose:vi.fn(),onRefresh:vi.fn(),onImport:vi.fn().mockResolvedValue(undefined),onAssetChange:vi.fn(),onAssets:vi.fn().mockResolvedValue(undefined)});
beforeEach(()=>{vi.resetAllMocks();api.voices.mockResolvedValue({performers:[],profiles:[]});api.folders.mockResolvedValue([{id:'folder',name:'街区'}]);api.canvasFolder.mockResolvedValue({folderId:'folder'});api.objects.mockResolvedValue({items:[asset],total:1});api.materials.mockResolvedValue({items:[],total:0});});
afterEach(cleanup);
test('the unified library has one dialog and loads personal assets only after changing its top-level tab',async()=>{
  render(<StudioMaterialLibrary {...props()}/>);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(screen.getByRole('dialog',{name:'素材库'})).toBeDefined();
  expect(screen.getByRole('tab',{name:'IP 人物'}).getAttribute('aria-selected')).toBe('true');expect(api.folders).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('tab',{name:'素材资产'}));await screen.findByText('雨后街道');
  expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(api.canvasFolder).toHaveBeenCalledWith('project');
  expect(api.objects).toHaveBeenLastCalledWith({folder:'folder',query:'',page:0});
});
test('a selected asset imports the exact chosen version snapshot and closes only after saving',async()=>{
  const p=props();render(<StudioMaterialLibrary {...p}/>);fireEvent.click(screen.getByRole('tab',{name:'素材资产'}));
  fireEvent.click(await screen.findByRole('checkbox',{name:'引用资产 雨后街道'}));
  fireEvent.change(screen.getByRole('combobox',{name:'引用版本 雨后街道'}),{target:{value:'v1'}});
  fireEvent.click(screen.getByRole('button',{name:'添加并引用 1'}));
  await waitFor(()=>expect(p.onAssets).toHaveBeenCalledWith([expect.objectContaining({data:expect.objectContaining({storageKey:'old-key'}),metadata:expect.objectContaining({libraryReference:expect.objectContaining({objectId:'scene',versionId:'v1'})})})]));
  expect(p.onClose).toHaveBeenCalledOnce();expect(p.onImport).not.toHaveBeenCalled();
});
test('an in-flight asset save blocks tab switching and closing; a failure keeps its selection for retry',async()=>{
  const p=props();let reject:(e:Error)=>void=()=>{};p.onAssets.mockImplementation(()=>new Promise((_,r)=>{reject=r;}));
  render(<StudioMaterialLibrary {...p}/>);fireEvent.click(screen.getByRole('tab',{name:'素材资产'}));fireEvent.click(await screen.findByRole('checkbox',{name:'引用资产 雨后街道'}));
  fireEvent.click(screen.getByRole('button',{name:'添加并引用 1'}));
  await waitFor(()=>expect((screen.getByRole('tab',{name:'IP 人物'}) as HTMLButtonElement).disabled).toBe(true));
  expect((screen.getByRole('button',{name:'关闭素材库'}) as HTMLButtonElement).disabled).toBe(true);
  reject(new Error('画布保存失败'));await screen.findByText('画布保存失败');expect(p.onClose).not.toHaveBeenCalled();
  expect((screen.getByRole('checkbox',{name:'引用资产 雨后街道'}) as HTMLInputElement).checked).toBe(true);
  p.onAssets.mockResolvedValue(undefined);fireEvent.click(screen.getByRole('button',{name:'添加并引用 1'}));await waitFor(()=>expect(p.onClose).toHaveBeenCalledOnce());
});
test('the top-level tabs support keyboard navigation',async()=>{
  render(<StudioMaterialLibrary {...props()}/>);fireEvent.keyDown(screen.getByRole('tab',{name:'IP 人物'}),{key:'ArrowRight'});
  expect(screen.getByRole('tab',{name:'素材资产'}).getAttribute('aria-selected')).toBe('true');
  fireEvent.keyDown(screen.getByRole('tab',{name:'素材资产'}),{key:'Home'});expect(screen.getByRole('tab',{name:'IP 人物'}).getAttribute('aria-selected')).toBe('true');
});
