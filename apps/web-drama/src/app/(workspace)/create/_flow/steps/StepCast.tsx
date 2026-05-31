"use client";

import * as React from "react";
import { Users } from "lucide-react";
import { Card } from "@/components/premium";
import { SectionHeader, StatusBadge, EmptyState } from "@/components/common";
import { CharacterPanel } from "@/components/short-drama/character-panel";
import type { DramaDraftController } from "../useDramaDraft";

export function StepCast({ ctrl }: { ctrl: DramaDraftController }) {
  const s = ctrl.activeScript;
  if (!s) {
    return (
      <Card style={{ padding: "22px 24px" }}>
        <EmptyState icon={<Users size={26} />} title="还没有脚本" description="先在前面的步骤生成或新建脚本，再来配演员。" />
      </Card>
    );
  }
  return (
    <Card style={{ padding: "20px 24px" }}>
      <SectionHeader
        eyebrow="角色 · 演绎"
        title="角色与演员绑定"
        right={<StatusBadge tone="neutral" dot={false}>{ctrl.castOptions.length} 位可用演员</StatusBadge>}
      />
      <CharacterPanel
        characters={s.characters ?? []}
        onChange={(characters) => ctrl.update({ characters })}
        castOptions={ctrl.castOptions}
      />
    </Card>
  );
}
