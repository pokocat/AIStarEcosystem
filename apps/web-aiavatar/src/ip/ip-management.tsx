"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "antd";
import { ArrowRight, Camera, Check, Download, FileText, FolderOpen, Grid2X2, Image as ImageIcon, List, LoaderCircle, Pencil, Plus, RefreshCw, Search, Sparkles, UserRound, UsersRound, Volume2, X } from "lucide-react";
import type { IpProject } from "@ai-star-eco/types";
import type { StudioIpAsset, StudioIpAssetRole, StudioVoiceCatalog } from "@ai-star-eco/types/ip-studio-workflow";
import type { Avatar } from "@/proto/data";
import { AvatarApi, USE_MOCK } from "@/proto/api";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { SignedAudio } from "@/canvas-bridge/signed-audio";
import { classifyStudioIpAsset, listStudioIpAssets, studioVoiceProfiles } from "@/canvas-bridge/studio-api";
import { editableIpAssetRoles, ipAssetIdentity, ipAssetRole, ipAssetRoles } from "@/canvas-bridge/studio-ip-library";
import { IpStudioApi } from "@/ip/api";
import { studioEntryHref } from "./studio-entry";
import { filterManagedIps, ipStatusLabels, managedIpDescription, managedIpImages, managedIpStatus, managedIpTags, mergeManagedIps, type IpStatusFilter, type ManagedIp } from "./ip-management-data";

const tabs = ["概览", "角色设定", "形象视图", "内容资产"] as const;
type DetailTab = typeof tabs[number];
type EditDraft = { name: string; tagline: string; description: string; age: string; temperament: string; use: string; personality: string; clothing: string };

export function IpManagement() {
  const router = useRouter();
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [assets, setAssets] = useState<StudioIpAsset[]>([]);
  const [voices, setVoices] = useState<StudioVoiceCatalog>();
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [assetError, setAssetError] = useState(""), [voiceError, setVoiceError] = useState("");
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState(""), [status, setStatus] = useState<IpStatusFilter>("all"), [tag, setTag] = useState(""), [order, setOrder] = useState("updated"), [view, setView] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string>(), [detailTab, setDetailTab] = useState<DetailTab>("形象视图"), [selectedAsset, setSelectedAsset] = useState<StudioIpAsset>();
  const [editing, setEditing] = useState<EditDraft>(), [saving, setSaving] = useState(false), [actionError, setActionError] = useState(""), [saved, setSaved] = useState(false), [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<{ project: IpProject; assetId: string; avatarId: string }>();
  const searchRef = useRef<HTMLInputElement>(null), createLock = useRef(false);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true); setError(""); setAssetError(""); setVoiceError("");
    void Promise.allSettled([AvatarApi.list("mine"), listStudioIpAssets(), studioVoiceProfiles()]).then(([a, i, v]) => {
      if (!active) return;
      if (a.status === "fulfilled") setAvatars(a.value); else setError(a.reason instanceof Error ? a.reason.message : "IP 列表没有读取成功");
      if (i.status === "fulfilled") setAssets(i.value); else setAssetError(i.reason instanceof Error ? i.reason.message : "人物素材没有读取成功");
      if (v.status === "fulfilled") setVoices(v.value); else setVoiceError(v.reason instanceof Error ? v.reason.message : "人物声音没有读取成功");
      setLoading(false);
    });
    return () => { active = false; };
  }, [ready, revision]);
  useEffect(() => { if (ready && new URLSearchParams(window.location.search).get("focus") === "search") searchRef.current?.focus(); }, [ready]);
  const all = useMemo(() => mergeManagedIps(avatars, assets), [avatars, assets]);
  const shown = useMemo(() => filterManagedIps(all, query, status, tag, order), [all, query, status, tag, order]);
  const person = all.find(p => p.avatar.id === selectedId);
  const chosen = person?.assets.find(a => selectedAsset && ipAssetIdentity(a) === ipAssetIdentity(selectedAsset)) || person?.main;
  const performer = voices?.performers.find(p => p.avatarId === person?.avatar.id);
  const voice = voices?.profiles.find(v => v.avatarId === person?.avatar.id && v.voiceId === performer?.voiceId);
  const counts = (filter: IpStatusFilter) => all.filter(p => filter === "all" || managedIpStatus(p.avatar.status) === filter).length;
  const selectPerson = (id: string) => { setSelectedId(id); setSelectedAsset(undefined); setActionError(""); setSaved(false); };
  useEffect(() => {
    if (selectedId && !shown.some(p => p.avatar.id === selectedId)) { setSelectedId(undefined); setSelectedAsset(undefined); }
  }, [shown, selectedId]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape" && !editing && !creating) setSelectedId(undefined); };
    window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape);
  }, [editing, creating]);
  const beginEdit = () => {
    if (!person) return;
    const a = person.avatar;
    setActionError(""); setSaved(false);
    setEditing({ name: a.name, tagline: a.tagline || "", description: managedIpDescription(person), age: a.def?.年龄 || "", temperament: a.def?.气质 || "", use: a.def?.用途 || "", personality: (a.def?.性格 || []).join("、"), clothing: a.def?.服饰 || "" });
  };
  const save = async () => {
    if (!person || !editing || !editing.name.trim() || saving) return;
    const id = person.avatar.id;
    setSaving(true); setActionError("");
    try {
      const updated = await AvatarApi.patch(id, { name: editing.name.trim(), tagline: editing.tagline.trim(), def: { ...person.avatar.def, 设定语: editing.description.trim(), 年龄: editing.age.trim(), 气质: editing.temperament.trim(), 用途: editing.use.trim(), 性格: editing.personality.split(/[、,，]/).map(v => v.trim()).filter(Boolean), 服饰: editing.clothing.trim() } }) as Avatar;
      setAvatars(items => items.map(a => a.id === id ? updated : a));
      setEditing(undefined); setSaved(true);
    } catch (e) { setActionError(e instanceof Error ? e.message : "设定未保存，内容仍保留"); }
    finally { setSaving(false); }
  };
  const classify = async (asset: StudioIpAsset, role: StudioIpAssetRole) => {
    if (!asset.lookId || saving) return;
    setSaving(true); setActionError("");
    try {
      const updated = await classifyStudioIpAsset(asset.avatarId, asset.lookId, role);
      setAssets(items => items.map(a => ipAssetIdentity(a) === ipAssetIdentity(asset) ? updated : a));
      setSelectedAsset(updated);
    } catch (e) { setActionError(e instanceof Error ? e.message : "素材分类没有保存成功"); }
    finally { setSaving(false); }
  };
  const create = async () => {
    if (!person || createLock.current) return;
    if (pending && (pending.avatarId !== person.avatar.id || pending.assetId !== (chosen ? ipAssetIdentity(chosen) : ""))) {
      setActionError("上一张画布已创建但引用尚未保存，请先打开已有画布继续。"); return;
    }
    createLock.current = true; setCreating(true); setActionError("");
    try {
      const project = pending?.project || await IpStudioApi.createProject({ name: person.avatar.name + " · 形象创作" });
      setPending({ project, assetId: chosen ? ipAssetIdentity(chosen) : "", avatarId: person.avatar.id });
      if (chosen?.storageKey) {
        const nodeId = project.id + "-character";
        const metadata = { content: chosen.url, storageKey: chosen.storageKey, status: "success", studio: { kind: "ip", libraryAssetRole: ipAssetRole(chosen), libraryCharacterName: person.avatar.name, references: [{ avatarId: chosen.avatarId, version: chosen.version, storageKey: chosen.storageKey, lookId: chosen.lookId, role: "character" }] } };
        await IpStudioApi.updateProject(project.id, { baseDocVersion: project.docVersion, doc: { ...project.doc, nodes: [...project.doc.nodes.filter(n => n.id !== nodeId), { id: nodeId, type: "image", title: chosen.name, position: { x: 100, y: 120 }, width: 320, height: 400, metadata }] } });
      }
      router.push(studioEntryHref(project.id, "image"));
    } catch (e) { setActionError(e instanceof Error ? e.message : "画布引用没有保存成功，请重试"); }
    finally { setCreating(false); createLock.current = false; }
  };
  const exportSettings = () => {
    if (!person) return;
    const a = person.avatar;
    const text = "# " + a.name + "\n\n" + (a.tagline || "") + "\n\n## 角色设定\n\n" + managedIpDescription(person) + "\n\n" +
      Object.entries(a.def || {}).filter(([key]) => key !== "设定语").map(([key, value]) => "- " + key + "：" + (Array.isArray(value) ? value.join("、") : value)).join("\n") +
      "\n\n## 素材版本\n\n" + person.assets.map(s => "- " + ipAssetRoles[ipAssetRole(s)] + " · " + s.name + " · v" + s.version + (s.lookId ? " · " + s.lookId : "")).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const aLink = document.createElement("a"); aLink.href = url; aLink.download = a.name.replace(/[\\/:*?"<>|]/g, "_") + "角色设定.md"; aLink.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const image = (ip: ManagedIp, hero = false) => ip.main?.url ? <SignedImage src={ip.main.url} storageKey={ip.main.storageKey} alt={ip.avatar.name} loading={hero ? "eager" : "lazy"} /> : ip.avatar.imageUrl ? <SignedImage src={ip.avatar.imageUrl} alt={ip.avatar.name} loading="lazy" /> : <div className="ip-no-image"><UserRound size={hero ? 42 : 30} /><span>尚未设置主形象</span></div>;
  const section = (title: string, roles: StudioIpAssetRole[], icon: typeof Camera = Camera) => {
    const items = person?.assets.filter(a => roles.includes(ipAssetRole(a))) || [];
    const Icon = icon;
    return <section className="ip-detail-section"><header><h3><Icon size={17} aria-hidden="true" />{title}</h3><span>{items.length ? items.length + " 张参考" : "尚未归档"}</span></header>
      {items.length ? <div className={"ip-reference-strip" + (roles.includes("sheet") ? " ip-reference-sheet" : "")}>{items.map(asset => <button key={ipAssetIdentity(asset)} aria-label={asset.name || ipAssetRoles[ipAssetRole(asset)]} aria-pressed={!!chosen && ipAssetIdentity(chosen) === ipAssetIdentity(asset)} onClick={() => setSelectedAsset(asset)} disabled={creating}><SignedImage src={asset.url} storageKey={asset.storageKey} alt={asset.name} loading="lazy" /><span>{asset.name || ipAssetRoles[ipAssetRole(asset)]}</span></button>)}</div> : <p className="ip-detail-empty">{title}会在画布生成并归档后显示在这里。</p>}
    </section>;
  };
  if (authState === "no-platform") return <PlatformGateScreen />;
  if (!ready) return <div className="ip-brand-surface"><div className="ip-brand-state" role="status"><LoaderCircle className="ip-loading-icon" size={23} />正在打开 IP 管理…</div></div>;
  return <div className="ip-brand-surface ip-management">
    <main className="ip-management-main">
      <header className="ip-management-heading"><div><h1>IP 管理</h1><p>管理你的 IP 角色与内容资产，让每一个灵感持续生长。</p></div><Link className="ip-brand-button" href="/create"><Plus size={17} />创建 IP</Link></header>
      {USE_MOCK && <p className="ip-management-demo">演示模式 · 以下为示例数据</p>}
      <div className="ip-management-stats" aria-label="IP 资产概览">
        {[{ icon: UsersRound, value: all.length, label: "IP 总数" }, { icon: Sparkles, value: counts("active"), label: "进行中" }, { icon: ImageIcon, value: all.reduce((n, p) => n + managedIpImages(p), 0), label: "形象素材", unknown: !!assetError }, { icon: Volume2, value: voices?.performers.filter(p => !!p.voiceId).length || 0, label: "已绑定声音", unknown: !!voiceError }].map(s => <div key={s.label}><s.icon size={22} aria-hidden="true" /><section><strong>{loading || error || s.unknown ? "—" : s.value}</strong><span>{s.label}</span></section></div>)}
      </div>
      <div className="ip-management-toolbar"><label className="ip-management-search"><Search size={17} aria-hidden="true" /><input ref={searchRef} aria-label="搜索 IP 名称、标签或关键词" placeholder="搜索 IP 名称、标签或关键词…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button onClick={() => setQuery("")} aria-label="清除搜索"><X size={15} /></button>}</label><select aria-label="IP 排序" value={order} onChange={e => setOrder(e.target.value)}><option value="updated">最近更新</option><option value="name">名称排序</option><option value="images">素材最多</option></select><div className="ip-management-view"><button aria-label="网格视图" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 size={18} /></button><button aria-label="列表视图" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={19} /></button></div></div>
      <div className="ip-management-filters" aria-label="筛选 IP 状态">{Object.entries(ipStatusLabels).map(([key, label]) => <button key={key} aria-pressed={status === key} onClick={() => setStatus(key as IpStatusFilter)}>{label}<span>{loading || error ? "—" : counts(key as IpStatusFilter)}</span></button>)}<select aria-label="筛选 IP 标签" value={tag} onChange={e => setTag(e.target.value)}><option value="">全部标签</option>{[...new Set(all.flatMap(managedIpTags))].map(t => <option key={t}>{t}</option>)}</select><button className="ip-management-refresh" aria-label="刷新 IP 列表" disabled={loading || saving || creating} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} /></button></div>
      {loading ? <div className="ip-brand-state" role="status"><LoaderCircle className="ip-loading-icon" size={23} />正在读取你的 IP…</div> : error ? <div className="ip-brand-error" role="alert">{error}<button onClick={() => setRevision(v => v + 1)}>重新加载</button></div> : shown.length ? <div className={"ip-management-cards is-" + view + (person ? " has-detail" : "")}>{shown.map(ip => <button key={ip.avatar.id} className="ip-management-card" aria-label={"查看 IP " + ip.avatar.name} aria-pressed={person?.avatar.id === ip.avatar.id} disabled={creating} onClick={() => selectPerson(ip.avatar.id)}>
        <div className="ip-management-card-image">{image(ip)}<span className={"ip-status is-" + managedIpStatus(ip.avatar.status)}>{ipStatusLabels[managedIpStatus(ip.avatar.status)]}</span></div>
        <div className="ip-management-card-body"><h2>{ip.avatar.name}</h2><p>{ip.avatar.tagline || ip.avatar.archetype || "尚未填写角色简介"}</p><div className="ip-tags">{managedIpTags(ip).slice(0, 3).map(t => <span key={t}>{t}</span>)}</div><div className="ip-card-numbers"><span><strong>{assetError ? "—" : managedIpImages(ip)}</strong>形象素材</span><span><strong>{ip.avatar.counts?.video || 0}</strong>视频</span><span><strong>{ip.avatar.versions || 1}</strong>形象版本</span></div></div>
      </button>)}</div> : <div className="ip-brand-state"><UserRound size={30} /><h2>{all.length ? "没有找到符合条件的 IP" : "为你的第一个角色留一个位置"}</h2><p>{all.length ? "换个关键词，或清除当前筛选。" : "在画布里创作并归档形象，就能在这里管理角色、视角与设定。"}</p>{all.length ? <button className="ip-brand-text-button" onClick={() => { setQuery(""); setStatus("all"); setTag(""); }}>清除筛选</button> : <Link className="ip-brand-button" href="/create">开始创作<ArrowRight size={17} /></Link>}</div>}
      {assetError && !error && <div className="ip-brand-error" role="alert">形象素材：{assetError}<button onClick={() => setRevision(v => v + 1)}>重新读取</button></div>}
    </main>
    {person && <aside className="ip-management-detail" aria-label={person.avatar.name + "的 IP 详情"}>
      <button className="ip-detail-close" aria-label="关闭 IP 详情" disabled={creating} onClick={() => setSelectedId(undefined)}><X size={20} /></button>
      <div className="ip-detail-scroll">
        <header className="ip-detail-profile"><div className="ip-detail-portrait">{image(person, true)}</div><div><div className="ip-detail-name"><h2>{person.avatar.name}</h2><button aria-label="编辑角色设定" onClick={beginEdit} disabled={creating}><Pencil size={16} /></button></div><span className={"ip-status is-" + managedIpStatus(person.avatar.status)}>{ipStatusLabels[managedIpStatus(person.avatar.status)]}</span><p className="ip-detail-tagline">{person.avatar.tagline || "记录角色的第一句介绍"}</p><p>{managedIpDescription(person) || "尚未填写角色描述。可以编辑设定，记录身份、性格与故事。"}</p><div className="ip-tags">{managedIpTags(person).slice(0, 5).map(t => <span key={t}>{t}</span>)}</div></div></header>
        <div className="ip-detail-tabs" role="tablist" aria-label="IP 详情分类">{tabs.map((t, index) => <button key={t} role="tab" id={"ip-tab-" + index} tabIndex={detailTab === t ? 0 : -1} aria-selected={detailTab === t} aria-controls="ip-detail-content" onClick={() => setDetailTab(t)} onKeyDown={e => {
          const next = e.key === "ArrowRight" ? (index + 1) % tabs.length : e.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : undefined;
          if (next !== undefined) { e.preventDefault(); setDetailTab(tabs[next]); document.getElementById("ip-tab-" + next)?.focus(); }
        }}>{t}</button>)}</div>
        <div id="ip-detail-content" role="tabpanel" aria-labelledby={"ip-tab-" + tabs.indexOf(detailTab)}>
          {(detailTab === "形象视图" || detailTab === "概览") && <>{section("角色视图", ["main", "front", "side", "back", "three-view", "portrait"])}{section("表情库", ["expression"])}{detailTab === "形象视图" && <>{section("人物设定图", ["sheet"], FileText)}{section("造型与细节", ["look", "detail"])}{person.assets.some(a => ipAssetRole(a) === "history") && <details className="ip-detail-history"><summary>历史主形象 · {person.assets.filter(a => ipAssetRole(a) === "history").length} 个版本</summary>{section("历史主形象", ["history"])}</details>}</>}</>}
          {(detailTab === "概览" || detailTab === "角色设定" || detailTab === "形象视图") && <section className="ip-detail-section"><header><h3><Grid2X2 size={17} />基础信息</h3><button className="ip-brand-text-button" onClick={beginEdit} disabled={creating}><Pencil size={14} />编辑设定</button></header><dl className="ip-detail-fields">{[["姓名", person.avatar.name], ["年龄", person.avatar.def?.年龄 || "未填写"], ["来源", person.avatar.path === "real" ? "真人形象" : "AI 原创"], ["气质", person.avatar.def?.气质 || "未填写"], ["性格", person.avatar.def?.性格?.join("、") || "未填写"], ["用途", person.avatar.def?.用途 || "未填写"], ["服饰", person.avatar.def?.服饰 || "未填写"], ["核心设定", managedIpDescription(person) || "未填写"]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>}
          {(detailTab === "角色设定" || detailTab === "概览") && <section className="ip-detail-section"><header><h3><Volume2 size={17} />人物声音</h3></header>{voiceError ? <div className="ip-brand-error" role="alert">{voiceError}<button onClick={() => setRevision(v => v + 1)}>重新读取</button></div> : voice ? <><p>{voice.name} · v{voice.version} · {voice.speaker}</p><SignedAudio controls src={voice.demoUrl} storageKey={voice.demoStorageKey} /></> : <p className="ip-detail-empty">尚未绑定声音。在画布配音后，可保存为此人物的默认声音。</p>}</section>}
          {detailTab === "内容资产" && <><section className="ip-detail-section"><header><h3><FolderOpen size={17} />已归档素材</h3><span>{person.assets.length} 个版本</span></header>{person.assets.length ? <div className="ip-content-assets">{person.assets.map(asset => <button key={ipAssetIdentity(asset)} aria-pressed={!!chosen && ipAssetIdentity(chosen) === ipAssetIdentity(asset)} onClick={() => setSelectedAsset(asset)}><SignedImage src={asset.url} storageKey={asset.storageKey} alt={asset.name} loading="lazy" /><div><strong>{asset.name}</strong><span>{ipAssetRoles[ipAssetRole(asset)]} · v{asset.version}</span></div></button>)}</div> : <p className="ip-detail-empty">尚未归档形象素材。</p>}</section><Link href={"/assets/" + encodeURIComponent(person.avatar.id)} className="ip-detail-asset-link">查看完整数字资产与衍生作品<ArrowRight size={17} /></Link></>}
          {chosen && chosen.lookId && <section className="ip-detail-selected"><span>当前参考：{chosen.name} · v{chosen.version}</span><label>素材类别<select aria-label="当前素材类别" disabled={saving || creating} value={ipAssetRole(chosen)} onChange={e => void classify(chosen, e.target.value as StudioIpAssetRole)}>{editableIpAssetRoles.map(role => <option key={role} value={role}>{ipAssetRoles[role]}</option>)}</select></label></section>}
        </div>
      </div>
      <footer className="ip-detail-actions">{actionError && <p role="alert">{actionError}</p>}{saved && <p className="ip-detail-saved" role="status"><Check size={14} />角色设定已保存</p>}{pending && <Link href={"/projects/" + encodeURIComponent(pending.project.id)} onClick={() => setPending(undefined)}>打开已创建的画布继续</Link>}<div><button className="ip-brand-secondary" onClick={beginEdit} disabled={creating}><Pencil size={17} />编辑设定</button><button className="ip-brand-button" onClick={() => void create()} disabled={creating || saving}>{creating ? <LoaderCircle className="ip-loading-icon" size={17} /> : <Sparkles size={17} />}{creating ? "正在打开" : "生成形象"}</button><button className="ip-brand-secondary" onClick={exportSettings} disabled={creating}><Download size={17} />导出设定</button></div><small>免费进入画布。生成前在节点里确认模型、参考与积分。</small></footer>
    </aside>}
    <Modal open={!!editing} title="编辑角色设定" onCancel={saving ? undefined : () => { setEditing(undefined); setActionError(""); }} closable={!saving} mask={{ closable: !saving }} footer={null} width={620} className="ip-management-editor" destroyOnHidden>
      {editing && <form onSubmit={e => { e.preventDefault(); void save(); }}><div className="ip-edit-fields"><label>角色名称<input required maxLength={80} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label><label>一句话简介<input maxLength={200} value={editing.tagline} onChange={e => setEditing({ ...editing, tagline: e.target.value })} /></label><label className="ip-edit-wide">核心设定<textarea rows={5} maxLength={8000} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></label>{([["age", "年龄"], ["temperament", "气质"], ["use", "用途"], ["personality", "性格（用顿号分隔）"], ["clothing", "服饰"]] as const).map(([key, label]) => <label key={key}>{label}<input maxLength={300} value={editing[key]} onChange={e => setEditing({ ...editing, [key]: e.target.value })} /></label>)}</div>{actionError && <p className="ip-brand-error" role="alert">{actionError}</p>}<div className="ip-edit-footer"><button type="button" className="ip-brand-secondary" disabled={saving} onClick={() => { setEditing(undefined); setActionError(""); }}>取消</button><button className="ip-brand-button" disabled={saving || !editing.name.trim()}>{saving && <LoaderCircle size={16} className="ip-loading-icon" />}{saving ? "正在保存" : "保存设定"}</button></div></form>}
    </Modal>
  </div>;
}
