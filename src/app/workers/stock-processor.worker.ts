/**
 * stock-processor.worker.ts
 * ─────────────────────────
 * This Web Worker owns the entire data ingestion pipeline.
 * Running off the main thread means that even at 1000 ticks/second, the UI
 * (Angular change detection, CDK rendering) is never blocked by stream parsing.
 *
 * Pipeline overview:
 *
 *   SSE /api/v1/data/stream  ─┐
 *   (or mock generator)       ├─► [high-freq tick loop ~1 ms]
 *                              │       │
 *                              │   currentSnapshot Map<symbol, StockUpdate>
 *                              │       │ (latest value per symbol; older values
 *                              │       │  discarded — only the most recent tick
 *                              │       │  in a 100ms window matters)
 *                              │       │
 *                              └─► [throttle interval 100ms]
 *                                      │
 *                                  postMessage({ type:'UPDATE', stocks:[] })
 *                                      │
 *                                  Main thread / NgRx store
 *
 * Message protocol (main → worker):
 *   { type: 'START', url: string }   – begin streaming
 *   { type: 'STOP' }                 – tear down everything
 *
 * Message protocol (worker → main):
 *   { type: 'CONNECTED' }                    – SSE handshake OK
 *   { type: 'UPDATE', stocks: StockUpdate[] } – throttled batch
 *   { type: 'ERROR', error: string }          – fatal stream error
 */

import { StockSeed, StockUpdate } from '../store/stock.model';

// ─── Seed data ────────────────────────────────────────────────────────────────
// These base prices are the starting point for the random walk generator.
// They approximate real-world prices so the numbers look credible.

const STOCK_SEEDS: StockSeed[] = [
  { symbol: 'AAPL',  name: 'Apple Inc.',       basePrice: 189.50 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.',     basePrice: 141.80 },
  { symbol: 'MSFT',  name: 'Microsoft Corp.',   basePrice: 415.20 },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',   basePrice: 185.60 },
  { symbol: 'TSLA',  name: 'Tesla Inc.',        basePrice: 248.90 },
  { symbol: 'NVDA',  name: 'NVIDIA Corp.',      basePrice: 875.40 },
  { symbol: 'META',  name: 'Meta Platforms',    basePrice: 530.10 },
  { symbol: 'JPM',   name: 'JPMorgan Chase',    basePrice: 201.30 },
  { symbol: 'GS',    name: 'Goldman Sachs',     basePrice: 489.70 },
  { symbol: 'BAC',   name: 'Bank of America',   basePrice:  38.45 },
];

// ─── Worker state ─────────────────────────────────────────────────────────────

/**
 * currentSnapshot holds the latest StockUpdate for every symbol.
 * The tick loop writes into this map at high frequency (~1000/s total).
 * The throttle batch loop reads from it every THROTTLE_MS and sends the
 * whole map to the main thread, then the values are NOT cleared — the next
 * batch will include any symbol that ticked since the last batch.
 */
const currentSnapshot = new Map<string, StockUpdate>();

/** Daily change accumulators (in £/$ terms) — persist across ticks */
const accumulatedChange = new Map<string, number>();

/** Previous-close prices (set once from seed, never change intra-day) */
const previousClose = new Map<string, number>();

/** Intraday high/low watermarks */
const intradayHigh = new Map<string, number>();
const intradayLow  = new Map<string, number>();

/** Volume counters per symbol */
const volumeCounter = new Map<string, number>();

// Initialise maps from seeds
for (const seed of STOCK_SEEDS) {
  previousClose.set(seed.symbol, seed.basePrice);
  intradayHigh.set(seed.symbol, seed.basePrice * 1.005);
  intradayLow.set(seed.symbol,  seed.basePrice * 0.995);
  volumeCounter.set(seed.symbol, Math.floor(Math.random() * 5_000_000));
  accumulatedChange.set(seed.symbol, 0);

  // Initialise snapshot so first batch has all symbols even before any tick
  currentSnapshot.set(seed.symbol, buildInitialUpdate(seed));
}

function buildInitialUpdate(seed: StockSeed): StockUpdate {
  const spread = seed.basePrice * 0.0002; // 2bps spread
  return {
    symbol:        seed.symbol,
    price:         seed.basePrice,
    bid:           parseFloat((seed.basePrice - spread / 2).toFixed(2)),
    ask:           parseFloat((seed.basePrice + spread / 2).toFixed(2)),
    volume:        volumeCounter.get(seed.symbol)!,
    change:        0,
    changePercent: 0,
    high:          intradayHigh.get(seed.symbol)!,
    low:           intradayLow.get(seed.symbol)!,
    timestamp:     Date.now(),
  };
}

// ─── Interval handles ─────────────────────────────────────────────────────────

let tickIntervalHandle: ReturnType<typeof setInterval> | null = null;
let batchIntervalHandle: ReturnType<typeof setInterval> | null = null;
let sseSource: EventSource | null = null;

// How many milliseconds between batch posts to the main thread.
// 100ms ≈ 10 UI frames/second — smooth visually without flooding the main thread.
const THROTTLE_MS = 100;

// How often the mock tick fires (1ms ≈ 1000 ticks/second)
const TICK_MS = 1;

// ─── Mock random-walk generator ───────────────────────────────────────────────

/**
 * Generates a single price tick for a randomly chosen stock.
 * Models a Geometric Brownian Motion step:
 *   new_price = old_price * exp(sigma * Z)
 * where Z ~ N(0,1) approximated by summing uniform randoms.
 *
 * Volatility (sigma) is calibrated so prices feel realistic:
 * NVDA at $875 moves more in $ than BAC at $38, but similar in % terms.
 */
function generateTick(): void {
  // Pick a stock at random (uniform distribution — real feeds weight by activity)
  const seed = STOCK_SEEDS[Math.floor(Math.random() * STOCK_SEEDS.length)];
  const { symbol } = seed;

  const snapshot = currentSnapshot.get(symbol)!;
  const prevClose = previousClose.get(symbol)!;

  // ── Random walk ──────────────────────────────────────────────────────────
  // Sum of 6 uniform randoms approximates a normal distribution (CLT),
  // scaled to ~3bps per tick (0.03% max move per ms)
  const z = (Math.random() + Math.random() + Math.random() +
             Math.random() + Math.random() + Math.random() - 3);
  const sigma = 0.0003; // per-tick volatility
  const newPrice = parseFloat((snapshot.price * (1 + sigma * z)).toFixed(2));

  // ── Bid/Ask spread ────────────────────────────────────────────────────────
  // Spread widens slightly as price moves away from mid to simulate impact
  const spreadBps = 0.0002 + Math.abs(z) * 0.00005;
  const halfSpread = newPrice * spreadBps / 2;
  const bid = parseFloat((newPrice - halfSpread).toFixed(2));
  const ask = parseFloat((newPrice + halfSpread).toFixed(2));

  // ── Intraday watermarks ───────────────────────────────────────────────────
  const high = Math.max(intradayHigh.get(symbol)!, newPrice);
  const low  = Math.min(intradayLow.get(symbol)!,  newPrice);
  intradayHigh.set(symbol, high);
  intradayLow.set(symbol,  low);

  // ── Volume (increases monotonically throughout the day) ───────────────────
  const tradeVolume = Math.floor(Math.random() * 500) + 100;
  const totalVolume = (volumeCounter.get(symbol)! + tradeVolume);
  volumeCounter.set(symbol, totalVolume);

  // ── Change vs previous close ──────────────────────────────────────────────
  const change = parseFloat((newPrice - prevClose).toFixed(2));
  const changePercent = parseFloat(((change / prevClose) * 100).toFixed(3));

  // ── Write to snapshot (overwrites any previous tick in this 100ms window) ─
  currentSnapshot.set(symbol, {
    symbol,
    price: newPrice,
    bid,
    ask,
    volume: totalVolume,
    change,
    changePercent,
    high,
    low,
    timestamp: Date.now(),
  });
}

// ─── SSE connection ───────────────────────────────────────────────────────────

/**
 * Attempts to connect to the real SSE endpoint.
 * If the server is unavailable (404, CORS, network error) we fall back
 * to the mock generator after a short timeout.
 *
 * In a real trading system this would be the primary path; the mock is
 * only for demo/test environments.
 */
function connectSSE(url: string): void {
  // EventSource is available in Web Workers in all modern browsers
  sseSource = new EventSource(url);

  // Set a timeout: if we haven't connected within 2 seconds, use mock
  const fallbackTimeout = setTimeout(() => {
    if (sseSource && sseSource.readyState !== EventSource.OPEN) {
      console.warn('[Worker] SSE not available — switching to mock stream');
      sseSource?.close();
      sseSource = null;
      startMockStream();
    }
  }, 2000);

  sseSource.addEventListener('open', () => {
    clearTimeout(fallbackTimeout);
    self.postMessage({ type: 'CONNECTED' });
  });

  /**
   * Each SSE event carries a JSON payload matching StockUpdate.
   * We write it straight into currentSnapshot; the batch interval
   * will pick it up within THROTTLE_MS.
   */
  sseSource.addEventListener('message', (event: MessageEvent) => {
    try {
      const update: StockUpdate = JSON.parse(event.data as string);
      currentSnapshot.set(update.symbol, update);
    } catch (e) {
      // Malformed message — ignore and continue
    }
  });

  sseSource.addEventListener('error', () => {
    clearTimeout(fallbackTimeout);
    // SSE auto-reconnects on transient errors; if readyState is CLOSED it's fatal
    if (sseSource?.readyState === EventSource.CLOSED) {
      self.postMessage({ type: 'ERROR', error: 'SSE connection closed' });
      startMockStream(); // Fall through to mock so the UI isn't dead
    }
  });
}

// ─── Mock stream ──────────────────────────────────────────────────────────────

/**
 * Starts the high-frequency mock tick loop and the throttle batch loop.
 * Called either directly (no real endpoint) or as SSE fallback.
 */
function startMockStream(): void {
  // Notify main thread so the status indicator can reflect this
  self.postMessage({ type: 'CONNECTED' });

  // High-frequency tick: ~1000 calls/second across all stocks
  tickIntervalHandle = setInterval(generateTick, TICK_MS);

  // Throttle: flush the snapshot to the main thread every THROTTLE_MS
  startBatchInterval();
}

function startBatchInterval(): void {
  batchIntervalHandle = setInterval(() => {
    // Convert map values to array for postMessage serialisation
    const stocks = Array.from(currentSnapshot.values());
    // Only send if there's something to report
    if (stocks.length > 0) {
      self.postMessage({ type: 'UPDATE', stocks });
    }
  }, THROTTLE_MS);
}

// ─── Worker entry points ──────────────────────────────────────────────────────

function start(url: string): void {
  // Try real SSE first; mock is the fallback
  try {
    connectSSE(url);
    // Start the batch interval regardless — works for both SSE and mock
    startBatchInterval();
  } catch {
    // EventSource not available in this environment — go straight to mock
    startMockStream();
  }
}

function stop(): void {
  if (tickIntervalHandle !== null) {
    clearInterval(tickIntervalHandle);
    tickIntervalHandle = null;
  }
  if (batchIntervalHandle !== null) {
    clearInterval(batchIntervalHandle);
    batchIntervalHandle = null;
  }
  sseSource?.close();
  sseSource = null;
}

// ─── Message handler ──────────────────────────────────────────────────────────

/**
 * The worker's public API — commands sent from the main thread.
 */
addEventListener('message', (event: MessageEvent<{ type: string; url?: string }>) => {
  switch (event.data.type) {
    case 'START':
      start(event.data.url ?? '/api/v1/data/stream');
      break;
    case 'STOP':
      stop();
      break;
  }
});
