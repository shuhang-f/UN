import { NextResponse, type NextRequest } from "next/server";
import { checkWebAccess } from "./lib/server/deployment";

export async function middleware(request: NextRequest) {
  // Health probes carry no credentials and disclose no app or provider data.
  if (request.nextUrl.pathname === "/api/health") return NextResponse.next();
  return await checkWebAccess(request) || NextResponse.next();
}

export const config = { matcher: "/:path*" };
