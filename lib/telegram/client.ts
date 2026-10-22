export type TelegramConfig = { token: string; chatId: string };
export type SendResult = { ok: true } | { ok: false; error: string; retryable: boolean };

const TIMEOUT_MS = 8000;

/** Removes the bot token from any string before it is logged or stored. */
export function redactToken(text: string, token: string): string {
  return token ? text.split(token).join("[redacted]") : text;
}

export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.ok) return { ok: true };

    let description = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { description?: unknown };
      if (typeof body.description === "string") description = `${description}: ${body.description}`;
    } catch {
      // Non-JSON error body; keep the status only.
    }
    // 429 and 5xx are transient; 400/401/403 mean bad config and won't fix themselves.
    const retryable = response.status === 429 || response.status >= 500;
    return { ok: false, error: redactToken(description, config.token).slice(0, 300), retryable };
  } catch (error) {
    const message = error instanceof Error ? (error.name === "AbortError" ? "timeout" : error.message) : "network error";
    return { ok: false, error: redactToken(message, config.token).slice(0, 300), retryable: true };
  } finally {
    clearTimeout(timer);
  }
}
