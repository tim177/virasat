import { bagRequestSchema } from "@/lib/bag-schema";
import { quoteBag } from "@/lib/checkout";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Current prices and availability for the shopper's bag. Prices always come from our database.
export async function POST(request: Request) {
  if (!rateLimit(`quote:${clientIp(request)}`, 60, 60_000)) return tooManyRequests();

  const body = bagRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid_bag" }, { status: 400 });

  const bag = await quoteBag(body.data.lines);
  return Response.json(bag, { headers: { "Cache-Control": "no-store" } });
}
