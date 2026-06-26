/**
 * BlotterComponent
 * ─────────────────
 * The main market data table, rendered with Angular CDK's CdkTable.
 *
 * Why CDK table instead of MatTable?
 *   MatTable builds on CdkTable and adds Material styling.  We use CdkTable
 *   directly here to show the underlying mechanism — it's pure headless logic
 *   with no opinion about styling, which suits a custom trading UI.
 *
 * Data flow:
 *   NgRx store (selectAllStocks) → Observable<Stock[]>
 *   → template via async pipe (auto-subscribes, auto-unsubscribes)
 *   → CdkTable renders one row per stock
 *   → PriceCellComponent handles the flash animation per cell
 *
 * Performance:
 *   - OnPush change detection: Angular only checks this component when the
 *     Observable reference changes (which NgRx signals via distinctUntilChanged)
 *   - CdkTable with trackBy: DOM rows are only created/destroyed when the
 *     symbol set changes, not on every price tick
 *   - The Observable itself is throttled at 100ms by the WebWorker
 *
 * Row click → openTicket action → TicketComponent dialog opens
 */
import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';

import { AppState } from '../../store/app.state';
import { Stock } from '../../store/stock.model';
import {
  selectAllStocks,
  selectStreamConnected,
  selectStreamLoading,
  selectStreamError,
} from '../../store/stocks/stocks.selectors';
import { openTicket } from '../../store/ticket/ticket.actions';

@Component({
  selector: 'app-blotter',
  templateUrl: './blotter.component.html',
  styleUrls: ['./blotter.component.scss'],
  // OnPush is critical — without it, 100ms updates would trigger full-app CD cycles
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlotterComponent implements OnInit {
  /** Columns to display and their order — must match cdkColumnDef names in the template */
  readonly displayedColumns = [
    'symbol', 'name', 'price', 'bid', 'ask', 'spread',
    'change', 'changePercent', 'high', 'low', 'volume',
  ];

  /** Live sorted stock list from NgRx store */
  stocks$!: Observable<Stock[]>;

  /** Status observables for the header bar */
  connected$!: Observable<boolean>;
  loading$!: Observable<boolean>;
  error$!: Observable<string | null>;

  constructor(private store: Store<AppState>) {}

  ngOnInit(): void {
    this.stocks$    = this.store.select(selectAllStocks);
    this.connected$ = this.store.select(selectStreamConnected);
    this.loading$   = this.store.select(selectStreamLoading);
    this.error$     = this.store.select(selectStreamError);
  }

  /**
   * CdkTable trackBy function.
   * Returning the symbol means CDK reuses existing DOM rows on price ticks
   * (only re-renders changed cells) rather than tearing down and rebuilding
   * the entire row.  Essential for smooth rendering at 10 fps.
   */
  trackBySymbol(_index: number, stock: Stock): string {
    return stock.symbol;
  }

  /**
   * Row click handler — dispatches openTicket which triggers the dialog.
   * Keeping the action dispatch in the component (not the template) means
   * the logic is testable: just call this method and assert the dispatched action.
   */
  onRowClick(stock: Stock): void {
    this.store.dispatch(openTicket({ symbol: stock.symbol }));
  }

  /** Format large volume numbers as '1.23M' for readability in the table */
  formatVolume(volume: number): string {
    if (volume >= 1_000_000) {
      return (volume / 1_000_000).toFixed(2) + 'M';
    }
    if (volume >= 1_000) {
      return (volume / 1_000).toFixed(1) + 'K';
    }
    return volume.toString();
  }
}
