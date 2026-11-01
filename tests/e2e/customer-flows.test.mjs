// Customer flows that broke before. Needs the app running (npm run dev) and Microsoft Edge.
// Run: npm run test:e2e   (BASE_URL=https://... to test a deployed site)
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

let browser;

before(async () => {
  browser = await chromium.launch({ channel: "msedge" });
});

after(async () => {
  await browser?.close();
});

async function newCustomer(options = {}) {
  const page = await (await browser.newContext({ viewport: { width: 420, height: 860 }, ...options })).newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE_URL, { timeout: 60000 });
  await page.evaluate(() => [1, 2, 3, 4, 5].forEach(() => window.history.pushState(null, "")));
  await page.waitForSelector("text=Continue", { timeout: 60000 });
  await page.fill('input[placeholder="you@example.com"]', `test.e2e${Date.now() % 1000000}@gmail.com`);
  await page.click("form button:not([type=button])");
  await page.waitForSelector("text=Create your PIN", { timeout: 15000 });
  const pins = page.locator("input[inputmode=numeric]");
  await pins.nth(0).fill("123456");
  await pins.nth(1).fill("123456");
  await page.fill("input[placeholder='03001234567']", `03${String(Date.now()).slice(-9)}`);
  await page.click("form button:has-text('Create account')");
  await page.waitForSelector("button:has-text('Buy a Subscription')", { timeout: 30000 });
  await wait(1500);
  return { page, errors };
}

async function click(page, label) {
  await page.click(`button:has-text('${label}') >> nth=-1`);
  await wait(1200);
}

// Closed menu buttons still answer a tap with a pop-up, so they are tapped even though they look disabled.
async function tapClosed(page, label) {
  await page.click(`button:has-text('${label}') >> nth=-1`, { force: true });
  await wait(800);
}

async function createOrder(page) {
  await click(page, "Buy a Subscription");
  if (!(await page.isVisible("button:has-text('1 Month')"))) return false; // Store is closed for new orders.
  await click(page, "1 Month");
  await click(page, "JazzCash");
  await page.click("button:has-text('I agree, create order'), button:has-text('Create order')");
  await page.waitForSelector("button:has-text('Upload payment screenshot')", { timeout: 15000 });
  return true;
}

test("the chat shows the privacy note and the day", async () => {
  const { page, errors } = await newCustomer();
  assert.ok(await page.isVisible("text=Private chat. Messages are deleted after 15 days."));
  assert.ok(await page.isVisible("text=Today"), "the day divider is shown");
  assert.deepEqual(errors, []);
});

test("a payment problem shows the steps and app issues stay open", async (t) => {
  const { page, errors } = await newCustomer();
  if (!(await createOrder(page))) return t.skip("the store is not taking orders right now");
  await click(page, "Problem?");
  assert.ok(await page.isVisible("text=Go to Customer Support and select Other issues."), "the steps are shown");
  assert.equal(await page.locator("textarea").count(), 0, "no report form");
  await click(page, "Got it");
  await click(page, "Cancel");
  if (await page.isVisible("button:has-text('Main menu')")) await click(page, "Main menu");
  await click(page, "Customer Support");
  await click(page, "Other issues");
  if (await page.isVisible("text=can't take new requests")) return t.skip("the store is not taking requests right now");
  assert.ok(await page.isVisible("textarea"), "an app issue can still be sent");
  assert.deepEqual(errors, []);
});

test("while an app issue is open both menu buttons are closed and explain why", async (t) => {
  const { page, errors } = await newCustomer();
  await click(page, "Customer Support");
  if (await page.isVisible("text=Admin not available")) return t.skip("the store is closed right now");
  await click(page, "Other issues");
  if (!(await page.isVisible("textarea"))) return t.skip("the store is not taking requests right now");
  await page.fill("textarea", "First app issue in the end-to-end test.");
  await (await page.$("input[type=file]")).setInputFiles({ name: "issue.png", mimeType: "image/png", buffer: tinyPng });
  await click(page, "Send to our team");
  await wait(2500);

  await click(page, "Main menu");
  assert.ok(await page.isVisible("text=Your request is with our team. The menu opens again once it is resolved."), "the menu says why it is closed");
  await tapClosed(page, "Customer Support");
  assert.ok(await page.isVisible("text=Request open"), "a tap explains in a pop-up");
  assert.equal(await page.locator("text=How can we help?").count(), 1, "support did not open again");
  await click(page, "Got it");
  await tapClosed(page, "Buy a Subscription");
  assert.ok(await page.isVisible("text=Request open"), "buying is closed too");
  await click(page, "Got it");
  assert.equal(await page.locator("button:has-text('Go to my request')").count(), 0, "no way around the closed menu");
  assert.ok(!(await page.isVisible("textarea")), "no message box while a request is open");
  assert.deepEqual(errors, []);
});

test("after a payment proof both menu buttons are closed until the admin decides", async (t) => {
  const { page, errors } = await newCustomer();
  if (!(await createOrder(page))) return t.skip("the store is not taking orders right now");
  await click(page, "Upload payment screenshot");
  await (await page.$("input[type=file]")).setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: tinyPng });
  await page.fill("input[placeholder='e.g. Usman']", "Ali Raza");
  await click(page, "Submit for verification");
  await wait(3000);

  assert.ok(await page.isVisible("text=Your payment is being verified. The menu opens again once we approve it."), "the menu says why it is closed");
  await tapClosed(page, "Buy a Subscription");
  assert.ok(await page.isVisible("text=Payment being verified"), "a tap explains in a pop-up");
  await click(page, "Got it");
  await tapClosed(page, "Customer Support");
  assert.ok(await page.isVisible("text=Payment being verified"), "support is closed too");
  assert.equal(await page.locator("text=How can we help?").count(), 0, "support did not open");
  assert.ok(!(await page.isVisible("textarea")), "no message box");
  assert.deepEqual(errors, []);
});

test("a browser inside another app is told to open Chrome", async (t) => {
  const userAgent = "Mozilla/5.0 (Linux; Android 13; SM-A135F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 FB_IAB/FB4A";
  const { page, errors } = await newCustomer({ userAgent });
  if (!(await createOrder(page))) return t.skip("the store is not taking orders right now");
  await click(page, "Upload payment screenshot");
  const link = page.locator("a:has-text('Open in Chrome')");
  assert.equal(await link.count(), 1);
  assert.match(await link.getAttribute("href"), /^intent:\/\/.*package=com\.android\.chrome/);
  assert.deepEqual(errors, []);
});

test("the proof sheet comes back when the page reloads while the picker is open", async (t) => {
  const { page, errors } = await newCustomer();
  if (!(await createOrder(page))) return t.skip("the store is not taking orders right now");
  await click(page, "Upload payment screenshot");
  const chooser = page.waitForEvent("filechooser");
  await page.click("button:has-text('Choose screenshot')");
  await chooser;
  await page.reload();
  await page.waitForSelector("text=The page reloaded while your picture was opening", { timeout: 30000 });
  assert.ok(await page.isVisible("text=Upload payment screenshot"), "the sheet is open again");
  assert.deepEqual(errors, []);
});

test("a browser without file.arrayBuffer can still add a picture", async (t) => {
  const { page, errors } = await newCustomer();
  if (!(await createOrder(page))) return t.skip("the store is not taking orders right now");
  await page.evaluate(() => {
    delete Blob.prototype.arrayBuffer;
  });
  await click(page, "Upload payment screenshot");
  await (await page.$("input[type=file]")).setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: tinyPng });
  await page.waitForSelector("img[alt='Selected screenshot']", { timeout: 15000 });
  assert.equal(await page.locator("text=This picture couldn't be opened").count(), 0);
  assert.deepEqual(errors, []);
});

test("a very large picture is refused before it is read", async (t) => {
  const { page, errors } = await newCustomer();
  if (!(await createOrder(page))) return t.skip("the store is not taking orders right now");
  await click(page, "Upload payment screenshot");
  await (await page.$("input[type=file]")).setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.alloc(21 * 1024 * 1024) });
  await page.waitForSelector("text=This picture is too large", { timeout: 15000 });
  assert.deepEqual(errors, []);
});

test("a failed upload is tried again without the customer noticing", async (t) => {
  const { page, errors } = await newCustomer();
  if (!(await createOrder(page))) return t.skip("the store is not taking orders right now");
  let failures = 0;
  await page.route("**/storage/v1/object/**", (route) => (route.request().method() === "POST" && failures++ < 2 ? route.abort() : route.continue()));
  await click(page, "Upload payment screenshot");
  await (await page.$("input[type=file]")).setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: tinyPng });
  await page.fill("input[placeholder='e.g. Usman']", "Ali Raza");
  await click(page, "Submit for verification");
  await page.waitForSelector("text=Payment proof submitted", { timeout: 15000 });
  assert.equal(failures >= 2, true);
  assert.equal(await page.locator("text=Could not upload").count(), 0);
  assert.deepEqual(errors, []);
});

test("a proof the server refuses stays in the sheet with a clear reason", async (t) => {
  const { page, errors } = await newCustomer();
  if (!(await createOrder(page))) return t.skip("the store is not taking orders right now");
  await page.route("**/rest/v1/orders**", (route) =>
    route.request().method() === "PATCH" ? route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "This order has expired" }) }) : route.continue()
  );
  await click(page, "Upload payment screenshot");
  await (await page.$("input[type=file]")).setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: tinyPng });
  await page.fill("input[placeholder='e.g. Usman']", "Ali Raza");
  await click(page, "Submit for verification");
  await page.waitForSelector("text=Your payment time ended", { timeout: 15000 });
  assert.equal(await page.locator("text=Payment proof submitted").count(), 0, "the chat does not claim it was sent");
  assert.deepEqual(errors, []);
});

test("tapping create order twice makes only one order", async (t) => {
  const { page, errors } = await newCustomer();
  await click(page, "Buy a Subscription");
  if (!(await page.isVisible("button:has-text('1 Month')"))) return t.skip("the store is not taking orders right now");
  await click(page, "1 Month");
  await click(page, "JazzCash");
  await page.dblclick("button:has-text('I agree, create order')");
  await wait(3000);
  assert.equal(await page.locator("text=/^Order PS-/i").count(), 1, "one payment card");
  assert.equal(await page.locator("text=Create order").count(), 1, "one Create order message");
  assert.deepEqual(errors, []);
});

test("a picked screenshot opens full size and closes again", async (t) => {
  const { page, errors } = await newCustomer();
  await click(page, "Customer Support");
  if (await page.isVisible("text=Admin not available")) return t.skip("the store is closed right now");
  await click(page, "Other issues");
  if (!(await page.isVisible("textarea"))) return t.skip("the store is not taking requests right now");
  await page.fill("textarea", "Screenshot viewer in the end-to-end test.");
  await (await page.$("input[type=file]")).setInputFiles({ name: "issue.png", mimeType: "image/png", buffer: tinyPng });
  await click(page, "Send to our team");
  await wait(3000);
  await page.click("button[aria-label='Open Attached screenshot']");
  assert.ok(await page.isVisible("[role=dialog][aria-label='Attached screenshot']"));
  await page.keyboard.press("Escape");
  assert.ok(!(await page.isVisible("[role=dialog][aria-label='Attached screenshot']")));
  assert.deepEqual(errors, []);
});

test("a picture an old browser cannot shrink is still sent, and an unreadable one explains why", async (t) => {
  const { page, errors } = await newCustomer();
  await click(page, "Customer Support");
  if (await page.isVisible("text=Admin not available")) return t.skip("the store is closed right now");
  await click(page, "Other issues");
  if (!(await page.isVisible("textarea"))) return t.skip("the store is not taking requests right now");

  await page.evaluate(() => {
    // Like an old browser that cannot draw the picture on a canvas.
    HTMLCanvasElement.prototype.toDataURL = () => "data:,";
  });
  await (await page.$("input[type=file]")).setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: tinyPng });
  await page.waitForSelector("img[alt='Selected screenshot']", { timeout: 5000 });
  assert.ok((await page.getAttribute("img[alt='Selected screenshot']", "src")).startsWith("data:image/png"), "the original PNG is used");
  assert.ok(await page.isVisible("text=Your browser is out of date. Please update it for a smoother experience."), "asks to update the browser");

  await page.click("text=Remove screenshot");
  await (await page.$("input[type=file]")).setInputFiles({ name: "photo.heic", mimeType: "", buffer: Buffer.from("not really a picture") });
  await page.waitForSelector("text=This picture couldn't be opened.", { timeout: 5000 });
  assert.ok(!(await page.isVisible("img[alt='Selected screenshot']")));
  assert.deepEqual(errors, []);
});

test("creating an account needs a valid 11-digit WhatsApp number", async () => {
  const page = await (await browser.newContext({ viewport: { width: 420, height: 860 } })).newPage();
  await page.goto(BASE_URL, { timeout: 60000 });
  await page.waitForSelector("text=Continue", { timeout: 60000 });
  await page.fill('input[placeholder="you@example.com"]', `test.e2e${Date.now() % 1000000}@gmail.com`);
  await page.click("form button:not([type=button])");
  await page.waitForSelector("text=Create your PIN", { timeout: 15000 });
  const pins = page.locator("input[inputmode=numeric]");
  await pins.nth(0).fill("123456");
  await pins.nth(1).fill("123456");
  await page.fill("input[placeholder='03001234567']", "03abc12-345");
  assert.equal(await page.inputValue("input[placeholder='03001234567']"), "0312345", "letters and signs are dropped");
  await page.click("form button:has-text('Create account')");
  assert.ok(await page.isVisible("text=Please enter your 11-digit WhatsApp number, like 03001234567."));
});

test("a phone that draws the picture blank sends the original instead of a black image", async (t) => {
  const { page, errors } = await newCustomer();
  await click(page, "Customer Support");
  if (await page.isVisible("text=Admin not available")) return t.skip("the store is closed right now");
  await click(page, "Other issues");
  if (!(await page.isVisible("textarea"))) return t.skip("the store is not taking requests right now");

  const receipt = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 40;
      canvas.height = 40;
      const context = canvas.getContext("2d");
      context.fillStyle = "#0a0";
      context.fillRect(0, 0, 40, 40);
      context.fillStyle = "#fff";
      context.fillRect(0, 0, 20, 40);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64"
  );
  const fileInput = await page.$("input[type=file]");
  const preview = "img[alt='Selected screenshot']";

  await fileInput.setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: receipt });
  await page.waitForSelector(preview, { timeout: 5000 });
  assert.ok((await page.getAttribute(preview, "src")).startsWith("data:image/jpeg"), "a normal phone sends a smaller JPEG");

  await page.click("text=Remove screenshot");
  await page.evaluate(() => {
    // Like a phone whose browser silently fails to draw: the canvas stays one plain colour.
    CanvasRenderingContext2D.prototype.drawImage = () => {};
  });
  await fileInput.setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: receipt });
  await page.waitForSelector(preview, { timeout: 5000 });
  assert.ok((await page.getAttribute(preview, "src")).startsWith("data:image/png"), "the original PNG is used, not a blank JPEG");
  assert.deepEqual(errors, []);
});

test("after several cancelled orders, other issues wait for the timer but common questions stay open", async (t) => {
  const { page, errors } = await newCustomer();
  for (let round = 0; round < 2; round++) {
    if (!(await createOrder(page))) return t.skip("the store is not taking orders right now");
    await click(page, "Cancel");
    await wait(1500);
  }
  if (await page.isVisible("text=Your access has been restricted")) return t.skip("these settings block the account after two cancels");
  if (!(await page.isVisible("text=New orders are paused"))) return t.skip("orders are not paused after two cancels with these settings");

  await click(page, "Customer Support");
  if (await page.isVisible("text=Admin not available")) return t.skip("the store is closed right now");
  assert.ok(await page.isVisible("text=Common questions"), "common questions stay open");
  await tapClosed(page, "Other issues");
  assert.ok(await page.isVisible("text=Requests paused"), "other issues explain the pause");
  assert.ok(!(await page.isVisible("textarea")), "no request form");
  assert.deepEqual(errors, []);
});

async function openWithChrome(version) {
  const userAgent = `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Mobile Safari/537.36`;
  const page = await (await browser.newContext({ userAgent, viewport: { width: 420, height: 860 } })).newPage();
  await page.goto(BASE_URL, { timeout: 60000 });
  return page;
}

test("a current Chrome sees no update notice", async () => {
  const page = await openWithChrome(120);
  assert.equal(await page.isVisible("#old-browser-notice"), false);
});

test("an old Chrome is told to update and can close the notice", async () => {
  const page = await openWithChrome(101);
  assert.equal(await page.isVisible("#old-browser-notice"), true);
  assert.match(await page.getAttribute("#old-browser-link", "href"), /play\.google\.com/);
  await page.click("#old-browser-close");
  assert.equal(await page.isVisible("#old-browser-notice"), false);
});

test("a very old Chrome gets the update screen with no way to close it", async () => {
  const page = await openWithChrome(70);
  assert.equal(await page.isVisible("#old-browser-notice"), true);
  assert.equal(await page.isVisible("#old-browser-close"), false);
  const box = await page.locator("#old-browser-notice").boundingBox();
  assert.equal(box.height, 860);
});
