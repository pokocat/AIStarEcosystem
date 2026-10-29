import { describe, expect, test, vi } from "vitest";
import { ApiError } from "@ai-star-eco/api-client";

vi.mock("./_client", async importOriginal => ({ ...await importOriginal<typeof import("./_client")>(), apiFetch: vi.fn(), USE_MOCK: false }));

import { apiFetch } from "./_client";
import { goneWorkId, isStaleGone, restoreWork, scopeToWork } from "./director";

/** 作品级 404 按「恢复代次」归属（2026-10-29 独立复核）。每个用例用自己的作品 id，模块里的代次互不影响。 */
describe("restore generation of work-scoped 404s", () => {
  const notFound = () => new ApiError({ code: "DIRECTOR_WORK_NOT_FOUND", message: "作品不存在" }, 404);
  const deferred = <T,>() => { let reject!: (e: unknown) => void; const promise = new Promise<T>((_r, j) => { reject = j; }); return { promise, reject }; };
  const caught = (p: Promise<unknown>) => p.then(() => { throw new Error("expected a rejection"); }, (e: unknown) => e);

  test("a request sent before a newly seen restoredAt is stale; one sent after is current", async () => {
    const old = deferred<unknown>();
    const oldCall = caught(scopeToWork("e1", old.promise));
    await scopeToWork("e1", Promise.resolve({ id: "e1", restoredAt: "2026-10-29T04:00:00Z" }));
    const fresh = caught(scopeToWork("e1", Promise.reject(notFound())));
    old.reject(notFound());
    const [oldError, freshError] = await Promise.all([oldCall, fresh]);
    expect(goneWorkId(oldError)).toBeNull();
    expect(isStaleGone(oldError)).toBe(true);
    expect(goneWorkId(freshError)).toBe("e1");
    expect(isStaleGone(freshError)).toBe(false);
  });

  test("seeing the same restoredAt again, a null one, or another work's restore does not advance the generation", async () => {
    await scopeToWork("e2", Promise.resolve({ id: "e2", restoredAt: "2026-10-29T04:00:00Z" }));
    const pending = deferred<unknown>();
    const call = caught(scopeToWork("e2", pending.promise));
    await scopeToWork("e2", Promise.resolve({ id: "e2", restoredAt: "2026-10-29T04:00:00Z" })); // 同一次恢复
    await scopeToWork("e2", Promise.resolve({ id: "e2", restoredAt: null }));                    // 删除前发出的旧读取迟到
    await scopeToWork("e3", Promise.resolve({ id: "e3", restoredAt: "2026-10-29T05:00:00Z" }));  // 别的作品
    pending.reject(notFound());
    expect(goneWorkId(await call)).toBe("e2");
  });

  test("a successful restore in this page makes requests sent before it stale", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: "e4", restored: true });
    const old = deferred<unknown>();
    const oldCall = caught(scopeToWork("e4", old.promise));
    await restoreWork("e4");
    old.reject(notFound());
    expect(goneWorkId(await oldCall)).toBeNull();
    const after = await caught(scopeToWork("e4", Promise.reject(notFound())));
    expect(goneWorkId(after)).toBe("e4");
  });

  test("other errors are never tagged", async () => {
    const e = await caught(scopeToWork("e5", Promise.reject(new ApiError({ code: "DIRECTOR_WORK_BUSY", message: "忙" }, 409))));
    expect(goneWorkId(e)).toBeNull();
    expect(isStaleGone(e)).toBe(false);
  });
});
