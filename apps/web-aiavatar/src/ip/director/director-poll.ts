import { useEffect, useRef } from "react";

export const DIRECTOR_POLL_MS = 2500;

/**
 * 有任务在跑时轮询作品：上一次读取返回之后才排下一次，页面隐藏时不读，回到页面立刻读一次。
 * 有读取在途（本轮询发的，或 busy() 说页面别处正在读）就跳过这一次，不叠请求。
 *
 * 以前是 setInterval 每 2.5 秒直接发：服务端慢的时候请求一个接一个叠上去，
 * 2026-11-10 线上一个账号 10 秒内对同一部作品发了 125 个读取，连接池被占满，全站接口跟着 500。
 */
export function useDirectorPoll(active: boolean, poll: () => Promise<unknown>, busy: () => boolean = () => false, intervalMs = DIRECTOR_POLL_MS) {
  const pollRef = useRef(poll);
  const busyRef = useRef(busy);
  useEffect(() => { pollRef.current = poll; busyRef.current = busy; });

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let running = false;
    let timer: number | undefined;
    const schedule = () => {
      if (stopped) return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => { timer = undefined; void tick(); }, intervalMs);
    };
    const tick = async () => {
      if (stopped || running) return;
      if (document.visibilityState === "visible" && !busyRef.current()) {
        running = true;
        try { await pollRef.current(); } catch { /* 读取自己处理报错 */ } finally { running = false; }
      }
      schedule();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible" || running) return;
      if (timer !== undefined) { window.clearTimeout(timer); timer = undefined; }
      void tick();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, intervalMs]);
}
