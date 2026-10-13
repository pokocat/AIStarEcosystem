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
 vi.resetAllMocks();api.list.mockResolvedValue([]);api.publish.mockResolvedValue({templateId:'template',version:1});
 api.read.mockResolvedValue({name:'角色创作',doc:{nodes:[{id:'brief',type:'text',title:'角色描述'},{id:'ref',type:'image',title:'人物参考'},{id:'output',type:'image',title:'形象图',metadata:{prompt:'根据 {{input1}} 生成形象'}}],connections:[{fromNodeId:'brief',toNodeId:'output'},{fromNodeId:'ref',toNodeId:'output'}]}});
});
afterEach(cleanup);
test('publishing retains text variables but only auto-binds image references from canvas edges',async()=>{
 render(<StudioTemplatePublish projectId="project" superAdmin saveNow={vi.fn().mockResolvedValue({})} onClose={vi.fn()}/>);
 await screen.findByDisplayValue('角色创作');
 fireEvent.change(screen.getByRole('combobox',{name:'添加模板输入'}),{target:{value:'brief'}});
 fireEvent.change(screen.getByRole('combobox',{name:'添加模板输入'}),{target:{value:'ref'}});
 fireEvent.change(screen.getByRole('combobox',{name:'添加模板步骤'}),{target:{value:'output'}});
 fireEvent.click(screen.getByRole('button',{name:'保存个人模板'}));
 await waitFor(()=>expect(api.publish).toHaveBeenCalledWith('project',expect.objectContaining({recipe:expect.objectContaining({steps:[expect.objectContaining({references:['input2'],prompt:'根据 {{input1}} 生成形象'})]})})));
 await screen.findByText(/已保存个人模板 v1/);
});
test('the official-content handoff opens with the official visibility selected',async()=>{
 render(<StudioTemplatePublish projectId="project" superAdmin initialVisibility="official" saveNow={vi.fn().mockResolvedValue({})} onClose={vi.fn()}/>);
 await screen.findByDisplayValue('角色创作');expect((screen.getByRole('combobox',{name:/可见范围/}) as HTMLSelectElement).value).toBe('official');
 expect(screen.getByRole('button',{name:'发布官方模板'})).toBeDefined();
});
