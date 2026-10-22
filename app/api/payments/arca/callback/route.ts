import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPaymentProvider } from "@/lib/payments";
import { syncPaymentStatus } from "@/lib/payments/service";

/**
 * ArCa callback notification (configure this URL with your bank:
 * https://<site>/api/payments/arca/callback). Sent as GET with query params
 * mdOrder, orderNumber, operation, status[, checksum].
 *
 * When ARCA_CALLBACK_SECRET is set, the checksum must verify or the request is
 * rejected. Either way, the order is only marked paid after an authenticated
 * server-to-server status check, so a forged callback cannot fake a payment.
 */
async function handle(request: NextRequest) {
  const provider = getPaymentProvider();
  const db = createServiceClient();
  if (!provider || !db) return new NextResponse("not configured", { status: 503 });

  const params = request.nextUrl.searchParams;
  if (!provider.verifyCallback(params)) {
    console.warn("[payments] rejected callback with invalid checksum");
    return new NextResponse("invalid signature", { status: 403 });
  }

  const providerOrderId = params.get("mdOrder");
  if (!providerOrderId || !/^[A-Za-z0-9-]{1,64}$/.test(providerOrderId)) {
    return new NextResponse("bad request", { status: 400 });
  }

  const outcome = await syncPaymentStatus(db, provider, providerOrderId);
  // Ask the gateway to retry later if we could not reach it.
  if (outcome === "gateway_error") return new NextResponse("retry", { status: 503 });
  return new NextResponse("OK", { status: 200 });
}

export const GET = handle;
export const POST = handle;
