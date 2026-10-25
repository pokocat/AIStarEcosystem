// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { SettingsPanel } from './director-settings';
const api = vi.hoisted(() => ({ patchWork: vi.fn() }));
vi.mock('../api', () => ({ DirectorApi: api }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const work: any = { id:'model-work', settings:{style:'真人写实',aspectRatio:'9:16',videoModel:null,imageModel:null},
  pricing:{mock:false,image:16}, videoModels:[], imageModels:[{id:'seedream',name:'Seedream 4.5',isDefault:true,creditCost:16},{id:'other',name:'另一模型',isDefault:false,creditCost:37}] };
function choose(value: string) {
  const control = screen.getByRole('combobox', { name:'图片模型' });
  fireEvent.change(document.getElementById(control.getAttribute('data-select-native')!)!, { target:{value} });
}
test('the chosen image model is saved and its own price is shown before saving', async () => {
  const apply=vi.fn(),close=vi.fn();api.patchWork.mockResolvedValue(work);
  render(<SettingsPanel work={work} apply={apply} onClose={close} setError={vi.fn()}/>);
  choose('other');
  expect(screen.getByText(/用于资产参考图和分镜图，约 37 积分\/张。/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(api.patchWork).toHaveBeenCalledWith('model-work',{settings:{style:'真人写实',aspectRatio:'9:16',videoModel:null,imageModel:'other'}}));
  expect(close).toHaveBeenCalledTimes(1);
});
test('an unavailable saved choice is visible and must be replaced explicitly', async () => {
  render(<SettingsPanel work={{...work,settings:{...work.settings,imageModel:'retired'}}} apply={vi.fn()} onClose={vi.fn()} setError={vi.fn()}/>);
  expect(screen.getByText('原图片模型暂不可用，请选择其他模型后保存。')).toBeTruthy();
  expect((screen.getByRole('button',{name:'保存'}) as HTMLButtonElement).disabled).toBe(true);
  choose('');
  expect((screen.getByRole('button',{name:'保存'}) as HTMLButtonElement).disabled).toBe(false);
});
