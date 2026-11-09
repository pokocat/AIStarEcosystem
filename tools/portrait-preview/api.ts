/** Isolated preview data. No network requests, credentials, wallet operations or real verification. */
import type { VideoPortraitOverview, VideoPortraitItem, VideoPortraitPerson } from '../../packages/types/src/video-portrait-library';
export const overview: VideoPortraitOverview = {
  libraries: [{ id: 'ark-demo', name: '官方人像' }],
  items: [
    { id: 'portrait-one', libraryId: 'ark-demo', key: 'demo-one', mediaType: 'image', label: '林晚 · 正面照', previewUrl: 'PORTRAIT_ONE_DATA', status: 'needs_review', updatedAt: '2026-11-09T03:20:00Z' },
    { id: 'portrait-two', libraryId: 'ark-demo', key: 'demo-two', mediaType: 'image', label: 'Annie · 棚拍', previewUrl: 'PORTRAIT_TWO_DATA', status: 'processing', placement: 'virtual', updatedAt: '2026-11-09T03:16:00Z' },
    { id: 'portrait-three', libraryId: 'ark-demo', key: 'demo-three', mediaType: 'image', label: '陈泽 · 近景', previewUrl: 'PORTRAIT_THREE_DATA', status: 'active', placement: 'person', personId: 'person-one', updatedAt: '2026-11-09T02:48:00Z' },
  ],
  persons: [{ id: 'person-one', libraryId: 'ark-demo', name: '陈泽', status: 'active', createdAt: '2026-11-09T02:42:00Z', expiresAt: '2026-11-09T04:00:00Z' }],
  agreement: { version: 'preview', text: '所选素材将提交火山引擎方舟，用于本人核验、人脸比对、素材审核和存储，仅供本人主动发起的视频创作使用。可在本人核验页撤销授权，撤销后停止新增使用并删除官方人像素材。', virtualDeclaration: '本人确认拥有素材使用权限，该形象为 AI 生成，且不与任何真人肖像雷同。' },
};
export const portraitOverview = async () => ({ ...overview, items: overview.items.map(item => ({ ...item })), persons: overview.persons.map(person => ({ ...person })) });
export const portraitReview = async (id: string) => ({ jobId: id, items: [overview.items[0]], awaiting: true, canContinue: overview.items[0].status === 'active' });
export const declarePortrait = async (id: string, input: { kind: 'person' | 'virtual'; personId?: string }) => {
  const item = overview.items.find(item => item.id === id)!; item.status = 'processing'; item.placement = input.kind; item.personId = input.personId; return { ...item };
};
export const refreshPortrait = async (id: string) => { const item = overview.items.find(item => item.id === id)!; item.status = 'active'; return { ...item }; };
export const resumePortraitReview = async () => ({ awaiting: false });
export const startPortraitPerson = async (input: { name: string }): Promise<VideoPortraitPerson> => {
  const person: VideoPortraitPerson = { id: `person-${overview.persons.length + 1}`, libraryId: 'ark-demo', name: input.name, status: 'verifying', verificationUrl: 'about:blank#design-preview-only', createdAt: '2026-11-09T03:30:00Z', expiresAt: '2026-11-09T04:00:00Z' }; overview.persons.push(person); return { ...person };
};
export const refreshPortraitPerson = async (id: string) => { const person = overview.persons.find(person => person.id === id)!; person.status = 'active'; person.verificationUrl = undefined; return { ...person }; };
export const revokePortraitPerson = async (id: string) => { const person = overview.persons.find(person => person.id === id)!; person.status = 'revoked'; overview.items.filter(item => item.personId === id).forEach(item => { item.status = 'revoked'; }); };
export const registerPortrait = async (): Promise<VideoPortraitItem> => overview.items[0];
export const checkPortraitInputs = async () => ({ libraryId: 'ark-demo', items: [overview.items[0]], candidateKeys: [] });
