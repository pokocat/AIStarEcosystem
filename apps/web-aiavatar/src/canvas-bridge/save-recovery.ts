import { ApiError } from "@ai-star-eco/api-client";

const DELAYS = [2000, 4000, 8000, 16000, 30000];

/** Reuse the exact document and base version. The server recognizes an already-committed identical PUT. */
export async function saveWithRecovery<T>(send: () => Promise<T>, active: () => boolean): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await send(); }
    catch (error) {
      const transient = error instanceof TypeError || (error instanceof ApiError && [502, 503, 504].includes(error.status ?? 0));
      if (!transient || attempt >= DELAYS.length || !active()) throw error;
      await new Promise<void>(resolve => setTimeout(resolve, DELAYS[attempt]));
      if (!active()) throw error;
    }
  }
}
