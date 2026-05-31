"use client";

import * as React from "react";
import { Download, FileSignature, Loader2, Plus, ShieldCheck } from "lucide-react";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { DialogShell } from "../dialogs/dialog-shell";
import { dateTime } from "@/lib/format";

const PLATFORMS = ["抖音", "小红书", "视频号", "快手", "B站", "微博"];

/** 真人授权管理（任务书 §7）：电子肖像授权签署（范围/期限/平台），与照片绑定加密存档。 */
export function LicenseTab({ detail, onChanged }: { detail: AiAvatarDetail; onChanged: () => void }) {
  const { avatar, licenses } = detail;
  const [open, setOpen] = React.useState(false);

  if (avatar.mode !== "real_clone") {
    return <div className="rounded-xl border border-dashed border-zinc-700 py-14 text-center text-sm text-zinc-500">AI 原创AiAvatar无需真人肖像授权</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">真人复刻定稿前需签署有效肖像授权</p>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
          <FileSignature className="h-4 w-4" /> 签署授权
        </button>
      </div>

      {licenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 py-14 text-center text-sm text-zinc-500">尚未签署肖像授权</div>
      ) : (
        <div className="space-y-3">
          {licenses.map((l) => (
            <div key={l.id} className="rounded-xl border border-zinc-800 bg-[var(--bg-1)] p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className={cn("h-4 w-4", l.status === "active" ? "text-emerald-400" : "text-zinc-500")} />
                <span className="font-medium text-zinc-100">{l.subjectName || "未具名"}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px]",
                  l.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700 text-zinc-300")}>
                  {l.statusLabel ?? l.status}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs text-zinc-400">
                <div>范围：<span className="text-zinc-300">{l.scope || "—"}</span></div>
                <div>签署人：<span className="text-zinc-300">{l.signatureName}</span></div>
                <div>有效期：<span className="text-zinc-300">{dateTime(l.validFrom)} ~ {dateTime(l.validTo)}</span></div>
                <div>平台：<span className="text-zinc-300">{l.platforms.join("、") || "—"}</span></div>
              </div>
              {l.platforms.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {l.platforms.map((p) => <span key={p} className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">{p}</span>)}
                </div>
              )}
              {l.credentialUrl && (
                <a href={l.credentialUrl} className="mt-3 inline-flex items-center gap-1 text-xs text-amber-400 hover:underline">
                  <Download className="h-3 w-3" /> 下载授权凭证
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {open && <SignDialog avatarId={avatar.id} onClose={() => setOpen(false)} onSigned={() => { setOpen(false); onChanged(); }} />}
    </div>
  );
}

function SignDialog({ avatarId, onClose, onSigned }: { avatarId: string; onClose: () => void; onSigned: () => void }) {
  const [subjectName, setSubjectName] = React.useState("");
  const [scope, setScope] = React.useState("商业代言 + 内容连载");
  const [signatureName, setSignatureName] = React.useState("");
  const [platforms, setPlatforms] = React.useState<string[]>([]);
  const [validTo, setValidTo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const toggle = (p: string) => setPlatforms((ps) => ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]);

  const submit = async () => {
    if (!signatureName.trim()) { setErr("请填写签署人"); return; }
    setBusy(true); setErr(null);
    try {
      await AiAvatarApi.signLicense(avatarId, {
        subjectName: subjectName.trim() || undefined, scope, signatureName: signatureName.trim(),
        platforms, validTo: validTo ? new Date(validTo).toISOString() : undefined,
        agreementText: `本人 ${signatureName} 授权平台将「${subjectName || "本人"}」肖像用于 ${scope}，授权平台：${platforms.join("、") || "全部"}。`,
      });
      onSigned();
    } catch (e) { setErr(e instanceof Error ? e.message : "签署失败"); }
    finally { setBusy(false); }
  };

  return (
    <DialogShell title="电子肖像授权签署" onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300">取消</button>
          <button onClick={submit} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} 确认签署
          </button>
        </>
      }>
      <div className="space-y-3 text-sm">
        <L label="被授权肖像真人姓名"><input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} className="inp" placeholder="如：张某" /></L>
        <L label="授权范围"><input value={scope} onChange={(e) => setScope(e.target.value)} className="inp" /></L>
        <L label="授权平台">
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button key={p} onClick={() => toggle(p)}
                className={cn("rounded-full border px-2.5 py-1 text-xs", platforms.includes(p) ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-zinc-700 text-zinc-400")}>
                {p}
              </button>
            ))}
          </div>
        </L>
        <L label="有效期至"><input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className="inp" /></L>
        <L label="签署人（电子签名）"><input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} className="inp" placeholder="您的姓名" /></L>
        {err && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{err}</p>}
      </div>
      <style jsx>{`.inp{width:100%;border-radius:8px;border:1px solid #3a3a42;background:#18181b;padding:8px 12px;font-size:14px;color:#f5f1e8;outline:none}`}</style>
    </DialogShell>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs text-zinc-400">{label}</span>{children}</label>;
}
