"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { StatCard } from "@/components/shared/StatCard";
import { getForgeOptions } from "@/api/appearance-forge";
import type { ForgeOptions, ForgeTemplate, LabeledOption } from "@/types/appearance-forge";

export default function PresetsPage() {
  const [opts, setOpts] = React.useState<ForgeOptions | null>(null);

  React.useEffect(() => {
    let alive = true;
    getForgeOptions().then((o) => { if (alive) setOpts(o); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <>
      <PageHeader
        title="孵化 / 锻造炉预设"
        description="Appearance Forge 静态选项清单 · 模板、发型、瞳色、风格标签、配色方案"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Sparkles} label="模板数" value={opts?.templates.length ?? 0} tone="primary" />
        <StatCard label="发型" value={opts?.hairStyles.length ?? 0} tone="violet" />
        <StatCard label="瞳色" value={opts?.eyeColors.length ?? 0} tone="sky" />
        <StatCard label="风格标签" value={opts?.styleTags.length ?? 0} tone="emerald" />
      </div>

      <Section className="mb-4" title="模板（底片）" padding={false}>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
          {opts?.templates.map((t: ForgeTemplate) => (
            <div key={t.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="aspect-[4/3] bg-muted overflow-hidden">
                {t.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={t.image} alt={t.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-2.5">
                <div className="text-sm font-medium truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground truncate">{t.style} · {t.tags.slice(0, 3).join(" · ")}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LabeledSection title="发型" items={opts?.hairStyles} />
        <LabeledSection title="瞳色" items={opts?.eyeColors} showColor />
        <LabeledSection title="风格标签" items={opts?.styleTags} />
        <Section title="配色方案">
          <div className="grid grid-cols-2 gap-2">
            {opts?.colorSchemes.map((cs) => (
              <div key={cs.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                <div
                  className="h-8 w-8 rounded-md shrink-0"
                  style={{ background: `linear-gradient(135deg, ${cs.colors[0]}, ${cs.colors[1]})` }}
                />
                <span className="text-sm truncate">{cs.name}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}

function LabeledSection({ title, items, showColor }: { title: string; items?: LabeledOption[]; showColor?: boolean }) {
  return (
    <Section title={title}>
      <div className="flex flex-wrap gap-2">
        {(items ?? []).map((it) => (
          <span key={it.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
            {showColor && it.color && (
              <span className="h-3 w-3 rounded-full ring-1 ring-border" style={{ background: it.color }} />
            )}
            {it.label}
          </span>
        ))}
      </div>
    </Section>
  );
}
