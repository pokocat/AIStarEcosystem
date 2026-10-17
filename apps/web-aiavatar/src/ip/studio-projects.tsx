"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "antd";
import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid, Layers, List, Loader2, MoreHorizontal, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { IpProjectSummary } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { IpStudioApi } from "./api";
import { CanvasThumb } from "./canvas-thumb";
import { GallerySearch, GalleryState, useCanvasPreviews, useStudioList } from "./studio-gallery";
import { StudioPage } from "./studio-page";
import { StudioSelect } from "./studio-select";
import { StudioErrorNotice, useStudioErrorState } from "./studio-errors";
import { formatDateTime } from "@/lib/datetime";

const PAGE_SIZE = 24;

export function StudioProjects() {
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const projects = useStudioList(IpStudioApi.listProjects, ready);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<IpProjectSummary>();
  const [deleting, setDeleting] = useState(false);
  const deleteRef = useRef(false);
  const [deleteError, setDeleteError] = useStudioErrorState();
  const surface = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => projects.data.filter(p =>
    (status === "all" || p.status === status) && p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "zh-CN") : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt)), [projects.data, status, query, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const { previews, retry: retryPreviews } = useCanvasPreviews(ready ? visible : []);
  const remove = async () => {
    if (!pendingDelete || deleteRef.current) return;
    deleteRef.current = true; setDeleting(true); setDeleteError("");
    try {
      await IpStudioApi.deleteProject(pendingDelete.id);
      projects.setData(items => items.filter(p => p.id !== pendingDelete.id));
      setPendingDelete(undefined);
    } catch (e) { setDeleteError(e); }
    finally { deleteRef.current = false; setDeleting(false); }
  };

  if (authState === "no-platform" || projects.notEnrolled) return <PlatformGateScreen/>;
  if (!ready) return <StudioPage title="项目" description="管理画布，接续每一次创作。"><GalleryState loading/></StudioPage>;

  return <StudioPage title="项目" description="管理画布，接续每一次创作。" contentRef={surface} className="studio-gallery-page studio-projects-page" actions={<Link className="ip-brand-button" href="/create"><Plus size={16}/>新建创作</Link>}>
    <section className="studio-gallery-panel studio-canvas-catalogue" aria-label="我的画布">
      <div className="studio-page-toolbar studio-gallery-controls">
        <GallerySearch label="搜索我的画布" placeholder="搜索画布名称…" value={query} onChange={v => { setQuery(v); setPage(1); }} />
        <StudioSelect label="画布状态" value={status} onChange={value => { setStatus(value as typeof status); setPage(1); }} options={[{value:"all",label:"全部状态"},{value:"draft",label:"草稿"},{value:"published",label:"已发布"}]}/>
        <StudioSelect label="画布排序" value={sort} onChange={value => { setSort(value); setPage(1); }} options={[{value:"updated",label:"最近编辑"},{value:"created",label:"最近创建"},{value:"name",label:"名称排序"}]}/>
        <div className="studio-gallery-view" role="group" aria-label="画布显示方式"><button type="button" aria-label="网格视图" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={18} /></button><button type="button" aria-label="列表视图" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={19} /></button></div>
        <button type="button" className="studio-page-refresh" aria-label="刷新画布" disabled={projects.loading} onClick={projects.reload}><RefreshCw size={16}/></button>
      </div>
      <div className="studio-page-result" aria-live="polite">{projects.loading ? '正在读取画布…' : projects.error ? '暂时无法读取画布' : `${filtered.length} 张${query.trim() || status !== 'all' ? '匹配' : ''}画布`}</div>
      {projects.error ? <GalleryState error={projects.error} retry={projects.reload} /> : projects.loading ? <GalleryState loading /> : <>
        {!filtered.length && <div className="studio-gallery-empty"><Layers size={24} /><h3>{projects.data.length ? "没有找到符合条件的画布" : "从第一张画布开始"}</h3><p>{projects.data.length ? "换个关键词，或清除当前筛选。" : "开始一次创作，画布会保存在这里。"}</p>{projects.data.length > 0 ? <button type="button" className="ip-brand-text-button" onClick={() => { setQuery(""); setStatus("all"); setPage(1); }}>清除筛选</button> : <Link className="ip-brand-text-button" href="/create">开始创作 <ArrowRight size={15}/></Link>}</div>}
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
        })}</div>
        {(totalPages > 1 || visible.some(p => previews[`${p.id}:${p.updatedAt}`]?.error)) && <footer className="studio-gallery-pagination"><span>{filtered.length ? `共 ${filtered.length} 张画布 · 第 ${currentPage} / ${totalPages} 页` : ""}</span><div>{visible.some(p => previews[`${p.id}:${p.updatedAt}`]?.error) && <button type="button" className="studio-preview-retry" onClick={retryPreviews}>重试预览</button>}{totalPages > 1 && <><button type="button" aria-label="上一页画布" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button><span className="studio-gallery-current-page" aria-current="page">{currentPage}</span><button type="button" aria-label="下一页画布" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></>}</div></footer>}
      </>}
    </section>

    <Modal open={!!pendingDelete} title="删除画布" footer={null} onCancel={() => { if (!deleting) setPendingDelete(undefined); }} closable={!deleting} keyboard={!deleting} mask={{ closable: !deleting }} getContainer={() => surface.current || document.body} className="ip-management-editor studio-gallery-delete" centered>
      <p>确认删除「{pendingDelete?.name}」？画布内的节点和连线将一并删除，此操作无法撤销。</p>{deleteError && <p className="studio-gallery-action-error"><StudioErrorNotice error={deleteError}/></p>}<div className="studio-gallery-delete-actions"><button type="button" className="ip-brand-secondary" disabled={deleting} onClick={() => setPendingDelete(undefined)}>取消</button><button type="button" className="ip-brand-button" disabled={deleting} onClick={() => void remove()}>{deleting && <Loader2 size={16} className="studio-gallery-spinner" />}{deleting ? "正在删除…" : "确认删除"}</button></div>
    </Modal>
  </StudioPage>;
}
