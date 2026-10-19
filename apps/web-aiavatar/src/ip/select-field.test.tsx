// @vitest-environment jsdom
import { createRef,useState } from 'react';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,expect,test,vi } from 'vitest';
import { SelectField } from '@ai-star-eco/ui/ui/select-field';
import { setupSelectFieldDom,createSelectFieldUser } from '../../../../scripts/vitest/select-field';
setupSelectFieldDom();
const selectFieldValue=createSelectFieldUser({fireEvent,screen});afterEach(cleanup);

test('visible popup preserves empty values and real HTML change events',async()=>{
 const change=vi.fn();
 function Host(){const [value,setValue]=useState('draft');return <label>状态<SelectField name="status" value={value} onChange={e=>{change(e.target instanceof HTMLSelectElement,e.target.value);setValue(e.target.value);}}><option value="">全部</option><option value="draft">草稿</option><option value="published" disabled>已发布</option></SelectField></label>}
 render(<Host/>);const field=screen.getByRole('combobox',{name:'状态'});expect(field.tagName).toBe('BUTTON');
 fireEvent.keyDown(field,{key:'ArrowDown'});expect((await screen.findByRole('option',{name:'已发布'})).getAttribute('aria-disabled')).toBe('true');
 fireEvent.click(screen.getByRole('option',{name:'全部'}));expect(change).toHaveBeenCalledWith(true,'');
 expect(field.textContent).toBe('全部');expect(screen.queryByRole('listbox')).toBeNull();
});
test('uncontrolled forms submit and reset their original value',async()=>{
 render(<form data-testid="form"><SelectField name="ratio" aria-label="画幅" defaultValue="9:16"><option value="9:16">竖屏</option><option value="16:9">横屏</option></SelectField><button type="reset">重置</button></form>);
 await selectFieldValue(screen.getByRole('combobox',{name:'画幅'}),'16:9');
 expect(new FormData(screen.getByTestId('form') as HTMLFormElement).get('ratio')).toBe('16:9');
 fireEvent.click(screen.getByRole('button',{name:'重置'}));expect(screen.getByRole('combobox').textContent).toBe('竖屏');
});
test('disabled controls stay closed and external updates remain visible',()=>{
 const view=render(<SelectField value="a" disabled aria-label="模型"><option value="a">模型甲</option><option value="b">模型乙</option></SelectField>);
 const field=screen.getByRole('combobox',{name:'模型'});fireEvent.keyDown(field,{key:'ArrowDown'});expect(screen.queryByRole('listbox')).toBeNull();
 view.rerender(<SelectField value="b" disabled aria-label="模型"><option value="a">模型甲</option><option value="b">模型乙</option></SelectField>);expect(field.textContent).toBe('模型乙');
});
test('Escape dismisses the page menu and restores field focus',async()=>{
 render(<SelectField aria-label="排序"><option value="new">最近编辑</option><option value="old">最近创建</option></SelectField>);
 const field=screen.getByRole('combobox');fireEvent.keyDown(field,{key:'ArrowDown'});await screen.findByRole('listbox');fireEvent.keyDown(document.activeElement!,{key:'Escape'});
 await waitFor(()=>expect(screen.queryByRole('listbox')).toBeNull());await waitFor(()=>expect(document.activeElement).toBe(field));
});

test('forwarded focus and externally associated forms keep working',()=>{
 const ref=createRef<HTMLSelectElement>();
 render(<><form id="external" data-testid="external"/><SelectField ref={ref} form="external" name="model" value="a" aria-label="生成模型"><option value="a">模型甲</option></SelectField></>);
 act(()=>ref.current?.focus());expect(document.activeElement).toBe(screen.getByRole('combobox',{name:'生成模型'}));
 expect(new FormData(screen.getByTestId('external') as HTMLFormElement).get('model')).toBe('a');
});
