'use client';

import * as React from 'react';
import Link from 'next/link';
import type { CreditAdjustmentRequest, CreditCampaign, ModelBillingWalletOption, ScopedCreditGrant, ScopedGrantRequest } from '@ai-star-eco/types';
import type { PaginationMeta } from '@/types/_shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/datetime';
import { ApiError } from '@/api/_client';
import { grantScoped } from '@/api/adjustments';
import * as api from '@/api/model-billing';
import { AccountPicker, errorMessage, Field, isoInput, localInput, Pager } from './shared';

type Pending = { wallet: ModelBillingWalletOption; request: ScopedGrantRequest };
export function Grants({ actorId, onLockChange }: { actorId: string; onLockChange: (locked: boolean) => void }) {
  const storageKey = `model-scoped-grant:${actorId}`;
  const [pending, setPending] = React.useState<Pending>();
  const [wallet, setWallet] = React.useState<ModelBillingWalletOption>();
  React.useEffect(() => {
    try { const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (value?.wallet?.id && value.request?.walletId === value.wallet.id && value.request?.requestId) {
        setWallet(value.wallet); setPending(value);
      }
    } catch { /* A malformed local draft cannot authorize a server mutation. */ }
  }, [storageKey]);
  React.useEffect(() => { onLockChange(!!pending); return () => onLockChange(false); }, [pending, onLockChange]);
  const remember = (request?: ScopedGrantRequest) => {
    if (request && wallet) { const next = { wallet, request }; sessionStorage.setItem(storageKey, JSON.stringify(next)); setPending(next); }
    else { sessionStorage.removeItem(storageKey); setPending(undefined); }
  };
  return <div className="space-y-5"><p className="text-sm text-muted-foreground">发放到指定消费账户。模型赠款单独记账，不增加普通积分余额；大额发放沿用审批流程。</p>
    <fieldset disabled={!!pending}><AccountPicker kind="wallet" value={wallet?.id ?? ''} valueLabel={wallet?.displayName} onChange={(_id, option) => { if ('accountType' in option) setWallet(option); }} /></fieldset>
    {pending && <p role="status" className="text-sm">有一笔尚未确认的发放，请重试原请求以确认结果。</p>}
    {wallet && <WalletGrants key={wallet.id} wallet={wallet} pending={pending?.request} remember={remember} />}
  </div>;
}
function WalletGrants({ wallet, pending, remember }: { wallet: ModelBillingWalletOption; pending?: ScopedGrantRequest; remember: (request?: ScopedGrantRequest) => void }) {
  const [rows, setRows] = React.useState<ScopedCreditGrant[]>([]), [meta, setMeta] = React.useState<PaginationMeta>();
  const [page, setPage] = React.useState(0), [reload, setReload] = React.useState(0), [busy, setBusy] = React.useState(true), [error, setError] = React.useState('');
  React.useEffect(() => {
    const abort = new AbortController(); setBusy(true); setError('');
    api.grants(wallet.id, page, abort.signal).then(result => { if (!abort.signal.aborted) { setRows(result.data); setMeta(result.pagination); } })
      .catch(e => { if (!abort.signal.aborted) { setError(errorMessage(e)); setRows([]); } })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [wallet.id, page, reload]);
  return <div className="space-y-5"><GrantForm wallet={wallet} pending={pending} remember={remember} onSaved={() => setReload(x => x + 1)} />
    <section className="rounded-lg border bg-card p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">该账户的模型赠款</h2>
      <Button variant="outline" disabled={busy} onClick={() => setReload(x => x + 1)}>刷新额度</Button></div>
      {busy ? <p role="status">加载中…</p> : error ? <p role="alert" className="text-destructive">{error}</p> : rows.length ?
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b text-muted-foreground"><tr>
          <th className="py-2">活动与模型</th><th>可用 / 冻结 / 已用</th><th>到期时间</th></tr></thead><tbody>{rows.map(row => {
            const expired = new Date(row.expiresAt).getTime() <= Date.now();
            return <tr key={row.id} className="border-b last:border-0"><td className="py-3 pr-4"><p className="font-medium">{row.campaignName}</p><p className="text-xs text-muted-foreground">{row.targetLabels.join('、')}</p></td>
              <td className="pr-4 tabular-nums">{expired ? '已到期' : !row.campaignActive ? '活动已暂停或不在有效期' : `${row.available} 可用`}<p className="text-xs text-muted-foreground">{row.frozen} 冻结 · {row.spent} 已用</p></td><td>{formatDateTime(row.expiresAt)}</td></tr>;
          })}</tbody></table></div> : <p className="text-sm text-muted-foreground">该账户还没有模型赠款</p>}
      {!error && <Pager meta={meta} onPage={setPage} disabled={busy} />}
    </section></div>;
}

function GrantForm({ wallet, pending, remember, onSaved }: { wallet: ModelBillingWalletOption; pending?: ScopedGrantRequest; remember: (request?: ScopedGrantRequest) => void; onSaved: () => void }) {
  const [campaigns, setCampaigns] = React.useState<CreditCampaign[]>([]), [meta, setMeta] = React.useState<PaginationMeta>();
  const [page, setPage] = React.useState(0), [refresh, setRefresh] = React.useState(0), [loading, setLoading] = React.useState(true), [loadError, setLoadError] = React.useState('');
  const [campaign, setCampaign] = React.useState<CreditCampaign>(), [amount, setAmount] = React.useState(pending ? String(pending.amount) : ''), [end, setEnd] = React.useState(pending ? localInput(pending.expiresAt) : ''), [reason, setReason] = React.useState(pending?.reason ?? '');
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(''), [request, setRequest] = React.useState<ScopedGrantRequest | undefined>(pending);
  const [result, setResult] = React.useState<CreditAdjustmentRequest>();
  React.useEffect(() => {
    const abort = new AbortController(); setLoading(true); setLoadError('');
    api.campaigns(page, abort.signal).then(result => { if (!abort.signal.aborted) { setCampaigns(result.data); setMeta(result.pagination); } })
      .catch(e => { if (!abort.signal.aborted) { setLoadError(errorMessage(e)); setCampaigns([]); } })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [page, refresh]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || result) return; setError('');
    if (!request && (!campaign || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0 || !reason.trim() || !end)) { setError('请选择活动并填写有效额度、到期时间和原因'); return; }
    const payload = request ?? { walletId: wallet.id, campaignId: campaign!.id, amount: Number(amount), expiresAt: isoInput(end, campaign?.expiresAt), requestId: crypto.randomUUID(), reason: reason.trim() };
    setBusy(true);
    try { remember(payload); setRequest(payload); const response = await grantScoped(payload); setResult(response); remember(undefined); setRefresh(x => x + 1); onSaved(); }
    catch (e) { setError(errorMessage(e)); if (e instanceof ApiError && e.status && e.status >= 400 && e.status < 500) { setRequest(undefined); remember(undefined); } }
    finally { setBusy(false); }
  };
  return <form aria-label="发放模型赠款" className="rounded-lg border bg-card p-5" onSubmit={submit}><h2 className="mb-2 font-semibold">发放模型赠款</h2>
    <p className="mb-4 text-sm">发给 {wallet.displayName} · {wallet.accountType === 'personal' ? '个人账户' : `${wallet.enterpriseName}成员账户`}</p>
    <fieldset disabled={busy || !!request || !!result} className="space-y-4">
      <div><p className="mb-2 text-sm font-medium">选择赠款活动</p>{loading ? <p role="status">加载活动…</p> : loadError ? <div role="alert">{loadError} <Button type="button" variant="outline" onClick={() => setRefresh(x => x + 1)}>重试加载活动</Button></div>
        : <div className="grid gap-2">{campaigns.length ? campaigns.map(row => {
          const usable = row.active && Date.parse(row.startsAt) <= Date.now() && Date.parse(row.expiresAt) > Date.now();
          return <label key={row.id} className="flex items-start gap-2 rounded-md border p-3 text-sm"><input type="radio" name="campaign" checked={campaign?.id === row.id} disabled={!usable || row.issued >= row.totalIssueLimit}
            onChange={() => { setCampaign(row); setEnd(localInput(row.expiresAt)); }} /><span>{row.name}<span className="block text-xs text-muted-foreground">已发 {row.issued} / {row.totalIssueLimit} 积分 · 每账户最多 {row.perWalletIssueLimit} · {formatDateTime(row.expiresAt)} 到期{!usable ? ' · 当前不可发放' : ''}</span></span></label>;
        }) : <p className="text-sm text-muted-foreground">还没有赠款活动，请先创建。</p>}</div>}
        {!loadError && <Pager meta={meta} onPage={setPage} disabled={loading} />}
        {campaign && <p className="mt-2 text-sm text-muted-foreground">已选活动：{campaign.name}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="发放额度（积分）"><Input required type="number" min="1" step="1" max={campaign?.perWalletIssueLimit ?? Number.MAX_SAFE_INTEGER} value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        <Field label="额度到期时间"><Input required type="datetime-local" max={campaign ? localInput(campaign.expiresAt) : undefined} value={end} onChange={e => setEnd(e.target.value)} /></Field>
        <Field label="发放原因"><Input required maxLength={512} value={reason} onChange={e => setReason(e.target.value)} placeholder="如 新客户图片体验" /></Field></div>
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}{request ? '。结果尚未确认，请重试同一笔请求；系统不会重复发放。' : ''}</p>}
    {result ? <div role="status" className="mt-4 space-y-2 rounded-md bg-muted p-3 text-sm"><p>{result.status === 'approved' ? '已发放模型赠款' : result.status === 'pending_approval' ? '已提交审批，批准后到账' : '原请求已被驳回'}：{result.amount} 积分</p>
      <p>审批编号：{result.id}</p><div className="flex gap-3"><Link href="/finance/adjustments" className="underline">查看审批队列</Link>
        <button type="button" className="underline" onClick={() => { setResult(undefined); setRequest(undefined); setCampaign(undefined); setEnd(''); setAmount(''); setReason(''); }}>再发一笔</button></div></div>
      : <Button className="mt-4" type="submit" disabled={busy || (!campaign && !request)}>{busy ? '提交中…' : request ? '重试原请求' : '确认发放'}</Button>}
  </form>;
}
