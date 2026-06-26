/**
 * NgRx Reducer for the trade ticket feature slice.
 *
 * Simple two-state machine: the ticket is either closed (symbol = null)
 * or open for a specific symbol.
 */
import { createReducer, on } from '@ngrx/store';
import { openTicket, closeTicket } from './ticket.actions';

export interface TicketState {
  /** Symbol currently shown in the ticket, or null when closed */
  activeSymbol: string | null;
}

const initialState: TicketState = {
  activeSymbol: null,
};

export const ticketReducer = createReducer(
  initialState,

  // Store the clicked symbol — the TicketComponent reacts to this selector
  on(openTicket, (state, { symbol }) => ({
    ...state,
    activeSymbol: symbol,
  })),

  // Clear the active symbol — Angular Material Dialog will close
  on(closeTicket, (state) => ({
    ...state,
    activeSymbol: null,
  }))
);
