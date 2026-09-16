import { create } from 'zustand';
import {
  BookSnapshot,
  MicrostructureMetrics,
  OrderRequest,
  PriceLevelSummary,
  Trade,
} from '../engine/types';

export interface UserOrderLog {
  id: string;
  timestamp: number;
  side: 'buy' | 'sell';
  type: string;
  price?: number;
  quantity: number;
  filledQuantity: number;
  status: string;
  averagePrice?: number;
  error?: string;
}

interface BookState {
  bids: PriceLevelSummary[];
  asks: PriceLevelSummary[];
  referencePrice: number;
  sequence: number;
  metrics: MicrostructureMetrics | null;
  recentTrades: Trade[];
  userOrders: UserOrderLog[];
  connected: boolean;
  isSubmitting: boolean;
  lastErrorMessage: string | null;

  connect: () => void;
  disconnect: () => void;
  submitOrder: (order: OrderRequest) => Promise<{ success: boolean; message?: string }>;
  clearError: () => void;
}

let eventSource: EventSource | null = null;

export const useBookStore = create<BookState>((set, get) => ({
  bids: [],
  asks: [],
  referencePrice: 100.0,
  sequence: 0,
  metrics: null,
  recentTrades: [],
  userOrders: [],
  connected: false,
  isSubmitting: false,
  lastErrorMessage: null,

  clearError: () => set({ lastErrorMessage: null }),

  connect: () => {
    if (typeof window === 'undefined') return;
    if (eventSource) {
      eventSource.close();
    }

    try {
      eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        set({ connected: true, lastErrorMessage: null });
      };

      eventSource.addEventListener('snapshot', (e: MessageEvent) => {
        try {
          const snapshot: BookSnapshot = JSON.parse(e.data);
          set({
            bids: snapshot.bids,
            asks: snapshot.asks,
            referencePrice: snapshot.referencePrice,
            sequence: snapshot.sequence,
          });
        } catch (err) {
          console.error('Error parsing snapshot event', err);
        }
      });

      eventSource.addEventListener('metrics', (e: MessageEvent) => {
        try {
          const metrics: MicrostructureMetrics = JSON.parse(e.data);
          set({ metrics });
        } catch (err) {
          console.error('Error parsing metrics event', err);
        }
      });

      eventSource.addEventListener('trade', (e: MessageEvent) => {
        try {
          const trade: Trade = JSON.parse(e.data);
          set((state) => ({
            recentTrades: [trade, ...state.recentTrades].slice(0, 40),
          }));
        } catch (err) {
          console.error('Error parsing trade event', err);
        }
      });

      eventSource.onerror = () => {
        set({ connected: false });
      };
    } catch (err) {
      console.error('Failed to establish EventSource stream', err);
      set({ connected: false });
    }
  },

  disconnect: () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    set({ connected: false });
  },

  submitOrder: async (order: OrderRequest) => {
    set({ isSubmitting: true, lastErrorMessage: null });
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.error || 'Order execution failed';
        set({
          isSubmitting: false,
          lastErrorMessage: errorMsg,
          userOrders: [
            {
              id: `rej-${Date.now()}`,
              timestamp: Date.now(),
              side: order.side,
              type: order.type.toUpperCase(),
              price: order.price,
              quantity: order.quantity,
              filledQuantity: 0,
              status: 'REJECTED',
              error: errorMsg,
            },
            ...get().userOrders,
          ].slice(0, 20),
        });
        return { success: false, message: errorMsg };
      }

      const resOrder = data.result;
      set((state) => ({
        isSubmitting: false,
        userOrders: [
          {
            id: resOrder.orderId,
            timestamp: Date.now(),
            side: order.side,
            type: order.type.toUpperCase(),
            price: order.price,
            quantity: order.quantity,
            filledQuantity: resOrder.filledQuantity,
            status: resOrder.status.toUpperCase(),
            averagePrice: resOrder.averagePrice,
          },
          ...state.userOrders,
        ].slice(0, 20),
      }));

      return { success: true };
    } catch (err: any) {
      const errorMsg = err.message || 'Network error submitting order';
      set({ isSubmitting: false, lastErrorMessage: errorMsg });
      return { success: false, message: errorMsg };
    }
  },
}));
