"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock3, LayoutTemplate, Loader2, Settings2 } from "lucide-react";
import type { IpTemplate } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { isOperatorRole, useIdentity } from "@/proto/api";
import { templateAvailability } from "@/canvas-bridge/template-api";
import { IpStudioApi } from "./api";
import { StudioTemplateUse } from "./studio-template-use";
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
  if (authState !== "ok") return <main className="ip-brand-surface studio-gallery-page"><GalleryState loading /></main>;

  return <main className="ip-brand-surface studio-gallery-page studio-template-market" data-studio-overlay-root>
    {usingTemplate && <StudioTemplateUse key={usingTemplate.versionId || usingTemplate.id} template={usingTemplate} onClose={() => setUsingTemplate(undefined)} onCreated={id => router.push(`/projects/${id}`)} />}
    <Link href="/create" className="studio-gallery-back"><ArrowLeft size={16} />返回创作</Link>
    <header className="studio-gallery-heading"><div><h1>模板市场</h1><p>预览一套创作流程，存为个人副本后，在画布里换成你的灵感。</p></div>{isOperatorRole(identity?.operatorRole) && <Link className="ip-brand-secondary" href="/projects/demos"><Settings2 size={16} />官方内容管理</Link>}</header>
    <section className="studio-gallery-panel" aria-label="模板目录">
      <div className="studio-gallery-market-toolbar"><div className="studio-gallery-tabs" role="group" aria-label="模板分类">{([['official', '官方模板'], ['personal', '我的模板'], ['community', '用户发布模板']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setQuery(""); setError(""); }}>{label}{value === "community" ? <small>待建设</small> : <span>{templates.loading || templates.error ? "—" : value === "personal" ? personal.length : official.length}</span>}</button>)}</div>
        {tab !== "community" && <GallerySearch value={query} onChange={setQuery} label="搜索模板" placeholder="搜索模板名称、创作流程…" />}
      </div>
      {error && <div className="studio-gallery-action-error" role="alert">{error}</div>}
      {tab === "community" ? <div className="studio-market-coming"><div className="studio-market-coming-icon"><Clock3 size={30} strokeWidth={1.5} /></div><h2>用户模板市场，正在建设</h2><p>未来，你可以在这里发现其他创作者发布的画布流程。<br />现在可以在个人画布中“发布为模板”，保存并复用自己的创作流程。</p><button type="button" className="ip-brand-secondary" onClick={() => setTab("personal")}>查看我的模板 <ArrowRight size={16} /></button></div> : <>
        <p className="studio-market-description">{tab === "personal" ? "在画布中发布的个人模板会保存在这里。" : "进入模板仅作预览，保存副本后即可编辑；模型、参考素材和生成费用都在画布中确认。"}</p>
        {templates.error ? <GalleryState error={templates.error} retry={templates.reload} /> : templates.loading ? <GalleryState loading /> : items.length ? <div className="studio-template-grid">{items.map(t => <TemplateCard key={t.id} template={t} onOpen={setUsingTemplate}>
          {t.mine && t.versionId && t.visibility === "personal" && <div className="studio-template-manage"><button type="button" disabled={changing !== undefined} onClick={() => void changeAvailability(t)}>{changing === t.id && <Loader2 size={14} className="studio-gallery-spinner" />}{t.enabled === false ? "重新启用" : "停用模板"}</button></div>}
        </TemplateCard>)}</div> : <GalleryState><LayoutTemplate size={28} /><h3>{query ? "没有找到匹配的模板" : tab === "personal" ? "还没有个人模板" : "暂无官方模板"}</h3><p>{query ? "换个关键词，再看看。" : tab === "personal" ? "在个人画布中选择“发布为模板”，以后就可以从同一流程开始创作。" : "可以先从空白画布开始创作。"}</p>{query ? <button type="button" className="ip-brand-secondary" onClick={() => setQuery("")}>清除搜索</button> : <Link className="ip-brand-secondary" href="/create">去创作 <ArrowRight size={15} /></Link>}</GalleryState>}
        {tab === "official" && <section className="studio-market-examples" aria-labelledby="studio-market-examples-heading"><div className="studio-gallery-panel-heading"><div><h2 id="studio-market-examples-heading">精选画布</h2><p>官方发布的画布示例，同样支持只读预览和保存副本。</p></div></div>{examples.error ? <GalleryState error={examples.error} retry={examples.reload} /> : examples.loading ? <GalleryState loading /> : featured.length ? <div className="studio-template-grid">{featured.map(t => <TemplateCard key={t.id} template={t} onOpen={setUsingTemplate} />)}</div> : <p className="studio-market-description">{query ? "没有匹配的精选画布。" : "精选画布发布后会展示在这里。"}</p>}</section>}
      </>}
    </section>
  </main>;
}
