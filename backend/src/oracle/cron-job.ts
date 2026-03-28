import cron from "node-cron";
import { PriceOracleService } from "./price-oracle.service";

const oracle = new PriceOracleService();

// Run every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  console.log("Fetching prices...");
  await oracle.fetchPrice("XLM");
  await oracle.fetchPrice("USDC");
  await oracle.fetchPrice("USDT");
});
