"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { Card } from "@/components/premium";
import { Field, TextInput, SectionHeader, EmptyState } from "@/components/common";
import { SceneEditor } from "@/components/short-drama/scene-editor";
import { ScriptProsePanel } from "@/components/short-drama/script-prose-panel";
import type { DramaDraftController } from "../useDramaDraft";

export function StepScript({ ctrl }: { ctrl: DramaDraftController }) {
  const s = ctrl.activeScript;
  if (!s) {
    return (
      <Card style={{ padding: "22px 24px" }}>
        <EmptyState icon={<FileText size={26} />} title="还没有脚本" description="回到「灵感」步用 AI 起草，或手动新建空白脚本。" />
      </Card>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: "20px 24px" }}>
        <Field label="一句话简介（logline）">
          <TextInput value={s.logline ?? ""} onChange={(e) => ctrl.update({ logline: e.target.value })} placeholder="一句话钩子，统领全剧" />
        </Field>
        <SectionHeader eyebrow="分镜" title="分场景编辑" />
        <SceneEditor
          scenes={s.scenes ?? []}
          onChange={(scenes) => ctrl.update({ scenes })}
          canRewrite={ctrl.persisted}
          onRewrite={ctrl.handleRewrite}
        />
        {!ctrl.persisted && (
          <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 8 }}>提示：保存脚本后可对单镜使用「AI 重写」。</div>
        )}
      </Card>

      <ScriptProsePanel defaultTitle={s.title} />
    </div>
  );
}
