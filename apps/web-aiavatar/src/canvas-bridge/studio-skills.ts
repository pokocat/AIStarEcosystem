// The skills the dialogue can use (GET /v1/ip-studio/studio/skills). The UI never shows the
// word "skill": it only reads names and limits to say what the assistant can make.
import type { StudioSkillSummary } from '@ai-star-eco/types/ip-studio-workflow';
import { USE_MOCK, apiFetch, mockDelay } from '@/ip/api/_client';
import { MOCK_STUDIO_SKILLS } from '@/ip/mocks/studio-dialogue';

let cached: Promise<StudioSkillSummary[]> | undefined;

export async function listStudioSkills(): Promise<StudioSkillSummary[]> {
  if (USE_MOCK) return mockDelay(MOCK_STUDIO_SKILLS);
  return apiFetch<StudioSkillSummary[]>("/v1/ip-studio/studio/skills");
}

/** One request per page load; a failure is not cached so the next open retries. */
export function loadStudioSkills(): Promise<StudioSkillSummary[]> {
  cached ||= listStudioSkills().catch(error => { cached = undefined; throw error; });
  return cached;
}

/** A plain sentence for the settings panel, e.g. 「短视频复刻：原片最长 60 秒，最多分 8 段」. */
export function studioSkillNotes(skills: StudioSkillSummary[]): string[] {
  return skills.filter(s => s.status === 'active').map(s => {
    const limits = [s.limits.maxSourceSec ? `原片最长 ${s.limits.maxSourceSec} 秒` : '', s.limits.maxSegments ? `最多分 ${s.limits.maxSegments} 段` : ''].filter(Boolean);
    return limits.length ? `${s.name}：${limits.join('，')}` : s.name;
  });
}
