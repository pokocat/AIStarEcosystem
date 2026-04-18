import { describe, expect, it, vi, afterEach } from "vitest";
import { ApiError, apiFetch } from "./api";

function mockFetch(response: { status: number; body: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: `HTTP ${response.status}`,
    json: async () => response.body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefixes /api/server and unwraps data envelope", async () => {
    const fetchMock = mockFetch({ status: 200, body: { data: { id: "s-1" } } });
    const result = await apiFetch<{ id: string }>("/singers/s-1");
    expect(result).toEqual({ id: "s-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/server/singers/s-1",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws ApiError with code and message on error envelope", async () => {
    mockFetch({
      status: 400,
      body: { error: { code: "VALIDATION_FAILED", message: "name is required" } },
    });
    await expect(apiFetch("/singers")).rejects.toMatchObject({
      name: "ApiError",
      code: "VALIDATION_FAILED",
      status: 400,
    });
  });

  it("throws ApiError on non-JSON http error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => {
        throw new Error("not json");
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    const err = await apiFetch("/health").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("HTTP_503");
    expect((err as ApiError).status).toBe(503);
  });
});
