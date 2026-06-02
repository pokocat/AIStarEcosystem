"use client";

// 选创作模式 + 立项起点 — 设计真源:screens-entry.jsx `PickMode`。
import * as React from "react";
import { Layers, Wand2 } from "lucide-react";
import type { ContentType, CreationMode } from "@/mocks/drama-workshop";
import { ModeCard } from "./mode-card";
import { GuidedStart } from "./guided-start";
import { TemplateStart } from "./template-start";

interface PickModeProps {
  type: ContentType;
  onEnter: (payload: {
    mode: CreationMode;
    topic?: string;
    template?: string;
    projectId: string;
  }) => void;
}

export function PickMode({ type, onEnter }: PickModeProps) {
  const [mode, setMode] = React.useState<CreationMode | null>(null);

  return (
    <div
      style={{
        maxWidth: mode ? 1040 : 940,
        margin: "0 auto",
        padding: "40px 0 70px",
        transition: "max-width .3s",
      }}
    >
      <div className="col center" style={{ textAlign: "center", marginBottom: 30 }}>
        <span className="tag tag-accent" style={{ marginBottom: 12 }}>
          已选 · {type.name}
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: "-.02em",
          }}
        >
          怎么开这部剧?
        </h1>
        <div className="muted" style={{ marginTop: 6 }}>
          两种方式,从「角色」阶段起完全一样。
        </div>
      </div>

      <div
        className="row gap-4"
        style={{ alignItems: "stretch", justifyContent: "center", flexWrap: "wrap" }}
      >
        <ModeCard
          active={mode === "guided"}
          onClick={() => setMode("guided")}
          from="#f97316"
          to="#fb923c"
          Icon={Wand2}
          title="AI 引导式"
          tagline="从零对话共创"
          desc="跟 AI 聊出你的故事 —— 它一次问一两个关键问题,陪你把灵感长成大纲。适合有想法但没成稿。"
        />
        <ModeCard
          active={mode === "template"}
          onClick={() => setMode("template")}
          from="#e11d48"
          to="#fb7185"
          Icon={Layers}
          title="爆款模板式"
          tagline="套用爆款结构快速成形"
          desc="挑一个验证过的爆款结构,注入你的人设和卖点,AI 快速补全。适合走量、要快、要稳。"
        />
      </div>

      {mode === "guided" && (
        <GuidedStart
          type={type}
          onEnter={(p) => onEnter({ mode: "guided", topic: p.topic, projectId: p.projectId })}
        />
      )}
      {mode === "template" && (
        <TemplateStart
          type={type}
          onEnter={(p) =>
            onEnter({ mode: "template", template: p.template, projectId: p.projectId })
          }
        />
      )}
    </div>
  );
}
