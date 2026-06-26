/**
 * NgRx Actions for the trade ticket overlay.
 *
 * The ticket is essentially a modal state machine:
 *   closed ──openTicket──► open(symbol) ──closeTicket──► closed
 *
 * Keeping ticket state in the store (rather than a local component flag)
 * means the active symbol is deep-linkable and survives hot-module reloads
 * during development.
 */
import { createAction, props } from '@ngrx/store';

/** Open the trade ticket for a specific stock symbol */
export const openTicket = createAction(
  '[Blotter] Open Ticket',
  props<{ symbol: string }>()
);

/** Close the trade ticket and return to blotter-only view */
export const closeTicket = createAction('[Ticket] Close');
