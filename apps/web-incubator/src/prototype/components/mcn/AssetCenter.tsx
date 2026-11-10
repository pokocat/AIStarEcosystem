/**
 * 素材中心 — 数字资产库、文案库与形象衣橱
 */
import React from 'react';
import type { Lang } from '../../translations';
import type { Artist } from './ArtistTypes';
import { AssetVault } from './AssetVault';
import { CopyVault } from './CopyVault';
import { WardrobePage } from './WardrobePage';
import { HubShell, useHubTab } from './HubShell';

export const AssetCenter = ({ lang, activeArtist, initialTab }: { lang: Lang; activeArtist: Artist; initialTab?: string }) => {
  const [tab, setTab] = useHubTab('asset_center', initialTab);
  return (
    <HubShell lang={lang} pageId="asset_center" active={tab} onChange={setTab}>
      {tab === 'assets' && <AssetVault lang={lang} />}
      {tab === 'copy' && <CopyVault lang={lang} />}
      {tab === 'wardrobe' && <WardrobePage lang={lang} activeArtist={activeArtist} />}
    </HubShell>
  );
};
