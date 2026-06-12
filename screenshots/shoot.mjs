// Screenshot loop for visual self-verification (webapp-testing pattern).
// Usage: node screenshots/shoot.mjs <prefix> [route] [settleMs]
import { chromium } from "playwright";

const prefix = process.argv[2] ?? "shot";
const route = process.argv[3] ?? "/";
const settle = Number(process.argv[4] ?? 9000);
const base = process.env.BASE_URL ?? "http://localhost:3100";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
await page.goto(base + route, { waitUntil: "networkidle" });
await page.waitForTimeout(settle); // let the 3D scene stream + settle camera
const file = `screenshots/${prefix}.png`;
await page.screenshot({ path: file });
console.log(`saved ${file}`);
await browser.close();
