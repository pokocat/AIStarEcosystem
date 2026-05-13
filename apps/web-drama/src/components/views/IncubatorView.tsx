"use client";

// 演员孵化向导 · 影院级多步表单。
// 4 步：基础信息 → 才艺六维 → 形象与擅长 → 预览确认。
// 左侧表单 60%、右侧实时预览卡片 40%；底部步骤指示器 + 上一步 / 下一步。

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Crown,
  Drama,
  Film,
  Mic2,
  Music,
  Sparkles,
  Star,
  Theater,
  TrendingUp,
  Users,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  Artist,
  ArtistQuality,
  ArtistType,
  TalentProfile,
} from "@ai-star-eco/types/artist";
import { Button, Card, Chip } from "@/components/premium";
import {
  formatCny,
  QUALITY_LABEL,
  QUALITY_GRADIENT,
  QUALITY_TONE,
} from "@/lib/cast-derive";

interface FormState {
  name: string;
  type: Extract<ArtistType, "actor" | "all_rounder" | "dancer">;
  quality: ArtistQuality;
  bio: string;
  talents: TalentProfile;
  domains: string[];
}

const TYPE_OPTIONS: { id: FormState["type"]; label: string; icon: LucideIcon; desc: string }[] = [
  { id: "actor", label: "专业演员", icon: Drama, desc: "聚焦影视剧集主线，演技为核心驱动力。" },
  { id: "all_rounder", label: "全能型", icon: Star, desc: "演 + 综艺 + 商业代言无短板，适合长尾经营。" },
  { id: "dancer", label: "舞台型", icon: Music, desc: "舞蹈与肢体表演能力突出，适合短剧 + 舞台演出。" },
];

const QUALITY_OPTIONS: { id: ArtistQuality; icon: LucideIcon; desc: string }[] = [
  { id: "legendary", icon: Crown, desc: "传说级 · 平台级 IP 投资门槛" },
  { id: "epic", icon: Award, desc: "顶级 · 主线剧集 + 头部代言" },
  { id: "rare", icon: Star, desc: "进阶 · 单元剧 + 中腰部代言" },
  { id: "common", icon: Users, desc: "通用 · 长尾内容 + 群演位置" },
];

const TALENT_AXES: { key: keyof TalentProfile; label: string }[] = [
  { key: "singing", label: "声乐" },
  { key: "acting", label: "演技" },
  { key: "dancing", label: "舞蹈" },
  { key: "hosting", label: "主持" },
  { key: "comedy", label: "喜剧" },
  { key: "variety", label: "综艺" },
];

const DOMAIN_OPTIONS = [
  { id: "影视", icon: Theater },
  { id: "音乐", icon: Mic2 },
  { id: "舞台表演", icon: Star },
  { id: "综艺", icon: Sparkles },
  { id: "商业代言", icon: TrendingUp },
  { id: "教育培训", icon: Award },
  { id: "游戏娱乐", icon: Film },
];

const STEPS = [
  { id: 0, label: "基础信息" },
  { id: 1, label: "才艺六维" },
  { id: 2, label: "形象与擅长" },
  { id: 3, label: "预览确认" },
];

const QUALITY_TALENT_PRESET: Record<ArtistQuality, number> = {
  legendary: 78,
  epic: 70,
  rare: 60,
  common: 45,
};

function defaultFormForQuality(quality: ArtistQuality): FormState {
  const v = QUALITY_TALENT_PRESET[quality];
  return {
    name: "",
    type: "actor",
    quality,
    bio: "",
    talents: { singing: v - 20, acting: v + 12, dancing: v - 5, hosting: v - 15, comedy: v - 10, variety: v - 8 },
    domains: ["影视"],
  };
}

export function IncubatorView() {
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<FormState>(() => defaultFormForQuality("epic"));
  const [submitted, setSubmitted] = React.useState(false);

  const canNext = React.useMemo(() => {
    if (step === 0) return form.name.trim().length >= 2;
    if (step === 2) return form.bio.trim().length >= 4 && form.domains.length > 0;
    return true;
  }, [step, form]);

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else setSubmitted(true);
  }
  function prev() {
    if (step > 0) setStep(step - 1);
  }

  function reset() {
    setStep(0);
    setForm(defaultFormForQuality("epic"));
    setSubmitted(false);
  }

  if (submitted) {
    return <SubmittedScreen form={form} onReset={reset} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 标题 */}
      <div>
        <div className="eyebrow">演员孵化向导</div>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "var(--tracking-tight)",
            fontFamily: "var(--font-display)",
            margin: "10px 0 8px",
            lineHeight: 1.05,
          }}
        >
          孵化一位新{" "}
          <span
            className="text-gradient-gold"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
          >
            演员
          </span>
        </h1>
        <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>
          四步定档：基础信息 → 才艺六维 → 形象与擅长 → 预览确认。
        </div>
      </div>

      {/* 步骤指示器 */}
      <Card style={{ padding: "16px 22px" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {STEPS.map((s, i) => {
            const reached = step >= s.id;
            const current = step === s.id;
            return (
              <React.Fragment key={s.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: reached ? "var(--gradient-gold)" : "rgba(255,255,255,0.05)",
                      color: reached ? "#1a1410" : "var(--fg-2)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      fontWeight: 700,
                      border: current ? "2px solid var(--accent)" : "1px solid var(--line-2)",
                    }}
                  >
                    {step > s.id ? <Check size={14} /> : s.id + 1}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontFamily: "var(--font-display)",
                      color: current ? "var(--fg-0)" : reached ? "var(--fg-1)" : "var(--fg-3)",
                      fontWeight: current ? 600 : 400,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background:
                        step > s.id
                          ? "var(--gradient-gold)"
                          : "var(--line)",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      {/* 主体：左表单 + 右预览 */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <Card style={{ padding: "28px 32px", minHeight: 560 }}>
          {step === 0 && <BasicStep form={form} setForm={setForm} />}
          {step === 1 && <TalentsStep form={form} setForm={setForm} />}
          {step === 2 && <ImageStep form={form} setForm={setForm} />}
          {step === 3 && <ReviewStep form={form} />}
        </Card>

        <Card glass style={{ padding: 0, overflow: "hidden", minHeight: 560 }}>
          <PreviewCard form={form} />
        </Card>
      </div>

      {/* 底部按钮 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Button variant="secondary" size="md" onClick={prev} disabled={step === 0}>
          <ArrowLeft size={14} /> 上一步
        </Button>
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-2)", letterSpacing: 0.5 }}>
          第 {step + 1} 步 / 共 {STEPS.length} 步
        </div>
        <Button variant="primary" size="md" onClick={next} disabled={!canNext}>
          {step === STEPS.length - 1 ? (
            <>
              <Wand2 size={14} /> 立即孵化
            </>
          ) : (
            <>
              下一步 <ArrowRight size={14} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── 各步表单 ───────────────────────────────────────────────────────────────

function BasicStep({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <StepHeader label="第 1 步" title="基础信息" desc="演员定位 · 类型 · 品质决定后续才艺与商业曲线。" />

      <div>
        <Label>演员名</Label>
        <input
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          placeholder="例：苏念 / Aiko / Phoenix"
          style={inputStyle}
          maxLength={20}
        />
        <Hint>2–20 字 · 中文 / 英文均可，公开后不能修改</Hint>
      </div>

      <div>
        <Label>演员类型</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {TYPE_OPTIONS.map((t) => {
            const Icon = t.icon;
            const active = form.type === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setForm((s) => ({ ...s, type: t.id }))}
                style={pickerCard(active)}
              >
                <Icon size={20} color={active ? "var(--accent)" : "var(--fg-2)"} />
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: active ? "var(--fg-0)" : "var(--fg-1)",
                    marginTop: 8,
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {t.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 6, lineHeight: 1.5 }}>
                  {t.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>品质等级</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {QUALITY_OPTIONS.map((q) => {
            const Icon = q.icon;
            const active = form.quality === q.id;
            return (
              <button
                key={q.id}
                onClick={() =>
                  setForm((s) => ({
                    ...s,
                    quality: q.id,
                    talents: defaultFormForQuality(q.id).talents,
                  }))
                }
                style={pickerCard(active)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon size={18} color={active ? "var(--accent)" : "var(--fg-2)"} />
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: active ? "var(--fg-0)" : "var(--fg-1)",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {QUALITY_LABEL[q.id]}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 8, lineHeight: 1.5 }}>
                  {q.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TalentsStep({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <StepHeader
        label="第 2 步"
        title="才艺六维"
        desc="拖动滑块定义初始才艺，平均值会影响开播能力与单集出场费。"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {TALENT_AXES.map((axis) => (
          <div key={axis.key}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 6,
              }}
            >
              <Label>{axis.label}</Label>
              <div
                className="mono"
                style={{
                  fontSize: 13,
                  color: "var(--fg-0)",
                  fontWeight: 600,
                }}
              >
                {form.talents[axis.key]}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={form.talents[axis.key]}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  talents: { ...s.talents, [axis.key]: Number(e.target.value) },
                }))
              }
              style={rangeStyle}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "14px 16px",
          borderRadius: "var(--radius-md)",
          background: "rgba(212,175,106,0.08)",
          border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
          fontSize: 12,
          color: "var(--fg-1)",
          lineHeight: 1.6,
        }}
      >
        <Sparkles size={14} color="var(--accent)" style={{ verticalAlign: -2, marginRight: 6 }} />
        平均才艺：
        <span className="mono" style={{ color: "var(--accent)", fontWeight: 600, marginLeft: 4 }}>
          {Math.round(
            TALENT_AXES.reduce((s, a) => s + form.talents[a.key], 0) / TALENT_AXES.length,
          )}
        </span>
        {" "}
        ·{" "}
        建议演员的演技 ≥ 70 才能进入主线剧集。
      </div>
    </div>
  );
}

function ImageStep({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  function toggleDomain(d: string) {
    setForm((s) => ({
      ...s,
      domains: s.domains.includes(d) ? s.domains.filter((x) => x !== d) : [...s.domains, d],
    }));
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <StepHeader
        label="第 3 步"
        title="形象与擅长"
        desc="一句简介概括人物气质；勾选擅长领域影响排片优先级。"
      />

      <div>
        <Label>简介（一句话）</Label>
        <textarea
          value={form.bio}
          onChange={(e) => setForm((s) => ({ ...s, bio: e.target.value }))}
          placeholder="例：都市悬疑女主，擅长情绪张力与微表情。"
          style={{ ...inputStyle, height: 88, padding: 12, resize: "vertical" }}
          maxLength={80}
        />
        <Hint>4–80 字 · 这一句会显示在演员档案与卡片上</Hint>
      </div>

      <div>
        <Label>擅长领域</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {DOMAIN_OPTIONS.map((d) => {
            const Icon = d.icon;
            const active = form.domains.includes(d.id);
            return (
              <button
                key={d.id}
                onClick={() => toggleDomain(d.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderRadius: "var(--radius-pill)",
                  fontSize: 13,
                  background: active
                    ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                    : "rgba(255,255,255,0.03)",
                  border: active
                    ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                    : "1px solid var(--line-2)",
                  color: active ? "var(--accent)" : "var(--fg-1)",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  transition: "background 160ms, border-color 160ms",
                }}
              >
                <Icon size={14} />
                {d.id}
              </button>
            );
          })}
        </div>
        <Hint>至少选 1 项 · 已选 {form.domains.length} 项</Hint>
      </div>
    </div>
  );
}

function ReviewStep({ form }: { form: FormState }) {
  const avg = Math.round(
    TALENT_AXES.reduce((s, a) => s + form.talents[a.key], 0) / TALENT_AXES.length,
  );
  const cost = costForQuality(form.quality);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <StepHeader
        label="第 4 步"
        title="预览确认"
        desc="再次核对演员定位与初始能力，确认后立即创建并扣除孵化积分。"
      />

      <div
        style={{
          padding: "20px 22px",
          borderRadius: "var(--radius-md)",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <SummaryRow label="演员名" value={form.name || "—"} />
        <SummaryRow label="类型" value={TYPE_OPTIONS.find((t) => t.id === form.type)?.label ?? "—"} />
        <SummaryRow label="品质" value={QUALITY_LABEL[form.quality]} accent />
        <SummaryRow label="平均才艺" value={`${avg} / 100`} />
        <SummaryRow label="擅长领域" value={form.domains.join(" · ") || "—"} />
        <SummaryRow label="孵化成本" value={formatCny(cost)} accent />
      </div>

      <div
        style={{
          padding: "14px 16px",
          borderRadius: "var(--radius-md)",
          background: "rgba(255,61,138,0.08)",
          border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
          fontSize: 12,
          color: "var(--fg-1)",
          lineHeight: 1.6,
        }}
      >
        孵化操作不可逆：演员名、类型、品质创建后无法修改；才艺值后续可通过训练升档。
      </div>
    </div>
  );
}

function SubmittedScreen({ form, onReset }: { form: FormState; onReset: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: "50%",
            margin: "0 auto 20px",
            background: "var(--gradient-gold)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 36px rgba(212,175,106,0.35)",
          }}
        >
          <CheckCircle2 size={36} color="#1a1410" strokeWidth={2.4} />
        </div>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "var(--tracking-tight)",
            fontFamily: "var(--font-display)",
            margin: "12px 0 10px",
          }}
        >
          孵化{" "}
          <span
            className="text-gradient-gold"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
          >
            完成
          </span>
        </h1>
        <p style={{ fontSize: 15, color: "var(--fg-1)", maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>
          演员 <strong style={{ color: "var(--fg-0)" }}>{form.name}</strong> 已加入阵容（{QUALITY_LABEL[form.quality]}），
          可在演员阵容看到 ta 的档案，并立即安排训练 / 排片。
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 28 }}>
          <Button variant="primary" size="md" onClick={onReset}>
            <Wand2 size={14} /> 再孵化一位
          </Button>
          <a href="/console?tab=cast">
            <Button variant="secondary" size="md">
              查看演员阵容 <ArrowRight size={14} />
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── 实时预览卡片 ──────────────────────────────────────────────────────────

function PreviewCard({ form }: { form: FormState }) {
  const previewArtist: Pick<Artist, "name" | "quality" | "bio"> = {
    name: form.name || "未命名演员",
    quality: form.quality,
    bio: form.bio || "（未填写简介）",
  };
  return (
    <>
      <div className="eyebrow" style={{ padding: "18px 22px 8px" }}>
        实时预览
      </div>
      <div
        style={{
          margin: "0 22px 18px",
          height: 240,
          borderRadius: "var(--radius-md)",
          background: QUALITY_GRADIENT[form.quality],
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.65))",
          }}
        />
        <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 6 }}>
          <Chip tone={QUALITY_TONE[form.quality]}>{QUALITY_LABEL[form.quality]}</Chip>
          <Chip tone="neutral">训练中</Chip>
        </div>
        <div style={{ position: "absolute", bottom: 14, left: 16, right: 16 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--fg-0)",
            }}
          >
            {previewArtist.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--fg-1)",
              marginTop: 4,
              lineHeight: 1.5,
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
            }}
          >
            {previewArtist.bio}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 22px 18px" }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>初始才艺</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {TALENT_AXES.map((axis) => {
            const v = form.talents[axis.key];
            return (
              <div key={axis.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 36, fontSize: 11, color: "var(--fg-2)" }}>{axis.label}</div>
                <div
                  style={{
                    flex: 1,
                    height: 4,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${v}%`,
                      height: "100%",
                      background: "var(--gradient-gold)",
                    }}
                  />
                </div>
                <div
                  className="mono"
                  style={{ width: 28, fontSize: 11, color: "var(--fg-1)", textAlign: "right" }}
                >
                  {v}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "0 22px 22px" }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>擅长领域</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {form.domains.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>（请至少选择一项）</div>
          ) : (
            form.domains.map((d) => (
              <Chip key={d} tone="accent">
                {d}
              </Chip>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── 视觉 helpers ───────────────────────────────────────────────────────────

function StepHeader({ label, title, desc }: { label: string; title: string; desc: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          fontFamily: "var(--font-display)",
          margin: "8px 0 6px",
          letterSpacing: "var(--tracking-tight)",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>{desc}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="eyebrow"
      style={{ marginBottom: 8, fontSize: 11 }}
    >
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 6, fontFamily: "var(--font-mono)", letterSpacing: 0.3 }}
    >
      {children}
    </div>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: 10,
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ fontSize: 13, color: "var(--fg-2)" }}>{label}</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: accent ? "var(--accent)" : "var(--fg-0)",
          fontFamily: accent ? "var(--font-display)" : "var(--font-sans)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--line-2)",
  borderRadius: "var(--radius-md)",
  color: "var(--fg-0)",
  fontSize: 14,
  fontFamily: "var(--font-sans)",
  outline: "none",
};

const rangeStyle: React.CSSProperties = {
  width: "100%",
  height: 4,
  background: "linear-gradient(90deg, var(--accent) 0%, var(--accent) var(--val,50%), rgba(255,255,255,0.08) var(--val,50%))",
  borderRadius: 2,
  appearance: "none",
  WebkitAppearance: "none",
  cursor: "pointer",
  outline: "none",
  accentColor: "var(--accent)",
};

function pickerCard(active: boolean): React.CSSProperties {
  return {
    padding: "16px 18px",
    borderRadius: "var(--radius-md)",
    background: active
      ? "color-mix(in srgb, var(--accent) 10%, transparent)"
      : "rgba(255,255,255,0.02)",
    border: active
      ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
      : "1px solid var(--line-2)",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "var(--font-sans)",
    color: "var(--fg-0)",
    transition: "background 160ms, border-color 160ms",
  };
}

function costForQuality(q: ArtistQuality): number {
  switch (q) {
    case "legendary":
      return 200_000;
    case "epic":
      return 80_000;
    case "rare":
      return 30_000;
    default:
      return 8_000;
  }
}
