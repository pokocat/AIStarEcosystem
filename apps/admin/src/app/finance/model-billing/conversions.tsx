'use client';

import * as React from 'react';
import type { CreditCampaign, ModelGrantConversionLine, ModelGrantConversionRequest } from '@ai-star-eco/types';
import { SelectField } from '@ai-star-eco/ui/ui/select-field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCredits } from '@/lib/format';
import * as api from '@/api/model-billing';
import { control, errorMessage, Field } from './shared';

const STATUS: Record<ModelGrantConversionLine['status'], string> = {
  ready: '可转换', nothing: '不转换', converted: '已转换', already: '这一批已转过', failed: '失败',
};
const newRequestId = () => `conv-${crypto.randomUUID().replace(/-/g, '')}`;

/** Super admin only: move customers' general (gift + license) credits into a model grant, keeping a fixed general balance. */
export function Conversions({ actorId }: { actorId: string }) {
  const storageKey = `model-grant-conversion:${actorId}`;
  const [days, setDays] = React.useState('3'), [keep, setKeep] = React.useState('1000'), [validDays, setValidDays] = React.useState('30');
  const [reason, setReason] = React.useState(''), [campaignId, setCampaignId] = React.useState('');
  const [campaigns, setCampaigns] = React.useState<CreditCampaign[]>([]);
  const [lines, setLines] = React.useState<ModelGrantConversionLine[]>([]), [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(''), [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState<ModelGrantConversionRequest>(), [done, setDone] = React.useState(false);

  React.useEffect(() => {
    api.campaigns(0).then(page => setCampaigns(page.data.filter(c => c.active))).catch(e => setError(errorMessage(e)));
    try { const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as ModelGrantConversionRequest | null;
      if (saved?.requestId && saved.userIds?.length) setPending(saved);
    } catch { /* An unreadable draft cannot authorize a conversion. */ }
  }, [storageKey]);

  const keepValue = Number(keep);
  const load = async (source: () => Promise<ModelGrantConversionLine[]>) => {
    setBusy(true); setError(''); setDone(false); setConfirming(false);
    try { const rows = await source(); setLines(rows); setSelected(new Set(rows.filter(r => r.status === 'ready').map(r => r.userId))); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const chosen = lines.filter(l => selected.has(l.userId) && l.status === 'ready');
  const total = chosen.reduce((sum, l) => sum + l.amount, 0);
  const keepValid = Number.isInteger(keepValue) && keepValue >= 0;
  const daysValid = Number.isInteger(Number(validDays)) && Number(validDays) >= 1 && Number(validDays) <= 365;
  const blocked = !campaignId ? '请选择赠款活动' : !reason.trim() ? '请填写转换原因' : !keepValid ? '保留积分要是 0 或正整数'
    : !daysValid ? '有效期要在 1 到 365 天之间' : !chosen.length ? '没有可转换的客户' : '';

  const run = async (request: ModelGrantConversionRequest) => {
    setBusy(true); setError('');
    sessionStorage.setItem(storageKey, JSON.stringify(request)); setPending(request);
    try {
      const result = await api.convertToGrant(request);
      setLines(result); setSelected(new Set()); setDone(true);
      sessionStorage.removeItem(storageKey); setPending(undefined);
    } catch (e) {
      // The outcome is unknown: keep the same request id so a retry skips anyone already converted.
      setError(`${errorMessage(e)}。结果不确定，请点「重试上一次转换」确认，不会重复转。`);
    } finally { setBusy(false); setConfirming(false); }
  };
  const submit = () => run({ requestId: newRequestId(), campaignId, keep: keepValue, validDays: Number(validDays),
    userIds: chosen.map(l => l.userId), reason: reason.trim() });

  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">把客户的通用积分（赠送和激活码）转成指定模型的赠款，每人保留一部分通用余额。充值的积分不会被转。
      每个客户单独结算：扣一笔调整流水，同时发等额赠款。</p>
    {pending && <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      上一次转换（{pending.userIds.length} 位客户）结果还没确认。
      <Button size="sm" disabled={busy} onClick={() => run(pending)}>重试上一次转换</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => { sessionStorage.removeItem(storageKey); setPending(undefined); }}>放弃这条记录</Button>
    </div>}
    <section className="grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-2">
      <Field label="最近几天人工加过分的客户" hint="读取这几天已批准的赠送和补偿记录里的客户。">
        <div className="flex gap-2"><Input aria-label="最近几天" type="number" min="1" max="90" value={days} onChange={e => setDays(e.target.value)} />
          <Button variant="outline" disabled={busy || !keepValid} onClick={() => load(() => api.conversionCandidates(Number(days), keepValue))}>读取客户</Button></div>
      </Field>
      <Field label="每人保留通用积分" hint="按 1 元 = 100 积分，10 元填 1000。改了以后点「重新计算」。">
        <div className="flex gap-2"><Input aria-label="每人保留通用积分" type="number" min="0" step="1" value={keep} onChange={e => setKeep(e.target.value)} />
          <Button variant="outline" disabled={busy || !lines.length || !keepValid} onClick={() => load(() => api.previewConversion(lines.map(l => l.userId), keepValue))}>重新计算</Button></div>
      </Field>
      <Field label="转入的赠款活动" hint="赠款只能用在活动选定的模型上，到期时间不会晚于活动结束时间。">
        <SelectField aria-label="转入的赠款活动" className={control} value={campaignId} onChange={e => setCampaignId(e.target.value)}>
          <option value="">选择赠款活动</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}（已发 {formatCredits(c.issued)} / {formatCredits(c.totalIssueLimit)}）</option>)}
        </SelectField>
      </Field>
      <Field label="赠款有效期（天）"><Input aria-label="赠款有效期（天）" type="number" min="1" max="365" value={validDays} onChange={e => setValidDays(e.target.value)} /></Field>
      <div className="md:col-span-2"><Field label="转换原因" hint="会写进客户的积分明细和审计记录。">
        <Input aria-label="转换原因" maxLength={200} value={reason} onChange={e => setReason(e.target.value)} placeholder="如 H3 体验：通用积分转为模型赠款，保留 10 元通用余额" />
      </Field></div>
    </section>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {lines.length > 0 && <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm" aria-label="转换预览">
        <thead className="border-b text-muted-foreground"><tr><th className="py-2"><span className="sr-only">选择</span></th><th>客户</th>
          <th className="text-right">赠送</th><th className="text-right">激活码</th><th className="text-right">充值</th><th className="text-right">当前总额</th>
          <th className="text-right">保留</th><th className="text-right">转成赠款</th><th className="pl-4">状态</th></tr></thead>
        <tbody>{lines.map(l => <tr key={l.userId} className="border-b last:border-0">
          <td className="py-2"><input type="checkbox" aria-label={`转换 ${l.displayName ?? l.userId}`} disabled={done || l.status !== 'ready'}
            checked={selected.has(l.userId)} onChange={e => setSelected(prev => { const next = new Set(prev); if (e.target.checked) next.add(l.userId); else next.delete(l.userId); return next; })} /></td>
          <td className="max-w-[220px] truncate" title={l.userId}>{l.displayName ?? l.userId}<span className="block text-xs text-muted-foreground">{l.phone ?? ''}</span></td>
          <td className="text-right tabular-nums">{formatCredits(l.giftBalance)}</td><td className="text-right tabular-nums">{formatCredits(l.licenseBalance)}</td>
          <td className="text-right tabular-nums">{formatCredits(l.rechargeBalance)}</td><td className="text-right tabular-nums">{formatCredits(l.totalBalance)}</td>
          <td className="text-right tabular-nums">{formatCredits(Math.min(l.keep, l.totalBalance))}</td>
          <td className="text-right font-medium tabular-nums">{formatCredits(l.amount)}</td>
          <td className="max-w-[220px] truncate pl-4" title={l.message ?? undefined}>{STATUS[l.status]}{l.message ? ` · ${l.message}` : ''}</td>
        </tr>)}</tbody></table></div>
      {!done && <div className="flex flex-wrap items-center gap-3">
        {!confirming ? <Button disabled={busy || !!blocked || !!pending} onClick={() => setConfirming(true)}>转换 {chosen.length} 位客户</Button>
          : <><Button variant="destructive" disabled={busy} onClick={submit}>确认转换 {formatCredits(total)} 积分</Button>
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>取消</Button>
            <span className="text-sm text-muted-foreground">转换后通用积分会被扣掉，只能用在活动选定的模型上，到期作废。</span></>}
        {blocked && !confirming && <span className="text-sm text-muted-foreground">{blocked}</span>}
      </div>}
      {done && <p role="status" className="text-sm">已处理：{lines.filter(l => l.status === 'converted').length} 位转换成功，
        共 {formatCredits(lines.filter(l => l.status === 'converted').reduce((s, l) => s + l.amount, 0))} 积分；失败的客户余额没有变化。</p>}
    </section>}
  </div>;
}
