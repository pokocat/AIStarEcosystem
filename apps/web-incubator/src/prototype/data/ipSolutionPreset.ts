import type { ArtistType, DesignStyle, ProfessionBackground } from '../components/mcn/ArtistTypes';
import { SOLUTION_CONFIGS, isSolutionId, type IPTypeId, type SolutionId } from './ipPlatform';

/** The solution context carried from a homepage into the workspace. */
export interface SolutionPreset {
  solutionId: SolutionId;
  ipType: IPTypeId;
  creationMode: string;
  contentModes: string[];
  recommendedEngines: string[];
}

/** How each solution pre-fills the incubation wizard's identity step. */
export interface WizardDefaults {
  type: ArtistType;
  designStyle: DesignStyle;
  profession: ProfessionBackground | null;
}

export const PRESET_STORAGE_KEY = 'ai_ip_solution_preset';

export const SOLUTION_WIZARD_DEFAULTS: Record<SolutionId, WizardDefaults> = {
  ecosystem: { type: 'singer', designStyle: 'cyber_mecha', profession: null },
  'ai-artist': { type: 'singer', designStyle: 'hyperreal', profession: null },
  'ai-drama': { type: 'actor', designStyle: 'hyperreal', profession: null },
  'story-commerce': { type: 'actor', designStyle: 'hyperreal', profession: 'influencer' },
  'virtual-idol': { type: 'idol', designStyle: 'anime', profession: null },
  'corporate-ip': { type: 'host', designStyle: 'cyber_mecha', profession: null },
  'brand-ip': { type: 'entertainer', designStyle: 'y2k', profession: 'designer' },
  'city-ip': { type: 'host', designStyle: 'chinoiserie', profession: null },
  'digital-founder': { type: 'host', designStyle: 'hyperreal', profession: 'entrepreneur' },
  'culture-ip': { type: 'host', designStyle: 'chinoiserie', profession: 'artist' },
  'education-ip': { type: 'host', designStyle: 'hyperreal', profession: 'teacher' },
  'anime-ip': { type: 'actor', designStyle: 'anime', profession: 'artist' },
  'social-ip': { type: 'entertainer', designStyle: 'dreamcore', profession: 'influencer' },
};

export const getPresetForSolution = (solutionId: SolutionId): SolutionPreset => {
  if (solutionId === 'ecosystem' || solutionId === 'ai-artist') {
    const artist = solutionId === 'ai-artist';
    return {
      solutionId,
      ipType: 'entertainment',
      creationMode: artist ? 'ai-artist' : 'guided',
      contentModes: artist ? ['music', 'film', 'variety'] : [],
      recommendedEngines: artist ? ['music', 'voice', 'video', 'distribution'] : [],
    };
  }
  const config = SOLUTION_CONFIGS[solutionId];
  return { solutionId, ipType: config.ipType, ...config.preset };
};

export const readStoredPreset = (): SolutionPreset | null => {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SolutionPreset>;
    if (typeof parsed.solutionId !== 'string' || !isSolutionId(parsed.solutionId)) return null;
    const base = getPresetForSolution(parsed.solutionId);
    return {
      ...base,
      contentModes: Array.isArray(parsed.contentModes) ? parsed.contentModes.filter(m => base.contentModes.includes(m)) : base.contentModes,
      recommendedEngines: Array.isArray(parsed.recommendedEngines) ? parsed.recommendedEngines.filter(e => base.recommendedEngines.includes(e)) : base.recommendedEngines,
    };
  } catch {
    return null;
  }
};

export const writeStoredPreset = (preset: SolutionPreset) => {
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(preset));
  } catch {
    // Storage can be unavailable (private mode); the in-memory preset still works.
  }
};
