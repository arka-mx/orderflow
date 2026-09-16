import { OrderBook } from './orderbook';
import { MatchingEngine } from './matching';
import { FeedAdapter, FeedAdapterListener } from './feedAdapter';
import {
  BookSnapshot,
  MicrostructureMetrics,
  OrderRequest,
  OrderResult,
  Trade,
  StockQuoteSummary,
} from './types';
import { calculateSpreadMetrics } from '../metrics/spread';
import { calculateOBI, OFICalculator } from '../metrics/imbalance';
import { getGlobalYahooService, YahooQuote } from './yfinance';

export interface SimulatorConfig {
  initialPrice?: number;
  tickSize?: number;
  arrivalLambda?: number; // arrivals per second
  volatility?: number;
  meanReversionSpeed?: number;
  topNLevels?: number;
  ofiWindow?: number;
}

export class MarketSimulator implements FeedAdapter {
  private book: OrderBook;
  private engine: MatchingEngine;
  private ofiCalc: OFICalculator;

  private referencePrice: number;
  private initialTargetPrice: number;
  private tickSize: number;
  private arrivalLambda: number;
  private volatility: number;
  private meanReversionSpeed: number;
  private topNLevels: number;

  private sequence: number = 0;
  private listeners: Set<FeedAdapterListener> = new Set();
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private unsubscribeYf: (() => void) | null = null;

  constructor(config: SimulatorConfig = {}) {
    this.tickSize = config.tickSize ?? 0.01;
    this.referencePrice = config.initialPrice ?? 100.0;
    this.initialTargetPrice = this.referencePrice;
    this.arrivalLambda = config.arrivalLambda ?? 8; // ~8 events per second
    this.volatility = config.volatility ?? 0.08;
    this.meanReversionSpeed = config.meanReversionSpeed ?? 0.1;
    this.topNLevels = config.topNLevels ?? 5;

    this.book = new OrderBook(2);
    this.engine = new MatchingEngine(this.book);
    this.ofiCalc = new OFICalculator(config.ofiWindow ?? 50);

    // Wire real Yahoo Finance feed
    const yf = getGlobalYahooService();
    const initQuote = yf.getQuote();
    if (initQuote && initQuote.regularMarketPrice > 0) {
      this.referencePrice = initQuote.regularMarketPrice;
      this.initialTargetPrice = this.referencePrice;
    }

    this.seedInitialBook();

    // Subscribe to Yahoo Finance 10-second updates
    this.unsubscribeYf = yf.subscribe((quote) => {
      this.handleYahooQuote(quote);
    });
  }

  private roundPrice(p: number): number {
    return Math.round(p * 100) / 100;
  }

  /**
   * Called when Yahoo Finance pushes a live quote update every 10 seconds.
   */
  public handleYahooQuote(quote: YahooQuote): void {
    if (!quote || quote.regularMarketPrice <= 0) return;

    const oldPrice = this.referencePrice;
    const newPrice = quote.regularMarketPrice;
    this.referencePrice = newPrice;
    this.initialTargetPrice = newPrice;

    // Reseed book if price moved or to refresh liquidity distribution around real stock price
    if (Math.abs(newPrice - oldPrice) >= 0.02 || this.book.getSortedBids().length === 0) {
      this.seedInitialBook();
    }

    this.sequence++;
    const snapshot = this.getSnapshot();
    const metrics = this.getMetrics();

    for (const listener of this.listeners) {
      if (listener.onSnapshot) listener.onSnapshot(snapshot);
      if (listener.onMetrics) listener.onMetrics(metrics);
    }
  }

  /**
   * Populate initial resting liquidity around reference price.
   */
  private seedInitialBook(): void {
    this.book.clear();
    const halfSpread = 0.02;
    const baseBid = this.roundPrice(this.referencePrice - halfSpread);
    const baseAsk = this.roundPrice(this.referencePrice + halfSpread);

    // Seed 12 bid levels
    for (let i = 0; i < 12; i++) {
      const p = this.roundPrice(baseBid - i * 0.02);
      const qty = Math.floor(20 + Math.random() * 80) * 10;
      this.book.addRestingOrder({
        id: `seed-bid-${i}`,
        side: 'buy',
        type: 'limit',
        price: p,
        quantity: qty,
        remainingQty: qty,
        timestamp: Date.now() - (12 - i) * 1000,
        clientId: 'seed-maker',
      });
    }

    // Seed 12 ask levels
    for (let i = 0; i < 12; i++) {
      const p = this.roundPrice(baseAsk + i * 0.02);
      const qty = Math.floor(20 + Math.random() * 80) * 10;
      this.book.addRestingOrder({
        id: `seed-ask-${i}`,
        side: 'sell',
        type: 'limit',
        price: p,
        quantity: qty,
        remainingQty: qty,
        timestamp: Date.now() - (12 - i) * 1000,
        clientId: 'seed-maker',
      });
    }

    // Initialize OFI with initial state
    const bestBid = this.book.getBestBid();
    const bestAsk = this.book.getBestAsk();
    if (bestBid && bestAsk) {
      this.ofiCalc.update({
        bidPrice: bestBid.price,
        bidQty: bestBid.quantity,
        askPrice: bestAsk.price,
        askQty: bestAsk.quantity,
      });
    }
  }

  /**
   * Simulates microscopic noise on the reference price, mean-reverting to the real Yahoo Finance quote.
   */
  private stepReferencePrice(dt: number): void {
    const u1 = Math.max(1e-7, Math.random());
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    const drift = this.meanReversionSpeed * (this.initialTargetPrice - this.referencePrice) * dt;
    const diffusion = this.volatility * Math.sqrt(dt) * z;
    this.referencePrice = Math.max(1.0, this.roundPrice(this.referencePrice + drift + diffusion));
  }

  /**
   * Generates synthetic background market participant actions around the live stock price.
   */
  private stepSyntheticTrader(): Trade[] {
    const actionRoll = Math.random();
    const bestBid = this.book.getBestBid();
    const bestAsk = this.book.getBestAsk();

    const currentMid =
      bestBid && bestAsk
        ? (bestBid.price + bestAsk.price) / 2
        : this.referencePrice;

    // 1. Cancellation (15% chance)
    if (actionRoll < 0.15) {
      const isBid = Math.random() > 0.5;
      const levels = isBid ? this.book.getSortedBids() : this.book.getSortedAsks();
      if (levels.length > 2) {
        const levelIdx = Math.min(levels.length - 1, Math.floor(1 + Math.random() * 4));
        const level = levels[levelIdx];
        if (level && level.orders.length > 0) {
          const victim = level.orders[Math.floor(Math.random() * level.orders.length)];
          this.book.cancelOrder(victim.id);
        }
      }
      return [];
    }

    // 2. Synthetic Market Order (20% chance)
    if (actionRoll < 0.35) {
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const qty = Math.floor(5 + Math.random() * 25) * 5;
      const { result, newReferencePrice } = this.engine.processOrder(
        {
          side,
          type: 'market',
          quantity: qty,
          clientId: 'synth-taker',
        },
        this.referencePrice
      );
      this.referencePrice = newReferencePrice;
      return result.trades;
    }

    // 3. Synthetic Limit Order (65% chance - liquidity provision)
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const qty = Math.floor(10 + Math.random() * 50) * 10;

    let targetPrice: number;
    if (side === 'buy') {
      const maxBid = bestAsk ? bestAsk.price - 0.01 : currentMid;
      const offset = Math.floor(Math.random() * 6) * 0.02;
      targetPrice = this.roundPrice(Math.min(maxBid, currentMid - offset));
    } else {
      const minAsk = bestBid ? bestBid.price + 0.01 : currentMid;
      const offset = Math.floor(Math.random() * 6) * 0.02;
      targetPrice = this.roundPrice(Math.max(minAsk, currentMid + offset));
    }

    const { result, newReferencePrice } = this.engine.processOrder(
      {
        side,
        type: 'limit',
        price: targetPrice,
        quantity: qty,
        clientId: 'synth-maker',
      },
      this.referencePrice
    );
    this.referencePrice = newReferencePrice;
    return result.trades;
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) return;

    const u = Math.max(1e-5, Math.random());
    const dtSeconds = -Math.log(u) / this.arrivalLambda;
    const delayMs = Math.min(350, Math.max(70, Math.round(dtSeconds * 1000)));

    this.timer = setTimeout(() => {
      this.onTick(delayMs / 1000);
      this.scheduleNextTick();
    }, delayMs);
  }

  private onTick(dt: number): void {
    this.sequence++;
    this.stepReferencePrice(dt);
    const trades = this.stepSyntheticTrader();

    const snapshot = this.getSnapshot();
    const metrics = this.getMetrics();

    for (const listener of this.listeners) {
      if (listener.onSnapshot) listener.onSnapshot(snapshot);
      if (listener.onMetrics) listener.onMetrics(metrics);
      if (listener.onTrade && trades.length > 0) {
        for (const trade of trades) {
          listener.onTrade(trade);
        }
      }
    }
  }

  private getStockQuoteSummary(): StockQuoteSummary | undefined {
    const yf = getGlobalYahooService();
    const quote = yf.getQuote();
    if (!quote) return undefined;

    return {
      symbol: quote.symbol,
      price: quote.regularMarketPrice,
      previousClose: quote.previousClose,
      change: quote.priceChange,
      changePercent: quote.priceChangePercent,
      lastUpdated: quote.lastUpdated,
    };
  }

  // --- FeedAdapter implementation ---

  public subscribe(listener: FeedAdapterListener): () => void {
    this.listeners.add(listener);
    if (listener.onSnapshot) listener.onSnapshot(this.getSnapshot());
    if (listener.onMetrics) listener.onMetrics(this.getMetrics());

    return () => {
      this.listeners.delete(listener);
    };
  }

  public submitOrder(order: OrderRequest): OrderResult {
    this.sequence++;
    const { result, newReferencePrice } = this.engine.processOrder(
      order,
      this.referencePrice
    );
    this.referencePrice = newReferencePrice;

    const snapshot = this.getSnapshot();
    const metrics = this.getMetrics();

    for (const listener of this.listeners) {
      if (listener.onSnapshot) listener.onSnapshot(snapshot);
      if (listener.onMetrics) listener.onMetrics(metrics);
      if (listener.onTrade && result.trades.length > 0) {
        for (const t of result.trades) {
          listener.onTrade(t);
        }
      }
    }

    return result;
  }

  public cancelOrder(orderId: string): boolean {
    const cancelled = this.book.cancelOrder(orderId);
    if (cancelled) {
      this.sequence++;
      const snapshot = this.getSnapshot();
      const metrics = this.getMetrics();
      for (const listener of this.listeners) {
        if (listener.onSnapshot) listener.onSnapshot(snapshot);
        if (listener.onMetrics) listener.onMetrics(metrics);
      }
      return true;
    }
    return false;
  }

  public getSnapshot(): BookSnapshot {
    const snapshot = this.book.getSnapshot(this.referencePrice, this.sequence, 15);
    snapshot.stockQuote = this.getStockQuoteSummary();
    return snapshot;
  }

  public getMetrics(): MicrostructureMetrics {
    const bestBid = this.book.getBestBid();
    const bestAsk = this.book.getBestAsk();

    const spreadMetrics = calculateSpreadMetrics(
      bestBid?.price ?? null,
      bestBid?.quantity ?? null,
      bestAsk?.price ?? null,
      bestAsk?.quantity ?? null
    );

    const bids = this.book.getBids(this.topNLevels);
    const asks = this.book.getAsks(this.topNLevels);
    const obi = calculateOBI(bids, asks, this.topNLevels);

    let rollingOFI = this.ofiCalc.getRollingOFI();
    if (bestBid && bestAsk) {
      rollingOFI = this.ofiCalc.update({
        bidPrice: bestBid.price,
        bidQty: bestBid.quantity,
        askPrice: bestAsk.price,
        askQty: bestAsk.quantity,
      });
    }

    return {
      spread: spreadMetrics.spread,
      midPrice: spreadMetrics.midPrice,
      microprice: spreadMetrics.microprice,
      obi,
      ofi: rollingOFI,
      referencePrice: this.referencePrice,
      bestBid: bestBid?.price ?? null,
      bestBidQty: bestBid?.quantity ?? null,
      bestAsk: bestAsk?.price ?? null,
      bestAskQty: bestAsk?.quantity ?? null,
      timestamp: Date.now(),
      stockQuote: this.getStockQuoteSummary(),
    };
  }

  public setSymbol(symbol: string): void {
    const yf = getGlobalYahooService();
    yf.setSymbol(symbol);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNextTick();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.unsubscribeYf) {
      this.unsubscribeYf();
      this.unsubscribeYf = null;
    }
  }
}

// Global singleton instance for server-side in-memory simulation across SSE & API routes
let globalSimulator: MarketSimulator | null = null;

export function getGlobalSimulator(): MarketSimulator {
  if (!globalSimulator) {
    globalSimulator = new MarketSimulator();
    globalSimulator.start();
  }
  return globalSimulator;
}
