"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Music2, TrendingUp, Heart, Clapperboard, Megaphone, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { mapTone } from "@/components/shared/tone";
import { getDigitalIp } from "@/api/digital-ips";
import { ARTIST_STATUS, ARTIST_QUALITY } from "@/constants/status";
import { ARTIST_TYPE_META, TALENT_LABELS } from "@/constants/artist-meta";
import { formatCompactNumber, formatCredits } from "@/lib/format";
import type { Artist } from "@/types/artist";

export default function ArtistDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [artist, setArtist] = React.useState<Artist | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    getDigitalIp(id)
      .then((a) => { if (alive) setArtist(a); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">加载中…</div>;
  }
  if (!artist) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        未找到该艺人。<Link href="/artists/roster" className="text-primary hover:underline">返回列表</Link>
      </div>
    );
  }

  const s = ARTIST_STATUS[artist.status];
  const q = ARTIST_QUALITY[artist.quality];
  const typeMeta = ARTIST_TYPE_META[artist.type];
  const exp = Math.min(100, Math.round((artist.exp / artist.maxExp) * 100));

  return (
    <>
      <Link href="/artists/roster" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="h-4 w-4" /> 返回列表
      </Link>

      <PageHeader
        title={artist.name}
        description={artist.bio}
        actions={
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
              锻造形象
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Sparkles className="h-4 w-4" /> 状态流转
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Section className="lg:col-span-1" title="基本信息">
          <div className="flex items-start gap-3">
            <div className="h-20 w-20 rounded-2xl bg-muted overflow-hidden shrink-0 ring-1 ring-border">
              {artist.avatar && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={artist.avatar} alt={artist.name} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                {s && <StatusBadge tone={mapTone(s.tone)} label={s.label} />}
                {q && <StatusBadge tone={mapTone(q.tone)} label={q.label} dot={false} />}
                <StatusBadge tone="neutral" label={`${typeMeta?.icon} ${typeMeta?.label}`} dot={false} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>等级 Lv.{artist.level}</span>
                <span>经验 {artist.exp.toLocaleString()} / {artist.maxExp.toLocaleString()}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-violet" style={{ width: `${exp}%` }} />
              </div>
              <div className="text-xs text-muted-foreground pt-1">
                工作室：<Link href={`/platform/studios`} className="text-primary hover:underline">{artist.studioName ?? artist.studioId}</Link>
              </div>
              <div className="text-xs text-muted-foreground">
                主营领域：{artist.domains.join(" · ")}
              </div>
            </div>
          </div>
        </Section>

        <Section className="lg:col-span-2" title="六维才艺">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(Object.keys(artist.talents) as (keyof typeof artist.talents)[]).map((k) => (
              <div key={k} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{TALENT_LABELS[k] ?? k}</span>
                  <span className="tabular-nums font-medium text-foreground">{artist.talents[k]}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${artist.talents[k]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Heart} label="粉丝" value={formatCompactNumber(artist.stats.fans)} hint={`人气值 ${artist.stats.popularity}`} tone="rose" />
        <StatCard icon={TrendingUp} label="累计收益" value={formatCredits(artist.stats.revenue)} hint={`月度 ${formatCredits(artist.stats.monthlyRevenue)}`} tone="emerald" />
        <StatCard icon={Music2} label="歌曲" value={artist.stats.songs} hint={`${artist.stats.variety} 综艺`} tone="primary" />
        <StatCard icon={Clapperboard} label="影视作品" value={artist.stats.dramas} hint={`${artist.stats.ads} 广告代言`} tone="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="商业价值">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">商业估值</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatCredits(artist.commercialValue)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">在手代言</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{artist.endorsements} 个</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">最后活跃</dt>
              <dd className="mt-0.5">{artist.lastActive}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">创建时间</dt>
              <dd className="mt-0.5">{artist.createdAt}</dd>
            </div>
          </dl>
        </Section>

        <Section title="孵化 / 锻造参数">
          <pre className="text-xs leading-relaxed text-muted-foreground bg-surface-muted rounded-md p-3 overflow-auto max-h-56">
            {JSON.stringify(artist.incubationParams ?? { info: "暂无孵化参数" }, null, 2)}
          </pre>
        </Section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <Section title={<div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> 关联内容概览</div>}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="text-xs text-muted-foreground">歌曲</div>
              <div className="mt-0.5 text-lg font-semibold">{artist.stats.songs}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="text-xs text-muted-foreground">短剧 / 电影</div>
              <div className="mt-0.5 text-lg font-semibold">{artist.stats.dramas}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="text-xs text-muted-foreground">广告</div>
              <div className="mt-0.5 text-lg font-semibold">{artist.stats.ads}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="text-xs text-muted-foreground">综艺</div>
              <div className="mt-0.5 text-lg font-semibold">{artist.stats.variety}</div>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
