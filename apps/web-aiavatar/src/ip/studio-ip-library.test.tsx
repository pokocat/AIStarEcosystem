// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {StudioIpLibrary} from './studio-ip-library';
import type {StudioIpAsset} from '@ai-star-eco/types/ip-studio-workflow';
const api=vi.hoisted(()=>({studioVoiceProfiles:vi.fn(),classifyStudioIpAsset:vi.fn()}));
vi.mock('@/canvas-bridge/studio-api',()=>api);
vi.mock('@/canvas-bridge/signed-image',()=>({SignedImage:({storageKey,src,alt,...p}:any)=><img src={src} alt={alt} {...p}/>}));
vi.mock('@/canvas-bridge/signed-audio',()=>({SignedAudio:()=> <audio aria-label="人物声音试听"/>}));
vi.mock('antd',()=>({Modal:({open,children}:any)=>open?<div role="dialog">{children}</div>:null,Button:({loading,block,...p}:any)=><button {...p} disabled={p.disabled||loading}/>,Input:({prefix,allowClear,...p}:any)=><input {...p}/>,Select:({options,value,allowClear,loading,onChange,...p}:any)=><select {...p} value={value||''} onChange={e=>onChange(e.target.value)}><option value=""/>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>}));
afterEach(cleanup);
const main:StudioIpAsset={ipId:'ip',avatarId:'a',version:2,storageKey:'main-key',url:'main',name:'小紫',characterName:'小紫',current:true,path:'ai'};
const sheet:StudioIpAsset={...main,current:false,name:'人物设定图',lookId:'sheet-look',storageKey:'sheet-key',assetRole:'sheet'};
const voice={voiceId:'v',avatarId:'a',name:'小紫声音',version:1,speaker:'Vivian'};
beforeEach(()=>{vi.clearAllMocks();api.studioVoiceProfiles.mockResolvedValue({performers:[{avatarId:'a',voiceId:'v'}],profiles:[voice]});});
const props=()=>({open:true,assets:[sheet,main],loading:false,error:'',onClose:vi.fn(),onRefresh:vi.fn(),onImport:vi.fn().mockResolvedValue(undefined),onAssetChange:vi.fn()});
test('a character opens its real dossier; whole-sheet selection imports the exact look and current saved voice',async()=>{
  const p=props();render(<StudioIpLibrary {...p}/>);expect(screen.getAllByRole('button',{name:'查看人物 小紫'})).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'查看人物 小紫'}));
  fireEvent.click(screen.getByRole('button',{name:'选择人物设定图 · 人物设定图'}));await waitFor(()=>expect(screen.getByText('小紫声音 · v1')).toBeDefined());
  expect(screen.getByText('脸部特写素材将在归档后显示')).toBeDefined();expect(screen.getByText('尚未填写人物属性')).toBeDefined();
  fireEvent.click(screen.getByRole('button',{name:'添加选中素材到画布'}));await waitFor(()=>expect(p.onImport).toHaveBeenCalledWith(sheet,voice));
});
test('an import save failure remains actionable and does not silently close the library',async()=>{
  const p=props();p.onImport.mockRejectedValue(new Error('保存失败'));render(<StudioIpLibrary {...p}/>);fireEvent.click(screen.getByRole('button',{name:'查看人物 小紫'}));fireEvent.click(screen.getByRole('button',{name:'添加选中素材到画布'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toBe('保存失败'));expect(p.onClose).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'添加选中素材到画布'}).disabled).toBe(false);
});
test('classification updates only the selected existing look and never starts generation',async()=>{
  const p=props();api.classifyStudioIpAsset.mockResolvedValue({...sheet,assetRole:'detail'});render(<StudioIpLibrary {...p}/>);fireEvent.click(screen.getByRole('button',{name:'查看人物 小紫'}));fireEvent.click(screen.getByRole('button',{name:'选择人物设定图 · 人物设定图'}));
  fireEvent.change(screen.getByRole('combobox',{name:'素材归类'}),{target:{value:'detail'}});await waitFor(()=>expect(p.onAssetChange).toHaveBeenCalledWith({...sheet,assetRole:'detail'}));expect(api.classifyStudioIpAsset).toHaveBeenCalledWith('a','sheet-look','detail');expect(p.onImport).not.toHaveBeenCalled();
});
test('My IP and Official IP show distinct real records and import the selected official snapshot',async()=>{
  const official={...main,avatarId:'official:demo:character',name:'官方角色',characterName:'官方角色',librarySource:'official' as const};
  const p={...props(),assets:[main,official]};render(<StudioIpLibrary {...p}/>);
  expect(screen.queryByRole('button',{name:'查看人物 官方角色'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:/官方 IP/}));
  expect(screen.queryByRole('button',{name:'查看人物 小紫'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'查看人物 官方角色'}));
  fireEvent.click(screen.getByRole('button',{name:'添加选中素材到画布'}));
  await waitFor(()=>expect(p.onImport).toHaveBeenCalledWith(official,undefined));
});
