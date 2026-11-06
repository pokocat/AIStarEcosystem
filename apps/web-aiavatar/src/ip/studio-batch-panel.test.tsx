// @vitest-environment jsdom
import {useState} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {StudioBatchPanel} from './studio-batch-panel';
import type {CanvasNodeData} from '@/canvas/types/canvas';
vi.mock('./studio-floating-panel',()=>({StudioFloatingPanel:({children}:any)=><section>{children}</section>}));
vi.mock('antd',()=>({
 App:{useApp:()=>({message:{}})},
 Button:({children,disabled,onClick}:any)=><button disabled={disabled} onClick={onClick}>{children}</button>,
 Checkbox:({children,checked,onChange}:any)=><label><input type="checkbox" checked={checked} onChange={onChange}/>{children}</label>,
 Select:({options,value,onChange,...p}:any)=><select aria-label={p['aria-label']} value={value||''} onChange={e=>onChange(e.target.value)}>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
 InputNumber:({value,min,max,onChange,...p}:any)=><input type="number" aria-label={p['aria-label']} min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))}/>,
}));
afterEach(cleanup);
const shot={id:'shot',type:'image',title:'镜头',position:{x:0,y:0},width:320,height:240,metadata:{storageKey:'frame.jpg',prompt:'镜头推进'}} as CanvasNodeData;
const models={image:[],video:[
 {endpointId:'long',name:'长模型',isDefault:true,creditCost:2,billingUnit:'per_second' as const,capability:{minDurationSec:5,maxDurationSec:60}},
 {endpointId:'short',name:'短模型',isDefault:false,creditCost:2,billingUnit:'per_second' as const,capability:{minDurationSec:5,maxDurationSec:12}},
]};
function Host(){const[nodes,setNodes]=useState([shot]);return <StudioBatchPanel projectId="p" nodes={nodes} shots={[shot]} setNodes={setNodes} setConnections={()=>{}} models={models} capabilities={{mock:false,operations:[]}} open initialNodeId="shot" onClose={()=>{}} ratio="9:16"/>;}
test('batch uses model bounds, quotes the chosen seconds and blocks an oversized draft after switching',async()=>{
 render(<Host/>);
 const input=screen.getByRole('spinbutton',{name:'自定义视频时长'});
 expect(input.getAttribute('max')).toBe('60');
 fireEvent.change(input,{target:{value:'45'}});
 fireEvent.click(screen.getByRole('button',{name:'查看制作计划与费用'}));
 // The per-second quote proves the plan receives the same 45 seconds shown in the input.
 await waitFor(()=>expect(screen.getByText(/最多 90 积分/)).toBeDefined());
 fireEvent.change(screen.getByRole('combobox',{name:'连续制作视频模型'}),{target:{value:'short'}});
 expect(screen.getByRole('spinbutton',{name:'自定义视频时长'}).getAttribute('max')).toBe('12');
 expect((screen.getByRole('spinbutton',{name:'自定义视频时长'}) as HTMLInputElement).value).toBe('45');
 expect(screen.getByRole('button',{name:'查看制作计划与费用'})).toHaveProperty('disabled',true);
 fireEvent.click(screen.getByRole('button',{name:'改成 12 秒'}));
 expect(screen.getByRole('button',{name:'查看制作计划与费用'})).toHaveProperty('disabled',false);
 fireEvent.click(screen.getByRole('button',{name:'查看制作计划与费用'}));
 await waitFor(()=>expect(screen.getByText(/最多 24 积分/)).toBeDefined());
});
