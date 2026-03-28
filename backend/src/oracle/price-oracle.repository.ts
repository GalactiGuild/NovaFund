import { AppDataSource } from "../data-source";
import { PriceRecord } from "../entities/price-record.entity";

export const priceRepo = AppDataSource.getRepository(PriceRecord);

export async function savePrice(symbol: string, median: number) {
  const record = new PriceRecord();
  record.symbol = symbol;
  record.price = median;
  record.timestamp = new Date();
  return priceRepo.save(record);
}
