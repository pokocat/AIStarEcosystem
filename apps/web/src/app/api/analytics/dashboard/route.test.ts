import { GET } from "@/app/api/analytics/dashboard/route";

describe("GET /api/analytics/dashboard", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, APP_DATA_SOURCE: "mock" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns the normalized mock dashboard payload", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toHaveProperty("data");
    expect(payload.data).toHaveProperty("producerMetrics");
    expect(payload.data).toHaveProperty("distribution");
  });
});
