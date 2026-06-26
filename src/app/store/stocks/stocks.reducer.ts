/**
 * NgRx Reducer for the stocks feature slice.
 *
 * We use @ngrx/entity's EntityAdapter which provides:
 *  - O(1) upsert / update by primary key (symbol)
 *  - A normalised { ids[], entities{} } shape — much faster than searching
 *    an array on every tick when you have hundreds of instruments
 *
 * PERFORMANCE NOTE:
 *   batchUpdateStocks loops over the incoming updates and calls
 *   adapter.updateOne() for each.  NgRx Entity uses shallow reference
 *   equality so only the changed stock objects are replaced, keeping
 *   selector memoisation effective.
 */
import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Stock } from '../stock.model';
import {
  batchUpdateStocks,
  loadStocksSuccess,
  streamConnected,
  streamError,
  startStream,
} from './stocks.actions';

// ─── State shape ─────────────────────────────────────────────────────────────

export interface StocksState extends EntityState<Stock> {
  /** True once the WebWorker has signalled SSE is open */
  connected: boolean;

  /** Non-null when an unrecoverable stream error occurred */
  error: string | null;

  /** True while we're waiting for the first connection */
  loading: boolean;
}

// ─── Entity adapter ───────────────────────────────────────────────────────────

/**
 * selectId tells the adapter which field to use as the primary key.
 * sortComparer keeps the entity list alphabetically ordered by symbol
 * so the blotter rows are stable and don't re-order during ticks.
 */
export const stocksAdapter: EntityAdapter<Stock> = createEntityAdapter<Stock>({
  selectId: (stock) => stock.symbol,
  sortComparer: (a, b) => a.symbol.localeCompare(b.symbol),
});

// ─── Initial state ────────────────────────────────────────────────────────────

export const initialState: StocksState = stocksAdapter.getInitialState({
  connected: false,
  error: null,
  loading: false,
});

// ─── Reducer ──────────────────────────────────────────────────────────────────

export const stocksReducer = createReducer(
  initialState,

  // Stream kicked off — show a connecting indicator
  on(startStream, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  // SSE handshake confirmed
  on(streamConnected, (state) => ({
    ...state,
    connected: true,
    loading: false,
  })),

  // Pre-populate the entity collection from the seed list
  on(loadStocksSuccess, (state, { stocks }) =>
    stocksAdapter.setAll(stocks, state)
  ),

  /**
   * Hot path: called every THROTTLE_MS (100ms) by the stream effect.
   *
   * For each update in the batch we:
   *   1. Derive priceDirection by comparing new price to stored price
   *   2. Call adapter.updateOne() to replace only changed fields
   *
   * Immutability is preserved because updateOne returns a new object
   * for any stock that actually changed; unchanged stocks keep the same
   * reference, so memoised selectors won't re-emit for them.
   */
  on(batchUpdateStocks, (state, { updates }) => {
    let nextState = state;

    for (const update of updates) {
      const existing = state.entities[update.symbol];
      if (!existing) continue; // Safety guard for unknown symbols

      // Determine price movement direction for the flash animation
      const priceDirection: 'up' | 'down' | 'flat' =
        update.price > existing.price
          ? 'up'
          : update.price < existing.price
          ? 'down'
          : 'flat';

      nextState = stocksAdapter.updateOne(
        {
          id: update.symbol,
          changes: {
            price: update.price,
            bid: update.bid,
            ask: update.ask,
            spread: parseFloat(((update.ask - update.bid) / update.bid * 10000).toFixed(1)),
            volume: update.volume,
            change: update.change,
            changePercent: update.changePercent,
            high: update.high,
            low: update.low,
            priceDirection,
            lastUpdated: update.timestamp,
          },
        },
        nextState
      );
    }

    return nextState;
  }),

  on(streamError, (state, { error }) => ({
    ...state,
    connected: false,
    loading: false,
    error,
  }))
);
