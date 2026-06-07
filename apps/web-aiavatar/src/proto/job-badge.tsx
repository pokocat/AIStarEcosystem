"use client";
import React from "react";
import { JobApi, USE_MOCK } from "./api";
import * as UI from "./ui";

// ============================================================
// LiveJobBadge — 生成中资产卡的实时进度覆盖层
//   status ∈ {proofing, deriving} 时轮询该资产的 running 任务，
//   把后端真实 pct 叠加在形象图上；任务结束触发 onDone（通常 ctx.reload）。
// ============================================================
const hJB : any = React.createElement;
const { useState: useStateJB, useEffect: useEffectJB, useRef: useRefJB } = React;

const ACTIVE_STATUS = ["proofing", "deriving"];

export function isGenerating(char: any): boolean {
  return !!char && ACTIVE_STATUS.includes(char.status) && !String(char.id || "").startsWith("PA-");
}

export function LiveJobBadge({ char, onDone, compact }: any) {
  const [pct, setPct] = useStateJB(null as any);
  const [eta, setEta] = useStateJB("");
  const doneRef = useRefJB(false);
  const seenRef = useRefJB(false);

  useEffectJB(() => {
    if (!isGenerating(char)) return;
    let live = true;
    doneRef.current = false;
    const tick = async () => {
      try {
        const jobs = await JobApi.list({ avatarId: char.id, status: "running" });
        if (!live) return;
        const running = (jobs || []).find((j: any) => j.char === char.id && j.status === "running");
        if (running) {
          seenRef.current = true;
          setPct(Math.max(2, Math.round(running.pct || 0)));
          setEta(running.eta || "");
        } else if (seenRef.current && !doneRef.current) {
          // 见过 running → 现在没了 = 任务结束（成功或失败都刷新资产态）
          doneRef.current = true;
          setPct(100);
          onDone && onDone();
        }
      } catch { /* 静默，下轮重试 */ }
    };
    tick();
    const iv = setInterval(tick, USE_MOCK ? 1200 : 2500);
    return () => { live = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char && char.id, char && char.status]);

  if (!isGenerating(char)) return null;

  return hJB('div', { style: { position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: compact ? 6 : 9, padding: '0 12px',
      background: 'rgba(247,250,252,.55)', backdropFilter: 'blur(3px)' } },
    hJB('div', { style: { position: 'relative', width: compact ? 34 : 44, height: compact ? 34 : 44, display: 'grid', placeItems: 'center' } },
      hJB('div', { style: { position: 'absolute', inset: 0, borderRadius: 99, border: '3px solid var(--primary-soft)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' } }),
      hJB('span', { className: 'mono', style: { fontSize: compact ? 9.5 : 11, fontWeight: 800, color: 'var(--primary)' } },
        pct == null ? '…' : pct + '%')),
    !compact && hJB('div', { style: { width: '100%', maxWidth: 120 } }, hJB(UI.Progress, { pct: pct == null ? 4 : pct, h: 4 })),
    hJB('span', { className: 'm-clip1', style: { fontSize: compact ? 9.5 : 10.5, fontWeight: 700, color: 'var(--ink-2)', textAlign: 'center' } },
      pct === 100 ? '即将完成…' : (eta || '生成中…')));
}
