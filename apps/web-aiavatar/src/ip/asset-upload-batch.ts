import type { IpSavedAsset } from '@ai-star-eco/types';
import { normalizeStudioError } from './studio-errors';

export async function uploadAssetBatch<T>(files: readonly File[], upload: (file: File) => Promise<T>) {
  const uploaded: T[] = [];
  const failed: { name: string; error: ReturnType<typeof normalizeStudioError> }[] = [];
  for (const file of files) {
    try { uploaded.push(await upload(file)); }
    catch (error) { failed.push({ name: file.name, error: normalizeStudioError(error) }); }
  }
  return { uploaded, error: failed.length ? {
    ...failed[0].error,
    reason: failed[0].error.message,
    message: `${uploaded.length ? `已上传 ${uploaded.length} 个文件。` : ''}${failed.length} 个文件上传失败。${failed.map(({ name, error }) => `「${name}」${error.message}`).join('。')}`,
  } : undefined };
}

export function selectUploadedAssets(current: Record<string, IpSavedAsset>, items: IpSavedAsset[], keys: string[], max: number) {
  const byKey = new Map(items.flatMap(item =>
    'storageKey' in item.data && item.data.storageKey && !item.metadata?.unavailable ? [[item.data.storageKey, item] as const] : []));
  const next = { ...current };
  let count = Object.keys(next).length;
  for (const key of keys) {
    const item = byKey.get(key);
    if (!item) continue;
    if (max === 1) return { [item.id]: item };
    if (count >= max) break;
    if (!next[item.id]) { next[item.id] = item; count++; }
  }
  return next;
}
