import {
  BookSnapshot,
  EngineEvent,
  MicrostructureMetrics,
  OrderRequest,
  OrderResult,
  Trade,
} from './types';

export interface FeedAdapterListener {
  onSnapshot?: (snapshot: BookSnapshot) => void;
  onTrade?: (trade: Trade) => void;
  onMetrics?: (metrics: MicrostructureMetrics) => void;
  onEvent?: (event: EngineEvent) => void;
}

export interface FeedAdapter {
  /**
   * Subscribes to real-time order book events, trades, and metrics.
   * Returns an unsubscribe teardown function.
   */
  subscribe(listener: FeedAdapterListener): () => void;

  /**
   * Submits an order (Market, Limit, IOC, FOK) to the engine.
   */
  submitOrder(order: OrderRequest): OrderResult;

  /**
   * Cancels an active resting order by ID.
   */
  cancelOrder(orderId: string): boolean;

  /**
   * Obtains the current L2 snapshot of the book.
   */
  getSnapshot(): BookSnapshot;

  /**
   * Obtains current microstructure metrics.
   */
  getMetrics(): MicrostructureMetrics;

  /**
   * Starts the simulation / feed connection.
   */
  start(): void;

  /**
   * Stops the simulation / feed connection.
   */
  stop(): void;
}
