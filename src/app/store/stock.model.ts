/**
 * Domain models for the trading blotter.
 *
 * These interfaces deliberately mirror what you'd receive from a real
 * FIX/FAST market-data feed after normalisation, so the shapes are
 * immediately recognisable in an interview context.
 */

/**
 * Full stock record held in the NgRx EntityState.
 * Fields that don't change between ticks (symbol, name) live here
 * alongside the mutable market-data fields.
 */
export interface Stock {
  /** Primary key used by NgRx Entity adapter */
  symbol: string;

  /** Human-readable company name */
  name: string;

  /** Last traded price */
  price: number;

  /** Best bid (highest price a buyer will pay) */
  bid: number;

  /** Best ask (lowest price a seller will accept) */
  ask: number;

  /** Bid-ask spread in basis points (derived: (ask-bid)/bid*10000) */
  spread: number;

  /** Cumulative day volume (shares traded) */
  volume: number;

  /** Absolute change vs previous close */
  change: number;

  /** Percentage change vs previous close */
  changePercent: number;

  /** Intraday high */
  high: number;

  /** Intraday low */
  low: number;

  /**
   * Direction of the most recent price move.
   * Drives the CSS flash animation in PriceCellComponent.
   * 'flat' is the initial state before any tick arrives.
   */
  priceDirection: 'up' | 'down' | 'flat';

  /** Unix epoch ms of last update — useful for debugging stream lag */
  lastUpdated: number;
}

/**
 * Lightweight payload sent from the WebWorker to the main thread every
 * THROTTLE_MS milliseconds.  Only mutable fields are included; static
 * fields (name) never need to travel over the postMessage channel.
 */
export interface StockUpdate {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: number;
}

/**
 * Seed data for the initial stock list.
 * The WebWorker uses these base prices to generate realistic random walks.
 */
export interface StockSeed {
  symbol: string;
  name: string;
  basePrice: number;
}

/**
 * An order submitted by the user via the Ticket component.
 */
export interface Order {
  id: string;            // Client-generated UUID
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;         // Price at time of submission (for audit)
  timestamp: number;
  status: 'pending' | 'filled' | 'rejected';
}
