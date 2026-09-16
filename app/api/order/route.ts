import { z } from 'zod';
import { getGlobalSimulator } from '@/lib/engine/simulator';

export const dynamic = 'force-dynamic';

const orderSchema = z
  .object({
    side: z.enum(['buy', 'sell']),
    type: z.enum(['market', 'limit', 'ioc', 'fok']),
    price: z.number().positive().optional(),
    quantity: z.number().int().positive({ message: 'Quantity must be a positive integer' }),
    clientId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type !== 'market') {
        return typeof data.price === 'number' && data.price > 0;
      }
      return true;
    },
    {
      message: 'Price is required and must be positive for Limit, IOC, and FOK orders',
      path: ['price'],
    }
  );

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parseResult = orderSchema.safeParse(json);

    if (!parseResult.success) {
      return Response.json(
        {
          success: false,
          error: parseResult.error.errors[0]?.message || 'Invalid order parameters',
        },
        { status: 400 }
      );
    }

    const simulator = getGlobalSimulator();
    const result = simulator.submitOrder(parseResult.data);

    if (!result.success) {
      return Response.json(
        {
          success: false,
          error: result.rejectionReason || 'Order rejected by matching engine',
          result,
        },
        { status: 422 }
      );
    }

    return Response.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return Response.json(
      {
        success: false,
        error: err.message || 'Internal server error processing order',
      },
      { status: 500 }
    );
  }
}
