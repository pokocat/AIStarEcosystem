/**
 * 角色 IP 中心 — 我的 IP、明星专区、IP 市场、IP 估值、成长档案与生态图谱。
 * “我的 IP” 顶部按四层角色 IP 体系汇总当前矩阵，空缺的层级可以直接发起孵化。
 */
import React, { useState } from 'react';
import { Coins, Plus } from 'lucide-react';
import type { Lang } from '../../translations';
import { MCNMatrix } from './MCNMatrix';
import { CelebritySigningCenter } from '../market/CelebritySigningCenter';
import { ArtistMarket } from '../market/ArtistMarket';
import { IPValuationEngine } from './IPValuationEngine';
import { ArtistGrowthTracker } from './ArtistGrowthTracker';
import { EcosystemMap } from './EcosystemMap';
import { MOCK_ARTISTS } from './ArtistTypes';
import { ROLE_GROUPS, ROLE_COUNT } from '../../data/roleIpSystem';
import { HubShell, useHubTab } from './HubShell';

interface Props {
  lang: Lang;
  initialTab?: string;
  onNavigateWorkshop?: () => void;
  onIncubate?: () => void;
  onGoToTraining?: () => void;
}

/** The current roster is all on-stage talent; the other layers start empty. */
const rosterCount = (groupIndex: number) => (groupIndex === 0 ? MOCK_ARTISTS.length : 0);

const RoleLayerStrip = ({ lang, onIncubate }: { lang: Lang; onIncubate?: () => void }) => {
  const zh = lang === 'zh';
  return (
    <section aria-label={zh ? '角色 IP 分层' : 'Role IP layers'} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {ROLE_GROUPS.map((g, i) => {
        const Icon = g.icon;
        const count = rosterCount(i);
        return (
          <div key={g.name.en} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-[#ffffff] p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${g.color}14`, color: g.color }}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-slate-900">{zh ? g.name.zh : g.name.en}</div>
              <div className="text-[11px] text-slate-500">
                {count > 0
                  ? (zh ? `${count} 个 IP · 共 ${g.roles.length} 种角色` : `${count} IPs · ${g.roles.length} roles`)
                  : (zh ? `尚未布局 · 可孵化 ${g.roles.length} 种` : `Empty · ${g.roles.length} roles available`)}
              </div>
            </div>
            {count === 0 && onIncubate && (
              <button type="button" onClick={onIncubate}
                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition hover:bg-slate-100" style={{ color: g.color }}>
                {zh ? '孵化' : 'Start'}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
};

export const ArtistHub = ({ lang, initialTab, onNavigateWorkshop, onIncubate, onGoToTraining }: Props) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useHubTab('artist_hub', initialTab);
  const [marketBalance, setMarketBalance] = useState(100000);
  const [showMarketWizard, setShowMarketWizard] = useState(false);

  const actions = (
    <>
      {tab === 'market' && (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
            <Coins className="h-4 w-4 text-amber-500" />
            <div className="text-right leading-tight">
              <div className="text-[10px] text-slate-500">{zh ? '余额' : 'Balance'}</div>
              <div className="text-sm font-bold text-amber-600">⬡ {marketBalance.toLocaleString()}</div>
            </div>
          </div>
          <button type="button" onClick={() => setShowMarketWizard(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
            <Plus className="h-3.5 w-3.5" />{zh ? '上架 IP' : 'List IP'}
          </button>
        </>
      )}
      {onIncubate && (
        <button type="button" onClick={onIncubate}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold shadow-sm transition hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#0891b2)', color: '#ffffff' }}>
          <Plus className="h-3.5 w-3.5" />{zh ? '孵化新角色 IP' : 'New Role IP'}
        </button>
      )}
    </>
  );

  return (
    <HubShell lang={lang} pageId="artist_hub" active={tab} onChange={setTab}
      badges={{ mine: MOCK_ARTISTS.length }}
      actions={actions}
      banner={tab === 'mine' ? (
        <div className="space-y-1.5">
          <RoleLayerStrip lang={lang} onIncubate={onIncubate} />
          <p className="px-1 text-[11px] text-slate-500">
            {zh ? `四层生态共 ${ROLE_COUNT} 种角色 IP，补齐幕后、经营和商业层，能让台前 IP 的内容与变现形成闭环。`
              : `${ROLE_COUNT} role IPs across four layers — filling the creative, operating and business layers closes the loop for on-stage IPs.`}
          </p>
        </div>
      ) : undefined}>
      {tab === 'mine' && <MCNMatrix lang={lang} onNavigateWorkshop={onNavigateWorkshop} />}
      {tab === 'celebrity' && <CelebritySigningCenter lang={lang} onGoToTraining={onGoToTraining} />}
      {tab === 'market' && (
        <ArtistMarket lang={lang} balance={marketBalance} setBalance={setMarketBalance}
          showWizard={showMarketWizard} setShowWizard={setShowMarketWizard} />
      )}
      {tab === 'valuation' && <IPValuationEngine lang={lang} />}
      {tab === 'growth' && <ArtistGrowthTracker lang={lang} />}
      {tab === 'ecosystem' && <EcosystemMap lang={lang} />}
    </HubShell>
  );
};
