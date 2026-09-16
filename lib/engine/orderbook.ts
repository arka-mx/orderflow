import {
  Order,
  Side,
  PriceLevelSummary,
  BookSnapshot,
} from './types';

export interface InternalPriceLevel {
  price: number;
  totalQuantity: number;
  orders: Order[];
}

export class OrderBook {
  // Bids stored by price key (e.g. "100.05")
  private bidLevels: Map<number, InternalPriceLevel> = new Map();
  // Asks stored by price key
  private askLevels: Map<number, InternalPriceLevel> = new Map();
  // Quick lookup for active orders across both sides
  private ordersById: Map<string, { order: Order; side: Side }> = new Map();

  private tickDecimals: number;

  constructor(tickDecimals: number = 2) {
    this.tickDecimals = tickDecimals;
  }

  public roundPrice(price: number): number {
    const factor = Math.pow(10, this.tickDecimals);
    return Math.round(price * factor) / factor;
  }

  /**
   * Adds an order to rest in the book at its price level (appended to FIFO queue).
   */
  public addRestingOrder(order: Order): void {
    const price = this.roundPrice(order.price);
    const sideLevels = order.side === 'buy' ? this.bidLevels : this.askLevels;

    let level = sideLevels.get(price);
    if (!level) {
      level = {
        price,
        totalQuantity: 0,
        orders: [],
      };
      sideLevels.set(price, level);
    }

    level.orders.push(order);
    level.totalQuantity += order.remainingQty;

    this.ordersById.set(order.id, { order, side: order.side });
  }

  /**
   * Removes an empty or depleted price level from the book.
   */
  public removeLevel(side: Side, price: number): void {
    const rounded = this.roundPrice(price);
    const sideLevels = side === 'buy' ? this.bidLevels : this.askLevels;
    sideLevels.delete(rounded);
  }

  /**
   * Removes an order's index entry after fill.
   */
  public removeOrderRecord(orderId: string): void {
    this.ordersById.delete(orderId);
  }

  /**
   * Cancels an active resting order by ID. Returns the cancelled Order or null.
   */
  public cancelOrder(orderId: string): Order | null {
    const entry = this.ordersById.get(orderId);
    if (!entry) return null;

    const { order, side } = entry;
    const price = this.roundPrice(order.price);
    const sideLevels = side === 'buy' ? this.bidLevels : this.askLevels;
    const level = sideLevels.get(price);

    if (level) {
      const idx = level.orders.findIndex((o) => o.id === orderId);
      if (idx !== -1) {
        level.orders.splice(idx, 1);
        level.totalQuantity -= order.remainingQty;

        if (level.orders.length === 0 || level.totalQuantity <= 0) {
          sideLevels.delete(price);
        }
      }
    }

    this.ordersById.delete(orderId);
    return order;
  }

  /**
   * Finds an order by ID.
   */
  public getOrder(orderId: string): Order | null {
    return this.ordersById.get(orderId)?.order || null;
  }

  /**
   * Gets sorted bid price levels (descending: highest price first).
   */
  public getSortedBids(): InternalPriceLevel[] {
    const levels = Array.from(this.bidLevels.values());
    return levels.sort((a, b) => b.price - a.price);
  }

  /**
   * Gets sorted ask price levels (ascending: lowest price first).
   */
  public getSortedAsks(): InternalPriceLevel[] {
    const levels = Array.from(this.askLevels.values());
    return levels.sort((a, b) => a.price - b.price);
  }

  /**
   * Best bid price & aggregate quantity.
   */
  public getBestBid(): { price: number; quantity: number } | null {
    const sorted = this.getSortedBids();
    if (sorted.length === 0) return null;
    return { price: sorted[0].price, quantity: sorted[0].totalQuantity };
  }

  /**
   * Best ask price & aggregate quantity.
   */
  public getBestAsk(): { price: number; quantity: number } | null {
    const sorted = this.getSortedAsks();
    if (sorted.length === 0) return null;
    return { price: sorted[0].price, quantity: sorted[0].totalQuantity };
  }

  /**
   * Depth summary for bids (L2 snapshot).
   */
  public getBids(depth: number = 20): PriceLevelSummary[] {
    return this.getSortedBids()
      .slice(0, depth)
      .map((lvl) => ({
        price: lvl.price,
        quantity: lvl.totalQuantity,
        orderCount: lvl.orders.length,
      }));
  }

  /**
   * Depth summary for asks (L2 snapshot).
   */
  public getAsks(depth: number = 20): PriceLevelSummary[] {
    return this.getSortedAsks()
      .slice(0, depth)
      .map((lvl) => ({
        price: lvl.price,
        quantity: lvl.totalQuantity,
        orderCount: lvl.orders.length,
      }));
  }

  /**
   * Generates a complete book snapshot.
   */
  public getSnapshot(
    referencePrice: number,
    sequence: number,
    depth: number = 20
  ): BookSnapshot {
    return {
      sequence,
      timestamp: Date.now(),
      bids: this.getBids(depth),
      asks: this.getAsks(depth),
      referencePrice,
    };
  }

  /**
   * Clears all resting orders from the book.
   */
  public clear(): void {
    this.bidLevels.clear();
    this.askLevels.clear();
    this.ordersById.clear();
  }
}
