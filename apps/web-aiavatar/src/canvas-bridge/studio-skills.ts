// The skills the dialogue can use (GET /v1/ip-studio/studio/skills), the per-message skill choice and the
// operator-only 「整理成技能草稿」 action (POST /v1/ip-studio/projects/{id}/skill-drafts).
//
// The settings read names and limits to say what the assistant can make; only with several active skills do
// they offer a choice (「自动」 = the server routes by intent, and only until the thread is bound to one). A plan
// card names the skill version it was planned with. A skill choice selects a method, never payment.
import { ApiError } from '@ai-star-eco/api-client';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioDialogueMessage, StudioPlan, StudioSkillDraftOutput, StudioSkillDraftRequest, StudioSkillRequiredDetails, StudioSkillSummary } from '@ai-star-eco/types/ip-studio-workflow';
import { USE_MOCK, apiFetch, mockDelay } from '@/ip/api/_client';
import { MOCK_STUDIO_SKILLS, mockCreateSkillDraft } from '@/ip/mocks/studio-dialogue';
import { withStudioBilling } from './studio-billing';

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
/** Read the list again (the server named skills this page did not know about). */
export function reloadStudioSkills(): Promise<StudioSkillSummary[]> {
  cached = undefined;
  return loadStudioSkills();
}

export const activeStudioSkills = (skills: StudioSkillSummary[]) => skills.filter(s => s.status === 'active');

/** A plain sentence for the settings panel, e.g. 「短视频复刻：原片最长 60 秒，最多分 8 段」. */
export function studioSkillNotes(skills: StudioSkillSummary[]): string[] {
  return activeStudioSkills(skills).map(s => {
    const limits = [s.limits.maxSourceSec ? `原片最长 ${s.limits.maxSourceSec} 秒` : '', s.limits.maxSegments ? `最多分 ${s.limits.maxSegments} 段` : ''].filter(Boolean);
    return limits.length ? `${s.name}：${limits.join('，')}` : s.name;
  });
}

/** Badge text for a plan planned with a skill version: 「按技能：短视频复刻 v2」. */
export function studioSkillBadge(skills: StudioSkillSummary[], plan: Pick<StudioPlan, 'skillKey' | 'skillVersion'>): string | undefined {
  if (!plan.skillKey || !plan.skillVersion) return undefined;
  const name = skills.find(s => s.key === plan.skillKey)?.name;
  return name ? `按技能：${name} v${plan.skillVersion}` : `按技能 v${plan.skillVersion}`;
}

/** 400 STUDIO_SKILL_REQUIRED: several skills fit this message; the user has to pick one. */
export function skillRequiredChoices(error: unknown): StudioSkillRequiredDetails['skills'] | undefined {
  if (!(error instanceof ApiError) || error.code !== 'STUDIO_SKILL_REQUIRED') return undefined;
  const list = (error.details as Partial<StudioSkillRequiredDetails> | undefined)?.skills;
  return Array.isArray(list) ? list.filter(s => s && typeof s.key === 'string' && typeof s.name === 'string') : [];
}

const SUMMARY_PREFIX = 'exec-summary-';
/** The execution an assistant message summarizes: the executor posts one completion summary per execution under this key. */
export function completionExecutionId(message: Pick<StudioDialogueMessage, 'role' | 'clientMessageId'>): string | undefined {
  if (message.role !== 'assistant' || !message.clientMessageId?.startsWith(SUMMARY_PREFIX)) return undefined;
  return message.clientMessageId.slice(SUMMARY_PREFIX.length) || undefined;
}

/** Distill a finished execution into a skill draft (operators only). Returns the paid text run; an admin publishes the draft. */
export async function createStudioSkillDraft(projectId: string, request: StudioSkillDraftRequest): Promise<IpRun> {
  if (USE_MOCK) return mockCreateSkillDraft(projectId, request);
  // The payer is chosen once per clientRequestId; a retry of the same request reuses it.
  const body = await withStudioBilling(projectId, { ...request }, { operation: 'text', textUsage: true, expectedCost: request.maxCost });
  return apiFetch<IpRun>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/skill-drafts`, { method: "POST", body });
}

/** output.skillDraft of a finished distill run (the draft that was saved). */
export function skillDraftOutput(run: IpRun | undefined): StudioSkillDraftOutput | undefined {
  const value = (run?.output as { skillDraft?: StudioSkillDraftOutput } | undefined)?.skillDraft;
  return value && typeof value.version === 'number' ? value : undefined;
}
