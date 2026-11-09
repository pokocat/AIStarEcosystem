/** Local face-presence hint only. It neither identifies a person nor asserts AI/real provenance. Ark remains authoritative. */
const hints = new Map<string, Promise<boolean>>();
export function referenceMayContainFace(key: string): Promise<boolean> {
  const existing = hints.get(key); if (existing) return existing;
  const result = inspect(key);
  hints.set(key, result); if (hints.size > 100) hints.delete(hints.keys().next().value!);
  return result;
}
async function inspect(key: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  let url: string | undefined;
  try {
    // Reuse the hosted MediaPipe assets and existing authenticated asset-content endpoint.
    const [{ fetchAssetBlob }, { detectLandmarks }] = await Promise.all([import('./api/ip-studio'), import('@/proto/beauty/landmarks')]);
    const blob = await fetchAssetBlob(key); if (!blob.type.startsWith('image/')) return false;
    url = URL.createObjectURL(blob);
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = url!; });
    const landmarks = await detectLandmarks(image);
    return !!landmarks?.length;
  } catch {
    // Failure is not proof of "no face": submission retains the official rejection-and-review fallback.
    return false;
  } finally { if (url) URL.revokeObjectURL(url); }
}
