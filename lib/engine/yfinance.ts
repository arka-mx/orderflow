export interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  previousClose: number;
  priceChange: number;
  priceChangePercent: number;
  lastUpdated: number;
  currency: string;
}

export class YahooFinanceService {
  private symbol: string;
  private currentQuote: YahooQuote | null = null;
  private timer: NodeJS.Timeout | null = null;
  private listeners: Set<(quote: YahooQuote) => void> = new Set();
  private intervalMs: number = 10000; // 10 seconds
  private isRunning: boolean = false;

  constructor(defaultSymbol: string = 'NVDA', intervalMs: number = 10000) {
    this.symbol = defaultSymbol;
    this.intervalMs = intervalMs;
  }

  public async fetchQuote(symbolToFetch?: string): Promise<YahooQuote | null> {
    const sym = (symbolToFetch || this.symbol).toUpperCase();
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      sym
    )}?interval=1m&range=1d`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        console.warn(`[YahooFinance] Failed to fetch quote for ${sym}: HTTP ${res.status}`);
        return this.currentQuote;
      }

      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta || typeof meta.regularMarketPrice !== 'number') {
        console.warn(`[YahooFinance] Malformed chart meta response for ${sym}`);
        return this.currentQuote;
      }

      const regularMarketPrice = Math.round(meta.regularMarketPrice * 100) / 100;
      const previousClose =
        typeof meta.chartPreviousClose === 'number'
          ? Math.round(meta.chartPreviousClose * 100) / 100
          : regularMarketPrice;
      const priceChange = Math.round((regularMarketPrice - previousClose) * 100) / 100;
      const priceChangePercent =
        previousClose > 0
          ? Math.round((priceChange / previousClose) * 10000) / 100
          : 0;

      const quote: YahooQuote = {
        symbol: meta.symbol || sym,
        regularMarketPrice,
        previousClose,
        priceChange,
        priceChangePercent,
        lastUpdated: Date.now(),
        currency: meta.currency || 'USD',
      };

      this.currentQuote = quote;
      this.notifyListeners(quote);
      return quote;
    } catch (err) {
      console.error(`[YahooFinance] Error fetching ${sym}:`, err);
      return this.currentQuote;
    }
  }

  private notifyListeners(quote: YahooQuote) {
    for (const listener of this.listeners) {
      try {
        listener(quote);
      } catch (err) {
        console.error('[YahooFinance] Listener error:', err);
      }
    }
  }

  public subscribe(listener: (quote: YahooQuote) => void): () => void {
    this.listeners.add(listener);
    if (this.currentQuote) {
      listener(this.currentQuote);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Immediate initial fetch
    this.fetchQuote();

    // Refresh every 10 seconds
    this.timer = setInterval(() => {
      this.fetchQuote();
    }, this.intervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public setSymbol(newSymbol: string): void {
    if (newSymbol.toUpperCase() !== this.symbol) {
      this.symbol = newSymbol.toUpperCase();
      this.fetchQuote(this.symbol);
    }
  }

  public getSymbol(): string {
    return this.symbol;
  }

  public getQuote(): YahooQuote | null {
    return this.currentQuote;
  }
}

// Global singleton instance for Yahoo Finance service
let globalYahooService: YahooFinanceService | null = null;

export function getGlobalYahooService(): YahooFinanceService {
  if (!globalYahooService) {
    globalYahooService = new YahooFinanceService('NVDA', 10000);
    globalYahooService.start();
  }
  return globalYahooService;
}
