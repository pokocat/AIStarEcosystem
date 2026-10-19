// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StudioSpeech } from "./studio-speech";
const api=vi.hoisted(()=>({studioSpeechCatalog:vi.fn(),studioVoiceProfiles:vi.fn(),bindStudioVoice:vi.fn()}));
vi.mock('./studio-floating-panel',()=>({StudioFloatingPanel:({open,title,children,onClose,footer}:any)=>open?<section role="dialog" aria-label={title}><button aria-label={title==='生成视频'||title==='生成图片'||title==='创作剧本'||title==='拆分镜头'?'关闭创作面板':`关闭${title}`} onClick={onClose}>关闭</button>{children}{footer}</section>:null}));
vi.mock("@/canvas-bridge/studio-api",()=>api);
vi.mock("@/canvas-bridge/signed-audio",()=>({SignedAudio:()=>null}));
vi.mock("antd",()=>({
  Drawer:({open,children}:any)=>open?<div>{children}</div>:null,
  Button:({children,onClick,disabled}:any)=><button disabled={disabled} onClick={onClick}>{children}</button>,
  Select:({value,onChange,options,disabled,...props}:any)=><select aria-label={props["aria-label"]} disabled={disabled} value={value||""} onChange={e=>onChange(e.target.value)}>{options?.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
  Input:{TextArea:({value,onChange,disabled,...props}:any)=><textarea aria-label={props["aria-label"]} disabled={disabled} value={value} onChange={onChange}/>}
}));
afterEach(cleanup);
beforeEach(()=>{
  vi.clearAllMocks();api.studioSpeechCatalog.mockResolvedValue({models:[{endpointId:"tts",isDefault:true,name:"Qwen",creditCost:8}],voices:[{speaker:"Vivian",name:"Vivian",language:"中文"},{speaker:"Serena",name:"Serena",language:"中文"}],maxTextLength:600,maxInstructLength:160});
  api.studioVoiceProfiles.mockResolvedValue({performers:[{avatarId:"a",name:"小紫",voiceId:"v2"}],profiles:[{voiceId:"v1",avatarId:"a",name:"原声音",version:1,speaker:"Vivian",instruct:"自然"},{voiceId:"v2",avatarId:"a",name:"新默认",version:2,speaker:"Serena",instruct:"温柔"}]});
});
test("a selected historical audio retains its version after the person default changes",async()=>{
  const submit=vi.fn().mockResolvedValue(undefined);render(<StudioSpeech open onClose={()=>{}} initialText="原台词" initialAvatarId="a" initialVoiceId="v1" busy={false} onSubmit={submit}/>);
  await waitFor(()=>expect((screen.getByRole("combobox",{name:"声音版本"}) as HTMLSelectElement).value).toBe("v1"));
  expect((screen.getByRole("combobox",{name:"固定音色"}) as HTMLSelectElement).disabled).toBe(true);
  expect((screen.getByRole("textbox",{name:"声音风格"}) as HTMLTextAreaElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"生成配音 · 8 积分"}));
  expect(submit).toHaveBeenCalledWith({model:"tts",text:"原台词",speaker:"Vivian",instruct:"自然",maxCost:8,avatarId:"a",voiceId:"v1"});
});
test("canvas focus changes while the drawer is open cannot replace edited speech",async()=>{
  const props={open:true,onClose:()=>{},busy:false,onSubmit:vi.fn().mockResolvedValue(undefined)};
  const view=render(<StudioSpeech {...props} initialText="初始台词" initialAvatarId="a"/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:"生成配音 · 8 积分"})).toBeDefined());
  fireEvent.change(screen.getByRole("textbox",{name:"配音正文"}),{target:{value:"我正在修改的台词"}});
  view.rerender(<StudioSpeech {...props} initialText="另一个节点的台词"/>);
  expect((screen.getByRole("textbox",{name:"配音正文"}) as HTMLTextAreaElement).value).toBe("我正在修改的台词");
});

test('a restored temporary voice draft keeps its text, model and style rather than adopting the new person default',async()=>{
 const draft={model:'tts',avatarId:'a',speaker:'Vivian',text:'杯子介绍',instruct:'清晰自然'};const update=vi.fn();
 render(<StudioSpeech open onClose={()=>{}} initialText="" initialAvatarId="a" initialDraft={draft} onDraft={update} busy={false} onSubmit={vi.fn()}/>);
 await waitFor(()=>expect(update).toHaveBeenCalledWith(draft));
 expect((screen.getByRole('combobox',{name:'声音版本'}) as HTMLSelectElement).value).toBe('temporary');
 expect((screen.getByRole('textbox',{name:'配音正文'}) as HTMLTextAreaElement).value).toBe('杯子介绍');
 expect((screen.getByRole('textbox',{name:'声音风格'}) as HTMLTextAreaElement).disabled).toBe(false);
});

test('an unknown accepted outcome shows same-task confirmation instead of a fresh speech submit',async()=>{
 const submit=vi.fn(),confirm=vi.fn();
 render(<StudioSpeech open onClose={()=>{}} initialText="原任务" pending={{confirmed:false}} onConfirm={confirm} busy={false} onSubmit={submit}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'确认原任务'})).toBeDefined());
 expect(screen.queryByRole('button',{name:'生成配音 · 8 积分'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'确认原任务'}));expect(confirm).toHaveBeenCalledOnce();expect(submit).not.toHaveBeenCalled();
});

test('per-second speech displays the reservation ceiling and submits that approved amount',async()=>{
 api.studioSpeechCatalog.mockResolvedValue({models:[{endpointId:'tts',isDefault:true,name:'Qwen',creditCost:null,creditCostPerSecond:1.5}],voices:[{speaker:'Vivian',name:'Vivian',language:'中文'}],maxTextLength:600,maxInstructLength:160});
 const submit=vi.fn().mockResolvedValue(undefined);render(<StudioSpeech open onClose={()=>{}} initialText="你好😀" busy={false} onSubmit={submit}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'生成配音 · 预冻结 20 积分'})).toBeDefined());
 expect(screen.getByText(/完成后退回差额/)).toBeDefined();
 fireEvent.click(screen.getByRole('button',{name:'生成配音 · 预冻结 20 积分'}));
 expect(submit).toHaveBeenCalledWith({model:'tts',speaker:'Vivian',text:'你好😀',instruct:undefined,maxCost:20});
});
