import { isCronRequest } from "@/lib/cron-auth";
import { retryUnsentEmails } from "@/lib/order-emails";

// Called by cron on the server every hour (Step 6 deploy):
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://www.<domain>/api/cron/emails
export async function POST(request: Request) {
  if (!isCronRequest(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await retryUnsentEmails();
  return Response.json(result);
}
