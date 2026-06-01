"use client";

export const dynamic = "force-dynamic";

// 新建短剧 — 两步:① 选内容类型 ② 选创作模式 + 立项起点
// 设计真源:screens-entry.jsx `NewProjectFlow`。
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PickMode, PickType, StepDot } from "@/components/drama-workshop/new-project";
import type { ContentType } from "@/mocks/drama-workshop";

export default function NewProjectFlow() {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [type, setType] = React.useState<ContentType | null>(null);

  const enterWorkbench = (payload: { projectId: string }) => {
    router.push(`/projects/${payload.projectId}`);
  };

  return (
    <div style={{ minHeight: "100%", position: "relative" }}>
      {/* 步骤头(嵌入工作台内容区,不抢工作台 topbar) */}
      <header
        className="row"
        style={{
          position: "sticky",
          top: -28,
          margin: "-28px -32px 8px",
          padding: "14px 32px",
          background: "color-mix(in oklch, var(--bg) 88%, transparent)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--line-soft)",
          zIndex: 5,
        }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => (step === 1 ? router.push("/projects") : setStep(1))}
        >
          <ChevronLeft size={16} /> {step === 1 ? "返回我的短剧" : "上一步"}
        </button>
        <div className="grow row center gap-3">
          <StepDot n={1} label="选内容类型" active={step === 1} done={step > 1} />
          <div
            style={{
              width: 40,
              height: 2,
              background: step > 1 ? "var(--accent)" : "var(--line)",
            }}
          />
          <StepDot n={2} label="选创作模式" active={step === 2} done={false} />
        </div>
        <div style={{ width: 120 }} />
      </header>

      {step === 1 && (
        <PickType
          onPick={(t) => {
            setType(t);
            setStep(2);
          }}
        />
      )}
      {step === 2 && type && <PickMode type={type} onEnter={enterWorkbench} />}
    </div>
  );
}
