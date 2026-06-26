/**
 * AppModule
 * ──────────
 * Root NgModule.  Registers every feature module, NgRx slice, and Angular
 * Material component used in the application.
 *
 * Structure:
 *   StoreModule.forRoot({})          — root NgRx store (empty root reducer)
 *   StoreModule.forFeature('stocks') — stocks entity slice
 *   StoreModule.forFeature('ticket') — ticket state slice
 *   EffectsModule.forRoot([...])     — all effects classes
 *   StoreDevtoolsModule              — Redux DevTools browser extension support
 */
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Angular CDK
import { CdkTableModule } from '@angular/cdk/table';

// Angular Material components used
import { MatToolbarModule }    from '@angular/material/toolbar';
import { MatIconModule }       from '@angular/material/icon';
import { MatDialogModule }     from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule }     from '@angular/material/button';

// NgRx
import { StoreModule }        from '@ngrx/store';
import { EffectsModule }      from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';

// Feature reducers
import { stocksReducer }  from './store/stocks/stocks.reducer';
import { ticketReducer }  from './store/ticket/ticket.reducer';

// Effects
import { StocksEffects } from './store/stocks/stocks.effects';
import { OrderEffects }  from './store/stocks/order.effects';

// Components
import { AppComponent }       from './app.component';
import { BlotterComponent }   from './features/blotter/blotter.component';
import { TicketComponent }    from './features/ticket/ticket.component';
import { PriceCellComponent } from './shared/price-cell/price-cell.component';

@NgModule({
  declarations: [
    AppComponent,
    BlotterComponent,
    TicketComponent,
    PriceCellComponent,
  ],

  imports: [
    // Angular core
    BrowserModule,
    BrowserAnimationsModule,   // Required by Angular Material
    HttpClientModule,
    ReactiveFormsModule,
    CommonModule,

    // CDK — gives us CdkTable, CdkVirtualScrollViewport, overlays etc.
    CdkTableModule,

    // Material — used for Toolbar, Dialog, Spinner, Icons
    MatToolbarModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,

    // ── NgRx Store ────────────────────────────────────────────────────────
    // forRoot with empty object — feature slices register themselves below
    StoreModule.forRoot({}),

    // Feature slice: stocks (EntityState + stream status)
    StoreModule.forFeature('stocks', stocksReducer),

    // Feature slice: ticket (which symbol is currently open)
    StoreModule.forFeature('ticket', ticketReducer),

    // ── NgRx Effects ──────────────────────────────────────────────────────
    EffectsModule.forRoot([
      StocksEffects, // WebWorker lifecycle + data ingestion
      OrderEffects,  // Order submission
    ]),

    // ── Redux DevTools ────────────────────────────────────────────────────
    // In production builds this module tree-shakes to nothing.
    // In development, open the Redux DevTools extension to see every action
    // and state snapshot — invaluable for debugging high-frequency streams.
    StoreDevtoolsModule.instrument({
      maxAge: 50,              // Keep last 50 actions (not 25 which is default)
      logOnly: false,          // Allow time-travel debugging in dev
      autoPause: true,         // Pause recording when DevTools window is hidden
    }),
  ],

  // TicketComponent is opened programmatically by MatDialog.open(), not via
  // a selector in a template.  It must be listed here so Angular's compiler
  // knows to include it in the bundle and can instantiate it at runtime.
  // (In Angular 15 this is handled via entryComponents implicitly for dialogs)

  bootstrap: [AppComponent],
})
export class AppModule {}
