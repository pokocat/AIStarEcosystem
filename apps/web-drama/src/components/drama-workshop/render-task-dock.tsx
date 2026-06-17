"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Activity, Check, ChevronDown, ChevronUp, CircleAlert, Cpu, Image as ImageIcon, Loader2, Video } from "lucide-react";
import { RenderApi } from "@/api";
import type { DramaRenderTask, RenderTaskSnapshot } from "@/api/render";

function isActiveTask(t: DramaRenderTask) {
  return t.status === "queued" || t.status === "running" || t.status === "rendering";
}

function statusLabel(t: DramaRenderTask) {
  if (t.status === "ready") return "已完成";
  if (t.status === "failed") return "失败";
  if (t.status === "queued") return "排队中";
  return t.stage || "处理中";
}

function taskLabel(t: DramaRenderTask) {
  const prefix = t.task_type === "frame" ? "首帧" : "视频";
  const ep = t.episode_no ? `第${t.episode_no}集 ` : "";
  const shot = t.shot_id ? `镜头 ${t.shot_id.slice(-5)}` : t.name;
  return `${prefix} · ${ep}${shot}`;
}

function TaskIcon({ task }: { task: DramaRenderTask }) {
  if (task.status === "failed") return <CircleAlert size={14} />;
  if (task.status === "ready") return <Check size={14} />;
  if (task.task_type === "frame") return <ImageIcon size={14} />;
  return <Video size={14} />;
}

export function RenderTaskDock() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState<RenderTaskSnapshot | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await RenderApi.listRenderTasks();
        if (!cancelled) setSnapshot(next);
      } catch {
        if (!cancelled) setSnapshot(null);
      }
    };
    void load();
    const timer = window.setInterval(load, 6000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const tasks = snapshot?.tasks ?? [];
  const visible = tasks.filter((t) => isActiveTask(t) || t.status === "failed" || t.status === "ready").slice(0, 6);
  const activeCount = tasks.filter(isActiveTask).length;
  const summary = snapshot?.summary;
  const running = summary?.total.running ?? 0;
  const queued = summary?.total.queued ?? 0;
  const limit = Math.max(1, summary?.total.limit ?? 1);
  const loadPct = Math.min(100, Math.round((running / limit) * 100));
  const isWorkshop = !!pathname?.match(/^\/projects\/[^/]+(\/.*)?$/) && !pathname.startsWith("/projects/new");

  if (visible.length === 0) return null;

  return (
    <>
      <div className={`render-task-dock${isWorkshop ? " is-workshop" : ""}`} aria-live="polite">
        <button
          type="button"
          className="render-task-head"
          onClick={() => setOpen((v) => !v)}
          title="后台生成"
        >
          <span className="render-task-icon">
            {activeCount > 0 ? <Loader2 size={15} className="render-task-spin" /> : <Activity size={15} />}
          </span>
          <span className="render-task-title">
            后台生成
            <span>{activeCount > 0 ? `${activeCount} 个进行中` : "空闲"}</span>
          </span>
          <span className="render-task-load">
            <Cpu size={13} />
            {running}/{limit}
          </span>
          {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>

        {open && (
          <div className="render-task-panel">
            <div className="render-task-meter">
              <div className="render-task-meter-top">
                <span>生成队列</span>
                <span>{queued} 排队</span>
              </div>
              <div className="render-task-bar">
                <span style={{ width: `${loadPct}%` }} />
              </div>
              <div className="render-task-lanes">
                <span>首帧 {summary?.frame.running ?? 0}/{summary?.frame.limit ?? 2}</span>
                <span>视频 {summary?.video.running ?? 0}/{summary?.video.limit ?? 3}</span>
              </div>
            </div>

            <div className="render-task-list">
              {visible.length === 0 ? (
                <div className="render-task-empty">当前没有后台生成任务</div>
              ) : (
                visible.map((task) => (
                  <div key={`${task.task_type}-${task.id}`} className="render-task-row">
                    <span className={`render-task-state state-${task.status}`}>
                      <TaskIcon task={task} />
                    </span>
                    <span className="render-task-copy">
                      <strong>{taskLabel(task)}</strong>
                      <span>{statusLabel(task)}</span>
                    </span>
                    <span className="render-task-pct">{task.progress_pct ?? (task.status === "ready" ? 100 : 0)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .render-task-dock {
          position: fixed;
          left: 252px;
          bottom: 18px;
          z-index: 90;
          width: min(340px, calc(100vw - 28px));
          color: var(--ink);
        }
        .render-task-dock.is-workshop {
          left: 342px;
        }
        .render-task-head,
        .render-task-panel {
          border: 1px solid var(--line);
          background: var(--surface);
          box-shadow: var(--shadow-lg);
        }
        .render-task-head {
          width: 100%;
          height: 44px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          border-radius: 12px;
          cursor: pointer;
        }
        .render-task-icon {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          color: var(--accent);
          background: var(--accent-soft);
          flex: none;
        }
        .render-task-title {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1px;
          font-size: 12.5px;
          font-weight: 800;
        }
        .render-task-title span {
          color: var(--ink-3);
          font-size: 10.5px;
          font-weight: 600;
        }
        .render-task-load {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 24px;
          padding: 0 8px;
          border-radius: 999px;
          color: var(--ink-2);
          background: var(--surface-2);
          font-size: 11px;
          font-weight: 800;
          flex: none;
        }
        .render-task-panel {
          margin-top: 8px;
          border-radius: 14px;
          overflow: hidden;
        }
        .render-task-meter {
          padding: 12px;
          border-bottom: 1px solid var(--line-soft);
        }
        .render-task-meter-top,
        .render-task-lanes {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: var(--ink-3);
          font-size: 11px;
          font-weight: 700;
        }
        .render-task-meter-top {
          color: var(--ink);
          font-size: 12px;
          margin-bottom: 8px;
        }
        .render-task-bar {
          height: 7px;
          overflow: hidden;
          border-radius: 999px;
          background: var(--surface-2);
          border: 1px solid var(--line-soft);
          margin-bottom: 8px;
        }
        .render-task-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--accent);
          transition: width 180ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .render-task-list {
          max-height: 260px;
          overflow: auto;
          padding: 6px;
        }
        .render-task-row {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 8px;
          border-radius: 10px;
        }
        .render-task-row + .render-task-row {
          margin-top: 2px;
        }
        .render-task-row:hover {
          background: var(--surface-2);
        }
        .render-task-state {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          color: var(--accent);
          background: var(--accent-soft);
          flex: none;
        }
        .state-failed {
          color: oklch(0.58 0.17 28);
          background: oklch(0.95 0.035 28);
        }
        .state-ready {
          color: oklch(0.48 0.12 150);
          background: oklch(0.94 0.035 150);
        }
        .render-task-copy {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .render-task-copy strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 800;
        }
        .render-task-copy span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--ink-3);
          font-size: 11px;
        }
        .render-task-pct {
          color: var(--ink-3);
          font-size: 11px;
          font-weight: 800;
          flex: none;
        }
        .render-task-empty {
          padding: 22px 12px;
          text-align: center;
          color: var(--ink-3);
          font-size: 12px;
        }
        .render-task-spin {
          animation: drama-spin 0.8s linear infinite;
        }
        @media (max-width: 900px) {
          .render-task-dock {
            left: 14px;
            bottom: 14px;
          }
        }
      `}</style>
    </>
  );
}
