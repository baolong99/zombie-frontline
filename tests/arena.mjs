// Kiểm hai tính năng mới: mũi tên chỉ hộp quanh nhân vật, và nghi thức vòng vây trùm cuối.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

import { fileURLToPath } from "node:url";

// mọi đường dẫn tính từ thư mục repo, không phụ thuộc chỗ gọi lệnh
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";
const OUT = path.join(ROOT, "tests", "output");
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", e => errors.push("pageerror: " + String(e)));

const tap = (sel) => page.$eval(sel, el => el.click());
const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + ".png") }); console.log("shot " + n); };
async function clearPicks(){
  for (let i = 0; i < 14; i++){
    const on = await page.$eval("#ov-pick", el => el.classList.contains("on"));
    if (!on) return;
    await page.$$eval("#pick-list button", els => els[0] && els[0].click());
    await page.waitForTimeout(80);
  }
}
const run = async (key, ms) => {
  await page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < ms){ await page.waitForTimeout(350); await clearPicks(); }
  await page.keyboard.up(key);
};

await page.goto(PAGE, { waitUntil: "load" });
await page.waitForTimeout(600);
await tap("#btn-start");
await tap("#t-god"); await page.$eval("#t-god", el => { el.checked = true; });
await page.$eval("#t-god", el => el.dispatchEvent(new Event("change")));

// tua nhanh hết cỡ, nếu không đợi hạ một con elite mất nửa phút thật
await page.$eval("#s-time", el => { el.value = "5"; el.dispatchEvent(new Event("input")); });

// ---- 1. mũi tên chỉ hộp: thả một cái hộp thật ở cách 300px
await page.$eval("#s-time", el => { el.value = "1"; el.dispatchEvent(new Event("input")); });
await page.waitForTimeout(400);
await clearPicks();
await tap("#d-cratefar");
await page.waitForTimeout(400);
let s = await state();
console.log("hộp thả ra: " + JSON.stringify(s.crates));
await shot("07-crate-compass");

// ---- 2. vòng vây trùm cuối
const before = await state();
console.log("trước khi trùm cuối hiện: quái sống=" + (before.zombies.onScreen + before.zombies.offScreen) +
            " orbs=" + before.orbs);
await tap("#d-boss");   // nghi thức vòng vây giờ gắn vào trùm phụ, không phải elite
await page.waitForTimeout(250);
s = await state();
console.log("khi trùm cuối hiện: arena=" + JSON.stringify(s.arena) +
            " quái còn sống=" + (s.zombies.onScreen + s.zombies.offScreen) + " orbs=" + s.orbs);
await shot("08-arena-countdown");

await clearPicks();
await page.waitForTimeout(1200);
await clearPicks();
s = await state();
console.log("giữa đếm ngược: " + JSON.stringify(s.arena) + " orbs=" + s.orbs + " lvl=" + s.lvl);
await shot("09-arena-count2");

await page.waitForTimeout(3000);
await clearPicks();
// chạy hết cỡ sang phải để đâm vào tường
await run("ArrowRight", 5000);
await clearPicks();
s = await state();
const A = s.arena;
const dist = A ? Math.round(Math.hypot(A.at[0], A.at[1])) : -1;
console.log("ép vào tường: arena=" + JSON.stringify(A) + " khoảng cách người chơi tới tâm=" + dist +
            " (giới hạn " + (A ? A.r - s.player.r : "?") + ")");
await shot("10-arena-wall");

console.log("console errors: " + (errors.length ? JSON.stringify(errors) : "none"));
await browser.close();
