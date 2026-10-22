import { apiFetch } from "./_client";
export type GenerationAlert = {
  taskType: string; taskId: string; endpointId: string; createdAt: string;
  status: string; errorCode: string; errorMessage: string | null; logId: string | null;
  modelContext?: string;
};
export type GenerationAlerts = { items: GenerationAlert[]; page: number; total: number; hasMore: boolean };
export function readGenerationAlerts(page = 0): Promise<GenerationAlerts> {
  return apiFetch(`/admin/ai-generation-attention?page=${page}`);
}
