// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { StudioLipSync } from './studio-lip-sync';
const api=vi.hoisted(()=>({catalog:vi.fn(),quote:vi.fn()}));
vi.mock('@/canvas-bridge/studio-api',()=>({studioLipSyncCatalog:api.catalog,quoteStudioLipSync:api.quote}));
vi.mock('./studio-floating-panel',()=>({StudioFloatingPanel:({open,children,footer}:any)=>open?<section><div data-testid="body">{children}</div><footer>{footer}</footer></section>:null}));
vi.mock('@/canvas-bridge/signed-video',()=>({SignedVideo:()=> <video/>}));
vi.mock('@/canvas-bridge/signed-audio',()=>({SignedAudio:()=> <audio/>}));
vi.mock('antd',()=>({Button:({loading,type,...props}:any)=><button {...props} disabled={loading||props.disabled}/>,Select:({options,value,onChange,...props}:any)=><select aria-label={props['aria-label']} value={value||''} onChange={e=>onChange(e.target.value)}><option value=""/>{options?.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>}));
const nodes=[['v','video','v.mp4'],['a','audio','a.wav'],['a2','audio','a2.wav']].map(([id,type,storageKey])=>({id,type,title:id,metadata:{storageKey,content:`/${storageKey}`,status:'success',mimeType:type==='audio'?'audio/wav':'video/mp4'}} as CanvasNodeData));
beforeEach(()=>{vi.clearAllMocks();api.catalog.mockResolvedValue({models:[{endpointId:'lip',name:'口型模型',creditCostPerSecond:8,isDefault:true}]});api.quote.mockResolvedValue({cost:24,billableSeconds:3,audioDurationSec:2.4});});
afterEach(cleanup);
test('fixed execution footer submits the exact selected inputs after canvas changes and reopening',async()=>{
  const submit=vi.fn().mockResolvedValue(undefined),props={open:true,onClose:vi.fn(),projectId:'p',nodes,initialNodeId:'v',busy:false,onSubmit:submit};
  const view=render(<StudioLipSync {...props}/>);
  fireEvent.change(await screen.findByRole('combobox',{name:'口型驱动配音'}),{target:{value:'a2'}});
  const button=await screen.findByRole('button',{name:'生成口型视频 · 24 积分'});
  expect(button.closest('footer')).not.toBeNull();expect(screen.getByTestId('body').querySelector('button')).toBeNull();
  view.rerender(<StudioLipSync {...props} nodes={[...nodes,{...nodes[0],id:'other'}]}/>);
  view.rerender(<StudioLipSync {...props} open={false}/>);view.rerender(<StudioLipSync {...props}/>);
  await waitFor(()=>expect((screen.getByRole('combobox',{name:'口型驱动配音'}) as HTMLSelectElement).value).toBe('a2'));
  fireEvent.click(await screen.findByRole('button',{name:'生成口型视频 · 24 积分'}));
  expect(submit).toHaveBeenCalledWith({model:'lip',videoStorageKey:'v.mp4',audioStorageKey:'a2.wav',maxCost:24},'v','a2');
});
test('opening another project clears selected inputs instead of carrying keys across projects',async()=>{
  const props={open:true,onClose:vi.fn(),projectId:'p',nodes,initialNodeId:'v',busy:false,onSubmit:vi.fn()};const view=render(<StudioLipSync {...props}/>);
  fireEvent.change(await screen.findByRole('combobox',{name:'口型驱动配音'}),{target:{value:'a'}});
  await screen.findByRole('button',{name:'生成口型视频 · 24 积分'});
  view.rerender(<StudioLipSync {...props} projectId="another" nodes={[]}/>);
  await waitFor(()=>expect((screen.getByRole('combobox',{name:'口型驱动配音'}) as HTMLSelectElement).value).toBe(''));
  expect(screen.queryByRole('button',{name:'生成口型视频 · 24 积分'})).toBeNull();expect(props.onSubmit).not.toHaveBeenCalled();
});
