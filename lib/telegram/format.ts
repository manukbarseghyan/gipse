import { formatAmd } from "@/lib/format";
import type { PaymentMethod } from "@/types/database";

// Messages are written in Armenian (the shop owner's language) and sent with
// parse_mode=HTML, so every user-supplied value is HTML-escaped.

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type TelegramOrder = {
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_notes: string | null;
  customer_note: string | null;
  payment_method: PaymentMethod;
  subtotal_amd: number;
  delivery_fee_amd: number;
  total_amd: number;
};

export type TelegramOrderItem = {
  product_name_snapshot: string;
  quantity: number;
  unit_price_amd: number;
  line_total_amd: number;
};

const paymentLabels: Record<PaymentMethod, string> = {
  cash_on_delivery: "Կանխիկ՝ ստանալիս",
  card: "Քարտով առցանց",
};

const TELEGRAM_LIMIT = 4096;

function formatYerevanTime(iso: string): string {
  return new Intl.DateTimeFormat("hy-AM", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Yerevan",
  }).format(new Date(iso));
}

export function buildOrderMessage(order: TelegramOrder, items: readonly TelegramOrderItem[], adminUrl?: string): string {
  const header = [
    `🛍 <b>Նոր պատվեր ${escapeHtml(order.order_number)}</b>`,
    `🕒 ${escapeHtml(formatYerevanTime(order.created_at))}`,
    "",
    `👤 <b>Հաճախորդ՝</b> ${escapeHtml(order.customer_name)}`,
    `📞 <b>Հեռախոս՝</b> ${escapeHtml(order.customer_phone)}`,
    `📍 <b>Հասցե՝</b> ${escapeHtml(order.delivery_address)}`,
  ];
  if (order.delivery_notes) header.push(`🚚 <b>Առաքման նշում՝</b> ${escapeHtml(order.delivery_notes)}`);
  if (order.customer_note) header.push(`💬 <b>Մեկնաբանություն՝</b> ${escapeHtml(order.customer_note)}`);

  const footer = [
    "",
    `Ապրանքներ՝ ${formatAmd(order.subtotal_amd)}`,
    `Առաքում՝ ${formatAmd(order.delivery_fee_amd)}`,
    `<b>Ընդամենը՝ ${formatAmd(order.total_amd)}</b>`,
    `💳 Վճարում՝ ${paymentLabels[order.payment_method]}`,
  ];
  if (adminUrl) footer.push("", `<a href="${escapeHtml(adminUrl)}">Բացել ադմին վահանակում</a>`);

  const itemLines = items.map(
    (item, index) =>
      `${index + 1}. ${escapeHtml(item.product_name_snapshot)} — ${item.quantity} × ${formatAmd(item.unit_price_amd)} = ${formatAmd(item.line_total_amd)}`,
  );

  const assemble = (lines: string[]) => [...header, "", "<b>Ապրանքներ՝</b>", ...lines, ...footer].join("\n");

  let message = assemble(itemLines);
  // Very large orders: trim the item list rather than fail the whole message.
  let shown = itemLines.length;
  while (message.length > TELEGRAM_LIMIT && shown > 1) {
    shown -= 1;
    message = assemble([...itemLines.slice(0, shown), `… և ևս ${itemLines.length - shown} ապրանք (տես ադմին վահանակում)`]);
  }
  return message;
}
