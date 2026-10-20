// Per-viewer conveniences for the assistant composer: the unsent draft and the chosen reply model of each canvas.
// They live in this browser only (another device starts empty) and are never the record of anything: losing them
// means retyping a message or picking the model again, never a wrong send. A refresh used to drop both — the draft
// lived in a component ref and the model in component state (local e2e 2026-10-19, runbook 2.7).
export type AssistantDraft = { text: string; pinnedIds: string[]; attachmentIds: string[] };

const draftKey = (projectId: string) => `studio-assistant:draft:${projectId}`;
const modelKey = (projectId: string) => `studio-assistant:model:${projectId}`;
const ids = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** The saved draft, with references to nodes no longer on the canvas dropped (they would only block sending). */
export function readAssistantDraft(projectId: string, existingIds?: ReadonlySet<string>): AssistantDraft | undefined {
  let raw: unknown;
  try { const stored = localStorage.getItem(draftKey(projectId)); raw = stored ? JSON.parse(stored) : undefined; }
  catch { return undefined; }
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const keep = (list: string[]) => existingIds ? list.filter(id => existingIds.has(id)) : list;
  const draft = { text: typeof value.text === "string" ? value.text : "", pinnedIds: keep(ids(value.pinnedIds)), attachmentIds: keep(ids(value.attachmentIds)) };
  return draft.text.trim() || draft.pinnedIds.length || draft.attachmentIds.length ? draft : undefined;
}

/** An empty draft removes the entry, so a sent message does not come back after a refresh. */
export function writeAssistantDraft(projectId: string, draft: AssistantDraft) {
  try {
    if (!draft.text.trim() && !draft.pinnedIds.length && !draft.attachmentIds.length) localStorage.removeItem(draftKey(projectId));
    else localStorage.setItem(draftKey(projectId), JSON.stringify(draft));
  } catch { /* not remembered */ }
}

export const clearAssistantDraft = (projectId: string) => writeAssistantDraft(projectId, { text: "", pinnedIds: [], attachmentIds: [] });

export function readAssistantModel(projectId: string): string | undefined {
  try { return localStorage.getItem(modelKey(projectId)) || undefined; } catch { return undefined; }
}

export function writeAssistantModel(projectId: string, endpointId?: string) {
  try { if (endpointId) localStorage.setItem(modelKey(projectId), endpointId); else localStorage.removeItem(modelKey(projectId)); }
  catch { /* not remembered */ }
}
