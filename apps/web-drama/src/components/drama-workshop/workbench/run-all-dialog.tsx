"use client";

// 一键连跑 — 设计真源:app.jsx `RunAllFlow`。
// 两阶段:confirm(展示剩余阶段 + 单价 + 总价)→ running(阶段依次完成动画)→
// 完成后 onComplete(keys)。锁定除 prompt 外的所有阶段。
import * as React from "react";
import { Check, Zap } from "lucide-react";
import { STAGES, type StageDef, type StageKey } from "../stages-config";

interface RunAllDialogProps {
  current: StageKey;
  locked: Partial<Record<StageKey, boolean>>;
  onCancel: () => void;
  onComplete: (keys: StageKey[], totalCost: number) => void;
}

export function RunAllDialog({ current, locked, onCancel, onComplete }: RunAllDialogProps) {
  const order = STAGES;
  const startIdx = Math.max(
    0,
    order.findIndex((s) => s.key === current),
  );
  const stages: StageDef[] = order.slice(startIdx);
  const total = stages.reduce(
    (a, s) => a + (locked[s.key] ? 0 : s.cost),
    0,
  );
  const [phase, setPhase] = React.useState<"confirm" | "running">("confirm");
  const [doneN, setDoneN] = React.useState(0);

  React.useEffect(() => {
    if (phase !== "running") return;
    if (doneN >= stages.length) {
      const tm = setTimeout(
        () => onComplete(stages.map((s) => s.key), total),
        650,
      );
      return () => clearTimeout(tm);
    }
    const tm = setTimeout(() => setDoneN((n) => n + 1), 820);
    return () => clearTimeout(tm);
  }, [phase, doneN, stages, onComplete, total]);

  return (
    <div className="overlay" onClick={phase === "confirm" ? onCancel : undefined}>
      <div
        className="card pop-in"
        style={{
          width: 460,
          maxWidth: "94vw",
          padding: 24,
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-3" style={{ marginBottom: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
              display: "grid",
              placeItems: "center",
              flex: "none",
              color: "#fff",
            }}
          >
            <Zap size={20} fill="#fff" strokeWidth={0} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {phase === "confirm" ? "一键连跑剩余阶段" : "正在连跑…"}
            </div>
            <div className="faint" style={{ fontSize: 12 }}>
              {phase === "confirm"
                ? "AI 依次跑完下面几步,跑完直接给你成片配方"
                : "别走开,跑完自动落到成片配方"}
            </div>
          </div>
        </div>

        <div className="col gap-2" style={{ marginBottom: 16 }}>
          {stages.map((s, i) => {
            const st: "wait" | "run" | "done" =
              phase === "confirm"
                ? "wait"
                : i < doneN
                  ? "done"
                  : i === doneN
                    ? "run"
                    : "wait";
            return (
              <div
                key={s.key}
                className="row gap-3"
                style={{
                  padding: "9px 12px",
                  borderRadius: 11,
                  background:
                    st === "run" ? "var(--accent-soft)" : "var(--surface-2)",
                  transition: "background .2s",
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    flex: "none",
                    display: "grid",
                    placeItems: "center",
                    background:
                      st === "done"
                        ? "#22c55e"
                        : st === "run"
                          ? "var(--accent)"
                          : "var(--surface)",
                    color: "#fff",
                  }}
                >
                  {st === "done" ? (
                    <Check size={13} />
                  ) : st === "run" ? (
                    <span
                      aria-hidden
                      style={{
                        width: 12,
                        height: 12,
                        border: "2px solid rgba(255,255,255,.5)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "drama-spin .7s linear infinite",
                      }}
                    />
                  ) : (
                    <span
                      className="num faint"
                      style={{ fontSize: 11, fontWeight: 700 }}
                    >
                      {s.no}
                    </span>
                  )}
                </span>
                <span
                  className="grow"
                  style={{
                    fontSize: 13.5,
                    fontWeight: st === "run" ? 700 : 600,
                    color: st === "run" ? "var(--accent)" : "var(--ink)",
                  }}
                >
                  {s.name}
                </span>
                {phase === "confirm" ? (
                  <span className="cost">
                    <Zap size={12} /> 约 <b className="num">{locked[s.key] ? 0 : s.cost}</b>
                  </span>
                ) : (
                  <span className="faint" style={{ fontSize: 12 }}>
                    {st === "done" ? "已完成" : st === "run" ? "生成中" : "排队中"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {phase === "confirm" ? (
          <>
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                padding: "12px 14px",
                background: "var(--accent-soft)",
                borderRadius: 12,
                marginBottom: 18,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13 }}>预计总消耗</span>
              <span
                style={{ fontWeight: 700, color: "var(--accent)" }}
                className="num"
              >
                {total} 积分
              </span>
            </div>
            <div className="faint" style={{ fontSize: 11.5, marginBottom: 16 }}>
              连跑是加速器,默认还是逐步来。中途任一步出问题会停下并提示,不会闷头跑完。
            </div>
            <div className="row gap-3" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={onCancel}>
                还是逐步来
              </button>
              <button
                type="button"
                className="btn btn-grad"
                onClick={() => setPhase("running")}
              >
                <Zap size={15} /> 确认连跑 · {total} 积分
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              height: 8,
              borderRadius: 99,
              background: "var(--surface-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: (doneN / stages.length) * 100 + "%",
                background:
                  "linear-gradient(90deg,var(--accent),var(--accent-2))",
                borderRadius: 99,
                transition: "width .5s",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
