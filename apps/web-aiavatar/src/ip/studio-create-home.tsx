"use client";
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, ImagePlus, Loader2, Plus, Type } from "lucide-react";
import type { IpTemplate } from "@ai-star-eco/types";
import { isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { IpStudioApi } from "./api";
import { createStudioEntry, studioEntries, studioEntryHref, type StudioEntry } from "./studio-entry";
import { StudioTemplateUse } from "./studio-template-use";
import { GalleryState, TemplateCard, useStudioList } from "./studio-gallery";
import { StudioPage } from "./studio-page";
import { AiMark } from "./studio-ai-icon";
import { studioCreateTools } from "./studio-create-tools";
import { useStartNewCanvas } from "./use-start-new-canvas";

const TITLE = "画布·自由创作";
const DESCRIPTION = "自由连接想法与素材，把灵感变成作品。";
const NEW_CANVAS_NOTE = "一张空白画布，打开就有助手，直接开始。";

/**
 * 「画布·自由创作」 (/create), the same page on the desktop and the phone (docs/ip-studio-new-canvas-and-threads.md §2.2):
 * the 「新建画布」 card on top (the shared startNewCanvas(), reuse rule and assistant included), then the creation tools and
 * a row of templates. Nothing is created until the user clicks; there is no mode switch and no conversation box here
 * (the home page has that box).
 */
export function StudioCreateHome() {
  const router = useRouter();
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const templates = useStudioList(IpStudioApi.listTemplates, ready);
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
      <button type="button" className="studio-create-new" aria-label="新建画布" aria-describedby="studio-create-new-note" aria-busy={newCanvas.creating} disabled={busy} onClick={startBlank}>
        <span className="studio-create-new-visual" aria-hidden="true">
          <span className="studio-create-new-board"><span><Type size={13}/>文字</span><i/><span><ImagePlus size={13}/>图片</span></span>
          <span className="studio-create-new-assistant"><b><AiMark size={11}/></b><em/><em/><em/></span>
        </span>
        <span className="studio-create-new-copy"><strong>新建画布</strong><span id="studio-create-new-note">{NEW_CANVAS_NOTE}</span></span>
        <span className="studio-create-new-go" aria-hidden="true">{newCanvas.creating ? <Loader2 size={20} className="studio-gallery-spinner"/> : <Plus size={20}/>}</span>
      </button>

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
