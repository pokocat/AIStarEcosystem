// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioTemplatePublish } from './studio-template-publish';
const api=vi.hoisted(()=>({read:vi.fn(),list:vi.fn(),publish:vi.fn()}));
vi.mock('@/ip/api',()=>({IpStudioApi:{listTemplates:api.list}}));
vi.mock('@/canvas-bridge/studio-api',()=>({readStudioProject:api.read}));
vi.mock('@/canvas-bridge/template-api',()=>({publishTemplateVersion:api.publish}));
vi.mock('@/canvas-bridge/publish-gate',()=>({publishWithLatestDoc:async(save:any,action:any)=>{await save();return action();}}));
vi.mock('./studio-errors',()=>({StudioErrorNotice:()=>null,useStudioErrorState:()=>{const React=require('react');return React.useState('');}}));
vi.mock('antd',()=>({
 Modal:({title,children,footer}:any)=><div role="dialog" aria-label={title}>{children}{footer}</div>,
 Button:({loading,type,...p}:any)=><button {...p} disabled={loading||p.disabled}/>,
 Input:Object.assign((p:any)=><input {...p}/>,{TextArea:(p:any)=><textarea {...p}/>}),
 Checkbox:({checked,onChange,children}:any)=><label><input type="checkbox" checked={checked} onChange={onChange}/>{children}</label>,
 Select:({options,onChange,value,placeholder,allowClear,mode,...p}:any)=><select {...p} multiple={mode==='multiple'} value={value??(mode==='multiple'?[]:'')} onChange={e=>onChange(mode==='multiple'?Array.from(e.target.selectedOptions,o=>o.value):e.target.value)}><option value="">{placeholder}</option>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
 Alert:({title}:any)=><p>{title}</p>,
}));
beforeEach(()=>{
 vi.resetAllMocks();api.list.mockResolvedValue([]);
 const doc={nodes:[{id:'brief',type:'text',title:'角色描述',metadata:{content:'原角色正文'}},{id:'ref',type:'image',title:'人物参考',metadata:{storageKey:'reference'}},{id:'output',type:'image',title:'形象图',metadata:{storageKey:'output'}},{id:'video',type:'video',title:'场景视频',metadata:{storageKey:'video'}}],connections:[{fromNodeId:'brief',toNodeId:'output'},{fromNodeId:'ref',toNodeId:'output'}]};
 api.read.mockResolvedValue({name:'完整角色画布',doc});api.publish.mockResolvedValue({templateId:'template',version:1,doc});
});
afterEach(cleanup);
test('saving a full canvas requires no input or step configuration and sends no recipe',async()=>{
 render(<StudioTemplatePublish projectId="project" superAdmin saveNow={vi.fn().mockResolvedValue({})} onClose={vi.fn()}/>);
 await screen.findByDisplayValue('完整角色画布');
 expect(screen.queryByRole('combobox',{name:'添加模板输入'})).toBeNull();
 expect(screen.queryByRole('combobox',{name:'添加模板步骤'})).toBeNull();
 expect(screen.getByText('4 个节点 · 2 张图片 · 1 个视频')).toBeDefined();
 fireEvent.click(screen.getByRole('button',{name:'保存完整画布'}));
 await waitFor(()=>expect(api.publish).toHaveBeenCalledWith('project',{templateId:undefined,name:'完整角色画布',summary:'',visibility:'personal'}));
 await screen.findByText(/已保存完整画布：4 个节点/);
});
test('official saving opens directly with all-user visibility',async()=>{
 render(<StudioTemplatePublish projectId="project" superAdmin initialVisibility="official" saveNow={vi.fn().mockResolvedValue({})} onClose={vi.fn()}/>);
 await screen.findByDisplayValue('完整角色画布');expect((screen.getByRole('combobox',{name:/谁可以看到/}) as HTMLSelectElement).value).toBe('official');
 fireEvent.click(screen.getByRole('button',{name:'保存完整画布'}));
 await waitFor(()=>expect(api.publish).toHaveBeenCalledWith('project',expect.objectContaining({visibility:'official'})));
});
test('saving a selected template creates a new full-canvas version and prevents duplicate submissions',async()=>{
 api.list.mockResolvedValue([{id:'existing',versionId:'v1',mine:true,visibility:'personal',name:'原模板'}]);
 let resolve:(v:any)=>void=()=>{};api.publish.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 render(<StudioTemplatePublish projectId="project" superAdmin saveNow={vi.fn().mockResolvedValue({})} onClose={vi.fn()}/>);
 await screen.findByDisplayValue('完整角色画布');
 fireEvent.change(screen.getByRole('combobox',{name:/保存位置/}),{target:{value:'existing'}});
 const save=screen.getByRole('button',{name:'保存完整画布'});fireEvent.click(save);fireEvent.click(save);
 await waitFor(()=>expect(api.publish).toHaveBeenCalledOnce());
 expect(api.publish).toHaveBeenCalledWith('project',expect.objectContaining({templateId:'existing'}));
 expect((screen.getByRole('button',{name:'取消'}) as HTMLButtonElement).disabled).toBe(true);
 resolve({templateId:'existing',doc:{nodes:[{id:'n'}]}});await screen.findByText(/已保存完整画布：1 个节点/);
});
