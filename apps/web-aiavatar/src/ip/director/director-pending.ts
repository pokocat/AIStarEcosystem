// ─────────────────────────────────────────────────────────────────────────────
// 结果不确定的请求按原样恢复（助手消息、创意对话、跳过直接写剧本）。
//
// 发出去之前先把「这一次请求」（编号 + 完整正文）记进本浏览器；收到确定结果才删。
// 断网 / 网关超时这类不确定的结果不删：收起再打开助手、刷新页面、切换范围之后，
// 先回读作品看服务端是否已经收到，没收到就用同一个编号、同一份正文重发——服务端认出是同一条，
// 不会重复建任务、不会重复扣费。业务上明确拒绝（积分不足、价格变了、正文对不上…）才作废这一条。
// ─────────────────────────────────────────────────────────────────────────────

import { ApiError } from "@ai-star-eco/api-client";

export type PendingRequest<B> = { id: string; body: B; at: string };

/** 结果不确定（断网、网关超时）：服务端可能已经收到。确定的业务拒绝不算。 */
export function uncertain(e: unknown) {
  if (!(e instanceof ApiError)) return true;
  return e.code === "HTTP_ERROR" || e.status === 502 || e.status === 504;
}

export class UncertainError extends Error {}

export function readPending<B>(key: string): PendingRequest<B> | null {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as PendingRequest<B> : null; }
  catch { return null; }
}

export function writePending<B>(key: string, p: PendingRequest<B>) {
  try { window.localStorage.setItem(key, JSON.stringify(p)); } catch { /* 存储不可用：本页内仍按内存里的同一份重发 */ }
}

export function clearPending(key: string) {
  try { window.localStorage.removeItem(key); } catch { /* 忽略 */ }
}

/**
 * 发出一次已记下的请求。不确定时先问服务端收到没有（received），没收到就同编号重发一次；
 * 仍不确定抛 UncertainError（记录保留，之后按原样恢复）；明确拒绝抛原错误（记录作废）。
 */
export async function deliver<B, T>(key: string, p: PendingRequest<B>, send: (body: B) => Promise<T>, received: () => Promise<T | null>): Promise<T> {
  const attempt = async (): Promise<T> => {
    try { return await send(p.body); }
    catch (e) {
      if (!uncertain(e)) { clearPending(key); throw e; }
      throw new UncertainError("网络不稳定，发送状态还不确定。");
    }
  };
  try { const r = await attempt(); clearPending(key); return r; }
  catch (e) {
    if (!(e instanceof UncertainError)) throw e;
  }
  const seen = await received().catch(() => null);
  if (seen) { clearPending(key); return seen; }
  await new Promise(r => setTimeout(r, 1200));
  try { const r = await attempt(); clearPending(key); return r; }
  catch (e) {
    if (e instanceof UncertainError) throw new UncertainError("网络不稳定，这条消息的发送状态还不确定。内容已保留，再点发送会按原请求恢复，不会重复扣费。");
    throw e;
  }
}
