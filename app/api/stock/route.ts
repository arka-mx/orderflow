import { getGlobalYahooService } from '@/lib/engine/yfinance';
import { getGlobalSimulator } from '@/lib/engine/simulator';

export const dynamic = 'force-dynamic';

const VERSATILE_STOCKS = [
  { symbol: 'NVDA', name: 'NVIDIA Corporation', desc: 'World most traded & liquid mega-cap tech stock' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', desc: 'Most actively traded ETF globally' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', desc: 'High beta, massive retail & algo order flow' },
  { symbol: 'AAPL', name: 'Apple Inc.', desc: 'Benchmark consumer tech liquidity' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', desc: 'Nasdaq-100 high-frequency tech benchmark' },
];

export async function GET() {
  const yf = getGlobalYahooService();
  const quote = yf.getQuote();

  return Response.json({
    activeSymbol: yf.getSymbol(),
    quote,
    availableStocks: VERSATILE_STOCKS,
  });
}

export async function POST(req: Request) {
  try {
    const { symbol } = await req.json();
    if (!symbol || typeof symbol !== 'string') {
      return Response.json({ success: false, error: 'Symbol string is required' }, { status: 400 });
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const sim = getGlobalSimulator();
    sim.setSymbol(cleanSymbol);

    return Response.json({ success: true, activeSymbol: cleanSymbol });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
