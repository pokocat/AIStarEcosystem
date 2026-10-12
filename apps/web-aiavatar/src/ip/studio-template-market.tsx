"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, LayoutTemplate, Loader2, RefreshCw, Settings2 } from "lucide-react";
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
  const [tab, setTab] = useState<"official" | "personal" | "community">("official");
  const [query, setQuery] = useState("");
  const [usingTemplate, setUsingTemplate] = useState<IpTemplate>();
  const [changing, setChanging] = useState<string>();
  const changingRef = useRef(false);
  const [error, setError] = useState("");
  const matches = (t: IpTemplate) => `${t.name} ${t.summary}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const official = templates.data.filter(t => t.visibility !== "personal" && t.enabled !== false);
  const personal = templates.data.filter(t => t.visibility === "personal");
  const items = (tab === "personal" ? personal : official).filter(matches);
  const featured = examples.data.filter(t => t.enabled !== false && !templates.data.some(item => item.id === t.id)).filter(matches);
  const changeAvailability = async (template: IpTemplate) => {
    if (changingRef.current) return;
    changingRef.current = true; setChanging(template.id); setError("");
    const enabled = template.enabled === false;
    try {
      await templateAvailability(template.id, enabled);
      templates.setData(items => items.map(t => t.id === template.id ? { ...t, enabled } : t));
    } catch (e) { setError(e instanceof Error ? e.message : "模板状态修改失败，请重试"); }
    finally { changingRef.current = false; setChanging(undefined); }
  };
  if (authState === "no-platform" || templates.notEnrolled || examples.notEnrolled) return <PlatformGateScreen />;
  if (authState !== "ok") return <StudioPage title="模板管理" description="预览与管理可复用的创作流程，保存副本后继续创作。"><GalleryState loading/></StudioPage>;

  return <StudioPage title="模板管理" description="预览与管理可复用的创作流程，保存副本后继续创作。" className="studio-gallery-page studio-template-market" actions={<><Link className="ip-brand-button" href="/create">开始创作<ArrowRight size={16}/></Link>{isOperatorRole(identity?.operatorRole) && <Link className="ip-brand-secondary" href="/projects/demos"><Settings2 size={16}/>官方内容管理</Link>}</>}>
    {usingTemplate && <StudioTemplateUse key={usingTemplate.versionId || usingTemplate.id} template={usingTemplate} onClose={() => setUsingTemplate(undefined)} onCreated={id => router.push(`/projects/${id}`)} />}
    <StudioPageFilters label="模板分类" value={tab} onChange={v => { setTab(v as typeof tab); setQuery(''); setError(''); }} items={[{value:'official',label:'官方模板',count:templates.loading || templates.error ? undefined : official.length},{value:'personal',label:'我的模板',count:templates.loading || templates.error ? undefined : personal.length},{value:'community',label:'用户发布模板',note:'待建设'}]}/>
    <section className="studio-gallery-panel" aria-label="模板目录">
      <div className="studio-gallery-panel-heading"><div><h2>{tab === 'personal' ? '我的模板' : tab === 'community' ? '用户发布模板' : '官方模板'}</h2><p>{tab === 'personal' ? '保存自己的工作流，下一次创作从这里开始。' : '先预览创作流程，存为个人副本后编辑。'}</p></div></div>
      {tab !== 'community' && <><div className="studio-page-toolbar"><GallerySearch value={query} onChange={setQuery} label="搜索模板" placeholder="搜索模板名称、创作流程…"/><button type="button" className="studio-page-refresh" disabled={templates.loading || examples.loading} onClick={() => { templates.reload(); examples.reload(); }} aria-label="刷新模板"><RefreshCw size={16}/></button></div><div className="studio-page-result" aria-live="polite">{templates.loading ? '正在读取模板…' : templates.error ? '暂时无法读取模板' : `${items.length} 项${query.trim() ? '匹配' : ''}模板`}</div></>}
      {error && <div className="studio-gallery-action-error" role="alert">{error}</div>}
      {tab === "community" ? <div className="studio-market-coming"><div className="studio-market-coming-icon"><Clock3 size={30} strokeWidth={1.5} /></div><h2>用户模板市场，正在建设</h2><p>未来，你可以在这里发现其他创作者发布的画布流程。<br />现在可以在个人画布中“发布为模板”，保存并复用自己的创作流程。</p><button type="button" className="ip-brand-secondary" onClick={() => setTab("personal")}>查看我的模板 <ArrowRight size={16} /></button></div> : <>

        {templates.error ? <GalleryState error={templates.error} retry={templates.reload} /> : templates.loading ? <GalleryState loading /> : items.length ? <div className="studio-template-grid">{items.map(t => <TemplateCard key={t.id} template={t} onOpen={setUsingTemplate}>
          {t.mine && t.versionId && t.visibility === "personal" && <div className="studio-template-manage"><button type="button" disabled={changing !== undefined} onClick={() => void changeAvailability(t)}>{changing === t.id && <Loader2 size={14} className="studio-gallery-spinner" />}{t.enabled === false ? "重新启用" : "停用模板"}</button></div>}
        </TemplateCard>)}</div> : <GalleryState><LayoutTemplate size={28} /><h3>{query ? "没有找到匹配的模板" : tab === "personal" ? "还没有个人模板" : "暂无官方模板"}</h3><p>{query ? "换个关键词，再看看。" : tab === "personal" ? "在个人画布中选择“发布为模板”，以后就可以从同一流程开始创作。" : "可以先从空白画布开始创作。"}</p>{query ? <button type="button" className="ip-brand-secondary" onClick={() => setQuery("")}>清除搜索</button> : <Link className="ip-brand-secondary" href="/create">去创作 <ArrowRight size={15} /></Link>}</GalleryState>}
        {tab === "official" && <section className="studio-market-examples" aria-labelledby="studio-market-examples-heading"><div className="studio-gallery-panel-heading"><div><h2 id="studio-market-examples-heading">精选画布</h2><p>官方发布的画布示例，同样支持只读预览和保存副本。</p></div></div>{examples.error ? <GalleryState error={examples.error} retry={examples.reload} /> : examples.loading ? <GalleryState loading /> : featured.length ? <div className="studio-template-grid">{featured.map(t => <TemplateCard key={t.id} template={t} onOpen={setUsingTemplate} />)}</div> : <p className="studio-market-description">{query ? "没有匹配的精选画布。" : "精选画布发布后会展示在这里。"}</p>}</section>}
      </>}
    </section>
  </StudioPage>;
}
