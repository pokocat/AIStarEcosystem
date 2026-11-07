"use client";
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutTemplate, Loader2, Settings2, Image } from "lucide-react";
import type { IpTemplate } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { isOperatorRole, useIdentity } from "@/proto/api";
import { templateAvailability } from "@/canvas-bridge/template-api";
import { IpStudioApi } from "./api";
import { CanvasCoverEditor } from "./canvas-cover-editor";
import { StudioTemplateUse } from "./studio-template-use";
import { StudioPage, StudioPageFilters } from "./studio-page";
import { GallerySearch, GalleryState, useStudioList } from "./studio-gallery";
import { InspirationWall } from "./inspiration-wall";
import { inspirationOrder, templateKind, templateSearchText } from "./template-facts";

type MarketTab = "all" | "video" | "image" | "official" | "personal";
const CASE_TABS: readonly MarketTab[] = ["all", "video", "image"];

export function StudioTemplateMarket() {
  const router = useRouter();
  const authState = useRequireAuth();
  const identity = useIdentity();
  const templates = useStudioList(IpStudioApi.listTemplates, authState === "ok");
  const examples = useStudioList(IpStudioApi.listDemoExamples, authState === "ok");
  const [picked, setPicked] = useState<MarketTab>();
  const [query, setQuery] = useState("");
  const [editingCover, setEditingCover] = useState<IpTemplate>();
  const [usingTemplate, setUsingTemplate] = useState<IpTemplate>();
  const [changing, setChanging] = useState<string>();
  const changingRef = useRef(false);
  const [error, setError] = useStudioErrorState();
  const matches = (t: IpTemplate) => templateSearchText(t).includes(query.trim().toLocaleLowerCase());
  const official = templates.data.filter(t => t.visibility !== "personal" && t.enabled !== false);
  const personal = templates.data.filter(t => t.visibility === "personal");
  const cases = examples.data.filter(t => t.enabled !== false);
  // 默认先看做好的案例；还没有案例（或读不出来）时，不让人对着一个空页面，直接给官方模板。
  const tab: MarketTab = picked ?? (!examples.loading && !cases.length ? "official" : "all");
  const isCases = CASE_TABS.includes(tab);
  const inTab = tab === "personal" ? personal : tab === "official" ? official : tab === "all" ? cases : cases.filter(t => templateKind(t) === tab);
  // 新发布的在前（用户 2026-11-06 要求）。
  const items = inspirationOrder(inTab.filter(matches));
  const noun = isCases ? "案例" : "模板";

  const catalogue = isCases ? examples : templates;
  const changeAvailability = async (template: IpTemplate) => {
    if (changingRef.current) return;
    changingRef.current = true; setChanging(template.id); setError("");
    const enabled = template.enabled === false;
    try {
      await templateAvailability(template.id, enabled);
      templates.setData(items => items.map(t => t.id === template.id ? { ...t, enabled } : t));
    } catch (e) { setError(e); }
    finally { changingRef.current = false; setChanging(undefined); }
  };
  if (authState === "no-platform" || templates.notEnrolled || examples.notEnrolled) return <PlatformGateScreen />;
  const heading = { title: "灵感", description: "看效果，再做同款。" };
  if (authState !== "ok") return <StudioPage {...heading}><GalleryState loading/></StudioPage>;

  return <StudioPage {...heading} className="studio-gallery-page studio-template-market" actions={isOperatorRole(identity?.operatorRole) ? <Link className="inspiration-admin-link" href="/projects/demos"><Settings2 size={15}/>官方内容管理</Link> : undefined}>
    {editingCover && <CanvasCoverEditor target="template" id={editingCover.id} name={editingCover.name} doc={editingCover.doc} onClose={() => setEditingCover(undefined)} onSaved={cover => {
      const update = (rows: IpTemplate[]) => rows.map(t => t.id === editingCover.id ? {...t, coverUrl: cover.coverUrl || undefined} : t);
      templates.setData(update);examples.setData(update);setEditingCover(undefined);templates.reload();examples.reload();
    }}/>}
    {usingTemplate && <StudioTemplateUse key={usingTemplate.versionId || usingTemplate.id} template={usingTemplate} onClose={() => setUsingTemplate(undefined)} onCreated={href => router.push(href)} />}
    <div className="inspiration-toolbar">
      <StudioPageFilters label="灵感分类" value={tab} onChange={v => { setPicked(v as MarketTab); setQuery(''); setError(''); }} items={[
        { value: 'all', label: '全部案例' }, { value: 'video', label: '视频' }, { value: 'image', label: '图片' },
        { value: 'official', label: '官方模板' }, { value: 'personal', label: '我的模板' },
      ]}/>
      <GallerySearch value={query} onChange={setQuery} label={`搜索${noun}`} placeholder={`搜索${noun}…`}/>
    </div>
    <section aria-label="灵感列表">
      <h2 className="sr-only">{tab === 'personal' ? '我的模板' : tab === 'official' ? '官方模板' : tab === 'video' ? '视频案例' : tab === 'image' ? '图片案例' : '全部案例'}</h2>
      {query.trim() && !catalogue.loading && !catalogue.error && <p className="inspiration-result" aria-live="polite">找到 {items.length} 个{noun}</p>}
      {error && <div className="studio-gallery-action-error"><StudioErrorNotice error={error}/></div>}
      {catalogue.error ? <GalleryState error={catalogue.error} retry={catalogue.reload} />
        : catalogue.loading ? <div className="inspiration-wall is-loading" role="status" aria-label="正在加载灵感">{[.8, 1.3, 1, 1.25, .9].map((h, i) => <div key={i} className="inspiration-wall-column"><span style={{ aspectRatio: `1 / ${h}` }}/><span style={{ aspectRatio: `1 / ${2.2 - h}` }}/></div>)}</div>
        : items.length ? <InspirationWall items={items} resetKey={`${tab}:${query.trim()}`} onOpen={setUsingTemplate} manage={t => {
            const cover = (t.visibility === 'personal' && t.mine) || (t.visibility !== 'personal' && identity?.operatorRole === 'super_admin');
            const toggle = t.mine && t.versionId && t.visibility === 'personal';
            if (!cover && !toggle) return null;
            return <>
              {cover && <button type="button" className="is-icon-on-phone" aria-label="设置封面" title="设置封面" onClick={() => setEditingCover(t)}><Image size={13} aria-hidden="true"/><span>设置封面</span></button>}
              {toggle && <button type="button" disabled={changing !== undefined} onClick={() => void changeAvailability(t)}>{changing === t.id && <Loader2 size={13} className="studio-gallery-spinner" />}{t.enabled === false ? '重新启用' : '停用模板'}</button>}
            </>;
          }}/>
        : <GalleryState><LayoutTemplate size={28} /><h3>{query ? `没有找到匹配的${noun}` : tab === "personal" ? "还没有个人模板" : isCases ? "暂无案例" : "暂无官方模板"}</h3><p>{query ? "请更换关键词后重试。" : tab === "personal" ? "在画布右上角「⋯」中选择「保存为模板」，之后可从同一流程开始创作。" : "可从空白画布开始创作。"}</p>{query ? <button type="button" className="ip-brand-secondary" onClick={() => setQuery("")}>清除搜索</button> : <Link className="ip-brand-secondary" href="/create">开始创作 <ArrowRight size={15} /></Link>}</GalleryState>}
    </section>
  </StudioPage>;
}
