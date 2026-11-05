"use client";
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutTemplate, Loader2, RefreshCw, Settings2, Image } from "lucide-react";
import type { IpTemplate } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { isOperatorRole, useIdentity } from "@/proto/api";
import { templateAvailability } from "@/canvas-bridge/template-api";
import { IpStudioApi } from "./api";
import { CanvasCoverEditor } from "./canvas-cover-editor";
import { StudioTemplateUse } from "./studio-template-use";
import { StudioPage, StudioPageFilters } from "./studio-page";
import { GallerySearch, GalleryState, TemplateCard, useStudioList } from "./studio-gallery";
import { templateKind, templateSearchText, templateSpec } from "./template-facts";

type MarketTab = "all" | "video" | "image" | "official" | "personal";
const CASE_TABS: readonly MarketTab[] = ["all", "video", "image"];
const CASE_LABEL = { video: "视频", image: "图片", canvas: "案例" } as const;
/** 卡片上的标签说比例和时长，比重复一遍「视频案例」有用：卡片右上角已经有视频标记。 */
const caseLabel = (t: IpTemplate) => [CASE_LABEL[templateKind(t)], templateSpec(t.doc)].filter(Boolean).join(" · ");

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
  const items = inTab.filter(matches);
  const noun = isCases ? "案例" : "模板";
  const count = (rows: IpTemplate[], list: typeof templates) => list.loading || list.error ? undefined : rows.length;

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
  if (authState !== "ok") return <StudioPage title="灵感" description="从案例与模板中，找到下一次创作的起点。"><GalleryState loading/></StudioPage>;

  return <StudioPage title="灵感" description="从案例与模板中，找到下一次创作的起点。" className="studio-gallery-page studio-template-market" actions={<><Link className="ip-brand-button" href="/create">开始创作<ArrowRight size={16}/></Link>{isOperatorRole(identity?.operatorRole) && <Link className="ip-brand-secondary" href="/projects/demos"><Settings2 size={16}/>官方内容管理</Link>}</>}>
    {editingCover && <CanvasCoverEditor target="template" id={editingCover.id} name={editingCover.name} doc={editingCover.doc} onClose={() => setEditingCover(undefined)} onSaved={cover => {
      const update = (rows: IpTemplate[]) => rows.map(t => t.id === editingCover.id ? {...t, coverUrl: cover.coverUrl || undefined} : t);
      templates.setData(update);examples.setData(update);setEditingCover(undefined);templates.reload();examples.reload();
    }}/>}
    {usingTemplate && <StudioTemplateUse key={usingTemplate.versionId || usingTemplate.id} template={usingTemplate} onClose={() => setUsingTemplate(undefined)} onCreated={href => router.push(href)} />}
    <StudioPageFilters label="灵感分类" value={tab} onChange={v => { setPicked(v as MarketTab); setQuery(''); setError(''); }} items={[
      { value: 'all', label: '全部案例', count: count(cases, examples) },
      { value: 'video', label: '视频', count: count(cases.filter(t => templateKind(t) === 'video'), examples) },
      { value: 'image', label: '图片', count: count(cases.filter(t => templateKind(t) === 'image'), examples) },
      { value: 'official', label: '官方模板', count: count(official, templates) },
      { value: 'personal', label: '我的模板', count: count(personal, templates) },
    ]}/>
    <section className="studio-gallery-panel" aria-label="灵感列表">
      <div className="studio-gallery-panel-heading"><div><h2>{tab === 'personal' ? '我的模板' : tab === 'official' ? '官方模板' : tab === 'video' ? '视频案例' : tab === 'image' ? '图片案例' : '全部案例'}</h2><p>{tab === 'personal' ? '保存自己的工作流，下一次创作从这里开始。' : isCases ? '提示词和示例都已备好，做同款后换成你的内容。' : '先看创作流程，做同款后编辑。'}</p></div></div>
      <><div className="studio-page-toolbar"><GallerySearch value={query} onChange={setQuery} label={`搜索${noun}`} placeholder={`搜索${noun}名称、提示词…`}/><button type="button" className="studio-page-refresh" disabled={templates.loading || examples.loading} onClick={() => { templates.reload(); examples.reload(); }} aria-label="刷新灵感"><RefreshCw size={16}/></button></div><div className="studio-page-result" aria-live="polite">{catalogue.loading ? '正在读取内容…' : catalogue.error ? '暂时无法读取内容' : `${items.length} 项${query.trim() ? '匹配' : ''}${noun}`}</div></>
      {error && <div className="studio-gallery-action-error"><StudioErrorNotice error={error}/></div>}
        {catalogue.error ? <GalleryState error={catalogue.error} retry={catalogue.reload} /> : catalogue.loading ? <GalleryState loading /> : items.length ? <div className="studio-template-grid">{items.map(t => <TemplateCard key={t.id} previewMode="content" template={t} onOpen={setUsingTemplate} label={isCases ? caseLabel(t) : undefined}>
          {((t.visibility === 'personal' && t.mine) || (t.visibility !== 'personal' && identity?.operatorRole === 'super_admin')) && <div className="studio-template-manage"><button type="button" onClick={() => setEditingCover(t)}><Image size={14}/>设置封面</button></div>}
          {t.mine && t.versionId && t.visibility === "personal" && <div className="studio-template-manage"><button type="button" disabled={changing !== undefined} onClick={() => void changeAvailability(t)}>{changing === t.id && <Loader2 size={14} className="studio-gallery-spinner" />}{t.enabled === false ? "重新启用" : "停用模板"}</button></div>}
        </TemplateCard>)}</div> : <GalleryState><LayoutTemplate size={28} /><h3>{query ? `没有找到匹配的${noun}` : tab === "personal" ? "还没有个人模板" : isCases ? "案例正在准备中" : "暂无官方模板"}</h3><p>{query ? "换个关键词，再看看。" : tab === "personal" ? "在个人画布中选择“发布为模板”，以后就可以从同一流程开始创作。" : "可以先从空白画布开始创作。"}</p>{query ? <button type="button" className="ip-brand-secondary" onClick={() => setQuery("")}>清除搜索</button> : <Link className="ip-brand-secondary" href="/create">去创作 <ArrowRight size={15} /></Link>}</GalleryState>}

    </section>
  </StudioPage>;
}
