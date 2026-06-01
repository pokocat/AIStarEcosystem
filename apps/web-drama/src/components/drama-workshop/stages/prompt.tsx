"use client";

// 阶段 6 成片配方 — 终点高光页:hero + 整集导出 + 逐镜四段式
// 【风格 / 时间轴 / 声音 / 参考】+ 出镜方式徽标;@图片N 渲染为真实头像缩略图。
// 设计真源:screens-script.jsx `PromptStage / PromptCard / Seg`。
import * as React from "react";
import { toast } from "sonner";
import { Box, Check, Clock, Copy, Download, Film } from "lucide-react";
import { Avatar, EngineTag } from "@/components/drama-ui";
import { DramaConfirmDialog } from "@/components/drama-ui/confirm-dialog";
import type {
  CharacterDef,
  ProjectData,
  PromptShot,
} from "@/mocks/drama-workshop";
import type { WorkshopAction, WorkshopState } from "../workbench";

interface PromptStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
}

export function PromptStage({ state, dispatch, data }: PromptStageProps) {
  const pack = data.promptPack;
  const [copied, setCopied] = React.useState<number | null>(null);
  const [exportOpen, setExportOpen] = React.useState(false);

  const copyShot = (no: number) => {
    setCopied(no);
    toast.success(`已复制第 ${no} 镜配方`);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div
      className="scroll"
      style={{
        height: "100%",
        background:
          "linear-gradient(180deg, color-mix(in oklch,var(--accent) 6%,var(--bg)), var(--bg) 280px)",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 32px 70px" }}>
        {/* 高光头部 */}
        <div
          className="col center fade-up"
          style={{ textAlign: "center", marginBottom: 28 }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 20,
              background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
              display: "grid",
              placeItems: "center",
              boxShadow: "var(--shadow-accent)",
              marginBottom: 14,
              color: "#fff",
            }}
          >
            <Box size={30} />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 27,
              fontWeight: 800,
              letterSpacing: "-.02em",
            }}
          >
            成片配方已就绪
          </h1>
          <div className="muted" style={{ marginTop: 6, maxWidth: 440 }}>
            第 {pack.ep} 集 · {pack.scene} —— 逐镜整理好,可直接喂给视频大模型开拍。
          </div>
          <div className="row gap-3" style={{ marginTop: 18 }}>
            <button
              type="button"
              className="btn btn-grad"
              style={{ height: 46, padding: "0 22px" }}
              onClick={() => setExportOpen(true)}
            >
              <Download size={17} /> 导出整集配方
            </button>
            <button
              type="button"
              className="btn btn-line"
              style={{ height: 46 }}
              onClick={() => toast.success("已复制全部配方到剪贴板")}
            >
              <Copy size={16} /> 复制全部
            </button>
          </div>
        </div>

        {/* 逐镜四段式 */}
        <div className="col gap-4">
          {pack.shots.map((sh, i) => (
            <PromptCard
              key={sh.no}
              sh={sh}
              delay={i * 80}
              copied={copied === sh.no}
              onCopy={() => copyShot(sh.no)}
              chars={state.chars}
            />
          ))}
        </div>

        {/* 特效镜说明 */}
        <div
          className="card row gap-3"
          style={{
            marginTop: 20,
            padding: 16,
            background: "var(--accent-soft)",
            border: "none",
          }}
        >
          <Clock size={18} style={{ color: "var(--accent)", flex: "none" }} />
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
            <b style={{ color: "var(--ink)" }}>特效镜(非真人脸)</b>走特效引擎,目前按权益开通 —— 配方已经写好,开通后即可直接出片。数字人出镜镜头不受影响,本期就能用。
          </div>
        </div>

        {/* 下游 placeholder */}
        <div className="card row gap-3" style={{ marginTop: 14, padding: 16, opacity: 0.65 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "var(--surface-2)",
              display: "grid",
              placeItems: "center",
              color: "var(--ink-3)",
              flex: "none",
            }}
          >
            <Film size={22} />
          </div>
          <div className="grow">
            <div className="row gap-2">
              <span style={{ fontWeight: 700 }}>交付到出片中心</span>
              <span className="tag tag-gray">即将上线</span>
            </div>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>
              把这份配方一键送去出片:数字人分身承接真人脸成片、特效镜按权益渲染。出片是最重的一道确认关卡,放在出片中心。
            </div>
          </div>
        </div>
      </div>

      <DramaConfirmDialog
        open={exportOpen}
        title="导出整集成片配方?"
        body="将把第 1 集所有镜头打包成可直接喂给视频大模型的配方。特效镜按权益开通,数字人镜头即刻可用。"
        cost={32}
        confirmLabel="确认导出"
        onCancel={() => setExportOpen(false)}
        onConfirm={() => {
          setExportOpen(false);
          dispatch({ type: "spend", n: 32 });
          toast.success("配方已导出 · 已生成追查号 #LX-241");
        }}
      />
    </div>
  );
}

function PromptCard({
  sh,
  delay,
  copied,
  onCopy,
  chars,
}: {
  sh: PromptShot;
  delay: number;
  copied: boolean;
  onCopy: () => void;
  chars: CharacterDef[];
}) {
  return (
    <div
      className="card fade-up"
      style={{ padding: 0, overflow: "hidden", animationDelay: delay + "ms" }}
    >
      <div
        className="row gap-3"
        style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-soft)" }}
      >
        <span
          className="num"
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: "var(--ink)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {sh.no}
        </span>
        <span style={{ fontWeight: 700 }}>第 {sh.no} 镜</span>
        <EngineTag engine={sh.engine} />
        <span className="grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCopy}>
          {copied ? (
            <>
              <Check size={14} /> 已复制
            </>
          ) : (
            <>
              <Copy size={14} /> 复制本镜
            </>
          )}
        </button>
      </div>
      <div className="col gap-3" style={{ padding: 18, fontSize: 13.5 }}>
        <Seg label="风格">
          <span>
            {sh.style},{sh.dur}秒,{sh.ratio}
          </span>
        </Seg>
        <Seg label="时间轴">
          <div className="col gap-2">
            {sh.timeline.map((tl, i) => (
              <div
                key={i}
                className="row gap-2"
                style={{ flexWrap: "wrap", alignItems: "center" }}
              >
                <span className="num tag tag-gray" style={{ flex: "none" }}>
                  {tl.t}
                </span>
                {tl.items.map((it, j) => (
                  <React.Fragment key={j}>
                    <span
                      style={{
                        padding: "3px 9px",
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        borderRadius: 7,
                        fontWeight: 600,
                        fontSize: 12.5,
                      }}
                    >
                      {it}
                    </span>
                    {j < tl.items.length - 1 && (
                      <span className="faint">+</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </Seg>
        <Seg label="声音">
          <span>{sh.sound}</span>
        </Seg>
        <Seg label="参考">
          <div className="row gap-3" style={{ flexWrap: "wrap" }}>
            {sh.refs.map((r, i) => (
              <div
                key={i}
                className="row gap-2 card"
                style={{
                  padding: "6px 10px 6px 6px",
                  gap: 8,
                  background: "var(--surface-2)",
                  border: "none",
                }}
              >
                {r.type === "img" ? (
                  <Avatar theme={r.who} size={34} bound />
                ) : (
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: "var(--ink)",
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                    }}
                  >
                    <Film size={16} />
                  </div>
                )}
                <div>
                  <div className="num faint" style={{ fontSize: 10.5, fontWeight: 700 }}>
                    {r.type === "img" ? `@图片${i + 1}` : `@视频${i + 1}`}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Seg>
      </div>
    </div>
  );
}

function Seg({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row gap-3" style={{ alignItems: "flex-start" }}>
      <span
        className="tag"
        style={{
          flex: "none",
          width: 52,
          justifyContent: "center",
          background: "var(--ink)",
          color: "#fff",
        }}
      >
        {label}
      </span>
      <div className="grow" style={{ lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
