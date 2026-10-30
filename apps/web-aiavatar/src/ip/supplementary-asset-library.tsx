"use client";
import { StudioErrorNotice } from './studio-errors';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Select } from 'antd';
import { ArrowUpRight, AudioLines, Mic, RefreshCw, Search, ShieldCheck, UserRound, Users } from 'lucide-react';
import type { Avatar, License, StarGrant, VoiceAsset } from '@/proto/data';
import { STATUS } from '@/proto/data';
import type { AsyncState } from '@/components/hub/data';
import { studioHref } from '@/components/hub/data';
import { studioWithReturn } from '@/shell/account-navigation';
import { licenseBadge } from '@/components/hub/asset-cards';
import { LibraryGridMotion } from './library-grid-motion';
import { LibraryWorkspace } from './library-workspace';

type Category = { value: string; label: string; icon: ReactNode; count?: number };
type CollectionItem = {
  id: string; name: string; href: string; category: string; type: string;
  image?: string | null; description: string; state?: string; detail: string;
  badge?: ReactNode; wave?: number[];
};
type CollectionProps = {
  title: string; description: string; navigationTitle: string; hint: string;
  categories: Category[]; items: CollectionItem[];
  typeLabel: string; typeOptions: { value: string; label: string }[];
  loadingCategories: string[]; errors: { category: string; message: string }[];
  refresh: () => void; actionHref: string; actionLabel: string;
  emptyDescription: string; voice?: boolean;
};

function AssetCollection(props: CollectionProps) {
  // 分类记在地址里：去声音工作室再返回，回到的是同一个分类。
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const asked = search.get('category');
  const [category, setCategory] = useState(asked && props.categories.some(c => c.value === asked) ? asked : 'all');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(0);
  const withCategory = (value: string) => {
    const params = new URLSearchParams(search.toString());
    if (value === 'all') params.delete('category'); else params.set('category', value);
    return `${pathname}${params.size ? `?${params}` : ''}`;
  };
  const changeCategory = (value: string) => { setCategory(value); setPage(0); router.replace(withCategory(value), { scroll: false }); };
  const out = (href: string) => studioWithReturn(href, withCategory(category));
  const loading = props.loadingCategories.some(c => category === 'all' || category === c);
  const errors = props.errors.filter(e => category === 'all' || category === e.category)
    .filter((e, i, all) => all.findIndex(other => other.message === e.message) === i);
  const filtered = query.trim() !== '' || category !== 'all' || type !== 'all';
  const needle = query.trim().toLocaleLowerCase();
  const matches = props.items.filter(item => (category === 'all' || item.category === category)
    && (type === 'all' || item.type === type)
    && `${item.name} ${item.id} ${item.description} ${item.detail}`.toLocaleLowerCase().includes(needle));
  const pages = Math.max(1, Math.ceil(matches.length / 24));
  const currentPage = Math.min(page, pages - 1);
  const visible = matches.slice(currentPage * 24, (currentPage + 1) * 24);
  const clear = () => { setQuery(''); setType('all'); changeCategory('all'); };

  return <LibraryWorkspace navigation={<aside className="library-folders" aria-label={`${props.title}分类导航`}>
    <div className="library-folders-heading"><h2>{props.navigationTitle}</h2></div>
    <nav>{props.categories.map(c => <button key={c.value} aria-current={category === c.value ? 'true' : undefined} onClick={() => changeCategory(c.value)}>{c.icon}<span>{c.label}</span><small>{c.count ?? '—'}</small></button>)}</nav>
    <p className="library-folder-hint">{props.hint}</p>
  </aside>}>
    <div className="library-mobile-folder"><Select aria-label={`${props.title}分类`} value={category} onChange={changeCategory} options={props.categories.map(c => ({ value: c.value, label: c.label }))}/></div>
    <div className="library-section-heading">
      <div><div className="library-section-title"><h2>{props.title}</h2></div><p>{props.description}</p></div>
      <div className="library-create-actions"><Link href={out(props.actionHref)} className="ip-brand-button">{props.actionLabel}<ArrowUpRight size={16}/></Link></div>
    </div>
    <div className="library-filter-bar">
      <Input prefix={<Search size={16}/>} allowClear aria-label={`搜索${props.title}`} placeholder={props.voice ? '搜索声音名称、语言或音色特点' : '搜索名称、登记号或形象描述'} value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/>
      <Select aria-label={props.typeLabel} value={type} onChange={v => { setType(v); setPage(0); }} options={props.typeOptions}/>
      <Button aria-label={`刷新${props.title}`} title={`刷新${props.title}`} icon={<RefreshCw size={16}/>} onClick={props.refresh}/>
    </div>
    <div className="library-result-bar"><span aria-live="polite">{loading ? `正在读取${props.title}…` : errors.length ? `已读取 ${matches.length} 项，部分内容暂不可用` : `${matches.length} 项${filtered ? '匹配资产' : '资产'}`}</span><span>{props.voice ? '进入声音工作室管理音色' : '打开形象查看设定、版本与授权'}</span></div>
    {errors.map(e => <div key={e.category} className="library-notice"><StudioErrorNotice error={e.message}/><Button size="small" onClick={props.refresh}>重新读取</Button></div>)}
    {loading ? <div className="library-grid library-loading" aria-label={`正在加载${props.title}`}>{Array.from({ length: 6 }, (_, i) => <div className="library-skeleton" key={i}><div/><span/><span/></div>)}</div>
      : !matches.length ? <div className="library-empty">{props.voice ? <Mic size={32}/> : <Users size={32}/>}<h3>{errors.length ? `${props.title}暂不可读取` : filtered ? '没有找到匹配资产' : `还没有${props.title}`}</h3><p>{errors.length ? '读取恢复后，这里的资产会重新显示。' : filtered ? '试试其他名称或筛选条件。' : props.emptyDescription}</p>{errors.length ? <Button onClick={props.refresh}>重新读取资产</Button> : filtered ? <Button onClick={clear}>清除筛选</Button> : <Link href={out(props.actionHref)} className="ip-brand-button">{props.actionLabel}<ArrowUpRight size={16}/></Link>}</div>
      : <LibraryGridMotion motionKey={`${props.title}-${category}-${query}-${type}-${currentPage}-${visible.map(i => i.id).join(',')}`}>
        {visible.map(item => <article key={item.id} className={`library-card ${props.voice ? 'library-voice-card' : 'library-avatar-card'}`} aria-label={`${props.title} ${item.name}`}>
          <Link href={out(item.href)} className="library-card-visual" aria-label={props.voice ? `管理声音 ${item.name}` : `查看形象 ${item.name}`}>
            {item.image ? <img src={item.image} alt={item.name} loading="lazy"/> : props.voice ? <div className="library-voice-visual"><Mic size={32} strokeWidth={1.2}/>{item.wave?.length ? <div className="library-voice-wave" aria-hidden="true">{item.wave.slice(0, 32).map((height, i) => <span key={i} style={{ height: `${Math.max(4, Math.min(48, height))}px` }}/>)}</div> : <span>专属音色</span>}</div> : <div className="library-object-placeholder library-object-character"><UserRound size={40} strokeWidth={1.1}/><span>尚未设置形象图</span></div>}
            <span className="library-type">{props.categories.find(c => c.value === item.category)?.label}</span>
          </Link>
          <div className="library-card-body"><Link className="library-card-title" href={out(item.href)}>{item.name}</Link><p className="library-card-description">{item.description || (props.voice ? '尚未填写音色特点' : '尚未填写形象描述')}</p>{item.badge && <div className="library-card-license">{item.badge}</div>}{item.state && <div className="library-card-state"><span className={item.type === 'finalized' || item.type === 'archived' || item.type === 'authorized' ? 'has-image' : ''}>{item.state}</span></div>}<p className="library-card-source" title={item.detail}>{item.detail}</p><p className="library-card-source">{item.id}</p></div>
          <div className="library-card-actions"><Link href={out(item.href)}>{props.voice ? '管理声音' : '查看形象'}<ArrowUpRight size={16}/></Link></div>
        </article>)}
      </LibraryGridMotion>}
    {!loading && matches.length > 0 && <div className="library-pagination"><span>每页 24 项</span><div><Button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</Button><span>{currentPage + 1} / {pages}</span><Button disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>下一页</Button></div></div>}
  </LibraryWorkspace>;
}

export function AvatarLibrary({ avatars, grants, licenses, refresh }: { avatars: AsyncState<Avatar[]>; grants: AsyncState<StarGrant[]>; licenses: AsyncState<License[]>; refresh: () => void }) {
  const avatarKnown = !avatars.loading && !avatars.error;
  const grantKnown = !grants.loading && !grants.error;
  const licenseKnown = !licenses.loading && !licenses.error;
  const licenseByChar = new Map(licenses.data.filter(l => l.char).map(l => [l.char, l]));
  const activeGrants = grants.data.filter(g => g.status === 'authorized');
  const items: CollectionItem[] = [
    ...avatars.data.map(a => ({ id: a.id, name: a.name, href: `/assets/${a.id}`, category: a.path, type: a.status, image: a.imageUrl, description: a.archetype || a.tagline, state: STATUS[a.status]?.label, detail: `V${a.versions || 1} · 更新于 ${a.updated}`, badge: a.path === 'real' && !licenseKnown ? <span className="library-unknown-license">{licenses.loading ? '授权信息读取中' : '授权信息暂不可用'}</span> : licenseBadge(a, licenseByChar.get(a.id) || null, licenseKnown) })),
    ...activeGrants.map(g => ({ id: g.id, name: g.starName, href: `/stars/${g.id}`, category: 'grant', type: 'authorized', image: g.starAvatar, description: [g.category, g.scenes.length ? `授权场景：${g.scenes.join(' / ')}` : '授权场景以约定为准'].filter(Boolean).join(' · '), state: '授权给我', detail: g.expireDate ? `有效期至 ${g.expireDate}` : '有效期以授权约定为准' })),
  ];
  return <AssetCollection title="人物形象" description="自建数字人与获授权形象，集中查看设定、版本与授权。" navigationTitle="形象来源" hint="按来源查找形象，打开卡片管理具体版本。" categories={[
    { value: 'all', label: '全部人物', icon: <Users size={17}/>, count: avatarKnown && grantKnown ? items.length : undefined },
    { value: 'ai', label: 'AI 原创', icon: <UserRound size={17}/>, count: avatarKnown ? avatars.data.filter(a => a.path === 'ai').length : undefined },
    { value: 'real', label: '真人形象', icon: <UserRound size={17}/>, count: avatarKnown ? avatars.data.filter(a => a.path === 'real').length : undefined },
    { value: 'grant', label: '明星授权', icon: <ShieldCheck size={17}/>, count: grantKnown ? activeGrants.length : undefined },
  ]} items={items} typeLabel="形象状态" typeOptions={[{ value: 'all', label: '全部形象状态' }, ...Object.values(STATUS).map(s => ({ value: s.key, label: `${s.label}${s.key === 'iterating' ? ' · 迭代' : s.key === 'refining' ? ' · 精修' : ''}` })), { value: 'authorized', label: '授权给我' }]} loadingCategories={[...(avatars.loading ? ['ai', 'real'] : []), ...(grants.loading ? ['grant'] : [])]} errors={[...(avatars.error ? [{ category: 'ai', message: `自建形象读取失败：${avatars.error}` }, { category: 'real', message: `自建形象读取失败：${avatars.error}` }] : []), ...(grants.error ? [{ category: 'grant', message: `明星授权读取失败：${grants.error}` }] : [])]} refresh={refresh} actionHref="/create" actionLabel="创建形象" emptyDescription="创建 AI 原创形象，或从一段视频开始建立自己的数字人。"/>;
}

export function VoiceLibrary({ voices, refresh }: { voices: AsyncState<VoiceAsset[]>; refresh: () => void }) {
  const known = !voices.loading && !voices.error;
  const languages = Array.from(new Set(voices.data.map(v => v.lang).filter(Boolean)));
  const categories = [
    { value: 'all', label: '全部声音', icon: <Mic size={17}/> },
    { value: 'clone', label: '克隆声', icon: <Mic size={17}/> },
    { value: 'design', label: '设计声', icon: <AudioLines size={17}/> },
    { value: 'preset', label: '预设音色', icon: <AudioLines size={17}/> },
  ].map(c => ({ ...c, count: known ? voices.data.filter(v => c.value === 'all' || v.kind === c.value).length : undefined }));
  return <AssetCollection voice title="专属声音" description="克隆声、设计声与已保存音色，集中查看并进入声音工作室管理。" navigationTitle="声音类型" hint="按音色来源分类，语言与音色特点可以直接搜索。" categories={categories} items={voices.data.map(v => ({ id: v.id, name: v.name, href: studioHref('#/voice'), category: v.kind, type: v.lang, description: [v.gender, v.lang, v.tone].filter(Boolean).join(' · '), detail: v.dur || '时长未记录', wave: v.wave }))} typeLabel="声音语言" typeOptions={[{ value: 'all', label: '全部语言' }, ...languages.map(lang => ({ value: lang, label: lang }))]} loadingCategories={voices.loading ? ['clone', 'design', 'preset'] : []} errors={voices.error ? [{ category: 'clone', message: `声音读取失败：${voices.error}` }, { category: 'design', message: `声音读取失败：${voices.error}` }, { category: 'preset', message: `声音读取失败：${voices.error}` }] : []} refresh={refresh} actionHref={studioHref('#/voice')} actionLabel="声音工作室" emptyDescription="录一段自己的声音，或创建适合角色的设计音色。"/>;
}
