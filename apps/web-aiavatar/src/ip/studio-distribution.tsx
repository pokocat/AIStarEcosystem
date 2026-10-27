'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, ConfigProvider, Modal } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ArrowRight, ExternalLink, RefreshCw, Send, Users, Video } from 'lucide-react';
import { PublishJobApi, SocialAccountApi } from '@ai-star-eco/api-client';
import type { PublishBatchSummary, PublishJob, PublishJobStatus } from '@ai-star-eco/types/publish-job';
import type { SocialAccount } from '@ai-star-eco/types/social-account';
import { PlatformGateScreen, useRequireAuth } from '@/components/hub/auth';
import { StudioComingSoon, StudioPage, StudioPageSearch } from './studio-page';
import { StudioSelect } from './studio-select';
import { GalleryState, useStudioList } from './studio-gallery';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';
import { StudioSocialBind, socialPlatformLabels } from './studio-social-bind';
import { studioOverlayContainer } from './studio-overlay';
import { formatDateTime } from '@/lib/datetime';

type View = 'overview' | 'accounts' | 'records';
const nav = [{href:'/distribution',label:'发布准备',view:'overview'}, {href:'/distribution/accounts',label:'矩阵账号',view:'accounts'}, {href:'/distribution/records',label:'发布记录',view:'records'}];
export const publishStatusLabels: Record<PublishJobStatus,string> = {queued:'待发布',uploading:'上传中',transcoding:'处理中',publishing:'发布中',live:'已发布',awaiting_user:'待验证',failed:'发布失败',cancelled:'已取消'};
const accountLabels = {active:'可用',expired:'需重新授权',pending:'待完成绑定',banned:'不可用'};
const platformName = (value: string) => socialPlatformLabels[value as keyof typeof socialPlatformLabels] || '其他平台';

function Pending({ title, children }: {title:string; children:React.ReactNode}) {
  return <div className="studio-pending-feature"><div><h3>{title}</h3><StudioComingSoon/></div><p>{children}</p></div>;
}

export function StudioDistribution({ view = 'overview' }: { view?: View }) {
  const auth = useRequireAuth();
  return <StudioPage title="发行" description="让每一份作品，抵达它的观众。" className="studio-distribution-page">
    <nav className="studio-section-navigation" aria-label="发行导航">{nav.map(n => <Link href={n.href} key={n.href} aria-current={view === n.view ? 'page' : undefined}>{n.label}</Link>)}</nav>
    {auth === 'no-platform' ? <PlatformGateScreen/> : auth !== 'ok' ? <GalleryState loading/> : <ConfigProvider locale={zhCN} getPopupContainer={studioOverlayContainer} theme={{token:{colorPrimary:'#192229',borderRadius:8,fontFamily:'var(--ip-ui)'}}}>
      {view === 'accounts' ? <DistributionAccounts/> : view === 'records' ? <DistributionRecords/> : <>
        <section className="studio-distribution-intro"><div className="studio-distribution-icon"><Send size={32} strokeWidth={1.3}/></div><div><h2>把作品，带到更多人面前。</h2><p>管理发布账号，查看已有发布进度与结果。</p><div className="studio-inline-actions"><Link href="/distribution/accounts" className="ip-brand-button">管理矩阵账号<ArrowRight size={16}/></Link><Link href="/distribution/records" className="ip-brand-secondary">查看发布记录</Link></div></div></section>
        <div className="studio-distribution-features"><Pending title="画布作品发布">从画布选择成片，编辑发布文案，再投递到目标账号。</Pending><Pending title="发布草稿">保存未完成的发布准备，随时回来继续。</Pending><Pending title="定时与批量发布">按作品和账号安排发布节奏。</Pending><Pending title="音乐发行">音频作品的发行渠道与相关信息。</Pending></div>
        <div className="studio-workspace-callout"><Video size={21}/><div><strong>先把作品打磨好</strong><p>画布里的下载与成片制作可以继续使用。新的发行入口接通后，再从这里发布。</p></div><Link href="/projects">查看项目<ArrowRight size={16}/></Link></div>
      </>}
    </ConfigProvider>}
  </StudioPage>;
}

export function DistributionAccounts() {
  const list = useStudioList(SocialAccountApi.listSocialAccounts,true);
  const [query,setQuery] = useState(''), [platform,setPlatform] = useState('all'), [status,setStatus] = useState('all');
  const [binding,setBinding] = useState(false), [busy,setBusy] = useState<string>();
  const [removing,setRemoving] = useState<SocialAccount>(), [error,setError] = useStudioErrorState();
  const lock = useRef(false);
  const shown = list.data.filter(a => (platform === 'all' || a.platform === platform) && (status === 'all' || a.status === status) && `${a.displayName || ''} ${a.accountName} ${a.platformAccountId || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const act = async (account: SocialAccount, remove = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(account.id); setError('');
    try {
      if (remove) { await SocialAccountApi.unbindSocialAccount(account.id); list.setData(items => items.filter(a => a.id !== account.id)); setRemoving(undefined); }
      else { const updated = await SocialAccountApi.verifySocialAccount(account.id); list.setData(items => items.map(a => a.id === updated.id ? updated : a)); }
    } catch(e) { setError(e); }
    finally { lock.current = false; setBusy(undefined); }
  };
  return <section aria-label="矩阵账号">
    <div className="studio-gallery-panel-heading"><div><h2>矩阵账号</h2><p>本人已绑定的发布账号，在这里统一管理。</p></div><button className="ip-brand-button" onClick={() => setBinding(true)}>绑定账号<Users size={16}/></button></div>
    <div className="studio-page-toolbar"><StudioPageSearch label="搜索发布账号" placeholder="搜索昵称、备注或账号" value={query} onChange={setQuery}/><StudioSelect label="筛选账号平台" value={platform} onChange={setPlatform} options={[{value:"all",label:"全部平台"},...[...new Set(list.data.map(a => a.platform))].map(p => ({value:p,label:platformName(p)}))]}/><StudioSelect label="筛选账号状态" value={status} onChange={setStatus} options={[{value:"all",label:"全部状态"},...Object.entries(accountLabels).map(([value,label]) => ({value,label}))]}/><button className="studio-page-refresh" aria-label="刷新发布账号" disabled={list.loading} onClick={list.reload}><RefreshCw size={16}/></button></div>
    <div className="studio-page-result" aria-live="polite">{list.loading ? '正在读取账号…' : list.error ? '账号读取未完成' : `${shown.length} 个账号`}</div>
    {error && <div className="studio-gallery-action-error"><StudioErrorNotice error={error}/></div>}
    {list.loading ? <GalleryState loading/> : list.error ? <GalleryState error={list.error} retry={list.reload}/> : shown.length ? <div className="studio-account-list">{shown.map(a => <article key={a.id} className="studio-account-row"><div className="studio-account-identity"><div className="studio-account-avatar">{a.avatarUrl ? <img src={a.avatarUrl} alt="" referrerPolicy="no-referrer"/> : <Users size={22}/>}</div><div><strong title={a.displayName || a.accountName}>{a.displayName || a.accountName}</strong><span title={a.accountName}>{a.accountName}</span></div></div><span>{platformName(a.platform)}</span><span className={`studio-state is-${a.status}`}>{accountLabels[a.status]}</span><div className="studio-account-time"><small>最近验证</small><time>{a.lastVerifiedAt ? formatDateTime(a.lastVerifiedAt) : '尚未验证'}</time></div><div className="studio-inline-actions"><Button disabled={!!busy} loading={busy === a.id && !removing} onClick={() => void act(a)}>验证状态</Button><Button disabled={!!busy} onClick={() => setRemoving(a)}>解绑</Button></div></article>)}</div> : <GalleryState><Users size={30}/><h3>{query || platform !== 'all' || status !== 'all' ? '没有匹配的账号' : '还没有绑定发布账号'}</h3><p>绑定账号后，可在这里查看平台与授权状态。</p></GalleryState>}
    <p className="studio-workspace-hint">账号由本人统一管理，与已有带货应用共用。画布成片投递<StudioComingSoon className="is-inline"/></p>
    {binding && <StudioSocialBind onClose={() => { setBinding(false); list.reload(); }} onBound={() => list.reload()}/>}
    <Modal open={!!removing} title="解绑发布账号" getContainer={studioOverlayContainer} confirmLoading={!!busy} closable={!busy} mask={{closable:!busy}} onCancel={() => !busy && setRemoving(undefined)} okText="确认解绑" onOk={() => removing && act(removing,true)}><p>解绑「{removing?.displayName || removing?.accountName}」后，将无法向此账号继续发布。已有发布记录会保留。</p>{error && <StudioErrorNotice error={error}/>}</Modal>
  </section>;
}

export function DistributionRecords() {
  const [page,setPage] = useState(0), [revision,setRevision] = useState(0), [items,setItems] = useState<PublishBatchSummary[]>([]);
  const [paging,setPaging] = useState({total:0,hasNext:false}), [loading,setLoading] = useState(true), [error,setError] = useStudioErrorState();
  const [selected,setSelected] = useState<PublishBatchSummary>();
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void PublishJobApi.listBatches({page,limit:20}).then(result => { if(active) {setItems(result.data);setPaging({total:result.pagination.total,hasNext:result.pagination.hasNext});} }).catch(e => active && setError(e)).finally(() => active && setLoading(false));
    return () => {active=false;};
  },[page,revision,setError]);
  return <section aria-label="发布记录"><div className="studio-gallery-panel-heading"><div><h2>发布记录</h2><p>当前账号的全部发布批次，包含已有带货应用的记录。</p></div><button className="studio-page-refresh" aria-label="刷新发布记录" disabled={loading} onClick={() => setRevision(n => n+1)}><RefreshCw size={16}/></button></div>
    {loading ? <GalleryState loading/> : error ? <GalleryState error={error} retry={() => setRevision(n => n+1)}/> : items.length ? <div className="studio-batch-list">{items.map(b => <button key={b.projectId} className="studio-batch-row" onClick={() => setSelected(b)}><div><strong title={b.displayTitle}>{b.displayTitle}</strong><span>{b.platforms.map(platformName).join('、')} · {b.totalJobs} 条发布</span></div><div className="studio-batch-states">{Object.entries(b.statusCounts).filter(([,n]) => !!n).map(([s,n]) => <span key={s} className={`studio-state is-${s}`}>{publishStatusLabels[s as PublishJobStatus]} {n}</span>)}</div><time>{formatDateTime(b.lastCreatedAt)}</time><ArrowRight size={18}/></button>)}</div> : <GalleryState><Send size={30}/><h3>还没有发布记录</h3><p>平台实际受理的任务会出现在这里。下载作品不会被记为已发布。</p></GalleryState>}
    <footer className="studio-record-pagination"><span>{loading || error ? '' : `共 ${paging.total} 个批次`}</span><Button disabled={loading || page === 0} onClick={() => setPage(p => p-1)}>上一页</Button><span>{page+1}</span><Button disabled={loading || !!error || !paging.hasNext} onClick={() => setPage(p => p+1)}>下一页</Button></footer>
    <Pending title="发布草稿记录">草稿保存尚未接通，不会混入平台任务。</Pending>
    {selected && <DistributionBatch key={selected.projectId} batch={selected} onClose={() => setSelected(undefined)}/>}
  </section>;
}

function DistributionBatch({batch,onClose}:{batch:PublishBatchSummary;onClose:()=>void}) {
  const load = useRef(() => PublishJobApi.listPublishJobs({projectId:batch.projectId}));
  const jobs = useStudioList(load.current,true);
  return <Modal open title={batch.displayTitle} footer={null} onCancel={onClose} width={820} getContainer={studioOverlayContainer} className="studio-batch-modal"><p className="studio-workspace-hint">按发布账号查看实际进度与结果。</p><Button icon={<RefreshCw size={15}/>} disabled={jobs.loading} onClick={jobs.reload}>刷新进度</Button>{jobs.loading ? <GalleryState loading/> : jobs.error ? <GalleryState error={jobs.error} retry={jobs.reload}/> : jobs.data.map(job => <DistributionJob key={job.id} job={job}/>)}{!jobs.loading && !jobs.error && !jobs.data.length && <p>暂时没有可读取的发布任务。</p>}</Modal>;
}
function DistributionJob({job}:{job:PublishJob}) {
  const url = job.externalUrl && /^https?:\/\//i.test(job.externalUrl) ? job.externalUrl : undefined;
  return <article className="studio-job-row"><div><strong>{job.platformName || platformName(job.platformId)}</strong><span className={`studio-state is-${job.status}`}>{publishStatusLabels[job.status]}</span><time>{formatDateTime(job.updatedAt)}</time></div><p>{job.title || '未命名作品'}</p>{job.errorMessage && <p className="studio-job-error">{job.errorMessage}</p>}{job.status === 'awaiting_user' && <p>请在原发布入口完成平台验证。这里直接处理<StudioComingSoon className="is-inline"/></p>}{job.status === 'live' && url && <a href={url} target="_blank" rel="noopener noreferrer">查看平台作品<ExternalLink size={14}/></a>}</article>;
}
