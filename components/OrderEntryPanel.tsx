'use client';

import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useBookStore } from '@/lib/store/useBookStore';
import { Side, OrderType } from '@/lib/engine/types';

interface OrderEntryPanelProps {
  selectedPrice?: number | null;
}

const clientOrderSchema = z
  .object({
    side: z.enum(['buy', 'sell']),
    type: z.enum(['market', 'limit', 'ioc', 'fok']),
    price: z.number().positive({ message: 'Price must be greater than zero' }).optional(),
    quantity: z.number().int({ message: 'Quantity must be a whole number' }).positive({ message: 'Quantity must be at least 1' }),
  })
  .refine(
    (data) => {
      if (data.type !== 'market') {
        return typeof data.price === 'number' && data.price > 0;
      }
      return true;
    },
    {
      message: 'Price is required for Limit, IOC, and FOK orders',
      path: ['price'],
    }
  );

export const OrderEntryPanel: React.FC<OrderEntryPanelProps> = ({ selectedPrice }) => {
  const { submitOrder, isSubmitting, lastErrorMessage, clearError, metrics } = useBookStore();

  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<OrderType>('limit');
  const [price, setPrice] = useState<string>('100.00');
  const [quantity, setQuantity] = useState<string>('50');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [orderNotice, setOrderNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Update price when user clicks ladder row
  useEffect(() => {
    if (selectedPrice !== undefined && selectedPrice !== null) {
      setPrice(selectedPrice.toFixed(2));
      if (type === 'market') {
        setType('limit');
      }
    }
  }, [selectedPrice]);

  // Set default price when metrics load if price is empty
  useEffect(() => {
    if (metrics?.midPrice && (!price || price === '100.00')) {
      setPrice(metrics.midPrice.toFixed(2));
    }
  }, [metrics?.midPrice]);

  const handleQuickQty = (add: number) => {
    const curr = parseInt(quantity, 10) || 0;
    setQuantity(Math.max(1, curr + add).toString());
  };

  const setBboPrice = (targetSide: 'bid' | 'ask') => {
    if (targetSide === 'bid' && metrics?.bestBid) {
      setPrice(metrics.bestBid.toFixed(2));
    } else if (targetSide === 'ask' && metrics?.bestAsk) {
      setPrice(metrics.bestAsk.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setOrderNotice(null);
    clearError();

    const parsedQty = parseInt(quantity, 10);
    const parsedPrice = parseFloat(price);

    const payload = {
      side,
      type,
      price: type === 'market' ? undefined : isNaN(parsedPrice) ? undefined : parsedPrice,
      quantity: isNaN(parsedQty) ? 0 : parsedQty,
      clientId: 'user-terminal',
    };

    // 1. Client-side Zod validation
    const result = clientOrderSchema.safeParse(payload);
    if (!result.success) {
      const errorMsg = result.error.errors[0]?.message || 'Invalid order parameters';
      setValidationError(errorMsg);
      return;
    }

    // 2. Dispatch to engine
    const res = await submitOrder(payload);
    if (res.success) {
      setOrderNotice({
        type: 'success',
        message: `${side.toUpperCase()} ${type.toUpperCase()} of ${parsedQty} submitted successfully`,
      });
    } else {
      setOrderNotice({
        type: 'error',
        message: res.message || 'Order was rejected by matching engine',
      });
    }
  };

  const notional =
    type === 'market'
      ? metrics?.midPrice ? (metrics.midPrice * (parseInt(quantity, 10) || 0)).toFixed(2) : '—'
      : ((parseFloat(price) || 0) * (parseInt(quantity, 10) || 0)).toFixed(2);

  return (
    <div className="w-full bg-[#0d1322] border border-slate-800/80 rounded-xl p-4 shadow-xl shadow-black/20 flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
        <h2 className="text-base font-medium text-slate-200">
          Order Entry Ticket
        </h2>
        <span className="text-xs text-slate-400 font-mono">
          FIFO Priority
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Buy / Sell Side Selector */}
        <div className="grid grid-cols-2 gap-2 bg-[#090e1a] p-1 rounded-lg border border-slate-800/60">
          <button
            type="button"
            onClick={() => setSide('buy')}
            className={`py-2 px-3 rounded-md text-sm font-medium transition-all duration-150 ${
              side === 'buy'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            BUY / BID
          </button>
          <button
            type="button"
            onClick={() => setSide('sell')}
            className={`py-2 px-3 rounded-md text-sm font-medium transition-all duration-150 ${
              side === 'sell'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            SELL / ASK
          </button>
        </div>

        {/* Order Type Dropdown */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
            Order Type
          </label>
          <div className="grid grid-cols-4 gap-1.5 bg-[#090e1a] p-1 rounded-lg border border-slate-800/60">
            {(['market', 'limit', 'ioc', 'fok'] as OrderType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-1.5 px-2 rounded text-xs font-medium uppercase transition-all duration-100 ${
                  type === t
                    ? 'bg-slate-700 text-slate-100 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {type === 'market' && 'Executes immediately across available book depth; excess impacts price.'}
            {type === 'limit' && 'Rests in FIFO queue if non-crossing; aggressive execution if marketable.'}
            {type === 'ioc' && 'Immediate-or-Cancel: Fills immediately at limit or better; remainder cancelled.'}
            {type === 'fok' && 'Fill-or-Kill: Requires 100% full fill immediately or rejected with 0 fills.'}
          </div>
        </div>

        {/* Price Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Limit Price (USD)
            </label>
            {type !== 'market' && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setBboPrice('bid')}
                  className="text-emerald-400 hover:underline"
                >
                  Best Bid
                </button>
                <span className="text-slate-600">/</span>
                <button
                  type="button"
                  onClick={() => setBboPrice('ask')}
                  className="text-rose-400 hover:underline"
                >
                  Best Ask
                </button>
              </div>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-500 font-mono text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              disabled={type === 'market'}
              value={type === 'market' ? 'MARKET PRICE' : price}
              onChange={(e) => setPrice(e.target.value)}
              className={`w-full bg-[#090e1a] border border-slate-800 rounded-lg pl-7 pr-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-slate-600 ${
                type === 'market' ? 'opacity-50 cursor-not-allowed bg-slate-900/40 text-slate-500' : ''
              }`}
            />
          </div>
        </div>

        {/* Quantity Input with Quick Presets */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
            Quantity (Contracts / Shares)
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full bg-[#090e1a] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-slate-600"
          />
          <div className="flex gap-1.5 mt-2">
            {[10, 25, 50, 100, 250].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setQuantity(amt.toString())}
                className="flex-1 py-1 text-[11px] bg-slate-800/60 hover:bg-slate-700/60 rounded text-slate-300 font-mono transition-colors"
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Notional Value Estimation */}
        <div className="bg-[#090e1a] border border-slate-800/60 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
          <span className="text-slate-400">Est. Order Notional:</span>
          <span className="font-mono text-slate-200 font-medium">${notional}</span>
        </div>

        {/* Error or Rejection Alert */}
        {(validationError || lastErrorMessage || (orderNotice && orderNotice.type === 'error')) && (
          <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex flex-col gap-1">
            <span className="font-semibold flex items-center gap-1.5">
              <span>⚠</span> Order Execution Notice:
            </span>
            <span>{validationError || lastErrorMessage || orderNotice?.message}</span>
          </div>
        )}

        {/* Success Alert */}
        {orderNotice && orderNotice.type === 'success' && (
          <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-1.5">
            <span>✔</span> {orderNotice.message}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-150 shadow-lg ${
            side === 'buy'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
              : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
          } ${isSubmitting ? 'opacity-50 cursor-wait' : ''}`}
        >
          {isSubmitting
            ? 'Transmitting Order...'
            : `${side === 'buy' ? 'Submit BUY' : 'Submit SELL'} (${type.toUpperCase()})`}
        </button>
      </form>
    </div>
  );
};
