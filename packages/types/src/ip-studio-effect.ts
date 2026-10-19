/** Published effect descriptions are immutable. Media URLs are derived from owned storage keys. */
export interface StudioVideoEffect {
  id: string;
  name: string;
  summary: string;
  prompt: string;
  author: string;
  visibility: 'personal' | 'official';
  tags: string[];
  /** Empty means a general text instruction, usable with any configured video model. */
  models: string[];
  previewKey?: string | null;
  previewUrl?: string | null;
  favorite: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
}
export interface StudioVideoEffectPublishRequest {
  name: string;
  summary?: string;
  prompt: string;
  tags: string[];
  models: string[];
  visibility: 'personal' | 'official';
  previewKey?: string;
}
