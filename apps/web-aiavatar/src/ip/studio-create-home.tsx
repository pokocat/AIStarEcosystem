"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "antd";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Clapperboard, Film, ImagePlus, LayoutGrid, Layers, List, Loader2, Mic, MoreHorizontal, Plus, ShoppingBag, Sparkles, Trash2, UserRound, Video } from "lucide-react";
import type { IpProjectSummary, IpTemplate } from "@ai-star-eco/types";
import { isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { IpStudioApi } from "./api";
import { createStudioEntry, studioEntries, studioEntryHref, type StudioEntry } from "./studio-entry";
import { CanvasThumb } from "./canvas-thumb";
import { StudioTemplateUse } from "./studio-template-use";
import { GallerySearch, GalleryState, TemplateCard, useCanvasPreviews, useStudioList } from "./studio-gallery";
import { formatDateTime } from "@/lib/datetime";

const quickTemplates = [
  ["ip-launch-female", "个人 IP · 女生", UserRound], ["ip-launch-male", "个人 IP · 男生", UserRound],
  ["IPD-studio-digital", "数字人视频", Clapperboard], ["IPD-studio-commerce", "IP 商品视频", ShoppingBag],
] as const;
const quickEntries = [["image", ImagePlus], ["video", Video], ["script", BookOpen], ["blank", Plus]] as const;
const moreTools = [
  ["director", Clapperboard], ["work", Film], ["speech", Mic], ["lip", UserRound], ["library", Layers],
] as const;
const PAGE_SIZE = 5;

export function StudioCreateHome() {
  const router = useRouter();
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const projects = useStudioList(IpStudioApi.listProjects, ready);
  const templates = useStudioList(IpStudioApi.listTemplates, ready);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState<StudioEntry>();
  const creatingRef = useRef(false);
  const [actionError, setActionError] = useState("");
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [usingTemplate, setUsingTemplate] = useState<IpTemplate>();
  const [pendingDelete, setPendingDelete] = useState<IpProjectSummary>();
  const [deleting, setDeleting] = useState(false);
  const deleteRef = useRef(false);
  const [deleteError, setDeleteError] = useState("");
  const surface = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => projects.data.filter(p =>
    (status === "all" || p.status === status) && p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "zh-CN") : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt)), [projects.data, status, query, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const { previews, retry: retryPreviews } = useCanvasPreviews(ready ? visible : []);
  const official = templates.data.filter(t => t.visibility !== "personal" && t.enabled !== false).slice(0, 5);

  const start = async (entry: StudioEntry) => {
    if (creatingRef.current) return;
    creatingRef.current = true; setCreating(entry); setActionError("");
    try {
      const project = await createStudioEntry(entry);
      router.push(studioEntryHref(project.id, entry));
    } catch (e) {
      if (isProductNotEnrolledError(e)) setNotEnrolled(true);
      else setActionError(e instanceof Error ? e.message : "画布没有创建成功，请重试");
      setCreating(undefined); creatingRef.current = false;
    }
  };
  const remove = async () => {
    if (!pendingDelete || deleteRef.current) return;
    deleteRef.current = true; setDeleting(true); setDeleteError("");
    try {
      await IpStudioApi.deleteProject(pendingDelete.id);
      projects.setData(items => items.filter(p => p.id !== pendingDelete.id));
      setPendingDelete(undefined);
    } catch (e) { setDeleteError(e instanceof Error ? e.message : "删除失败，请重试"); }
    finally { deleteRef.current = false; setDeleting(false); }
  };

  if (authState === "no-platform" || notEnrolled || projects.notEnrolled || templates.notEnrolled) return <PlatformGateScreen />;
  if (!ready) return <main className="ip-brand-surface studio-gallery-page"><GalleryState loading /></main>;

  return <main ref={surface} className="ip-brand-surface studio-gallery-page studio-create-page" data-studio-overlay-root>
    {usingTemplate && <StudioTemplateUse key={usingTemplate.versionId || usingTemplate.id} template={usingTemplate} onClose={() => setUsingTemplate(undefined)} onCreated={id => router.push(`/projects/${id}`)} />}
    <header className="studio-gallery-heading"><div><h1>创作</h1><p>在同一画布里打造 IP、写剧本、生成分镜与视频，再合成作品。</p></div><span className="studio-gallery-heading-note"><Sparkles size={16} />从一个灵感开始</span></header>

    <nav className="studio-quick-start" aria-label="快速开始创作">{quickTemplates.map(([id, label, Icon]) => {
      const template = templates.data.find(t => t.id === id && t.enabled !== false);
      return <button type="button" key={id} disabled={!template || creating !== undefined} title={!template ? "模板暂不可用" : "只读预览，存为个人副本后编辑"} onClick={() => { if (template && !creatingRef.current) setUsingTemplate(template); }}><Icon size={21} aria-hidden="true" /><span>{label}</span></button>;
    })}{quickEntries.map(([entry, Icon]) => <button type="button" key={entry} disabled={creating !== undefined} onClick={() => void start(entry)}>
      {creating === entry ? <Loader2 className="studio-gallery-spinner" size={21} /> : <Icon size={21} aria-hidden="true" />}<span>{studioEntries[entry].title}</span>
    </button>)}</nav>
    <nav className="studio-more-tools" aria-label="更多创作工具"><span>更多工具</span>{moreTools.map(([entry, Icon]) => <button type="button" key={entry} disabled={creating !== undefined} onClick={() => void start(entry)}><Icon size={15} aria-hidden="true" />{studioEntries[entry].title}</button>)}</nav>
    {actionError && <div className="studio-gallery-action-error" role="alert">{actionError}</div>}

    <section className="studio-gallery-panel" aria-labelledby="my-canvases-heading">
      <div className="studio-gallery-panel-heading"><h2 id="my-canvases-heading">我的画布 <span>{projects.loading || projects.error ? "" : projects.data.length}</span></h2><div className="studio-gallery-controls">
        <GallerySearch label="搜索我的画布" placeholder="搜索画布名称…" value={query} onChange={v => { setQuery(v); setPage(1); }} />
        <label className="studio-gallery-sort"><select aria-label="画布排序" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="updated">最近编辑</option><option value="created">最近创建</option><option value="name">名称排序</option></select></label>
        <div className="studio-gallery-view" role="group" aria-label="画布显示方式"><button type="button" aria-label="网格视图" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={18} /></button><button type="button" aria-label="列表视图" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={19} /></button></div>
      </div></div>
      <div className="studio-gallery-filters" role="group" aria-label="画布状态">{([['all', '全部'], ['draft', '草稿'], ['published', '已发布']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}<span>{projects.loading || projects.error ? "—" : value === "all" ? projects.data.length : projects.data.filter(p => p.status === value).length}</span></button>)}</div>
      {projects.error ? <GalleryState error={projects.error} retry={projects.reload} /> : projects.loading ? <GalleryState loading /> : <>
        {!filtered.length && <div className="studio-gallery-empty"><Layers size={29} /><h3>{projects.data.length ? "没有找到符合条件的画布" : "从第一张画布开始"}</h3><p>{projects.data.length ? "换个关键词，或清除当前筛选。" : "选择上方创作入口，或预览一套官方模板。"}</p>{projects.data.length > 0 && <button type="button" className="ip-brand-text-button" onClick={() => { setQuery(""); setStatus("all"); setPage(1); }}>清除筛选</button>}</div>}
        <div className={`studio-project-grid studio-project-${view}`}>{visible.map(project => {
          const preview = previews[`${project.id}:${project.updatedAt}`];
          return <article className="studio-project-card" key={project.id}>
            <Link href={`/projects/${project.id}`} className="studio-project-open" aria-label={`打开画布 ${project.name}`}><div className="studio-gallery-preview">
              {preview?.doc ? <CanvasThumb doc={preview.doc} height={146} /> : <div className="studio-gallery-preview-pending">{preview?.error ? <span>{preview.error}</span> : <Loader2 size={20} className="studio-gallery-spinner" aria-label="正在加载画布预览" />}</div>}
            </div><h3 title={project.name}>{project.name}</h3></Link>
            <div className="studio-project-info"><div><span className={`studio-project-status is-${project.status}`}><i />{project.status === "published" ? "已发布" : "草稿"}</span><time dateTime={project.updatedAt}>{formatDateTime(project.updatedAt)}</time></div>
              <details className="studio-project-menu"><summary aria-label={`画布 ${project.name} 的更多操作`}><MoreHorizontal size={18} /></summary><div><Link href={`/projects/${project.id}`}><ArrowRight size={15} />打开画布</Link><button type="button" onClick={e => { e.currentTarget.closest("details")?.removeAttribute("open"); setDeleteError(""); setPendingDelete(project); }}><Trash2 size={15} />删除画布</button></div></details>
            </div>
          </article>;
        })}<button type="button" className="studio-new-canvas" disabled={creating !== undefined} onClick={() => void start("blank")}>{creating === "blank" ? <Loader2 size={26} className="studio-gallery-spinner" /> : <Plus size={28} strokeWidth={1.4} />}<strong>新建画布</strong><span>从空白开始创作</span></button></div>
        <footer className="studio-gallery-pagination"><span>{filtered.length ? `共 ${filtered.length} 张画布 · 第 ${currentPage} / ${totalPages} 页` : ""}</span><div>{visible.some(p => previews[`${p.id}:${p.updatedAt}`]?.error) && <button type="button" className="studio-preview-retry" onClick={retryPreviews}>重试预览</button>}<button type="button" aria-label="上一页画布" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button><span className="studio-gallery-current-page" aria-current="page">{currentPage}</span><button type="button" aria-label="下一页画布" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></div></footer>
      </>}
    </section>

    <section className="studio-gallery-panel" id="templates" aria-labelledby="official-templates-heading"><div className="studio-gallery-panel-heading"><div><h2 id="official-templates-heading">官方模板</h2><p>从模板开始，快速搭建你的专属 IP 创作流程。</p></div><Link className="studio-gallery-more" href="/templates">查看更多模板 <ArrowRight size={16} /></Link></div>
      {templates.error ? <GalleryState error={templates.error} retry={templates.reload} /> : templates.loading ? <GalleryState loading /> : official.length ? <div className="studio-template-grid">{official.map(t => <TemplateCard key={t.id} template={t} onOpen={setUsingTemplate} />)}</div> : <GalleryState><p>官方模板正在准备中。你可以先从空白画布开始。</p></GalleryState>}
    </section>

    <Modal open={!!pendingDelete} title="删除画布" footer={null} onCancel={() => { if (!deleting) setPendingDelete(undefined); }} closable={!deleting} keyboard={!deleting} mask={{ closable: !deleting }} getContainer={() => surface.current || document.body} className="ip-management-editor studio-gallery-delete" centered>
      <p>确认删除「{pendingDelete?.name}」？画布内的节点和连线将一并删除，此操作无法撤销。</p>{deleteError && <p className="studio-gallery-action-error" role="alert">{deleteError}</p>}<div className="studio-gallery-delete-actions"><button type="button" className="ip-brand-secondary" disabled={deleting} onClick={() => setPendingDelete(undefined)}>取消</button><button type="button" className="ip-brand-button" disabled={deleting} onClick={() => void remove()}>{deleting && <Loader2 size={16} className="studio-gallery-spinner" />}{deleting ? "正在删除…" : "确认删除"}</button></div>
    </Modal>
  </main>;
}
