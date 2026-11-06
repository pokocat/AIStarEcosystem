import React from 'react';
import { Check, Cpu, Layers, Sparkles, Wand2 } from 'lucide-react';
import type { Lang } from '../../translations';
import { IP_TYPE_TEMPLATES, SOLUTION_ORDER, getSolutionLabel, type SolutionId } from '../../data/ipPlatform';
import { getContentMode, getEngine } from '../../data/ipEngines';
import { SOLUTION_WIZARD_DEFAULTS, getPresetForSolution, type SolutionPreset } from '../../data/ipSolutionPreset';
import { ARTIST_TYPE_LABELS, DESIGN_STYLE_CONFIG, PROFESSION_CONFIG } from './ArtistTypes';

interface Props {
  lang: Lang;
  preset: SolutionPreset;
  onChange: (preset: SolutionPreset) => void;
  /** Re-apply the template's identity defaults (type, style, profession) to the current artist. */
  onApplyDefaults: () => void;
}

/**
 * Shows the IP template carried in from the homepage and lets the user switch template
 * or fine-tune which content modes and AI engines are enabled for this IP.
 */
export const IPTemplatePanel = ({ lang, preset, onChange, onApplyDefaults }: Props) => {
  const zh = lang === 'zh';
  const template = getPresetForSolution(preset.solutionId);
  const defaults = SOLUTION_WIZARD_DEFAULTS[preset.solutionId];
  const ipType = IP_TYPE_TEMPLATES.find(item => item.id === preset.ipType);

  const toggle = (key: 'contentModes' | 'recommendedEngines', value: string) => {
    const list = preset[key];
    const next = list.includes(value) ? list.filter(item => item !== value) : [...list, value];
    onChange({ ...preset, [key]: next });
  };

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs border transition ${active
      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
      : 'border-white/10 bg-white/[0.02] text-gray-500 hover:text-gray-300'}`;

  return (
    <div className="mb-4 rounded-2xl border border-cyan-500/20 p-4"
      // Inline gradient so the global light-theme class remapping doesn't turn it grey.
      style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.07), rgba(168,85,247,0.05))' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-gray-500">{zh ? 'IP 类型模板' : 'IP Template'}</div>
            <div className="text-sm font-bold text-white">
              {getSolutionLabel(preset.solutionId)[lang]}
              {ipType && <span className="ml-2 text-xs font-normal text-cyan-300">{ipType.name[lang]}</span>}
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          {zh ? '切换模板' : 'Template'}
          <select
            value={preset.solutionId}
            onChange={event => onChange(getPresetForSolution(event.target.value as SolutionId))}
            className="h-8 rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
          >
            {SOLUTION_ORDER.map(id => (
              <option key={id} value={id}>{id === 'ecosystem' ? (zh ? '通用 IP' : 'General IP') : getSolutionLabel(id)[lang]}</option>
            ))}
          </select>
        </label>
      </div>

      {template.contentModes.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2"><Layers className="w-3.5 h-3.5" /> {zh ? '内容模式' : 'Content modes'}</div>
          <div className="flex flex-wrap gap-1.5">
            {template.contentModes.map(mode => {
              const active = preset.contentModes.includes(mode);
              return (
                <button key={mode} type="button" onClick={() => toggle('contentModes', mode)} className={chip(active)} title={getContentMode(mode).description[lang]}>
                  {active && <Check className="w-3 h-3" />} {getContentMode(mode).name[lang]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {template.recommendedEngines.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2"><Cpu className="w-3.5 h-3.5" /> {zh ? '推荐 AI 引擎' : 'Recommended AI engines'}</div>
          <div className="flex flex-wrap gap-1.5">
            {template.recommendedEngines.map(engine => {
              const active = preset.recommendedEngines.includes(engine);
              return (
                <button key={engine} type="button" onClick={() => toggle('recommendedEngines', engine)} className={chip(active)} title={getEngine(engine).description[lang]}>
                  {active && <Check className="w-3 h-3" />} {getEngine(engine).name[lang]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-gray-500">
          {zh ? '模板预设：' : 'Defaults: '}
          <span className="text-gray-300">{ARTIST_TYPE_LABELS[defaults.type][lang]}</span>
          {' · '}<span className="text-gray-300">{DESIGN_STYLE_CONFIG[defaults.designStyle][lang]}</span>
          {defaults.profession && <>{' · '}<span className="text-gray-300">{PROFESSION_CONFIG[defaults.profession][lang]}</span></>}
        </div>
        <button type="button" onClick={onApplyDefaults} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20 transition">
          <Wand2 className="w-3.5 h-3.5" /> {zh ? '应用到当前 IP' : 'Apply to this IP'}
        </button>
      </div>
    </div>
  );
};

export default IPTemplatePanel;
