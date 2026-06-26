/**
 * NgRx Selectors for the stocks feature.
 *
 * Selectors are pure, memoised functions.  NgRx re-runs them only when
 * their input slice actually changes — critical at 1000 ticks/second
 * because we must avoid unnecessary template re-renders.
 *
 * Composition pattern:
 *   createFeatureSelector → slice of AppState
 *   createSelector(featureSelector, projector) → derived value
 */
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { StocksState, stocksAdapter } from './stocks.reducer';

// Top-level slice selector
export const selectStocksState =
  createFeatureSelector<StocksState>('stocks');

// Extract NgRx Entity adapter's built-in selectors (selectAll, selectEntities…)
const { selectAll, selectEntities, selectTotal } =
  stocksAdapter.getSelectors(selectStocksState);

/** Sorted array of all stocks — used as the CDK table data source */
export const selectAllStocks = selectAll;

/** Entity map keyed by symbol — used for O(1) single-stock lookup */
export const selectStockEntities = selectEntities;

/** Total number of instruments in the blotter */
export const selectStockCount = selectTotal;

/** True while waiting for the initial SSE connection */
export const selectStreamLoading = createSelector(
  selectStocksState,
  (s) => s.loading
);

/** True once SSE is connected and data is flowing */
export const selectStreamConnected = createSelector(
  selectStocksState,
  (s) => s.connected
);

/** Stream error message, or null */
export const selectStreamError = createSelector(
  selectStocksState,
  (s) => s.error
);

/**
 * Parameterised selector — returns a single stock by symbol.
 * Usage in component:
 *   this.store.select(selectStockBySymbol('AAPL'))
 */
export const selectStockBySymbol = (symbol: string) =>
  createSelector(
    selectStockEntities,
    (entities) => entities[symbol] ?? null
  );
