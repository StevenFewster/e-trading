/**
 * OrderService
 * ─────────────
 * Submits trade orders to the back-end REST API.
 *
 * In a real e-trading system this would go via an OMS (Order Management
 * System) endpoint and use FIX protocol under the hood.  Here we POST to
 * a fictional REST endpoint and simulate network latency so the async
 * patterns are realistic for review purposes.
 *
 * The service is kept deliberately thin — all state lives in NgRx.
 * Components never call this directly; instead the submitOrder$ Effect does.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Order } from '../store/stock.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  /** Base URL — overridden by environment files for prod */
  private readonly apiBase = '/api/v1/orders';

  constructor(private http: HttpClient) {}

  /**
   * Submit a buy or sell order.
   *
   * In dev / demo mode (when the real endpoint is unavailable) we return
   * a mock Observable that resolves after a simulated 200ms round-trip.
   *
   * In production, swap the mock$ body for:
   *   return this.http.post<Order>(this.apiBase, order);
   */
  submit(order: Order): Observable<Order> {
    // ── Mock implementation (demo / interview) ───────────────────────────────
    // Randomly reject ~5% of orders to demonstrate error handling
    const willReject = Math.random() < 0.05;

    const mock$ = of(
      willReject
        ? { ...order, status: 'rejected' as const }
        : { ...order, status: 'filled' as const }
    ).pipe(
      delay(150 + Math.random() * 200) // Simulate 150–350ms latency
    );

    return mock$;

    // ── Real implementation (uncomment for production) ───────────────────────
    // return this.http.post<Order>(this.apiBase, order);
  }
}
