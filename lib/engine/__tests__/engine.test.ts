import { OrderBook } from '../orderbook';
import { MatchingEngine } from '../matching';
import { calculateSpreadMetrics } from '../../metrics/spread';
import { calculateOBI, OFICalculator } from '../../metrics/imbalance';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- Starting Matching Engine & Microstructure Metrics Verification ---');

// 1. OrderBook & FIFO Verification
{
  const book = new OrderBook();
  book.addRestingOrder({
    id: 'bid-1',
    side: 'buy',
    type: 'limit',
    price: 100.0,
    quantity: 100,
    remainingQty: 100,
    timestamp: 1000,
  });
  book.addRestingOrder({
    id: 'bid-2',
    side: 'buy',
    type: 'limit',
    price: 100.0,
    quantity: 50,
    remainingQty: 50,
    timestamp: 1005,
  });

  const bids = book.getSortedBids();
  assert(bids.length === 1, 'Should have 1 bid level');
  assert(bids[0].price === 100.0, 'Bid level price should be 100.0');
  assert(bids[0].totalQuantity === 150, 'Total quantity should be 150');
  assert(bids[0].orders[0].id === 'bid-1', 'First in queue must be bid-1 (FIFO)');
  assert(bids[0].orders[1].id === 'bid-2', 'Second in queue must be bid-2 (FIFO)');
  console.log('✔ OrderBook FIFO queue verified');
}

// 2. Matching Engine: Market Order Walking the Book
{
  const book = new OrderBook();
  const engine = new MatchingEngine(book);

  book.addRestingOrder({
    id: 'ask-1',
    side: 'sell',
    type: 'limit',
    price: 101.0,
    quantity: 100,
    remainingQty: 100,
    timestamp: 1000,
  });
  book.addRestingOrder({
    id: 'ask-2',
    side: 'sell',
    type: 'limit',
    price: 102.0,
    quantity: 100,
    remainingQty: 100,
    timestamp: 1001,
  });

  // Execute buy market order for 150
  const { result } = engine.processOrder(
    { side: 'buy', type: 'market', quantity: 150 },
    100.0
  );

  assert(result.success, 'Market order should succeed');
  assert(result.status === 'filled', 'Should be filled');
  assert(result.filledQuantity === 150, 'Filled qty should be 150');
  assert(result.trades.length === 2, 'Should have 2 fills across 2 levels');
  assert(result.trades[0].price === 101.0 && result.trades[0].quantity === 100, 'First trade at 101 for 100');
  assert(result.trades[1].price === 102.0 && result.trades[1].quantity === 50, 'Second trade at 102 for 50');
  assert(book.getAsks()[0].quantity === 50, 'Remaining ask quantity at 102 should be 50');
  console.log('✔ Market order book walking verified');
}

// 3. FOK: Feasibility Rejection vs Execution
{
  const book = new OrderBook();
  const engine = new MatchingEngine(book);

  book.addRestingOrder({
    id: 'ask-1',
    side: 'sell',
    type: 'limit',
    price: 105.0,
    quantity: 40,
    remainingQty: 40,
    timestamp: 1000,
  });

  // FOK order for 50 at limit 105 -> insufficient depth (only 40 available)
  const rej = engine.processOrder(
    { side: 'buy', type: 'fok', price: 105.0, quantity: 50 },
    100.0
  );
  assert(rej.result.status === 'rejected', 'FOK order must reject on insufficient depth');
  assert(book.getAsks()[0].quantity === 40, 'Book must remain completely untouched on FOK rejection');

  // FOK order for 40 at limit 105 -> exact match feasible
  const exec = engine.processOrder(
    { side: 'buy', type: 'fok', price: 105.0, quantity: 40 },
    100.0
  );
  assert(exec.result.status === 'filled', 'FOK order must fill completely when feasible');
  assert(book.getAsks().length === 0, 'Book should now be empty');
  console.log('✔ FOK all-or-none logic verified');
}

// 4. IOC: Partial Fill and Cancel Remainder
{
  const book = new OrderBook();
  const engine = new MatchingEngine(book);

  book.addRestingOrder({
    id: 'ask-1',
    side: 'sell',
    type: 'limit',
    price: 100.5,
    quantity: 30,
    remainingQty: 30,
    timestamp: 1000,
  });

  // IOC buy for 80 at 100.5 -> matches 30, cancels remaining 50
  const { result } = engine.processOrder(
    { side: 'buy', type: 'ioc', price: 100.5, quantity: 80 },
    100.0
  );
  assert(result.filledQuantity === 30, 'IOC should fill 30');
  assert(result.status === 'partially_filled', 'IOC status should be partially_filled');
  assert(book.getSortedBids().length === 0, 'IOC remaining quantity must NOT rest in the book');
  console.log('✔ IOC execution & cancel remainder verified');
}

// 5. Microprice & Spread Math
{
  // Best bid 100 (qty 800), Best ask 101 (qty 200)
  // Large bid size (buying pressure) -> microprice should pull toward ask (100.8)
  const m = calculateSpreadMetrics(100, 800, 101, 200);
  assert(m.spread === 1.0, 'Spread should be 1.0');
  assert(m.midPrice === 100.5, 'Mid price should be 100.5');
  // microprice = (100 * 200 + 101 * 800) / 1000 = (20000 + 80800) / 1000 = 100.8
  assert(m.microprice === 100.8, `Microprice should be 100.8, got ${m.microprice}`);
  console.log('✔ Microprice asymmetric volume weighting verified');
}

// 6. Cont-Kukanov-Stoikov OFI Event Calculation
{
  const ofi = new OFICalculator(10);
  // Event 0: initial state bid 100 (100), ask 101 (100)
  ofi.update({ bidPrice: 100, bidQty: 100, askPrice: 101, askQty: 100 });

  // Event 1: bid price increases to 100.5 (qty 50) -> bidTerm = +50, ask unchanged -> OFI_1 = +50
  const ofi1 = ofi.update({ bidPrice: 100.5, bidQty: 50, askPrice: 101, askQty: 100 });
  assert(ofi1 === 50, `OFI should be +50 after bid uptick, got ${ofi1}`);

  // Event 2: bid price same (100.5), bidQty drops to 30 (cancellation or trade) -> bidTerm = 30 - 50 = -20
  const ofi2 = ofi.update({ bidPrice: 100.5, bidQty: 30, askPrice: 101, askQty: 100 });
  assert(ofi2 === 30, `Rolling OFI should be 50 + (-20) = 30, got ${ofi2}`);
  console.log('✔ Cont-Kukanov-Stoikov OFI event math verified');
}

console.log('--- All Microstructure & Matching Engine Tests Passed Successfully! ---');
