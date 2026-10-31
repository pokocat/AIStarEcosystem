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
