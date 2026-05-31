"use client";
// ============================================================
// 打样（STEP 03）— 一次性 3~5 版，网格 / 并排 / 滑块叠加三种对比，单选进入草稿。
// 任务进度由 store ticker（mock）/ 轮询（live）驱动。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarDetail, AiAvatarAsset } from "@ai-star-eco/types/ai-avatar";
import { Btn, IconBtn, Portrait, Progress, Seg, StatusPill } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { usePolling } from "@/lib/hooks";
import { startSampling, chooseVariant, transitionAvatar } from "@/api/ai-avatar";
import { hueFor } from "@/lib/hue";
import { modeLabel } from "@/constants/aiavatar-ui";
import { toast } from "@/components/ui/toast";

interface Variant { assetId: string; label: string; asset?: AiAvatarAsset }

export function SamplingStep({ detail, reload }: { detail: AiAvatarDetail; reload: () => void }) {
  const router = useRouter();
  const { avatar } = detail;
  const job = detail.recentJobs.find((j) => (j.input as { kind?: string } | null)?.kind === "sampling");
  const nluJob = detail.recentJobs.find((j) => (j.input as { kind?: string } | null)?.kind === "nlu");
  const running = !!job && (job.status === "running" || job.status === "queued");
  const [mode, setMode] = React.useState<"grid" | "side" | "slider">("grid");
  const [picked, setPicked] = React.useState<string | null>(null);
  const [pair, setPair] = React.useState<[number, number]>([0, 1]);
  const [busy, setBusy] = React.useState(false);

  usePolling(reload, 700, running);

  const variants: Variant[] = React.useMemo(() => {
    const ids = (job?.result as { assetIds?: string[] } | null)?.assetIds ?? [];
    return ids.map((aid, i) => ({ assetId: aid, label: "方案 " + String.fromCharCode(65 + i), asset: detail.assets.find((x) => x.id === aid) }));
  }, [job, detail.assets]);

  const restart = async () => {
    try {
      await startSampling(avatar.id, { variants: 5, prompt: avatar.persona ?? undefined });
      setPicked(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "打样失败", { icon: "!", tone: "var(--err)" });
    }
  };

  const proceed = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await chooseVariant(avatar.id, picked, job?.versionId ?? undefined);
      await transitionAvatar(avatar.id, "draft_iterating").catch(() => undefined);
      router.push(`/avatars/${avatar.id}/drafting`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "操作失败", { icon: "!", tone: "var(--err)" });
      setBusy(false);
    }
  };

  // 无打样任务（直达）→ 引导开始打样
  if (!job) {
    return (
      <div style={{ padding: 36 }}>
        <Header sub="尚未开始打样" />
        <NluNotice job={nluJob} />
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0", gap: 18 }}>
          <div style={{ color: "var(--ink-2)", fontSize: 14 }}>点击下方开始第一轮 AI 打样生成。</div>
          <Btn variant="pri" size="lg" icon={Icons.sparkle} onClick={restart}>开始打样</Btn>
        </div>
      </div>
    );
  }

  if (running) {
    return (
      <div style={{ padding: 36 }}>
        <Header sub="第一轮 AI 生成 · 快速出初稿" />
        <NluNotice job={nluJob} />
        <Generating
          count={(job.input as { variants?: number } | null)?.variants ?? 5}
          pct={job.progress}
          label={avatar.mode === "real_clone" ? "InstantID · 单图 ID 保持复刻 + 风格迁移" : "SDXL / FLUX · 文生图原创人像"}
        />
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div style={{ padding: 36 }}>
        <Header sub="打样任务失败" />
        <NluNotice job={nluJob} />
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0", gap: 16, color: "var(--ink-1)", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", border: "1px solid rgba(255,107,107,.45)", background: "rgba(255,107,107,.12)", color: "var(--err)" }}>
            <Icons.x size={24} />
          </div>
          <div style={{ maxWidth: 520, fontSize: 13.5, lineHeight: 1.7 }}>{job.errorMessage ?? "生成服务暂不可用，请稍后重试。"}</div>
          <Btn variant="pri" size="lg" icon={Icons.retry} onClick={restart}>重新打样</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 36px 100px", maxWidth: 1320, margin: "0 auto" }}>
      <Header
        sub="一次性生成 5 版方案，单选最优进入草稿"
        right={
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="line" size="sm" icon={Icons.retry} onClick={restart}>重新打样</Btn>
            <Seg value={mode} onChange={setMode} size="sm" options={[{ value: "grid", icon: Icons.grid, label: "网格多选" }, { value: "side", icon: Icons.compare, label: "并排对照" }, { value: "slider", icon: Icons.sliders, label: "滑块叠加" }]} />
          </div>
        }
      />
      <NluNotice job={nluJob} />

      {mode === "grid" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginTop: 8 }}>
          {variants.map((v) => (
            <div key={v.assetId}>
              <Portrait
                hue={hueFor(v.assetId)}
                src={v.asset?.fileUrl || avatar.coverUrl}
                label={v.label}
                sub={"SEED " + v.assetId.slice(-4)}
                selected={picked === v.assetId}
                onClick={() => setPicked(v.assetId)}
                badge={<span style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(10,11,14,0.7)", border: "1px solid var(--line-2)", color: "var(--ink-0)" }}>{v.label.slice(-1)}</span>}
              />
              <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                <Btn size="sm" variant={picked === v.assetId ? "pri" : "line"} onClick={() => setPicked(v.assetId)}>{picked === v.assetId ? "已选中" : "选择此版"}</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "side" && <SideCompare variants={variants} avatar={avatar} pair={pair} setPair={setPair} picked={picked} setPicked={setPicked} />}
      {mode === "slider" && <SliderCompare variants={variants} avatar={avatar} pair={pair} setPair={setPair} picked={picked} setPicked={setPicked} />}

      <div style={{ position: "fixed", left: 232, right: 0, bottom: 0, padding: "16px 36px", background: "var(--bg-glass)", backdropFilter: "blur(12px)", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 60 }}>
        <div style={{ fontSize: 13, color: "var(--ink-1)" }}>
          {picked ? <span>已选中 <b style={{ color: "var(--accent-hi)" }}>{variants.find((v) => v.assetId === picked)?.label}</b> · 将作为草稿迭代基底</span> : "请单选一版最优打样图进入下一阶段"}
        </div>
        <Btn variant="pri" size="lg" iconR={Icons.arrowR} disabled={!picked || busy} onClick={proceed}>进入草稿迭代</Btn>
      </div>
    </div>
  );
}

function NluNotice({ job }: { job?: AiAvatarDetail["recentJobs"][number] }) {
  if (!job || job.status === "succeeded") return null;
  if (job.status === "failed") {
    return (
      <div style={{ margin: "0 0 18px", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,107,107,.35)", background: "rgba(255,107,107,.10)", color: "var(--ink-1)", fontSize: 12.5, lineHeight: 1.6 }}>
        服务端大模型人设解析未完成：{job.errorMessage ?? "未配置可用大模型端点"}。当前继续使用原始人设文案打样。
      </div>
    );
  }
  return (
    <div style={{ margin: "0 0 18px", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--ink-1)", fontSize: 12.5 }}>
      正在通过服务端大模型解析人设文案…
    </div>
  );
}

function Header({ sub, right }: { sub: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>形象打样</h1>
          <StatusPill status="sampling" />
        </div>
        <div style={{ fontSize: 13.5, color: "var(--ink-1)" }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}

function Generating({ count, pct, label }: { count: number; pct: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 26 }}>
      <div style={{ display: "flex", gap: 16 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ width: 150, aspectRatio: "3/4", borderRadius: "var(--r-md)", background: "linear-gradient(100deg, var(--bg-2) 30%, var(--bg-3) 50%, var(--bg-2) 70%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", animationDelay: i * 0.15 + "s", border: "1px solid var(--line)" }} />
        ))}
      </div>
      <div style={{ width: 360, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 12, color: "var(--signal)" }}>
          <span style={{ width: 14, height: 14, border: "2px solid var(--signal)", borderTopColor: "transparent", borderRadius: 999, animation: "spin .8s linear infinite" }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
        </div>
        <Progress pct={pct} tone="signal" />
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 10 }}>{Math.round(pct)}% · 大模型推理中…</div>
      </div>
    </div>
  );
}

const chipBtn = (on: boolean): React.CSSProperties => ({ padding: "7px 13px", fontSize: 12.5, borderRadius: 999, cursor: "pointer", border: "1px solid " + (on ? "var(--accent-line)" : "var(--line-2)"), background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent-hi)" : "var(--ink-1)" });

function SideCompare({ variants, avatar, pair, setPair, picked, setPicked }: CompareProps) {
  const src = (i: number) => variants[i]?.asset?.fileUrl || avatar.coverUrl;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {variants.map((v, i) => (
          <button key={v.assetId} onClick={() => setPair((p) => (p[0] === i ? p : [i, p[1] === i ? p[0] : p[1]]))} style={chipBtn(pair.includes(i))}>{v.label}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 760, margin: "0 auto" }}>
        {pair.map((idx, i) => {
          const v = variants[idx];
          if (!v) return <div key={i} />;
          return (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--ink-1)" }}>{v.label}</span>
                <select value={idx} onChange={(e) => setPair((p) => { const n = [...p] as [number, number]; n[i] = +e.target.value; return n; })} style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink-1)", fontSize: 12, padding: "4px 8px" }}>
                  {variants.map((x, xi) => <option key={x.assetId} value={xi}>{x.label}</option>)}
                </select>
              </div>
              <Portrait hue={hueFor(v.assetId)} src={src(idx)} label={v.label} selected={picked === v.assetId} onClick={() => setPicked(v.assetId)} />
              <div style={{ marginTop: 10 }}><Btn full size="sm" variant={picked === v.assetId ? "pri" : "line"} onClick={() => setPicked(v.assetId)}>{picked === v.assetId ? "已选为最优" : "选此版"}</Btn></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SliderCompare({ variants, avatar, pair, setPair, picked, setPicked }: CompareProps) {
  const [pos, setPos] = React.useState(50);
  const ref = React.useRef<HTMLDivElement>(null);
  const src = (i: number) => variants[i]?.asset?.fileUrl || avatar.coverUrl;
  const drag = (e: MouseEvent | React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = (((e as MouseEvent).clientX - r.left) / r.width) * 100;
    setPos(Math.max(2, Math.min(98, x)));
  };
  const start = () => {
    const mv = (e: MouseEvent) => drag(e);
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
  };
  const [a, b] = pair;
  return (
    <div style={{ marginTop: 8, maxWidth: 460, margin: "8px auto 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        {[0, 1].map((i) => (
          <select key={i} value={pair[i]} onChange={(e) => setPair((p) => { const n = [...p] as [number, number]; n[i] = +e.target.value; return n; })} style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink-1)", fontSize: 12, padding: "5px 10px" }}>
            {variants.map((x, xi) => <option key={x.assetId} value={xi}>{(i === 0 ? "左 · " : "右 · ") + x.label}</option>)}
          </select>
        ))}
      </div>
      <div ref={ref} onMouseDown={start} style={{ position: "relative", aspectRatio: "3/4", borderRadius: "var(--r-md)", overflow: "hidden", cursor: "ew-resize", userSelect: "none", border: "1px solid var(--line-2)" }}>
        <Portrait hue={hueFor(variants[b]?.assetId ?? "b")} src={src(b)} label={variants[b]?.label} style={{ position: "absolute", inset: 0, borderRadius: 0, border: "none" }} />
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <Portrait hue={hueFor(variants[a]?.assetId ?? "a")} src={src(a)} label={variants[a]?.label} style={{ position: "absolute", inset: 0, borderRadius: 0, border: "none", height: "100%" }} />
        </div>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: pos + "%", width: 2, background: "var(--accent)", boxShadow: "0 0 12px var(--accent-glow)" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 30, height: 30, borderRadius: 999, background: "var(--accent)", color: "#1a1205", display: "grid", placeItems: "center", boxShadow: "var(--shadow-2)" }}><Icons.compare size={15} /></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        {pair.map((idx) => {
          const v = variants[idx];
          return <Btn key={idx} full size="sm" variant={picked === v?.assetId ? "pri" : "line"} onClick={() => v && setPicked(v.assetId)}>{picked === v?.assetId ? "已选 " + v?.label : "选 " + v?.label}</Btn>;
        })}
      </div>
    </div>
  );
}

interface CompareProps {
  variants: Variant[];
  avatar: AiAvatarDetail["avatar"];
  pair: [number, number];
  setPair: React.Dispatch<React.SetStateAction<[number, number]>>;
  picked: string | null;
  setPicked: (id: string) => void;
}
