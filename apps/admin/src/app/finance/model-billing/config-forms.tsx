'use client';

import * as React from 'react';
import type { CreditCampaign, ModelBillingTarget, ModelBillingTargetOption, ModelDiscount } from '@ai-star-eco/types';
import { Input } from '@/components/ui/input';
import * as api from '@/api/model-billing';
import { AccountPicker, control, Field, isoInput, localInput, SaveForm, targetKey, targetLabel, TargetPicker } from './shared';
import { SelectField } from '@ai-star-eco/ui/ui/select-field';

type Common = { defaultTarget?:ModelBillingTarget; options: ModelBillingTargetOption[]; onSaved: () => void; onCancel: () => void };
function Active({ value, set }: { value: boolean; set: (value: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={value} onChange={e => set(e.target.checked)} />启用配置</label>;
}
export function DiscountForm({ row, options, onSaved, onCancel,defaultTarget }: Common & { row?: ModelDiscount }) {
  const [name, setName] = React.useState(row?.name ?? ''), [target, setTarget] = React.useState(row?.target ?? defaultTarget);
  const [factor, setFactor] = React.useState(String(row ? row.factor * 10 : 8)), [audience, setAudience] = React.useState<'all' | 'user' | 'enterprise'>(row?.audience ?? 'all');
  const [audienceId, setAudienceId] = React.useState(row?.audienceId ?? '');
  const [start, setStart] = React.useState(localInput(row?.startsAt ?? new Date().toISOString()));
  const [end, setEnd] = React.useState(localInput(row?.expiresAt ?? new Date(Date.now() + 30 * 86400000).toISOString()));
  const [active, setActive] = React.useState(row?.active ?? true);
  return <SaveForm title={row ? '编辑客户折扣' : '新增客户折扣'} onSaved={onSaved} onCancel={onCancel} save={() => {
    if (!target) throw new Error('请选择模型接入点');
    if (audience !== 'all' && !audienceId) throw new Error('请选择优惠对象');
    return api.saveDiscount(row?.id, { name, target, audience, audienceId: audience === 'all' ? null : audienceId,
      factor: Number((Number(factor) / 10).toFixed(6)), allowGrants: true, startsAt: isoInput(start, row?.startsAt), expiresAt: isoInput(end, row?.expiresAt), active, expectedVersion: row?.version });
  }}>
    <Field label="优惠名称"><Input required maxLength={128} value={name} onChange={e => setName(e.target.value)} placeholder="如 企业客户八折" /></Field>
    <TargetPicker options={options} value={target} onChange={setTarget} />
    <Field label="折扣（几折）" hint="8 表示八折。同一收费项取适用的最低折扣价，不重复叠加。"><Input required type="number" min="0.00001" max="10" step="0.00001" value={factor} onChange={e => setFactor(e.target.value)} /></Field>
    <Field label="优惠对象" hint={audience==='enterprise'?'对企业主账号和所有子账号的企业积分消费生效，新加入的子账号自动继承。':undefined}><SelectField className={control} value={audience} onChange={e => { setAudience(e.target.value as typeof audience); setAudienceId(''); }}>
      <option value="all">所有客户</option><option value="user">指定个人</option><option value="enterprise">指定企业</option></SelectField></Field>
    {audience !== 'all' && <AccountPicker key={audience} kind={audience} value={audienceId} valueLabel={audienceId === row?.audienceId ? row?.audienceLabel : undefined} onChange={setAudienceId} />}
    <Field label="开始时间"><Input required type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></Field>
    <Field label="结束时间"><Input required type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></Field>
    <Active value={active} set={setActive} />
  </SaveForm>;
}
export function CampaignForm({ row, options, onSaved, onCancel,defaultTarget }: Common & { row?: CreditCampaign }) {
  const [name, setName] = React.useState(row?.name ?? ''), [targets, setTargets] = React.useState<ModelBillingTarget[]>(row?.targets ?? (defaultTarget ? [defaultTarget] : []));
  const [total, setTotal] = React.useState(String(row?.totalIssueLimit ?? '')), [perWallet, setPerWallet] = React.useState(String(row?.perWalletIssueLimit ?? ''));
  const [active, setActive] = React.useState(row?.active ?? true);
  const [start, setStart] = React.useState(localInput(row?.startsAt ?? new Date().toISOString()));
  const [end, setEnd] = React.useState(localInput(row?.expiresAt ?? new Date(Date.now() + 30 * 86400000).toISOString()));
  const targetsLocked = !!row && row.issued > 0;
  const choices = [...options, ...targets.filter(t => !options.some(o => targetKey(o.target) === targetKey(t))).map(t => ({ id: targetKey(t), target: t, label: targetLabel(t, options), channelName: '' }))];
  return <SaveForm title={row ? '编辑赠款活动' : '创建赠款活动'} onSaved={onSaved} onCancel={onCancel} save={() => {
    if (!targets.length) throw new Error('至少选择一个模型接入点');
    return api.saveCampaign(row?.id, { name, targets, totalIssueLimit: Number(total), perWalletIssueLimit: Number(perWallet), startsAt: isoInput(start, row?.startsAt), expiresAt: isoInput(end, row?.expiresAt), active, expectedVersion: row?.version });
  }}>
    <Field label="活动名称"><Input required maxLength={128} value={name} onChange={e => setName(e.target.value)} placeholder="如 十月图片体验" /></Field>
    <div className="space-y-2 md:col-span-2"><p className="text-sm font-medium">适用模型接入点（可多选）</p>
      <p className="text-xs text-muted-foreground">{targetsLocked ? '这个活动已经发过赠款，适用模型不能再改。要换模型请停用它，再新建一个活动。' : '同一接入点在任何调用入口都可使用。发出第一笔赠款后，适用模型就不能再改。'}</p>
      <div className="max-h-60 space-y-2 overflow-auto rounded-md border p-3">{choices.length ? choices.map(o => {
        const checked = targets.some(t => targetKey(t) === targetKey(o.target));
        return <label key={o.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={checked} disabled={targetsLocked}
          onChange={e => setTargets(e.target.checked ? [...targets, o.target] : targets.filter(t => targetKey(t) !== targetKey(o.target)))} />
          <span>{o.label}{o.channelName ? ` · 渠道：${o.channelName}` : ''}</span></label>;
      }) : <p className="text-sm text-muted-foreground">暂无已开放且接入计费的模型</p>}</div></div>
    <Field label="最多发放额度（积分）"><Input required type="number" min="1" step="1" max={Number.MAX_SAFE_INTEGER} value={total} onChange={e => setTotal(e.target.value)} /></Field>
    <Field label="每个消费账户最多领取（积分）"><Input required type="number" min="1" step="1" max={total || Number.MAX_SAFE_INTEGER} value={perWallet} onChange={e => setPerWallet(e.target.value)} /></Field>
    <Field label="活动开始时间"><Input required type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></Field>
    <Field label="活动结束时间"><Input required type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></Field>
    <Active value={active} set={setActive} />
  </SaveForm>;
}
