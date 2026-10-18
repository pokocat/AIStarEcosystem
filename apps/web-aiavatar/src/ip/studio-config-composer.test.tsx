// @vitest-environment jsdom
import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {CanvasConfigComposer} from '@/canvas/components/canvas/canvas-config-composer';
vi.mock('@/canvas/stores/use-theme-store',()=>({useThemeStore:()=> 'light'}));
vi.mock('@/canvas-bridge/i18n',()=>({default:{t:(key:string)=>key}}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
vi.mock('@/canvas/components/canvas/canvas-node-reference-bar',()=>({CanvasNodeReferenceBar:()=>null}));
vi.mock('antd',()=>({Button:({children,...p}:any)=><button>{children}</button>,Image:()=>null}));
afterEach(cleanup);
test('config editor hides preedit hint, commits Chinese, and restores it after cancelled composition',()=>{
 let latest='';function Host(){const[value,setValue]=useState('');latest=value;return <CanvasConfigComposer nodeId="node" nodes={[]} inputs={[]} value={value} onChange={setValue} onClose={()=>{}}/>}
 render(<Host/>);const editor=screen.getByRole('textbox');editor.focus();fireEvent.compositionStart(editor);editor.textContent='ca';fireEvent.input(editor,{isComposing:true});
 expect(screen.queryByText('canvas.composer.placeholder')).toBeNull();expect(latest).toBe('');
 const enter=fireEvent.keyDown(editor,{key:'Enter',isComposing:true,keyCode:229});expect(enter).toBe(true);
 editor.textContent='擦';fireEvent.compositionEnd(editor,{data:'擦'});expect(latest).toBe('擦');
 editor.textContent='';fireEvent.input(editor);fireEvent.compositionStart(editor);editor.textContent='';fireEvent.compositionEnd(editor,{data:''});expect(screen.getByText('canvas.composer.placeholder')).toBeDefined();
});
