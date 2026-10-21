// @vitest-environment jsdom
import {useState} from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {StudioDurationControl} from './studio-duration-control';
import {StudioVideoSeedControl} from './studio-video-controls';
vi.mock('antd',()=>({
 InputNumber:({value,onChange,...p}:any)=><input type="number" aria-label={p['aria-label']} aria-describedby={p['aria-describedby']} id={p.id} min={p.min} max={p.max} placeholder={p.placeholder} value={value??''} onChange={e=>onChange(e.target.value===''?null:Number(e.target.value))}/>,
 Popover:({children}:any)=>children,Button:({children,...p}:any)=><button {...p}>{children}</button>,Select:()=>null,
}));
afterEach(cleanup);
test('native duration keeps four common values and accepts a valid custom integer',()=>{
 const change=vi.fn();function Host(){const [value,setValue]=useState(8);return <StudioDurationControl value={value} min={5} max={15} onChange={seconds=>{setValue(seconds);change(seconds);}}/>;}
 render(<Host/>);const group=screen.getByRole('radiogroup',{name:'片段时长'});
 expect(within(group).getAllByRole('radio').map(el=>el.textContent)).toEqual(['5 秒','8 秒','10 秒','15 秒']);
 const input=screen.getByRole('spinbutton',{name:'自定义视频时长'});fireEvent.change(input,{target:{value:'7'}});
 expect(change).toHaveBeenLastCalledWith(7);expect((input as HTMLInputElement).value).toBe('7');expect(within(group).getAllByRole('radio').every(el=>el.getAttribute('aria-checked')==='false')).toBe(true);
 fireEvent.click(within(group).getByRole('radio',{name:'10 秒'}));expect((input as HTMLInputElement).value).toBe('10');
 change.mockClear();fireEvent.change(input,{target:{value:'16'}});fireEvent.change(input,{target:{value:'7.5'}});expect(change).not.toHaveBeenCalled();
});
test('duration presets obey contract bounds and legacy discrete values never gain free input',()=>{
 const view=render(<StudioDurationControl value={6} min={6} max={10} onChange={()=>{}}/>);
 expect(screen.getAllByRole('radio').map(el=>el.textContent)).toEqual(['8 秒','10 秒']);
 view.rerender(<StudioDurationControl value={8} options={[5,8,12]} onChange={()=>{}}/>);
 expect(screen.queryByRole('spinbutton')).toBeNull();expect(screen.getAllByRole('radio').map(el=>el.textContent)).toEqual(['5 秒','8 秒','12 秒']);
});
test('random seed starts folded and empty while an existing fixed seed remains visible in its summary',()=>{
 const view=render(<StudioVideoSeedControl max={100} onChange={()=>{}}/>);
 const details=screen.getByText('高级设置').closest('details')!;expect(details.open).toBe(false);expect(screen.getByText('每次随机')).toBeDefined();
 view.rerender(<StudioVideoSeedControl seed={1} max={100} onChange={()=>{}}/>);expect(screen.getByText('固定种子 1')).toBeDefined();
 fireEvent.click(screen.getByText('高级设置'));expect((screen.getByRole('spinbutton',{name:'视频随机种子'}) as HTMLInputElement).value).toBe('1');
});
test('zero is a fixed seed and restoring random removes it without changing other generation settings',()=>{
 const changed=vi.fn();function Host(){const [seed,setSeed]=useState<number|undefined>(1);return <StudioVideoSeedControl seed={seed} count={2} max={100} onChange={value=>{setSeed(value);changed(value);}}/>;}
 render(<Host/>);fireEvent.click(screen.getByText('高级设置'));const input=screen.getByRole('spinbutton',{name:'视频随机种子'});
 fireEvent.change(input,{target:{value:'0'}});expect(changed).toHaveBeenLastCalledWith(0);expect(screen.getByText('固定种子 0')).toBeDefined();
 fireEvent.click(screen.getByRole('button',{name:'恢复随机'}));expect(changed).toHaveBeenLastCalledWith(undefined);expect(screen.getByText('每次随机')).toBeDefined();expect((input as HTMLInputElement).value).toBe('');
 expect(screen.getByRole('button',{name:'恢复随机'}).hasAttribute('disabled')).toBe(true);
});
