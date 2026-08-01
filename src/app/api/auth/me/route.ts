import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — текущий пользователь сессии или null. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
