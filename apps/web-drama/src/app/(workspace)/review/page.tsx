"use client";

export const dynamic = "force-dynamic";

// 剧本审阅中心 — 设计真源 screens-hub-v2.jsx `ReviewHub` / `ReviewRow` +
// screens-review-table.jsx `ReviewSheet` / `SceneRows` / `SheetHead`:
// 跨项目待审队列 + Excel 式平铺表格(场/场景/动作/角色/对白/情绪/审阅/意见),原地通读、原地通过。
// v0.197：页面目前没有入口（队列无后端，恒为空），只按术语表改了文案；
// 「按意见让 AI 重写」「让 AI 写这一集」都没接后端，界面上如实说，不再假装已排队。
import * as React from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Edit,
  Mic,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@ai-star-eco/api-client";
import { Avatar, Thumb } from "@/components/drama-ui";
import {
  episodeContent,
  episodeTitle,
  getProjectData,
  type CharacterDef,
  type ReviewItem,
  type ScriptLine,
  type ScriptScene,
} from "@/mocks/drama-workshop";

interface Mark {
  st?: "ok" | "fix";
  note?: string;
}
type Marks = Record<string, Mark | undefined>;

const TH: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--ink-3)",
  letterSpacing: ".05em",
  padding: "10px 12px",
  background: "var(--surface-2)",
  borderBottom: "1px solid var(--line)",
  position: "sticky",
  top: 0,
  zIndex: 2,
  whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--line-soft)",
  verticalAlign: "top",
  fontSize: 13,
  lineHeight: 1.6,
};

export default function ReviewPage() {
  // v0.66:剧本审阅暂无后端 → 不再伪造待审队列;空起步（项目提交审阅后入队）。
  const [queue, setQueue] = React.useState<ReviewItem[]>([]);
  const [reviewItem, setReviewItem] = React.useState<ReviewItem | null>(null);

  const approve = (item: ReviewItem) => {
    setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "approved" as const } : x)));
    setReviewItem(null);
    toast.success(`《${item.title}》第 ${item.ep} 集的剧本已确认`);
  };
  const sendFix = (_item: ReviewItem, n: number) => {
    // 按意见重写还没有后端：如实告知，不假装已发出。
    toast.info(`让 AI 按意见重写还没上线。你标的 ${n} 场意见先记在这一页，离开后不会保留`);
  };

  if (reviewItem) {
    return (
      <ReviewSheet
        item={reviewItem}
        onBack={() => setReviewItem(null)}
        onApprove={approve}
        onSendFix={sendFix}
      />
    );
  }

  const pending = queue.filter((x) => x.status === "pending");
  const done = queue.filter((x) => x.status !== "pending");
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>剧本审阅</h1>
        <div className="muted" style={{ marginTop: 4 }}>
          等你过目的分集剧本都在这里，不用一部部点进去看
        </div>
      </div>

      <div className="faint" style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, letterSpacing: ".05em" }}>
        待审 · {pending.length}
      </div>
      <div className="col gap-3" style={{ marginBottom: 28 }}>
        {pending.length === 0 && (
          <div className="card col center" style={{ padding: 32, color: "var(--ink-3)", gap: 8 }}>
            <Check size={26} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>暂时没有要审的剧本</span>
          </div>
        )}
        {pending.map((it, i) => (
          <ReviewRow key={it.id} it={it} delay={i * 40} onOpen={() => setReviewItem(it)} />
        ))}
      </div>

      {done.length > 0 && (
        <>
          <div className="faint" style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, letterSpacing: ".05em" }}>
            已确认 · {done.length}
          </div>
          <div className="col gap-3">
            {done.map((it) => (
              <ReviewRow key={it.id} it={it} done onOpen={() => setReviewItem(it)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ReviewRow({
  it,
  done,
  onOpen,
  delay,
}: {
  it: ReviewItem;
  done?: boolean;
  onOpen: () => void;
  delay?: number;
}) {
  const scenes = getProjectData(it.pid)!.script.scenes.length;
  return (
    <div
      className={"card row gap-4 mk-review-row" + (delay != null ? " fade-up" : "")}
      style={{ padding: 14, animationDelay: (delay || 0) + "ms", opacity: done ? 0.72 : 1, flexWrap: "wrap" }}
    >
      <Thumb from={it.cover.from} to={it.cover.to} w={48} ratio="3/4" radius={10} stripes={false} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row gap-2" style={{ minWidth: 0 }}>
          <span title={it.title} style={{ fontWeight: 800, fontSize: 14.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
          <span className="tag tag-gray" style={{ flex: "none" }}>{it.type}</span>
          <span className="tag tag-accent num" style={{ flex: "none" }}>第 {it.ep} 集</span>
        </div>
        <div className="faint num" style={{ fontSize: 12, marginTop: 4 }}>
          {scenes} 场 · 约 {it.words} 字 · 生成于 {formatDateTime(it.updated)}
        </div>
      </div>
      {done ? (
        <span className="tag tag-green" style={{ flex: "none" }}>
          <Check size={11} /> 已确认
        </span>
      ) : null}
      <button className={done ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"} style={{ flex: "none" }} onClick={onOpen}>
        {done ? (
          "回看"
        ) : (
          <>
            <Edit size={14} /> 开始审阅
          </>
        )}
      </button>
    </div>
  );
}

function SheetHead() {
  return (
    <thead>
      <tr>
        <th style={{ ...TH, width: 52 }}>场</th>
        <th style={{ ...TH, width: 168 }}>场景</th>
        <th style={{ ...TH, width: 216 }}>画面 / 动作</th>
        <th style={{ ...TH, width: 104 }}>角色</th>
        <th style={TH}>对白</th>
        <th style={{ ...TH, width: 72 }}>情绪</th>
        <th style={{ ...TH, width: 92 }}>审阅</th>
        <th style={{ ...TH, width: 200 }}>修改意见</th>
      </tr>
    </thead>
  );
}

/* 一场 = 一组行(场景/动作/审阅列纵向合并) */
function SceneRows({
  s,
  idx,
  chars,
  mark,
  onMark,
  onNote,
}: {
  s: ScriptScene;
  idx: number;
  chars: CharacterDef[];
  mark: Mark | undefined;
  onMark: (st: "ok" | "fix" | null) => void;
  onNote: (v: string) => void;
}) {
  const st = mark?.st;
  const bg = st === "fix" ? "#fffbeb" : st === "ok" ? "#f0fdf4" : "transparent";
  const lines: (ScriptLine | null)[] = s.lines.length ? s.lines : [null];
  const n = lines.length;
  const findChar = (name: string) => (chars || []).find((c) => c.name === name);
  const cell = (extra: React.CSSProperties = {}): React.CSSProperties => ({ ...TD, background: bg, ...extra });

  return (
    <React.Fragment>
      {lines.map((l, j) => {
        const c = l ? findChar(l.who) : undefined;
        return (
          <tr key={s.id + "-" + j}>
            {j === 0 && (
              <td rowSpan={n} style={cell({})}>
                <span className="num" style={{ fontWeight: 800, fontSize: 15, color: "var(--accent)" }}>
                  {idx + 1}
                </span>
              </td>
            )}
            {j === 0 && (
              <td rowSpan={n} style={cell({})}>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>{s.place}</div>
                <span className="tag tag-gray" style={{ marginTop: 5 }}>
                  {s.mood}
                </span>
              </td>
            )}
            {j === 0 && (
              <td rowSpan={n} style={cell({ color: "var(--ink-2)", fontSize: 12.5, fontStyle: "italic" })}>
                {s.action || <span className="faint">—</span>}
              </td>
            )}
            <td style={cell({ whiteSpace: "nowrap" })}>
              {l ? (
                <span className="row gap-2">
                  {c ? (
                    <Avatar theme={c.avatar} size={20} />
                  ) : (
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "var(--surface-2)",
                        display: "inline-grid",
                        placeItems: "center",
                        color: "var(--ink-3)",
                        flex: "none",
                      }}
                    >
                      <Mic size={11} />
                    </span>
                  )}
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>{l.who}</span>
                </span>
              ) : (
                <span className="faint">—</span>
              )}
            </td>
            <td style={cell({})}>{l ? l.text : <span className="faint">这一场没有台词（空镜或动作戏）</span>}</td>
            <td style={cell({})}>
              {l && l.emotion ? <span className="tag tag-pink">{l.emotion}</span> : <span className="faint">—</span>}
            </td>
            {j === 0 && (
              <td rowSpan={n} style={cell({})}>
                <div className="col" style={{ gap: 5, alignItems: "flex-start" }}>
                  <button
                    className="chip"
                    onClick={() => onMark(st === "ok" ? null : "ok")}
                    style={{
                      height: 24,
                      fontSize: 11,
                      padding: "0 9px",
                      background: st === "ok" ? "#dcfce7" : "var(--surface-2)",
                      color: st === "ok" ? "#15803d" : "var(--ink-2)",
                    }}
                  >
                    <Check size={11} /> 通过
                  </button>
                  <button
                    className="chip"
                    onClick={() => onMark(st === "fix" ? null : "fix")}
                    style={{
                      height: 24,
                      fontSize: 11,
                      padding: "0 9px",
                      background: st === "fix" ? "#fef3c7" : "var(--surface-2)",
                      color: st === "fix" ? "#b45309" : "var(--ink-2)",
                    }}
                  >
                    <AlertTriangle size={11} /> 需修改
                  </button>
                </div>
              </td>
            )}
            {j === 0 && (
              <td rowSpan={n} style={cell({})}>
                {st === "fix" ? (
                  <textarea
                    value={mark?.note || ""}
                    onChange={(e) => onNote(e.target.value)}
                    placeholder="写下要怎么改，比如：台词太书面，改口语一点"
                    style={{
                      width: "100%",
                      minHeight: 56,
                      border: "1.5px solid #fcd34d",
                      borderRadius: 9,
                      padding: "7px 9px",
                      fontSize: 12,
                      outline: "none",
                      background: "#fff",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  ></textarea>
                ) : (
                  <span className="faint">—</span>
                )}
              </td>
            )}
          </tr>
        );
      })}
    </React.Fragment>
  );
}

/* ============ 审阅工作表(全屏 · 分集平铺总览) ============ */
function ReviewSheet({
  item,
  onBack,
  onApprove,
  onSendFix,
}: {
  item: ReviewItem;
  onBack: () => void;
  onApprove: (item: ReviewItem) => void;
  onSendFix: (item: ReviewItem, n: number) => void;
}) {
  const [marks, setMarks] = React.useState<Marks>({});
  const [filter, setFilter] = React.useState<"all" | "fix">("all");

  const d = getProjectData(item.pid)!;
  const scenes = d.script.scenes;
  const eps = d.episodes;

  const setMark = (id: string, st: "ok" | "fix" | null) =>
    setMarks((m) => ({ ...m, [id]: st ? { ...(m[id] || {}), st } : undefined }));
  const setNote = (id: string, note: string) => setMarks((m) => ({ ...m, [id]: { ...(m[id] || {}), note } }));
  const flagged = scenes.filter((s) => marks[s.id]?.st === "fix");
  const okCount = scenes.filter((s) => marks[s.id]?.st === "ok").length;
  const shown = filter === "fix" ? scenes.filter((s) => marks[s.id]?.st === "fix") : scenes;

  return (
    <div className="col ws-flush" style={{ background: "var(--bg)" }}>
      {/* 顶部 */}
      <div
        className="row gap-3 mk-review-bar"
        style={{ padding: "14px 28px", borderBottom: "1px solid var(--line)", background: "var(--surface)", flex: "none", flexWrap: "wrap" }}
      >
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <ChevronLeft size={15} /> 返回待审列表
        </button>
        <Thumb from={item.cover.from} to={item.cover.to} w={28} ratio="9/16" radius={8} stripes={false} />
        <div className="row gap-2" style={{ minWidth: 0 }}>
          <span title={item.title} style={{ fontWeight: 800, fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
          <span className="tag tag-gray">{item.type}</span>
          <span className="tag tag-accent num">第 {item.ep} 集待审</span>
        </div>
        <span className="grow"></span>
        <div className="row" style={{ background: "var(--surface-2)", borderRadius: 999, padding: 3, gap: 2 }}>
          <button
            className="chip"
            onClick={() => setFilter("all")}
            style={{
              height: 26,
              background: filter === "all" ? "var(--surface)" : "transparent",
              color: filter === "all" ? "var(--accent)" : "var(--ink-3)",
              boxShadow: filter === "all" ? "var(--shadow-sm)" : "none",
            }}
          >
            全部场次
          </button>
          <button
            className="chip"
            onClick={() => setFilter("fix")}
            style={{
              height: 26,
              background: filter === "fix" ? "var(--surface)" : "transparent",
              color: filter === "fix" ? "#b45309" : "var(--ink-3)",
              boxShadow: filter === "fix" ? "var(--shadow-sm)" : "none",
            }}
          >
            只看要改的 · {flagged.length}
          </button>
        </div>
        <span className="tag tag-gray num">
          已通过 {okCount}/{scenes.length} 场
        </span>
      </div>

      {/* 表格 */}
      <div className="scroll grow mk-review-body" style={{ minHeight: 0, padding: "18px 28px 24px" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
              <SheetHead />
              <tbody>
                {/* 当前待审集 · 分组行 */}
                <tr>
                  <td colSpan={8} style={{ padding: "9px 14px", background: "var(--accent-soft)", borderBottom: "1px solid var(--line)" }}>
                    <span className="row gap-2" style={{ flexWrap: "wrap" }}>
                      <span className="num" style={{ fontWeight: 800, color: "var(--accent)" }}>第 {item.ep} 集</span>
                      <span style={{ fontWeight: 700, fontSize: 12.5 }}>{eps[item.ep - 1] ? episodeTitle(eps[item.ep - 1]) : ""}</span>
                      <span className="faint" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>{eps[item.ep - 1] ? episodeContent(eps[item.ep - 1]) : ""}</span>
                      <span className="grow"></span>
                      <span className="tag tag-accent">本次待审 · {scenes.length} 场</span>
                    </span>
                  </td>
                </tr>
                {shown.map((s) => (
                  <SceneRows
                    key={s.id}
                    s={s}
                    idx={scenes.indexOf(s)}
                    chars={d.characters}
                    mark={marks[s.id]}
                    onMark={(st) => setMark(s.id, st)}
                    onNote={(v) => setNote(s.id, v)}
                  />
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: "26px 14px", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                      还没有标「需修改」的场次
                    </td>
                  </tr>
                )}

                {/* 其余分集 · 平铺总览 */}
                {filter === "all" &&
                  eps
                    .filter((e) => e.no !== item.ep)
                    .map((e) => (
                      <tr key={"ep" + e.no}>
                        <td colSpan={8} style={{ padding: "9px 14px", background: "var(--surface-2)", borderBottom: "1px solid var(--line-soft)" }}>
                          <span className="row gap-2" style={{ flexWrap: "wrap" }}>
                            <span className="num faint" style={{ fontWeight: 800 }}>第 {e.no} 集</span>
                            <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink-2)" }}>{episodeTitle(e)}</span>
                            <span
                              className="faint"
                              style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}
                            >
                              {episodeContent(e)}
                            </span>
                            <span className="grow"></span>
                            {e.locked ? (
                              <span className="tag tag-green">
                                <Check size={10} /> 剧本已确认
                              </span>
                            ) : (
                              <span className="tag tag-gray">剧本还没写</span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>
          没标记的场次算通过。其他集的剧本写好后，也会按这个表格列在下面。
        </div>
      </div>

      {/* 底部操作 */}
      <div
        className="row gap-3 mk-review-bar"
        style={{ padding: "12px 28px", borderTop: "1px solid var(--line)", background: "var(--surface)", flex: "none", flexWrap: "wrap" }}
      >
        {flagged.length > 0 ? (
          <span className="row gap-2" style={{ fontSize: 12.5, fontWeight: 700, color: "#b45309" }}>
            <AlertTriangle size={15} style={{ flex: "none" }} /> {flagged.length} 场标了「需修改」。让 AI 按意见重写还没上线
          </span>
        ) : (
          <span className="row gap-2" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>
            <Check size={15} style={{ flex: "none" }} /> 没问题就点通过，这一集的剧本会标成已确认，之后还能改
          </span>
        )}
        <span className="grow"></span>
        {flagged.length > 0 ? (
          <button className="btn btn-grad" disabled style={{ opacity: 0.55, cursor: "not-allowed" }} title="让 AI 按意见重写还没上线" onClick={() => onSendFix(item, flagged.length)}>
            <Wand2 size={15} /> 让 AI 重写 {flagged.length} 场
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => onApprove(item)}>
            <Check size={16} /> 通过第 {item.ep} 集
          </button>
        )}
      </div>
    </div>
  );
}
