'use client';
// 「AI 判断」 on a check node: the native check run's verdict, item by item, with the
// evidence the server sampled from the real media. Choosing 「就用这版」 records the user's
// own decision and never turns a 没通过 / 无法判断 into 通过; 「重做这一段」 opens the
// ordinary regenerate composer for the inspected segment, priced and confirmed as usual.
import { CheckCircle2, CircleHelp, ShieldAlert, XCircle } from 'lucide-react';
import type { StudioCheckVerdict as Verdict } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { dispatchStudioCheckCommand } from '@/canvas-bridge/studio-plan-execution';

const LABEL: Record<Verdict, string> = { pass: '通过', fail: '没通过', unknown: '无法判断' };
const ICON = { pass: CheckCircle2, fail: XCircle, unknown: CircleHelp } as const;
const seconds = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)} 秒`;

export function StudioCheckVerdict({ node, readOnly = false }: { node: CanvasNodeData; readOnly?: boolean }) {
  const check = node.metadata?.studio?.check;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  if (!check) return <div className="studio-check-verdict" aria-label="AI 判断"><header><ShieldAlert size={18} aria-hidden="true"/><strong>AI 判断</strong></header><p role="status">正在检查，结果出来后显示在这里。</p></div>;
  const Overall = ICON[check.status];
  return <div className="studio-check-verdict" data-status={check.status} aria-label="AI 判断">
    <header><Overall size={18} aria-hidden="true"/><strong>AI 判断</strong><span>{LABEL[check.status]}</span></header>
    {!!check.sampledTimesSec?.length && <p className="studio-check-sampled">看了 {check.sampledTimesSec.map(seconds).join('、')} 的画面</p>}
    <ul>{check.items.map(item => {
      const Icon = ICON[item.status];
      return <li key={item.id} data-status={item.status}>
        <p><Icon size={14} aria-hidden="true"/><b>{LABEL[item.status]}</b><span>{item.reason}</span></p>
        {!!item.evidence.length && <ul className="studio-check-evidence">{item.evidence.map((e, i) => <li key={i}>{e.timeSec !== undefined ? `${seconds(e.timeSec)}：` : ''}{e.observation}</li>)}</ul>}
        {item.suggestion && <small>建议：{item.suggestion}</small>}
      </li>;
    })}</ul>
    {!readOnly && <div className="studio-node-actions">
      <button type="button" onMouseDown={stop} onPointerDown={stop} title="采用这一版" onClick={() => dispatchStudioCheckCommand({ action: 'accept', nodeId: node.id })}>就用这版</button>
      <button type="button" onMouseDown={stop} onPointerDown={stop} title="打开这一段的生成设置" onClick={() => dispatchStudioCheckCommand({ action: 'redo', nodeId: node.id })}>重做这一段</button>
    </div>}
  </div>;
}
