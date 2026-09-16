export type Side = 'buy' | 'sell';

export type OrderType = 'market' | 'limit' | 'ioc' | 'fok';

export type OrderStatus =
  | 'new'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected';

export interface Order {
  id: string;
  side: Side;
  type: OrderType;
  price: number;
  quantity: number;
  remainingQty: number;
  timestamp: number;
  clientId?: string;
}

export interface Trade {
  id: string;
  takerOrderId: string;
  makerOrderId: string;
  price: number;
  quantity: number;
  takerSide: Side;
  timestamp: number;
}

export interface PriceLevelSummary {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface BookSnapshot {
  sequence: number;
  timestamp: number;
  bids: PriceLevelSummary[];
  asks: PriceLevelSummary[];
  referencePrice: number;
}

export interface OrderRequest {
  id?: string;
  side: Side;
  type: OrderType;
  price?: number;
  quantity: number;
  clientId?: string;
}

export interface OrderResult {
  success: boolean;
  orderId: string;
  status: OrderStatus;
  filledQuantity: number;
  averagePrice?: number;
  trades: Trade[];
  rejectionReason?: string;
}

export interface MicrostructureMetrics {
  spread: number | null;
  midPrice: number | null;
  microprice: number | null;
  obi: number | null;
  ofi: number;
  referencePrice: number;
  bestBid: number | null;
  bestBidQty: number | null;
  bestAsk: number | null;
  bestAskQty: number | null;
  timestamp: number;
}

export type EngineEventType =
  | 'snapshot'
  | 'trade'
  | 'order_accepted'
  | 'order_cancelled'
  | 'order_rejected'
  | 'metrics_update';

export interface EngineEvent {
  type: EngineEventType;
  data: any;
  timestamp: number;
}
