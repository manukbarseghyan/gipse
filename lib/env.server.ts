import "server-only";

export function getSupabaseSecretKey(): string | null {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function getTelegramConfig(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  return { token, chatId };
}

export function getCronSecret(): string | null {
  const secret = process.env.CRON_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

export type ArcaConfig = {
  baseUrl: string;
  username: string;
  password: string;
  callbackSecret: string | null;
};

export function getArcaConfig(): ArcaConfig | null {
  const baseUrl = process.env.ARCA_API_BASE_URL;
  const username = process.env.ARCA_USERNAME;
  const password = process.env.ARCA_PASSWORD;
  if (!baseUrl || !username || !password) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    username,
    password,
    callbackSecret: process.env.ARCA_CALLBACK_SECRET || null,
  };
}
