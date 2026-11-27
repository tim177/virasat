import { isCronRequest } from "@/lib/cron-auth";
import { sendFitCallReminders } from "@/lib/order-emails";

// Called once a day by cron on the server (deploy/crontab, scripts/cron.sh fit-calls):
// one "book your fit call" email per custom-fit order still waiting 2 days after payment.
export async function POST(request: Request) {
  if (!isCronRequest(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await sendFitCallReminders());
}
