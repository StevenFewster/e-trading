/**
 * Application entry point.
 * Zone.js is required by Angular's change detection mechanism — it patches
 * async APIs (setTimeout, Promise, XHR) so Angular knows when to re-render.
 */
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err));
