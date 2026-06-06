// ─────────────────────────────────────────────────────────────────────────────
// api/mixcut-templates.ts — Admin 「混剪工厂模板」CRUD。
// 对应 AdminMixcutTemplateController；路径前缀 /admin/mixcut/templates/*。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, mockDelay, USE_MOCK } from "./_client";

export type MixcutTier =
  | "trial"
  | "basic"
  | "standard"
  | "professional"
  | "annual_pro"
  | "city_agent";

export type MixcutPerturbationProfile = "light" | "moderate" | "aggressive";

export interface MixcutTemplateMetadata {
  category: string;
  tags: string[];
  thumbnail_url?: string;
  required_tier: MixcutTier;
  cover_video_url?: string;
}

export interface MixcutTemplatePayload {
  template_id: string;
  name: string;
  version: string;
  canvas: Record<string, unknown>;
  scenes: unknown[];
  perturbation_profile: MixcutPerturbationProfile;
  output_variants_default: number;
  quality_gate: Record<string, unknown>;
  metadata: MixcutTemplateMetadata;
}

export interface MixcutTemplate extends MixcutTemplatePayload {
  is_factory?: boolean;
  owner_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

const mockFactoryTemplates: MixcutTemplate[] = [];

export async function listFactoryTemplates(): Promise<MixcutTemplate[]> {
  if (USE_MOCK) return mockDelay(mockFactoryTemplates);
  return apiFetch<MixcutTemplate[]>("/admin/mixcut/templates");
}

export async function getFactoryTemplate(templateId: string): Promise<MixcutTemplate | null> {
  if (USE_MOCK) {
    return mockDelay(mockFactoryTemplates.find((t) => t.template_id === templateId) ?? null);
  }
  return apiFetch<MixcutTemplate | null>(
    `/admin/mixcut/templates/${encodeURIComponent(templateId)}`,
  );
}

export async function createFactoryTemplate(payload: MixcutTemplatePayload): Promise<MixcutTemplate> {
  if (USE_MOCK) {
    const row: MixcutTemplate = {
      ...payload,
      is_factory: true,
      owner_user_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockFactoryTemplates.unshift(row);
    return mockDelay(row);
  }
  return apiFetch<MixcutTemplate>("/admin/mixcut/templates", {
    method: "POST",
    body: payload,
  });
}

export async function updateFactoryTemplate(
  templateId: string,
  payload: MixcutTemplatePayload,
): Promise<MixcutTemplate> {
  if (USE_MOCK) {
    const idx = mockFactoryTemplates.findIndex((t) => t.template_id === templateId);
    const row: MixcutTemplate = {
      ...payload,
      template_id: templateId,
      is_factory: true,
      owner_user_id: null,
      created_at: idx >= 0 ? mockFactoryTemplates[idx].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (idx >= 0) mockFactoryTemplates[idx] = row;
    else mockFactoryTemplates.unshift(row);
    return mockDelay(row);
  }
  return apiFetch<MixcutTemplate>(
    `/admin/mixcut/templates/${encodeURIComponent(templateId)}`,
    {
      method: "PUT",
      body: payload,
    },
  );
}

export async function deleteFactoryTemplate(templateId: string): Promise<boolean> {
  if (USE_MOCK) {
    const idx = mockFactoryTemplates.findIndex((t) => t.template_id === templateId);
    if (idx >= 0) mockFactoryTemplates.splice(idx, 1);
    return mockDelay(idx >= 0);
  }
  return apiFetch<boolean>(`/admin/mixcut/templates/${encodeURIComponent(templateId)}`, {
    method: "DELETE",
  });
}
