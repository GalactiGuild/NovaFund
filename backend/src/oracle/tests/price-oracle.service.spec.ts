import { PriceOracleService } from "../price-oracle.service";

describe("PriceOracleService", () => {
  const service = new PriceOracleService();

  it("should fetch and calculate median price", async () => {
    const price = await service.fetchPrice("XLM");
    expect(typeof price).toBe("number");
    expect(price).toBeGreaterThan(0);
  });

  it("should handle no sources gracefully", async () => {
    const price = await service.fetchPrice("FAKE");
    expect(price === null || typeof price === "number").toBe(true);
  });
});
