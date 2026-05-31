"use client";

// 真人授权管理（任务书 §7 配套模块）：跨所有AiAvatar的肖像授权总览。
import * as React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { AiAvatar, AiAvatarLicenseGrant } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
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
        <h1 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck className="h-5 w-5 text-amber-400" /> 真人授权管理</h1>
        <p className="mt-0.5 text-sm text-zinc-500">所有真人复刻AiAvatar的电子肖像授权 · 协议与照片加密绑定存档</p>
      </div>

      {rows === null ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-800/50" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 py-16 text-center text-sm text-zinc-500">
          尚无肖像授权 · 在真人复刻AiAvatar的「授权」Tab 中签署
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-2)] text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">AiAvatar</th>
                <th className="px-4 py-2.5 font-medium">被授权真人</th>
                <th className="px-4 py-2.5 font-medium">范围 / 平台</th>
                <th className="px-4 py-2.5 font-medium">有效期</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ avatar, license }) => (
                <tr key={license.id} className="border-t border-zinc-800">
                  <td className="px-4 py-3"><Link href={`/avatar/${avatar.id}`} className="text-zinc-100 hover:text-amber-400">{avatar.name}</Link></td>
                  <td className="px-4 py-3 text-zinc-300">{license.subjectName || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    <div>{license.scope || "—"}</div>
                    <div className="text-[11px] text-zinc-600">{license.platforms.join("、") || "全部平台"}</div>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-zinc-500">{dateTime(license.validFrom)} ~ {dateTime(license.validTo)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px]", license.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700 text-zinc-300")}>
                      {license.statusLabel ?? license.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
