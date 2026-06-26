/**
 * NgRx Effect for order submission.
 *
 * Separated from StocksEffects to keep file sizes manageable and to
 * demonstrate the NgRx convention of one Effect class per concern.
 *
 * Flow:
 *   submitOrder → OrderService.submit() → submitOrderSuccess | submitOrderFailure
 */
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { submitOrder, submitOrderSuccess, submitOrderFailure } from './stocks.actions';
import { OrderService } from '../../services/order.service';

@Injectable()
export class OrderEffects {
  constructor(
    private actions$: Actions,
    private orderService: OrderService
  ) {}

  /**
   * submitOrder$ effect
   * ────────────────────
   * switchMap cancels any in-flight order request if the user resubmits —
   * in practice you'd want exhaustMap here to prevent double-clicks, but
   * switchMap illustrates the RxJS operator more clearly for review.
   *
   * In a real OMS you'd use concatMap to serialise orders.
   */
  submitOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(submitOrder),
      switchMap(({ order }) =>
        this.orderService.submit(order).pipe(
          map((filledOrder) => submitOrderSuccess({ order: filledOrder })),
          catchError((err: unknown) =>
            of(submitOrderFailure({ error: String(err) }))
          )
        )
      )
    )
  );
}
