"use client";

// 从短剧切片推广弹窗 — 设计真源 v4 screens-shorts-v4.jsx `ShortClipModal`:
// 选剧 + 选集 → AI 扫描高光片段 → 剪成竖屏推广片。
import * as React from "react";
import { Clapperboard, Search, X, Zap } from "lucide-react";
import { CreditButton, GenSkeleton, Thumb } from "@/components/drama-ui";
import { ModalShell } from "@/components/common/ModalShell";
import { PROJECTS } from "@/mocks/drama-workshop";

export interface ShortClipModalProps {
  onClose: () => void;
  onMake: (ctx: { format: string; idea: string; fromClip?: boolean }) => void;
}

interface HighlightClip {
  id: string;
  label: string;
  desc: string;
  heat: number;
}

export function ShortClipModal({ onClose, onMake }: ShortClipModalProps) {
  const dramas = PROJECTS.filter((p) => p.stage >= 4 || p.main);
  const [pid, setPid] = React.useState<string | undefined>(dramas[0]?.id);
  const [picked, setPicked] = React.useState<number[]>([1]);
  const [scanning, setScanning] = React.useState(false);
  const [clips, setClips] = React.useState<HighlightClip[] | null>(null);
  const drama = dramas.find((p) => p.id === pid) ?? dramas[0];
  const eps = Array.from({ length: Math.min(6, drama?.episodes ?? 6) }, (_, i) => i + 1);

  if (!drama) return null;

  const scan = () => {
    setScanning(true);
    setClips(null);
    setTimeout(() => {
      setScanning(false);
      setClips([
        { id: "c1", label: "开场钩子 · 0:00-0:18", desc: "巨型怪兽肆虐 + 机甲破空,重低音轰鸣", heat: 92 },
        { id: "c2", label: "高光卡点 · 1:15-1:40", desc: "三机甲标志动作 + 终极技能霓虹爆炸", heat: 88 },
        { id: "c3", label: "悬念结尾 · 1:40-2:00", desc: "硝烟散去走出舱门,“这只是第一波”", heat: 79 },
      ]);
    }, 1400);
  };

  return (
    <ModalShell
      onClose={onClose}
      label="从短剧切片推广"
      className="card pop-in col"
      style={{ width: 660, maxWidth: "94vw", maxHeight: "88vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
    >
        <div className="row gap-3" style={{ padding: "18px 22px 14px" }}>
          <div className="icon-badge" style={{ width: 38, height: 38, borderRadius: 12 }}>
            <Clapperboard size={20} />
          </div>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 17 }}>从短剧切片推广</div>
            <div className="faint" style={{ fontSize: 12 }}>选剧 + 选集,AI 扫描高光,剪成竖屏推广短视频</div>
          </div>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="scroll col gap-4" style={{ padding: "4px 22px 18px", minHeight: 0 }}>
          <div className="col gap-2">
            <span className="faint" style={{ fontSize: 12, fontWeight: 700 }}>选一部短剧</span>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {dramas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPid(p.id);
                    setClips(null);
                  }}
                  className="row gap-2 chip"
                  style={{
                    height: 36,
                    border: pid === p.id ? "2px solid var(--accent)" : "1.5px solid var(--line)",
                    background: pid === p.id ? "var(--accent-soft)" : "var(--surface)",
                    color: pid === p.id ? "var(--accent)" : "var(--ink-2)",
                  }}
                >
                  <Thumb from={p.cover.from} to={p.cover.to} w={20} ratio="9/16" radius={5} stripes={false} /> {p.title}
                </button>
              ))}
            </div>
          </div>

          <div className="col gap-2">
            <span className="faint" style={{ fontSize: 12, fontWeight: 700 }}>选要切的集(可多选)</span>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {eps.map((n) => {
                const on = picked.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    className={"chip num" + (on ? " on" : "")}
                    onClick={() => {
                      setPicked((a) => (on ? a.filter((x) => x !== n) : [...a, n]));
                      setClips(null);
                    }}
                  >
                    第 {n} 集
                  </button>
                );
              })}
            </div>
          </div>

          {!clips && !scanning && (
            <CreditButton cost={8} onConfirm={scan} confirmTitle="扫描高光片段" confirmBody="AI 会分析剧情节奏与情绪曲线,挑出高光片段。" className="btn btn-line" style={{ alignSelf: "flex-start" }}>
              <Search size={15} /> 扫描高光片段
            </CreditButton>
          )}
          {scanning && (
            <div className="card" style={{ padding: 16 }}>
              <GenSkeleton lines={2} label="正在分析剧情节奏与情绪曲线,挑高光…" />
            </div>
          )}
          {clips && (
            <div className="col gap-2">
              <span className="faint" style={{ fontSize: 12, fontWeight: 700 }}>AI 挑出 {clips.length} 个高光 · 按热度排序</span>
              {clips.map((c) => (
                <div key={c.id} className="card row gap-3" style={{ padding: "11px 13px" }}>
                  <div
                    style={{
                      width: 34,
                      height: 46,
                      borderRadius: 8,
                      background: `linear-gradient(135deg,${drama.cover.from},${drama.cover.to})`,
                      flex: "none",
                    }}
                  />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>{c.desc}</div>
                  </div>
                  <div className="col" style={{ alignItems: "flex-end", flex: "none" }}>
                    <span className="num" style={{ fontWeight: 800, color: "var(--accent-2)", fontSize: 14 }}>{c.heat}</span>
                    <span className="faint" style={{ fontSize: 10 }}>热度</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="row gap-3" style={{ padding: "14px 22px", borderTop: "1px solid var(--line-soft)", background: "var(--surface)" }}>
          <span className="faint" style={{ fontSize: 12 }}>
            {picked.length} 集 · {clips ? clips.length + " 个高光" : "待扫描"}
          </span>
          <span className="grow" />
          <CreditButton
            cost={14}
            onConfirm={() => {
              onClose();
              onMake({ format: "hook", idea: drama.title + " · 高光推广片", fromClip: true });
            }}
            confirmTitle="剪成竖屏推广片"
            confirmBody="把选中高光剪成一条竖屏推广片。"
            className="btn btn-grad"
            disabled={!clips}
            style={{ opacity: clips ? 1 : 0.5 }}
            markSize={15}
          >
            <Zap size={16} /> 剪成竖屏推广片
          </CreditButton>
        </div>
    </ModalShell>
  );
}
