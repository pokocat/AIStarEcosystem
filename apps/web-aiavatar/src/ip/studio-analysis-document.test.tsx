// @vitest-environment jsdom
import {useState} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {StudioAnalysisDocument} from './studio-analysis-document';
const state=vi.hoisted(()=>({save:vi.fn(),close:vi.fn()}));
vi.mock('antd',()=>({Modal:({children,title}:any)=><section role="dialog" aria-label={title}>{children}</section>,Button:({loading,type,icon,...p}:any)=><button {...p} disabled={loading||p.disabled}>{p.children}</button>}));
vi.mock('./studio-errors',()=>({useStudioErrorState:()=>useState(''),StudioErrorNotice:({error}:any)=><p role="alert">{String(error)}</p>}));
vi.mock('./studio-script-rich-editor',()=>({StudioScriptRichEditor:({markdown,onChange}:any)=><textarea aria-label="创作拆解文档" value={markdown} onChange={e=>onChange(e.target.value)}/>}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
test('the script Markdown editor preserves user edits when saving fails and retries before returning to the canvas',async()=>{
 state.save.mockRejectedValueOnce(new Error('保存失败')).mockResolvedValue(undefined);
 function Host(){const[value,setValue]=useState('# 全片创作拆解\n\n| 维度 | 全片特征 |\n| --- | --- |\n| 色彩 | 冷绿 |');return <StudioAnalysisDocument value={value} onChange={setValue} onSave={state.save} onClose={state.close}/>;}
 render(<Host/>);const editor=screen.getByRole('textbox',{name:'创作拆解文档'});fireEvent.change(editor,{target:{value:'# 全片创作拆解\n\n我补充的创作判断'}});fireEvent.click(screen.getByRole('button',{name:'返回画布'}));
 await screen.findByRole('alert');expect(state.close).not.toHaveBeenCalled();expect((editor as HTMLTextAreaElement).value).toContain('我补充的创作判断');
 fireEvent.click(screen.getByRole('button',{name:'返回画布'}));await waitFor(()=>expect(state.close).toHaveBeenCalledOnce());expect(state.save).toHaveBeenCalledTimes(2);
});
