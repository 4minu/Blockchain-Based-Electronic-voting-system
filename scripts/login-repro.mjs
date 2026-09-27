import { chromium } from "playwright";

const TARGET = process.env.TARGET || "http://127.0.0.1:8080/";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const logs = [];
page.on("console", (m) => logs.push(`CONSOLE ${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`PAGEERROR ${e.message}`));
const posts = [];
page.on("request", (req) => {
  if (req.method() !== "GET") logs.push(`REQ ${req.method()} ${req.url().slice(-80)}`);
});
page.on("response", async (res) => {
  const req = res.request();
  if (req.method() === "POST") {
    let body = "";
    try {
      body = (await res.text()).slice(0, 1800);
    } catch {}
    posts.push({
      status: res.status(),
      url: res.url().slice(-90),
      body,
    });
  }
});

const t0 = Date.now();
await page.goto(TARGET, { waitUntil: "networkidle", timeout: 30000 });
await page.getByLabel(/FUTO student email/i).waitFor({ timeout: 15000 });
await page.waitForTimeout(400);

logs.push(`HAS_EMAIL ${await page.locator("#email").count()}`);
await page.locator("#email").fill("garbaaminu.20211288832@futo.edu.ng");
await page.locator("#reg").fill("20211288832");
const clickAt = Date.now();
await page.getByRole("button", { name: /send code/i }).click();
try {
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Enter your roll PIN") ||
      document.body.innerText.includes("Enter the Outlook") ||
      document.body.innerText.includes("not on the Software Engineering") ||
      document.body.innerText.includes("took too long") ||
      document.body.innerText.includes("Could not send"),
    { timeout: 12000 },
  );
} catch {
  logs.push("WAIT_OTP_TIMEOUT");
}
logs.push(`OTP_MS ${Date.now() - clickAt}`);
const afterSend = await page.evaluate(() => ({
  text: document.body.innerText.slice(0, 1800),
  busy: !!document.querySelector(".animate-spin"),
  url: location.href,
}));
logs.push(`AFTER_SEND ${JSON.stringify(afterSend)}`);
await page.screenshot({ path: "/workspace/screenshots/login-after-send.png" });

if (afterSend.text.includes("roll PIN") || afterSend.text.includes("Outlook code")) {
  const pin = "288832";
  for (let i = 0; i < pin.length; i += 1) {
    const box = page.locator(`input[aria-label="Digit ${i + 1}"]`);
    await box.click();
    await box.fill(pin[i]);
  }
  await page.waitForTimeout(400);
  if (!page.url().includes("/app")) {
    await page.getByRole("button", { name: /verify/i }).click();
  }
  try {
    await page.waitForURL(/\/app/, { timeout: 12000 });
  } catch {
    logs.push("APP_NAV_TIMEOUT");
  }
  await page.waitForTimeout(600);
}

const final = await page.evaluate(() => ({
  text: document.body.innerText.slice(0, 1800),
  url: location.href,
}));
logs.push(`FINAL ${JSON.stringify(final)}`);
logs.push(`ELAPSED ${Date.now() - t0}`);
await page.screenshot({ path: "/workspace/screenshots/login-after-otp.png" });
console.log(logs.join("\n"));
console.log(
  "POSTS",
  JSON.stringify(
    posts.map((p) => ({
      status: p.status,
      url: p.url,
      body: p.body.slice(0, 500),
    })),
    null,
    2,
  ),
);
await browser.close();
