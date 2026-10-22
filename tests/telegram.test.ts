import { describe, expect, it, vi } from "vitest";
import { buildOrderMessage, escapeHtml } from "@/lib/telegram/format";
import { redactToken, sendTelegramMessage } from "@/lib/telegram/client";
import { notifyNewOrder } from "@/lib/telegram/notify";
import type { ServiceClient } from "@/lib/supabase/service";

const TOKEN = "123456:SECRET-token_value";
const config = { token: TOKEN, chatId: "-1001234" };

const order = {
  id: "o1",
  order_number: "GP-1001",
  created_at: "2026-10-21T10:00:00Z",
  customer_name: "Anna <b>Petrosyan</b>",
  customer_phone: "+37477123456",
  delivery_address: "Yerevan & Abovyan 1",
  delivery_notes: "Ring <twice>",
  customer_note: null,
  payment_method: "cash_on_delivery" as const,
  subtotal_amd: 13500,
  delivery_fee_amd: 1000,
  total_amd: 14500,
};
const items = [
  { product_name_snapshot: "Հրեշտակ", quantity: 2, unit_price_amd: 5000, line_total_amd: 10000 },
  { product_name_snapshot: "Կատու", quantity: 1, unit_price_amd: 3500, line_total_amd: 3500 },
];

describe("telegram message formatting", () => {
  it("escapes HTML in user-supplied content", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
    const text = buildOrderMessage(order, items);
    expect(text).toContain("Anna &lt;b&gt;Petrosyan&lt;/b&gt;");
    expect(text).toContain("Yerevan &amp; Abovyan 1");
    expect(text).not.toContain("<twice>");
  });

  it("includes every required order detail", () => {
    const text = buildOrderMessage(order, items, "https://gipse.am/admin/orders/o1");
    for (const expected of ["GP-1001", "+37477123456", "Հրեշտակ", "2 × 5,000", "10,000", "Կատու", "13,500", "1,000", "14,500", "Կանխիկ"]) {
      expect(text).toContain(expected);
    }
    expect(text).toContain('href="https://gipse.am/admin/orders/o1"');
  });

  it("stays under Telegram's 4096 character limit for huge orders", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ ...items[0]!, product_name_snapshot: `Արձանիկ համար ${i} `.repeat(3) }));
    const text = buildOrderMessage(order, many);
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text).toContain("14,500");
  });
});

describe("sendTelegramMessage", () => {
  it("posts HTML messages to the configured chat", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect(await sendTelegramMessage(config, "hi", fetchImpl as typeof fetch)).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(JSON.parse(String(init.body))).toMatchObject({ chat_id: "-1001234", text: "hi", parse_mode: "HTML" });
  });

  it("classifies API errors and never leaks the token", async () => {
    const unauthorized = vi.fn(async () => new Response(JSON.stringify({ description: `Unauthorized for ${TOKEN}` }), { status: 401 }));
    const result = await sendTelegramMessage(config, "hi", unauthorized as typeof fetch);
    expect(result).toMatchObject({ ok: false, retryable: false });
    expect(JSON.stringify(result)).not.toContain(TOKEN);

    const outage = vi.fn(async () => new Response("bad gateway", { status: 502 }));
    expect(await sendTelegramMessage(config, "hi", outage as typeof fetch)).toMatchObject({ ok: false, retryable: true, error: "HTTP 502" });
  });

  it("handles network failures", async () => {
    const failing = vi.fn(async () => {
      throw new Error(`connect ECONNREFUSED https://api.telegram.org/bot${TOKEN}/sendMessage`);
    });
    const result = await sendTelegramMessage(config, "hi", failing as typeof fetch);
    expect(result).toMatchObject({ ok: false, retryable: true });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(redactToken(`x${TOKEN}y`, TOKEN)).toBe("x[redacted]y");
  });
});

function fakeServiceDb({ claim = true }: { claim?: boolean } = {}) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "claim_telegram_notification") return { data: claim, error: null };
    return { data: null, error: null };
  });
  const single = vi.fn(async () => ({ data: { ...order, order_items: items }, error: null }));
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ single }) }) }));
  return { db: { rpc, from } as unknown as ServiceClient, rpc, from };
}

describe("notifyNewOrder", () => {
  it("does nothing when Telegram is not configured", async () => {
    const { db, rpc } = fakeServiceDb();
    expect(await notifyNewOrder(db, "o1", { config: null })).toBe("not_configured");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not send when another worker holds the claim (no duplicates)", async () => {
    const { db } = fakeServiceDb({ claim: false });
    const fetchImpl = vi.fn();
    expect(await notifyNewOrder(db, "o1", { config, fetchImpl: fetchImpl as unknown as typeof fetch })).toBe("already_sent_or_in_progress");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("records success", async () => {
    const { db, rpc } = fakeServiceDb();
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await notifyNewOrder(db, "o1", { config, fetchImpl: fetchImpl as typeof fetch })).toBe("sent");
    expect(rpc).toHaveBeenCalledWith("complete_telegram_notification", { p_order_id: "o1", p_error: null });
  });

  it("records a failure without throwing, so the saved order is unaffected", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, rpc } = fakeServiceDb();
    const fetchImpl = vi.fn(async () => new Response("down", { status: 503 }));
    expect(await notifyNewOrder(db, "o1", { config, fetchImpl: fetchImpl as typeof fetch })).toBe("failed");
    expect(rpc).toHaveBeenCalledWith("complete_telegram_notification", { p_order_id: "o1", p_error: "HTTP 503" });
    // Logs carry the order id only — no customer name, phone or address.
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain("Anna");
    expect(logged).not.toContain("+37477123456");
    expect(logged).not.toContain(TOKEN);
  });
});
