import { deleteOldDrafts } from "@/lib/checkout";
import { isCronRequest } from "@/lib/cron-auth";

// Called by cron on the server once a day (Step 6 deploy):
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://www.<domain>/api/cron/drafts
export async function POST(request: Request) {
  if (!isCronRequest(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await deleteOldDrafts();
  return Response.json(result);
}
