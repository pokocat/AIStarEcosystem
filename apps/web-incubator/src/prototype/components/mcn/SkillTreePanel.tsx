import React from 'react';
import { motion } from 'motion/react';
import { Zap, Star } from 'lucide-react';
import type { Lang } from '../../translations';
import type { TalentProfile } from './ArtistTypes';
import { TALENT_LABELS, ARTIST_TYPE_CONFIG, type ArtistType } from './ArtistTypes';

interface SubSkill {
  id: string;
  zh: string;
  en: string;
  talentKey: keyof TalentProfile;
  bonusPerLevel: number;
  icon: string;
}

export const SUB_SKILLS: SubSkill[] = [
  { id: 'pitch',      zh: '音准',     en: 'Pitch',       talentKey: 'singing',  bonusPerLevel: 3, icon: 'MUS' },
  { id: 'breath',     zh: '气息',     en: 'Breath',      talentKey: 'singing',  bonusPerLevel: 3, icon: 'BRT' },
  { id: 'vocal_range',zh: '音域',     en: 'Range',       talentKey: 'singing',  bonusPerLevel: 4, icon: 'SND' },
  { id: 'emotion',    zh: '情绪张力', en: 'Emotion',     talentKey: 'acting',   bonusPerLevel: 3, icon: 'ACT' },
  { id: 'dialogue',   zh: '台词功底', en: 'Dialogue',    talentKey: 'acting',   bonusPerLevel: 3, icon: 'DLG' },
  { id: 'physical',   zh: '形体表演', en: 'Physical',    talentKey: 'acting',   bonusPerLevel: 4, icon: 'PHY' },
  { id: 'power',      zh: '爆发力',   en: 'Power',       talentKey: 'dancing',  bonusPerLevel: 3, icon: 'PWR' },
  { id: 'flexibility',zh: '柔韧度',   en: 'Flex',        talentKey: 'dancing',  bonusPerLevel: 3, icon: 'FLX' },
  { id: 'vibe',       zh: '感染力',   en: 'Vibe',        talentKey: 'dancing',  bonusPerLevel: 4, icon: 'VIB' },
  { id: 'improv',     zh: '临场反应', en: 'Improv',      talentKey: 'hosting',  bonusPerLevel: 3, icon: 'IMP' },
  { id: 'control',    zh: '控场能力', en: 'Control',     talentKey: 'hosting',  bonusPerLevel: 3, icon: 'CTL' },
  { id: 'eloquence',  zh: '语言魅力', en: 'Eloquence',   talentKey: 'hosting',  bonusPerLevel: 4, icon: 'ELQ' },
  { id: 'timing',     zh: '包袱时机', en: 'Timing',      talentKey: 'comedy',   bonusPerLevel: 3, icon: 'TIM' },
  { id: 'reaction',   zh: '即兴反应', en: 'Reaction',    talentKey: 'comedy',   bonusPerLevel: 3, icon: 'RCT' },
  { id: 'character',  zh: '人物塑造', en: 'Character',   talentKey: 'comedy',   bonusPerLevel: 4, icon: 'CHR' },
  { id: 'atmosphere', zh: '氛围感染', en: 'Atmosphere',  talentKey: 'variety',  bonusPerLevel: 3, icon: 'ATM' },
  { id: 'meme_sense', zh: '梗的嗅觉', en: 'Meme Sense',  talentKey: 'variety',  bonusPerLevel: 3, icon: 'MEM' },
  { id: 'camera_feel',zh: '镜头感',   en: 'Camera Feel', talentKey: 'variety',  bonusPerLevel: 4, icon: 'CAM' },
];

export const SKILL_TREE_TOTAL_POINTS = 18;

export function computeSkillBonuses(subSkillPoints: Record<string, number>): Partial<TalentProfile> {
  const bonuses: Partial<TalentProfile> = {};
  for (const skill of SUB_SKILLS) {
    const lvl = subSkillPoints[skill.id] || 0;
    if (lvl > 0) {
      const key = skill.talentKey;
      bonuses[key] = (bonuses[key] || 0) + lvl * skill.bonusPerLevel;
    }
  }
  return bonuses;
}

interface SkillTreePanelProps {
  lang: Lang;
  artistType: ArtistType;
  talents: TalentProfile;
  subSkillPoints: Record<string, number>;
  onChange: (subSkillPoints: Record<string, number>) => void;
}

export const SkillTreePanel = ({ lang, artistType, talents, subSkillPoints, onChange }: SkillTreePanelProps) => {
  const zh = lang === 'zh';
  const talentKeys = Object.keys(TALENT_LABELS) as (keyof TalentProfile)[];
  const typeConf = ARTIST_TYPE_CONFIG[artistType];

  const usedPoints = Object.values(subSkillPoints).reduce((s, v) => s + v, 0);
  const remaining = SKILL_TREE_TOTAL_POINTS - usedPoints;

  const bonuses = computeSkillBonuses(subSkillPoints);

  const getSubSkills = (k: keyof TalentProfile) => SUB_SKILLS.filter(s => s.talentKey === k);

  const setLevel = (id: string, newLevel: number) => {
    const current = subSkillPoints[id] || 0;
    const delta = newLevel - current;
    if (delta > remaining) return;
    if (newLevel < 0) return;
    onChange({ ...subSkillPoints, [id]: newLevel });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">{zh ? 'TRE 技能树系统' : 'TRE Skill Tree'}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {zh ? '解锁专属子技能，强化核心天赋维度' : 'Unlock sub-skills to amplify core talent dimensions'}
          </p>
        </div>
        <motion.div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${remaining === 0 ? 'border-amber-500/50 bg-amber-500/10' : 'border-cyan-500/30 bg-cyan-500/10'}`}
          animate={{ boxShadow: remaining === 0 ? ['0 0 0px rgba(245,158,11,0)', '0 0 12px rgba(245,158,11,0.4)', '0 0 0px rgba(245,158,11,0)'] : 'none' }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Zap className={`w-3.5 h-3.5 ${remaining === 0 ? 'text-amber-400' : 'text-cyan-400'}`} />
          <span className={`text-xs font-bold font-mono ${remaining === 0 ? 'text-amber-400' : 'text-cyan-400'}`}>{remaining}</span>
          <span className="text-xs text-gray-600">/ {SKILL_TREE_TOTAL_POINTS}</span>
        </motion.div>
      </div>

      {/* Skill Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {talentKeys.map(key => {
          const lbl = TALENT_LABELS[key];
          const skills = getSubSkills(key);
          const bonus = bonuses[key] || 0;
          const base = talents[key];
          const total = Math.min(typeConf.talentCaps[key], base + bonus);
          const isPrimary = typeConf.primaryTalents.includes(key);
          const branchUsed = skills.reduce((s, sk) => s + (subSkillPoints[sk.id] || 0), 0);

          return (
            <motion.div
              key={key}
              className={`relative bg-gray-900/70 border rounded-xl p-4 space-y-3 overflow-hidden transition-colors duration-300 ${isPrimary ? 'border-amber-500/20' : 'border-white/5'}`}
              whileHover={{ borderColor: lbl.color + '30' }}
            >
              {/* Corner glow when active */}
              {branchUsed > 0 && (
                <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-20"
                  style={{ background: `radial-gradient(circle at top right, ${lbl.color}, transparent)` }} />
              )}

              {/* Talent header */}
              <div className="flex items-center gap-2 relative">
                <motion.div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: lbl.color }}
                  animate={branchUsed > 0 ? { boxShadow: [`0 0 4px ${lbl.color}`, `0 0 10px ${lbl.color}`, `0 0 4px ${lbl.color}`] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-xs font-bold text-white">{zh ? lbl.zh : lbl.en}</span>
                {isPrimary && (
                  <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1 rounded border border-amber-500/20 flex items-center gap-0.5">
                    <Star className="w-2 h-2 fill-current" />主
                  </span>
                )}
                <div className="ml-auto text-[10px] font-mono">
                  <span className="text-gray-500">{base}</span>
                  {bonus > 0 && <span className="text-green-400">+{bonus}</span>}
                  <span className="text-gray-600">/{typeConf.talentCaps[key]}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-1.5 bg-gray-800/80 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full opacity-25 transition-all duration-500"
                  style={{ backgroundColor: lbl.color, width: `${(base / 100) * 100}%` }} />
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ backgroundColor: lbl.color }}
                  animate={{ width: `${(total / 100) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
                {bonus > 0 && (
                  <motion.div
                    className="absolute inset-y-0 rounded-full"
                    style={{ backgroundColor: lbl.color, right: 0, left: `${(base / 100) * 100}%`, opacity: 0.6 }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </div>

              {/* Sub-skills */}
              <div className="space-y-2 relative">
                {/* Vertical connector line */}
                <div className="absolute left-1 top-0 bottom-0 w-px" style={{ backgroundColor: lbl.color + '20' }} />

                {skills.map(skill => {
                  const level = subSkillPoints[skill.id] || 0;
                  return (
                    <div key={skill.id} className="pl-4 relative">
                      {/* Horizontal connector */}
                      <div className="absolute left-1 top-1/2 w-3 h-px" style={{ backgroundColor: lbl.color + (level > 0 ? '60' : '20') }} />

                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px]">{skill.icon}</span>
                        <span className="text-[10px] text-gray-400 flex-1">{zh ? skill.zh : skill.en}</span>
                        {level > 0 && (
                          <span className="text-[9px] font-mono" style={{ color: lbl.color }}>
                            +{skill.bonusPerLevel * level}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-1">
                        {[1, 2, 3].map(lvl => {
                          const isActive = level >= lvl;
                          const canUp = lvl > level && remaining > 0;
                          const canDown = lvl === level && level > 0;

                          return (
                            <motion.button
                              key={lvl}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                if (canDown) setLevel(skill.id, level - 1);
                                else if (canUp) setLevel(skill.id, level + 1);
                              }}
                              className={`flex-1 h-4 rounded text-[8px] transition-all duration-200 font-mono
                                ${isActive
                                  ? 'cursor-pointer'
                                  : canUp
                                    ? 'border border-white/10 bg-white/[0.02] hover:border-white/20 cursor-pointer text-gray-600'
                                    : 'border border-white/5 opacity-25 cursor-not-allowed text-gray-700'
                                }`}
                              style={isActive ? {
                                backgroundColor: `${lbl.color}25`,
                                borderWidth: 1,
                                borderColor: `${lbl.color}60`,
                                color: lbl.color,
                                boxShadow: `0 0 4px ${lbl.color}30`,
                              } : {}}
                            >
                              {isActive ? lvl : '·'}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {remaining === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-400"
        >
          ZAP {zh ? '技能点已全部分配！子技能树已完全激活。' : 'All skill points allocated! Sub-skill tree fully activated.'}
        </motion.div>
      )}

      {usedPoints === 0 && (
        <p className="text-xs text-gray-600 text-center">
          {zh ? 'TIP 点击技能格分配技能点，右侧格数字越大加成越强' : 'TIP Click skill cells to allocate points — higher levels = stronger bonuses'}
        </p>
      )}
    </div>
  );
};
