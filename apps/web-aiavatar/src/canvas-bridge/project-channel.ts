"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 同一个浏览器里的多个标签页 / 窗口之间：「我刚把哪张画布存到了哪一版」。
//
// 为什么要有这一层：画布是整存整取的，两个标签页各开一份、各改各的，后保存的那边
// 必然撞 409（服务端的乐观并发闸，见 IpProjectService.requireNotStale）。撞上之前
// 那边其实有机会知道「别处已经存了新的一版」——
//   · 没改过东西的那边，直接悄悄换成最新内容，用户根本不用管；
//   · 已经改了东西的那边，立刻告诉他、给他选，而不是等防抖到点白发一次 PUT 再说。
// 跨设备没有这条通道，那时候只能靠 409，处理方式一样（见 project-sync.ts）。
//
// 没有 BroadcastChannel 的环境（老浏览器 / node 测试）就什么都不发、什么都收不到，
// 行为退回只靠 409。
// ─────────────────────────────────────────────────────────────────────────────

export type RemoteSave = { projectId: string; docVersion: string; tabId: string };

const CHANNEL_NAME = "ipstudio-project-sync";

const TAB_ID = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

/** 这个标签页的身份 —— 自己发的消息自己不处理。 */
export const currentTabId = () => TAB_ID;

type Listener = (save: RemoteSave) => void;
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null | undefined;

function open(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  if (typeof BroadcastChannel === "undefined") return (channel = null);
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => receiveRemoteSave(event.data);
  } catch {
    channel = null;
  }
  return channel;
}

/** 这个标签页刚把一张画布存成功了：告诉其它标签页。 */
export function announceSave(projectId: string, docVersion: string) {
  const save: RemoteSave = { projectId, docVersion, tabId: TAB_ID };
  try { open()?.postMessage(save); } catch { /* 通道坏了就退回只靠 409 */ }
}

/**
 * 收到别的标签页的一次保存。
 *
 * 导出是为了测试能模拟「另一个标签页存了一版」；自己发的（tabId 相同）一律忽略。
 */
export function receiveRemoteSave(data: unknown) {
  if (!data || typeof data !== "object") return;
  const save = data as Partial<RemoteSave>;
  if (typeof save.projectId !== "string" || typeof save.docVersion !== "string" || save.tabId === TAB_ID) return;
  for (const listener of listeners) listener(save as RemoteSave);
}

export function onRemoteSave(listener: Listener): () => void {
  open();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
