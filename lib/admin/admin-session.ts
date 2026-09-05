import "server-only";
import type { NextRequest } from "next/server";

export function isAdminRequest(request: Pick<NextRequest, "cookies">) {
  const expected = process.env.ADMIN_SESSION_TOKEN;
  return Boolean(expected && request.cookies.get("dc_admin")?.value === expected);
}
