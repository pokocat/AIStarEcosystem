import {cleanup,fireEvent,render} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {Editable} from './editable';
afterEach(cleanup);
test('confirming an IME candidate keeps inline editing active; plain Enter commits',()=>{
 const commit=vi.fn();const {container}=render(<Editable value="" onCommit={commit}/>);const field=container.querySelector('[contenteditable]') as HTMLElement;
 field.focus();fireEvent.compositionStart(field);field.innerText='擦';fireEvent.keyDown(field,{key:'Enter',isComposing:true,keyCode:229});expect(document.activeElement).toBe(field);expect(commit).not.toHaveBeenCalled();
 fireEvent.compositionEnd(field,{data:'擦'});fireEvent.keyDown(field,{key:'Enter'});expect(commit).toHaveBeenCalledWith('擦');
});
