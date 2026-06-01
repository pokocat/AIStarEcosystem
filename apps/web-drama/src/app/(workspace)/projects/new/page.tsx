"use client";

export const dynamic = "force-dynamic";

// 新建短剧流程 — 占位(B4 将填入完整的 选类型 + 选模式 + 立项起点 流程)。
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Wand2 } from "lucide-react";

export default function NewProjectStub() {
  const router = useRouter();
  return (
    <div className="col center" style={{ minHeight: "60vh", textAlign: "center", gap: 16 }}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 20,
          background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
          display: "grid",
          placeItems: "center",
          color: "#fff",
          boxShadow: "var(--shadow-accent)",
        }}
      >
        <Wand2 size={28} />
      </div>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em" }}>
          新建短剧
        </h1>
        <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          选类型 → AI 引导 / 套用模板 → 立项起点 —— 这部分正在搭建中(B4)
        </div>
      </div>
      <button type="button" className="btn btn-line" onClick={() => router.push("/projects")}>
        <ChevronLeft size={16} /> 返回我的短剧
      </button>
    </div>
  );
}
