"use client";

// 视频生成弹窗 —— 流式生成（config → generating → done）。
// baseline 模式：prompt + 结构化参数 + 6 轴单选；variant 模式：DeriveVariablesPanel（变量派生）。

import * as React from "react";
import { X, PlayCircle, Shuffle, ListChecks, Check, Lock, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/creator";
import { VARIANT_AXES, VARIANT_AXIS_ORDER, VIDEO_CONFIG_FIELDS, VIDEO_GEN_STAGES } from "@/constants/material-ops-ui";
import { formatCredits } from "@ai-star-eco/api-client/format";
import type { MaterialVideo, ScriptAsset, VariantConfig, VariantSample } from "./types";
import { DeriveVariablesPanel } from "./DeriveVariablesPanel";
import { buildVideoAsset, estimateVideoCredits, CREDIT_PER_VIDEO } from "./lib";
import { useConfirm } from "@/components/common/confirm-dialog";
import { useCelebrityShell } from "@/lib/celebrity-shell-context";
import { Eyebrow, hexA, CostLine } from "./shared";

type Stage = "config" | "generating" | "done";

const DEFAULT_CONFIG: VariantConfig = {
  character: "human-001",
  scene: "auto-shop",
  weather: "sunny",
  lighting: "natural",
  role_relation: "夫妻",
  voice: "voice-male-01",
};

function defaultStructured(): Record<string, string> {
  const out: Record<string, string> = {};
  Object.values(VIDEO_CONFIG_FIELDS).forEach((g) => {
    Object.entries(g.fields).forEach(([k, f]) => {
      out[k] = f.default;
    });
  });
  return out;
}

export function VideoGenDialog({
  script,
  mode,
  baseline,
  onClose,
  onComplete,
  onSubmitAsync,
}: {
  script: ScriptAsset;
  mode: "baseline" | "variant";
  baseline?: MaterialVideo | null;
  onClose: () => void;
  /** 弹窗内完成：返回生成的视频。 */
  onComplete: (videos: MaterialVideo[]) => void;
  /** 提交后台：返回任务（names + configs 已构造）。 */
  onSubmitAsync: (payload: { names: string[]; configs: VariantConfig[] }) => void;
}) {
  const isVariant = mode === "variant";
  const [stage, setStage] = React.useState<Stage>("config");
  const [config, setConfig] = React.useState<VariantConfig>(baseline ? { ...baseline.variant_config } : { ...DEFAULT_CONFIG });
  const [structured, setStructured] = React.useState<Record<string, string>>(defaultStructured);
  const [prompt, setPrompt] = React.useState(
    isVariant ? "在保持脚本不变的前提下，请变换人物和场景，覆盖更多受众。" : "基于脚本生成基线视频，保持自然真实。",
  );
  // 进入生成阶段的计划
  const [plan, setPlan] = React.useState<{ names: string[]; configs: VariantConfig[] }>({ names: ["基线版"], configs: [config] });

  const { confirm, ConfirmHost } = useConfirm();
  const { wallet } = useCelebrityShell();
  const balance = wallet?.totalBalance ?? null;

  // 生成前的积分确认：展示预计消耗 + 余额影响，余额不足时红色阻断式确认。
  const confirmAndStart = async (count: number, run: () => void) => {
    const credits = estimateVideoCredits(count);
    const insufficient = balance != null && balance < credits;
    const ok = await confirm({
      title: `确认生成 ${count} 条视频？`,
      tone: insufficient ? "danger" : "default",
      confirmText: insufficient ? "余额不足" : `确认生成 · ${credits} 积分`,
      cancelText: "再想想",
      description: (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div>
            预计消耗 <strong style={{ color: "var(--fg-0)" }}>{credits} 积分</strong>
            <span style={{ color: "var(--fg-3)" }}>（{count} 条 × {CREDIT_PER_VIDEO} 积分/条）</span>
          </div>
          {balance != null && (
            <div style={{ color: insufficient ? "var(--danger)" : "var(--fg-2)" }}>
              {insufficient
                ? `当前余额 ${formatCredits(balance)} 积分，不足以发起本次生成。`
                : `当前余额 ${formatCredits(balance)} 积分，生成期间将锁定相应额度，完成后结算。`}
            </div>
          )}
        </div>
      ),
    });
    if (ok && !insufficient) run();
  };

  const startBaseline = () =>
    confirmAndStart(1, () => {
      setPlan({ names: ["基线版"], configs: [config] });
      setStage("generating");
    });
  const startVariant = (samples: VariantSample[]) =>
    confirmAndStart(samples.length, () => {
      setPlan({ names: samples.map((s) => s._label), configs: samples.map(() => config) });
      setStage("generating");
    });

  // 中途取消正在生成的批次：丢弃进度、退回参数页，锁定的额度退回。
  const cancelGenerating = async () => {
    const ok = await confirm({
      title: "取消本次生成？",
      tone: "danger",
      confirmText: "取消生成",
      cancelText: "继续生成",
      description: "正在生成的视频会被丢弃，已锁定的积分将退回。已完成入库的视频不受影响。",
    });
    if (ok) setStage("config");
  };

  return (
    <>
      <div
        onClick={stage !== "generating" ? onClose : undefined}
        style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", zIndex: 80, backdropFilter: "blur(4px)" }}
      />
      <div
        role="dialog"
        aria-modal
        style={{
          position: "fixed",
          top: "4vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(1240px, 94vw)",
          height: "92vh",
          zIndex: 90,
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: `linear-gradient(135deg, ${hexA(isVariant ? "#5b3fe0" : "#22b59a", "12")}, transparent 50%)`,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              flexShrink: 0,
              background: hexA(isVariant ? "#5b3fe0" : "#22b59a", "1f"),
              color: isVariant ? "var(--accent-strong)" : "var(--extra-teal)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isVariant ? <Shuffle size={18} /> : <PlayCircle size={18} />}
          </div>
          <div style={{ flex: 1 }}>
            <Eyebrow>{isVariant ? "视频变体批量生成" : "基线版视频生成"}</Eyebrow>
            <div style={{ fontSize: 15, color: "var(--fg-0)", fontWeight: 600, marginTop: 2 }}>
              {isVariant ? `基于《${script.title ?? script.name}》派生多条变体视频` : `为《${script.title ?? script.name}》生成第一条预览视频`}
            </div>
          </div>
          {stage !== "generating" && (
            <Button variant="icon" size="sm" onClick={onClose} style={{ width: 32, padding: 0 }}>
              <X size={14} />
            </Button>
          )}
        </div>

        {/* body */}
        {stage === "config" && isVariant && (
          <DeriveVariablesPanel
            script={script}
            walletBalance={balance}
            onClose={onClose}
            onSubmit={startVariant}
            onSubmitAsync={(samples) => {
              onSubmitAsync({ names: samples.map((s) => s._label), configs: samples.map(() => config) });
              onClose();
            }}
          />
        )}
        {stage === "config" && !isVariant && (
          <ConfigStage
            script={script}
            config={config}
            setConfig={setConfig}
            structured={structured}
            setStructured={setStructured}
            prompt={prompt}
            setPrompt={setPrompt}
            walletBalance={balance}
            onSubmit={startBaseline}
            onSubmitAsync={() => {
              onSubmitAsync({ names: ["基线版"], configs: [config] });
              onClose();
            }}
          />
        )}
        {stage === "generating" && (
          <GeneratingStage
            script={script}
            baseline={baseline ?? null}
            isVariant={isVariant}
            prompt={prompt}
            plan={plan}
            onComplete={(videos) => {
              setStage("done");
              setTimeout(() => onComplete(videos), 500);
            }}
            onSendToBackground={() => {
              onSubmitAsync(plan);
              onClose();
            }}
            onCancel={cancelGenerating}
          />
        )}
      </div>
      <ConfirmHost />
    </>
  );
}

function ConfigStage({
  script,
  config,
  setConfig,
  structured,
  setStructured,
  prompt,
  setPrompt,
  walletBalance,
  onSubmit,
  onSubmitAsync,
}: {
  script: ScriptAsset;
  config: VariantConfig;
  setConfig: (c: VariantConfig) => void;
  structured: Record<string, string>;
  setStructured: (s: Record<string, string>) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  walletBalance: number | null;
  onSubmit: () => void;
  onSubmitAsync: () => void;
}) {
  const credits = estimateVideoCredits(1);
  // 渐进式披露：默认只露「画面维度」核心创作项；18 项结构化参数收进「高级参数」。
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {/* 左：prompt + 脚本上下文 */}
      <div style={{ width: 380, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: 18, flex: 1, overflowY: "auto" }}>
          <Eyebrow style={{ marginBottom: 10 }}>提示词</Eyebrow>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: "var(--radius-md)",
              background: "var(--bg-2)",
              border: "1px solid var(--line-2)",
              color: "var(--fg-0)",
              fontSize: 13,
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
              fontFamily: "var(--font-sans)",
            }}
          />
          <div style={{ marginTop: 18 }}>
            <Eyebrow style={{ marginBottom: 8 }}>脚本上下文</Eyebrow>
            <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--fg-0)", fontWeight: 500 }}>{script.title ?? script.name}</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", marginBottom: 8 }}>
                {script.blocks.length} 镜头 · {script.blocks.reduce((s, b) => s + b.dur, 0)}s
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {script.blocks.map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 11 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", flexShrink: 0, width: 14 }}>{i + 1}</span>
                    <span style={{ color: "var(--fg-1)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {b.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={10} /> 脚本内容在生成中保持不变
            </div>
          </div>
        </div>
      </div>

      {/* 右：结构化参数 + 画面维度 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          <div style={{ marginBottom: 12 }}>
            <Eyebrow>画面维度</Eyebrow>
            <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 3 }}>选好人物、场景、配音即可生成；其余参数用智能默认。</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {VARIANT_AXIS_ORDER.map((id) => {
              const axis = VARIANT_AXES[id];
              return (
                <div key={id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 99, background: axis.toneVar }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: axis.toneVar, letterSpacing: "0.1em", textTransform: "uppercase" }}>{axis.label}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {axis.options.map((opt) => {
                      const activeOpt = config[id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setConfig({ ...config, [id]: opt.id })}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "var(--radius-md)",
                            cursor: "pointer",
                            background: activeOpt ? hexA(axis.toneVar, "16") : "var(--bg-2)",
                            border: `1px solid ${activeOpt ? axis.toneVar : "var(--line)"}`,
                            color: activeOpt ? "var(--fg-0)" : "var(--fg-1)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{opt.emoji}</span>
                          <span>{opt.label}</span>
                          {opt.sub && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)" }}>· {opt.sub}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setShowAdvanced((s) => !s)}
            style={{
              marginTop: 22,
              marginBottom: showAdvanced ? 12 : 0,
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              color: "var(--fg-1)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 12.5,
            }}
          >
            <ChevronRight size={14} style={{ transform: showAdvanced ? "rotate(90deg)" : "none", transition: "transform 160ms ease", flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: "var(--fg-0)" }}>高级参数</span>
            <span style={{ color: "var(--fg-3)" }}>画质 / 镜头语言 / 音频 / 高级控制</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{showAdvanced ? "收起" : "展开"}</span>
          </button>

          {showAdvanced && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
            {Object.entries(VIDEO_CONFIG_FIELDS).map(([gid, group]) => (
              <div key={gid} style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", background: hexA(group.toneVar, "1f"), color: group.toneVar, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {group.label[0]}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--fg-0)", fontWeight: 600 }}>{group.label}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                  {Object.entries(group.fields).map(([fk, f]) => (
                    <div key={fk}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em", marginBottom: 4 }}>{f.label}</div>
                      <select
                        value={structured[fk] ?? f.default}
                        onChange={(e) => setStructured({ ...structured, [fk]: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-1)",
                          border: "1px solid var(--line-2)",
                          color: "var(--fg-0)",
                          fontSize: 12,
                          fontFamily: "var(--font-sans)",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        {f.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)" }}>
          <CostLine count={1} credits={credits} balance={walletBalance} unit="基线视频" />
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={onSubmitAsync}>
              <ListChecks size={14} /> 提交到后台
            </Button>
            <Button variant="accent" onClick={onSubmit}>
              <PlayCircle size={14} /> 生成基线视频 · {credits} 积分
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneratingStage({
  script,
  baseline,
  isVariant,
  prompt,
  plan,
  onComplete,
  onSendToBackground,
  onCancel,
}: {
  script: ScriptAsset;
  baseline: MaterialVideo | null;
  isVariant: boolean;
  prompt: string;
  plan: { names: string[]; configs: VariantConfig[] };
  onComplete: (videos: MaterialVideo[]) => void;
  onSendToBackground: () => void;
  onCancel: () => void;
}) {
  const target = plan.names.length;
  const [videos, setVideos] = React.useState(() =>
    plan.names.map((name, i) => ({ idx: i, name, config: plan.configs[i], stage_idx: 0, progress: 0, status: "queued" as "queued" | "rendering" | "done" })),
  );
  const doneRef = React.useRef(false);

  React.useEffect(() => {
    const tick = setInterval(() => {
      setVideos((prev) => {
        let allDone = true;
        let running = prev.filter((v) => v.status === "rendering").length;
        const next = prev.map((v) => {
          if (v.status === "done") return v;
          allDone = false;
          if (v.status === "queued") {
            if (running < 3) {
              running += 1;
              return { ...v, status: "rendering" as const, stage_idx: 0, progress: 6 };
            }
            return v;
          }
          const st = VIDEO_GEN_STAGES[v.stage_idx];
          let p = v.progress + 100 / (st.duration * 3);
          let si = v.stage_idx;
          let status: "rendering" | "done" = "rendering";
          if (p >= 100) {
            si += 1;
            p = 0;
            if (si >= VIDEO_GEN_STAGES.length) {
              status = "done";
              si = VIDEO_GEN_STAGES.length - 1;
              p = 100;
            }
          }
          return { ...v, stage_idx: si, progress: p, status };
        });
        if (allDone && !doneRef.current) {
          doneRef.current = true;
          setTimeout(() => {
            const finals = next.map((v) => buildVideoAsset(v.name, v.config, v.idx, script, baseline, isVariant));
            onComplete(finals);
          }, 600);
        }
        return next;
      });
    }, 110);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doneCount = videos.filter((v) => v.status === "done").length;

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {/* 左：流式日志 */}
      <div style={{ width: 380, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={14} color="var(--extra-teal)" className="animate-spin" />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-0)" }}>
            {doneCount} / {target} 完成
          </span>
          {doneCount < target && (
            <Button variant="ghost" size="sm" onClick={onCancel} style={{ marginLeft: "auto", color: "var(--danger)" }}>
              <X size={12} /> 取消生成
            </Button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <Bubble role="user" content={prompt} />
          <Bubble
            role="system"
            content={
              <>
                <LogLine ok>已解析脚本《{script.title ?? script.name}》· {script.blocks.length} 镜头</LogLine>
                <LogLine ok>已派发 {target} 个渲染任务</LogLine>
                {isVariant && <LogLine>脚本内容锁定 · 仅变化人物 / 场景 / 配音 等维度</LogLine>}
              </>
            }
          />
          {videos.map((v, i) => (
            <div key={i} style={{ padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: "var(--radius-sm)", background: v.status === "done" ? "var(--extra-teal)" : hexA("#22b59a", "1f"), color: v.status === "done" ? "#fff" : "var(--extra-teal)", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {v.status === "done" ? <Check size={10} /> : i + 1}
                </span>
                <span style={{ fontSize: 12, color: "var(--fg-0)", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</span>
                {v.status === "done" && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--extra-teal)" }}>已完成</span>}
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                {VIDEO_GEN_STAGES.map((s, si) => {
                  const isDone = v.stage_idx > si || v.status === "done";
                  const isActive = v.stage_idx === si && v.status === "rendering";
                  return (
                    <div key={s.id} title={s.label} style={{ flex: 1, height: 3, borderRadius: 1, background: isDone || isActive ? "var(--extra-teal)" : "var(--bg-3)", opacity: isActive ? 1 : isDone ? 1 : 0.5 }} />
                  );
                })}
              </div>
              {v.status === "rendering" && (
                <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--extra-teal)" }}>
                  {VIDEO_GEN_STAGES[v.stage_idx].label} · {VIDEO_GEN_STAGES[v.stage_idx].sub}
                </div>
              )}
              {v.status === "queued" && <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>排队中…</div>}
            </div>
          ))}
          {doneCount === target && (
            <Bubble role="system" content={<span style={{ color: "var(--extra-teal)", fontWeight: 600 }}>全部 {target} 条视频已生成 · 即将入库并关联脚本</span>} />
          )}
        </div>
      </div>

      {/* 右：视频卡 */}
      <div style={{ flex: 1, minWidth: 0, padding: 22, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Eyebrow>生成预览 · 完成时自动入库</Eyebrow>
          {doneCount < target && (
            <Button variant="secondary" size="sm" onClick={onSendToBackground}>
              <ListChecks size={11} /> 转后台 · 关闭页面
            </Button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: target === 1 ? "minmax(0,280px)" : `repeat(${Math.min(3, Math.ceil(Math.sqrt(target)))}, 1fr)`, gap: 14 }}>
          {videos.map((v, i) => {
            const charOpt = VARIANT_AXES.character.options.find((o) => o.id === v.config.character);
            const tone = ["#7c5cff", "#ff5b8a", "#22b59a", "#f0a83a", "#5b3fe0", "#ff8a5b"][v.idx % 6];
            const overall = ((v.stage_idx + (v.status === "done" ? 1 : v.progress / 100)) / VIDEO_GEN_STAGES.length) * 100;
            const isDone = v.status === "done";
            const isQueued = v.status === "queued";
            return (
              <div key={i} style={{ borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--bg-2)", border: "1px solid var(--line)", boxShadow: isDone ? `0 0 0 1px ${hexA(tone, "66")}` : "none" }}>
                <div style={{ aspectRatio: "9 / 14", position: "relative", background: `linear-gradient(135deg, ${hexA(tone, "99")} 0%, ${hexA(tone, "22")} 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isQueued ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#fff", opacity: 0.7 }}>排队中</span>
                  ) : (
                    <>
                      <div style={{ fontSize: isDone ? 44 : 36, opacity: isDone ? 1 : 0.5 }}>{charOpt?.emoji ?? "🎬"}</div>
                      {!isDone && <Loader2 size={20} color="#fff" className="animate-spin" style={{ position: "absolute" }} />}
                      {isDone && <PlayCircle size={32} color="#fff" style={{ position: "absolute", opacity: 0.85 }} />}
                    </>
                  )}
                  <span style={{ position: "absolute", top: 8, left: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.4)", padding: "2px 7px", borderRadius: 4 }}>
                    {String(v.idx + 1).padStart(2, "0")}
                  </span>
                  {isDone && (
                    <span style={{ position: "absolute", top: 8, right: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff", background: "rgba(34,181,154,0.9)", padding: "2px 7px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Check size={9} /> 完成
                    </span>
                  )}
                  {!isDone && !isQueued && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px", background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.6))" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff" }}>
                        <span>{VIDEO_GEN_STAGES[v.stage_idx].label}</span>
                        <span>{Math.round(overall)}%</span>
                      </div>
                      <div style={{ height: 3, background: "rgba(255,255,255,0.25)", borderRadius: 99, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${overall}%`, background: tone, borderRadius: 99 }} />
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, color: "var(--fg-0)", fontWeight: 500, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "system"; content: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div style={{ padding: isUser ? "8px 12px" : 0, background: isUser ? hexA("#7c5cff", "12") : "transparent", border: isUser ? `1px solid ${hexA("#7c5cff", "33")}` : 0, borderRadius: isUser ? "var(--radius-md)" : 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 16, height: 16, borderRadius: 4, background: isUser ? "var(--accent)" : hexA("#22b59a", "1f"), color: isUser ? "#fff" : "var(--extra-teal)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700 }}>
          {isUser ? "你" : "AI"}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{isUser ? "你" : "智能体"}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--fg-1)", lineHeight: 1.65, paddingLeft: isUser ? 0 : 22, display: "flex", flexDirection: "column", gap: 4 }}>{content}</div>
    </div>
  );
}

function LogLine({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {ok ? <Check size={11} color="var(--extra-teal)" /> : <Lock size={11} color="var(--fg-3)" />}
      <span>{children}</span>
    </div>
  );
}
