import { afterEach, expect, test, vi } from "vitest";
import { ApiError } from "@ai-star-eco/api-client";
import { saveWithRecovery } from "./save-recovery";

afterEach(() => vi.useRealTimers());
const gateway = () => new ApiError({ code: "HTTP_ERROR", message: "unavailable" }, 502);
test("a 50-second restart is bridged with bounded backoff and the original save", async () => {
  vi.useFakeTimers(); const start = Date.now();
  const send = vi.fn(async () => { if (Date.now() - start < 50_000) throw gateway(); return { docVersion: "saved" }; });
  const saving = saveWithRecovery(send, () => true);
  await vi.advanceTimersByTimeAsync(60_000);
  await expect(saving).resolves.toEqual({ docVersion: "saved" });
  expect(send).toHaveBeenCalledTimes(6);
});
test.each([401, 403, 409, 400])("business refusal %i is never retried", async status => {
  const failure = new ApiError({ code: "IP_PROJECT_STALE", message: "refused" }, status);
  const send = vi.fn().mockRejectedValue(failure);
  await expect(saveWithRecovery(send, () => true)).rejects.toBe(failure);
  expect(send).toHaveBeenCalledTimes(1);
});
test("leaving a project stops delayed attempts", async () => {
  vi.useFakeTimers(); let active = true; const failure = gateway();
  const send = vi.fn().mockRejectedValue(failure);
  const result = saveWithRecovery(send, () => active).catch(error => error);
  await vi.advanceTimersByTimeAsync(1000); active = false;
  await vi.advanceTimersByTimeAsync(1000);
  expect(await result).toBe(failure); expect(send).toHaveBeenCalledTimes(1);
});
