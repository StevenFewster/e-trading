/**
 * AppComponent
 * ─────────────
 * Root component — owns the application shell and the dialog lifecycle.
 *
 * Responsibilities:
 *   1. Dispatch startStream on init to kick off the WebWorker + SSE pipeline
 *   2. Watch selectActiveSymbol in the NgRx store and open/close the Angular
 *      Material Dialog accordingly
 *   3. Dispatch stopStream on destroy (browser tab close) for clean teardown
 *
 * Why manage the dialog here rather than in BlotterComponent?
 *   The dialog is a global concern — it could be triggered from anywhere
 *   (deep-link URL, keyboard shortcut, etc.).  AppComponent is the natural
 *   host for app-level side-effects that the NgRx store drives.
 */
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { Subject, interval } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';

import { AppState } from './store/app.state';
import { startStream, stopStream } from './store/stocks/stocks.actions';
import { selectActiveSymbol } from './store/ticket/ticket.selectors';
import { TicketComponent, TicketDialogData } from './features/ticket/ticket.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  /** Reference to the currently open ticket dialog, if any */
  private ticketDialogRef: MatDialogRef<TicketComponent> | null = null;

  /** Current time — updated every second for the toolbar clock display */
  now = new Date();

  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<AppState>,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // ── 0. Tick the toolbar clock every second ────────────────────────────────
    // We use interval() from RxJS rather than setInterval() so it integrates
    // cleanly with takeUntil(destroy$) for automatic teardown on destroy.
    // markForCheck() is needed because this component uses OnPush CD.
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.now = new Date();
      this.cdr.markForCheck();
    });

    // ── 1. Start the data stream ──────────────────────────────────────────────
    // This triggers StocksEffects.startStream$ which spawns the WebWorker.
    this.store.dispatch(startStream());

    // ── 2. React to ticket open/close via the store ───────────────────────────
    // distinctUntilChanged prevents re-opening the dialog if the same symbol
    // is dispatched twice (e.g. user clicks the same row twice quickly).
    this.store.select(selectActiveSymbol).pipe(
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe((symbol) => {
      if (symbol !== null) {
        this.openTicketDialog(symbol);
      } else {
        this.closeTicketDialog();
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up the WebWorker and SSE connection on application teardown
    this.store.dispatch(stopStream());
    this.destroy$.next();
    this.destroy$.complete();
  }

  private openTicketDialog(symbol: string): void {
    // If a dialog is already open (e.g. user clicked a different row),
    // close it first so we don't stack dialogs
    if (this.ticketDialogRef) {
      this.ticketDialogRef.close();
    }

    this.ticketDialogRef = this.dialog.open<TicketComponent, TicketDialogData>(
      TicketComponent,
      {
        data: { symbol },
        // Custom CSS class defined in styles.scss to apply our dark theme
        panelClass: 'ticket-dialog-panel',
        width: '420px',
        // Prevent closing by clicking the backdrop — user must use the ✕ button
        // or the keyboard Escape (which dispatches closeTicket via the component)
        disableClose: false,
        position: { right: '24px', top: '80px' },
        hasBackdrop: true,
        backdropClass: 'ticket-backdrop',
      }
    );

    // If the user closes the dialog via Escape or backdrop click,
    // sync that back to the NgRx store
    this.ticketDialogRef.afterClosed().pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.ticketDialogRef = null;
    });
  }

  private closeTicketDialog(): void {
    if (this.ticketDialogRef) {
      this.ticketDialogRef.close();
      this.ticketDialogRef = null;
    }
  }
}
