"use client";
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, ImagePlus, Loader2, Mic, Video } from "lucide-react";
import type { IpProject, IpTemplate } from "@ai-star-eco/types";
import { isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { IpStudioApi } from "./api";
import { createStudioEntry, studioEntries, studioEntryHref, StudioEntrySaveError, type StudioEntry } from "./studio-entry";
import { StudioTemplateUse } from "./studio-template-use";
import { GalleryState, TemplateCard, useStudioList } from "./studio-gallery";
import { StudioPage } from "./studio-page";
import { StudioCreationBrief } from "./studio-creation-brief";
import { studioCreateTools } from "./studio-create-tools";

export function StudioCreateHome() {
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

  const start = async (entry: StudioEntry, brief = "") => {
    if (creatingRef.current) return;
    creatingRef.current = true; setCreating(entry); setActionError("");
    try {
      const target = pendingStart?.entry ?? entry;
      const text = pendingStart?.brief ?? brief;
      const project = await createStudioEntry(target, text, pendingStart?.project);
      setPendingStart(undefined);
      router.push(studioEntryHref(project.id, target, { send: target === "assistant" && !!text.trim() }));
    } catch (e) {
      if (e instanceof StudioEntrySaveError) setPendingStart({ project: e.project, entry: pendingStart?.entry ?? entry, brief: pendingStart?.brief ?? brief });
      if (isProductNotEnrolledError(e)) setNotEnrolled(true);
      else setActionError(e);
      setCreating(undefined); creatingRef.current = false;
    }
  };

  if (authState === "no-platform" || notEnrolled || templates.notEnrolled) return <PlatformGateScreen />;
  if (!ready) return <StudioPage title="画布·自由创作" description="自由连接想法与素材，把灵感变成作品。"><GalleryState loading/></StudioPage>;

  return <StudioPage title="画布·自由创作" description="自由连接想法与素材，把灵感变成作品。" contentRef={surface} className="studio-gallery-page studio-create-page">
    {usingTemplate && <StudioTemplateUse key={usingTemplate.versionId || usingTemplate.id} template={usingTemplate} onClose={() => setUsingTemplate(undefined)} onCreated={id => router.push(`/projects/${id}`)} />}
    {actionError && <div className="studio-gallery-action-error"><StudioErrorNotice error={actionError}/>{pendingStart && <><span> · 画布已创建，重试会继续保存到同一张画布。</span><Link href={`/projects/${pendingStart.project.id}`}>打开已创建的画布</Link></>}</div>}
    <section className="studio-gallery-panel studio-creation-section" id="start-creation" aria-label="开始创作">
      <StudioCreationBrief creating={creating} pending={!!pendingStart} onStart={(entry, brief) => void start(entry, brief)}/>
    <nav className="studio-create-tools" aria-label="快速开始创作">{studioCreateTools.map(({entry, description, image}, index) => <button type="button" className="studio-create-tool" key={entry} aria-label={studioEntries[entry].title} aria-busy={creating === entry} disabled={creating !== undefined || !!pendingStart} onClick={() => void start(entry)}>
      <div className="studio-create-tool-visual">{image ? <Image src={`/studio/create/${image}.webp`} alt="" width={960} height={640} sizes="(min-width: 960px) 20vw, 50vw" loading={index < 5 ? "eager" : "lazy"}/> : <div className="studio-tool-blank-preview" aria-hidden="true"><span><BookOpen size={16}/>文字</span><span><ImagePlus size={16}/>图片</span><span><Mic size={16}/>声音</span><span><Video size={16}/>视频</span></div>}</div>
      <div className="studio-create-tool-copy"><strong>{studioEntries[entry].title}</strong>{creating === entry ? <Loader2 size={15} className="studio-gallery-spinner" aria-hidden="true"/> : <ArrowRight size={15} aria-hidden="true"/>}<p>{description}</p></div>
    </button>)}</nav>

    <div className="studio-creation-templates" id="templates"><div className="studio-gallery-panel-heading"><h2>从模板开始</h2><Link className="studio-gallery-more" href="/templates">更多模板 <ArrowRight size={16} /></Link></div>
      {templates.error ? <GalleryState error={templates.error} retry={templates.reload} /> : templates.loading ? <GalleryState loading /> : official.length ? <div className="studio-template-grid">{official.map(t => <TemplateCard key={t.id} template={t} onOpen={setUsingTemplate} />)}</div> : <GalleryState><p>官方模板正在准备中。你可以先从空白画布开始。</p></GalleryState>}
    </div>
    </section>
  </StudioPage>;
}
