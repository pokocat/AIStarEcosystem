// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {CanvasNodePromptPanel} from './canvas-node-prompt-panel';
import type {CanvasNodeData} from '@/canvas/types/canvas';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(s:string)=>s})}));
vi.mock('@/canvas-bridge/config-store',()=>({defaultConfig:{model:'model',videoModel:'model',videoSeconds:'8',videoCount:'4',vquality:'768',size:'768x1365'},useEffectiveConfig:()=>({model:'model',videoModel:'model',videoSeconds:'8',videoCount:'4',vquality:'768',size:'768x1365'}),useConfigStore:()=>()=>{},resolveModelForCapability:()=> 'model'}));
vi.mock('@/canvas-bridge/models',()=>({legacyVideoQuoteFor:()=>80,endpointIdFor:(value:string)=>value,nativeVideoModelFor:()=>undefined}));
vi.mock('@/canvas/stores/use-theme-store',()=>({useThemeStore:()=> 'light'}));
vi.mock('antd',()=>({Button:({type,danger,children,...p}:any)=><button {...p}>{children}</button>,Modal:()=>null,Tooltip:({children}:any)=>children}));
vi.mock('@/canvas/components/model-picker',()=>({ModelPicker:()=>null}));
vi.mock('./canvas-image-settings-popover',()=>({CanvasImageSettingsPopover:()=>null}));
vi.mock('./canvas-prompt-library',()=>({CanvasPromptLibrary:()=>null}));
vi.mock('./canvas-audio-settings-popover',()=>({CanvasAudioSettingsPopover:()=>null}));
vi.mock('./canvas-video-settings-popover',()=>({CanvasVideoSettingsPopover:()=>null}));
vi.mock('./canvas-text-settings-popover',()=>({CanvasTextSettingsPopover:()=>null}));
vi.mock('./canvas-node-reference-bar',()=>({CanvasNodeReferenceBar:()=>null}));
vi.mock('./canvas-prompt-chip-input',()=>({CanvasPromptChipInput:({value,onChange}:any)=><textarea value={value} onChange={e=>onChange(e.target.value)}/>}));
vi.mock('@/ip/studio-motion-prompt',()=>({StudioMotionPrompt:({value,onChange}:any)=><textarea value={value} onChange={e=>onChange(e.target.value)}/>}));
const base:CanvasNodeData={id:'v',type:'video' as never,title:'v',width:320,height:400,position:{x:0,y:0},metadata:{status:'loading',prompt:'saved',studio:{kind:'shot',request:{clientRequestId:'original',nodeId:'v',operation:'video',prompt:'saved'}}}};
afterEach(cleanup);
test.each([undefined,'accepted'])('a persisted pending task (%s) cannot trigger normal generate after the in-memory runner resets',runId=>{
 const generate=vi.fn(),stop=vi.fn();const node={...base,metadata:{...base.metadata,studio:{...base.metadata!.studio!,runId}}};
 render(<CanvasNodePromptPanel node={node} nodes={[node]} isRunning={false} onPromptChange={()=>{}} onConfigChange={()=>{}} onGenerate={generate} onStop={stop}/>);
 fireEvent.click(screen.getByRole('button',{name:runId?'canvas.promptPanel.stopGeneration':'确认原任务'}));expect(generate).not.toHaveBeenCalled();expect(stop).toHaveBeenCalledWith('v');
});
test('a definite terminal failure lets the user submit a new edited prompt',()=>{
 const generate=vi.fn();const node={...base,metadata:{...base.metadata,status:'error' as const}};render(<CanvasNodePromptPanel node={node} nodes={[node]} isRunning={false} onPromptChange={()=>{}} onConfigChange={()=>{}} onGenerate={generate} onStop={()=>{}}/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'retry with edits'}});fireEvent.click(screen.getByRole('button',{name:'canvas.promptPanel.generate'}));expect(generate).toHaveBeenCalledWith('v','video','retry with edits');
});
test('the native panel keeps camera instructions when parameters change and sends the same full prompt',()=>{
 const prompt='人物走向橱窗。镜头缓慢向前推进，逐渐靠近主体，保持主体在画面中央。';const generate=vi.fn(),change=vi.fn();
 const node={...base,metadata:{...base.metadata,status:'success' as const,prompt}};const props={node,nodes:[node],isRunning:false,onPromptChange:change,onConfigChange:()=>{},onGenerate:generate,onStop:()=>{}};
 const view=render(<CanvasNodePromptPanel {...props}/>);view.rerender(<CanvasNodePromptPanel {...props} node={{...node,metadata:{...node.metadata,videoCount:'2',seconds:'6'}}}/>);fireEvent.click(screen.getByRole('button',{name:'canvas.promptPanel.generate'}));expect(generate).toHaveBeenCalledWith('v','video',prompt);
});
test('opening and closing mobile references preserves the current prompt, connections and request',()=>{
 const generate=vi.fn(),change=vi.fn(),config=vi.fn();
 const node={...base,metadata:{...base.metadata,status:'success' as const}};
 const references=[{...base,id:'first',type:'image' as never},{...base,id:'last',type:'image' as never}];
 render(<CanvasNodePromptPanel node={node} nodes={[node,...references]} connectedNodes={references} isRunning={false} onPromptChange={change} onConfigChange={config} onGenerate={generate} onStop={()=>{}}/>);
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'edited in the native panel'}});
 fireEvent.click(screen.getByRole('button',{name:'展开参考内容'}));
 expect(screen.getByRole('button',{name:'收起参考内容'}).getAttribute('aria-expanded')).toBe('true');
 expect(screen.getByText('参考内容 · 2 项')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'收起参考内容'}));
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('edited in the native panel');
 expect(change).toHaveBeenCalledTimes(1);expect(config).not.toHaveBeenCalled();expect(generate).not.toHaveBeenCalled();
});
