// What a customer does while the connection is down must reach the database once it is back.
// Needs the app running (npm run dev), Microsoft Edge and NEXT_PUBLIC_SUPABASE_* in .env.local.
// Run: npm run test:e2e
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);

let browser;

before(async () => {
  browser = await chromium.launch({ channel: "msedge" });
});

after(async () => {
  await browser?.close();
});

async function click(page, label) {
  await page.click(`button:has-text('${label}') >> nth=-1`);
  await wait(1500);
}

// Signs a new customer up and creates an order; returns false when the store is not taking orders.
async function customerWithOrder(context, email) {
  const page = await context.newPage();
  await page.goto(BASE_URL, { timeout: 60000 });
  await page.waitForSelector("text=Continue", { timeout: 60000 });
  await page.fill('input[placeholder="you@example.com"]', email);
  await page.click("form button:not([type=button])");
  await page.waitForSelector("text=Create your PIN", { timeout: 15000 });
  const pins = page.locator("input[inputmode=numeric]");
  await pins.nth(0).fill("123456");
  await pins.nth(1).fill("123456");
  await page.fill("input[placeholder='03001234567']", `03${String(Date.now()).slice(-9)}`);
  await page.click("form button:has-text('Create account')");
  await page.waitForSelector("button:has-text('Buy a Subscription')", { timeout: 30000 });
  await wait(1500);
  await click(page, "Buy a Subscription");
  if (!(await page.isVisible("button:has-text('1 Month')"))) return { page, ok: false };
  await click(page, "1 Month");
  await click(page, "JazzCash");
  await page.click("button:has-text('I agree, create order')");
  await page.waitForSelector("button:has-text('Upload payment screenshot')", { timeout: 15000 });
  await wait(2500);
  return { page, ok: true };
}

async function savedState(email) {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await db.auth.signInWithPassword({ email, password: "123456" });
  const order = (await db.from("orders").select("status").order("created_at", { ascending: false }).limit(1)).data?.[0];
  const cancelMessages = (await db.from("messages").select("id").ilike("text", "%continue this order%")).data?.length ?? 0;
  return { order: order?.status, cancelMessages };
}

test("a cancel made offline is saved when the connection returns", async (t) => {
  const email = `test.off${Date.now() % 1000000}@gmail.com`;
  const context = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const { page, ok } = await customerWithOrder(context, email);
  if (!ok) return t.skip("the store is not taking orders right now");
  for (let tries = 0; tries < 15 && (await savedState(email)).order !== "awaiting_payment"; tries++) await wait(1000);

  await context.setOffline(true);
  await click(page, "Cancel");
  await wait(2000);
  assert.deepEqual(await savedState(email), { order: "awaiting_payment", cancelMessages: 0 }, "nothing reaches the server while offline");

  await context.setOffline(false);
  await wait(12000);
  assert.deepEqual(await savedState(email), { order: "cancelled", cancelMessages: 1 }, "everything arrives once online");
  await context.close();
});

test("a cancel made offline is saved even after the app was closed", async (t) => {
  const email = `test.cls${Date.now() % 1000000}@gmail.com`;
  const context = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const { page, ok } = await customerWithOrder(context, email);
  if (!ok) return t.skip("the store is not taking orders right now");

  await context.setOffline(true);
  await click(page, "Cancel");
  await page.close();
  await context.setOffline(false);

  const reopened = await context.newPage();
  await reopened.goto(BASE_URL, { timeout: 60000 });
  await wait(10000);
  assert.deepEqual(await savedState(email), { order: "cancelled", cancelMessages: 1 });
  await context.close();
});
