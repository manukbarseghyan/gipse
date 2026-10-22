import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPaymentProvider } from "@/lib/payments";
import { syncLatestPaymentForOrder } from "@/lib/payments/service";
import { getPublicOrder } from "@/lib/orders/public-order";
import { isLocale } from "@/lib/i18n/config";

/**
 * The bank redirects the customer here after the payment page. We do NOT
 * trust anything in this URL: it only tells us which order to re-check, and
 * the status is fetched from the gateway server-to-server.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const localeParam = request.nextUrl.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : "hy";

  const db = createServiceClient();
  const provider = getPaymentProvider();
  const order = db ? await getPublicOrder(db, token) : null;
  if (!order) return NextResponse.redirect(new URL(`/${locale}`, request.url));

  if (db && provider) {
    await syncLatestPaymentForOrder(db, provider, order.id);
  }
  return NextResponse.redirect(new URL(`/${locale}/order/${order.public_token}`, request.url), { status: 303 });
}
