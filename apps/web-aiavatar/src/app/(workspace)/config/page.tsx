"use client";
// ============================================================
// 运营配置（operatorRole 门控）— 把所有「对接大模型 / 模板」的地方做成运营可配：
//   1. Prompt 模板（复用共享 prompt_template；key=aiavatar.*）
//   2. 风格 / 妆造模板 CRUD（img2img 样片）
//   3. 美颜模板 CRUD（beauty 参数）
//   4. 标准构图 + 快捷指令 / 默认人设
// 非运营访问 → 跳回 /library。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@ai-star-eco/api-client";
import { Seg } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { PromptConfigSection } from "@/components/config/prompt-config-section";
import { TemplateConfigSection } from "@/components/config/template-config-section";
import { UiConfigSection } from "@/components/config/ui-config-section";

type Tab = "prompt" | "style" | "beauty" | "general";

export default function ConfigPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [tab, setTab] = React.useState<Tab>("prompt");

  React.useEffect(() => {
    if (!loading && !user?.operatorRole) router.replace("/library");
  }, [loading, user, router]);

  if (loading || !user?.operatorRole) {
    return <div style={{ display: "grid", placeItems: "center", padding: "120px 0", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>校验运营权限…</div>;
  }

  return (
    <div className="fade-up" style={{ padding: "28px 36px 60px", maxWidth: 1320, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--accent)", marginBottom: 8 }}>OPERATOR CONFIG</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>运营配置</h1>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "3px 9px", borderRadius: 999, color: "var(--accent-hi)", border: "1px solid var(--accent-line)", background: "var(--accent-soft)" }}>
            {user.operatorRole === "super_admin" ? "超管" : "运营"}
          </span>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--ink-1)", marginTop: 6 }}>
          配置全链路对接大模型的 prompt 与各类模板。改动即时对创作者生效；prompt 改动支持灰度版本与试运行。
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Seg<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "prompt", icon: Icons.doc, label: "Prompt 模板" },
            { value: "style", icon: Icons.sparkle, label: "风格 / 妆造模板" },
            { value: "beauty", icon: Icons.wand, label: "美颜模板" },
            { value: "general", icon: Icons.sliders, label: "构图 / 快捷指令" },
          ]}
        />
      </div>

      {tab === "prompt" && <PromptConfigSection />}
      {tab === "style" && <TemplateConfigSection category="style" />}
      {tab === "beauty" && <TemplateConfigSection category="beauty" />}
      {tab === "general" && <UiConfigSection />}
    </div>
  );
}
