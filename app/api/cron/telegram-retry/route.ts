import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCronSecret } from "@/lib/env.server";
import { notifyNewOrder } from "@/lib/telegram/notify";

const MAX_ATTEMPTS = 6;

function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Retries Telegram notifications that failed (or never ran) for orders from
 * the last 3 days. Invoked by Vercel Cron (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = getCronSecret();
  if (!secret || !authorized(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pending, error } = await db
    .from("orders")
    .select("id")
    .is("telegram_sent_at", null)
    .lt("telegram_attempts", MAX_ATTEMPTS)
    .gte("created_at", since)
    .order("created_at")
    .limit(20);
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });

  const results: Record<string, number> = {};
  for (const order of pending ?? []) {
    const outcome = await notifyNewOrder(db, order.id);
    results[outcome] = (results[outcome] ?? 0) + 1;
  }
  return NextResponse.json({ checked: pending?.length ?? 0, results });
}
