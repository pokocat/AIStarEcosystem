"use client";

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Sparkles, Shuffle, Wand2, X,
  Star, CheckCircle2, Loader2
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { Lang } from "../../translations";
import { TRANSLATIONS } from "../../translations";
import {
  type ArtistType, type TalentProfile,
  ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS, TALENT_LABELS
} from './ArtistTypes';
import { ArtistsApi, ConfigApi, ApiError } from "@/api";
import {
  type WizardState, type WizardTemplate, type LabeledI18n, type FandomColor,
  INITIAL_STATE, GENERATIONS, CREATOR_MODES,
  FALLBACK_TEMPLATES, FALLBACK_FACE_STYLES, FALLBACK_FASHION_STYLES,
  FALLBACK_MBTI_TYPES, FALLBACK_PERSONA_TAGS, FALLBACK_VOCAL_RANGES,
  FALLBACK_MUSIC_GENRES, FALLBACK_DANCE_STYLES, FALLBACK_FANDOM_COLORS,
  FALLBACK_BRAND_RESTRICTIONS,
  getTypeSpecificGate, buildIncubationParams, randomizeState,
} from './IncubationWizardShared';

/* Slider */
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

/* 多选芯片 */
const MultiChips = <T extends { id: string; zh: string }>(
  { items, selected, onToggle, max }: { items: T[]; selected: string[]; onToggle: (id: string) => void; max?: number }
) => (
  <div className="flex flex-wrap gap-2">
    {items.map(it => {
      const on = selected.includes(it.id);
      const disabled = !on && typeof max === 'number' && selected.length >= max;
      return (
        <button key={it.id} type="button" disabled={disabled} onClick={() => onToggle(it.id)}
          className={`px-3 py-1.5 rounded-full text-xs border transition ${on
            ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
            : disabled
              ? 'border-white/5 text-gray-600 cursor-not-allowed'
              : 'border-white/10 text-gray-400 hover:border-white/25'}`}>
          {it.zh}
        </button>
      );
    })}
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
    { label: t.step_type_specific, icon: '05' },
    { label: t.step_fandom, icon: '06' },
    { label: t.step_worldview, icon: '07' },
  ];

  const typeConf = ARTIST_TYPE_CONFIG[state.type];
  const gate = getTypeSpecificGate(state.type);
  const LAST_STEP = steps.length - 1;

  const updateType = (type: ArtistType) => {
    setState(s => ({ ...s, type, talents: { ...ARTIST_TYPE_CONFIG[type].initialTalents } }));
  };

  const toggleInArray = (key: keyof WizardState, id: string, limit?: number) => {
    setState(s => {
      const cur = (s[key] as string[]) || [];
      const on = cur.includes(id);
      if (!on && typeof limit === 'number' && cur.length >= limit) return s;
      const next = on ? cur.filter(x => x !== id) : [...cur, id];
      return { ...s, [key]: next } as WizardState;
    });
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  // 远程可热更的选项列表（fallback 兜底）
  const [FACE_STYLES, setFaceStyles]       = useState<LabeledI18n[]>(FALLBACK_FACE_STYLES);
  const [FASHION_STYLES, setFashionStyles] = useState<LabeledI18n[]>(FALLBACK_FASHION_STYLES);
  const [MBTI_TYPES, setMbti]              = useState<LabeledI18n[]>(FALLBACK_MBTI_TYPES);
  const [PERSONA_TAGS, setPersonaTags]     = useState<LabeledI18n[]>(FALLBACK_PERSONA_TAGS);
  const [VOCAL_RANGES, setVocalRanges]     = useState<LabeledI18n[]>(FALLBACK_VOCAL_RANGES);
  const [MUSIC_GENRES, setMusicGenres]     = useState<LabeledI18n[]>(FALLBACK_MUSIC_GENRES);
  const [DANCE_STYLES, setDanceStyles]     = useState<LabeledI18n[]>(FALLBACK_DANCE_STYLES);
  const [FANDOM_COLORS, setFandomColors]   = useState<FandomColor[]>(FALLBACK_FANDOM_COLORS);
  const [BRAND_RESTRICTIONS, setBrand]     = useState<LabeledI18n[]>(FALLBACK_BRAND_RESTRICTIONS);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [TEMPLATES, setTemplates]          = useState<WizardTemplate[]>(FALLBACK_TEMPLATES);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      ConfigApi.getConfig<LabeledI18n[]>("incubation.faceStyles",      FALLBACK_FACE_STYLES),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.fashionStyles",   FALLBACK_FASHION_STYLES),
      ConfigApi.getConfig<WizardTemplate[]>("incubation.templates",    FALLBACK_TEMPLATES),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.mbtiTypes",       FALLBACK_MBTI_TYPES),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.personaTags",     FALLBACK_PERSONA_TAGS),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.vocalRanges",     FALLBACK_VOCAL_RANGES),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.musicGenres",     FALLBACK_MUSIC_GENRES),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.danceStyles",     FALLBACK_DANCE_STYLES),
      ConfigApi.getConfig<FandomColor[]>("incubation.fandomColors",    FALLBACK_FANDOM_COLORS),
      ConfigApi.getConfig<LabeledI18n[]>("incubation.brandRestrictions", FALLBACK_BRAND_RESTRICTIONS),
    ]).then(([face, fashion, templates, mbti, tags, vocal, genres, dance, colors, brand]) => {
      if (cancelled) return;
      if (face?.length)     setFaceStyles(face);
      if (fashion?.length)  setFashionStyles(fashion);
      if (templates?.length) setTemplates(templates);
      if (mbti?.length)     setMbti(mbti);
      if (tags?.length)     setPersonaTags(tags);
      if (vocal?.length)    setVocalRanges(vocal);
      if (genres?.length)   setMusicGenres(genres);
      if (dance?.length)    setDanceStyles(dance);
      if (colors?.length)   setFandomColors(colors);
      if (brand?.length)    setBrand(brand);
    });
    return () => { cancelled = true; };
  }, []);

  const randomize = () => setState(s => randomizeState(s, {
    mbti: MBTI_TYPES,
    personaTags: PERSONA_TAGS,
    vocalRanges: VOCAL_RANGES,
    musicGenres: MUSIC_GENRES,
    danceStyles: DANCE_STYLES,
    fandomColors: FANDOM_COLORS,
  }));

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
        incubationParams: buildIncubationParams(state),
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

  const creatorModeLabel = (m: string) => (
    m === 'lyric' ? t.music_creator_lyric :
    m === 'full'  ? t.music_creator_full  : t.music_creator_singer
  );

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
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <button onClick={() => setStep(i)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition ${step === i ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : step > i ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'text-gray-500 border border-white/5'}`}>
              <span className="font-bold">{s.icon}</span>
              <span className="hidden md:inline">{s.label}</span>
            </button>
            {i < steps.length - 1 && <div className={`hidden md:block flex-1 h-px min-w-[12px] ${step > i ? 'bg-green-500/30' : 'bg-white/5'}`} />}
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
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.generation_label}</label>
                    <div className="flex gap-2">
                      {GENERATIONS.map(g => (
                        <button key={g} onClick={() => setState(s => ({ ...s, generation: g }))}
                          className={`px-3 py-1.5 rounded-lg border text-xs ${state.generation === g ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' : 'border-white/10 text-gray-400 hover:border-white/25'}`}>
                          {g}
                        </button>
                      ))}
                    </div>
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
                  {' '}{zh ? `主属性 ${typeConf.primaryTalents.map(k => TALENT_LABELS[k].zh).join('/')}，专属工坊「${typeConf.workshop.zh}」` : `Primary: ${typeConf.primaryTalents.map(k => TALENT_LABELS[k].en).join('/')}, Workshop: "${typeConf.workshop.en}"`}
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
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.signature_color}</label>
                  <div className="flex flex-wrap gap-2">
                    {FANDOM_COLORS.map(c => {
                      const on = state.signatureColor === c.id;
                      return (
                        <button key={c.id} onClick={() => setState(s => ({ ...s, signatureColor: c.id }))}
                          className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-xs ${on ? 'border-cyan-500/50 text-cyan-300 bg-cyan-500/5' : 'border-white/10 text-gray-400 hover:border-white/25'}`}>
                          <span className="w-5 h-5 rounded-full border border-white/10" style={{ background: c.color }} />
                          {zh ? c.zh : c.en}
                        </button>
                      );
                    })}
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
            <div className="grid lg:grid-cols-2 gap-6">
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
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-5">
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.persona_mbti}</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {MBTI_TYPES.map(m => (
                      <button key={m.id} onClick={() => setState(s => ({ ...s, mbti: s.mbti === m.id ? '' : m.id }))}
                        title={zh ? m.zh : m.en}
                        className={`py-2 rounded-md border text-[11px] font-mono transition ${state.mbti === m.id ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' : 'border-white/10 text-gray-400 hover:border-white/25'}`}>
                        {m.id}
                      </button>
                    ))}
                  </div>
                  {state.mbti && (
                    <p className="mt-2 text-[11px] text-gray-500">{MBTI_TYPES.find(m => m.id === state.mbti) ? (zh ? MBTI_TYPES.find(m => m.id === state.mbti)!.zh : MBTI_TYPES.find(m => m.id === state.mbti)!.en) : ''}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">
                    {t.persona_tags} <span className="text-gray-600 normal-case">{t.persona_tags_hint}</span>
                  </label>
                  <MultiChips items={PERSONA_TAGS} selected={state.personaTags} max={5}
                    onToggle={id => toggleInArray('personaTags', id, 5)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.persona_speaking_style}</label>
                  <input value={state.speakingStyle} onChange={e => setState(s => ({ ...s, speakingStyle: e.target.value }))}
                    placeholder={t.persona_speaking_style_placeholder}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none" />
                </div>
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
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:shadow" />
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

          {/* STEP 4: Type-specific */}
          {step === 4 && (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${typeConf.bgColor} ${typeConf.color} border-0`}>{typeConf.icon} {zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en}</Badge>
                  <span className="text-xs text-gray-500">{t.step_type_specific}</span>
                </div>

                {!gate.music && !gate.dance && !gate.hosting && !gate.acting && (
                  <p className="text-sm text-gray-500">{zh ? '当前艺人类型暂无专属维度设定，可直接进入下一步。' : 'No type-specific dimensions for this artist type.'}</p>
                )}

                {gate.music && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.music_vocal_range}</label>
                        <div className="grid grid-cols-3 gap-2">
                          {VOCAL_RANGES.map(v => (
                            <button key={v.id} onClick={() => setState(s => ({ ...s, vocalRange: s.vocalRange === v.id ? '' : v.id }))}
                              className={`py-2 px-2 rounded-lg border text-xs ${state.vocalRange === v.id ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' : 'border-white/10 text-gray-400 hover:border-white/25'}`}>
                              {zh ? v.zh : v.en}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.music_voice_tone}</label>
                        <input value={state.voiceTone} onChange={e => setState(s => ({ ...s, voiceTone: e.target.value }))}
                          placeholder={t.music_voice_tone_placeholder}
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">
                        {t.music_genres} <span className="text-gray-600 normal-case">{t.music_genres_hint}</span>
                      </label>
                      <MultiChips items={MUSIC_GENRES} selected={state.musicGenres} onToggle={id => toggleInArray('musicGenres', id)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.music_creator_mode}</label>
                      <div className="flex gap-2">
                        {CREATOR_MODES.map(m => (
                          <button key={m} onClick={() => setState(s => ({ ...s, creatorMode: m }))}
                            className={`px-3 py-1.5 rounded-lg border text-xs ${state.creatorMode === m ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' : 'border-white/10 text-gray-400 hover:border-white/25'}`}>
                            {creatorModeLabel(m)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {gate.dance && (
                  <div className={gate.music ? 'pt-4 border-t border-white/5' : ''}>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.dance_styles}</label>
                    <MultiChips items={DANCE_STYLES} selected={state.danceStyles} onToggle={id => toggleInArray('danceStyles', id)} />
                  </div>
                )}

                {gate.hosting && (
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.hosting_style}</label>
                    <input value={state.hostingStyle} onChange={e => setState(s => ({ ...s, hostingStyle: e.target.value }))}
                      placeholder={t.hosting_style_placeholder}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none" />
                  </div>
                )}

                {gate.acting && (
                  <div className={gate.music || gate.dance ? 'pt-4 border-t border-white/5' : ''}>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.acting_genres}</label>
                    <input value={state.actingGenres} onChange={e => setState(s => ({ ...s, actingGenres: e.target.value }))}
                      placeholder={t.acting_genres_placeholder}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Fandom & Business */}
          {step === 5 && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.fandom_audience}</label>
                    <input value={state.targetAudience} onChange={e => setState(s => ({ ...s, targetAudience: e.target.value }))}
                      placeholder={t.fandom_audience_placeholder}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.fandom_name}</label>
                    <input value={state.fandomName} onChange={e => setState(s => ({ ...s, fandomName: e.target.value }))}
                      placeholder={t.fandom_name_placeholder}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.fandom_color}</label>
                  <div className="flex flex-wrap gap-2">
                    {FANDOM_COLORS.map(c => {
                      const on = state.fanColor === c.id;
                      return (
                        <button key={c.id} onClick={() => setState(s => ({ ...s, fanColor: c.id }))}
                          className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-xs ${on ? 'border-cyan-500/50 text-cyan-300 bg-cyan-500/5' : 'border-white/10 text-gray-400 hover:border-white/25'}`}>
                          <span className="w-5 h-5 rounded-full border border-white/10" style={{ background: c.color }} />
                          {zh ? c.zh : c.en}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">
                    {t.brand_restrictions} <span className="text-gray-600 normal-case">{t.brand_restrictions_hint}</span>
                  </label>
                  <MultiChips items={BRAND_RESTRICTIONS} selected={state.brandRestrictions}
                    onToggle={id => toggleInArray('brandRestrictions', id)} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Worldview + Preview */}
          {step === 6 && (
            <div className="max-w-4xl mx-auto space-y-5">
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.worldview_backstory}</label>
                  <textarea value={state.backstory} onChange={e => setState(s => ({ ...s, backstory: e.target.value }))}
                    placeholder={t.worldview_backstory_placeholder}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none h-24 resize-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{t.worldview_group}</label>
                  <input value={state.groupAffiliation} onChange={e => setState(s => ({ ...s, groupAffiliation: e.target.value }))}
                    placeholder={t.worldview_group_placeholder}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none" />
                </div>
              </div>

              {/* Summary + Radar */}
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center">
                        <span className="text-3xl">{typeConf.icon}</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{state.name || '???'}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-xs ${typeConf.bgColor} ${typeConf.color} border-0`}>{zh ? ARTIST_TYPE_LABELS[state.type].zh : ARTIST_TYPE_LABELS[state.type].en}</Badge>
                          <span className="text-xs text-gray-500">Lv.1 · {state.generation}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">{state.bio || (zh ? '暂无简介' : 'No bio yet')}</p>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                        <span className="text-gray-500">{zh ? '面部' : 'Face'}: </span>
                        <span className="text-white">{FACE_STYLES.find(f => f.id === state.faceStyle)?.[zh ? 'zh' : 'en']}</span>
                      </div>
                      <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                        <span className="text-gray-500">{zh ? '风格' : 'Style'}: </span>
                        <span className="text-white">{FASHION_STYLES.find(f => f.id === state.fashionStyle)?.[zh ? 'zh' : 'en']}</span>
                      </div>
                      {state.mbti && (
                        <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                          <span className="text-gray-500">MBTI: </span><span className="text-white">{state.mbti}</span>
                        </div>
                      )}
                      {state.signatureColor && (
                        <div className="bg-black/30 rounded-lg p-2 border border-white/5 flex items-center gap-2">
                          <span className="text-gray-500">{t.signature_color}: </span>
                          <span className="w-3 h-3 rounded-full" style={{ background: FANDOM_COLORS.find(c => c.id === state.signatureColor)?.color }} />
                          <span className="text-white">{FANDOM_COLORS.find(c => c.id === state.signatureColor)?.zh}</span>
                        </div>
                      )}
                    </div>

                    {state.personaTags.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">{t.persona_tags}</div>
                        <div className="flex flex-wrap gap-1">
                          {state.personaTags.map(id => {
                            const tag = PERSONA_TAGS.find(p => p.id === id);
                            return tag ? <Badge key={id} className="text-[10px] bg-white/5 text-gray-300 border-0">{zh ? tag.zh : tag.en}</Badge> : null;
                          })}
                        </div>
                      </div>
                    )}

                    {gate.music && state.musicGenres.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">{t.music_genres}</div>
                        <div className="flex flex-wrap gap-1">
                          {state.musicGenres.map(id => {
                            const g = MUSIC_GENRES.find(x => x.id === id);
                            return g ? <Badge key={id} className="text-[10px] bg-cyan-500/10 text-cyan-300 border-0">{zh ? g.zh : g.en}</Badge> : null;
                          })}
                        </div>
                      </div>
                    )}

                    {state.fandomName && (
                      <div className="text-xs text-gray-500">
                        {t.fandom_name}：<span className="text-white">{state.fandomName}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="h-[220px]">
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
                    <div className="mt-3">
                      <div className="text-xs text-gray-500 mb-1">{zh ? '变现路径' : 'Monetization'}</div>
                      <div className="flex flex-wrap gap-1">
                        {(zh ? typeConf.monetization.zh : typeConf.monetization.en).map(m => (
                          <Badge key={m} className="text-[10px] bg-white/5 text-gray-300 border-0">{m}</Badge>
                        ))}
                      </div>
                    </div>
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
        {step < LAST_STEP ? (
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
