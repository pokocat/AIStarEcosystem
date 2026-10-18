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
 it('uses manual cover first, then the selected saved image, then the canvas thumbnail on load failures',()=>{
  render(<ProjectCardPreview doc={doc} coverUrl="/manual.png"/>);
  expect(document.querySelector('img')?.getAttribute('src')).toBe('/manual.png');
  fireEvent.error(document.querySelector('img')!);
  expect(document.querySelector('img')?.getAttribute('src')).toBe('/new.png');
  fireEvent.error(document.querySelector('img')!);fireEvent.error(document.querySelector('img')!);
  expect(screen.getByRole('img',{name:'工作流示意：1 个节点'})).toBeTruthy();
 });
 it('falls back directly to the actual canvas when a text-only template has no images',()=>{
  render(<ProjectCardPreview doc={{...doc,nodes:[{...doc.nodes[0],type:'text',metadata:{content:'剧本正文'}}]}}/>);
  expect(screen.getByRole('img',{name:'工作流示意：1 个节点'})).toBeTruthy();expect(document.querySelector('img')).toBeNull();
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
