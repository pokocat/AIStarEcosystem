// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioFloatingPanel } from './studio-floating-panel';
beforeEach(()=>{
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
  const stage=document.createElement('div');stage.dataset.studioFloatingRoot='';document.body.append(stage);
});
afterEach(()=>{cleanup();document.body.replaceChildren();vi.unstubAllGlobals();});
function Host({locked=false,consume=false}: {locked?:boolean;consume?:boolean}) {
  const[a,setA]=useState(true),[b,setB]=useState(true);
  return <><StudioFloatingPanel open={a} title="图片" onClose={()=>setA(false)}><input aria-label="图片提示" onKeyDown={e=>{if(consume&&e.key==='Escape')e.preventDefault();}}/></StudioFloatingPanel>
    <StudioFloatingPanel open={b} title="助手" closable={!locked} onClose={()=>setB(false)}><input aria-label="助手提示"/></StudioFloatingPanel></>;
}
test('pointer and keyboard focus raise a panel; Escape closes only the active panel',()=>{
  render(<Host/>);
  expect(screen.getByRole('dialog',{name:'助手'}).dataset.active).toBe('true');
  fireEvent.pointerDown(screen.getByRole('dialog',{name:'图片'}));
  expect(Number(screen.getByRole('dialog',{name:'图片'}).style.zIndex)).toBeGreaterThan(Number(screen.getByRole('dialog',{name:'助手'}).style.zIndex));
  fireEvent.focus(screen.getByRole('textbox',{name:'助手提示'}));fireEvent.keyDown(document,{key:'Escape'});
  expect(screen.queryByRole('dialog',{name:'助手'})).toBeNull();expect(screen.getByRole('dialog',{name:'图片'})).toBeDefined();
  fireEvent.keyDown(document,{key:'Escape'});expect(screen.queryByRole('dialog',{name:'图片'})).toBeNull();
});
test('a locked active panel prevents Escape from closing an unrelated panel behind it',()=>{
  render(<Host locked/>);fireEvent.keyDown(document,{key:'Escape'});
  expect(screen.getAllByRole('dialog')).toHaveLength(2);
});
test('inner editor consumes its first Escape and visible menus and expanded modals protect focus',()=>{
  render(<Host consume/>);const input=screen.getByRole('textbox',{name:'图片提示'});fireEvent.focus(input);fireEvent.keyDown(input,{key:'Escape'});
  expect(screen.getAllByRole('dialog')).toHaveLength(2);
  for(const className of ['ant-select-dropdown','ant-modal-wrap']){
    const popup=document.createElement('div');popup.className=className;document.body.append(popup);fireEvent.keyDown(document,{key:'Escape'});
    expect(screen.getAllByRole('dialog')).toHaveLength(2);popup.remove();
  }
});
