// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import { StudioMotionPrompt,studioCameraMotions } from './studio-motion-prompt';
vi.mock('@/canvas/stores/use-theme-store',()=>({useThemeStore:()=> 'light'}));
vi.mock('antd',()=>({
  Button:({icon,type,size,children,...props}:any)=><button {...props}>{children}</button>,
  Input:({prefix,...props}:any)=><input {...props}/>,Image:()=>null,
  Modal:()=>null,
  Popover:({children,open,content,onOpenChange}:any)=><>{<span onClick={()=>onOpenChange(!open)}>{children}</span>}{open&&content}</>,
}));
const reference={id:'ref',label:'@图1',title:'人物',kind:'image',active:true} as const;
const push=studioCameraMotions[0],pull=studioCameraMotions[1];
let latest='';
function Host({initial='',references=[]}:any){const [value,setValue]=useState(initial);latest=value;return <StudioMotionPrompt ariaLabel="创作要求" value={value} references={references} onChange={setValue}/>;}
function caret(node:Node,offset:number,end=offset){const range=document.createRange();range.setStart(node,offset);range.setEnd(node,end);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);}
function select(motion=push){fireEvent.click(screen.getByRole('button',{name:'插入运镜指令'}));fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${motion.label}`)}));}
beforeEach(()=>{vi.stubGlobal('requestAnimationFrame',(callback:Function)=>{callback();return 1;});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('insertion preserves text and upstream reference at the remembered caret after focus moves to search',()=>{
 render(<Host initial="前景 @图1 后景" references={[reference]}/>);const editor=screen.getByRole('textbox',{name:'创作要求'});editor.focus();caret(editor.firstChild!,2);fireEvent.mouseUp(editor);
 select();expect(latest).toBe(`前景${push.text}  @图1 后景`);expect(editor.querySelector('[data-ref-label]')?.getAttribute('data-ref-label')).toBe('@图1');expect(screen.getByRole('button',{name:'移除缓慢推进指令'})).toBeDefined();
});
test('selection is replaced without replacing the surrounding prompt; X removes only that instruction',()=>{
 render(<Host initial="前景 占位 后景"/>);const editor=screen.getByRole('textbox',{name:'创作要求'});editor.focus();caret(editor.firstChild!,3,5);fireEvent.mouseUp(editor);select();expect(latest).toBe(`前景 ${push.text}  后景`);
 fireEvent.click(screen.getByRole('button',{name:'移除缓慢推进指令'}));expect(latest).toBe('前景   后景');
});
test.each(['Backspace','Delete'])('keyboard %s removes a whole motion chip and retains surrounding words',key=>{
 render(<Host initial={`前景 ${push.text} 后景`}/>);const editor=screen.getByRole('textbox',{name:'创作要求'});editor.focus();const chip=editor.querySelector('[data-command-text]')!;caret(editor,Array.from(editor.childNodes).indexOf(chip)+(key==='Backspace'?1:0));fireEvent.keyDown(editor,{key});expect(latest).toBe('前景  后景');expect(editor.querySelector('[data-command-text]')).toBeNull();
});
test('editing a chip exposes its full instruction and normal edits persist without a second hidden value',()=>{
 render(<Host initial={`人物。${push.text}`}/>);const editor=screen.getByRole('textbox',{name:'创作要求'});fireEvent.click(screen.getByRole('button',{name:'编辑缓慢推进指令'}));expect(window.getSelection()?.toString()).toBe(push.text);expect(editor.querySelector('[data-command-text]')).toBeNull();editor.textContent='人物。镜头快速推进。';fireEvent.input(editor);expect(latest).toBe('人物。镜头快速推进。');
});
test('copy and cut serialize complete instructions and reference labels rather than display button names',()=>{
 render(<Host initial={`人物 @图1 ${push.text}`} references={[reference]}/>);const editor=screen.getByRole('textbox',{name:'创作要求'});editor.focus();caret(editor,0,editor.childNodes.length);const setData=vi.fn();fireEvent.copy(editor,{clipboardData:{setData}});expect(setData).toHaveBeenCalledWith('text/plain',`人物 @图1 ${push.text}`);
 fireEvent.cut(editor,{clipboardData:{setData}});expect(latest).toBe('');
});
test('paste accepts plain text only and restores both instruction chips and references',()=>{
 render(<Host references={[reference]}/>);const editor=screen.getByRole('textbox',{name:'创作要求'});editor.focus();caret(editor,0);fireEvent.paste(editor,{clipboardData:{getData:(kind:string)=>kind==='text/plain'?`首行\n@图1 ${pull.text}`:'<script>ignored</script>'}});expect(latest).toBe(`首行\n@图1 ${pull.text}`);expect(editor.querySelector('[data-command-text]')).toBeDefined();expect(editor.querySelector('[data-ref-label]')).toBeDefined();
});
test('search empty state and Escape are keyboard accessible; opening does not alter the prompt',()=>{
 render(<Host initial="已有文案"/>);fireEvent.click(screen.getByRole('button',{name:'插入运镜指令'}));const search=screen.getByRole('textbox',{name:'搜索运镜指令'});expect(document.activeElement).toBe(search);fireEvent.change(search,{target:{value:'不存在'}});expect(screen.getByRole('status').textContent).toContain('没有匹配');fireEvent.keyDown(search,{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(screen.getByRole('button',{name:'插入运镜指令'}));expect(latest).toBe('已有文案');
});
test('restoring a saved prompt reconstructs the same chip; unrelated model rerenders keep the caret',()=>{
 const changed=vi.fn();const view=render(<StudioMotionPrompt ariaLabel="创作要求" references={[]} value={`主体。${pull.text}`} onChange={changed}/>);const editor=screen.getByRole('textbox',{name:'创作要求'});editor.focus();caret(editor.firstChild!,1);fireEvent.keyUp(editor,{key:'ArrowLeft'});view.rerender(<StudioMotionPrompt ariaLabel="创作要求" references={[]} value={`主体。${pull.text}`} onChange={changed}/>);expect(window.getSelection()?.anchorOffset).toBe(1);expect(within(editor).getByRole('button',{name:'移除缓慢拉远指令'})).toBeDefined();
});
test('palette pointer and click events never deselect the underlying canvas node',()=>{
 const pointer=vi.fn(),click=vi.fn();render(<div onPointerDown={pointer} onClick={click}><Host/></div>);fireEvent.click(screen.getByRole('button',{name:'插入运镜指令'}));click.mockClear();const option=screen.getByRole('button',{name:new RegExp(`^${push.label}`)});fireEvent.pointerDown(option);fireEvent.click(option);expect(pointer).not.toHaveBeenCalled();expect(click).not.toHaveBeenCalled();expect(latest).toBe(`${push.text} `);
});

test('Escape reaches the containing panel only after the reference picker is dismissed',()=>{
 Object.defineProperty(Range.prototype,'getBoundingClientRect',{configurable:true,value:()=>new DOMRect(10,10,1,18)});
 Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:()=>{}});
 const escape=vi.fn();document.addEventListener('keydown',escape);
 try {
  render(<Host references={[reference]}/>);const editor=screen.getByRole('textbox',{name:'创作要求'});
  editor.focus();editor.textContent='@';caret(editor.firstChild!,1);fireEvent.input(editor);fireEvent.keyUp(editor,{key:'@'});
  expect(screen.getByRole('button',{name:/^@图1\s*人物$/})).toBeDefined();
  fireEvent.keyDown(editor,{key:'Escape'});expect(escape).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/^@图1\s*人物$/})).toBeNull();
  fireEvent.keyDown(editor,{key:'Escape'});expect(escape).toHaveBeenCalledOnce();
 }finally{document.removeEventListener('keydown',escape);delete (Range.prototype as Partial<Range>).getBoundingClientRect;delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;}
});
