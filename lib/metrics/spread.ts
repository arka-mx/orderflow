/**
 * Microstructure Spread and Price Metrics
 * Implements Level-1 Spread, Mid-price, and Microprice (volume-weighted fair value).
 */

export interface SpreadMetrics {
  spread: number | null;
  midPrice: number | null;
  microprice: number | null;
}

/**
 * Calculates Spread, Mid Price, and Microprice from Level-1 Bid and Ask.
 *
 * Microprice:
 * P_micro = (Bid1 * AskQty1 + Ask1 * BidQty1) / (BidQty1 + AskQty1)
 *
 * When BidQty1 >> AskQty1 (heavy buy queue), P_micro shifts upward closer to Ask1,
 * signaling upward quote transition probability.
 */
export function calculateSpreadMetrics(
  bestBid: number | null,
  bestBidQty: number | null,
  bestAsk: number | null,
  bestAskQty: number | null,
  decimals: number = 2
): SpreadMetrics {
  if (
    bestBid === null ||
    bestAsk === null ||
    bestBidQty === null ||
    bestAskQty === null ||
    bestBid <= 0 ||
    bestAsk <= 0 ||
    bestBidQty <= 0 ||
    bestAskQty <= 0
  ) {
    return {
      spread: null,
      midPrice: null,
      microprice: null,
    };
  }

  const factor = Math.pow(10, decimals);
  const round = (v: number) => Math.round(v * factor) / factor;

  const spread = round(bestAsk - bestBid);
  const midPrice = round((bestBid + bestAsk) / 2);

  const totalLevel1Qty = bestBidQty + bestAskQty;
  const microprice =
    totalLevel1Qty > 0
      ? round((bestBid * bestAskQty + bestAsk * bestBidQty) / totalLevel1Qty)
      : midPrice;

  return {
    spread,
    midPrice,
    microprice,
  };
}
