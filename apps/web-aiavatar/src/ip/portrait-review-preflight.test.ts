import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ check: vi.fn(), register: vi.fn(), face: vi.fn(), ask: vi.fn() }));
vi.mock('./api/_client', () => ({ USE_MOCK: false }));
vi.mock('./api/video-portrait-library', () => ({ checkPortraitInputs: mocks.check, registerPortrait: mocks.register }));
vi.mock('./portrait-face-hint', () => ({ referenceMayContainFace: mocks.face }));
vi.mock('./portrait-review-events', async importActual => ({ ...await importActual<object>(), requestPortraitReview: mocks.ask }));
import { ensurePortraitInputs, ensureStudioVideoPortraits } from './portrait-review-preflight';

beforeEach(() => { vi.clearAllMocks(); mocks.ask.mockResolvedValue(true); mocks.face.mockResolvedValue(false); });
it('reuses approved assets without loading the face model or opening consent', async () => {
  mocks.check.mockResolvedValue({ libraryId: 'ark', items: [], candidateKeys: [] });
  await ensurePortraitInputs('fast', ['photo', 'photo']);expect(mocks.check).toHaveBeenCalledWith('fast', ['photo']);expect(mocks.face).not.toHaveBeenCalled();expect(mocks.ask).not.toHaveBeenCalled();
});
it('prepares a new detected portrait before allowing the original operation to continue', async () => {
  mocks.check.mockResolvedValue({ libraryId: 'ark', items: [], candidateKeys: ['photo'] });mocks.face.mockResolvedValue(true);mocks.register.mockResolvedValue({ id: 'portrait' });
  let release: (ready: boolean) => void = () => {}; mocks.ask.mockImplementation(() => new Promise<boolean>(resolve => { release = resolve; }));
  let submitted = false;const operation = ensurePortraitInputs('fast', ['photo']).then(() => { submitted = true; });
  await vi.waitFor(() => expect(mocks.ask).toHaveBeenCalled());expect(submitted).toBe(false);expect(mocks.register).toHaveBeenCalledWith({ libraryId: 'ark', key: 'photo', mediaType: 'image', label: '参考图 1' });
  release(true);await operation;expect(submitted).toBe(true);
});
it('deferring preserves the operation as an explicit pause', async () => {
  mocks.check.mockResolvedValue({ libraryId: 'ark', items: [{ id: 'portrait' }], candidateKeys: [] });mocks.ask.mockResolvedValue(false);
  await expect(ensurePortraitInputs('fast', ['photo'])).rejects.toMatchObject({ code: 'STUDIO_PORTRAIT_REVIEW_DEFERRED' });
});
it('does not route other channels or nonvideo operations through portrait handling', async () => {
  mocks.check.mockResolvedValue({ items: [], candidateKeys: [] });await ensurePortraitInputs('other', ['photo']);expect(mocks.face).not.toHaveBeenCalled();
  mocks.check.mockClear();await ensureStudioVideoPortraits({ operation: 'image', model: 'image', references: [{ storageKey: 'photo', role: 'frame' }] });expect(mocks.check).not.toHaveBeenCalled();
});
