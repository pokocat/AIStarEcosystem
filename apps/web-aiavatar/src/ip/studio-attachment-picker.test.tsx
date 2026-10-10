// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioAttachmentPicker } from './studio-attachment-picker';
const api=vi.hoisted(()=>({list:vi.fn()}));
vi.mock('@/canvas-bridge/saved-assets',()=>({listSavedAssets:api.list}));
vi.mock('@/canvas-bridge/signed-image',()=>({SignedImage:({storageKey,...props}:any)=><img {...props}/>}));
vi.mock('antd',()=>({Button:({loading,icon,type,...p}:any)=><button {...p}>{icon}{p.children}</button>,
  Input:({allowClear,...p}:any)=><input {...p}/>,Skeleton:()=> <p>正在加载素材</p>,
  Dropdown:({children,menu,disabled}:any)=><div>{children}{menu.items.map((item:any)=><button key={item.key} disabled={disabled} onClick={()=>menu.onClick({key:item.key})}>{item.label}</button>)}</div>}));
afterEach(cleanup);beforeEach(()=>vi.clearAllMocks());
const assets=Array.from({length:8},(_,i)=>({id:`asset-${i}`,kind:i===0?'audio':'text',title:i===0?'声音 A':`章节 ${i}`,data:i===0?{storageKey:'own/voice',url:'/voice'}:{content:`章节正文 ${i}`}}));
test('selection survives search and pagination and emits precise library assets',async()=>{
  api.list.mockResolvedValue(assets);const insert=vi.fn().mockResolvedValue(undefined);
  render(<StudioAttachmentPicker locked={false} reading={false} onFiles={()=>{}} onAssets={insert}/>);
  fireEvent.click(screen.getByRole('button',{name:'素材库添加'}));await waitFor(()=>expect(screen.getByText('声音 A')).toBeDefined());
  fireEvent.click(screen.getByRole('checkbox',{name:'选择素材 声音 A'}));fireEvent.click(screen.getByRole('button',{name:'下一页'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'选择素材 章节 6'}));fireEvent.change(screen.getByRole('textbox',{name:'搜索助手素材库'}),{target:{value:'没有的名称'}});
  expect(screen.getByText(/没有匹配的素材/)).toBeDefined();fireEvent.click(screen.getByRole('button',{name:'添加并引用 2 项'}));
  await waitFor(()=>expect(insert).toHaveBeenCalledWith([assets[0],assets[6]]));expect(screen.queryByRole('region',{name:'助手素材库'})).toBeNull();
});
test('load and insertion failures preserve selection for an explicit retry',async()=>{
  api.list.mockRejectedValueOnce(new Error('素材库暂时不可用')).mockResolvedValueOnce(assets);
  const insert=vi.fn().mockRejectedValueOnce(new Error('画布保存失败')).mockResolvedValueOnce(undefined);
  render(<StudioAttachmentPicker locked={false} reading={false} onFiles={()=>{}} onAssets={insert}/>);
  fireEvent.click(screen.getByRole('button',{name:'素材库添加'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('暂时不可用'));
  fireEvent.click(screen.getByRole('button',{name:'重新加载素材库'}));await waitFor(()=>expect(screen.getByText('声音 A')).toBeDefined());
  fireEvent.click(screen.getByRole('checkbox',{name:'选择素材 声音 A'}));fireEvent.click(screen.getByRole('button',{name:'添加并引用 1 项'}));await waitFor(()=>expect(insert).toHaveBeenCalledOnce());
  expect((screen.getByRole('checkbox',{name:'选择素材 声音 A'}) as HTMLInputElement).checked).toBe(true);expect(screen.getByRole('region',{name:'助手素材库'})).toBeDefined();
  fireEvent.click(screen.getByRole('button',{name:'添加并引用 1 项'}));await waitFor(()=>expect(insert).toHaveBeenCalledTimes(2));
});
