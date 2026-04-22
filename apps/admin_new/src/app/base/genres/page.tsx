"use client";

import * as React from "react";
import { Tags, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { StatCard } from "@/components/shared/StatCard";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listGenres } from "@/api/music";
import type { MusicGenre } from "@/types/music";

export default function GenresPage() {
  const { data } = useAsyncList(() => listGenres());

  return (
    <>
      <PageHeader
        title="曲风 / 领域"
        description="基础分类数据维护 · 供歌曲 / 艺人 / 标签选择"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> 新增曲风
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <StatCard icon={Tags} label="曲风总数" value={data.length} tone="primary" />
        <StatCard label="已使用" value={data.length} tone="emerald" />
        <StatCard label="候选数" value={0} tone="amber" />
      </div>

      <Section title="曲风目录">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {data.map((g) => (
            <GenreCard key={g.id} genre={g} />
          ))}
        </div>
      </Section>
    </>
  );
}

function GenreCard({ genre: g }: { genre: MusicGenre }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:card-elev-2 transition-shadow">
      <div className="h-10 w-10 rounded-md bg-primary-soft text-primary flex items-center justify-center text-xl">
        {g.icon}
      </div>
      <div className="min-w-0">
        <div className="font-medium truncate">{g.name}</div>
        <div className="text-xs text-muted-foreground font-mono">{g.id}</div>
      </div>
    </div>
  );
}
