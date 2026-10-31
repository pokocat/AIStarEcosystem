'use client';

import * as React from 'react';
import type { ModelBillingTarget, ModelBillingTargetOption, ModelBillingWalletOption, ModelBillingEnterpriseOption, ModelBillingUserOption } from '@ai-star-eco/types';
import type { PaginationMeta } from '@/types/_shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as api from '@/api/model-billing';
import { SelectField } from '@ai-star-eco/ui/ui/select-field';

export const control = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
export const targetKey = (t: ModelBillingTarget) => t.endpointId;
export const unitLabel = (unit: string) => ({ image: '张', second: '秒', call: '次', ktoken: '千 Token' }[unit] ?? unit);
export const targetLabel = (target: ModelBillingTarget, options: ModelBillingTargetOption[]) => options.find(o => targetKey(o.target) === targetKey(target))?.label
  ?? `已停用接入点 · ${target.endpointId}`;
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试';

/** datetime-local editing uses local calendar fields; saved/displayed timestamps remain ISO/formatDateTime. */
export function localInput(iso: string) {
  const d = new Date(iso), pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const isoInput = (value: string, original?: string) => original && localInput(original) === value ? original : new Date(value).toISOString();
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="grid gap-1.5 text-sm"><span className="font-medium">{label}</span>{children}{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</label>;
}
export function Pager({ meta, onPage, disabled }: { meta?: PaginationMeta; onPage: (page: number) => void; disabled?: boolean }) {
  if (!meta) return null;
  return <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm text-muted-foreground">
    <span>共 {meta.total} 条 · 第 {meta.page + 1} / {Math.max(1, meta.totalPages)} 页</span>
    <div className="flex gap-2"><Button type="button" variant="outline" disabled={disabled || !meta.hasPrev} onClick={() => onPage(meta.page - 1)}>上一页</Button>
      <Button type="button" variant="outline" disabled={disabled || !meta.hasNext} onClick={() => onPage(meta.page + 1)}>下一页</Button></div>
  </div>;
}
export function TargetPicker({ options, value, onChange }: { options: ModelBillingTargetOption[]; value?: ModelBillingTarget; onChange: (target: ModelBillingTarget) => void }) {
  const selected = value ? targetKey(value) : '';
  return <Field label="模型接入点"><SelectField className={control} required value={selected} onChange={e => {
    const option = options.find(o => targetKey(o.target) === e.target.value); if (option) onChange(option.target);
  }}><option value="">选择已有模型接入点</option>
    {value && !options.some(o => targetKey(o.target) === selected) && <option value={selected}>{targetLabel(value, options)}</option>}
    {options.map(o => <option key={o.id} value={targetKey(o.target)}>{o.label} · 渠道：{o.channelName}</option>)}</SelectField></Field>;
}
export function SaveForm({ title, children, save, onSaved, onCancel }: { title: string; children: React.ReactNode; save: () => Promise<unknown>; onSaved: () => void; onCancel: () => void }) {
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState('');
  return <form aria-label={title} className="rounded-lg border bg-card p-5" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await save(); onSaved(); } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }}><h2 className="mb-4 text-base font-semibold">{title}</h2>
    <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">{children}</fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <div className="mt-5 flex gap-2"><Button type="submit" disabled={busy}>{busy ? '保存中…' : '保存配置'}</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>取消</Button></div>
  </form>;
}

type LookupOption = ModelBillingWalletOption | ModelBillingEnterpriseOption | ModelBillingUserOption;
export function AccountPicker({ kind, value, valueLabel, onChange }: { kind: 'wallet' | 'user' | 'enterprise'; value: string; valueLabel?: string | null; onChange: (id: string, option: LookupOption) => void }) {
  const [query, setQuery] = React.useState(''), [page, setPage] = React.useState(0), [reload, setReload] = React.useState(0);
  const [rows, setRows] = React.useState<LookupOption[]>([]), [meta, setMeta] = React.useState<PaginationMeta>();
  const [busy, setBusy] = React.useState(true), [error, setError] = React.useState('');
  const [selected, setSelected] = React.useState<LookupOption>();
  React.useEffect(() => {
    const abort = new AbortController(); setBusy(true); setError('');
    const timer = setTimeout(() => {
      const promise = kind === 'enterprise' ? api.enterpriseOptions(query, page, abort.signal) : kind === 'user' ? api.userOptions(query, page, abort.signal) : api.walletOptions(query, '', page, abort.signal);
      promise.then(result => { if (!abort.signal.aborted) { setRows(result.data); setMeta(result.pagination); } })
        .catch(e => { if (!abort.signal.aborted) { setError(errorMessage(e)); setRows([]); setMeta(undefined); } })
        .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query, page, kind, reload]);
  const label = (option: LookupOption) => 'displayName' in option
    ? `${option.displayName}${option.phone ? ` · ${option.phone}` : ''}${'accountType' in option ? ` · ${option.accountType === 'personal' ? '个人账户' : `${option.enterpriseName ?? '企业'}成员账户`}` : ''}`
    : option.name;
  const id = (option: LookupOption) => option.id;
  return <div className="space-y-2 rounded-md border p-3 md:col-span-2">
    <Field label={kind === 'enterprise' ? '查找企业' : '查找发放或优惠账户'}><Input value={query} maxLength={128}
      placeholder={kind === 'enterprise' ? '企业名称' : '姓名、手机号或企业名称'} onChange={e => { setQuery(e.target.value); setPage(0); }} /></Field>
    {value && <p className="text-sm">已选择：{selected && id(selected) === value ? label(selected) : valueLabel ?? value}</p>}
    {busy ? <p role="status" className="text-sm text-muted-foreground">查找中…</p> : error ? <div role="alert" className="text-sm text-destructive">{error} <Button type="button" variant="outline" onClick={() => setReload(x => x + 1)}>重试查询</Button></div>
      : <div className="grid gap-1">{rows.length ? rows.map(option => <button type="button" key={option.id} aria-pressed={value === id(option)}
        className={`rounded-md border px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring ${value === id(option) ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
        onClick={() => { setSelected(option); onChange(id(option), option); }}>{label(option)}</button>) : <p className="text-sm text-muted-foreground">没有匹配的账户</p>}</div>}
    <Pager meta={meta} onPage={setPage} disabled={busy} />
  </div>;
}
