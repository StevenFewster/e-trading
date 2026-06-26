/**
 * Root application state interface.
 *
 * Each feature slice is registered in AppModule via StoreModule.forFeature().
 * Listing them here makes the full state shape explicit and gives you
 * type-safe access from any selector without casting.
 */
import { StocksState } from './stocks/stocks.reducer';
import { TicketState } from './ticket/ticket.reducer';

export interface AppState {
  stocks: StocksState;
  ticket: TicketState;
}
