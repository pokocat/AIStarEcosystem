'use client';
// 「整理成技能草稿」 under an execution's completion summary (operators only). One paid text run reads
// the finished execution and saves a draft version of its skill; nothing changes for anyone until an admin
// reviews and publishes the draft in the back office. The operator confirms first (billed by real usage), and the request key is
// kept (also across a reload on this browser), so a lost response or a second click never makes two drafts.
import { useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { nanoid } from 'nanoid';
import { ApiError, formatCredits } from '@ai-star-eco/api-client';
import type { IpRun } from '@ai-star-eco/types';
import { getRun } from '@/ip/api/ip-studio';
import { createStudioSkillDraft, skillDraftOutput } from '@/canvas-bridge/studio-skills';
import { StudioErrorNotice, useStudioApp, useStudioErrorState } from './studio-errors';

type Saved = { clientRequestId: string; runId?: string };
const memoKey = (projectId: string, executionId: string) => `studio-skill-draft:${projectId}:${executionId}`;
function readSaved(projectId: string, executionId: string): Saved | undefined {
  try { const value = JSON.parse(localStorage.getItem(memoKey(projectId, executionId)) || 'null'); return typeof value?.clientRequestId === 'string' ? value : undefined; }
  catch { return undefined; }
}
function writeSaved(projectId: string, executionId: string, value: Saved) {
  try { localStorage.setItem(memoKey(projectId, executionId), JSON.stringify(value)); } catch { /* the server stays idempotent per request key */ }
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export const SKILL_DRAFT_POLL_MS = { value: 1500 };

export function StudioDialogueSkillDraft({ projectId, executionId, maxCost, demo }: { projectId: string; executionId: string; maxCost?: number; demo?: boolean }) {
  const { modal } = useStudioApp();
  const [run, setRun] = useState<IpRun>();
  const [busy, setBusy] = useState(false), [forbidden, setForbidden] = useState(false);
  const [error, setError] = useStudioErrorState();
  const saved = useRef<Saved | undefined>(undefined), alive = useRef(true), following = useRef<string | undefined>(undefined);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const follow = async (first: IpRun) => {
    following.current = first.id;
    let current = first;
    setRun(current);
    while (alive.current && following.current === first.id && current.status === 'running') {
      await sleep(SKILL_DRAFT_POLL_MS.value);
      if (!alive.current || following.current !== first.id) return;
      try { current = await getRun(first.id); setRun(current); } catch { await sleep(SKILL_DRAFT_POLL_MS.value * 2); }
    }
  };
  // A draft started earlier on this browser: show where it got to instead of offering a second one.
  useEffect(() => {
    const prior = readSaved(projectId, executionId);
    saved.current = prior;
    setRun(undefined); setForbidden(false); setError('');
    if (prior?.runId) getRun(prior.runId).then(r => { if (alive.current) void follow(r); }).catch(() => undefined);
  }, [projectId, executionId]);

  const submit = async () => {
    setBusy(true); setError('');
    // A failed draft starts over with a new key; otherwise the same key, so a retry is never a second charge.
    if (!saved.current || run?.status === 'failed') saved.current = { clientRequestId: nanoid() };
    writeSaved(projectId, executionId, saved.current);
    try {
      const result = await createStudioSkillDraft(projectId, { clientRequestId: saved.current.clientRequestId, executionId, maxCost: maxCost ?? 0 });
      saved.current = { ...saved.current, runId: result.id };
      writeSaved(projectId, executionId, saved.current);
      if (alive.current) void follow(result);
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof ApiError && e.code === 'STUDIO_SKILL_DRAFT_FORBIDDEN') setForbidden(true);
      else setError(e);
    } finally { if (alive.current) setBusy(false); }
  };
  const start = () => {
    if (busy) return;
    if (maxCost === undefined && !demo) { setError('整理所用的模型未定价，请在后台配置后重试。'); return; }
    modal.confirm({
      title: '将本次制作整理成技能草稿？',
      content: `将读取本次制作的方案、步骤和检查结果，整理成做法草稿，不包含素材和画布内容。${demo ? '演示模式不扣积分。' : '按实际用量结算。'}草稿需管理员在后台审阅并发布后生效。`,
      okText: '开始整理', cancelText: '取消', onOk: () => submit(),
    });
  };

  if (forbidden) return <p className="studio-dialogue-note studio-dialogue-skill-draft">仅运营账号可整理技能草稿。</p>;
  const draft = skillDraftOutput(run);
  return <div className="studio-dialogue-skill-draft" role="group" aria-label="整理成技能草稿">
    {run?.status === 'running' && <p className="studio-dialogue-note" role="status">正在整理技能草稿{run.pct ? `，已完成 ${run.pct}%` : ''}</p>}
    {run?.status === 'done' && <p className="studio-dialogue-note" role="status">
      {draft ? `已保存为技能草稿 v${draft.version}${draft.strippedReferences ? `，已移除 ${draft.strippedReferences} 处素材引用` : ''}。` : '技能草稿已生成。'}
      需管理员在后台审阅并发布后生效，不影响当前对话。{run.cost ? `本次消耗 ${formatCredits(run.cost)} 积分。` : ''}
    </p>}
    {run?.status === 'failed' && <p className="studio-dialogue-warning" role="status">整理失败{run.errorMessage ? `：${run.errorMessage}` : ''}</p>}
    {(!run || run.status === 'failed') && <Button size="small" loading={busy} title="草稿需管理员审阅后发布，不影响任何对话" onClick={start}>
      {run?.status === 'failed' ? '重新整理' : '整理成技能草稿'}</Button>}
    {error && <p className="studio-assistant-error" role="alert"><span>{error}</span> <StudioErrorNotice error={error} autoReport={false} label="查看详情"/></p>}
  </div>;
}
