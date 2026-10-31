// @vitest-environment jsdom
import { mountStudioErrorNotifications } from './testing/studio-notification-harness';

import { createPortal } from 'react-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioAttachmentPicker } from './studio-attachment-picker';
const api=vi.hoisted(()=>({folders:vi.fn(),objects:vi.fn(),materials:vi.fn()}));
vi.mock('@/canvas-bridge/asset-library',()=>({libraryFolders:api.folders,libraryObjects:api.objects,libraryMaterials:api.materials}));
vi.mock('@/canvas-bridge/signed-image',()=>({SignedImage:({storageKey,...props}:any)=><img {...props}/>}));
vi.mock('antd',()=>({Button:({loading,icon,type,...p}:any)=><button {...p}>{icon}{p.children}</button>,
  Input:({allowClear,...p}:any)=><input {...p}/>,Skeleton:()=> <p>正在加载素材</p>,
  Checkbox:({onChange,...p}:any)=><input type="checkbox" {...p} onChange={onChange}/>,
  Select:({options,onChange,...p}:any)=><select {...p} onChange={e=>onChange(e.target.value)}>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
  Tabs:({items,onChange}:any)=><div>{items.map((item:any)=><button key={item.key} onClick={()=>onChange(item.key)}>{item.label}</button>)}</div>,
  Modal:({open,title,children,getContainer}:any)=>open?createPortal(<section role="dialog" aria-label={title}>{children}</section>,getContainer()):null,
  Dropdown:({children,menu,disabled}:any)=><div>{children}{menu.items.map((item:any)=><button key={item.key} disabled={disabled} onClick={()=>menu.onClick({key:item.key})}>{item.label}</button>)}</div>}));
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();api.folders.mockResolvedValue([]);api.objects.mockResolvedValue({items:[],total:0});api.materials.mockResolvedValue({items:assets,total:assets.length});});
const assets=Array.from({length:25},(_,i)=>({id:`asset-${i}`,kind:i===0?'audio':'text',title:i===0?'声音 A':`章节 ${i}`,data:i===0?{storageKey:'own/voice',url:'/voice'}:{content:`章节正文 ${i}`}}));
const openMaterials=async()=>{
  fireEvent.click(screen.getByRole('button',{name:'资产库添加'}));
  fireEvent.click(screen.getByRole('button',{name:'生成与上传'}));
  await waitFor(()=>expect(screen.getByText('声音 A')).toBeDefined());
};
test('canvas exposes direct upload and sends the selected files without an extra menu',()=>{
  const onFiles=vi.fn();
  render(<StudioAttachmentPicker variant="canvas" locked={false} reading={false} onFiles={onFiles} onAssets={async()=>{}}/>);
  const input=screen.getByLabelText('上传画布素材');const click=vi.spyOn(input,'click');
  fireEvent.click(screen.getByRole('button',{name:'上传素材'}));expect(click).toHaveBeenCalledOnce();
  const file=new File(['image'],'product.png',{type:'image/png'});
  fireEvent.change(input,{target:{files:[file]}});expect(onFiles).toHaveBeenCalledWith([file]);
  expect(screen.queryByRole('button',{name:'本地上传'})).toBeNull();
});
test('canvas library opens outside the toolbar and adds the selected asset to the canvas',async()=>{
  const insert=vi.fn().mockResolvedValue(undefined);
  render(<nav aria-label="画布工具栏"><StudioAttachmentPicker variant="canvas" locked={false} reading={false} onFiles={()=>{}} onAssets={insert}/></nav>);
  const trigger=screen.getByRole('button',{name:'从资产库添加'});
  fireEvent.click(trigger);fireEvent.click(screen.getByRole('button',{name:'生成与上传'}));
  await waitFor(()=>expect(screen.getByText('声音 A')).toBeDefined());
  const dialog=screen.getByRole('dialog',{name:'引用个人资产'});
  expect(screen.getByRole('navigation',{name:'画布工具栏'}).contains(dialog)).toBe(false);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(screen.getByRole('checkbox',{name:'引用资产 声音 A'}));
  fireEvent.click(screen.getByRole('button',{name:'添加并引用 1'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  expect(insert).toHaveBeenCalledWith([assets[0]]);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});
test('selection survives server search and pagination and emits precise library assets',async()=>{
  api.materials.mockImplementation(async({page,query}:any)=>({items:query?[]:page?[assets[24]]:assets.slice(0,24),total:query?0:25}));
  const insert=vi.fn().mockResolvedValue(undefined);
  render(<StudioAttachmentPicker locked={false} reading={false} onFiles={()=>{}} onAssets={insert}/>);
  await openMaterials();
  fireEvent.click(screen.getByRole('checkbox',{name:'引用资产 声音 A'}));fireEvent.click(screen.getByRole('button',{name:'下一页'}));
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:'引用资产 章节 24'})).toBeDefined());
  fireEvent.click(screen.getByRole('checkbox',{name:'引用资产 章节 24'}));fireEvent.change(screen.getByRole('textbox',{name:'搜索可引用资产'}),{target:{value:'没有的名称'}});
  await waitFor(()=>expect(screen.getByText(/没有匹配的资产/)).toBeDefined());
  expect(api.materials).toHaveBeenLastCalledWith(expect.objectContaining({query:'没有的名称',page:0}));
  fireEvent.click(screen.getByRole('button',{name:'添加并引用 2'}));
  await waitFor(()=>expect(insert).toHaveBeenCalledWith([assets[0],assets[24]]));expect(screen.queryByRole('dialog')).toBeNull();
});
test('load and insertion failures preserve selection for an explicit retry',async()=>{
  api.materials.mockRejectedValueOnce(new Error('资产库暂时不可用')).mockResolvedValue({items:assets,total:assets.length});
  const insert=vi.fn().mockRejectedValueOnce(new Error('画布保存失败')).mockResolvedValueOnce(undefined);
  render(<StudioAttachmentPicker locked={false} reading={false} onFiles={()=>{}} onAssets={insert}/>);
  fireEvent.click(screen.getByRole('button',{name:'资产库添加'}));fireEvent.click(screen.getByRole('button',{name:'生成与上传'}));
  await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('暂时不可用'));
  fireEvent.click(screen.getByRole('button',{name:'重试'}));await waitFor(()=>expect(screen.getByText('声音 A')).toBeDefined());
  fireEvent.click(screen.getByRole('checkbox',{name:'引用资产 声音 A'}));fireEvent.click(screen.getByRole('button',{name:'添加并引用 1'}));
  await waitFor(()=>expect(screen.getAllByRole('alert').map(element=>element.textContent).join(' ')).toContain('画布保存失败'));
  expect((screen.getByRole('checkbox',{name:'引用资产 声音 A'}) as HTMLInputElement).checked).toBe(true);expect(screen.getByRole('dialog')).toBeDefined();
  fireEvent.click(screen.getByRole('button',{name:'添加并引用 1'}));await waitFor(()=>expect(insert).toHaveBeenCalledTimes(2));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});

beforeEach(() => { mountStudioErrorNotifications(); });
