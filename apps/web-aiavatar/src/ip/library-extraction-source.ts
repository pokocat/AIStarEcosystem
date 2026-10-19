import type { IpRun } from '@ai-star-eco/types';

/** Recover the fingerprint from the immutable input, never from today's document. */
export async function extractionSourceHash(run: IpRun, fallback: string, episodeNo?: number): Promise<string> {
  // A scoped run only stores its episode; its hash cannot replace the full-document guard.
  if (episodeNo !== undefined) return fallback;
  const inputs = run.inputs as IpRun['inputs'] & { scriptEdit?: { markdown: string } };
  const source = (inputs?.studioRequest ?? inputs)?.scriptEdit?.markdown;
  if (typeof source !== 'string') return fallback;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
