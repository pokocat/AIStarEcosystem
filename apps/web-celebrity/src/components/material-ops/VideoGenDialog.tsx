"use client";

// 视频生成弹窗 —— 真实提交视频大模型 + 轮询回显。
//   · baseline 模式：直接生成（一句话补充要求即可，不再堆 6 轴 + 18 项参数）。
//   · variant 模式：DeriveVariablesPanel（变量派生 + 画面维度），主动点按钮才生成。
// 生成 = 提交真实任务（POST /material/videos/generate）→ 进入 generating 阶段轮询每个任务，
// 出片后内嵌播放；支持重新生成。任务也会出现在素材库（库自带轮询），关闭弹窗不影响。

import * as React from "react";
import { X, PlayCircle, Shuffle, Check, Loader2, RefreshCw, TriangleAlert, FolderOpen } from "lucide-react";
import { Button } from "@/components/creator";
import { formatCredits } from "@ai-star-eco/api-client/format";
import { MaterialOpsApi } from "@/api";
import { AiErrorNotice, errorMessage } from "@/components/common/ai-error-notice";
import type { MaterialProduct, MaterialVideo, ScriptAsset, VariantConfig, VariantSample, VideoGenJobRequest, VideoModelOption } from "./types";
import { DeriveVariablesPanel } from "./DeriveVariablesPanel";
import { useVideoModels } from "./use-video-models";
import { buildJobRequests, creditsPerVideo, durationGateMessage, scriptTotalDur, isPlaceholderProduct } from "./lib";
import { useConfirm } from "@/components/common/confirm-dialog";
import { useCelebrityShell } from "@/lib/celebrity-shell-context";
import { Eyebrow, hexA, CostLine } from "./shared";

type Stage = "config" | "generating";

export const DEFAULT_CONFIG: VariantConfig = {
  character: "human-001",
  scene: "auto-shop",
  weather: "sunny",
  lighting: "natural",
  role_relation: "夫妻",
  voice: "voice-male-01",
};

export function VideoGenDialog({
  script,
  product,
  mode,
  baseline,
  onClose,
  onSubmitted,
  onViewLibrary,
}: {
  script: ScriptAsset;
  product: MaterialProduct;
  mode: "baseline" | "variant";
  baseline?: MaterialVideo | null;
  onClose: () => void;
  /** 任务提交成功后回调（让素材库刷新，开始展示这些渲染中的任务）。 */
  onSubmitted?: () => void;
  /** 「去素材库查看」入口。 */
  onViewLibrary?: () => void;
}) {
  const isVariant = mode === "variant";
  const [stage, setStage] = React.useState<Stage>("config");
  const [jobs, setJobs] = React.useState<MaterialVideo[]>([]);
  const [lastPlan, setLastPlan] = React.useState<VideoGenJobRequest[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // 生成模型候选（含有效时长区间 + 按秒/按次单价）。加载失败 → 禁止提交并显式报错，
  // 绝不回落写死单价（报价必须与后端 hold 金额同源）。
  const { models, error: modelsError } = useVideoModels();
  const [endpointId, setEndpointId] = React.useState<string | null>(null);
  const selectedModel: VideoModelOption | null = React.useMemo(() => {
    if (!models || models.length === 0) return null;
    return models.find((m) => m.endpointId === endpointId) ?? models.find((m) => m.isDefault) ?? models[0];
  }, [models, endpointId]);
  const totalDur = scriptTotalDur(script);
  const perVideo = creditsPerVideo(selectedModel, totalDur);
  const gateMessage = durationGateMessage(selectedModel, totalDur);
  // 有 candidate 行（selectableById）一律显式透传 endpoint_id——报价模型与实际提交模型
  // 严格同一，避免「按 A 报价、默认绑定切换后按 B 生成」漂移；仅合成默认项（无 candidate 行，
  // 显式传 id 会被白名单 503 拒）走缺省默认路径。
  const submitEndpointId = selectedModel?.selectableById ? selectedModel.endpointId : undefined;
  // 报价未就绪 / 时长越界 / 模型信息异常（含刷新失败）任一 → 禁提交，杜绝按旧报价下单。
  const blocked = perVideo == null || gateMessage != null || modelsError != null;

  const { confirm, ConfirmHost } = useConfirm();
  const { wallet } = useCelebrityShell();
  const balance = wallet?.totalBalance ?? null;

  // 提交真实生成任务 → 进入 generating 阶段轮询。
  const runGenerate = React.useCallback(
    async (requests: VideoGenJobRequest[]) => {
      if (!requests.length) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const created = await MaterialOpsApi.submitVideoJobs(requests);
        setJobs(created);
        setLastPlan(requests);
        setStage("generating");
        onSubmitted?.();
      } catch (e) {
        setSubmitError(errorMessage(e, "提交视频生成失败，请稍后重试"));
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmitted],
  );

  // 生成前积分确认（按所选模型真实报价：per_second = 单价 × 脚本秒数）。
  const confirmAndGenerate = React.useCallback(
    async (requests: VideoGenJobRequest[]) => {
      if (perVideo == null || !selectedModel) return; // 报价未就绪时按钮已禁用，双保险
      const count = requests.length;
      const credits = perVideo * count;
      const perLabel = selectedModel.billingUnit === "per_second"
        ? `${selectedModel.creditCost} 积分/秒 × ${totalDur} 秒`
        : `${selectedModel.creditCost} 积分/条`;
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
              <span style={{ color: "var(--fg-3)" }}>（{count} 条 × {perLabel}，模型：{selectedModel.name}）</span>
            </div>
            {balance != null && (
              <div style={{ color: insufficient ? "var(--danger)" : "var(--fg-2)" }}>
                {insufficient
                  ? `当前余额 ${formatCredits(balance)} 积分，不足以发起本次生成。`
                  : `当前余额 ${formatCredits(balance)} 积分，生成期间将锁定相应额度，完成后结算（失败自动退回）。`}
              </div>
            )}
          </div>
        ),
      });
      if (ok && !insufficient) runGenerate(requests);
    },
    [balance, confirm, runGenerate, perVideo, selectedModel, totalDur],
  );

  // 轮询 generating 阶段未完成的任务。
  React.useEffect(() => {
    if (stage !== "generating") return;
    const active = jobs.some((j) => j.status === "rendering");
    if (!active) return;
    const t = setInterval(async () => {
      const updated = await Promise.all(
        jobs.map((j) =>
          j.status === "rendering"
            ? MaterialOpsApi.getVideoJob(j.id).then((r) => r ?? j).catch(() => j)
            : Promise.resolve(j),
        ),
      );
      setJobs(updated);
    }, 4000);
    return () => clearInterval(t);
  }, [stage, jobs]);

  const startVariant = (samples: VariantSample[], config: VariantConfig) =>
    confirmAndGenerate(buildJobRequests({
      script,
      product,
      config: { ...config, endpoint_id: submitEndpointId },
      samples,
      baseline,
    }));

  return (
    <>
      <div
        onClick={!submitting ? onClose : undefined}
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
          width: isVariant ? "min(1240px, 94vw)" : "min(720px, 94vw)",
          height: isVariant ? "92vh" : "auto",
          maxHeight: "92vh",
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
            <Eyebrow>{isVariant ? "派生视频 · 变量 / 画面维度" : "生成带货视频"}</Eyebrow>
            <div style={{ fontSize: 15, color: "var(--fg-0)", fontWeight: 600, marginTop: 2 }}>
              {isVariant ? `基于《${script.title ?? script.name}》派生多条视频` : `为《${script.title ?? script.name}》生成视频`}
            </div>
          </div>
          <Button variant="icon" size="sm" onClick={onClose} style={{ width: 32, padding: 0 }}>
            <X size={14} />
          </Button>
        </div>

        {/* 生成模型（时长上限 + 单价前置；报价未就绪 / 时长越界时提交被禁用） */}
        {stage === "config" && (
          <ModelSelectRow
            models={models}
            selected={selectedModel}
            onSelect={setEndpointId}
            error={modelsError}
            gateMessage={gateMessage}
            totalDur={totalDur}
          />
        )}

        {/* body */}
        {stage === "config" && isVariant && (
          <DeriveVariablesPanel
            script={script}
            walletBalance={balance}
            submitting={submitting}
            creditsPerVideo={perVideo}
            blocked={blocked}
            error={submitError}
            onClose={onClose}
            onGenerate={startVariant}
          />
        )}
        {stage === "config" && !isVariant && (
          <DirectBaselineStage
            script={script}
            product={product}
            walletBalance={balance}
            submitting={submitting}
            credits={perVideo}
            blocked={blocked}
            error={submitError}
            onGenerate={(extra) => {
              const reqs = buildJobRequests({
                script,
                product,
                config: { ...DEFAULT_CONFIG, endpoint_id: submitEndpointId },
              });
              const withExtra = extra.trim()
                ? reqs.map((r) => ({ ...r, prompt: `${r.prompt}\n\n【补充要求】${extra.trim()}` }))
                : reqs;
              confirmAndGenerate(withExtra);
            }}
          />
        )}
        {stage === "generating" && (
          <GeneratingStage
            jobs={jobs}
            submitting={submitting}
            onRegenerate={() => confirmAndGenerate(lastPlan)}
            onViewLibrary={onViewLibrary}
            onClose={onClose}
          />
        )}
      </div>
      <ConfirmHost />
    </>
  );
}

// ── 生成模型选择行（候选 ≤1 时只显示能力说明，不渲染下拉） ─────────────────────────
function ModelSelectRow({
  models,
  selected,
  onSelect,
  error,
  gateMessage,
  totalDur,
}: {
  models: VideoModelOption[] | null;
  selected: VideoModelOption | null;
  onSelect: (endpointId: string) => void;
  error: string | null;
  gateMessage: string | null;
  totalDur: number;
}) {
  const rangeLabel = (m: VideoModelOption) => {
    const min = m.effectiveMinDurationSec ?? null;
    const max = m.effectiveMaxDurationSec ?? null;
    if (min != null && max != null) return `${min}–${max} 秒`;
    if (max != null) return `最长 ${max} 秒`;
    if (min != null) return `至少 ${min} 秒`;
    return "时长不限";
  };
  const priceLabel = (m: VideoModelOption) =>
    m.billingUnit === "per_second" ? `${m.creditCost} 积分/秒` : `${m.creditCost} 积分/条`;
  return (
    <div style={{ padding: "10px 22px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8, background: "var(--bg-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Eyebrow style={{ flexShrink: 0 }}>生成模型</Eyebrow>
        {models == null && !error && (
          <span style={{ fontSize: 12, color: "var(--fg-3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Loader2 size={12} className="animate-spin" /> 模型信息加载中…
          </span>
        )}
        {models != null && models.length > 1 && (
          <select
            value={selected?.endpointId ?? ""}
            onChange={(e) => onSelect(e.target.value)}
            aria-label="选择生成模型"
            style={{
              maxWidth: 220,
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-1)",
              border: "1px solid var(--line-2)",
              color: "var(--fg-0)",
              fontSize: 12.5,
              outline: "none",
            }}
          >
            {models.map((m) => (
              <option key={m.endpointId} value={m.endpointId}>
                {m.name}{m.isDefault ? "（默认）" : ""}
              </option>
            ))}
          </select>
        )}
        {models != null && models.length === 1 && selected && (
          <span style={{ fontSize: 12.5, color: "var(--fg-0)", fontWeight: 600, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</span>
        )}
        {selected && (
          <span
            title={`该模型单条视频 ${rangeLabel(selected)}；计价 ${priceLabel(selected)}`}
            style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", whiteSpace: "nowrap" }}
          >
            {rangeLabel(selected)} · {priceLabel(selected)}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: gateMessage ? "var(--danger)" : "var(--fg-3)", whiteSpace: "nowrap" }}>
          脚本 {totalDur} 秒
        </span>
      </div>
      {error && <AiErrorNotice title="生成模型不可用" message={error} />}
      {gateMessage && (
        <div style={{ fontSize: 12, color: "var(--danger)", lineHeight: 1.6 }}>{gateMessage}</div>
      )}
    </div>
  );
}

// ── baseline 直接生成（issue 2：去掉 6 轴 + 18 项参数，只留一句补充要求） ──────────
function DirectBaselineStage({
  script,
  product,
  walletBalance,
  submitting,
  credits,
  blocked,
  error,
  onGenerate,
}: {
  script: ScriptAsset;
  product: MaterialProduct;
  walletBalance: number | null;
  submitting: boolean;
  /** 单条真实报价；null = 模型报价未就绪（提交禁用）。 */
  credits: number | null;
  /** 报价未就绪或时长越界 → 禁用提交。 */
  blocked: boolean;
  error: string | null;
  onGenerate: (extra: string) => void;
}) {
  const [extra, setExtra] = React.useState("");
  const totalDur = script.blocks.reduce((s, b) => s + b.dur, 0);
  const noProduct = isPlaceholderProduct(product);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: 22, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 脚本 + 商品摘要 */}
        <div style={{ padding: "14px 16px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13.5, color: "var(--fg-0)", fontWeight: 600 }}>{script.title ?? script.name}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
              {script.blocks.length} 镜 · {totalDur}s
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.6 }}>
            {noProduct ? (
              script.creative_brief?.trim()
                ? <>主题简介 <strong style={{ color: "var(--fg-1)" }}>{script.creative_brief.trim().slice(0, 40)}</strong></>
                : <>未关联商品 · 按脚本分镜直接生成</>
            ) : (
              <>
                关联商品 <strong style={{ color: "var(--fg-1)" }}>{product.name}</strong>
                {product.priceCents ? ` · ¥${(product.priceCents / 100).toFixed(0)}` : ""}
              </>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--fg-3)", lineHeight: 1.6 }}>
            将按脚本分镜 + 商品卖点直接生成一条视频。需要批量换人物 / 场景 / 台词，请用「派生新视频」。
          </div>
        </div>

        {/* 一句话补充要求（可选） */}
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>补充要求（可选）</Eyebrow>
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={3}
            placeholder="例如：多用特写、节奏再快一点、突出价格…（留空则按脚本智能生成）"
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
        </div>

        {error && <AiErrorNotice title="视频生成提交失败" message={error} />}
      </div>

      {/* footer */}
      <div style={{ padding: "14px 22px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)" }}>
        <CostLine count={1} credits={credits} balance={walletBalance} unit="视频" />
        <Button variant="accent" onClick={() => onGenerate(extra)} disabled={submitting || blocked}>
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
          {submitting ? "提交中…" : credits != null ? `生成视频 · ${credits} 积分` : "生成视频"}
        </Button>
      </div>
    </div>
  );
}

// ── 生成中 / 结果（真实任务轮询 + 内嵌播放 + 重新生成） ─────────────────────────
function GeneratingStage({
  jobs,
  submitting,
  onRegenerate,
  onViewLibrary,
  onClose,
}: {
  jobs: MaterialVideo[];
  submitting: boolean;
  onRegenerate: () => void;
  onViewLibrary?: () => void;
  onClose: () => void;
}) {
  const total = jobs.length;
  const doneCount = jobs.filter((j) => j.status === "ready").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const allSettled = jobs.every((j) => j.status === "ready" || j.status === "failed");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, background: "var(--bg-2)" }}>
        {allSettled ? (
          <Check size={15} color="var(--extra-teal)" />
        ) : (
          <Loader2 size={15} color="var(--extra-teal)" className="animate-spin" />
        )}
        <span style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500 }}>
          {allSettled ? "生成结束" : "AI 生成中"}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>
          {doneCount} / {total} 完成{failedCount > 0 ? ` · ${failedCount} 失败` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
          视频生成较慢，可关闭后到素材库查看
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: total === 1 ? "minmax(0, 320px)" : "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      </div>

      <div style={{ padding: "14px 22px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--bg-2)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>
          {allSettled ? "完成的视频已进入素材库" : "任务已在后台生成，进度实时回显"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={onRegenerate} disabled={submitting}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} 重新生成
          </Button>
          {onViewLibrary && (
            <Button variant="ghost" onClick={onViewLibrary}>
              <FolderOpen size={13} /> 去素材库
            </Button>
          )}
          <Button variant="accent" onClick={onClose}>
            完成
          </Button>
        </div>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: MaterialVideo }) {
  const ready = job.status === "ready";
  const failed = job.status === "failed";
  const tone = job.cover_color || "#7c5cff";
  return (
    <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--bg-2)", border: `1px solid ${failed ? "var(--danger)" : ready ? hexA(tone, "66") : "var(--line)"}` }}>
      <div style={{ aspectRatio: "9 / 14", position: "relative", background: failed ? "var(--bg-3)" : `linear-gradient(135deg, ${hexA(tone, "99")} 0%, ${hexA(tone, "22")} 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {ready && job.video_url ? (
          <video
            src={job.video_url}
            controls
            poster={job.thumbnail_url ?? undefined}
            style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
          />
        ) : failed ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 12, textAlign: "center" }}>
            <TriangleAlert size={22} color="var(--danger)" />
            <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>生成失败</span>
          </div>
        ) : ready ? (
          <PlayCircle size={30} color="#fff" style={{ opacity: 0.85 }} />
        ) : (
          <>
            <Loader2 size={22} color="#fff" className="animate-spin" style={{ position: "absolute" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px", background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.6))" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff" }}>
                <span>{job.stage ?? "生成中"}</span>
                <span>{job.progress_pct ?? 0}%</span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.25)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${job.progress_pct ?? 0}%`, background: tone }} />
              </div>
            </div>
          </>
        )}
      </div>
      <div style={{ padding: "8px 12px" }}>
        <div style={{ fontSize: 12, color: "var(--fg-0)", fontWeight: 500, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.name}</div>
        <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 9.5, color: failed ? "var(--danger)" : ready ? "var(--extra-teal)" : "var(--fg-3)" }}>
          {failed ? (job.error_message ? truncate(job.error_message, 60) : "生成失败 · 可重新生成") : ready ? "已完成 · 已入素材库" : `${job.stage ?? "生成中"} · ${job.progress_pct ?? 0}%`}
        </div>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
