"use client";

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Sparkles, Shuffle, Wand2, X,
  Mic2, Video, Star, Headphones, Zap, CheckCircle2, Loader2
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { motion, AnimatePresence } from "motion/react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { Lang } from "../../translations";
import { TRANSLATIONS } from "../../translations";
import {
  type ArtistType, type TalentProfile,
  ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS, QUALITY_CONFIG, TALENT_LABELS
} from './ArtistTypes';
import { ArtistsApi, ConfigApi, ApiError } from "@/api";

interface WizardState {
  name: string;
  type: ArtistType;
  bio: string;
  faceStyle: string;
  fashionStyle: string;
  age: number;
  height: number;
  sweetness: number;
  energy: number;
  mystery: number;
  confidence: number;
  extraPersona: number;
  talents: TalentProfile;
}

const INITIAL_STATE: WizardState = {
  name: '', type: 'singer', bio: '',
  faceStyle: 'sweet', fashionStyle: 'modern', age: 20, height: 168,
  sweetness: 50, energy: 60, mystery: 40, confidence: 70, extraPersona: 50,
  talents: { ...ARTIST_TYPE_CONFIG.singer.initialTalents },
};

// 默认值仅作为后端未 seed / 离线时的 fallback。真值源在 platform_configs：
//   - incubation.templates  (key: ArtistType 枚举 + 文案)
//   - incubation.faceStyles / fashionStyles (LabeledOption i18n)
// 管理端改这些 key 即可热更前端选项。
type WizardTemplate = { id: string; type: ArtistType; zh: string; en: string; color: string };
type LabeledI18n = { id: string; zh: string; en: string };

const FALLBACK_TEMPLATES: WizardTemplate[] = [
  { id: 'cute', type: 'idol', zh: '甜美偶像', en: 'Cute Idol', color: 'border-pink-500/30 hover:border-pink-400/60' },
  { id: 'cool', type: 'singer', zh: '酷炫歌手', en: 'Cool Singer', color: 'border-cyan-500/30 hover:border-cyan-400/60' },
  { id: 'elegant', type: 'actor', zh: '优雅演员', en: 'Elegant Actor', color: 'border-purple-500/30 hover:border-purple-400/60' },
  { id: 'energetic', type: 'entertainer', zh: '活力综艺', en: 'Energetic Host', color: 'border-amber-500/30 hover:border-amber-400/60' },
  { id: 'mysterious', type: 'dancer', zh: '神秘舞者', en: 'Mysterious Dancer', color: 'border-green-500/30 hover:border-green-400/60' },
  { id: 'custom', type: 'singer', zh: '自定义', en: 'Custom', color: 'border-white/10 hover:border-white/30' },
];

const FALLBACK_FACE_STYLES: LabeledI18n[] = [
  { id: 'sweet', zh: '甜美', en: 'Sweet' },
  { id: 'cool', zh: '酷帅', en: 'Cool' },
  { id: 'elegant', zh: '优雅', en: 'Elegant' },
  { id: 'cute', zh: '可爱', en: 'Cute' },
  { id: 'sharp', zh: '凌厉', en: 'Sharp' },
  { id: 'soft', zh: '温柔', en: 'Soft' },
];

const FALLBACK_FASHION_STYLES: LabeledI18n[] = [
  { id: 'modern', zh: '现代潮流', en: 'Modern' },
  { id: 'retro', zh: '复古', en: 'Retro' },
  { id: 'cyberpunk', zh: '赛博朋克', en: 'Cyberpunk' },
  { id: 'casual', zh: '休闲', en: 'Casual' },
  { id: 'formal', zh: '正式', en: 'Formal' },
  { id: 'sporty', zh: '运动', en: 'Sporty' },
];

/* Slider component */
const ParamSlider = ({ label, value, onChange, color = 'cyan' }: { label: string; value: number; onChange: (v: number) => void; color?: string }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold text-${color}-400`}>{value}</span>
    </div>
    <input type="range" min={0} max={100} value={value} onChange={e => onChange(+e.target.value)}
      className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-cyan-500
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:shadow" />
  </div>
);

export const IncubationWizard = ({ lang, onClose, onCreated }: { lang: Lang; onClose: () => void; onCreated: () => void }) => {
  const zh = lang === 'zh';
  const t = TRANSLATIONS[lang].producer.incubator;
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const steps = [
    { label: t.step_basic, icon: '01' },
    { label: t.step_appearance, icon: '02' },
    { label: t.step_persona, icon: '03' },
    { label: t.step_talents, icon: '04' },
    { label: t.step_preview, icon: '05' },
  ];

  const typeConf = ARTIST_TYPE_CONFIG[state.type];

  const updateType = (type: ArtistType) => {
    setState(s => ({ ...s, type, talents: { ...ARTIST_TYPE_CONFIG[type].initialTalents } }));
  };

  // 预制 AI 艺人样本库：每种艺人类型配 3 个中文艺名 + 贴合人设的简介
  const RANDOM_PRESETS: Record<ArtistType, { name: string; bio: string }[]> = {
    singer: [
      { name: '星澪 Xingli', bio: '出身于数据星海的电子声线歌手，擅长氛围电子、未来 R&B；代表作《霓虹心跳》《星海回声》。嗓音兼具少年感和金属质感。' },
      { name: '夜语 Yeyu', bio: '深夜系创作女伶，融合爵士和合成流行。擅长在慢歌中制造情绪钩子，被乐评称为“耳机里的告白”。' },
      { name: '苏陌 Su Mo', bio: '来自虚拟成都的独立唱作人，偏爱复古蒸汽波；自弹自唱＋AI 编曲，擅长温柔治愈向都市民谣。' },
    ],
    actor: [
      { name: '江予安 Jiang Yu\'an', bio: '虚拟影视新生代，气质沉静、镜头感极强。偏爱悬疑文艺片，被算法标记为“下一位被摄影机宠爱的数字演员”。' },
      { name: '白见瑟 Bai Jianse', bio: '古装造型担当，五官立体、身段从容；擅长演绎权谋戏与悲情女主，定妆照登上多次站内热搜。' },
      { name: '陆决 Lu Jue', bio: '数字硬汉系男主，体态挺拔、眼神克制。擅长刑侦、军旅、科幻动作题材，动作捕捉表现稳定。' },
    ],
    entertainer: [
      { name: '叮当 Dingdang', bio: '综艺气氛担当，反应飞快、金句密集。擅长即兴游戏和户外真人秀，主持节奏稳中带皮。' },
      { name: '米可 Miko', bio: '萌系综艺 AI，天然呆＋高情商，擅长团综和观察类节目。弹幕盛赞“被她逗笑的概率是 92%”。' },
      { name: '阿栗 A Li', bio: '脱口秀风格综艺咖，冷幽默、善吐槽、能带节目。擅长即兴辩论和段子类 Vlog。' },
    ],
    dancer: [
      { name: '霓九 Ni Jiu', bio: 'K-Pop 风格编舞天才，四肢线条利落，擅长 Urban / Jazz Funk / Girls Hip-Hop；舞台爆发力满分。' },
      { name: '流云 Liuyun', bio: '中国风古典舞者，水袖、扇舞、长剑均游刃有余；擅长在写意场景中塑造意境感。' },
      { name: '疾光 Jiguang', bio: '街舞 Breaking 新锐，Power Move 流畅；曾于虚拟舞者大赛拿下全国亚军。' },
    ],
    host: [
      { name: '林慢 Lin Man', bio: '文艺访谈主持人，温柔不冷场、擅长深度对话；声线稳、共情强，是深夜节目的黄金搭子。' },
      { name: '郑野 Zheng Ye', bio: '新闻资讯主持人，播报节奏干净利落；擅长解读财经与科技事件，逻辑感强。' },
      { name: '可乐 Kele', bio: '直播带货 AI 主持，口条快、互动爆棚；能同时串场、讲解、控场，是品牌直播的稳定产出者。' },
    ],
    all_rounder: [
      { name: '苏九歌 Su Jiuge', bio: '唱跳演三栖全能 AI，音色辨识度高，舞台控场稳定；粉丝称“数字化时代的流量模板”。' },
      { name: '陈诺宁 Chen Nuoning', bio: '多栖偶像型，唱歌＋影视＋综艺三线开花；团体出身，单飞后代言数量稳步增长。' },
      { name: '言夕 Yan Xi', bio: '风格多变的全能 AI，能驾驭古风、电子、日系 City-Pop；擅长舞台剧和短剧跨界。' },
    ],
    idol: [
      { name: '小月芽 Xiaoyueya', bio: '甜系养成偶像，招牌微笑＋元气舞台。粉丝社群活跃度极高，月饼头＋JK 造型是标志性形象。' },
      { name: '陆昭昭 Lu Zhaozhao', bio: '日系学生偶像路线，声线偏软、表情管理满分；擅长应援向单曲与粉丝互动直播。' },
      { name: '云希 Yunxi', bio: '韩系酷飒女团风，舞台张力强、Vocal 稳；擅长 Girl Crush 概念曲和团综互动。' },
    ],
  };

  const randomize = () => {
    const types: ArtistType[] = ['singer', 'actor', 'entertainer', 'dancer', 'host', 'all_rounder', 'idol'];
    const rType = types[Math.floor(Math.random() * types.length)];
    const pool = RANDOM_PRESETS[rType];
    const preset = pool[Math.floor(Math.random() * pool.length)];
    setState({
      ...state,
      name: preset.name,
      type: rType,
      bio: preset.bio,
      sweetness: Math.floor(Math.random() * 100),
      energy: Math.floor(Math.random() * 100),
      mystery: Math.floor(Math.random() * 100),
      confidence: Math.floor(Math.random() * 100),
      extraPersona: Math.floor(Math.random() * 100),
      talents: { ...ARTIST_TYPE_CONFIG[rType].initialTalents },
      age: 16 + Math.floor(Math.random() * 14),
      height: 155 + Math.floor(Math.random() * 30),
    });
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  // 从 platform_configs 拉 incubation.* 配置；未 seed 或离线则用 FALLBACK_*
  const [FACE_STYLES, setFaceStyles] = useState<LabeledI18n[]>(FALLBACK_FACE_STYLES);
  const [FASHION_STYLES, setFashionStyles] = useState<LabeledI18n[]>(FALLBACK_FASHION_STYLES);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [TEMPLATES, setTemplates] = useState<WizardTemplate[]>(FALLBACK_TEMPLATES);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      ConfigApi.getConfig<LabeledI18n[]>("incubation.faceStyles", FALLBACK_FACE_STYLES),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.fashionStyles", FALLBACK_FASHION_STYLES),
      ConfigApi.getConfig<WizardTemplate[]>("incubation.templates", FALLBACK_TEMPLATES),
    ]).then(([face, fashion, templates]) => {
      if (cancelled) return;
      if (face && face.length > 0) setFaceStyles(face);
      if (fashion && fashion.length > 0) setFashionStyles(fashion);
      if (templates && templates.length > 0) setTemplates(templates);
    });
    return () => { cancelled = true; };
  }, []);

  const trimmedName = state.name.trim();
  const trimmedBio = state.bio.trim();
  const basicValid = trimmedName.length > 0 && trimmedBio.length > 0;
  const nameError = showValidation && trimmedName.length === 0;
  const bioError = showValidation && trimmedBio.length === 0;

  const goNext = () => {
    if (step === 0 && !basicValid) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setStep(s => s + 1);
  };

  const handleCreate = async () => {
    if (!basicValid) {
      setShowValidation(true);
      setStep(0);
      return;
    }
    setCreating(true);
    setErrorMsg(null);
    try {
      await ArtistsApi.createArtist({
        name: trimmedName,
        type: state.type,
        quality: "common",
        status: "trainee",
        level: 1,
        exp: 0,
        maxExp: 100,
        avatar: "",
        talents: state.talents,
        stats: {
          songs: 0, dramas: 0, ads: 0, variety: 0,
          fans: 0, revenue: 0, monthlyRevenue: 0, popularity: 0,
        },
        bio: trimmedBio,
        domains: [],
        endorsements: 0,
        commercialValue: 0,
        incubationParams: {
          faceStyle: state.faceStyle,
          fashionStyle: state.fashionStyle,
          age: state.age,
          height: state.height,
          sweetness: state.sweetness,
          energy: state.energy,
          mystery: state.mystery,
          confidence: state.confidence,
          extraPersona: state.extraPersona,
        },
      });
      setCreated(true);
    } catch (err) {
      const msg = err instanceof ApiError
        ? `创建失败：${err.message}（${err.code}）`
        : `创建失败：${err instanceof Error ? err.message : String(err)}`;
      setErrorMsg(msg);
    } finally {
      setCreating(false);
    }
  };

  const talentKeys = Object.keys(TALENT_LABELS) as (keyof TalentProfile)[];
  const radarData = talentKeys.map(k => ({
    subject: zh ? TALENT_LABELS[k].zh : TALENT_LABELS[k].en,
    value: state.talents[k],
    cap: typeConf.talentCaps[k],
  }));

  if (created) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-gray-900 border border-white/10 rounded-2xl p-12 text-center max-w-md">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: .2 }}>
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
          </motion.div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>{t.success}</h2>
          <p className="text-gray-400 text-sm mb-2">{state.name} — {typeConf.icon} {zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en}</p>
          <p className="text-gray-500 text-xs mb-6">{zh ? '你可以在MCN矩阵中查看和管理这个艺人' : 'You can view and manage this artist in the MCN Matrix'}</p>
          <Button onClick={onCreated} className="bg-gradient-to-r from-cyan-500 to-purple-600">{zh ? '返回矩阵' : 'Back to Matrix'}</Button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{t.title}</h1>
          <p className="text-gray-400 font-light mt-1">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={randomize} className="border-white/10 text-gray-400 hover:text-white gap-1">
            <Shuffle className="w-3.5 h-3.5" /> {t.random_generate}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <button onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition ${step === i ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : step > i ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'text-gray-500 border border-white/5'}`}>
              <span className="font-bold">{s.icon}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < steps.length - 1 && <div className={`hidden sm:block flex-1 h-px ${step > i ? 'bg-green-500/30' : 'bg-white/5'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: .2 }}>
          {/* STEP 0: Basic */}
          {step === 0 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">
                      {t.name} <span className="text-red-400">*</span>
                    </label>
                    <input value={state.name} onChange={e => setState(s => ({ ...s, name: e.target.value }))}
                      className={`w-full bg-black/30 border rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition ${nameError ? 'border-red-500/60 focus:border-red-500/80' : 'border-white/10 focus:border-cyan-500/40'}`}
                      placeholder={t.name_placeholder} />
                    {nameError && (
                      <p className="mt-1 text-xs text-red-400">{zh ? '请填写艺人名称' : 'Artist name is required'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">
                      {t.bio} <span className="text-red-400">*</span>
                    </label>
                    <textarea value={state.bio} onChange={e => setState(s => ({ ...s, bio: e.target.value }))}
                      className={`w-full bg-black/30 border rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none transition h-24 resize-none ${bioError ? 'border-red-500/60 focus:border-red-500/80' : 'border-white/10 focus:border-cyan-500/40'}`}
                      placeholder={t.bio_placeholder} />
                    {bioError && (
                      <p className="mt-1 text-xs text-red-400">{zh ? '请填写艺人简介' : 'Bio is required'}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 gap-1 text-xs">
                    <Wand2 className="w-3 h-3" /> {t.ai_suggest}
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">{t.type}</div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ARTIST_TYPE_LABELS) as ArtistType[]).map(type => {
                    const conf = ARTIST_TYPE_CONFIG[type];
                    const selected = state.type === type;
                    return (
                      <button key={type} onClick={() => updateType(type)}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition ${selected ? `${conf.bgColor} ${conf.borderColor} ${conf.color}` : 'border-white/5 text-gray-400 hover:border-white/15'}`}>
                        <span className="text-xl">{conf.icon}</span>
                        <div>
                          <div className={`text-sm font-semibold ${selected ? conf.color : 'text-white'}`}>{zh ? ARTIST_TYPE_LABELS[type].zh : ARTIST_TYPE_LABELS[type].en}</div>
                          <div className="text-[10px] text-gray-500">{zh ? conf.workshop.zh : conf.workshop.en}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="bg-black/30 rounded-lg p-3 border border-white/5 text-xs text-gray-500">
                  <span className={typeConf.color}>{typeConf.icon}</span> {zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en}:
                  {' '}{zh ? `主属性 ${typeConf.primaryTalents.map(t => TALENT_LABELS[t].zh).join('/')}，专属工坊「${typeConf.workshop.zh}」` : `Primary: ${typeConf.primaryTalents.map(t => TALENT_LABELS[t].en).join('/')}, Workshop: "${typeConf.workshop.en}"`}
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Appearance */}
          {step === 1 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-5">
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.appearance_face}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FACE_STYLES.map(f => (
                      <button key={f.id} onClick={() => setState(s => ({ ...s, faceStyle: f.id }))}
                        className={`py-2 px-3 rounded-lg border text-xs transition ${state.faceStyle === f.id ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'border-white/5 text-gray-400 hover:border-white/15'}`}>
                        {zh ? f.zh : f.en}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.appearance_style}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FASHION_STYLES.map(f => (
                      <button key={f.id} onClick={() => setState(s => ({ ...s, fashionStyle: f.id }))}
                        className={`py-2 px-3 rounded-lg border text-xs transition ${state.fashionStyle === f.id ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'border-white/5 text-gray-400 hover:border-white/15'}`}>
                        {zh ? f.zh : f.en}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.appearance_age}</label>
                    <input type="number" value={state.age} onChange={e => setState(s => ({ ...s, age: +e.target.value }))}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-cyan-500/40 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.appearance_height}</label>
                    <input type="number" value={state.height} onChange={e => setState(s => ({ ...s, height: +e.target.value }))}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-cyan-500/40 focus:outline-none" />
                  </div>
                </div>
              </div>
              {/* Preview placeholder */}
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center mb-4">
                  <span className="text-5xl">{typeConf.icon}</span>
                </div>
                <p className="text-sm text-gray-400">{state.name || (zh ? '未命名艺人' : 'Unnamed Artist')}</p>
                <p className="text-xs text-gray-500 mt-1">{zh ? typeConf.previewScene.zh : typeConf.previewScene.en}</p>
                <Button variant="outline" size="sm" className="mt-4 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 gap-1 text-xs">
                  <Sparkles className="w-3 h-3" /> {t.preview_generate}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Persona */}
          {step === 2 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-5">
                <ParamSlider label={t.persona_sweetness} value={state.sweetness} onChange={v => setState(s => ({ ...s, sweetness: v }))} />
                <ParamSlider label={t.persona_energy} value={state.energy} onChange={v => setState(s => ({ ...s, energy: v }))} color="purple" />
                <ParamSlider label={t.persona_mystery} value={state.mystery} onChange={v => setState(s => ({ ...s, mystery: v }))} color="pink" />
                <ParamSlider label={t.persona_confidence} value={state.confidence} onChange={v => setState(s => ({ ...s, confidence: v }))} color="amber" />
                {typeConf.extraPersona && (
                  <div className="pt-2 border-t border-white/5">
                    <Badge className={`text-[10px] ${typeConf.bgColor} ${typeConf.color} border-0 mb-3`}>{zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en} {zh ? '专属' : 'Exclusive'}</Badge>
                    <ParamSlider label={zh ? typeConf.extraPersona.zh : typeConf.extraPersona.en} value={state.extraPersona} onChange={v => setState(s => ({ ...s, extraPersona: v }))} color="green" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Talents */}
          {step === 3 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-4">
                <p className="text-xs text-gray-500 mb-2">{t.talent_desc}</p>
                {talentKeys.map(key => {
                  const lbl = TALENT_LABELS[key];
                  const val = state.talents[key];
                  const cap = typeConf.talentCaps[key];
                  const isPrimary = typeConf.primaryTalents.includes(key);
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 flex items-center gap-1">
                          {zh ? lbl.zh : lbl.en}
                          {isPrimary && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                        </span>
                        <span className="font-semibold" style={{ color: lbl.color }}>{val}<span className="text-gray-600">/{cap}</span></span>
                      </div>
                      <input type="range" min={0} max={cap} value={Math.min(val, cap)}
                        onChange={e => setState(s => ({ ...s, talents: { ...s.talents, [key]: +e.target.value } }))}
                        className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-cyan-500
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:shadow"
                        style={{ ['--tw-accent' as any]: lbl.color }} />
                    </div>
                  );
                })}
              </div>
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
                <h3 className="text-sm font-bold mb-4">{zh ? '能力雷达' : 'Talent Radar'}</h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Value" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} strokeWidth={2} />
                      <Radar name="Cap" dataKey="cap" stroke="#a855f7" fill="none" strokeWidth={1} strokeDasharray="4 4" />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Preview */}
          {step === 4 && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left: Summary */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center">
                        <span className="text-3xl">{typeConf.icon}</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{state.name || '???'}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-xs ${typeConf.bgColor} ${typeConf.color} border-0`}>{zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en}</Badge>
                          <span className="text-xs text-gray-500">Lv.1</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">{state.bio || (zh ? '暂无简介' : 'No bio yet')}</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                        <span className="text-gray-500">{zh ? '面部' : 'Face'}: </span>
                        <span className="text-white">{FACE_STYLES.find(f => f.id === state.faceStyle)?.[zh ? 'zh' : 'en']}</span>
                      </div>
                      <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                        <span className="text-gray-500">{zh ? '风格' : 'Style'}: </span>
                        <span className="text-white">{FASHION_STYLES.find(f => f.id === state.fashionStyle)?.[zh ? 'zh' : 'en']}</span>
                      </div>
                      <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                        <span className="text-gray-500">{zh ? '年龄' : 'Age'}: </span><span className="text-white">{state.age}</span>
                      </div>
                      <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                        <span className="text-gray-500">{zh ? '身高' : 'Height'}: </span><span className="text-white">{state.height}cm</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-2">{zh ? '专属工坊' : 'Workshop'}</div>
                      <Badge className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{zh ? typeConf.workshop.zh : typeConf.workshop.en}</Badge>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-2">{zh ? '变现路径' : 'Monetization'}</div>
                      <div className="flex flex-wrap gap-1">
                        {(zh ? typeConf.monetization.zh : typeConf.monetization.en).map(m => (
                          <Badge key={m} className="text-[10px] bg-white/5 text-gray-300 border-0">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Right: Radar */}
                  <div>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                          <PolarGrid stroke="rgba(255,255,255,0.08)" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 11 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name="Value" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-xs text-gray-500 text-center">{zh ? typeConf.previewScene.zh : typeConf.previewScene.en}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
          className="border-white/10 text-gray-400 hover:text-white gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> {step === 0 ? t.btn_cancel : t.btn_prev}
        </Button>
        {step < 4 ? (
          <Button size="sm" onClick={goNext} className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-1">
            {t.btn_next} <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-2">
            {errorMsg && (
              <div className="text-xs text-red-400 max-w-xs text-right">{errorMsg}</div>
            )}
            {!basicValid && (
              <div className="text-xs text-red-400 max-w-xs text-right">
                {zh ? '请先在第一步填写艺人名称与简介' : 'Fill in name and bio in Step 1 first'}
              </div>
            )}
            <Button size="sm" onClick={handleCreate} disabled={creating || !basicValid}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-1 disabled:opacity-50">
              {creating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t.creating}</> : <><Sparkles className="w-3.5 h-3.5" /> {t.btn_create}</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
