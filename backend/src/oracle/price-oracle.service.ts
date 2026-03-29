import axios from "axios";
import { savePrice } from "./price-oracle.repository";

export class PriceOracleService {
  private sources = [
    { name: "binance", url: "https://api.binance.com/api/v3/ticker/price?symbol=" },
    { name: "kraken", url: "https://api.kraken.com/0/public/Ticker?pair=" },
    { name: "coinbase", url: "https://api.coinbase.com/v2/prices/" },
  ];

  async fetchPrice(symbol: string): Promise<number | null> {
    const prices: number[] = [];

    for (const source of this.sources) {
      try {
        let price: number | null = null;

        if (source.name === "binance") {
          const res = await axios.get(`${source.url}${symbol}USDT`);
          price = parseFloat(res.data.price);
        } else if (source.name === "kraken") {
          const res = await axios.get(`${source.url}${symbol}USD`);
          const key = Object.keys(res.data.result)[0];
          price = parseFloat(res.data.result[key].c[0]);
        } else if (source.name === "coinbase") {
          const res = await axios.get(`${source.url}${symbol}-USD/spot`);
          price = parseFloat(res.data.data.amount);
        }

        if (price) prices.push(price);
      } catch (err) {
        console.error(`Error fetching ${symbol} from ${source.name}`, err.message);
      }
    }

    if (prices.length === 0) return null;

    // Median calculation
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const median =
      prices.length % 2 !== 0
        ? prices[mid]
        : (prices[mid - 1] + prices[mid]) / 2;

    await savePrice(symbol, median);
    return median;
  }
}
