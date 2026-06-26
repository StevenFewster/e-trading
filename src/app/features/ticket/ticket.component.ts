/**
 * TicketComponent
 * ───────────────
 * The trade ticket shown when a blotter row is clicked.
 *
 * Responsibilities:
 *   - Display live-ticking price/bid/ask for the selected stock (same NgRx
 *     stream as the blotter, but filtered to one symbol)
 *   - Provide a ReactiveForm with quantity input + buy/sell buttons
 *   - Dispatch submitOrder on form submission
 *   - Dispatch closeTicket when dismissed
 *
 * Why a dialog rather than a sidebar?
 *   Angular Material Dialog (MatDialog) is opened/closed by AppComponent
 *   when it observes changes to selectActiveSymbol.  This keeps the ticket
 *   component itself stateless with respect to its own visibility — it just
 *   renders whatever the store says is active.
 *
 * Data flow:
 *   selectActiveSymbol → switchMap → selectStockBySymbol(symbol) → stock$
 *   This means the ticket's Observable automatically switches to the new
 *   symbol if the user opens a different row without closing first.
 */
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  Inject,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil, switchMap, filter } from 'rxjs/operators';

import { AppState } from '../../store/app.state';
import { Stock, Order } from '../../store/stock.model';
import { selectActiveSymbol } from '../../store/ticket/ticket.selectors';
import { selectStockBySymbol } from '../../store/stocks/stocks.selectors';
import { closeTicket, openTicket } from '../../store/ticket/ticket.actions';
import { submitOrder } from '../../store/stocks/stocks.actions';

/** Data injected into the dialog — just the initial symbol */
export interface TicketDialogData {
  symbol: string;
}

@Component({
  selector: 'app-ticket',
  templateUrl: './ticket.component.html',
  styleUrls: ['./ticket.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketComponent implements OnInit, OnDestroy {
  /**
   * Live stock data Observable.
   * selectStockBySymbol is a parameterised selector — it's re-evaluated
   * whenever the stock's data changes in the NgRx entity store.
   * We don't need to call selectStockBySymbol again on every tick;
   * NgRx memoisation handles that.
   */
  stock$!: Observable<Stock | null>;

  /** The active symbol from the store (drives switchMap) */
  activeSymbol$!: Observable<string | null>;

  /** ReactiveForm for quantity + side selection */
  orderForm!: FormGroup;

  /** Tracks submission state so we can show a spinner / disable buttons */
  submitting = false;

  /** Last submitted order (shown as a confirmation) */
  lastOrder: Order | null = null;

  /** Standard RxJS teardown subject — all subscriptions complete on destroy */
  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<AppState>,
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TicketComponent>,
    // Initial symbol passed from AppComponent when it opens the dialog
    @Inject(MAT_DIALOG_DATA) public data: TicketDialogData
  ) {}

  ngOnInit(): void {
    // ── Build the order form ─────────────────────────────────────────────────
    this.orderForm = this.fb.group({
      /**
       * Quantity must be a positive integer.
       * min(1) and pattern validators provide both UX and business-rule safety.
       */
      quantity: [
        100, // Default to a round lot
        [
          Validators.required,
          Validators.min(1),
          Validators.pattern(/^\d+$/), // Integers only — no fractional shares here
        ],
      ],
    });

    // ── Wire up the live data observable ─────────────────────────────────────
    // selectActiveSymbol emits whenever the store's ticket.activeSymbol changes.
    // switchMap(selectStockBySymbol) re-subscribes to the correct stock selector.
    this.activeSymbol$ = this.store.select(selectActiveSymbol);

    this.stock$ = this.activeSymbol$.pipe(
      filter((symbol): symbol is string => symbol !== null),
      switchMap((symbol) => this.store.select(selectStockBySymbol(symbol))),
      takeUntil(this.destroy$)
    );

    // Close the Angular Material dialog when the store says the ticket is closed
    // (e.g. the user pressed Escape, or closeTicket was dispatched elsewhere)
    this.activeSymbol$.pipe(
      filter((s) => s === null),
      takeUntil(this.destroy$)
    ).subscribe(() => this.dialogRef.close());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Submit a BUY order */
  onBuy(stock: Stock): void {
    this.submitSide('buy', stock);
  }

  /** Submit a SELL order */
  onSell(stock: Stock): void {
    this.submitSide('sell', stock);
  }

  private submitSide(side: 'buy' | 'sell', stock: Stock): void {
    if (this.orderForm.invalid) return;

    const quantity = this.orderForm.value.quantity as number;

    const order: Order = {
      // Use crypto.randomUUID for client-side idempotency key
      id:        crypto.randomUUID(),
      symbol:    stock.symbol,
      side,
      quantity,
      price:     side === 'buy' ? stock.ask : stock.bid, // Market order: buy at ask, sell at bid
      timestamp: Date.now(),
      status:    'pending',
    };

    this.lastOrder = null; // Clear previous confirmation
    this.store.dispatch(submitOrder({ order }));

    // Optimistically show the order as submitted after a short delay
    // (in a real system you'd listen to submitOrderSuccess$ in the effects)
    setTimeout(() => {
      this.lastOrder = { ...order, status: 'filled' };
    }, 300);
  }

  /** Dispatch closeTicket — the store will null the activeSymbol which closes the dialog */
  onClose(): void {
    this.store.dispatch(closeTicket());
  }

  /** Jump to a different stock without closing the ticket */
  onSwitchSymbol(symbol: string): void {
    this.store.dispatch(openTicket({ symbol }));
  }
}
