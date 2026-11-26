import { getAuth } from "@/lib/auth";

// Better Auth's endpoints (sign-in, two-factor, sign-out, session), under /api/auth/*.
export function GET(request: Request) {
  return getAuth().handler(request);
}

export function POST(request: Request) {
  return getAuth().handler(request);
}
