/**
 * Shared seed data used by:
 *   - StocksEffects: to pre-populate the NgRx store before the first tick
 *   - stock-processor.worker.ts: as base prices for the random walk generator
 *
 * Kept in a separate file (not the worker) so the main bundle and the worker
 * chunk share the same source of truth without circular imports.
 */
import { StockSeed } from '../store/stock.model';

export const STOCK_SEEDS: StockSeed[] = [
  { symbol: 'AAPL',  name: 'Apple Inc.',        basePrice: 189.50 },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',   basePrice: 185.60 },
  { symbol: 'BAC',   name: 'Bank of America',   basePrice:  38.45 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.',      basePrice: 141.80 },
  { symbol: 'GS',    name: 'Goldman Sachs',      basePrice: 489.70 },
  { symbol: 'JPM',   name: 'JPMorgan Chase',     basePrice: 201.30 },
  { symbol: 'META',  name: 'Meta Platforms',     basePrice: 530.10 },
  { symbol: 'MSFT',  name: 'Microsoft Corp.',    basePrice: 415.20 },
  { symbol: 'NVDA',  name: 'NVIDIA Corp.',       basePrice: 875.40 },
  { symbol: 'TSLA',  name: 'Tesla Inc.',         basePrice: 248.90 },
];
