/**
 * NgRx Actions for the stocks feature.
 *
 * Action naming convention: '[Source] Event'
 *   - Source is the actor (component, effect, worker)
 *   - Event is past-tense to describe what just happened
 *
 * Keeping stream lifecycle actions separate from data actions makes it easy
 * to trace the app's state machine in Redux DevTools.
 */
import { createAction, props } from '@ngrx/store';
import { Stock, StockUpdate, Order } from '../stock.model';

// ─── Stream lifecycle ────────────────────────────────────────────────────────

/** Dispatched by AppComponent on init to spin up the WebWorker + SSE */
export const startStream = createAction('[Stream] Start');

/** Dispatched when the WebWorker reports the SSE connection is open */
export const streamConnected = createAction('[Stream] Connected');

/** Dispatched if the WebWorker reports an unrecoverable SSE error */
export const streamError = createAction(
  '[Stream] Error',
  props<{ error: string }>()
);

/** Dispatched on application teardown (ngOnDestroy) */
export const stopStream = createAction('[Stream] Stop');

// ─── Stock data ──────────────────────────────────────────────────────────────

/**
 * Carries the initial stock catalogue.
 * Dispatched once during the startStream$ effect, before any tick data
 * arrives, so the blotter is pre-populated with skeleton rows.
 */
export const loadStocksSuccess = createAction(
  '[Stocks API] Load Success',
  props<{ stocks: Stock[] }>()
);

/**
 * The main hot path.
 * The WebWorker batches all price changes that occurred during a 100ms
 * window and posts them as a single array.  We dispatch one action for
 * the whole batch, which triggers a single reducer call and a single
 * change-detection cycle — far cheaper than one action per tick.
 */
export const batchUpdateStocks = createAction(
  '[Worker] Batch Update',
  props<{ updates: StockUpdate[] }>()
);

// ─── Orders ─────────────────────────────────────────────────────────────────

export const submitOrder = createAction(
  '[Ticket] Submit Order',
  props<{ order: Order }>()
);

export const submitOrderSuccess = createAction(
  '[Orders API] Submit Success',
  props<{ order: Order }>()
);

export const submitOrderFailure = createAction(
  '[Orders API] Submit Failure',
  props<{ error: string }>()
);
