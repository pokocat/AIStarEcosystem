// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { SettingsPanel } from './director-settings';
const api = vi.hoisted(() => ({ patchWork: vi.fn() }));
vi.mock('../api', () => ({ DirectorApi: api }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const work: any = {assets:[],clips:[], id:'model-work', settings:{style:'真人写实',aspectRatio:'9:16',videoModel:null,imageModel:null},
  pricing:{mock:false,image:16}, videoModels:[], imageModels:[{id:'seedream',name:'Seedream 4.5',isDefault:true,creditCost:16},{id:'other',name:'另一模型',isDefault:false,creditCost:37}] };

test('a recommended video model is selected and only applied after saving', async () => {
  const next = { ...work, videoModels: [
    { id: 'h3', name: 'MiniMax H3', isDefault: true, minSec: 5, maxSec: 15, mode: 'omni', maxRefImages: 9 },
    { id: 'seedance25', name: 'Seedance 2.5', isDefault: false, minSec: 4, maxSec: 15, mode: 'omni', maxRefImages: 30 },
  ] };
  api.patchWork.mockResolvedValue(next);
  render(<SettingsPanel work={next} suggestedVideoModel="seedance25" apply={vi.fn()} onClose={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByRole('combobox', { name: '视频模型' }).textContent).toContain('Seedance 2.5');
  expect(screen.getByText(/最多 30 张参考图，含分镜图/)).toBeTruthy();
  expect(api.patchWork).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(api.patchWork).toHaveBeenCalledWith('model-work', {
    settings: { style: '真人写实', aspectRatio: '9:16', videoModel: 'seedance25' },
  }));
});

function choose(value: string) {
  const control = screen.getByRole('combobox', { name:'图片模型' });
  fireEvent.change(document.getElementById(control.getAttribute('data-select-native')!)!, { target:{value} });
}
test('the chosen image model is saved and its own price is shown before saving', async () => {
  const apply=vi.fn(),close=vi.fn();api.patchWork.mockResolvedValue(work);
  render(<SettingsPanel work={work} apply={apply} onClose={close} setError={vi.fn()}/>);
  choose('other');
  expect(screen.getByText(/资产图约 37 积分\/张；分镜图按作品画幅选择规格/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(api.patchWork).toHaveBeenCalledWith('model-work',{settings:{style:'真人写实',aspectRatio:'9:16',videoModel:null,imageModel:'other'}}));
  expect(close).toHaveBeenCalledTimes(1);
});
test('default GPT asset pricing stays separate from the supported vertical board specification', () => {
  const w = { ...work, imageModels: [], pricing: { mock:false, image:16, boardImage:55 },
    imageModelState: { id:'gpt-low', name:'GPT Image 2', explicit:false, available:true, creditCost:16, missingRatios:['9:16'] },
    boardImage: { endpointId:'gpt-high', name:'GPT Image 2 4K', size:'2160x3840', creditCost:55 } };
  render(<SettingsPanel work={w} apply={vi.fn()} onClose={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByRole('combobox',{name:'图片模型'}).textContent).toContain('默认（GPT Image 2）');
  expect(screen.getByText(/分镜图：GPT Image 2 4K · 2160×3840 · 约 55 积分/)).toBeTruthy();
  expect(screen.getByText('资产图约 16 积分/张。')).toBeTruthy();
  expect(screen.queryByText(/无法生成.*分镜/)).toBeNull();
});

test('a retired saved choice stays visible, other settings still save, and the retired value is not resubmitted', async () => {
  const apply=vi.fn(),close=vi.fn();api.patchWork.mockResolvedValue(work);
  const retired={...work,settings:{...work.settings,imageModel:'retired'},
    imageModelState:{id:'retired',name:null,explicit:true,available:false,creditCost:null,missingRatios:[]}};
  render(<SettingsPanel work={retired} apply={apply} onClose={close} setError={vi.fn()}/>);
  expect(screen.getByText(/原图片模型已停用，暂时无法生成资产图和分镜图/)).toBeTruthy();
  const save=screen.getByRole('button',{name:'保存'}) as HTMLButtonElement;
  expect(save.disabled).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:/真人写实/}));
  fireEvent.change(screen.getByLabelText('自定义风格'),{target:{value:'国风水墨'}});
  fireEvent.click(save);
  await waitFor(()=>expect(api.patchWork).toHaveBeenCalledWith('model-work',{settings:{style:'国风水墨',aspectRatio:'9:16',videoModel:null}}));
  expect(close).toHaveBeenCalledTimes(1);
});
test('replacing a retired saved choice sends the new model explicitly', async () => {
  api.patchWork.mockResolvedValue(work);
  render(<SettingsPanel work={{...work,settings:{...work.settings,imageModel:'retired'}}} apply={vi.fn()} onClose={vi.fn()} setError={vi.fn()}/>);
  choose('');
  fireEvent.click(screen.getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(api.patchWork).toHaveBeenCalledWith('model-work',{settings:{style:'真人写实',aspectRatio:'9:16',videoModel:null,imageModel:null}}));
});
test('a saved model that cannot make square images names the asset class it blocks and keeps its own price', async () => {
  const apply=vi.fn(),close=vi.fn();api.patchWork.mockResolvedValue(work);
  const limited={...work,settings:{...work.settings,imageModel:'gpt-4k'},pricing:{mock:false,image:55},
    imageModelState:{id:'gpt-4k',name:'GPT Image 2 4K',explicit:true,available:true,creditCost:55,missingRatios:['1:1']}};
  render(<SettingsPanel work={limited} apply={apply} onClose={close} setError={vi.fn()}/>);
  expect(screen.getByRole('combobox',{name:'图片模型'}).textContent).toContain('GPT Image 2 4K（原选择）');
  const note=screen.getByText(/原图片模型「GPT Image 2 4K」不支持方图，无法生成道具的图片；其他画面不受影响，约 55 积分\/张。/);
  expect(note.textContent).not.toMatch(/画幅/);
  fireEvent.click(screen.getByRole('button',{name:'1:1'}));
  expect(screen.getByText(/无法生成道具、分镜的图片/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'16:9'}));
  fireEvent.click(screen.getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(api.patchWork).toHaveBeenCalledWith('model-work',{settings:{style:'真人写实',aspectRatio:'16:9',videoModel:null}}));
});
test('a default model that cannot make square images is explained instead of reporting no model at all', () => {
  const limitedDefault={...work,imageModels:[{id:'other',name:'另一模型',isDefault:false,creditCost:37}],
    imageModelState:{id:'gpt-4k',name:'GPT Image 2 4K',explicit:false,available:true,creditCost:55,missingRatios:['1:1']}};
  render(<SettingsPanel work={limitedDefault} apply={vi.fn()} onClose={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText(/默认图片模型「GPT Image 2 4K」不支持方图，无法生成道具的图片/)).toBeTruthy();
  expect(screen.queryByText('暂无可用图片模型，请联系管理员开通。')).toBeNull();
  choose('other');
  expect(screen.getByText(/资产图约 37 积分\/张；分镜图按作品画幅选择规格/)).toBeTruthy();
});
const textWork: any = { ...work, textModelMode: 'selectable', textModels: [
  { endpointId:'ds', name:'DeepSeek', isDefault:true, tokenPricing:{ inputCreditsPerK:0.01, outputCreditsPerK:0.1, maxInputTokens:65536, maxOutputTokens:8192, maxCost:2 } },
  { endpointId:'claude', name:'Claude', isDefault:false, tokenPricing:{ inputCreditsPerK:1, outputCreditsPerK:10, maxInputTokens:65536, maxOutputTokens:8192, maxCost:148 } }] };
function chooseText(value: string) {
  const control = screen.getByRole('combobox', { name:'文本模型' });
  fireEvent.change(document.getElementById(control.getAttribute('data-select-native')!)!, { target:{value} });
}
test('the chosen text model is saved without showing any text credit number', async () => {
  const close=vi.fn();api.patchWork.mockResolvedValue(textWork);
  render(<SettingsPanel work={textWork} apply={vi.fn()} onClose={close} setError={vi.fn()}/>);
  chooseText('claude');
  expect(screen.getByText('用于剧本、拆分集、提取资产和分镜脚本，按实际用量结算。')).toBeTruthy();
  expect(screen.getByRole('dialog').textContent).not.toMatch(/Token|148|冻结/);
  fireEvent.click(screen.getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(api.patchWork).toHaveBeenCalledWith('model-work',{settings:{style:'真人写实',aspectRatio:'9:16',videoModel:null,textModel:'claude'}}));
  expect(close).toHaveBeenCalledTimes(1);
});
test('a retired saved text model is not resubmitted when other settings change', async () => {
  api.patchWork.mockResolvedValue(textWork);
  render(<SettingsPanel work={{...textWork,settings:{...textWork.settings,textModel:'retired'}}} apply={vi.fn()} onClose={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText(/原文本模型已不可用/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'16:9'}));
  fireEvent.click(screen.getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(api.patchWork).toHaveBeenCalledWith('model-work',{settings:{style:'真人写实',aspectRatio:'16:9',videoModel:null}}));
});
test('fixed text model policy disables the selector', () => {
  render(<SettingsPanel work={{...textWork,textModelMode:'fixed'}} apply={vi.fn()} onClose={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByRole('combobox',{name:'文本模型'}).getAttribute('aria-disabled') ?? (document.getElementById(screen.getByRole('combobox',{name:'文本模型'}).getAttribute('data-select-native')!) as HTMLSelectElement).disabled.toString()).toMatch(/true/);
});
