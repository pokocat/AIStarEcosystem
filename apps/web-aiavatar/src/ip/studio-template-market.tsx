"use client";
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutTemplate, Loader2, RefreshCw, Settings2 } from "lucide-react";
import type { IpTemplate } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { isOperatorRole, useIdentity } from "@/proto/api";
import { templateAvailability } from "@/canvas-bridge/template-api";
import { IpStudioApi } from "./api";
import { StudioTemplateUse } from "./studio-template-use";
import { StudioPage, StudioPageFilters } from "./studio-page";
import { GallerySearch, GalleryState, TemplateCard, useStudioList } from "./studio-gallery";

export function StudioTemplateMarket() {
  const router = useRouter();
  const authState = useRequireAuth();
  const identity = useIdentity();
  const templates = useStudioList(IpStudioApi.listTemplates, authState === "ok");
  const examples = useStudioList(IpStudioApi.listDemoExamples, authState === "ok");
  const [tab, setTab] = useState<"official" | "personal" | "examples">("official");
  const [query, setQuery] = useState("");
  const [usingTemplate, setUsingTemplate] = useState<IpTemplate>();
  const [changing, setChanging] = useState<string>();
  const changingRef = useRef(false);
  const [error, setError] = useStudioErrorState();
  const matches = (t: IpTemplate) => `${t.name} ${t.summary}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const official = templates.data.filter(t => t.visibility !== "personal" && t.enabled !== false);
  const personal = templates.data.filter(t => t.visibility === "personal");
  const items = (tab === "personal" ? personal : tab === "examples" ? examples.data.filter(t => t.enabled !== false) : official).filter(matches);

  const catalogue = tab === "examples" ? examples : templates;
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
  if (authState !== "ok") return <StudioPage title="灵感" description="从模板与案例中，找到下一次创作的起点。"><GalleryState loading/></StudioPage>;

  return <StudioPage title="灵感" description="从模板与案例中，找到下一次创作的起点。" className="studio-gallery-page studio-template-market" actions={<><Link className="ip-brand-button" href="/create">开始创作<ArrowRight size={16}/></Link>{isOperatorRole(identity?.operatorRole) && <Link className="ip-brand-secondary" href="/projects/demos"><Settings2 size={16}/>官方内容管理</Link>}</>}>
    {usingTemplate && <StudioTemplateUse key={usingTemplate.versionId || usingTemplate.id} template={usingTemplate} onClose={() => setUsingTemplate(undefined)} onCreated={id => router.push(`/projects/${id}`)} />}
    <StudioPageFilters label="模板分类" value={tab} onChange={v => { setTab(v as typeof tab); setQuery(''); setError(''); }} items={[{value:'official',label:'官方模板',count:templates.loading || templates.error ? undefined : official.length},{value:'personal',label:'我的模板',count:templates.loading || templates.error ? undefined : personal.length},{value:'examples',label:'精选案例'}]}/>
    <section className="studio-gallery-panel" aria-label="模板目录">
      <div className="studio-gallery-panel-heading"><div><h2>{tab === 'personal' ? '我的模板' : tab === 'examples' ? '精选案例' : '官方模板'}</h2><p>{tab === 'personal' ? '保存自己的工作流，下一次创作从这里开始。' : '先预览创作流程，存为个人副本后编辑。'}</p></div></div>
      <><div className="studio-page-toolbar"><GallerySearch value={query} onChange={setQuery} label="搜索模板" placeholder="搜索模板名称、创作流程…"/><button type="button" className="studio-page-refresh" disabled={templates.loading || examples.loading} onClick={() => { templates.reload(); examples.reload(); }} aria-label="刷新模板"><RefreshCw size={16}/></button></div><div className="studio-page-result" aria-live="polite">{catalogue.loading ? '正在读取内容…' : catalogue.error ? '暂时无法读取内容' : `${items.length} 项${query.trim() ? '匹配' : ''}${tab === 'examples' ? '案例' : '模板'}`}</div></>
      {error && <div className="studio-gallery-action-error"><StudioErrorNotice error={error}/></div>}
        {catalogue.error ? <GalleryState error={catalogue.error} retry={catalogue.reload} /> : catalogue.loading ? <GalleryState loading /> : items.length ? <div className="studio-template-grid">{items.map(t => <TemplateCard key={t.id} template={t} onOpen={setUsingTemplate}>
          {t.mine && t.versionId && t.visibility === "personal" && <div className="studio-template-manage"><button type="button" disabled={changing !== undefined} onClick={() => void changeAvailability(t)}>{changing === t.id && <Loader2 size={14} className="studio-gallery-spinner" />}{t.enabled === false ? "重新启用" : "停用模板"}</button></div>}
        </TemplateCard>)}</div> : <GalleryState><LayoutTemplate size={28} /><h3>{query ? "没有找到匹配的模板" : tab === "personal" ? "还没有个人模板" : tab === "examples" ? "精选案例正在准备中" : "暂无官方模板"}</h3><p>{query ? "换个关键词，再看看。" : tab === "personal" ? "在个人画布中选择“发布为模板”，以后就可以从同一流程开始创作。" : "可以先从空白画布开始创作。"}</p>{query ? <button type="button" className="ip-brand-secondary" onClick={() => setQuery("")}>清除搜索</button> : <Link className="ip-brand-secondary" href="/create">去创作 <ArrowRight size={15} /></Link>}</GalleryState>}

    </section>
  </StudioPage>;
}
