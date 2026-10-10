/** Shared by endpoint read/write contracts. Omitted on update preserves the policy; 0 clears it. */
export interface AiModelConcurrencyConfig {
  concurrencyLimit?: number | null;
}

/** Live endpoint queue snapshot. Position is 1-based among waiting tasks, excluding running tasks. */
export interface AiGenerationQueuePosition {
  position: number;
  waiting: number;
  running: number;
  concurrencyLimit: number | null;
}
