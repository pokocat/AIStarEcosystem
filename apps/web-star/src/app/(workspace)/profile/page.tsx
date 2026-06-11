"use client";

// 档案设置 — 明星市场展示档案自维护（v0.62：编辑权从 admin 移入 star 端）。
// 可编辑：艺名 / 品类 / 一句话定位 / 长简介 / 常驻城市 / 粉丝量 / 头像 / 封面。
// 平台运营字段（热门标记 / 套餐档位 / 配额 / 定价）不在此页，仍由平台侧管理。

import * as React from "react";
import { Camera, CheckCircle2, ImageIcon, Loader2, Save, UserCog } from "lucide-react";
import { StarWorkbenchApi } from "@/api";
import { useStarShell } from "@/lib/star-shell-context";
import { ActionButton, InlineError, NoteBox, PageHeader } from "@/components/star/page-kit";

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

/** 头像 / 封面上传位：预览 + 点击换图。 */
function ImageUploadField({
  label, hint, value, kind, round, onUploaded,
}: {
  label: string;
  hint: string;
  value: string | undefined;
  kind: "avatar" | "cover";
  round?: boolean;
  onUploaded: (url: string) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pick = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = await StarWorkbenchApi.uploadProfileImage(file, kind);
      onUploaded(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-semibold" style={{ color: "var(--ink-0)" }}>{label}</span>
        <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>{hint}</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className={`relative overflow-hidden flex items-center justify-center transition hover:brightness-95 disabled:opacity-60 ${
          round ? "w-24 h-24 rounded-full" : "w-full h-32 rounded-xl"
        }`}
        style={{ background: "var(--bg-2)", border: "1px dashed var(--line-strong)" }}
        aria-label={`上传${label}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : kind === "avatar" ? (
          <Camera className="w-5 h-5" style={{ color: "var(--ink-2)" }} />
        ) : (
          <ImageIcon className="w-5 h-5" style={{ color: "var(--ink-2)" }} />
        )}
        <span
          className="absolute inset-x-0 bottom-0 py-1 text-[10px] font-bold text-white text-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          {uploading ? "上传中…" : "点击更换"}
        </span>
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.6)" }}>
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--ink-1)" }} />
          </span>
        )}
      </button>
      {error && <p className="mt-1 text-[11px]" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}

export default function ProfileSettingsPage() {
  const { profile, profileLoading, refreshProfile } = useStarShell();

  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState(CATEGORIES[0]);
  const [description, setDescription] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [fansWan, setFansWan] = React.useState("");
  const [avatar, setAvatar] = React.useState<string | undefined>(undefined);
  const [cover, setCover] = React.useState<string | undefined>(undefined);
  const [hydrated, setHydrated] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  // 档案到达后一次性预填（避免覆盖用户正在编辑的内容）
  React.useEffect(() => {
    if (!profile || hydrated) return;
    setName(profile.name);
    setCategory(profile.category || CATEGORIES[0]);
    setDescription(profile.description ?? "");
    setBio(profile.bio ?? "");
    setLocation(profile.location ?? "");
    setFansWan(profile.fans ? String(profile.fans / 10_000) : "");
    setAvatar(profile.avatar || undefined);
    setCover(profile.cover || undefined);
    setHydrated(true);
  }, [profile, hydrated]);

  const submit = async () => {
    setError(null);
    setSaved(false);
    if (!name.trim()) { setError("请填写艺名 / 姓名"); return; }
    if (!description.trim()) { setError("请填写一句话定位（将展示在明星市场卡片）"); return; }
    const fans = Math.round(parseFloat(fansWan || "0") * 10_000);
    if (!Number.isFinite(fans) || fans < 0) { setError("请填写有效的粉丝量"); return; }
    setSaving(true);
    try {
      await StarWorkbenchApi.updateProfile({
        name: name.trim(),
        category,
        description: description.trim(),
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        fans,
        avatar,
        cover,
      });
      await refreshProfile();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请稍后再试");
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading || !profile) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--ink-2)" }} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl">
      <PageHeader
        title="档案设置"
        sub="此处修改将同步到「AI 明星带货」明星市场的展示档案"
      />
      <InlineError message={error} onDismiss={() => setError(null)} />

      <NoteBox color="#0ea5e9" icon={UserCog}>
        明星档案由你（{profile.agentView ? "经纪团队" : "本人"}）自行维护；热门推荐、套餐档位与配额等运营配置仍由平台管理。
      </NoteBox>

      <div className="star-card p-5 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
          <ImageUploadField label="头像" hint="市场卡片头图" value={avatar} kind="avatar" round onUploaded={setAvatar} />
          <ImageUploadField label="封面" hint="详情页大图 · 建议竖版 3:4" value={cover} kind="cover" onUploaded={setCover} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="艺名 / 姓名">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 px-3 rounded-xl text-sm outline-none" style={inputStyle} />
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
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="代表作品、商业合作风格、粉丝画像…" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none" style={inputStyle} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="常驻城市" hint="选填">
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="北京 / 上海" className="w-full h-10 px-3 rounded-xl text-sm outline-none" style={inputStyle} />
          </Field>
          <Field label="粉丝量（万）" hint="影响艺人分级展示">
            <input value={fansWan} onChange={(e) => setFansWan(e.target.value)} placeholder="4530" inputMode="decimal" className="w-full h-10 px-3 rounded-xl text-sm outline-none tabular" style={inputStyle} />
          </Field>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <ActionButton color="#0ea5e9" icon={Save} onClick={() => void submit()} busy={saving}>
            保存档案
          </ActionButton>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--ok)" }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> 已保存，市场展示已同步
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
