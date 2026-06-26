/**
 * NgRx Selectors for the ticket feature.
 *
 * The ticket state is simple (just activeSymbol) so the selector file is
 * correspondingly lean.  The heavy lifting (looking up live stock data for
 * the active symbol) is done in TicketComponent itself via a switchMap so
 * that the component's Observable automatically tracks symbol changes.
 */
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { TicketState } from './ticket.reducer';

export const selectTicketState =
  createFeatureSelector<TicketState>('ticket');

/** The symbol currently open in the ticket, or null when the ticket is closed */
export const selectActiveSymbol = createSelector(
  selectTicketState,
  (s) => s.activeSymbol
);

/** True when the ticket panel should be visible */
export const selectTicketOpen = createSelector(
  selectActiveSymbol,
  (symbol) => symbol !== null
);

/**
 * Re-export selectStockBySymbol so TicketComponent only needs to import
 * from this file rather than reaching into the stocks selectors directly.
 * This keeps the ticket feature self-contained.
 */
export { selectStockBySymbol } from '../stocks/stocks.selectors';
