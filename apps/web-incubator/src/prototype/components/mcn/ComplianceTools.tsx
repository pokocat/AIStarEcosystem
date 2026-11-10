/**
 * 授权与审核 — 授权台账、内容审核、合同、版权登记、水印与侵权巡查
 */
import React from 'react';
import type { Lang } from '../../translations';
import type { Artist } from './ArtistTypes';
import { LicenseVault } from './LicenseVault';
import { ContentReviewWorkbench } from './ContentReviewWorkbench';
import { ContractHub } from './ContractHub';
import { CopyrightPage } from './CopyrightPage';
import { WatermarkCenter } from './WatermarkCenter';
import { InfringementPatrol } from './InfringementPatrol';
import { HubShell, useHubTab } from './HubShell';

export const ComplianceTools = ({ lang, activeArtist, initialTab }: { lang: Lang; activeArtist: Artist; initialTab?: string }) => {
  const [tab, setTab] = useHubTab('compliance_tools', initialTab);
  return (
    <HubShell lang={lang} pageId="compliance_tools" active={tab} onChange={setTab}>
      {tab === 'license' && <LicenseVault lang={lang} />}
      {tab === 'review' && <ContentReviewWorkbench lang={lang} />}
      {tab === 'contract' && <ContractHub lang={lang} />}
      {tab === 'copyright' && <CopyrightPage lang={lang} activeArtist={activeArtist} />}
      {tab === 'watermark' && <WatermarkCenter lang={lang} />}
      {tab === 'patrol' && <InfringementPatrol lang={lang} />}
    </HubShell>
  );
};
