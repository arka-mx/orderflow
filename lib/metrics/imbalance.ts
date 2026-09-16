import { PriceLevelSummary } from '../engine/types';

export interface Level1State {
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
}

/**
 * Calculates Order Book Imbalance (OBI) across top N levels.
 * OBI = (Sum(BidQty_N) - Sum(AskQty_N)) / (Sum(BidQty_N) + Sum(AskQty_N))
 * Bounded in [-1, 1].
 */
export function calculateOBI(
  bids: PriceLevelSummary[],
  asks: PriceLevelSummary[],
  topN: number = 5
): number {
  const topBids = bids.slice(0, topN);
  const topAsks = asks.slice(0, topN);

  const totalBidQty = topBids.reduce((sum, lvl) => sum + lvl.quantity, 0);
  const totalAskQty = topAsks.reduce((sum, lvl) => sum + lvl.quantity, 0);

  const denom = totalBidQty + totalAskQty;
  if (denom === 0) return 0;

  const obi = (totalBidQty - totalAskQty) / denom;
  // Bound strictly in [-1, 1] and round to 4 decimals
  return Math.round(Math.max(-1, Math.min(1, obi)) * 10000) / 10000;
}

/**
 * Cont-Kukanov-Stoikov (2014) Event-Based Order Flow Imbalance (OFI) Calculator.
 *
 * For each discrete book-changing event n at level 1:
 * OFI_n = [BidQty_n * 1{Bid_n >= Bid_{n-1}} - BidQty_{n-1} * 1{Bid_n <= Bid_{n-1}}]
 *       - [AskQty_n * 1{Ask_n <= Ask_{n-1}} - AskQty_{n-1} * 1{Ask_n >= Ask_{n-1}}]
 */
export class OFICalculator {
  private previousState: Level1State | null = null;
  private windowSize: number;
  private ofiEvents: number[] = [];

  constructor(windowSize: number = 50) {
    this.windowSize = windowSize;
  }

  /**
   * Resets the OFI calculator history.
   */
  public reset(): void {
    this.previousState = null;
    this.ofiEvents = [];
  }

  /**
   * Processes a new level-1 quote update and returns the rolling OFI sum.
   */
  public update(currentState: Level1State | null): number {
    if (!currentState) {
      return this.getRollingOFI();
    }

    if (!this.previousState) {
      this.previousState = { ...currentState };
      return 0;
    }

    const prev = this.previousState;
    const curr = currentState;

    // Bid component
    let bidTerm = 0;
    if (curr.bidPrice > prev.bidPrice) {
      bidTerm = curr.bidQty;
    } else if (curr.bidPrice === prev.bidPrice) {
      bidTerm = curr.bidQty - prev.bidQty;
    } else {
      // curr.bidPrice < prev.bidPrice
      bidTerm = -prev.bidQty;
    }

    // Ask component
    let askTerm = 0;
    if (curr.askPrice < prev.askPrice) {
      askTerm = curr.askQty;
    } else if (curr.askPrice === prev.askPrice) {
      askTerm = curr.askQty - prev.askQty;
    } else {
      // curr.askPrice > prev.askPrice
      askTerm = -prev.askQty;
    }

    const eventOFI = bidTerm - askTerm;

    // Only record if there was an actual top-of-book change
    if (
      curr.bidPrice !== prev.bidPrice ||
      curr.bidQty !== prev.bidQty ||
      curr.askPrice !== prev.askPrice ||
      curr.askQty !== prev.askQty
    ) {
      this.ofiEvents.push(eventOFI);
      if (this.ofiEvents.length > this.windowSize) {
        this.ofiEvents.shift();
      }
      this.previousState = { ...curr };
    }

    return this.getRollingOFI();
  }

  /**
   * Returns the cumulative sum of OFI across the rolling event window.
   */
  public getRollingOFI(): number {
    return this.ofiEvents.reduce((sum, val) => sum + val, 0);
  }
}
