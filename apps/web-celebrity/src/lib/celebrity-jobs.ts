// ─────────────────────────────────────────────────────────────────────────────
// lib/celebrity-jobs.ts — 明星专区生成任务的本地持久化（mock / 离线找回用）。
//   后端真接入后改为基于 AsyncJobStarted.pollUrl 轮询；本文件只承担本地态。
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import type { ID, ISODateTime } from "@ai-star-eco/types/_shared";
import type {
  CelebrityEngine,
  CelebrityProductInput,
  CelebrityVideoDuration,
} from "@ai-star-eco/types/celebrity-zone";

const STORAGE_KEY = "aistareco.web.celebrity.pendingJobs.v1";
const CHANGE_EVENT = "celebrityJobs:changed";

export type PendingJobStatus = "running" | "completed" | "failed";
export type PendingJobSource = "templateConfig" | "blindbox";

export interface PendingJobResult {
  videoUrl: string;
  thumb?: string;
}

export interface PendingJobRecord {
  jobId: ID;
  artistId: ID;
  artistName: string;
  artistAvatar: string;
  projectId: ID;
  projectName?: string;
  source: PendingJobSource;
  templateId?: ID;
  product: CelebrityProductInput;
  engine: CelebrityEngine;
  duration: CelebrityVideoDuration;
  creditPrice: number;
  startedAt: ISODateTime;
  estimatedSeconds: number;
  status: PendingJobStatus;
  result?: PendingJobResult;
}

let memoryStore: PendingJobRecord[] | null = null;

function load(): PendingJobRecord[] {
  if (memoryStore) return memoryStore;
  if (typeof window === "undefined") {
    memoryStore = [];
    return memoryStore;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PendingJobRecord[];
      if (Array.isArray(parsed)) {
        memoryStore = parsed;
        return memoryStore;
      }
    }
  } catch {
    /* parse 失败 → 重置 */
  }
  memoryStore = [];
  return memoryStore;
}

function save() {
  if (typeof window === "undefined" || !memoryStore) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
  } catch {
    /* storage 满，静默失败 */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function nowIso(): ISODateTime {
  return new Date().toISOString();
}

export const CelebrityJobs = {
  list(): PendingJobRecord[] {
    return [...load()];
  },

  listRunning(): PendingJobRecord[] {
    return load().filter((r) => r.status === "running");
  },

  listCompleted(): PendingJobRecord[] {
    return load().filter((r) => r.status === "completed");
  },

  get(jobId: ID): PendingJobRecord | null {
    return load().find((r) => r.jobId === jobId) ?? null;
  },

  /** 找当前明星最近一条 running 任务（用于无 jobId 深链时的恢复）。 */
  findRunningForArtist(artistId: ID): PendingJobRecord | null {
    const list = load()
      .filter((r) => r.artistId === artistId && r.status === "running")
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    return list[0] ?? null;
  },

  enqueue(record: PendingJobRecord): void {
    const store = load();
    const idx = store.findIndex((r) => r.jobId === record.jobId);
    if (idx >= 0) store[idx] = record;
    else store.unshift(record);
    save();
  },

  markCompleted(jobId: ID, result?: PendingJobResult): void {
    const store = load();
    const idx = store.findIndex((r) => r.jobId === jobId);
    if (idx < 0) return;
    store[idx] = { ...store[idx], status: "completed", result };
    save();
  },

  markFailed(jobId: ID): void {
    const store = load();
    const idx = store.findIndex((r) => r.jobId === jobId);
    if (idx < 0) return;
    store[idx] = { ...store[idx], status: "failed" };
    save();
  },

  remove(jobId: ID): void {
    const store = load();
    memoryStore = store.filter((r) => r.jobId !== jobId);
    save();
  },

  /** 清掉所有非 running 的历史记录（completed/failed 已被采纳/丢弃）。 */
  pruneFinished(): void {
    const store = load();
    memoryStore = store.filter((r) => r.status === "running");
    save();
  },

  /** 计算任务进度，基于 startedAt 锚点 + estimatedSeconds。0~1。 */
  computeProgress(record: PendingJobRecord): { elapsedSec: number; percent: number } {
    if (record.status === "completed") return { elapsedSec: record.estimatedSeconds, percent: 100 };
    if (record.status === "failed") return { elapsedSec: 0, percent: 0 };
    const started = Date.parse(record.startedAt);
    if (!Number.isFinite(started)) return { elapsedSec: 0, percent: 0 };
    const elapsedSec = Math.max(0, (Date.now() - started) / 1000);
    const ratio = Math.min(1, elapsedSec / Math.max(1, record.estimatedSeconds));
    return { elapsedSec, percent: Math.round(ratio * 100) };
  },

  subscribe(handler: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const onChange = () => handler();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        memoryStore = null; // 跨标签同步：丢缓存重读
        handler();
      }
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  },

  nowIso,
};
