"use client";

// 授权总览（配套工具，导航降一级）：跨所有 AiAvatar 的真人肖像授权汇总（只读）。
// 签署在某个真人复刻 AiAvatar 的「输入与授权」里完成。
import * as React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { AiAvatar, AiAvatarLicenseGrant } from "@ai-star-eco/types/ai-avatar";
import { AiAvatarApi } from "@/api";
import { TonePill } from "@/components/common/status-pill";
import { dateTime } from "@/lib/format";

export default function LicensesPage() {
  const [rows, setRows] = React.useState<{ avatar: AiAvatar; license: AiAvatarLicenseGrant }[] | null>(null);

  React.useEffect(() => {
    (async () => {
      const avatars = await AiAvatarApi.listAvatars();
      const real = avatars.filter((a) => a.mode === "real_clone");
      const out: { avatar: AiAvatar; license: AiAvatarLicenseGrant }[] = [];
      for (const a of real) {
        const d = await AiAvatarApi.getDetail(a.id).catch(() => null);
        for (const l of d?.licenses ?? []) out.push({ avatar: a, license: l });
      }
      setRows(out);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><ShieldCheck className="h-5 w-5 text-[var(--brand-strong)]" /> 授权总览</h1>
        <p className="mt-0.5 text-sm text-[var(--fg-2)]">所有真人复刻 AiAvatar 的电子肖像授权 · 协议与照片加密绑定存档</p>
      </div>

      {rows === null ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--bg-2)]" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--bg-1)] py-16 text-center text-sm text-[var(--fg-3)]">
          尚无肖像授权 · 在真人复刻 AiAvatar 的「输入与授权」中签署
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-2)] text-left text-xs text-[var(--fg-2)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">AiAvatar</th>
                <th className="px-4 py-2.5 font-medium">被授权真人</th>
                <th className="px-4 py-2.5 font-medium">范围 / 平台</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">有效期</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ avatar, license }) => (
                <tr key={license.id} className="border-t border-[var(--line)] transition hover:bg-[var(--bg-2)]">
                  <td className="px-4 py-3"><Link href={`/avatar/${avatar.id}`} className="font-medium text-[var(--fg-0)] transition hover:text-[var(--brand-strong)]">{avatar.name}</Link></td>
                  <td className="px-4 py-3 text-[var(--fg-1)]">{license.subjectName || "—"}</td>
                  <td className="px-4 py-3 text-[var(--fg-2)]">
                    <div>{license.scope || "—"}</div>
                    <div className="text-[11px] text-[var(--fg-3)]">{license.platforms.join("、") || "全部平台"}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-[11px] text-[var(--fg-3)] sm:table-cell">{dateTime(license.validFrom)} ~ {dateTime(license.validTo)}</td>
                  <td className="px-4 py-3"><TonePill tone={license.status === "active" ? "success" : "muted"}>{license.statusLabel ?? license.status}</TonePill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
