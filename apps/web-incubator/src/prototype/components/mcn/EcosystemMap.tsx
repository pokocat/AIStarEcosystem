/**
 * EcosystemMap — MCN生态关系图谱
 * P5 新增：MCN-艺人-品牌-平台四层关系可视化
 * 节点交互 · 合作强度热力 · 收益流向 · 风险连线高亮
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Star, ShoppingBag, Globe, Users, Zap,
  ChevronRight, ArrowRight, TrendingUp, Shield, AlertTriangle,
  CheckCircle2, Coins, Eye, Link2, BarChart3
} from 'lucide-react';
import type { Lang } from '../../translations';

// ─── Types ───────────────────────────────────────────────────────
type NodeType = 'mcn' | 'artist' | 'brand' | 'platform';
type EdgeStrength = 'strong' | 'normal' | 'weak' | 'risk';

interface EcoNode {
  id: string; type: NodeType; name: string; nameEn: string;
  value: string; valueLabel: { zh: string; en: string };
  color: string; bg: string; border: string;
  icon: React.ComponentType<any>;
  metrics: { label: { zh: string; en: string }; value: string; color: string }[];
}

interface EcoEdge {
  id: string; from: string; to: string;
  label: { zh: string; en: string };
  strength: EdgeStrength; value: string;
  description: { zh: string; en: string };
}

// ─── Mock Data ────────────────────────────────────────────────────
const NODES: EcoNode[] = [
  {
    id: 'mcn1', type: 'mcn', name: 'AI Star MCN', nameEn: 'AI Star MCN',
    value: '月营收 ¥186万', valueLabel: { zh: '月营收', en: 'Monthly Rev.' },
    color: '#06b6d4', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)',
    icon: Building2,
    metrics: [
      { label: { zh: '在管艺人', en: 'Artists' }, value: '3', color: '#06b6d4' },
      { label: { zh: '平台账号', en: 'Accounts' }, value: '12', color: '#06b6d4' },
      { label: { zh: '品牌合作', en: 'Brands' }, value: '8', color: '#06b6d4' },
    ],
  },
  {
    id: 'artist1', type: 'artist', name: '陆承远', nameEn: 'Lu Chengyuan',
    value: 'IP估值 ¥8400万', valueLabel: { zh: 'IP估值', en: 'IP Value' },
    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)',
    icon: Star,
    metrics: [
      { label: { zh: '粉丝总量', en: 'Fans' }, value: '4530万', color: '#f59e0b' },
      { label: { zh: '月GMV', en: 'Monthly GMV' }, value: '¥280万', color: '#22c55e' },
      { label: { zh: '合规评分', en: 'Compliance' }, value: '98', color: '#10b981' },
    ],
  },
  {
    id: 'artist2', type: 'artist', name: '沈亦舟', nameEn: 'Shen Yizhou',
    value: 'IP估值 ¥1280万', valueLabel: { zh: 'IP估值', en: 'IP Value' },
    color: '#a855f7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.3)',
    icon: Star,
    metrics: [
      { label: { zh: '粉丝总量', en: 'Fans' }, value: '1280万', color: '#a855f7' },
      { label: { zh: '月GMV', en: 'Monthly GMV' }, value: '¥62万', color: '#22c55e' },
      { label: { zh: '成长评分', en: 'Growth' }, value: '96', color: '#ec4899' },
    ],
  },
  {
    id: 'artist3', type: 'artist', name: '林音宝', nameEn: 'Lin Yin Bao',
    value: 'IP估值 ¥940万', valueLabel: { zh: 'IP估值', en: 'IP Value' },
    color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)',
    icon: Star,
    metrics: [
      { label: { zh: '粉丝总量', en: 'Fans' }, value: '920万', color: '#10b981' },
      { label: { zh: '月GMV', en: 'Monthly GMV' }, value: '¥38万', color: '#22c55e' },
      { label: { zh: '合规评分', en: 'Compliance' }, value: '72', color: '#f59e0b' },
    ],
  },
  {
    id: 'brand1', type: 'brand', name: '跃锋运动', nameEn: 'Yuefeng Sports',
    value: '合同金额 ¥580万', valueLabel: { zh: '合同金额', en: 'Contract' },
    color: '#ec4899', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.3)',
    icon: ShoppingBag,
    metrics: [
      { label: { zh: '授权期限', en: 'Auth Period' }, value: '24mo', color: '#ec4899' },
      { label: { zh: '合作状态', en: 'Status' }, value: '执行中', color: '#22c55e' },
      { label: { zh: 'ROI', en: 'ROI' }, value: '4.2×', color: '#f59e0b' },
    ],
  },
  {
    id: 'brand2', type: 'brand', name: 'CyberGlow护肤', nameEn: 'CyberGlow',
    value: '合同金额 ¥120万', valueLabel: { zh: '合同金额', en: 'Contract' },
    color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)',
    icon: ShoppingBag,
    metrics: [
      { label: { zh: '授权期限', en: 'Auth Period' }, value: '12mo', color: '#f97316' },
      { label: { zh: '合作状态', en: 'Status' }, value: '待签署', color: '#f59e0b' },
      { label: { zh: 'ROI', en: 'ROI' }, value: '3.5×', color: '#f59e0b' },
    ],
  },
  {
    id: 'platform1', type: 'platform', name: '抖音 DY', nameEn: 'Douyin',
    value: '月GMV ¥310万', valueLabel: { zh: '月GMV', en: 'Monthly GMV' },
    color: '#ff2d55', bg: 'rgba(255,45,85,0.12)', border: 'rgba(255,45,85,0.3)',
    icon: Globe,
    metrics: [
      { label: { zh: '活跃账号', en: 'Active Accts' }, value: '6', color: '#ff2d55' },
      { label: { zh: '平台费率', en: 'Platform Fee' }, value: '1.5%', color: '#6b7280' },
      { label: { zh: '总粉丝', en: 'Total Fans' }, value: '5840万', color: '#ff2d55' },
    ],
  },
  {
    id: 'platform2', type: 'platform', name: '快手 KS', nameEn: 'Kuaishou',
    value: '月GMV ¥62万', valueLabel: { zh: '月GMV', en: 'Monthly GMV' },
    color: '#ff6600', bg: 'rgba(255,102,0,0.12)', border: 'rgba(255,102,0,0.3)',
    icon: Globe,
    metrics: [
      { label: { zh: '活跃账号', en: 'Active Accts' }, value: '3', color: '#ff6600' },
      { label: { zh: '平台费率', en: 'Platform Fee' }, value: '1.5%', color: '#6b7280' },
      { label: { zh: '总粉丝', en: 'Total Fans' }, value: '1200万', color: '#ff6600' },
    ],
  },
];

const EDGES: EcoEdge[] = [
  { id: 'e1', from: 'mcn1', to: 'artist1', label: { zh: 'MCN签约', en: 'MCN Contract' }, strength: 'strong', value: '独家16个月', description: { zh: '独家MCN协议，佣金25%+授权管理', en: 'Exclusive MCN deal, 25% commission + IP mgmt' } },
  { id: 'e2', from: 'mcn1', to: 'artist2', label: { zh: 'MCN签约', en: 'MCN Contract' }, strength: 'strong', value: '独家12个月', description: { zh: '独家MCN协议，佣金22%+IP孵化', en: 'Exclusive MCN deal, 22% commission + IP incubation' } },
  { id: 'e3', from: 'mcn1', to: 'artist3', label: { zh: 'MCN签约', en: 'MCN Contract' }, strength: 'normal', value: '非独家', description: { zh: '非独家协议，佣金20%', en: 'Non-exclusive deal, 20% commission' } },
  { id: 'e4', from: 'artist1', to: 'brand1', label: { zh: '品牌代言', en: 'Brand Endorsement' }, strength: 'strong', value: '¥580万/24mo', description: { zh: '跃锋秋冬系列全渠道代言，已签署', en: 'Yuefeng autumn/winter all-channel endorsement, signed' } },
  { id: 'e5', from: 'artist1', to: 'brand2', label: { zh: '联名合作', en: 'Co-branding' }, strength: 'weak', value: '¥120万/12mo', description: { zh: 'CyberGlow联名护肤品，待明星确认', en: 'CyberGlow co-branded skincare, awaiting artist confirmation' } },
  { id: 'e6', from: 'artist2', to: 'brand2', label: { zh: '品牌合作', en: 'Brand Deal' }, strength: 'normal', value: '¥45万/6mo', description: { zh: 'AI声音授权用于品牌广告音频', en: 'AI voice license for brand ad audio' } },
  { id: 'e7', from: 'artist1', to: 'platform1', label: { zh: '直播带货', en: 'Live Commerce' }, strength: 'strong', value: '月GMV ¥240万', description: { zh: '抖音主力平台，月均直播8场', en: 'Main DY platform, 8 lives/month avg' } },
  { id: 'e8', from: 'artist1', to: 'platform2', label: { zh: '短视频', en: 'Short Video' }, strength: 'normal', value: '月GMV ¥40万', description: { zh: '快手切片矩阵，25个账号', en: 'KS clip matrix, 25 accounts' } },
  { id: 'e9', from: 'artist2', to: 'platform1', label: { zh: '短视频', en: 'Short Video' }, strength: 'normal', value: '月GMV ¥55万', description: { zh: '抖音音乐内容为主', en: 'Mainly music content on DY' } },
  { id: 'e10', from: 'artist3', to: 'platform1', label: { zh: '直播', en: 'Live' }, strength: 'weak', value: '月GMV ¥15万', description: { zh: 'AI数字人直播，仍在测试阶段', en: 'AI digital human live, still in test phase' } },
  { id: 'e11', from: 'brand1', to: 'platform1', label: { zh: '品牌投流', en: 'Brand Boost' }, strength: 'strong', value: '月投流 ¥15万', description: { zh: '跃锋品牌在抖音定向投流陆承远内容', en: 'Yuefeng targeted boost of Lu Chengyuan content on DY' } },
  { id: 'risk1', from: 'artist3', to: 'brand2', label: { zh: '授权风险', en: 'Auth Risk' }, strength: 'risk', value: '待补全', description: { zh: 'AI声音授权未完成，品牌合作存在合规风险', en: 'AI voice auth incomplete, brand deal has compliance risk' } },
];

const EDGE_COLOR: Record<EdgeStrength, string> = {
  strong: '#22c55e', normal: '#06b6d4', weak: '#6b7280', risk: '#ef4444',
};

const NODE_TYPE_CFG: Record<NodeType, { zh: string; en: string; groupColor: string }> = {
  mcn:      { zh: 'MCN机构', en: 'MCN',      groupColor: '#06b6d4' },
  artist:   { zh: '签约艺人', en: 'Artist',   groupColor: '#f59e0b' },
  brand:    { zh: '品牌方',  en: 'Brand',    groupColor: '#ec4899' },
  platform: { zh: '发布平台', en: 'Platform', groupColor: '#ff2d55' },
};

interface Props { lang: Lang; }

export const EcosystemMap = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<NodeType | 'all'>('all');

  const selectedNodeData = selectedNode ? NODES.find(n => n.id === selectedNode) : null;

  const relatedEdges = selectedNode
    ? EDGES.filter(e => e.from === selectedNode || e.to === selectedNode)
    : [];

  const filteredNodes = filterType === 'all' ? NODES : NODES.filter(n => n.type === filterType);

  const getNodeRelations = (nodeId: string) => {
    return EDGES.filter(e => e.from === nodeId || e.to === nodeId).map(e => {
      const otherId = e.from === nodeId ? e.to : e.from;
      const other = NODES.find(n => n.id === otherId)!;
      const isFrom = e.from === nodeId;
      return { edge: e, other, isFrom };
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {zh ? 'MCN生态关系图谱' : 'MCN Ecosystem Map'}
        </h1>
        <p className="text-xs text-gray-500 mt-1">{zh ? 'MCN · 艺人 · 品牌 · 平台 — 四层关系可视化 · 收益流向 · 风险连线' : 'MCN · Artist · Brand · Platform — 4-layer visualization · Revenue flow · Risk links'}</p>
      </div>

      {/* Filter + Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['all', 'mcn', 'artist', 'brand', 'platform'] as const).map(t => {
          const cfg = t === 'all' ? null : NODE_TYPE_CFG[t];
          return (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition ${filterType === t ? 'text-white border-white/25 bg-white/8' : 'border-white/8 text-gray-500 hover:border-white/20'}`}
              style={filterType === t && cfg ? { borderColor: `${cfg.groupColor}40`, background: `${cfg.groupColor}10`, color: cfg.groupColor } : {}}>
              {t === 'all' ? (zh ? '全部' : 'All') : (zh ? cfg!.zh : cfg!.en)}
            </button>
          );
        })}
        <div className="ml-auto flex gap-3 text-[9px] text-gray-600">
          {(['strong', 'normal', 'weak', 'risk'] as EdgeStrength[]).map(s => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-4 h-px inline-block" style={{ background: EDGE_COLOR[s] }} />
              {s === 'strong' ? (zh ? '强' : 'Strong') : s === 'normal' ? (zh ? '普通' : 'Normal') : s === 'weak' ? (zh ? '弱' : 'Weak') : (zh ? '风险' : 'Risk')}
            </span>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Node Cards Grid */}
        <div className="lg:col-span-2 space-y-4">
          {/* Layer: MCN */}
          <div>
            <div className="text-[9px] font-black text-cyan-400 uppercase tracking-widest mb-2 px-1">{zh ? 'MCN机构层' : 'MCN Layer'}</div>
            <div className="grid gap-2">
              {filteredNodes.filter(n => n.type === 'mcn').map(node => (
                <NodeCard key={node.id} node={node} selected={selectedNode === node.id}
                  onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                  relatedEdges={selectedNode === node.id ? relatedEdges : []} zh={zh} />
              ))}
            </div>
          </div>
          {/* Layer: Artists */}
          <div>
            <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-2 px-1">{zh ? '签约艺人层' : 'Artist Layer'}</div>
            <div className="grid md:grid-cols-3 gap-2">
              {filteredNodes.filter(n => n.type === 'artist').map(node => (
                <NodeCard key={node.id} node={node} selected={selectedNode === node.id}
                  onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                  relatedEdges={selectedNode === node.id ? relatedEdges : []} zh={zh} />
              ))}
            </div>
          </div>
          {/* Layer: Brands + Platforms */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-[9px] font-black text-pink-400 uppercase tracking-widest mb-2 px-1">{zh ? '品牌合作层' : 'Brand Layer'}</div>
              <div className="space-y-2">
                {filteredNodes.filter(n => n.type === 'brand').map(node => (
                  <NodeCard key={node.id} node={node} selected={selectedNode === node.id}
                    onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                    relatedEdges={selectedNode === node.id ? relatedEdges : []} zh={zh} />
                ))}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-2 px-1">{zh ? '发布平台层' : 'Platform Layer'}</div>
              <div className="space-y-2">
                {filteredNodes.filter(n => n.type === 'platform').map(node => (
                  <NodeCard key={node.id} node={node} selected={selectedNode === node.id}
                    onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                    relatedEdges={selectedNode === node.id ? relatedEdges : []} zh={zh} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedNodeData ? (
              <motion.div key={selectedNodeData.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="bg-gray-900/70 border border-white/8 rounded-2xl p-4 space-y-4">
                {/* Node detail header */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: selectedNodeData.bg, border: `1px solid ${selectedNodeData.border}` }}>
                    {React.createElement(selectedNodeData.icon, { className: 'w-5 h-5', style: { color: selectedNodeData.color } })}
                  </div>
                  <div>
                    <div className="text-sm font-black text-white">{selectedNodeData.name}</div>
                    <div className="text-[9px] font-bold mt-0.5" style={{ color: selectedNodeData.color }}>{selectedNodeData.value}</div>
                    <div className="text-[9px] text-gray-600">{zh ? NODE_TYPE_CFG[selectedNodeData.type].zh : NODE_TYPE_CFG[selectedNodeData.type].en}</div>
                  </div>
                </div>
                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  {selectedNodeData.metrics.map((m, i) => (
                    <div key={i} className="text-center p-2 bg-black/30 rounded-xl">
                      <div className="text-[8px] text-gray-600 mb-0.5">{zh ? m.label.zh : m.label.en}</div>
                      <div className="text-[11px] font-bold" style={{ color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                {/* Related edges */}
                <div>
                  <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-2">{zh ? '关联关系' : 'Relations'} ({getNodeRelations(selectedNodeData.id).length})</div>
                  <div className="space-y-1.5">
                    {getNodeRelations(selectedNodeData.id).map(({ edge, other, isFrom }, i) => {
                      const eColor = EDGE_COLOR[edge.strength];
                      const OtherIcon = other.icon;
                      return (
                        <div key={edge.id} className="flex items-center gap-2 p-2 bg-black/20 rounded-lg">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: eColor }} />
                          <OtherIcon className="w-3 h-3 shrink-0" style={{ color: other.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] font-semibold text-white truncate">{other.name}</div>
                            <div className="text-[8px] text-gray-600">{zh ? edge.label.zh : edge.label.en} · {edge.value}</div>
                          </div>
                          {edge.strength === 'risk' && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-gray-900/30 border border-white/5 rounded-2xl p-8 text-center">
                <Eye className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <div className="text-xs text-gray-600">{zh ? '点击节点查看详细关系' : 'Click a node to inspect relations'}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Edge List */}
          <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">{zh ? '全部连线' : 'All Edges'} ({EDGES.length})</div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {EDGES.map(e => {
                const from = NODES.find(n => n.id === e.from)!;
                const to   = NODES.find(n => n.id === e.to)!;
                const eColor = EDGE_COLOR[e.strength];
                return (
                  <div key={e.id} className="flex items-center gap-2 p-2 bg-black/20 rounded-lg text-[9px]">
                    <div className="w-1 h-4 rounded-full shrink-0" style={{ background: eColor }} />
                    <span style={{ color: from.color }} className="font-semibold truncate">{from.name}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-gray-600 shrink-0" />
                    <span style={{ color: to.color }} className="font-semibold truncate">{to.name}</span>
                    <span className="text-gray-600 truncate ml-auto">{e.value}</span>
                    {e.strength === 'risk' && <AlertTriangle className="w-2.5 h-2.5 text-red-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary stats */}
          <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">{zh ? '生态概览' : 'Ecosystem Stats'}</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: { zh: '节点总数', en: 'Total Nodes' }, value: NODES.length, color: '#06b6d4', icon: Link2 },
                { label: { zh: '连线总数', en: 'Total Edges' }, value: EDGES.length, color: '#a855f7', icon: BarChart3 },
                { label: { zh: '风险连线', en: 'Risk Edges' }, value: EDGES.filter(e => e.strength === 'risk').length, color: '#ef4444', icon: AlertTriangle },
                { label: { zh: '强合作数', en: 'Strong Links' }, value: EDGES.filter(e => e.strength === 'strong').length, color: '#22c55e', icon: CheckCircle2 },
              ].map((stat, i) => {
                const StatIcon = stat.icon;
                return (
                  <div key={i} className="flex items-center gap-2 p-2 bg-black/20 rounded-lg">
                    <StatIcon className="w-3.5 h-3.5 shrink-0" style={{ color: stat.color }} />
                    <div>
                      <div className="text-[8px] text-gray-600">{zh ? stat.label.zh : stat.label.en}</div>
                      <div className="text-sm font-black" style={{ color: stat.color }}>{stat.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── NodeCard Sub-component ───────────────────────────────────────
const NodeCard = ({ node, selected, onClick, relatedEdges, zh }: {
  node: EcoNode; selected: boolean; onClick: () => void;
  relatedEdges: EcoEdge[]; zh: boolean;
}) => {
  const NodeIcon = node.icon;
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.99 }}
      className={`w-full text-left p-3 rounded-xl border transition ${selected ? '' : 'hover:border-white/15'}`}
      style={selected ? { background: node.bg, borderColor: node.border } : { background: 'rgba(17,24,39,0.5)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: node.bg }}>
          <NodeIcon className="w-3.5 h-3.5" style={{ color: node.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-white truncate">{node.name}</div>
          <div className="text-[9px] font-semibold" style={{ color: node.color }}>{node.value}</div>
        </div>
        {relatedEdges.some(e => e.strength === 'risk') && (
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        )}
        <ChevronRight className={`w-3 h-3 text-gray-600 shrink-0 transition-transform ${selected ? 'rotate-90' : ''}`} />
      </div>
    </motion.button>
  );
};
