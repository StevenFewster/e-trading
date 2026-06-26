/**
 * PriceCellComponent
 * ───────────────────
 * A dumb/presentational component that displays a price figure and flashes
 * green (up) or red (down) whenever the direction input changes.
 *
 * WHY a separate component?
 *   - Isolates the flash animation logic so the blotter table doesn't need
 *     to track previous values or trigger class changes itself.
 *   - Uses OnPush change detection — Angular only checks this component when
 *     its @Input() references change, not on every global CD cycle.
 *     At 10 updates/second across 10 stocks this saves significant CPU.
 *
 * Animation technique:
 *   We apply a CSS class ('flash-up' or 'flash-down') defined in styles.scss.
 *   The class uses @keyframes to flash a coloured background that fades in 400ms.
 *   We remove-and-re-add the class on each direction change so the animation
 *   restarts cleanly even if the direction stays the same (e.g. two consecutive
 *   up ticks should each flash, not just the first).
 */
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'app-price-cell',
  template: `
    <!-- Monospaced font keeps digit widths fixed so numbers don't jitter -->
    <span class="mono price-value">{{ price | number:'1.2-2' }}</span>
  `,
  styles: [`
    :host {
      display: block;
      padding: 4px 8px;
      border-radius: 3px;
      transition: color 0.4s ease-out;
    }
    .price-value {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
  `],
  // OnPush: skip change detection unless @Input refs change or an Observable emits
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceCellComponent implements OnChanges {
  /** The numeric price to display */
  @Input() price = 0;

  /**
   * The direction of the most recent price move.
   * Drives the CSS flash animation.
   * 'flat' on initial render — no animation.
   */
  @Input() direction: 'up' | 'down' | 'flat' = 'flat';

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    // We only care about direction changes for the animation
    if (changes['direction'] && !changes['direction'].firstChange) {
      this.triggerFlash(this.direction);
    }
  }

  /**
   * Restarts the CSS flash animation by:
   *   1. Removing the current flash class (stops any running animation)
   *   2. Forcing a browser reflow (the void trick) so the removal is painted
   *   3. Re-adding the class so the @keyframes animation restarts
   *
   * This is the canonical DOM technique for restarting a CSS animation.
   */
  private triggerFlash(direction: 'up' | 'down' | 'flat'): void {
    if (direction === 'flat') return;

    const host = this.el.nativeElement;
    const cls = direction === 'up' ? 'flash-up' : 'flash-down';
    const opposite = direction === 'up' ? 'flash-down' : 'flash-up';

    host.classList.remove(cls, opposite);
    // Void coercion forces a synchronous reflow so the class removal is
    // committed to the DOM before we re-add it — without this, the browser
    // may optimise away the remove+add and the animation won't restart.
    void host.offsetWidth;
    host.classList.add(cls);
  }
}
