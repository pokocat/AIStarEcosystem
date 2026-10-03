"use client";

// 后台生成面板：首帧 / 视频任务在后台跑，这里集中显示进度。
//
// v0.197：
//   · 同一页上可能同时挂好几个面板（通用侧栏、手机抽屉、短剧工作台的阶段轨 / 分集轨、≤860 的顶栏小入口），
//     之前每个各轮询一遍。现在共用一个模块级轮询（useRenderTasks），谁订阅谁读。
//   · 在某一部短剧里（/projects/<id>）只列这部短剧的任务；之前列的是所有短剧的，行上又没写是哪一部。
//   · 任务从「进行中」变成「完成 / 失败」时调 notifyWalletChanged()：失败会退积分，完成后余额要对上。
//   · 行标题用提交时写好的名字（「第 1 集 镜 3 首帧」），不再显示镜头 id 的末 5 位。
//   · 不再显示「1/5」这种并发上限读数，改成「几个在生成、几个在排队」+ 一句上限说明。
//   · 评审后：「几个在生成 / 排队」、首帧 / 视频各几个，一律按面板里列出的这批任务（自己的、在短剧里时只算这部）数。
//     之前读的是 summary.total —— 那是全平台的计数，于是入口写「没有在生成的」，点开却说「3 个在生成」。
//     全平台排队单独一块，明确写「平台排队」，和自己的分开。
import * as React from "react";
import { usePathname } from "next/navigation";
import { Activity, Check, ChevronDown, ChevronUp, CircleAlert, Image as ImageIcon, Loader2, Video, X } from "lucide-react";
import { RenderApi } from "@/api";
import type { DramaRenderTask, RenderTaskSnapshot } from "@/api/render";
import { ModalShell } from "@/components/common/ModalShell";
import { aiErrorMessage } from "@/lib/ai-error";
import { notifyWalletChanged } from "@/lib/use-wallet";

function isActiveTask(t: DramaRenderTask) {
  return t.status === "queued" || t.status === "running" || t.status === "rendering";
}

function statusLabel(t: DramaRenderTask) {
  if (t.status === "ready") return "已完成";
  if (t.status === "failed") return "失败";
  if (t.status === "queued") return "排队中";
  // stage 是服务端给的阶段说明；纯英文的是内部状态名，不给用户看
  const stage = (t.stage ?? "").trim();
  if (!stage || /^[\x00-\x7F]+$/.test(stage)) return "生成中";
  return stage;
}

// 服务端 / mock 给的兜底名字，不是具体哪一镜，不拿来当标题
const GENERIC_NAMES = new Set(["首帧渲染", "短剧分镜", "短剧首帧"]);

function taskLabel(t: DramaRenderTask) {
  const kind = t.task_type === "frame" ? "首帧" : "视频";
  const name = (t.name ?? "").trim();
  if (name && !GENERIC_NAMES.has(name)) return name.includes(kind) ? name : `${name} ${kind}`;
  const ep = t.episode_no ? `第 ${t.episode_no} 集 ` : "";
  return `${ep}镜头${kind}`;
}

function TaskIcon({ task }: { task: DramaRenderTask }) {
  if (task.status === "failed") return <CircleAlert size={14} />;
  if (task.status === "ready") return <Check size={14} />;
  if (task.task_type === "frame") return <ImageIcon size={14} />;
  return <Video size={14} />;
}

/** 当前页面会不会产生生成任务；会的话返回按哪部作品过滤（undefined = 不过滤）。 */
function renderScope(pathname: string | null): { on: boolean; projectId?: string } {
  if (!pathname) return { on: false };
  const m = pathname.match(/^\/projects\/([^/]+)/);
  if (m) {
    if (m[1] === "new" || m[1] === "trash") return { on: false };
    return { on: true, projectId: decodeURIComponent(m[1]) };
  }
  if (pathname.startsWith("/shorts/make")) return { on: true };
  return { on: false };
}

// ── 共享轮询 ────────────────────────────────────────────────────────────────
type Listener = () => void;
const store = {
  key: null as string | null,
  projectId: undefined as string | undefined,
  snapshot: null as RenderTaskSnapshot | null,
  listeners: new Set<Listener>(),
  timer: null as ReturnType<typeof setTimeout> | null,
  gen: 0,
  prevActive: null as Set<string> | null,
};

function emit() {
  for (const l of store.listeners) l();
}

function taskKey(t: DramaRenderTask) {
  return `${t.task_type}-${t.id}`;
}

async function load(gen: number) {
  if (gen !== store.gen) return;
  if (typeof document !== "undefined" && document.hidden) {
    schedule(gen, false);
    return;
  }
  try {
    const next = await RenderApi.listRenderTasks(store.projectId);
    if (gen !== store.gen) return;
    const tasks = next.tasks ?? [];
    const active = new Set(tasks.filter(isActiveTask).map(taskKey));
    // 有任务结束（完成扣费 / 失败退回）→ 让所有余额显示重读一次
    if (store.prevActive && [...store.prevActive].some((k) => !active.has(k))) notifyWalletChanged();
    store.prevActive = active;
    store.snapshot = next;
    emit();
    schedule(gen, active.size > 0);
  } catch {
    if (gen !== store.gen) return;
    store.snapshot = null;
    emit();
    schedule(gen, false);
  }
}

function schedule(gen: number, hasActive: boolean) {
  if (gen !== store.gen) return;
  if (store.timer !== null) clearTimeout(store.timer);
  store.timer = setTimeout(() => void load(gen), hasActive ? 6000 : 15000);
}

function restart() {
  store.gen += 1;
  if (store.timer !== null) clearTimeout(store.timer);
  store.timer = null;
  void load(store.gen);
}

function stop() {
  store.gen += 1;
  if (store.timer !== null) clearTimeout(store.timer);
  store.timer = null;
}

function onVisible() {
  if (typeof document !== "undefined" && !document.hidden && store.listeners.size > 0) restart();
}

function subscribe(key: string, projectId: string | undefined, fn: Listener) {
  const wasEmpty = store.listeners.size === 0;
  store.listeners.add(fn);
  if (store.key !== key) {
    store.key = key;
    store.projectId = projectId;
    store.snapshot = null;
    store.prevActive = null;
    restart();
  } else if (wasEmpty) {
    // 没人看的那段时间里结束的任务不补通知（重新挂载的余额组件自己会读一次）
    store.prevActive = null;
    restart();
  }
  if (wasEmpty) document.addEventListener("visibilitychange", onVisible);
  return () => {
    store.listeners.delete(fn);
    if (store.listeners.size === 0) {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

/** 读当前页面的后台生成任务（多个面板共用一个轮询）。不在会生成的页面时返回 on=false。 */
export function useRenderTasks() {
  const pathname = usePathname();
  const scope = renderScope(pathname);
  const key = scope.on ? `p:${scope.projectId ?? "*"}` : null;
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => {
    if (!key) return;
    return subscribe(key, scope.projectId, force);
    // scope.projectId 由 key 决定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const snapshot = key && store.key === key ? store.snapshot : null;
  const tasks = snapshot?.tasks ?? [];
  // 只展示活跃 + 最近的有限几个（活跃优先，最多 6 条）
  const visible = tasks
    .filter((t) => isActiveTask(t) || t.status === "failed" || t.status === "ready")
    .sort((a, b) => Number(isActiveTask(b)) - Number(isActiveTask(a)))
    .slice(0, 6);
  const counts = countTasks(tasks);
  return { on: !!key, snapshot, visible, counts, activeCount: counts.running + counts.queued };
}

export interface RenderTaskCounts {
  running: number;
  queued: number;
  frameRunning: number;
  videoRunning: number;
}

/** 自己的任务里各有几个在生成 / 排队（tasks 已按当前页面过滤）。 */
function countTasks(tasks: DramaRenderTask[]): RenderTaskCounts {
  const c: RenderTaskCounts = { running: 0, queued: 0, frameRunning: 0, videoRunning: 0 };
  for (const t of tasks) {
    if (t.status === "queued") c.queued += 1;
    else if (t.status === "running" || t.status === "rendering") {
      c.running += 1;
      if (t.task_type === "frame") c.frameRunning += 1;
      else c.videoRunning += 1;
    }
  }
  return c;
}

// ── 面板内容（侧栏卡片与底部弹层共用） ─────────────────────────────────────
function TaskPanel({
  snapshot,
  visible,
  counts,
}: {
  snapshot: RenderTaskSnapshot | null;
  visible: DramaRenderTask[];
  counts: RenderTaskCounts;
}) {
  const summary = snapshot?.summary;
  const { running, queued } = counts;
  // 下面这块是全平台的：并发上限与排队，不是自己的任务数
  const platformQueued = summary?.total.queued ?? 0;
  const frameLimit = summary?.frame.limit ?? 2;
  const videoLimit = summary?.video.limit ?? 3;
  return (
    <div className="render-task-panel">
      <div className="render-task-meter" data-running={running} data-queued={queued}>
        <div className="render-task-meter-top">
          <span>{running > 0 ? `${running} 个在生成` : queued > 0 ? "都在排队" : "现在没有在生成的"}</span>
          {queued > 0 && <span>{queued} 个在排队</span>}
        </div>
        <div className="render-task-lanes">
          <span>首帧 {counts.frameRunning} 张生成中</span>
          <span>视频 {counts.videoRunning} 条生成中</span>
        </div>
      </div>
      {summary && (
        <div className="render-task-platform" data-platform-queued={platformQueued}>
          <div className="render-task-platform-top">
            <span>平台排队</span>
            <span>{platformQueued > 0 ? `${platformQueued} 个` : "不用等"}</span>
          </div>
          <div className="render-task-note">
            平台同时最多生成 {frameLimit} 张首帧、{videoLimit} 条视频，多出来的按提交顺序排队。
          </div>
        </div>
      )}

      <div className="render-task-list">
        {visible.map((task) => {
          const label = taskLabel(task);
          const err =
            task.status === "failed"
              ? aiErrorMessage(task.error_message ?? "", "没生成出来，回到这一镜再试一次")
              : null;
          return (
            <div key={`${task.task_type}-${task.id}`} className="render-task-row">
              <span className={`render-task-state state-${task.status}`}>
                <TaskIcon task={task} />
              </span>
              <span className="render-task-copy">
                <strong title={label}>{label}</strong>
                {err ? (
                  <span className="render-task-err">失败：{err}</span>
                ) : (
                  <span>{statusLabel(task)}</span>
                )}
              </span>
              <span className="render-task-pct">{task.progress_pct ?? (task.status === "ready" ? 100 : 0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function headSub(activeCount: number) {
  return activeCount > 0 ? `${activeCount} 个进行中` : "没有在生成的";
}

/** 侧栏 / 阶段轨里的后台生成卡片：没有任务时不渲染。 */
export function RenderTaskDock({ style }: { style?: React.CSSProperties } = {}) {
  const { on, snapshot, visible, counts, activeCount } = useRenderTasks();
  const [open, setOpen] = React.useState(false);

  if (!on || visible.length === 0) return null;

  return (
    <div className="render-task-dock" style={style} aria-live="polite">
      {open && <TaskPanel snapshot={snapshot} visible={visible} counts={counts} />}
      <button
        type="button"
        className="render-task-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? "收起后台生成" : "查看正在生成的首帧和视频"}
      >
        <span className="render-task-icon">
          {activeCount > 0 ? <Loader2 size={15} className="render-task-spin" /> : <Activity size={15} />}
        </span>
        <span className="render-task-title">
          后台生成
          <span>{headSub(activeCount)}</span>
        </span>
        {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>
    </div>
  );
}

/**
 * 顶栏里的「后台生成 N」小入口。手机和平板上侧栏收进抽屉，RenderTaskDock 看不到，
 * 由它补位：点开是底部弹层，内容与侧栏卡片相同。显示与否由外层 CSS 决定（通用外壳里是 ≤860 才出现）。
 */
export function RenderTaskTopbarEntry({ className }: { className?: string } = {}) {
  const { on, snapshot, visible, counts, activeCount } = useRenderTasks();
  const [open, setOpen] = React.useState(false);

  if (!on || visible.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className={["render-task-pill", className].filter(Boolean).join(" ")}
        onClick={() => setOpen(true)}
        title="查看正在生成的首帧和视频"
        aria-label={`后台生成，${headSub(activeCount)}`}
      >
        {activeCount > 0 ? <Loader2 size={14} className="render-task-spin" /> : <Activity size={14} />}
        <span className="ws-btn-label">后台生成</span>
        {activeCount > 0 && <b>{activeCount}</b>}
      </button>
      {open && (
        <ModalShell onClose={() => setOpen(false)} label="后台生成" className="render-task-sheet pop-in">
          <div className="render-task-sheet-head">
            <span>后台生成 · {headSub(activeCount)}</span>
            <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="关闭">
              <X size={15} />
            </button>
          </div>
          <TaskPanel snapshot={snapshot} visible={visible} counts={counts} />
        </ModalShell>
      )}
    </>
  );
}
