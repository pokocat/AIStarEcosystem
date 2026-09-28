"use client";

// 跨组件实例的在途锁（v0.197 评审后）。
//
// CreditButton 自带的锁、调用方自己写的 ref 锁、弹窗里的 busy state，都挂在组件实例上。
// 切阶段 / 切集 / 关掉弹窗再打开，React 换上的是一个**新实例**：旧请求还在跑，新实例的锁却从「空闲」开始，
// 用户看不到「生成中」、能再点一次，服务端每次新开一笔计费 —— 扣两份，两份结果还会互相覆盖。
//
// 这里把锁放在模块级（一个页面会话只有一份），按 key 占用：
// - 组件卸载**不**释放，只有那次动作真正结束（成功 / 失败 / 取消确认）才释放；
// - 新挂上的组件用 useActionLock(key) 读到「在途」，照样显示生成中、点了不算；
// - 同一个 key 的动作互斥（如「先写 3 集 / 一次写完 / 补上后面的」三个按钮共用一个 key）。
//
// key 约定：`<动作>:<对象 id>`，如 `outline:<projectId>`、`image-edit:<projectId>:<shotId>`。
// 对象 id 要写全：两个不相干的东西共用一个 key，会互相挡住。
import * as React from "react";

const held = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * 同步占锁。key 空闲 → 占住，返回释放函数（多调几次也只释放一次）；已被占 → 返回 null，调用方应当什么都不做。
 * 同步生效：同一帧里的第二下点击拿到的就是 null。
 */
export function acquireActionLock(key: string): (() => void) | null {
  if (held.has(key)) return null;
  held.add(key);
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held.delete(key);
    emit();
  };
}

/** 这个 key 现在有没有动作在途。 */
export function isActionLocked(key: string): boolean {
  return held.has(key);
}

/**
 * 占住 key 跑 fn，fn（的 Promise）结束后释放；fn 抛错照样往外抛。
 * 返回 false = key 已被占、fn 没跑 —— 调用方要看这个返回值（没跑就别清输入框、别提示成功）。
 */
export async function withActionLock(key: string, fn: () => unknown): Promise<boolean> {
  const release = acquireActionLock(key);
  if (!release) return false;
  try {
    await fn();
    return true;
  } finally {
    release();
  }
}

/** 订阅某个 key 的在途状态；key 为空恒为 false。组件重挂后读到的是真实状态，不是初始值。 */
export function useActionLock(key: string | null | undefined): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => (key ? held.has(key) : false),
    () => false,
  );
}
