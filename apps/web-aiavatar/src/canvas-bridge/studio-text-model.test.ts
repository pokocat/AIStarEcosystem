import { describe, expect, it } from 'vitest';
import type { StudioCapabilities } from '@ai-star-eco/types/ip-studio-workflow';
import { studioChosenTextModel } from './studio-text-model';

const caps = (textModelMode: 'fixed' | 'selectable' | undefined, withPrevious: boolean): StudioCapabilities => ({
  mock: false, operations: ['script'],
  textModelMode,
  textModels: [
    { endpointId: 'default-text', name: '默认剧本模型', isDefault: true },
    ...(withPrevious ? [{ endpointId: 'model', name: '原剧本模型', isDefault: false }] : []),
  ],
} as StudioCapabilities);

describe('studioChosenTextModel', () => {
  // 原 studio-workspace.test.tsx 里 completed-script 那组的 fixed / 已下架两种参数，改到这里测规则本身。
  it.each([
    { policy: 'selectable', available: true, expected: 'model' },
    { policy: undefined, available: true, expected: 'model' },
    { policy: 'fixed', available: true, expected: 'default-text' },
    { policy: 'selectable', available: false, expected: 'default-text' },
  ] as const)('$policy mode with the previous model available=$available picks $expected', ({ policy, available, expected }) => {
    expect(studioChosenTextModel(caps(policy, available), 'model')?.endpointId).toBe(expected);
  });

  it('falls back to the first option without a default, and to nothing without options', () => {
    const noDefault = { mock: false, operations: [], textModels: [{ endpointId: 'x', name: 'X', isDefault: false }, { endpointId: 'y', name: 'Y', isDefault: false }] } as unknown as StudioCapabilities;
    expect(studioChosenTextModel(noDefault, undefined)?.endpointId).toBe('x');
    expect(studioChosenTextModel(noDefault, 'y')?.endpointId).toBe('y');
    expect(studioChosenTextModel(undefined, 'y')).toBeUndefined();
    expect(studioChosenTextModel({ mock: false, operations: [] } as unknown as StudioCapabilities, 'y')).toBeUndefined();
  });
});
