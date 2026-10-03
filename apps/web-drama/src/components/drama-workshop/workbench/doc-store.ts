"use client";

// 工作台文档仓（v0.197 复核）：本标签页里每部短剧只有一份「最新文档」，挂在模块上，不挂在页面实例上。
//
// 之前最新文档放在工作台页面的 state / ref 里，两个问题：
//  1. 回到短剧列表再点进同一部，页面按 useAsync 的缓存初始化 —— 缓存还是**第一次打开时**读到的那份。
//     上一次打开时存下的东西（加的场景、改的剧情、重新生成的角色）在界面上全没了，而下一次保存会把这份旧文档
//     整份写回服务端，服务端上的也就真没了（mock 与真后端一样，缓存在浏览器里）。
//  2. 生成要等几秒。用户点完就离开工作台，结果回来时写进的是**已卸载那个页面**的 ref；如果用户已经重新打开了
//     同一部并改了东西，旧页面按它那份旧 ref 合并、整份保存，把新页面的改动盖掉。
// 现在：所有写入（不管来自哪个页面实例、是不是已经卸载）都合并到这里的同一份文档上，挂着的工作台订阅它。
//
// 服务端读回来的那份什么时候能替换本地：本地还没有 → 直接用；本地有 → 只在「发起读取时没有在途保存、
// 读取期间本地没再写过、读回来时也没有在途保存」时才用（这样能拿到别处的改动，又不会用一份比本地旧的覆盖本地）。
import * as React from "react";
import type { ProjectData } from "@/mocks/drama-workshop";
import { createDocHistory, type DocHistory } from "./stale-save";

interface Slot {
  doc: ProjectData | null;
  history: DocHistory;
  /** 本标签页每写一次文档 +1（服务端读回来替换不算）。 */
  seq: number;
  /** 在途的保存请求数。 */
  inflight: number;
  listeners: Set<() => void>;
}

const slots = new Map<string, Slot>();

function slotOf(id: string): Slot {
  let s = slots.get(id);
  if (!s) {
    s = { doc: null, history: createDocHistory(), seq: 0, inflight: 0, listeners: new Set() };
    slots.set(id, s);
  }
  return s;
}

function emit(s: Slot) {
  for (const l of [...s.listeners]) l();
}

/** 这部短剧在本标签页里的最新文档；还没读过返回 null。 */
export function getWorkbenchDoc(id: string): ProjectData | null {
  return slots.get(id)?.doc ?? null;
}

/** 订阅最新文档（挂着的工作台都会跟着变，包括已卸载页面迟到的写入）。 */
export function useWorkbenchDoc(id: string): ProjectData | null {
  const subscribe = React.useCallback(
    (cb: () => void) => {
      const s = slotOf(id);
      s.listeners.add(cb);
      return () => {
        s.listeners.delete(cb);
      };
    },
    [id],
  );
  return React.useSyncExternalStore(subscribe, () => getWorkbenchDoc(id), () => null);
}

/** 本标签页写一份新文档：先换内存、通知订阅者，保存请求由调用方发（用 trackWorkbenchSave 包住）。 */
export function commitWorkbenchDoc(id: string, next: ProjectData): void {
  const s = slotOf(id);
  if (s.doc) s.history.record(s.doc, next);
  s.doc = next;
  s.seq += 1;
  emit(s);
}

/** 整份保存：旧快照带过来的、调用方没改过的值换回最新值（见 stale-save.ts）。 */
export function rebaseOntoLatest(id: string, next: ProjectData): ProjectData {
  const s = slots.get(id);
  return s?.doc ? s.history.rebase(next, s.doc) : next;
}

/** 包住一次保存请求：在途期间服务端读回来的那份不拿来替换本地。 */
export async function trackWorkbenchSave<T>(id: string, op: () => Promise<T>): Promise<T> {
  const s = slotOf(id);
  s.inflight += 1;
  try {
    return await op();
  } finally {
    s.inflight -= 1;
  }
}

interface FetchStamp {
  seq: number;
  clean: boolean;
}
const stamps = new WeakMap<object, FetchStamp>();

/** 读服务端文档。发起那一刻记下本地状态，读回来时 adoptServerDoc 据此判断能不能替换本地。 */
export async function fetchWorkbenchDoc<T extends object>(id: string, load: () => Promise<T>): Promise<T> {
  const s = slotOf(id);
  const stamp: FetchStamp = { seq: s.seq, clean: s.inflight === 0 };
  const res = await load();
  stamps.set(res, stamp);
  return res;
}

/**
 * 服务端读回来的文档（fetched 是 fetchWorkbenchDoc 返回的那个对象，doc 是其中的文档）。
 * 本地还没有 → 用它；本地有 → 只在读取期间本地干净时用它，否则留本地。
 */
export function adoptServerDoc(id: string, fetched: object, doc: ProjectData): void {
  const s = slotOf(id);
  if (s.doc === doc) return;
  if (s.doc) {
    const stamp = stamps.get(fetched);
    if (!stamp || !stamp.clean || stamp.seq !== s.seq || s.inflight > 0) return;
    s.history.record(s.doc, doc);
  }
  s.doc = doc;
  emit(s);
}

/** 仅测试用：清空所有文档。 */
export function __resetWorkbenchDocs(): void {
  slots.clear();
}
