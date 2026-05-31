"use client";

export const dynamic = "force-dynamic";

// 短剧创作 · 统一入口（v0.7）。
// 合并原「脚本工坊」+「短剧生成」：极速模式（一句话出片）/ 专业模式（分步流水线）共用同一 DramaScript。
// 动线：选题灵感 → 剧本（结构化分镜 + 长文本编剧室/版本树）→ 分镜 → 角色与演员 → 生成 → 成片 → 分发。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ViewHeader } from "@/components/common";
import { useDramaDraft } from "./_flow/useDramaDraft";
import { ModePicker } from "./_flow/ModePicker";
import { ExpressMode } from "./_flow/ExpressMode";
import { ProMode } from "./_flow/ProMode";
import { getDramaTemplate } from "@/lib/drama-templates";

type Mode = "pick" | "express" | "pro";

export default function CreatePage() {
  return (
    <React.Suspense fallback={null}>
      <CreateInner />
    </React.Suspense>
  );
}

function CreateInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const ctrl = useDramaDraft();

  const [mode, setMode] = React.useState<Mode>(() => {
    const m = sp.get("mode");
    if (m === "express" || m === "pro") return m;
    if (sp.get("tpl")) return "express";
    return "pick";
  });

  // 模板预填（仅一次）
  const tplApplied = React.useRef(false);
  React.useEffect(() => {
    if (tplApplied.current) return;
    const tpl = getDramaTemplate(sp.get("tpl"));
    if (tpl) {
      ctrl.setTheme(tpl.theme);
      ctrl.setGenre(tpl.genre);
      ctrl.setDuration(tpl.durationSec);
      tplApplied.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(m: "express" | "pro") {
    setMode(m);
    router.replace(`/create?mode=${m}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="短剧创作"
        title={
          <>
            短剧{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              创作工坊
            </span>
          </>
        }
        meta="选题灵感 → 剧本 → 分镜 → 角色与演员 → 生成 → 成片 → 分发；极速一句话出片，或专业逐环精修。"
      />
      {mode === "pick" && <ModePicker onPick={pick} />}
      {mode === "express" && <ExpressMode ctrl={ctrl} onBack={() => setMode("pick")} onSwitchToPro={() => setMode("pro")} />}
      {mode === "pro" && <ProMode ctrl={ctrl} onBack={() => setMode("pick")} />}
    </div>
  );
}
