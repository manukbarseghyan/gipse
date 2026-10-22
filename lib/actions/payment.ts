"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { getPaymentProvider } from "@/lib/payments";
import { startCardPayment } from "@/lib/payments/service";
import { getPublicOrder } from "@/lib/orders/public-order";
import { isLocale } from "@/lib/i18n/config";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

/** "Pay by card" / "Try again" on the order page. Redirects to the bank's payment page. */
export async function startPaymentAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const localeRaw = String(formData.get("locale") ?? "hy");
  const locale = isLocale(localeRaw) ? localeRaw : "hy";
  const back = `/${locale}/order/${encodeURIComponent(token)}`;

  const db = createServiceClient();
  const provider = getPaymentProvider();
  if (!db || !provider) redirect(`${back}?payment=unavailable`);

  if (await isRateLimited(db, "payment-start", await getClientIp(), 10, 600)) redirect(`${back}?payment=unavailable`);

  const order = await getPublicOrder(db, token);
  if (!order) redirect(`/${locale}`);

  const result = await startCardPayment(db, provider, order.id, locale);
  if (!result.ok) redirect(`${back}?payment=unavailable`);
  redirect(result.redirectUrl);
}
