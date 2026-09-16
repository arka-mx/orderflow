import { OrderBook, InternalPriceLevel } from './orderbook';
import {
  Order,
  OrderRequest,
  OrderResult,
  Trade,
  Side,
} from './types';

export class MatchingEngine {
  private book: OrderBook;
  private impactFactor: number;
  private tradeCounter: number = 0;
  private orderCounter: number = 0;

  constructor(book: OrderBook, impactFactor: number = 0.0001) {
    this.book = book;
    this.impactFactor = impactFactor;
  }

  private generateOrderId(): string {
    this.orderCounter++;
    return `ord-${Date.now()}-${this.orderCounter}`;
  }

  private generateTradeId(): string {
    this.tradeCounter++;
    return `trd-${Date.now()}-${this.tradeCounter}`;
  }

  /**
   * Tests whether an order can be filled in full immediately (for FOK).
   */
  private checkFokFeasibility(
    side: Side,
    limitPrice: number,
    requiredQty: number
  ): boolean {
    let availableQty = 0;
    if (side === 'buy') {
      const asks = this.book.getSortedAsks();
      for (const level of asks) {
        if (level.price <= limitPrice) {
          availableQty += level.totalQuantity;
          if (availableQty >= requiredQty) return true;
        } else {
          break;
        }
      }
    } else {
      const bids = this.book.getSortedBids();
      for (const level of bids) {
        if (level.price >= limitPrice) {
          availableQty += level.totalQuantity;
          if (availableQty >= requiredQty) return true;
        } else {
          break;
        }
      }
    }
    return availableQty >= requiredQty;
  }

  /**
   * Executes an incoming order against the order book.
   * Symmetric logic: applied to both user and synthetic trader orders.
   */
  public processOrder(
    request: OrderRequest,
    currentReferencePrice: number
  ): { result: OrderResult; newReferencePrice: number } {
    const orderId = request.id || this.generateOrderId();
    const timestamp = Date.now();
    const trades: Trade[] = [];
    let remainingQty = request.quantity;
    let newReferencePrice = currentReferencePrice;

    // 1. Validation & Pre-checks
    if (request.quantity <= 0) {
      return {
        result: {
          success: false,
          orderId,
          status: 'rejected',
          filledQuantity: 0,
          trades: [],
          rejectionReason: 'Order quantity must be positive',
        },
        newReferencePrice,
      };
    }

    const limitPrice = request.price !== undefined ? this.book.roundPrice(request.price) : 0;
    if (request.type !== 'market' && (!limitPrice || limitPrice <= 0)) {
      return {
        result: {
          success: false,
          orderId,
          status: 'rejected',
          filledQuantity: 0,
          trades: [],
          rejectionReason: 'Limit, IOC, and FOK orders require a valid positive limit price',
        },
        newReferencePrice,
      };
    }

    // 2. FOK Feasibility Check
    if (request.type === 'fok') {
      const feasible = this.checkFokFeasibility(request.side, limitPrice, request.quantity);
      if (!feasible) {
        return {
          result: {
            success: false,
            orderId,
            status: 'rejected',
            filledQuantity: 0,
            trades: [],
            rejectionReason: `FOK Rejected: Insufficient liquidity at or better than ${limitPrice.toFixed(2)} to fill ${request.quantity} units`,
          },
          newReferencePrice,
        };
      }
    }

    // 3. Determine matching candidates on opposite side
    const isBuy = request.side === 'buy';

    // Loop through opposite price levels in price priority
    while (remainingQty > 0) {
      const oppositeLevels: InternalPriceLevel[] = isBuy
        ? this.book.getSortedAsks()
        : this.book.getSortedBids();

      if (oppositeLevels.length === 0) {
        break; // No more opposite resting liquidity
      }

      const bestLevel = oppositeLevels[0];

      // Check price eligibility for non-market orders
      if (request.type !== 'market') {
        if (isBuy && bestLevel.price > limitPrice) {
          break; // Best ask is higher than buy limit price
        }
        if (!isBuy && bestLevel.price < limitPrice) {
          break; // Best bid is lower than sell limit price
        }
      }

      // Walk the FIFO queue at this price level (time priority)
      while (bestLevel.orders.length > 0 && remainingQty > 0) {
        const makerOrder = bestLevel.orders[0];
        const matchQty = Math.min(remainingQty, makerOrder.remainingQty);

        remainingQty -= matchQty;
        makerOrder.remainingQty -= matchQty;
        bestLevel.totalQuantity -= matchQty;

        const trade: Trade = {
          id: this.generateTradeId(),
          takerOrderId: orderId,
          makerOrderId: makerOrder.id,
          price: bestLevel.price,
          quantity: matchQty,
          takerSide: request.side,
          timestamp,
        };
        trades.push(trade);

        // If maker order fully filled, remove it from level queue and lookup
        if (makerOrder.remainingQty <= 0) {
          bestLevel.orders.shift();
          this.book.removeOrderRecord(makerOrder.id);
        }
      }

      // If price level has no more orders or zero quantity, remove the level entirely
      if (bestLevel.orders.length === 0 || bestLevel.totalQuantity <= 0) {
        this.book.removeLevel(isBuy ? 'sell' : 'buy', bestLevel.price);
      }
    }

    const filledQuantity = request.quantity - remainingQty;
    let averagePrice: number | undefined;

    if (trades.length > 0) {
      const totalNotional = trades.reduce((sum, t) => sum + t.price * t.quantity, 0);
      averagePrice = this.book.roundPrice(totalNotional / filledQuantity);
    }

    // 4. Handle Unfilled Remainder by Order Type
    let finalStatus: Order['type'] | any;

    if (request.type === 'market') {
      if (remainingQty > 0) {
        // Unfilled market order liquidity exhaustion: apply market impact to reference price
        const direction = isBuy ? 1 : -1;
        const impact = direction * remainingQty * this.impactFactor * newReferencePrice;
        newReferencePrice = Math.max(0.01, this.book.roundPrice(newReferencePrice + impact));
      }
      finalStatus = filledQuantity === request.quantity ? 'filled' : (filledQuantity > 0 ? 'partially_filled' : 'rejected');
    } else if (request.type === 'fok') {
      // By feasibility check, FOK must be 100% filled if executed
      finalStatus = 'filled';
    } else if (request.type === 'ioc') {
      // Unfilled remainder is cancelled immediately
      finalStatus = filledQuantity === request.quantity ? 'filled' : (filledQuantity > 0 ? 'partially_filled' : 'cancelled');
    } else {
      // Limit order: rest remaining quantity in the book
      if (remainingQty > 0) {
        const restingOrder: Order = {
          id: orderId,
          side: request.side,
          type: 'limit',
          price: limitPrice,
          quantity: request.quantity,
          remainingQty,
          timestamp,
          clientId: request.clientId,
        };
        this.book.addRestingOrder(restingOrder);
        finalStatus = filledQuantity > 0 ? 'partially_filled' : 'new';
      } else {
        finalStatus = 'filled';
      }
    }

    const result: OrderResult = {
      success: true,
      orderId,
      status: finalStatus,
      filledQuantity,
      averagePrice,
      trades,
    };

    return { result, newReferencePrice };
  }
}
