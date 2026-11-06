/**
 * WatermarkCenter — 水印管理中心
 * P0 新增页面：隐形水印策略配置 + 嵌入记录 + 解析溯源 + 抗剪辑检测
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Search, Upload, CheckCircle2, XCircle, AlertTriangle,
  Clock, Zap, Eye, Hash, Lock, RefreshCw, BarChart3, Plus,
  Video, FileText, ChevronRight, Settings, Download
} from 'lucide-react';
import type { Lang } from '../../translations';

interface WatermarkStrategy {
  id: string; name: string; targetType: string; platforms: string[];
  strength: 'standard' | 'strong' | 'ultra';
  antiCompress: boolean; antiClip: boolean; invisible: boolean;
  enabled: boolean;
}

interface EmbedRecord {
  id: string; contentTitle: string; partnerName: string; platform: string;
  account: string; embedTime: string; wmId: string; status: 'success' | 'failed';
  contentType: string;
}

interface DetectionResult {
  id: string; submittedUrl: string; platform: string;
  detectedWmId: string | null; confidence: number;
  sourceContent: string; sourcePartner: string;
  verdict: 'authorized' | 'unauthorized' | 'unknown';
  submittedAt: string;
}

const MOCK_STRATEGIES: WatermarkStrategy[] = [
  {
    id: 'ws1', name: '标准成片水印策略', targetType: '所有成片',
    platforms: ['DY', 'KS', 'XHS', 'VCH'], strength: 'standard',
    antiCompress: true, antiClip: false, invisible: true, enabled: true,
  },
  {
    id: 'ws2', name: '高价值内容强力水印', targetType: '明星数字人/高播放量切片',
    platforms: ['DY', 'KS'], strength: 'ultra',
    antiCompress: true, antiClip: true, invisible: true, enabled: true,
  },
  {
    id: 'ws3', name: '下载版明文水印', targetType: '导出供合作方审阅版本',
    platforms: [], strength: 'standard',
    antiCompress: false, antiClip: false, invisible: false, enabled: true,
  },
];

const MOCK_EMBED_RECORDS: EmbedRecord[] = [
  { id: 'e1', contentTitle: '宋一鸣618直播切片-极速数码手机开箱', partnerName: '宋一鸣', platform: 'DY', account: '@宋一鸣美妆好物', embedTime: '2025-06-21 17:50', wmId: 'WM-202506-0047', status: 'success', contentType: '切片' },
  { id: 'e2', contentTitle: '林音宝数字人口播-护肤精华评测版', partnerName: '林音宝', platform: 'XHS', account: '@林音宝护肤日记', embedTime: '2025-09-11 15:30', wmId: 'WM-202509-0012', status: 'success', contentType: '数字人' },
  { id: 'e3', contentTitle: '清洁卫士夏季清洁混剪', partnerName: '清洁卫士品牌方', platform: 'KS', account: '@生活妙招分享', embedTime: '2025-09-11 11:20', wmId: 'WM-202509-0011', status: 'success', contentType: '混剪' },
  { id: 'e4', contentTitle: '宋一鸣采访切片-年度规划精华', partnerName: '宋一鸣', platform: 'DY', account: '@宋一鸣工作室', embedTime: '2025-09-10 20:00', wmId: '-', status: 'failed', contentType: '切片' },
  { id: 'e5', contentTitle: '林音宝日常Vlog混剪', partnerName: '林音宝', platform: 'VCH', account: '@林音宝生活', embedTime: '2025-09-10 18:45', wmId: 'WM-202509-0010', status: 'success', contentType: '混剪' },
];

const MOCK_DETECTIONS: DetectionResult[] = [
  {
    id: 'd1', submittedUrl: 'douyin.com/video/xxxxx1', platform: 'DY',
    detectedWmId: 'WM-202506-0047', confidence: 97,
    sourceContent: '宋一鸣618直播切片-极速数码手机开箱', sourcePartner: '宋一鸣',
    verdict: 'authorized', submittedAt: '2025-07-15 09:00',
  },
  {
    id: 'd2', submittedUrl: 'kuaishou.com/video/xxxxx2', platform: 'KS',
    detectedWmId: 'WM-202506-0047', confidence: 89,
    sourceContent: '宋一鸣618直播切片-极速数码手机开箱', sourcePartner: '宋一鸣',
    verdict: 'unauthorized', submittedAt: '2025-08-03 14:22',
  },
  {
    id: 'd3', submittedUrl: 'xiaohongshu.com/video/xxxxx3', platform: 'XHS',
    detectedWmId: null, confidence: 0,
    sourceContent: '-', sourcePartner: '-',
    verdict: 'unknown', submittedAt: '2025-09-01 11:10',
  },
];

const STRENGTH_CFG = {
  standard: { zh: '标准强度', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  strong:   { zh: '强力', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ultra:    { zh: '极强', color: 'text-red-400', bg: 'bg-red-500/10' },
};

const VERDICT_CFG = {
  authorized:   { zh: '已授权', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: CheckCircle2 },
  unauthorized: { zh: '未授权侵权', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', icon: AlertTriangle },
  unknown:      { zh: '无法识别', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/25', icon: XCircle },
};

interface Props { lang: Lang; }

export const WatermarkCenter = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'strategy' | 'records' | 'detection'>('strategy');
  const [showDetectModal, setShowDetectModal] = useState(false);
  const [detectUrl, setDetectUrl] = useState('');

  const stats = [
    { label: zh ? '已嵌入成片' : 'Watermarked', value: MOCK_EMBED_RECORDS.filter(r => r.status === 'success').length, color: 'text-cyan-400' },
    { label: zh ? '本月嵌入' : 'This Month', value: 28, color: 'text-purple-400' },
    { label: zh ? '成功解析' : 'Parsed', value: MOCK_DETECTIONS.filter(d => d.detectedWmId).length, color: 'text-emerald-400' },
    { label: zh ? '疑似侵权' : 'Suspicious', value: MOCK_DETECTIONS.filter(d => d.verdict === 'unauthorized').length, color: 'text-red-400' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '水印管理中心' : 'Watermark Center'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '隐形水印策略 · 嵌入记录 · 解析溯源 · 侵权发现' : 'Invisible watermark · Embed records · Source tracing · Infringement detection'}</p>
        </div>
        <button onClick={() => setShowDetectModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition">
          <Search className="w-3.5 h-3.5" />
          {zh ? '上传检测视频' : 'Detect Infringement'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="text-[10px] text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-black ${s.color}`} style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5">
        {([['strategy', zh ? '水印策略' : 'Strategies'], ['records', zh ? '嵌入记录' : 'Embed Records'], ['detection', zh ? '侵权检测' : 'Detection']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${tab === t ? 'border-red-400 text-red-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Strategy tab */}
      {tab === 'strategy' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
              <Plus className="w-3 h-3" />{zh ? '新增策略' : 'Add Strategy'}
            </button>
          </div>
          {MOCK_STRATEGIES.map((ws, i) => {
            const strCfg = STRENGTH_CFG[ws.strength];
            return (
              <motion.div key={ws.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-white/12 transition">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-sm font-bold text-white mb-1">{ws.name}</div>
                    <div className="text-[10px] text-gray-500">{zh ? '适用：' : 'Target: '}{ws.targetType}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${strCfg.bg} ${strCfg.color}`}>{strCfg.zh}</span>
                    <div className={`w-8 h-4 rounded-full relative cursor-pointer transition ${ws.enabled ? 'bg-red-500/80' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${ws.enabled ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {ws.platforms.map(p => (
                    <span key={p} className="text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">{p}</span>
                  ))}
                  {ws.antiCompress && <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">{zh ? '抗压缩' : 'Anti-compress'}</span>}
                  {ws.antiClip && <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">{zh ? '抗剪辑' : 'Anti-clip'}</span>}
                  {ws.invisible && <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{zh ? '隐形' : 'Invisible'}</span>}
                  {!ws.invisible && <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">{zh ? '可见水印' : 'Visible'}</span>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Records tab */}
      {tab === 'records' && (
        <div className="space-y-2">
          {MOCK_EMBED_RECORDS.map((rec, i) => (
            <motion.div key={rec.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-3.5 bg-gray-900/50 border border-white/5 rounded-xl hover:border-white/10 transition">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${rec.status === 'success' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                {rec.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{rec.contentTitle}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{rec.partnerName} · {rec.platform} · {rec.account}</div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-[10px] font-mono font-bold ${rec.status === 'success' ? 'text-cyan-400' : 'text-gray-600'}`}>{rec.wmId}</div>
                <div className="text-[9px] text-gray-600 mt-0.5">{rec.embedTime}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detection tab */}
      {tab === 'detection' && (
        <div className="space-y-3">
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="text-xs font-semibold text-white mb-1">{zh ? '上传疑似侵权视频进行水印解析' : 'Upload suspicious video to parse watermark'}</div>
            <div className="text-[10px] text-gray-500 mb-3">{zh ? '支持直接上传视频文件或输入视频链接，系统自动解析隐形水印并比对来源' : 'Upload video file or paste URL. System auto-parses watermark and traces source.'}</div>
            <div className="flex gap-2">
              <input value={detectUrl} onChange={e => setDetectUrl(e.target.value)}
                placeholder={zh ? '粘贴视频链接...' : 'Paste video URL...'}
                className="flex-1 bg-black/30 border border-white/8 rounded-lg px-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500/40 transition" />
              <button onClick={() => setDetectUrl('')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition">
                <Search className="w-3.5 h-3.5" />{zh ? '开始检测' : 'Detect'}
              </button>
            </div>
          </div>

          {/* Detection results */}
          <div className="text-[10px] text-gray-600 uppercase tracking-wider">{zh ? '检测记录' : 'Detection History'}</div>
          {MOCK_DETECTIONS.map((det, i) => {
            const vCfg = VERDICT_CFG[det.verdict];
            const VIcon = vCfg.icon;
            return (
              <motion.div key={det.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`p-4 bg-gray-900/50 border rounded-xl ${det.verdict === 'unauthorized' ? 'border-red-500/25 bg-red-500/3' : 'border-white/5'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${vCfg.bg} ${vCfg.border} border`}>
                    <VIcon className={`w-4 h-4 ${vCfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${vCfg.bg} ${vCfg.color} ${vCfg.border}`}>{vCfg.zh}</span>
                      <span className="text-[10px] text-gray-500">{det.platform} · {det.submittedAt}</span>
                    </div>
                    <div className="text-xs font-mono text-cyan-400 mb-1">
                      {det.detectedWmId || (zh ? '未检测到水印ID' : 'No watermark ID found')}
                    </div>
                    {det.detectedWmId && (
                      <div className="text-[10px] text-gray-400">
                        {zh ? '来源：' : 'Source: '}{det.sourceContent} · {det.sourcePartner}
                        <span className="text-gray-600 ml-2">{zh ? `置信度 ${det.confidence}%` : `Confidence: ${det.confidence}%`}</span>
                      </div>
                    )}
                    <div className="text-[9px] text-gray-600 mt-1 truncate">{det.submittedUrl}</div>
                  </div>
                  {det.verdict === 'unauthorized' && (
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition shrink-0">
                      <AlertTriangle className="w-3 h-3" />{zh ? '创建侵权工单' : 'File Complaint'}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Detect modal */}
      <AnimatePresence>
        {showDetectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDetectModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <div className="text-sm font-bold mb-4">{zh ? '上传疑似侵权内容' : 'Upload Suspicious Content'}</div>
              <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center mb-4 hover:border-red-500/30 transition cursor-pointer">
                <Upload className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <div className="text-xs text-gray-500">{zh ? '拖拽视频文件或点击上传' : 'Drag video file or click to upload'}</div>
                <div className="text-[10px] text-gray-700 mt-1">{zh ? '支持 MP4 / MOV，最大 2GB' : 'MP4 / MOV, max 2GB'}</div>
              </div>
              <button onClick={() => setShowDetectModal(false)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition">
                <Search className="w-3.5 h-3.5" />{zh ? '开始水印解析' : 'Start Parsing'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
