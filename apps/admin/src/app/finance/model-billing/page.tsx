'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ModelBillingTarget, CreditCampaign, ModelBillingTargetOption, ModelDiscount } from '@ai-star-eco/types';
import type { PaginationMeta } from '@/types/_shared';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { formatDateTime } from '@/lib/datetime';
import { useAdminIdentity } from '@/lib/useAdminRole';
import * as api from '@/api/model-billing';
import { CampaignForm, DiscountForm } from './config-forms';
import { Grants } from './grants';
import { Conversions } from './conversions';
import { errorMessage, Pager, targetLabel } from './shared';

type Tab = 'prices' | 'discounts' | 'campaigns' | 'grants' | 'conversions';
type Row = ModelDiscount | CreditCampaign;
const tabs: { id: Tab; name: string; note: string }[] = [
  { id: 'prices', name: '模型价格', note: '价格沿用现有模型接入点及其价格配置。' },
  { id: 'discounts', name: '客户折扣', note: '可指定个人、企业或全体客户；多条优惠不叠加，取适用的最低折扣价。' },
  { id: 'campaigns', name: '赠款活动', note: '选择适用接入点，设置发放额度、每账户限额与有效期。' },
  { id: 'grants', name: '发放与查询', note: '模型赠款单独记账，只能用在指定的模型接入点上。' },
  { id: 'conversions', name: '积分转赠款', note: '把客户的通用积分转成模型赠款，只有超级管理员可用。' },
];
export default function ModelBillingPage() {
  const identity = useAdminIdentity();
  // Remount on an identity change so another staff member never inherits drafts or response state.
  if (!identity.role) return <p role="status">正在确认后台身份…</p>;
  return <Workspace key={identity.id ?? identity.role} actorId={identity.id ?? identity.role} canConfigure={identity.role === 'SUPER_ADMIN' || identity.role === 'OPERATOR'} superAdmin={identity.role === 'SUPER_ADMIN'} />;
}
function Workspace({ canConfigure, actorId, superAdmin }: { canConfigure: boolean; actorId: string; superAdmin: boolean }) {
  const [tab, setTab] = React.useState<Tab>('prices'), [options, setOptions] = React.useState<ModelBillingTargetOption[]>([]);
  const [catalogError, setCatalogError] = React.useState(''), [catalogBusy, setCatalogBusy] = React.useState(true), [catalogReload, setCatalogReload] = React.useState(0);
  const [grantLocked, setGrantLocked] = React.useState(false);
  const [endpointId,setEndpointId]=React.useState('');
  React.useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('endpointId');
    if(id){setEndpointId(id);setTab('discounts');}
  },[]);
  const defaultTarget=options.find(option=>option.target.endpointId===endpointId)?.target;
  React.useEffect(() => {
    const abort = new AbortController(); setCatalogBusy(true); setCatalogError('');
    api.targets(abort.signal).then(rows => { if (!abort.signal.aborted) setOptions(rows); })
      .catch(e => { if (!abort.signal.aborted) setCatalogError(errorMessage(e)); })
      .finally(() => { if (!abort.signal.aborted) setCatalogBusy(false); });
    return () => abort.abort();
  }, [catalogReload]);
  return <div className="space-y-5"><PageHeader title="模型赠款与折扣" description="先按折扣算出价格，再用这个模型的赠款抵扣，不够的部分扣普通积分。" />
    <div className="flex flex-wrap gap-2 border-b pb-3" aria-label="计费管理分类">{tabs.filter(item => item.id !== 'conversions' || superAdmin).map(item => <Button key={item.id} variant={tab === item.id ? 'default' : 'outline'}
      aria-pressed={tab === item.id} disabled={grantLocked && tab !== item.id} onClick={() => setTab(item.id)}>{item.name}</Button>)}</div>
    {catalogBusy ? <p role="status" className="text-sm text-muted-foreground">读取可配置模型…</p> : catalogError ? <div role="alert" className="flex items-center gap-3 text-sm text-destructive">{catalogError}<Button variant="outline" onClick={() => setCatalogReload(x => x + 1)}>重新读取模型</Button></div>
      : !options.length && <p className="text-sm text-muted-foreground">暂无已启用的模型接入点。可先在 <Link className="underline" href="/platform/ai-models">LLM API 与用量</Link> 中检查模型与用途配置。</p>}
    {endpointId && <p className="text-sm text-muted-foreground">当前接入点：{defaultTarget ? targetLabel(defaultTarget,options) : endpointId}。新建折扣和赠款活动时默认选择此接入点。</p>}
    {tab === 'conversions' ? (superAdmin ? <Conversions actorId={actorId} /> : null) : tab === 'prices' ? <section className="space-y-3 rounded-lg border bg-card p-5"><p>售价沿用已有接入点和价格配置，不在这里重复配置。</p><div className="flex gap-4 text-sm"><Link className="underline" href="/platform/ai-models">管理模型接入点</Link><Link className="underline" href="/celebrity/engine-pricing">现有引擎价格配置</Link></div></section> : tab === 'grants' ? <Grants actorId={actorId} onLockChange={setGrantLocked} /> : <Configuration key={tab} tab={tab} defaultTarget={defaultTarget} options={options} canConfigure={canConfigure && !catalogBusy && !catalogError} />}
  </div>;
}
function Configuration({ tab, options, canConfigure,defaultTarget }: { defaultTarget?:ModelBillingTarget; tab: Exclude<Tab, 'grants' | 'prices' | 'conversions'>; options: ModelBillingTargetOption[]; canConfigure: boolean }) {
  const [rows, setRows] = React.useState<Row[]>([]), [meta, setMeta] = React.useState<PaginationMeta>();
  const [page, setPage] = React.useState(0), [reload, setReload] = React.useState(0), [busy, setBusy] = React.useState(true), [error, setError] = React.useState('');
  const [edit, setEdit] = React.useState<Row | 'new'>(), [saved, setSaved] = React.useState(false);
  React.useEffect(() => {
    const abort = new AbortController(); setBusy(true); setError('');
    api[tab](page, abort.signal).then(result => { if (!abort.signal.aborted) { setRows(result.data); setMeta(result.pagination); } })
      .catch(e => { if (!abort.signal.aborted) { setError(errorMessage(e)); setRows([]); } })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [tab, page, reload]);
  const close = () => setEdit(undefined), onSaved = () => { setEdit(undefined); setSaved(true); setReload(x => x + 1); };
  const editorProps = { options, onSaved, onCancel: close, defaultTarget };
  return <div className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><p className="max-w-3xl text-sm text-muted-foreground">{tabs.find(t => t.id === tab)?.note}</p>
    <div className="flex shrink-0 gap-2"><Button variant="outline" disabled={busy || !!edit} onClick={() => setReload(x => x + 1)}>刷新列表</Button>
      {canConfigure && <Button disabled={!!edit || !options.length} onClick={() => { setEdit('new'); setSaved(false); }}>{tab === 'discounts' ? '新增折扣' : '创建活动'}</Button>}</div></div>
    {saved && <p role="status" className="text-sm">配置已保存</p>}
    {edit && canConfigure && (tab === 'discounts' ? <DiscountForm key={edit === 'new' ? 'new' : edit.id} row={edit === 'new' ? undefined : edit as ModelDiscount} {...editorProps} />
        : <CampaignForm key={edit === 'new' ? 'new' : edit.id} row={edit === 'new' ? undefined : edit as CreditCampaign} {...editorProps} />)}
    <section className="rounded-lg border bg-card p-4">{busy ? <p role="status">加载中…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : !rows.length ? <p className="py-6 text-center text-sm text-muted-foreground">暂无{tabs.find(t => t.id === tab)?.name}配置</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="border-b text-muted-foreground"><tr><th className="py-3">名称与适用模型</th><th>价格或限额</th><th>状态与时间</th><th><span className="sr-only">操作</span></th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className="border-b align-top last:border-0"><td className="max-w-sm py-4 pr-4"><p className="font-medium">{row.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{'targets' in row ? row.targets.map(t => targetLabel(t, options)).join('、') : targetLabel(row.target, options)}</p></td>
          <td className="py-4 pr-4">{'factor' in row ? <><p>{Number((row.factor * 10).toFixed(5))} 折 · {row.audience === 'all' ? '所有客户' : row.audience === 'user' ? '指定个人' : '指定企业'}</p>
              {row.audienceId && <p className="text-xs text-muted-foreground">对象：{row.audienceLabel ?? row.audienceId}</p>}<p className="text-xs text-muted-foreground">折后先用模型赠款抵扣</p></>
              : <><p>已发 {row.issued} / {row.totalIssueLimit} 积分</p><p className="text-xs text-muted-foreground">每账户最多 {row.perWalletIssueLimit} 积分</p></>}</td>
          <td className="py-4 pr-4"><p>{!row.active ? '已停用' : 'startsAt' in row && Date.parse(row.startsAt) > Date.now() ? '未开始' : 'expiresAt' in row && Date.parse(row.expiresAt) <= Date.now() ? '已到期' : '已启用'}</p>
            {'expiresAt' in row && <p className="text-xs text-muted-foreground">{formatDateTime(row.expiresAt)} 到期</p>}<p className="text-xs text-muted-foreground">更新于 {formatDateTime(row.updatedAt)}</p></td>
          <td className="py-3 text-right">{canConfigure && <Button variant="outline" disabled={!!edit} onClick={() => { setEdit(row); setSaved(false); }}>编辑</Button>}</td></tr>)}</tbody></table></div>}
      {!error && <Pager meta={meta} onPage={setPage} disabled={busy || !!edit} />}
    </section></div>;
}
