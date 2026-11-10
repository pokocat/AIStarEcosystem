/**
 * 变现中心 — 变现项目、品牌商务、收益概览、分成结算与佣金配置
 */

import React from 'react';
import { motion } from 'motion/react';
import type { Lang } from '../../translations';
import { FinancePage } from './FinancePage';
import { BrandAgencyCenter } from './BrandAgencyCenter';
import { RevenueSplitTool } from './RevenueSplitTool';
import { MCNCommissionTool } from './MCNCommissionTool';
import type { Artist } from './ArtistTypes';
import { HubShell, useHubTab } from './HubShell';

export const MonetizationCenter = ({ lang, activeArtist, initialTab }: { lang: Lang; activeArtist: Artist; initialTab?: string }) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useHubTab('monetization_center', initialTab);

  return (
    <HubShell lang={lang} pageId="monetization_center" active={activeTab} onChange={setActiveTab}>
      <div>
        {activeTab === 'projects' && (
          <div className="p-1 md:p-2">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-2">{zh ? '活跃变现项目' : 'Active Projects'}</h2>
                <p className="text-sm text-gray-500">{zh ? '管理广告投放和产品推广' : 'Manage ads and product promotions'}</p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: '品牌A广告投放', type: '广告', status: '进行中', revenue: '¥12,500' },
                  { name: '产品B推广', type: '产品', status: '进行中', revenue: '¥8,300' },
                  { name: '品牌C联名', type: '联名', status: '待确认', revenue: '¥25,000' },
                ].map((project, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-xl border border-white/10 bg-gray-900/50 hover:border-white/20 transition"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-white">{project.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        project.status === '进行中' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{project.type}</span>
                      <span className="text-cyan-400 font-bold">{project.revenue}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'brand' && <BrandAgencyCenter lang={lang} />}
        {activeTab === 'revenue' && <FinancePage lang={lang} activeArtist={activeArtist} />}
        {activeTab === 'split' && <RevenueSplitTool lang={lang} />}
        {activeTab === 'commission' && <MCNCommissionTool lang={lang} />}
      </div>
    </HubShell>
  );
};
