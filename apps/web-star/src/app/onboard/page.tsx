"use client";

// 入驻页 — 已登录但未绑定明星档案的账号在此完成「明星入驻」。
// 提交后服务端创建 celebrity 域 CelebrityStar 档案 + 账号绑定，
// 明星立即出现在 AI 明星带货端（web-celebrity）的明星市场。

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles, Star } from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { StarWorkbenchApi } from "@/api";

const CATEGORIES = ["演员", "歌手", "主持人", "运动员", "网红", "综艺"];

const inputStyle: React.CSSProperties = {
  background: "var(--bg-1)",
  border: "1px solid var(--line-strong)",
  color: "var(--ink-0)",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-semibold" style={{ color: "var(--ink-0)" }}>{label}</span>
        {hint && <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export default function OnboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [checking, setChecking] = React.useState(true);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState(CATEGORIES[0]);
  const [description, setDescription] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [fansWan, setFansWan] = React.useState("");
  const [priceYuan, setPriceYuan] = React.useState("299");
  const [agentView, setAgentView] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // 已有档案 → 直接进工作台；未登录 → AuthProvider 自动跳 /login
  React.useEffect(() => {
    if (loading) return;
    if (!user) { setChecking(false); return; }
    let cancelled = false;
    StarWorkbenchApi.getProfile()
      .then((p) => {
        if (cancelled) return;
        if (p) router.replace("/dashboard");
        else setChecking(false);
      })
      .catch(() => !cancelled && setChecking(false));
    return () => { cancelled = true; };
  }, [user, loading, router]);

  const submit = async () => {
    setError(null);
    if (!name.trim()) { setError("请填写艺名 / 姓名"); return; }
    if (!description.trim()) { setError("请填写一句话定位（将展示在明星市场卡片）"); return; }
    const fans = Math.round(parseFloat(fansWan || "0") * 10_000);
    const priceCents = Math.round(parseFloat(priceYuan || "0") * 100);
    if (!Number.isFinite(fans) || fans <= 0) { setError("请填写有效的粉丝量"); return; }
    if (!Number.isFinite(priceCents) || priceCents <= 0) { setError("请填写有效的合作起价"); return; }
    setSubmitting(true);
    try {
      await StarWorkbenchApi.onboard({
        name: name.trim(),
        category,
        description: description.trim(),
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        fans,
        startingPriceCents: priceCents,
        agentView,
      });
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "入驻失败，请稍后再试");
      setSubmitting(false);
    }
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-0)" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--ink-2)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: "var(--bg-0)" }}>
      <div className="max-w-xl mx-auto">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "var(--gradient-star)" }}>
            <Star className="w-6 h-6 text-white" fill="currentColor" />
          </div>
          <h1 className="mt-4 text-2xl font-black" style={{ color: "var(--ink-0)", fontFamily: "var(--font-display)" }}>明星入驻</h1>
          <p className="mt-2 text-[13px] max-w-md leading-relaxed" style={{ color: "var(--ink-1)" }}>
            完成入驻后，你的艺人档案将同步上架到「AI 明星带货」明星市场，
            创作者可向你发起带货授权申请 —— 一切商业化动作由本工作台审批。
          </p>
        </div>

        <div className="star-card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="艺名 / 姓名">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：沈腾" className="w-full h-10 px-3 rounded-xl text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="艺人品类">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className="px-2.5 h-8 rounded-lg text-xs font-semibold transition"
                    style={category === c
                      ? { background: "#f59e0b14", border: "1px solid #f59e0b55", color: "var(--star-gold-deep)" }
                      : { background: "var(--bg-2)", border: "1px solid transparent", color: "var(--ink-1)" }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="一句话定位" hint="明星市场卡片文案">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例：喜剧风格突出，适合搞笑类轻量植入" className="w-full h-10 px-3 rounded-xl text-sm outline-none" style={inputStyle} />
          </Field>

          <Field label="详细简介" hint="选填 · 详情页展示">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="代表作品、商业合作风格、粉丝画像…" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none" style={inputStyle} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="常驻城市" hint="选填">
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="北京 / 上海" className="w-full h-10 px-3 rounded-xl text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="粉丝量（万）">
              <input value={fansWan} onChange={(e) => setFansWan(e.target.value)} placeholder="4530" inputMode="decimal" className="w-full h-10 px-3 rounded-xl text-sm outline-none tabular" style={inputStyle} />
            </Field>
            <Field label="合作起价（元）">
              <input value={priceYuan} onChange={(e) => setPriceYuan(e.target.value)} placeholder="299" inputMode="decimal" className="w-full h-10 px-3 rounded-xl text-sm outline-none tabular" style={inputStyle} />
            </Field>
          </div>

          <button
            onClick={() => setAgentView((v) => !v)}
            className="w-full flex items-center justify-between p-3 rounded-xl transition"
            style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
          >
            <div className="text-left">
              <div className="text-[13px] font-semibold" style={{ color: "var(--ink-0)" }}>以经纪人视角运营</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-2)" }}>由经纪团队代为审批日常商务请求</div>
            </div>
            <div className="relative w-10 h-[22px] rounded-full transition-colors shrink-0" style={{ background: agentView ? "var(--ok)" : "var(--line-strong)" }}>
              <span className="absolute top-[2px] w-[18px] h-[18px] bg-white rounded-full shadow transition-all" style={{ left: agentView ? 20 : 2 }} />
            </div>
          </button>

          {error && (
            <div className="text-[12px] rounded-lg px-3 py-2" style={{ background: "var(--brand-soft)", color: "var(--brand-deep)" }}>{error}</div>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full h-11 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "var(--gradient-star)" }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            完成入驻，上架明星市场
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
