"use client";

import type { DirectorWork } from "@ai-star-eco/types";
import { ApiError } from "@ai-star-eco/api-client";
import { DirectorApi } from "../api";
import { errorText, peekDraft, saveDrafts } from "./director-shared";

type Apply = (work: DirectorWork) => void;

/** Every generation entry saves the editor drafts first. Only acknowledged values are cleared. */
async function persistDirectorDrafts(work: DirectorWork, apply: Apply): Promise<DirectorWork> {
  let current = work;
  const persist = async (prefix: string, fields: Record<string, string>, write: (data: Record<string, unknown>) => Promise<DirectorWork>) => {
    const saved: Record<string, unknown> = {}, data: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
      const value = peekDraft(prefix + key);
      if (value !== undefined) { saved[prefix + key] = value; data[field] = value; }
    }
    if (!Object.keys(saved).length) return false;
    if (data.shots) {
      const shots = data.shots as Array<Record<string, unknown> & { durationText: string }>;
      if (shots.some(s => !Number.isFinite(Number(s.durationText)) || !(Number(s.durationText) > 0)))
        throw new Error("镜头时长须大于 0 秒，请修改后生成");
      data.shots = shots.map(({ durationText, ...shot }) => ({ ...shot, durationSec: Number(durationText) }));
    }
    current = await saveDrafts(saved, () => write(data));
    apply(current);
    return true;
  };
  // A user can keep typing while a save is in flight. Finish saving those edits before dispatching.
  let changed: boolean;
  do {
    changed = false;
    changed = await persist(`${current.id}:`, { draft: "draft" }, data => DirectorApi.patchWork(current.id, { ...data, draftRev: current.draftRev })) || changed;
    changed = await persist(`${current.id}:`, { reference: "text" }, data => DirectorApi.edit(current.id, "reference.update", null, current.referenceRev, data)) || changed;
    for (const ep of current.episodes ?? []) {
      changed = await persist(`${current.id}:ep:${ep.id}:`, { title: "title", summary: "summary", content: "content" }, data =>
        DirectorApi.edit(current.id, "episode.update", ep.id, current.episodes.find(e => e.id === ep.id)!.rev, data)) || changed;
    }
    for (const asset of current.assets ?? []) {
      changed = await persist(`${current.id}:asset:${asset.id}:`, { name: "name", description: "description", prompt: "prompt", episodeIds: "episodeIds" }, data =>
        DirectorApi.edit(current.id, "asset.update", asset.id, current.assets.find(a => a.id === asset.id)!.rev, data)) || changed;
      for (const form of asset.forms ?? []) {
        changed = await persist(`${current.id}:form:${form.id}:`, { name: "name", description: "description" }, data =>
          DirectorApi.edit(current.id, "form.update", form.id, null, data)) || changed;
      }
    }
    for (const clip of current.clips ?? []) {
      changed = await persist(`${current.id}:clip:${clip.id}:`, {
        "edit:title": "title", "edit:summary": "summary", "edit:assets": "assetIds", "edit:shots": "shots",
        "prompt:board": "boardPrompt", "prompt:video": "videoPrompt",
      }, data => DirectorApi.edit(current.id, "clip.update", clip.id, current.clips.find(c => c.id === clip.id)!.rev, data)) || changed;
    }
  } while (changed);
  return current;
}

// Serialize saves and dispatches per work, including separate buttons and batch entry points.
const pending = new Map<string, Promise<DirectorWork>>();
export async function withSavedDirectorDrafts(work: DirectorWork, apply: Apply, action: (saved: DirectorWork) => Promise<DirectorWork>): Promise<DirectorWork> {
  const before = pending.get(work.id);
  const job = (async () => {
    const previous = await before?.catch(() => undefined);
    const latest = previous && previous.revision >= work.revision ? previous : work;
    let saved: DirectorWork;
    try { saved = await persistDirectorDrafts(latest, apply); }
    catch (error) {
      // No generation was dispatched: pending-request recovery must not mistake a failed save
      // for an accepted paid request, or retry generation using an unacknowledged editor state.
      throw new ApiError({ code: "DIRECTOR_DRAFT_SAVE_FAILED", message: `修改保存失败，未开始生成。${errorText(error)}` }, 409);
    }
    return action(saved);
  })();
  pending.set(work.id, job);
  try { return await job; }
  finally { if (pending.get(work.id) === job) pending.delete(work.id); }
}

export function runDirectorTask(work: DirectorWork, apply: Apply, body: Parameters<typeof DirectorApi.runTask>[1]) {
  return withSavedDirectorDrafts(work, apply, saved => DirectorApi.runTask(saved.id, body));
}

export function saveDirectorDrafts(work: DirectorWork, apply: Apply) {
  return withSavedDirectorDrafts(work, apply, async saved => saved);
}
