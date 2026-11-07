/**
 * 发布中心 — 发布池、内容日历、AI 内容规划与全网分发
 * 作品从 AI 导演台送审后进入发布池，这里的计数会实时同步。
 */
import React, { useEffect, useState } from 'react';
import type { Lang } from '../../translations';
import { PublishPool } from './PublishPool';
import { ContentCalendar } from './ContentCalendar';
import { ContentPlanningBoard } from './ContentPlanningBoard';
import { DistributionPage } from './DistributionPage';
import type { Artist } from './ArtistTypes';
import { POOL_EVENT, readPool, SAMPLE_POOL_COUNT } from './publishPoolStore';
import { HubShell, useHubTab } from './HubShell';

export const PublishCenter = ({ lang, activeArtist, initialTab }: { lang: Lang; activeArtist: Artist; initialTab?: string }) => {
  const [tab, setTab] = useHubTab('publish_center', initialTab);
  const [incoming, setIncoming] = useState(() => readPool().length);
  useEffect(() => {
    const sync = () => setIncoming(readPool().length);
    window.addEventListener(POOL_EVENT, sync);
    return () => window.removeEventListener(POOL_EVENT, sync);
  }, []);

  return (
    <HubShell lang={lang} pageId="publish_center" active={tab} onChange={setTab} badges={{ pool: SAMPLE_POOL_COUNT + incoming, calendar: 12 }}>
      {tab === 'pool' && <PublishPool lang={lang} />}
      {tab === 'calendar' && <ContentCalendar lang={lang} />}
      {tab === 'planning' && <ContentPlanningBoard lang={lang} />}
      {tab === 'distribution' && <DistributionPage lang={lang} activeArtist={activeArtist} />}
    </HubShell>
  );
};
