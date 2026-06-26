/**
 * NgRx Effects for the stocks feature.
 *
 * Effects are the right place for side-effects that interact with the
 * outside world (WebWorker, HTTP, WebSocket).  They listen to the action
 * stream, perform async work, and dispatch new actions as results.
 *
 * This effect owns the WebWorker lifecycle:
 *   startStream action → spawn worker → listen to postMessage events
 *                      → dispatch batchUpdateStocks (hot path)
 *   stopStream action → terminate worker
 *
 * Worker messages are converted to Observables via fromEvent(), which
 * makes them composable with the rest of the RxJS pipeline.
 */
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { fromEvent, merge, of } from 'rxjs';
import {
  switchMap,
  map,
  takeUntil,
  catchError,
  tap,
} from 'rxjs/operators';

import {
  startStream,
  stopStream,
  streamConnected,
  streamError,
  batchUpdateStocks,
  loadStocksSuccess,
} from './stocks.actions';
import { STOCK_SEEDS } from '../../services/stock-seeds';
import { Stock } from '../stock.model';

/** Shape of messages posted FROM the worker TO the main thread */
interface WorkerMessage {
  type: 'CONNECTED' | 'UPDATE' | 'ERROR';
  stocks?: StockUpdatePayload[];
  error?: string;
}

interface StockUpdatePayload {
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

@Injectable()
export class StocksEffects {
  /**
   * Hold a reference to the running worker so we can terminate it.
   * null when the stream is not active.
   */
  private worker: Worker | null = null;

  constructor(private actions$: Actions) {}

  /**
   * startStream$ effect
   * ────────────────────
   * On startStream:
   *   1. Build the initial stock skeleton list from seed data
   *   2. Spawn the WebWorker
   *   3. Convert worker MessageEvents to NgRx actions via fromEvent
   *   4. Merge seed action (loadStocksSuccess) with the live update stream
   *   5. Tear everything down when stopStream is dispatched
   *
   * switchMap cancels any previous inner subscription if startStream is
   * dispatched again (reconnect scenario).
   */
  startStream$ = createEffect(() =>
    this.actions$.pipe(
      ofType(startStream),

      switchMap(() => {
        // ── Step 1: build skeleton stock list from seed data ─────────────────
        // This populates the blotter immediately, before the first tick arrives.
        const initialStocks: Stock[] = STOCK_SEEDS.map((seed) => ({
          symbol:         seed.symbol,
          name:           seed.name,
          price:          seed.basePrice,
          bid:            parseFloat((seed.basePrice * 0.9998).toFixed(2)),
          ask:            parseFloat((seed.basePrice * 1.0002).toFixed(2)),
          spread:         2,
          volume:         0,
          change:         0,
          changePercent:  0,
          high:           seed.basePrice,
          low:            seed.basePrice,
          priceDirection: 'flat' as const,
          lastUpdated:    Date.now(),
        }));

        // ── Step 2: spawn the Web Worker ─────────────────────────────────────
        // Angular's build toolchain detects this new URL(...) pattern and
        // bundles the worker file as a separate JS chunk automatically.
        this.worker = new Worker(
          new URL('../../workers/stock-processor.worker', import.meta.url),
          { type: 'module' }
        );

        // Tell the worker to connect to the SSE endpoint
        this.worker.postMessage({ type: 'START', url: '/api/v1/data/stream' });

        // ── Step 3: convert worker messages to NgRx actions ──────────────────
        // fromEvent wraps the worker's 'message' event as an Observable.
        // This is the standard RxJS way to treat event emitters as streams.
        const workerActions$ = fromEvent<MessageEvent<WorkerMessage>>(
          this.worker,
          'message'
        ).pipe(
          map((event) => {
            switch (event.data.type) {
              case 'CONNECTED':
                return streamConnected();

              case 'UPDATE':
                // Hot path — called every THROTTLE_MS (100ms) from the worker.
                // The updates array contains one entry per symbol with its
                // latest price during the last 100ms window.
                return batchUpdateStocks({ updates: event.data.stocks ?? [] });

              case 'ERROR':
                return streamError({ error: event.data.error ?? 'Unknown worker error' });
            }
          }),

          catchError((err: unknown) => {
            console.error('[StocksEffects] Worker message error:', err);
            return of(streamError({ error: String(err) }));
          }),

          // Unsubscribe when stopStream arrives, then kill the worker
          takeUntil(
            this.actions$.pipe(
              ofType(stopStream),
              tap(() => this.terminateWorker())
            )
          )
        );

        // ── Step 4: merge seed action with the live stream ───────────────────
        // merge() subscribes to both observables concurrently.
        // of(loadStocksSuccess(...)) completes immediately after one emission;
        // workerActions$ keeps running until stopStream is dispatched.
        return merge(
          of(loadStocksSuccess({ stocks: initialStocks })),
          workerActions$
        );
      })
    )
  );

  /** Cleanly shuts down the worker */
  private terminateWorker(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'STOP' });
      // Small delay so the worker can clear its intervals before termination
      setTimeout(() => {
        this.worker?.terminate();
        this.worker = null;
      }, 50);
    }
  }
}
