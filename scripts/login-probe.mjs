import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const posts = [];
page.on("response", async (res) => {
  if (res.request().method() === "POST") {
    let body = "";
    try { body = (await res.text()).slice(0, 1500); } catch {}
    posts.push({ status: res.status(), url: res.url().slice(-40), body });
  }
});

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 30000 });
await page.fill("#email", "garbaaminu.20211288832@futo.edu.ng");
await page.fill("#reg", "20211288832");
await page.click('button[type="submit"]');
await page.waitForFunction(() => document.body.innerText.includes("Outlook blocked") || document.body.innerText.includes("Enter the Outlook"), { timeout: 25000 });
await page.waitForTimeout(400);

const firstOtp = page.locator('input[aria-label="Digit 1"]');
await firstOtp.click();
await page.keyboard.insertText("128832");
await page.waitForTimeout(800);
const afterPaste = await page.evaluate(() => document.body.innerText.slice(0, 1800));
console.log("AFTER_PASTE_TEXT", afterPaste);
console.log("URL", page.url());
if (!page.url().includes("/app")) {
  await page.getByRole("button", { name: /verify/i }).click();
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: "/workspace/screenshots/login-after-otp.png" });
console.log("FINAL_URL", page.url());
console.log("FINAL_TEXT", await page.evaluate(() => document.body.innerText.slice(0, 1800)));
console.log("POSTS", JSON.stringify(posts, null, 2));
await browser.close();
