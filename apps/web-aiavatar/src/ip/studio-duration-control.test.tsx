// @vitest-environment jsdom
// Uses the real antd InputNumber: the blur behaviour lives in the library, and a mock would not show it.
import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {StudioDurationControl} from './studio-duration-control';
afterEach(cleanup);
const field=()=>screen.getByRole('spinbutton',{name:'自定义视频时长'}) as HTMLInputElement;
function Host({initial,change}:{initial:number;change:(seconds:number)=>void}){const [value,setValue]=useState(initial);return <StudioDurationControl value={value} min={5} max={12} onChange={seconds=>{setValue(seconds);change(seconds);}}/>;}
test('leaving the field keeps a length that is out of range for this model',()=>{
 const change=vi.fn();render(<Host initial={45} change={change}/>);
 fireEvent.focus(field());fireEvent.blur(field());
 expect(change).not.toHaveBeenCalled();expect(field().value).toBe('45');
});
test('an out-of-range number typed over such a length is dropped when leaving the field',()=>{
 const change=vi.fn();render(<Host initial={45} change={change}/>);
 fireEvent.focus(field());fireEvent.change(field(),{target:{value:'70'}});fireEvent.blur(field());
 expect(change).not.toHaveBeenCalled();expect(field().value).toBe('45');
});
test('a valid number replaces such a length',()=>{
 const change=vi.fn();render(<Host initial={45} change={change}/>);
 fireEvent.focus(field());fireEvent.change(field(),{target:{value:'7'}});
 expect(change).toHaveBeenLastCalledWith(7);
});
test('from a length in range, typing past the limit still settles on the limit when leaving the field',()=>{
 const change=vi.fn();render(<Host initial={8} change={change}/>);
 fireEvent.focus(field());fireEvent.change(field(),{target:{value:'70'}});fireEvent.blur(field());
 expect(change).toHaveBeenLastCalledWith(12);expect(field().value).toBe('12');
});
