import { ApiClientError, fetcher } from "@/lib/http/fetcher";

describe("fetcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the data field for successful JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { ok: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    await expect(fetcher<{ ok: boolean }>("/api/demo")).resolves.toEqual({ ok: true });
  });

  it("throws ApiClientError for error payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "BAD_REQUEST", message: "Invalid input" } }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    await expect(fetcher("/api/demo")).rejects.toMatchObject<ApiClientError>({
      name: "ApiClientError",
      status: 400,
      code: "BAD_REQUEST",
      message: "Invalid input"
    });
  });

  it("throws INVALID_RESPONSE when the API omits the data field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    await expect(fetcher("/api/demo")).rejects.toMatchObject<ApiClientError>({
      code: "INVALID_RESPONSE"
    });
  });
});
