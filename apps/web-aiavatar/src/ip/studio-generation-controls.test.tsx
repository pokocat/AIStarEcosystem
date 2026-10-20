// @vitest-environment jsdom
import {useState} from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {StudioChoiceGroup,StudioSettingsPopover,StudioModelPicker} from './studio-generation-controls';
vi.mock('antd',()=>({Popover:({children,content,open,onOpenChange}:any)=><>{<span onClick={()=>onOpenChange?.(!open)}>{children}</span>}{open?content:null}</>}));
afterEach(cleanup);
test('ratio tiles support arrow navigation, skip unavailable values and show selection',()=>{
 const changed=vi.fn();function Host(){const [value,setValue]=useState('1:1');return <StudioChoiceGroup<string> label="比例" value={value} ratios options={[{value:'1:1',label:'1:1'},{value:'3:4',label:'3:4',disabled:true},{value:'16:9',label:'16:9'}]} onChange={v=>{setValue(v);changed(v);}}/>;}
 render(<Host/>);const group=screen.getByRole('radiogroup',{name:'比例'});fireEvent.keyDown(within(group).getByRole('radio',{name:'1:1'}),{key:'ArrowRight'});
 expect(changed).toHaveBeenLastCalledWith('16:9');expect(screen.getByRole('radio',{name:'16:9'}).getAttribute('aria-checked')).toBe('true');
 expect(document.activeElement).toBe(screen.getByRole('radio',{name:'16:9'}));
});
test('parameter choices remain open while editing and Escape only closes the popover',()=>{
 const close=vi.fn();function Host(){const [value,setValue]=useState(1);return <div onKeyDown={close}><StudioSettingsPopover label="创作参数" summary={`${value} 张`}><StudioChoiceGroup<number> label="生成数量" value={value} onChange={setValue} options={[{value:1,label:'1 张'},{value:4,label:'4 张'}]}/></StudioSettingsPopover></div>;}
 render(<Host/>);const trigger=screen.getByRole('button',{name:'创作参数'});expect(screen.queryByRole('region',{name:'创作参数'})).toBeNull();fireEvent.click(trigger);
 fireEvent.click(screen.getByRole('radio',{name:'4 张'}));expect(trigger.textContent).toContain('4 张');expect(trigger.getAttribute('aria-expanded')).toBe('true');
 fireEvent.keyDown(screen.getByRole('radio',{name:'4 张'}),{key:'Escape'});expect(screen.queryByRole('region',{name:'创作参数'})).toBeNull();expect(document.activeElement).toBe(trigger);expect(close).not.toHaveBeenCalled();
 fireEvent.click(trigger);expect(screen.getByRole('radio',{name:'4 张'}).getAttribute('aria-checked')).toBe('true');
});
test('model selection closes its menu and a fixed model stays visible',()=>{
 const change=vi.fn();const view=render(<StudioModelPicker label="生成模型" value="a" options={[{value:'a',label:'图片 A'},{value:'b',label:'图片 B'}]} onChange={change}/>);
 fireEvent.click(screen.getByRole('button',{name:'生成模型'}));fireEvent.click(screen.getByRole('radio',{name:'图片 B'}));expect(change).toHaveBeenCalledWith('b');expect(screen.queryByRole('radiogroup')).toBeNull();
 view.rerender(<StudioModelPicker label="生成模型" value="a" disabled options={[{value:'a',label:'图片 A'}]} onChange={change}/>);const button=screen.getByRole('button',{name:'生成模型'});expect(button.textContent).toContain('图片 A');expect(button.hasAttribute('disabled')).toBe(true);
});
