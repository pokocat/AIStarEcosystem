import { getAnalyticsDashboardData } from "@/server/services/analytics-service";

describe("getAnalyticsDashboardData", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses mock data when APP_DATA_SOURCE is unset or mock", async () => {
    process.env.APP_DATA_SOURCE = "mock";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const payload = await getAnalyticsDashboardData();

    expect(payload.producerMetrics.artistCount).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proxies to Spring Boot when APP_DATA_SOURCE is spring", async () => {
    process.env.APP_DATA_SOURCE = "spring";
    process.env.SPRING_BOOT_BASE_URL = "http://spring.example";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              producerMetrics: {
                artistCount: 1,
                totalPlays: 2,
                marketSignings: 3,
                revenueCny: 4,
                newSongs: 5,
                successRate: 6,
                pendingReviews: 7
              },
              coachMetrics: {
                artistCount: 1,
                totalPlays: 2,
                marketSignings: 3,
                revenueCny: 4,
                newSongs: 5,
                successRate: 6,
                pendingReviews: 7
              },
              earningsSeries: [],
              transactions: [],
              marketListings: [],
              coachTrainees: [],
              distribution: { channels: [], accountBindings: [] }
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
    );

    const payload = await getAnalyticsDashboardData();

    expect(payload.producerMetrics.artistCount).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://spring.example/api/analytics/dashboard",
      expect.objectContaining({ cache: "no-store" })
    );
  });
});
