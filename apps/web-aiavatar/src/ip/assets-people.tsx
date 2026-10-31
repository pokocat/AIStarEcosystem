"use client";
// 新版资产页的「人物」：我的 IP（数字人）、资产库里的角色、授权给我的明星形象，放在一起看。
// 第一张卡就是新建：用照片建 = 在资产库里建一个角色（正脸做主图，其余照片一并存成它的图）；
// 录一段视频建 = 原来的真人复刻流程（录视频 + 本人刷脸确认 + 登记授权），真人只走这一条路。
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Dropdown, Input, Modal } from 'antd';
import { ChevronDown, Image as ImageIcon, Plus, Search, ShieldCheck, UserRound, Video } from 'lucide-react';
import type { IpSavedAsset, LibraryFolder, LibraryObject } from '@ai-star-eco/types';
import { addLibraryVersion, createLibraryObject, libraryObjects, mainLibraryVersion } from '@/canvas-bridge/asset-library';
import { studioHref, useHubData } from '@/components/hub/data';
import { AssetApi, AvatarApi, LicenseApi } from '@/proto/api';
import type { Avatar, License, StarGrant } from '@/proto/data';
import { AssetThumb } from './asset-thumb';
import { AI_LIBRARY } from './assets-hub-shared';
import { LibraryAssetEditor } from './library-asset-editor';
import { LibraryReferencePicker } from './library-reference-picker';
import { StudioErrorNotice, useStudioApp, useStudioErrorState } from './studio-errors';
import { studioOverlayContainer } from './studio-overlay';

type PersonSource = 'ip' | 'role' | 'grant';
type Person = {
  id: string; name: string; description: string; real: boolean; verified: boolean; source: PersonSource;
  image?: { src?: string | null; storageKey?: string }; meta: string; tag?: { label: string; tone?: 'ok' | 'star' };
  href?: string; object?: LibraryObject;
};
const SOURCE_OPTIONS: { key: 'all' | PersonSource; label: string }[] = [
  { key: 'all', label: '全部来源' }, { key: 'ip', label: '我的 IP' }, { key: 'role', label: '角色' }, { key: 'grant', label: '授权给我' },
];

/** 真人且本人刷脸确认过、授权仍有效：卡片左下角给一个盾牌。 */
export function verifiedReal(avatar: Avatar, license?: License) {
  return avatar.path === 'real' && license?.status === 'active' && license.verifyMethod === 'liveness';
}

export function AssetsPeople({ library, folders }: { library: string; folders: LibraryFolder[] }) {
  const { message } = useStudioApp();
  const [keyword, setKeyword] = useState('');
  const [kind, setKind] = useState<'all' | 'virtual' | 'real'>('all');
  const [source, setSource] = useState<'all' | PersonSource>('all');
  const [revision, setRevision] = useState(0);
  const [roles, setRoles] = useState<LibraryObject[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useStudioErrorState();
  const [editing, setEditing] = useState<LibraryObject[]>();
  const [creating, setCreating] = useState(false);
  const isAi = library === AI_LIBRARY;
  const inFolder = library !== 'all' && !isAi;
  // 数字人和明星授权不在资产库里，只在「全部」里出现；自己建的库里只有角色。
  const avatars = useHubData<Avatar[]>(() => AvatarApi.list('mine'), [], [revision], !inFolder && !isAi);
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [revision], !inFolder && !isAi);
  const grants = useHubData<StarGrant[]>(() => AssetApi.starGrants(), [], [revision], !inFolder && !isAi);
  const epoch = useRef(0);
  useEffect(() => {
    if (isAi) { setRoles([]); setRolesLoading(false); return; }
    const id = ++epoch.current;
    setRolesLoading(true); setRolesError('');
    // 角色一般不多，一次读完（每页 24 个，最多读 10 页）。
    const readAll = async () => {
      const all: LibraryObject[] = [];
      for (let page = 0; page < 10; page++) {
        const r = await libraryObjects({ kind: 'character', folder: inFolder ? library : 'all', page });
        all.push(...r.items);
        if (!r.hasMore) break;
      }
      return all;
    };
    readAll().then(list => id === epoch.current && setRoles(list)).catch(e => id === epoch.current && setRolesError(e))
      .finally(() => id === epoch.current && setRolesLoading(false));
    return () => { epoch.current++; };
  }, [library, isAi, inFolder, revision, setRolesError]);

  const licenseOf = new Map(licenses.data.filter(l => l.char).map(l => [l.char as string, l]));
  const people: Person[] = [
    ...(inFolder || isAi ? [] : avatars.data.map((a): Person => ({
      id: a.id, name: a.name, description: a.tagline || a.archetype || a.def?.设定语 || '', real: a.path === 'real',
      verified: verifiedReal(a, licenseOf.get(a.id)), source: 'ip', image: { src: a.imageUrl }, href: `/assets/${encodeURIComponent(a.id)}`,
      meta: [a.voiceName ? '有声音' : '', a.status === 'draft' ? '草稿' : ''].filter(Boolean).join(' · '),
      tag: a.path === 'real' ? { label: '真人', tone: 'ok' } : undefined,
    }))),
    ...roles.map((o): Person => {
      const main = mainLibraryVersion(o);
      return {
        id: o.id, name: o.name, description: o.description, real: false, verified: false, source: 'role', object: o,
        image: main ? { src: main.url, storageKey: main.storageKey } : undefined,
        meta: o.versions.length ? `${o.versions.length} 张图` : '还没有图', tag: o.sources.length ? { label: '剧本提取' } : undefined,
      };
    }),
    ...(inFolder || isAi ? [] : grants.data.filter(g => g.status === 'authorized').map((g): Person => ({
      id: g.id, name: g.starName, description: [g.category, g.scenes.length ? `可用于${g.scenes.join('、')}` : ''].filter(Boolean).join(' · '),
      real: true, verified: false, source: 'grant', image: { src: g.starAvatar }, href: `/stars/${encodeURIComponent(g.id)}`,
      meta: g.expireDate ? `有效期至 ${g.expireDate}` : '', tag: { label: '授权给我', tone: 'star' },
    }))),
  ];
  const needle = keyword.trim().toLowerCase();
  const shown = people.filter(p => (kind === 'all' || (kind === 'real') === p.real) && (source === 'all' || p.source === source)
    && (!needle || `${p.name} ${p.description}`.toLowerCase().includes(needle)));
  const loading = rolesLoading || (!inFolder && !isAi && (avatars.loading || grants.loading));
  const errors = [rolesError, inFolder || isAi ? '' : avatars.error || '', inFolder || isAi ? '' : grants.error || ''].filter(Boolean);
  const filtered = !!needle || kind !== 'all' || source !== 'all';

  if (isAi) return <div className="assets-empty"><h3>AI 生成里没有人物</h3><p>这里只放做出来的图片、视频和音频。人物在「全部」里。</p></div>;
  return <div className="assets-people">
    <div className="assets-toolbar">
      <Input className="assets-search" prefix={<Search size={15}/>} allowClear aria-label="搜索人物" placeholder="搜索名字或设定" value={keyword} onChange={e => setKeyword(e.target.value)}/>
      <div className="assets-seg" role="group" aria-label="人物类型">
        {([['all', '全部'], ['virtual', '虚拟形象'], ['real', '真人']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {!inFolder && <Dropdown trigger={['click']} getPopupContainer={studioOverlayContainer} menu={{ items: SOURCE_OPTIONS.map(o => ({ key: o.key, label: o.label })), selectable: true, selectedKeys: [source], onClick: ({ key }) => setSource(key as typeof source) }}>
        <button type="button" className="assets-select" aria-label="按来源筛选人物">{SOURCE_OPTIONS.find(o => o.key === source)?.label}<ChevronDown size={14}/></button>
      </Dropdown>}
      <span className="assets-toolbar-gap"/>
      <span className="assets-count" aria-live="polite">{loading ? '正在读取…' : `${shown.length} 个人物`}</span>
    </div>
    {errors.map((e, i) => <p key={i} className="assets-notice"><StudioErrorNotice error={e}/><Button size="small" onClick={() => setRevision(n => n + 1)}>重新读取</Button></p>)}
    <ul className="assets-people-grid">
      {!filtered && <li className="assets-person-new">
        <div><strong>新建人物</strong>
          <button type="button" onClick={() => setCreating(true)}><ImageIcon size={15}/>用照片建</button>
          <Link href={studioHref('#/create/real')}><Video size={15}/>录一段视频建</Link>
        </div>
      </li>}
      {loading && !shown.length ? Array.from({ length: 4 }, (_, i) => <li key={`s${i}`}><span className="assets-skeleton assets-person-cover"/></li>)
        : shown.map(p => <li key={`${p.source}:${p.id}`}><PersonCard person={p} onOpen={() => p.object && setEditing([p.object])}/></li>)}
    </ul>
    {!loading && !shown.length && filtered && <div className="assets-empty"><h3>没有找到</h3><p>换个名字或筛选试试。</p><Button onClick={() => { setKeyword(''); setKind('all'); setSource('all'); }}>清除筛选</Button></div>}
    {editing && <LibraryAssetEditor assets={editing} folders={folders} onClose={() => { setEditing(undefined); setRevision(n => n + 1); }} onChange={() => setRevision(n => n + 1)}/>}
    <NewPersonDialog open={creating} folderId={inFolder ? library : undefined} onClose={() => setCreating(false)}
      onCreated={o => { setCreating(false); message.success(`已建好「${o.name}」`); setRevision(n => n + 1); setEditing([o]); }}/>
  </div>;
}

function PersonCard({ person: p, onOpen }: { person: Person; onOpen: () => void }) {
  const cover = <span className="assets-person-cover">
    {p.image?.src || p.image?.storageKey ? <AssetThumb kind="image" src={p.image.src || undefined} storageKey={p.image.storageKey}/> : <span className="assets-person-blank"><UserRound size={40} strokeWidth={1.1}/></span>}
    {p.verified && <span className="assets-person-shield" role="img" aria-label="本人已刷脸确认" title="本人已刷脸确认"><ShieldCheck size={14}/></span>}
  </span>;
  const body = <>{cover}<span className="assets-person-text"><strong>{p.name}</strong><small>{p.description || '还没写设定'}</small></span>
    <span className="assets-person-meta"><span>{p.meta}</span>{p.tag && <span className={`assets-tag${p.tag.tone ? ` is-${p.tag.tone}` : ''}`}>{p.tag.label}</span>}</span></>;
  return p.href ? <Link className="assets-person" href={p.href} aria-label={`查看 ${p.name}`}>{body}</Link>
    : <button type="button" className="assets-person" aria-label={`查看 ${p.name}`} onClick={onOpen}>{body}</button>;
}

type ShotKey = 'front' | 'left' | 'right' | 'close';
const SHOTS: { key: ShotKey; label: string; optional: boolean; icon: typeof UserRound }[] = [
  { key: 'front', label: '正脸', optional: false, icon: UserRound }, { key: 'left', label: '左侧脸', optional: true, icon: UserRound },
  { key: 'right', label: '右侧脸', optional: true, icon: UserRound }, { key: 'close', label: '近景特写', optional: true, icon: ImageIcon },
];
type Shot = { storageKey: string; url: string };

/** 用照片建人物：名字 + 正脸（其余可选），照片从资产库里选（新照片在框里上传进资产库）。 */
export function NewPersonDialog({ open, folderId, onClose, onCreated }: { open: boolean; folderId?: string; onClose: () => void; onCreated: (object: LibraryObject) => void }) {
  const [name, setName] = useState('');
  const [shots, setShots] = useState<Partial<Record<ShotKey, Shot>>>({});
  const [agreed, setAgreed] = useState(false);
  const [picking, setPicking] = useState<ShotKey>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useStudioErrorState();
  // 建好了对象、加图时失败：重试只补没加上的图，不再建第二个人物（§8.0.1 ⑨）。
  const created = useRef<{ object: LibraryObject; added: string[] }>(undefined);
  useEffect(() => { if (open) { setName(''); setShots({}); setAgreed(false); setError(''); created.current = undefined; } }, [open, setError]);
  const pick = (assets: IpSavedAsset[]) => {
    const a = assets[0];
    if (picking && a?.kind === 'image' && a.data.storageKey) { const key = picking; setShots(old => ({ ...old, [key]: { storageKey: a.data.storageKey as string, url: a.data.dataUrl } })); }
    return Promise.resolve();
  };
  const create = async () => {
    const front = shots.front;
    if (!front || !name.trim()) return;
    setBusy(true); setError('');
    try {
      const done = created.current || { object: await createLibraryObject({ name: name.trim(), kind: 'character', description: '', folderId }), added: [] };
      created.current = done;
      let object = done.object;
      for (const s of SHOTS) {
        const shot = shots[s.key];
        if (!shot || done.added.includes(shot.storageKey)) continue;
        object = await addLibraryVersion(done.object.id, shot.storageKey, s.key === 'front');
        done.added.push(shot.storageKey);
      }
      created.current = undefined;
      onCreated(object);
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  };
  const missing = !name.trim() ? '先写个名字' : !shots.front ? '还差一张正脸' : !agreed ? '勾选下面的确认' : '';
  return <Modal open={open} title="新建人物" width={720} footer={null} getContainer={studioOverlayContainer} className="assets-person-dialog" onCancel={() => !busy && onClose()} destroyOnHidden>
    <div className="assets-person-form">
      <label className="assets-field"><span>名字</span><Input aria-label="人物名字" placeholder="例如：唐唐" value={name} maxLength={40} onChange={e => setName(e.target.value)}/></label>
      <div className="assets-field"><span>照片</span>
        <div className="assets-shots">{SHOTS.map(s => {
          const shot = shots[s.key], Icon = s.icon;
          return <div key={s.key} className="assets-shot">
            <button type="button" className="assets-shot-slot" aria-label={shot ? `换一张${s.label}` : `从资产库选${s.label}`} onClick={() => setPicking(s.key)} disabled={busy}>
              {shot ? <><AssetThumb kind="image" src={shot.url} storageKey={shot.storageKey}/><span className="assets-shot-change">换一张</span></>
                : <><Icon size={28} strokeWidth={1.3}/><span className="assets-shot-badge"><Plus size={13} strokeWidth={2}/></span></>}
            </button>
            <small>{s.label}{s.optional && <i>可选</i>}</small>
          </div>;
        })}</div>
      </div>
      <label className="assets-consent"><Checkbox checked={agreed} onChange={e => setAgreed(e.target.checked)}/>我确认有权使用这些照片</label>
      {error && <p className="assets-form-error"><StudioErrorNotice error={error}/></p>}
      <footer><span className="assets-person-missing">{missing}</span><Button onClick={onClose} disabled={busy}>取消</Button><Button type="primary" loading={busy} disabled={!!missing} onClick={() => void create()}>创建人物</Button></footer>
    </div>
    {picking && <LibraryReferencePicker open mediaType="image" upload people={false} library={folderId} max={1} title={`选${SHOTS.find(s => s.key === picking)?.label}`} intro="从资产库里选一张；新照片点「上传到这个库」。" onClose={() => setPicking(undefined)} onAssets={pick}/>}
  </Modal>;
}
