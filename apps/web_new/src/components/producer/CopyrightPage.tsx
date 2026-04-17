"use client";

import React, { useState } from 'react';
import {
  Shield, Link2, CheckCircle2, Clock, FileText, Hash,
  ExternalLink, Copy, Lock, Fingerprint, Gem, Layers,
  Plus, Search, Filter, ArrowUpRight
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { motion, AnimatePresence } from "motion/react";
import type { Lang } from "../../translations";
import { type Artist, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS } from './ArtistTypes';

interface CopyrightAsset {
  id: string;
  title: string;
  type: 'music' | 'video' | 'nft' | 'script';
  status: 'verified' | 'pending' | 'minting';
  chainId: string;
  registeredDate: string;
  expiryDate: string;
  royaltyRate: number;
  revenue: string;
}

interface NFTCollection {
  id: string;
  name: string;
  type: 'badge' | 'moment' | 'artwork';
  totalMinted: number;
  maxSupply: number;
  floorPrice: string;
  holders: number;
  preview: string;
}

const ASSETS: CopyrightAsset[] = [
  { id: 'cr1', title: 'Neon Tears', type: 'music', status: 'verified', chainId: '0x7a3b...e9f2', registeredDate: '2025-01-15', expiryDate: '2075-01-15', royaltyRate: 8.5, revenue: '¥42,000' },
  { id: 'cr2', title: 'Cyber City Vibe', type: 'music', status: 'verified', chainId: '0x4c1d...a8b3', registeredDate: '2025-02-20', expiryDate: '2075-02-20', royaltyRate: 8.5, revenue: '¥18,500' },
  { id: 'cr3', title: 'Digital Sunset MV', type: 'video', status: 'verified', chainId: '0x9e2f...c4d1', registeredDate: '2025-02-28', expiryDate: '2075-02-28', royaltyRate: 12.0, revenue: '¥65,000' },
  { id: 'cr4', title: 'Ghost Signal EP', type: 'music', status: 'pending', chainId: '-', registeredDate: '2025-04-10', expiryDate: '-', royaltyRate: 8.5, revenue: '-' },
  { id: 'cr5', title: 'Midnight Protocol Script', type: 'script', status: 'pending', chainId: '-', registeredDate: '2025-04-12', expiryDate: '-', royaltyRate: 5.0, revenue: '-' },
];

const NFT_COLLECTIONS: NFTCollection[] = [
  { id: 'n1', name: 'Neon V Genesis Badge', type: 'badge', totalMinted: 500, maxSupply: 1000, floorPrice: '0.05 ETH', holders: 487, preview: '🏅' },
  { id: 'n2', name: 'Summer 2025 Moment', type: 'moment', totalMinted: 200, maxSupply: 200, floorPrice: '0.12 ETH', holders: 195, preview: '🌅' },
  { id: 'n3', name: 'Cyber City Artwork #1', type: 'artwork', totalMinted: 50, maxSupply: 50, floorPrice: '0.8 ETH', holders: 48, preview: '🎨' },
  { id: 'n4', name: 'Fan Loyalty Badge S1', type: 'badge', totalMinted: 1200, maxSupply: 5000, floorPrice: '0.02 ETH', holders: 1180, preview: '💎' },
];

export const CopyrightPage = ({ lang, activeArtist }: { lang: Lang; activeArtist: Artist }) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'copyright' | 'nft'>('copyright');
  const [assetFilter, setAssetFilter] = useState<'all' | 'verified' | 'pending'>('all');

  const filteredAssets = assetFilter === 'all' ? ASSETS : ASSETS.filter(a => a.status === assetFilter);
  const verifiedCount = ASSETS.filter(a => a.status === 'verified').length;
  const totalRevenue = '¥125,500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '版权与链上资产' : 'Copyright & On-chain Assets'}</h1>
          <p className="text-gray-400 font-light mt-1">{zh ? '区块链确权 · NFT铸造 · 版权追踪' : 'Blockchain copyright · NFT minting · Rights tracking'}</p>
        </div>
        <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2">
          <Plus className="w-4 h-4" /> {zh ? '登记版权' : 'Register Copyright'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: zh ? '已确权作品' : 'Verified Works', value: `${verifiedCount}`, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: zh ? '版税总收入' : 'Royalty Revenue', value: totalRevenue, icon: Shield, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: zh ? 'NFT总铸造' : 'NFTs Minted', value: '1,950', icon: Gem, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: zh ? 'NFT持有人' : 'NFT Holders', value: '1,910', icon: Fingerprint, color: 'text-pink-400', bg: 'bg-pink-500/10' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>{s.value}</div>
            <div className="text-xs text-gray-500 font-light">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Tab switch */}
      <div className="flex border border-white/10 rounded-lg overflow-hidden w-fit">
        <button onClick={() => setTab('copyright')} className={`px-5 py-2 text-xs transition ${tab === 'copyright' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>
          <Shield className="w-3 h-3 inline mr-1" />{zh ? '版权资产' : 'Copyright'}
        </button>
        <button onClick={() => setTab('nft')} className={`px-5 py-2 text-xs transition ${tab === 'nft' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>
          <Gem className="w-3 h-3 inline mr-1" />{zh ? 'NFT收藏' : 'NFT Collection'}
        </button>
      </div>

      {tab === 'copyright' && (
        <>
          {/* Filter */}
          <div className="flex gap-2">
            {(['all', 'verified', 'pending'] as const).map(f => (
              <button key={f} onClick={() => setAssetFilter(f)}
                className={`px-3 py-1.5 text-xs rounded-full border transition ${assetFilter === f ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-white/5'}`}>
                {f === 'all' ? (zh ? '全部' : 'All') : f === 'verified' ? (zh ? '已确权' : 'Verified') : (zh ? '待审核' : 'Pending')}
              </button>
            ))}
          </div>

          {/* Asset list */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {[zh ? '作品' : 'Work', zh ? '类型' : 'Type', zh ? '状态' : 'Status', zh ? '链上ID' : 'Chain ID', zh ? '版税率' : 'Royalty', zh ? '收入' : 'Revenue'].map((h, i) => (
                    <th key={i} className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset, i) => (
                  <motion.tr key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .05 }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center">
                          {asset.type === 'music' ? <span>🎵</span> : asset.type === 'video' ? <span>🎬</span> : asset.type === 'nft' ? <span>💎</span> : <span>📝</span>}
                        </div>
                        <span className="text-sm font-semibold">{asset.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 capitalize">{asset.type}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] border-0 ${asset.status === 'verified' ? 'bg-green-500/10 text-green-400' : asset.status === 'minting' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {asset.status === 'verified' ? (zh ? '已确权' : 'Verified') : asset.status === 'minting' ? (zh ? '铸造中' : 'Minting') : (zh ? '待审核' : 'Pending')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {asset.chainId !== '-' ? (
                        <span className="text-xs text-cyan-400 font-mono flex items-center gap-1">{asset.chainId} <Copy className="w-3 h-3 text-gray-500 cursor-pointer hover:text-white" /></span>
                      ) : <span className="text-xs text-gray-600">-</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{asset.royaltyRate}%</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{asset.revenue}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'nft' && (
        <div className="grid md:grid-cols-2 gap-4">
          {NFT_COLLECTIONS.map((nft, i) => (
            <motion.div key={nft.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .08 }}
              className="bg-gray-900/50 border border-white/5 rounded-xl p-5 hover:border-purple-500/20 transition cursor-pointer group">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center text-3xl">{nft.preview}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold truncate">{nft.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className="text-[10px] bg-purple-500/10 text-purple-400 border-0 capitalize">{nft.type}</Badge>
                    <span className="text-[10px] text-gray-500">{nft.floorPrice}</span>
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">{zh ? '已铸造' : 'Minted'}</span>
                  <span className="text-purple-400 font-semibold">{nft.totalMinted}/{nft.maxSupply}</span>
                </div>
                <Progress value={(nft.totalMinted / nft.maxSupply) * 100} className="h-1.5" />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{nft.holders} {zh ? '持有人' : 'holders'}</span>
                <Button variant="ghost" size="sm" className="text-purple-400 hover:bg-purple-500/10 text-[10px] h-6 px-2">
                  {zh ? '查看详情' : 'Details'} <ArrowUpRight className="w-3 h-3 ml-0.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
