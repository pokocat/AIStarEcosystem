import {beforeEach,expect,test,vi} from 'vitest';
import type {IpProject} from '@ai-star-eco/types';
import {createStudioEntry,parseStudioEntry,StudioEntrySaveError,studioEntryHref} from './studio-entry';
const api=vi.hoisted(()=>({createProject:vi.fn(),updateProject:vi.fn(),getProject:vi.fn()}));
vi.mock('./api',()=>({IpStudioApi:api}));
const empty:IpProject={id:'p',name:'新画布',status:'draft',createdAt:'',updatedAt:'',docVersion:'v1',doc:{nodes:[],connections:[],viewport:{x:0,y:0,k:1}},runs:{},runsById:{}};
beforeEach(()=>{vi.clearAllMocks();api.createProject.mockResolvedValue(empty);api.getProject.mockResolvedValue(empty);api.updateProject.mockImplementation(async(_id,body)=>({...empty,doc:body.doc,docVersion:'v2'}));});
test('only real Studio destinations are accepted, including video/audio and library',()=>{
  for(const value of ['assistant','image','video','script','director','work','commerce','speech','lip','library','blank'])expect(parseStudioEntry(value)).toBe(value);
  for(const value of [null,'constructor','__proto__','unknown','/studio'])expect(parseStudioEntry(value)).toBeUndefined();
  expect(studioEntryHref('p','blank')).toBe('/projects/p');expect(studioEntryHref('p','video')).toBe('/projects/p?start=video');
});
test('a blank entry creates a free workspace without submitting a run or saving empty content',async()=>{
  expect(await createStudioEntry('speech')).toBe(empty);expect(api.createProject).toHaveBeenCalledTimes(1);expect(api.updateProject).not.toHaveBeenCalled();
});
test('home brief is saved as ordinary visible text and absent from the URL',async()=>{
  const p=await createStudioEntry('video','  一段商品视频  ');
  expect(p.doc.nodes[0]).toMatchObject({type:'text',title:'创作想法',metadata:{prompt:'一段商品视频',content:'一段商品视频',studioStart:'video'}});
  expect(api.updateProject).toHaveBeenCalledWith('p',expect.objectContaining({baseDocVersion:'v1'}));expect(studioEntryHref(p.id,'video')).not.toContain('商品');
});
test('saving failure retries the same workspace and preserves changes made there',async()=>{
  api.updateProject.mockRejectedValueOnce(new Error('offline'));
  let failed:StudioEntrySaveError|undefined;try{await createStudioEntry('image','小紫');}catch(e){failed=e as StudioEntrySaveError;}
  expect(failed).toBeInstanceOf(StudioEntrySaveError);
  api.getProject.mockResolvedValue({...empty,docVersion:'v3',doc:{...empty.doc,nodes:[{id:'other',type:'text',title:'后来添加',position:{x:0,y:0},width:100,height:100}]}});
  const saved=await createStudioEntry('image','小紫',failed!.project);
  expect(api.createProject).toHaveBeenCalledTimes(1);expect(saved.doc.nodes.map(n=>n.id)).toEqual(['other','p-brief']);expect(api.updateProject).toHaveBeenLastCalledWith('p',expect.objectContaining({baseDocVersion:'v3'}));
});
test('unknown save response recovers a previously saved brief without a duplicate PUT',async()=>{
  const saved=await createStudioEntry('script','故事');api.getProject.mockResolvedValue(saved);api.updateProject.mockClear();
  expect(await createStudioEntry('script','故事',empty)).toBe(saved);expect(api.updateProject).not.toHaveBeenCalled();
});
