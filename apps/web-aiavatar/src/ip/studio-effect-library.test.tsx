// @vitest-environment jsdom
import {useEffect,useState} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import type {StudioVideoEffect} from '@ai-star-eco/types';
import {StudioMotionPrompt,studioCameraMotions} from './studio-motion-prompt';
import {StudioEffectLibrary} from './studio-effect-library';
import * as api from '@/canvas-bridge/effect-api';
vi.mock('@/canvas-bridge/effect-api',()=>({listVideoEffects:vi.fn(),favoriteVideoEffect:vi.fn(),applyVideoEffect:vi.fn(),publishVideoEffect:vi.fn()}));
vi.mock('@/canvas-bridge/api',()=>({fetchModels:vi.fn(async()=>({image:[],video:[{endpointId:'h3',name:'H3'},{endpointId:'other',name:'Other'}]}))}));
vi.mock('@/canvas/stores/use-theme-store',()=>({useThemeStore:()=> 'light'}));
vi.mock('antd',()=>{
 const Input=Object.assign(({prefix,...p}:any)=><input {...p}/>,{TextArea:({rows,...p}:any)=><textarea {...p}/>});
 return {Input,Image:()=>null,Skeleton:()=><p>加载中</p>,Alert:({title,action}:any)=><div role="alert">{title}{action}</div>,
 Button:({icon,type,size,loading,...p}:any)=><button disabled={loading||p.disabled} {...p}/>,
 Checkbox:({children,checked,onChange}:any)=><label><input type="checkbox" checked={checked} onChange={onChange}/>{children}</label>,
 Select:({options,allowClear,mode,value,onChange,...p}:any)=><select {...p} multiple={mode==='multiple'} value={value|| (mode==='multiple'?[]:'')} onChange={e=>onChange(mode==='multiple'?[...e.target.selectedOptions].map(o=>o.value):e.target.value||undefined)}><option value="">无</option>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
 Modal:({title,children,onCancel,open,afterClose}:any)=>{useEffect(()=>{if(!open)afterClose?.();},[open]);return open?<div role="dialog" aria-label={title}><button onClick={onCancel}>关闭</button>{children}</div>:null;},
 Popover:({children,open,content,onOpenChange}:any)=><><span onClick={()=>onOpenChange(!open)}>{children}</span>{open&&content}</>};
});
const effect:StudioVideoEffect={id:'e',name:'产品光影',summary:'材质展示',prompt:'侧光缓慢扫过产品，保留标识。',author:'IP Studio',visibility:'official',tags:['产品'],models:['h3'],favorite:false,createdAt:'2026-10-08T00:00:00Z'};
let server:StudioVideoEffect[], latest='';const apply=vi.fn(),catalog=vi.fn();
function Host({initial='主体 @图1 末尾'}:{initial?:string}){const [value,setValue]=useState(initial);latest=value;return <StudioMotionPrompt videoModel="h3" ariaLabel="创作要求" value={value} references={[{id:'r',nodeId:'r',label:'@图1',title:'人物',kind:'image',active:true}]} onChange={setValue}/>;}
const open=async()=>{fireEvent.click(screen.getByRole('button',{name:'打开视频特效库'}));await screen.findByRole('button',{name:'选用特效 产品光影'});};
beforeEach(()=>{vi.clearAllMocks();server=[{...effect}];vi.mocked(api.listVideoEffects).mockImplementation(async()=>server.map(e=>({...e})));vi.mocked(api.applyVideoEffect).mockImplementation(async(id,model)=>{const e=server.find(e=>e.id===id)!;if(!e.models.includes(model))throw Error('当前模型不适用');return Object.assign(e,{lastUsedAt:'2026-10-08T01:00:00Z'});});vi.mocked(api.favoriteVideoEffect).mockImplementation(async(id,favorite)=>Object.assign(server.find(e=>e.id===id)!,{favorite}));vi.stubGlobal('requestAnimationFrame',(callback:Function)=>{callback();return 1;});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('all entry points insert a complete instruction at the remembered caret without losing refs or submitting a generation',async()=>{
 render(<Host/>);const editor=screen.getByRole('textbox',{name:'创作要求'});editor.focus();const range=document.createRange();range.setStart(editor.firstChild!,2);range.collapse(true);window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);fireEvent.mouseUp(editor);
 await open();fireEvent.click(screen.getByRole('button',{name:'选用特效 产品光影'}));await waitFor(()=>expect(screen.queryByRole('dialog',{name:'视频特效'})).toBeNull());
 await waitFor(()=>expect(latest).toBe(`主体${effect.prompt}  @图1 末尾`));expect(editor.querySelector('[data-ref-label]')).toBeDefined();expect(screen.getByRole('button',{name:'移除产品光影指令'})).toBeDefined();expect(api.applyVideoEffect).toHaveBeenCalledWith('e','h3');
 fireEvent.click(screen.getByRole('button',{name:'移除产品光影指令'}));expect(latest).toBe('主体  @图1 末尾');
});
test('an incompatible effect can be inspected but cannot be applied and never changes the model',async()=>{
 render(<StudioEffectLibrary model="other" onApply={apply} onCatalog={catalog} onRememberCaret={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'打开视频特效库'}));await screen.findByText('没有匹配的特效');fireEvent.click(screen.getByRole('checkbox',{name:'仅适用当前模型'}));fireEvent.click(screen.getByRole('button',{name:'查看不适用的特效 产品光影'}));expect((screen.getByRole('button',{name:'选用特效'}) as HTMLButtonElement).disabled).toBe(true);expect(api.applyVideoEffect).not.toHaveBeenCalled();expect(apply).not.toHaveBeenCalled();
});
test('favorite and recent survive close/reopen and the entire catalogue rehydrates named instructions',async()=>{
 render(<StudioEffectLibrary model="h3" onApply={apply} onCatalog={catalog} onRememberCaret={()=>{}}/>);await open();fireEvent.click(screen.getByRole('button',{name:'收藏 产品光影'}));await screen.findByRole('button',{name:'取消收藏 产品光影'});fireEvent.click(screen.getByRole('tab',{name:'我的收藏'}));expect(screen.getByRole('button',{name:'选用特效 产品光影'})).toBeDefined();fireEvent.click(screen.getByRole('button',{name:'选用特效 产品光影'}));await waitFor(()=>expect(apply).toHaveBeenCalled());
 await open();fireEvent.click(screen.getByRole('tab',{name:'最近使用'}));expect(screen.getByRole('button',{name:'选用特效 产品光影'})).toBeDefined();expect(catalog).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({favorite:true,lastUsedAt:'2026-10-08T01:00:00Z'})]));
});
test('personal publication saves exact text, declared models and owned preview, then shows the new release without applying it',async()=>{
 vi.mocked(api.publishVideoEffect).mockImplementation(async req=>{const e={...effect,...req,id:'mine',author:'我',favorite:false,createdAt:'2026-10-09T00:00:00Z'};server.push(e);return e;});
 render(<StudioEffectLibrary model="h3" onApply={apply} onCatalog={catalog} onRememberCaret={()=>{}} previews={[{storageKey:'own/preview',name:'人物图'}]}/>);await open();fireEvent.click(screen.getByRole('button',{name:'保存我的特效'}));fireEvent.change(screen.getByRole('textbox',{name:'特效名称'}),{target:{value:'人物消散'}});fireEvent.change(screen.getByRole('textbox',{name:'特效效果描述'}),{target:{value:'自定义完整指令'}});fireEvent.click(screen.getByRole('checkbox',{name:'通用描述，可用于所有已配置视频模型'}));fireEvent.change(screen.getByRole('combobox',{name:'特效参考封面'}),{target:{value:'own/preview'}});
 const select=screen.getByRole('listbox',{name:'特效适用模型'}) as HTMLSelectElement;select.options[1].selected=true;fireEvent.change(select);fireEvent.click(screen.getByRole('button',{name:'保存特效'}));await screen.findByRole('button',{name:'选用特效 人物消散'});expect(api.publishVideoEffect).toHaveBeenCalledWith(expect.objectContaining({prompt:'自定义完整指令',models:['h3'],visibility:'personal',previewKey:'own/preview'}));expect(screen.getByRole('tab',{name:'我的特效'}).getAttribute('aria-selected')).toBe('true');
});
test('failed apply keeps the library and original prompt for explicit retry',async()=>{
 vi.mocked(api.applyVideoEffect).mockRejectedValue(Error('连接失败，尚未应用'));render(<Host/>);await open();fireEvent.click(screen.getByRole('button',{name:'选用特效 产品光影'}));await screen.findByRole('alert');expect(latest).toBe('主体 @图1 末尾');expect(screen.getByRole('dialog',{name:'视频特效'})).toBeDefined();
});
test('search covers author, tags and actual model names; an empty query result is recoverable',async()=>{
 render(<StudioEffectLibrary model="h3" onApply={apply} onCatalog={catalog} onRememberCaret={()=>{}}/>);await open();const search=screen.getByRole('textbox',{name:'搜索视频特效'});for(const value of ['IP Studio','产品','H3']){fireEvent.change(search,{target:{value}});expect(screen.getByRole('button',{name:'选用特效 产品光影'})).toBeDefined();}fireEvent.change(search,{target:{value:'不存在'}});expect(screen.getByText('没有匹配的特效')).toBeDefined();fireEvent.change(search,{target:{value:''}});expect(screen.getByRole('button',{name:'选用特效 产品光影'})).toBeDefined();
});
test('details and favorite remain independent of selecting a card',async()=>{
 render(<StudioEffectLibrary model="h3" onApply={apply} onCatalog={catalog} onRememberCaret={()=>{}}/>);await open();fireEvent.click(screen.getByRole('button',{name:'查看特效详情 产品光影'}));expect(screen.getByRole('region',{name:'特效详情'})).toBeDefined();expect(api.applyVideoEffect).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'选用特效'}));await waitFor(()=>expect(apply).toHaveBeenCalledWith(expect.objectContaining({id:'e'}),expect.arrayContaining([expect.objectContaining({id:'e'})])));
});
test('replacing a selected effect retains authored text and references without duplicate selections',async()=>{
 const second={...effect,id:'second',name:'花瓣消散',prompt:'人物缓慢化作花瓣。'};server.push(second);
 render(<Host/>);await open();fireEvent.click(screen.getByRole('button',{name:'选用特效 产品光影'}));await waitFor(()=>expect(latest).toContain(effect.prompt));expect(screen.getByRole('button',{name:'打开视频特效库'}).textContent).toBe('替换特效');
 await open();fireEvent.click(screen.getByRole('button',{name:'选用特效 花瓣消散'}));await waitFor(()=>expect(latest).toContain(second.prompt));expect(latest).not.toContain(effect.prompt);expect(latest).toContain('主体 @图1 末尾');expect(screen.getAllByRole('button',{name:/移除.*指令/})).toHaveLength(1);
 await open();fireEvent.click(screen.getByRole('button',{name:'选用特效 花瓣消散'}));await waitFor(()=>expect(api.applyVideoEffect).toHaveBeenCalledTimes(3));expect(latest.split(second.prompt)).toHaveLength(2);
});
test('slow selection cannot be cancelled or submitted twice, and failures preserve the existing selection',async()=>{
 let reject!: (e:Error)=>void;vi.mocked(api.applyVideoEffect).mockReturnValue(new Promise((_resolve,r)=>reject=r));
 render(<Host/>);await open();fireEvent.click(screen.getByRole('button',{name:'选用特效 产品光影'}));expect((screen.getByRole('button',{name:'选用特效 产品光影'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'关闭'}));expect(screen.getByRole('dialog',{name:'视频特效'})).toBeDefined();fireEvent.click(screen.getByRole('button',{name:'选用特效 产品光影'}));expect(api.applyVideoEffect).toHaveBeenCalledTimes(1);reject(Error('模型已停用，选择尚未应用'));await screen.findByRole('alert');expect(latest).toBe('主体 @图1 末尾');expect((screen.getByRole('button',{name:'选用特效 产品光影'}) as HTMLButtonElement).disabled).toBe(false);
});
test('a saved prompt with multiple effects converges to one selection and leaves camera and reference chips intact',async()=>{
 const second={...effect,id:'second',name:'花瓣消散',prompt:'人物缓慢化作花瓣。'};server.push(second);const motion=studioCameraMotions[0];
 render(<Host initial={`主体 @图1 ${motion.text} ${effect.prompt} ${second.prompt} 末尾`}/>);await open();fireEvent.click(screen.getByRole('button',{name:'选用特效 花瓣消散'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await waitFor(()=>expect(latest).toBe(`主体 @图1 ${motion.text} ${second.prompt}  末尾`));expect(screen.getByRole('button',{name:`移除${motion.label}指令`})).toBeDefined();expect(screen.getByRole('button',{name:'移除花瓣消散指令'})).toBeDefined();expect(screen.getByRole('textbox',{name:'创作要求'}).querySelector('[data-ref-label]')).toBeDefined();
});
test('a customized effect description remains authored text when choosing another effect',async()=>{
 const custom='侧光快速扫过我的产品，保持中文商标。';render(<Host initial={`主体 @图1 ${custom} 末尾`}/>);await open();fireEvent.click(screen.getByRole('button',{name:'选用特效 产品光影'}));await waitFor(()=>expect(latest).toContain(effect.prompt));expect(latest).toContain(custom);
});
