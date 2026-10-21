"use client";
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, ImagePlus, Loader2, Mic, RotateCcw, Video } from "lucide-react";
import type { IpProject, IpTemplate } from "@ai-star-eco/types";
import { isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { useLayoutMode } from "@/shell/layout-mode";
import { IpStudioApi } from "./api";
import { createStudioEntry, studioBriefNeedsReference, studioEntries, studioEntryHref, StudioEntrySaveError, type StudioEntry } from "./studio-entry";
import { StudioTemplateUse } from "./studio-template-use";
import { GalleryState, TemplateCard, useStudioList } from "./studio-gallery";
import { StudioPage } from "./studio-page";
import { StudioConversationStart } from "./studio-conversation-start";
import { studioCreateTools } from "./studio-create-tools";
import { useStartNewCanvas } from "./use-start-new-canvas";

const TITLE = "画布·自由创作";
const DESCRIPTION = "自由连接想法与素材，把灵感变成作品。";

/**
 * 「画布·自由创作」 (/create). On the desktop it is simply 「新建」: a new canvas opens at once with the assistant beside it
 * (docs/ip-studio-new-canvas-and-threads.md §2.2). The phone keeps a page: the conversation box, the creation tools and templates.
 * The form follows `html[data-layout]` (useLayoutMode), never a media query; until it is known nothing is created.
 */
export function StudioCreateHome() {
  const layout = useLayoutMode();
  if (layout === null) return <StudioPage title={TITLE} description={DESCRIPTION}><GalleryState loading/></StudioPage>;
  return layout === "desktop" ? <StudioCreateDesktop/> : <StudioCreateMobile/>;
}

function StudioCreateDesktop() {
  const authState = useRequireAuth();
  // replace: the back button returns to the page the user came from, not to this hand-off.
  const newCanvas = useStartNewCanvas({ navigate: "replace" });
  const { start } = newCanvas;
  useEffect(() => { if (authState === "ok") void start(); }, [authState, start]);
  if (authState === "no-platform" || newCanvas.notEnrolled) return <PlatformGateScreen/>;
  const failed = newCanvas.error !== undefined;
  return <StudioPage title={TITLE} description={DESCRIPTION} className="studio-gallery-page studio-create-page">
    {failed ? <div className="studio-gallery-state studio-create-opening" role="alert">
      <h3>新画布没有打开</h3><p>{newCanvas.errorMessage}</p>
      <div className="studio-create-opening-actions"><button type="button" className="ip-brand-button" disabled={newCanvas.creating} onClick={() => void start()}><RotateCcw size={16} aria-hidden="true"/>重试</button><Link className="ip-brand-secondary" href="/projects">去项目页</Link></div>
    </div> : <div className="studio-gallery-state studio-create-opening" role="status"><Loader2 size={22} className="studio-gallery-spinner" aria-hidden="true"/><p>正在打开新画布…</p></div>}
  </StudioPage>;
}

function StudioCreateMobile() {
  const router = useRouter();
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const templates = useStudioList(IpStudioApi.listTemplates, ready);
  const [creating, setCreating] = useState<StudioEntry>();
  const creatingRef = useRef(false);
  const [pendingStart, setPendingStart] = useState<{ project: IpProject; entry: StudioEntry; brief: string }>();
  const [actionError, setActionError] = useStudioErrorState();
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [usingTemplate, setUsingTemplate] = useState<IpTemplate>();
  const surface = useRef<HTMLDivElement>(null);
  const official = templates.data.filter(t => t.visibility !== "personal" && t.enabled !== false).slice(0, 4);
  // The 「空白画布」 tool is the shared 「新建」 (docs/ip-studio-new-canvas-and-threads.md §2.1): reuse rule and assistant included.
  const newCanvas = useStartNewCanvas();
  const startBlank = () => { if (creatingRef.current) return; setActionError(""); void newCanvas.start(); };

  const start = async (entry: StudioEntry, brief = "") => {
    if (creatingRef.current || newCanvas.creating) return;
    creatingRef.current = true; setCreating(entry); setActionError("");
    try {
      const target = pendingStart?.entry ?? entry;
      const text = pendingStart?.brief ?? brief;
      const project = await createStudioEntry(target, text, pendingStart?.project);
      setPendingStart(undefined);
      router.push(studioEntryHref(project.id, target, { send: target === "assistant" && !!text.trim() && !studioBriefNeedsReference(text) }));
    } catch (e) {
      if (e instanceof StudioEntrySaveError) setPendingStart({ project: e.project, entry: pendingStart?.entry ?? entry, brief: pendingStart?.brief ?? brief });
      if (isProductNotEnrolledError(e)) setNotEnrolled(true);
      else setActionError(e);
      setCreating(undefined); creatingRef.current = false;
    }
  };

  if (authState === "no-platform" || notEnrolled || templates.notEnrolled || newCanvas.notEnrolled) return <PlatformGateScreen />;
  if (!ready) return <StudioPage title={TITLE} description={DESCRIPTION}><GalleryState loading/></StudioPage>;

  return <StudioPage title={TITLE} description={DESCRIPTION} contentRef={surface} className="studio-gallery-page studio-create-page">
    {usingTemplate && <StudioTemplateUse key={usingTemplate.versionId || usingTemplate.id} template={usingTemplate} onClose={() => setUsingTemplate(undefined)} onCreated={id => router.push(`/projects/${id}`)} />}
    {actionError && <div className="studio-gallery-action-error"><StudioErrorNotice error={actionError}/>{pendingStart && <><span> · 画布已创建，重试会继续保存到同一张画布。</span><Link href={`/projects/${pendingStart.project.id}`}>打开已创建的画布</Link></>}</div>}
    {newCanvas.error !== undefined && <div className="studio-gallery-action-error"><StudioErrorNotice error={newCanvas.error}/><span> · 新画布没有创建成功，可以再点一次「空白画布」。</span></div>}
    <section className="studio-gallery-panel studio-creation-section" id="start-creation" aria-label="开始创作">
      <StudioConversationStart compact creating={creating === "assistant"} pending={!!pendingStart} onStart={brief => void start("assistant", brief)}/>
    <nav className="studio-create-tools" aria-label="快速开始创作">{studioCreateTools.map(({entry, description, image}, index) => <button type="button" className="studio-create-tool" key={entry} aria-label={studioEntries[entry].title} aria-busy={entry === "blank" ? newCanvas.creating : creating === entry} disabled={creating !== undefined || newCanvas.creating || !!pendingStart} onClick={() => entry === "blank" ? startBlank() : void start(entry)}>
      <div className="studio-create-tool-visual">{image ? <Image src={`/studio/create/${image}.webp`} alt="" width={960} height={640} sizes="(min-width: 960px) 20vw, 50vw" loading={index < 5 ? "eager" : "lazy"}/> : <div className="studio-tool-blank-preview" aria-hidden="true"><span><BookOpen size={16}/>文字</span><span><ImagePlus size={16}/>图片</span><span><Mic size={16}/>声音</span><span><Video size={16}/>视频</span></div>}</div>
      <div className="studio-create-tool-copy"><strong>{studioEntries[entry].title}</strong>{creating === entry || (entry === "blank" && newCanvas.creating) ? <Loader2 size={15} className="studio-gallery-spinner" aria-hidden="true"/> : <ArrowRight size={15} aria-hidden="true"/>}<p>{description}</p></div>
    </button>)}</nav>

    <div className="studio-creation-templates" id="templates"><div className="studio-gallery-panel-heading"><h2>从模板开始</h2><Link className="studio-gallery-more" href="/templates">更多模板 <ArrowRight size={16} /></Link></div>
      {templates.error ? <GalleryState error={templates.error} retry={templates.reload} /> : templates.loading ? <GalleryState loading /> : official.length ? <div className="studio-template-grid">{official.map(t => <TemplateCard key={t.id} template={t} onOpen={setUsingTemplate} />)}</div> : <GalleryState><p>官方模板正在准备中。你可以先从空白画布开始。</p></GalleryState>}
    </div>
    </section>
  </StudioPage>;
}
