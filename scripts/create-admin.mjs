#!/usr/bin/env node
// Creates (or promotes) the shop administrator. Run from YOUR machine — this is
// deliberately not a web endpoint.
//
//   ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='a-long-passphrase' \
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/create-admin.mjs
//
// Or put the Supabase variables in .env.local and run: npm run admin:create
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!url || !secret) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or add them to .env.local).");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Set ADMIN_EMAIL to a valid email address.");

const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

let userId = await findUser(email);
if (userId) {
  console.log(`User ${email} already exists — granting admin role.`);
} else {
  if (!password || password.length < 12) fail("Set ADMIN_PASSWORD (at least 12 characters) to create the user.");
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) fail(`Could not create user: ${error.message}`);
  userId = data.user.id;
  console.log(`Created user ${email}.`);
}

const { error } = await db.from("admin_profiles").upsert({ user_id: userId }, { onConflict: "user_id" });
if (error) fail(`Could not grant admin role: ${error.message}`);
console.log(`✔ ${email} is now an administrator. Sign in at /admin/login.`);

async function findUser(target) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not list users: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
