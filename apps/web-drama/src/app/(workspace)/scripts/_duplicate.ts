// 脚本编辑器「复制成新脚本」的一道闸（v0.197 第三轮）。
//
// 此前直接 cloneScript(id)：副本读的是服务端存的旧正文，编辑器里没保存的改动既没进副本、
// 也随着跳转丢了。现在规则收在这一处（§8.0.1 ④ / ⑨）：
//   1. 有没保存的改动 → 先保存；保存没成功（save 返回 false）就停，不复制、不跳走；
//   2. 副本用的正文是调用这一刻编辑器里的那份（显式传给 clone），不再回头读服务端；
//   3. 同一时刻只跑一份（lock）。第三轮评审复核：保存成功后页面刷新会把确认弹窗卸掉再挂回来，
//      弹窗自己的 busy 跟着清零，按钮又能点，于是复制出两份「（副本）」。React state 不是同步锁，
//      所以锁用调用方传进来的 ref：拿不到锁直接返回 busy，不保存也不复制；
//      副本建好、调用方要跳走时锁不放 —— 跳转完成前再点也不会多出一份；
//   4. 复制期间编辑器里的正文又变了（editedSince）→ 调用方不能直接跳走，
//      否则后来改的那部分既不在原稿也不在副本里。
import type { Script } from "@ai-star-eco/types/script";

export type DuplicateOutcome =
  /** editedSince：复制期间编辑器正文又变了；调用方不许直接跳走。 */
  | { kind: "copied"; copy: Script; editedSince: boolean }
  | { kind: "save-failed" }
  | { kind: "copy-failed"; error: unknown }
  /** 上一次复制还没结束（或已经在跳往副本）：这一次什么都没做。 */
  | { kind: "busy" };

export async function saveThenDuplicate(opts: {
  /** 同一个编辑器共用的一把锁（传 useRef）。 */
  lock: { current: boolean };
  /** 编辑器里有没保存的改动。 */
  dirty: boolean;
  /** 用户眼前的正文。 */
  content: string;
  /** 复制结束时编辑器里的正文（用来判断复制期间有没有再改）。 */
  currentContent: () => string;
  /** 保存当前正文；失败时返回 false（由它自己提示用户），不抛。 */
  save: () => Promise<boolean>;
  /** 用给定正文复制一份新脚本。 */
  clone: (content: string) => Promise<Script>;
}): Promise<DuplicateOutcome> {
  if (opts.lock.current) return { kind: "busy" };
  opts.lock.current = true;
  let keepLocked = false;
  try {
    const text = opts.content; // 先定下来：保存期间编辑器再变，副本也只认点下去那一刻的正文
    if (opts.dirty) {
      const ok = await opts.save();
      if (!ok) return { kind: "save-failed" };
    }
    let copy: Script;
    try {
      copy = await opts.clone(text);
    } catch (error) {
      return { kind: "copy-failed", error };
    }
    const editedSince = opts.currentContent() !== text;
    // 没再改过 → 调用方会跳到副本：锁留着，跳走之前的任何一次点击都拿不到锁
    keepLocked = !editedSince;
    return { kind: "copied", copy, editedSince };
  } finally {
    if (!keepLocked) opts.lock.current = false;
  }
}
