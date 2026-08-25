/*  Responsive audit for the signed-in CRM.

    Run against a local stack (API on 4000, web on 3100, demo data seeded):
      node apps/web/scripts/mobile-audit.mjs

    Exits non-zero on any finding, so it can gate a change.

    Drives the CRM at real Android widths and reports, per page:
     - horizontal overflow (the actual symptom of the reported symptom)
     - which element causes it
     - tap targets under 44px
   Runs the same sweep at 360 / 390 / 412 / 768 / 1440. */
import { chromium } from "playwright";

const BASE = process.env.WEB_URL ?? "http://localhost:3100";
const WIDTHS = [360, 390, 412, 768, 1440];

const ACCOUNTS = {
  admin: ["ceo@meramakan.test", "ChangeMe123!"],
  partner: ["sunita.demo@meramakan.test", "ChangeMe123!"],
  customer: ["sanjay.demo@meramakan.test", "ChangeMe123!"],
};

const PAGES = {
  admin: ["/admin/dashboard", "/admin/bookings", "/admin/customers", "/admin/partners", "/admin/business-rules"],
  partner: ["/partner/dashboard"],
  customer: ["/customer/dashboard", "__firstBooking"],
};

const AUDIT = () => {
  const docW = document.documentElement.scrollWidth;
  const winW = window.innerWidth;
  const offenders = [];
  if (docW > winW + 1) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > winW + 1 || r.left < -1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && String(el.className).slice(0, 70)) || "",
          right: Math.round(r.right),
          text: (el.textContent || "").trim().slice(0, 40),
        });
      }
    }
  }
  const small = [];
  for (const el of document.querySelectorAll("a, button, select, input")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 44) {
      small.push({
        tag: el.tagName.toLowerCase(),
        h: Math.round(r.height),
        text: (el.textContent || el.getAttribute("aria-label") || el.getAttribute("name") || "").trim().slice(0, 34),
      });
    }
  }
  return { docW, winW, offenders: offenders.slice(0, 5), offenderCount: offenders.length, small };
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
let failures = 0;

for (const [surface, [email, password]] of Object.entries(ACCOUNTS)) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log(`    JS ERROR ${e.message.slice(0, 100)}`));

    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 20000 });

    for (let path of PAGES[surface]) {
      if (path === "__firstBooking") {
        const href = await page.getAttribute('a[href^="/customer/bookings/"]', "href").catch(() => null);
        if (!href) continue;
        path = href;
      }
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      const r = await page.evaluate(AUDIT);
      const overflow = r.docW > r.winW + 1;
      const bad = overflow || r.small.length > 0;
      if (bad) failures++;
      const label = `${String(width).padStart(4)}px  ${path}`;
      if (!bad) {
        console.log(`  ok  ${label}`);
      } else {
        console.log(`FAIL  ${label}`);
        if (overflow) {
          console.log(`        overflow: content ${r.docW}px in ${r.winW}px viewport (${r.offenderCount} elements)`);
          for (const o of r.offenders) console.log(`          <${o.tag} class="${o.cls}"> right=${o.right} "${o.text}"`);
        }
        for (const s of r.small) console.log(`        tap target ${s.h}px <${s.tag}> "${s.text}"`);
      }
    }
    await ctx.close();
  }
}

await browser.close();
console.log(failures === 0 ? "\nNO OVERFLOW, NO UNDERSIZED TAP TARGETS" : `\n${failures} page/width combinations with problems`);
process.exit(failures === 0 ? 0 : 1);
