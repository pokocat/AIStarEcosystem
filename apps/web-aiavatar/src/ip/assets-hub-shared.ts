// 新版资产页和资产选择框共用的约定（2026-10-31）。

/** 自带的「AI 生成」库：自动收进来的生成结果里，还没放进别的资产库的那些（folder=unfiled + source=generated）。 */
export const AI_LIBRARY = 'ai';

/** 这个库在接口上的筛选参数。 */
export function libraryQuery(library: string): { folder: string; source: string } {
  return library === AI_LIBRARY ? { folder: 'unfiled', source: 'generated' } : { folder: library, source: 'all' };
}

/** 卡片上的来源：服务端存的是「AI 生成」「用户上传」「Canvas」（画布里手动存的）。 */
export function sourceLabel(source?: string) {
  return source === 'AI 生成' ? 'AI 生成' : source === '用户上传' ? '上传' : '画布';
}

/** 选择框记住上次用的资产库（每个浏览器自己记）。 */
const LAST_LIBRARY = 'aiavatar_library_last';
export function lastLibrary(): string {
  try { return window.localStorage.getItem(LAST_LIBRARY) || ''; } catch { return ''; }
}
export function rememberLibrary(id: string) {
  try { window.localStorage.setItem(LAST_LIBRARY, id); } catch { /* 隐私模式存不下就不记 */ }
}

/** 资产页地址（带来源筛选）。新版角色、场景、道具各一个分类；旧版都在「创作素材」。 */
export function assetsHref(kind: 'character' | 'scene' | 'prop', from: string, ui: 'next' | 'classic') {
  const tab = ui === 'next' ? (kind === 'character' ? 'people' : kind) : 'objects';
  return `/assets?tab=${tab}&from=${encodeURIComponent(from)}`;
}

/** 跳回来源：导演台作品或画布。 */
export function originHref(id?: unknown): string | undefined {
  if (typeof id !== 'string') return undefined;
  return id.startsWith('DW-') ? `/director/${id}` : id.startsWith('IPP-') ? `/projects/${id}` : undefined;
}

/** 卡片上的来源标签。 */
export function objectOriginLabel(object: { sources: { origin?: string | null }[] }) {
  const first = object.sources[0];
  if (!first) return undefined;
  return first.origin === 'director' || first.origin === 'director-link' ? '导演台' : first.origin === 'canvas' ? '画布' : '剧本提取';
}

/** 素材上的来源（服务端按当前名字现查后写进 metadata）。 */
export function materialOrigin(metadata?: Record<string, unknown>) {
  const title = metadata?.sourceTitle;
  if (typeof title !== 'string' || !title) return undefined;
  return { title, type: metadata?.sourceType === 'director' ? 'director' as const : 'canvas' as const, deleted: metadata?.sourceDeleted === true, href: metadata?.sourceDeleted === true ? undefined : originHref(metadata?.projectId) };
}
