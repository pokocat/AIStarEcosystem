// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectCardPreview } from './project-card-preview';
import { CanvasCoverEditor } from './canvas-cover-editor';
import type { IpProjectDoc } from '@ai-star-eco/types';
const api = vi.hoisted(()=>({upload:vi.fn(),select:vi.fn(),reset:vi.fn()}));
vi.mock('./canvas-cover-api',()=>({uploadCanvasCover:api.upload,selectCanvasCover:api.select,resetCanvasCover:api.reset}));
vi.mock('antd',()=>({Modal:({children}:any)=><div role="dialog">{children}</div>}));
const doc: IpProjectDoc={nodes:[{id:'image',type:'image',title:'人物',position:{x:0,y:0},width:200,height:200,metadata:{storageKey:'old',content:'/old.png',primaryImageId:'new',images:[{id:'new',storageKey:'new',content:'/new.png'}]}}],connections:[],viewport:{x:0,y:0,k:1}};
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('shared canvas covers',()=>{
 it('uses manual cover first, then the selected saved image, then says in words what the canvas holds',()=>{
  render(<ProjectCardPreview doc={doc} coverUrl="/manual.png"/>);
  expect(document.querySelector('img')?.getAttribute('src')).toBe('/manual.png');
  fireEvent.error(document.querySelector('img')!);
  expect(document.querySelector('img')?.getAttribute('src')).toBe('/new.png');
  fireEvent.error(document.querySelector('img')!);fireEvent.error(document.querySelector('img')!);
  expect(document.querySelector('img')).toBeNull();
  expect(screen.getByText('1 个步骤')).toBeTruthy();expect(screen.getByText('人物')).toBeTruthy();
 });
 // 2026-10-30 线上走查：没有图时画的节点示意图（灰蓝方块）看着像图没加载出来，改成用字说内容。
 it('without pictures it shows the text itself, else the steps, else a blank canvas; never node geometry',()=>{
  const {unmount}=render(<ProjectCardPreview doc={{...doc,nodes:[{...doc.nodes[0],type:'text',metadata:{content:'剧本正文'}}]}}/>);
  expect(screen.getByText('剧本正文')).toBeTruthy();expect(document.querySelector('img, svg[role="img"]')).toBeNull();unmount();
  const plan=render(<ProjectCardPreview doc={{...doc,nodes:[{...doc.nodes[0],type:'video',title:'口播视频',metadata:{}},{...doc.nodes[0],id:'t',type:'text',title:'分镜脚本',metadata:{}}]}}/>);
  expect(screen.getByText('2 个步骤')).toBeTruthy();expect(screen.getByText('口播视频 · 分镜脚本')).toBeTruthy();plan.unmount();
  render(<ProjectCardPreview doc={{...doc,nodes:[]}}/>);
  expect(screen.getByText('空白画布')).toBeTruthy();
 });
 it('retains a failed upload for retry and only publishes the successful server cover',async()=>{
  api.upload.mockRejectedValueOnce(new Error('上传失败')).mockResolvedValueOnce({coverUrl:'/uploaded.png'});
  const saved=vi.fn();render(<CanvasCoverEditor target="template" id="t1" name="模板" doc={doc} onClose={()=>{}} onSaved={saved}/>);
  const file=new File(['png'],'cover.png',{type:'image/png'});
  fireEvent.change(screen.getByLabelText('上传封面图片'),{target:{files:[file]}});
  await screen.findByRole('button',{name:'重试上传'});expect(saved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'重试上传'}));
  await waitFor(()=>expect(saved).toHaveBeenCalledWith({coverUrl:'/uploaded.png'}));
  expect(api.upload).toHaveBeenLastCalledWith('template','t1',file);
 });
 it.each(['project','template'] as const)('shares selection and reset requests for %s without sending doc',async target=>{
  api.select.mockResolvedValue({coverUrl:'/selected.png'});api.reset.mockResolvedValue({coverUrl:null});const saved=vi.fn();
  render(<CanvasCoverEditor target={target} id="same-id" name="画布" doc={doc} onClose={()=>{}} onSaved={saved}/>);
  fireEvent.click(screen.getByRole('button',{name:'设为封面：人物 1'}));
  await waitFor(()=>expect(api.select).toHaveBeenCalledWith(target,'same-id','new'));
  await waitFor(()=>expect(saved).toHaveBeenCalledWith({coverUrl:'/selected.png'}));
  fireEvent.click(screen.getByRole('button',{name:'恢复自动封面'}));
  await waitFor(()=>expect(api.reset).toHaveBeenCalledWith(target,'same-id'));
 });
});
