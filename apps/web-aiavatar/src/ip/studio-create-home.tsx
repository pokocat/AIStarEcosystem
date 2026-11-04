"use client";
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import type { IpTemplate } from "@ai-star-eco/types";
import { isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { IpStudioApi } from "./api";
import { createStudioEntry, studioEntries, studioEntryHref, type StudioEntry } from "./studio-entry";
import { StudioTemplateUse } from "./studio-template-use";
import { GalleryState, TemplateCard, useCanvasPreviews, useStudioList } from "./studio-gallery";
import { ProjectCardPreview } from "./project-card-preview";
import { projectPreview } from "./project-preview";
import { formatDateTime } from "@/lib/datetime";
import { StudioPage } from "./studio-page";
import { studioCreateTools } from "./studio-create-tools";
import { useStartNewCanvas } from "./use-start-new-canvas";

const TITLE = "画布·自由创作";
const DESCRIPTION = "自由连接想法与素材，把灵感变成作品。";
/** 这一行只放最近的十几张，多的横向滑动；看全部去项目页（已按画布类型筛好）。 */
const RECENT_LIMIT = 12;

/**
 * 「画布·自由创作」 (/create), the same page on the desktop and the phone (docs/ip-studio-new-canvas-and-threads.md §2.2):
 * one sliding row with a small 「新建画布」 tile (the shared startNewCanvas(), reuse rule and assistant included) and the recent
 * canvases, then the creation tools and a row of templates. Nothing is created until the user clicks; there is no mode switch and no conversation box here
 * (the home page has that box).
 */
export function StudioCreateHome() {
  const router = useRouter();
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const templates = useStudioList(IpStudioApi.listTemplates, ready);
  const projects = useStudioList(IpStudioApi.listProjects, ready);
  const recent = useMemo(() => [...projects.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, RECENT_LIMIT), [projects.data]);
  const { previews } = useCanvasPreviews(recent);
  const newCanvas = useStartNewCanvas();
  const [creating, setCreating] = useState<StudioEntry>();
  const creatingRef = useRef(false);
  const [actionError, setActionError] = useStudioErrorState();
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [usingTemplate, setUsingTemplate] = useState<IpTemplate>();
  const surface = useRef<HTMLDivElement>(null);
  const official = templates.data.filter(t => t.visibility !== "personal" && t.enabled !== false).slice(0, 4);
  const busy = creating !== undefined || newCanvas.creating;

  const startBlank = () => {
    if (creatingRef.current || newCanvas.creating) return;
    setActionError("");
    void newCanvas.start();
  };
  // A tool opens a free canvas with its own panel (`?start=<entry>`); a model run and its price are confirmed in there.
  const openTool = async (entry: StudioEntry) => {
    if (creatingRef.current || newCanvas.creating) return;
    creatingRef.current = true; setCreating(entry); setActionError(""); newCanvas.clearError();
    try {
      const project = await createStudioEntry(entry);
      router.push(studioEntryHref(project.id, entry));
    } catch (e) {
      if (isProductNotEnrolledError(e)) setNotEnrolled(true);
      else setActionError(e);
      setCreating(undefined); creatingRef.current = false;
    }
  };

  if (authState === "no-platform" || notEnrolled || templates.notEnrolled || newCanvas.notEnrolled) return <PlatformGateScreen />;
  if (!ready) return <StudioPage title={TITLE} description={DESCRIPTION}><GalleryState loading/></StudioPage>;

  return <StudioPage title={TITLE} description={DESCRIPTION} contentRef={surface} className="studio-gallery-page studio-create-page">
    {usingTemplate && <StudioTemplateUse key={usingTemplate.versionId || usingTemplate.id} template={usingTemplate} onClose={() => setUsingTemplate(undefined)} onCreated={id => router.push(`/projects/${id}`)} />}
    {actionError && <div className="studio-gallery-action-error"><StudioErrorNotice error={actionError}/></div>}
    {newCanvas.error !== undefined && <div className="studio-gallery-action-error"><StudioErrorNotice error={newCanvas.error}/><span> · 新画布没有创建成功，可以再点一次「新建画布」。</span></div>}
    <section className="studio-gallery-panel studio-creation-section" id="start-creation" aria-label="开始创作">
      <div className="studio-create-recent">
        <div className="studio-gallery-panel-heading"><h2>最近的画布</h2><Link className="studio-gallery-more" href="/projects?type=canvas">全部画布<ArrowRight size={14}/></Link></div>
        <ul className="studio-create-recent-list">
          <li><button type="button" className="studio-create-new" aria-busy={newCanvas.creating} disabled={busy} onClick={startBlank}>
            <span className="studio-create-new-go" aria-hidden="true">{newCanvas.creating ? <Loader2 size={18} className="studio-gallery-spinner"/> : <Plus size={18}/>}</span>
            <strong>新建画布</strong>
          </button></li>
          {!projects.error && projects.loading && [0, 1, 2].map(n => <li key={n} className="studio-create-recent-skeleton" aria-hidden="true"/>)}
          {!projects.error && !projects.loading && recent.map(p => {
            const preview = previews[`${p.id}:${p.updatedAt}`];
            const content = preview?.doc ? projectPreview(preview.doc) : undefined;
            return <li key={p.id}><Link href={`/projects/${p.id}`} aria-label={`打开画布 ${p.name}`}>
              <div className="studio-gallery-preview"><ProjectCardPreview coverUrl={p.coverUrl} preview={content} doc={preview?.doc} loading={!preview} error={preview?.error}/></div>
              <div className="studio-create-recent-copy"><strong title={p.name}>{p.name}</strong><time dateTime={p.updatedAt}>{formatDateTime(p.updatedAt)}</time></div>
            </Link></li>;
          })}
        </ul>
        {projects.error && <GalleryState error={projects.error} retry={projects.reload}/>}
      </div>

      <div className="studio-gallery-panel-heading studio-create-tools-heading"><h2>从一项功能开始</h2></div>
      <nav className="studio-create-tools" aria-label="快速开始创作">{studioCreateTools.map(({entry, description, image}, index) => <button type="button" className="studio-create-tool" key={entry} aria-label={studioEntries[entry].title} aria-busy={creating === entry} disabled={busy} onClick={() => void openTool(entry)}>
        <div className="studio-create-tool-visual"><Image src={`/studio/create/${image}.webp`} alt="" width={960} height={640} sizes="(min-width: 960px) 20vw, 50vw" loading={index < 5 ? "eager" : "lazy"}/></div>
        <div className="studio-create-tool-copy"><strong>{studioEntries[entry].title}</strong>{creating === entry ? <Loader2 size={15} className="studio-gallery-spinner" aria-hidden="true"/> : <ArrowRight size={15} aria-hidden="true"/>}<p>{description}</p></div>
      </button>)}</nav>

      <div className="studio-creation-templates" id="templates"><div className="studio-gallery-panel-heading"><h2>从模板开始</h2><Link className="studio-gallery-more" href="/templates">更多模板 <ArrowRight size={16} /></Link></div>
        {templates.error ? <GalleryState error={templates.error} retry={templates.reload} /> : templates.loading ? <GalleryState loading /> : official.length ? <div className="studio-template-grid">{official.map(t => <TemplateCard key={t.id} template={t} onOpen={setUsingTemplate} />)}</div> : <GalleryState><p>官方模板正在准备中。你可以先新建一张画布。</p></GalleryState>}
      </div>
    </section>
  </StudioPage>;
}
