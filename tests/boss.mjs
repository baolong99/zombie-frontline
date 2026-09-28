// Kiểm luồng cuối màn: trùm phụ phút 5 có vòng vây, elite phút 10 rơi hộp, nhặt hộp xong
// thì trùm chính bước ra với vòng vây thứ hai, hạ trùm chính là thắng.
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
    await page.waitForTimeout(70);
  }
}
async function wait(ms){
  const t0 = Date.now();
  while (Date.now() - t0 < ms){ await page.waitForTimeout(300); await clearPicks(); }
}

await page.goto(PAGE, { waitUntil: "load" });
await page.waitForTimeout(600);
await tap("#btn-start");
await page.$eval("#t-god", el => { el.checked = true; el.dispatchEvent(new Event("change")); });

// ---- trùm phụ phút 5 phải kéo theo vòng vây
await wait(2500);
const pre = await state();
await tap("#d-boss");
await page.waitForTimeout(300);
let s = await state();
console.log("trùm phụ: boss=" + JSON.stringify(s.boss) + " arena=" + (s.arena ? s.arena.phase : null) +
            " quái " + (pre.zombies.onScreen + pre.zombies.offScreen) + " -> " +
            (s.zombies.onScreen + s.zombies.offScreen));
await shot("11-mini-arena");

// hạ trùm phụ bằng tua nhanh
await page.$eval("#s-time", el => { el.value = "5"; el.dispatchEvent(new Event("input")); });
for (let i = 0; i < 80; i++){ await wait(400); s = await state(); if (!s.boss) break; }
console.log("sau khi hạ trùm phụ: boss=" + JSON.stringify(s.boss) + " arena=" + JSON.stringify(s.arena) +
            " unique=" + s.unique);

// ---- elite phút 10: bấm cho tới con cuối
await page.$eval("#s-time", el => { el.value = "1"; el.dispatchEvent(new Event("input")); });
for (let i = 0; i < 5; i++){ await tap("#d-elite"); await page.waitForTimeout(110); }
s = await state();
console.log("5 elite đã gọi, arena=" + JSON.stringify(s.arena) + " (phải là null)");

// hạ hết elite rồi nhặt hộp cuối -> trùm chính phải hiện ra
await page.$eval("#s-time", el => { el.value = "5"; el.dispatchEvent(new Event("input")); });
for (let i = 0; i < 140; i++){
  await wait(400);
  s = await state();
  if (s.boss && s.boss.kind === "boss") break;
  if (s.mode === "win" || s.mode === "dead") break;
}
console.log("trùm chính: " + JSON.stringify(s.boss) + " arena=" + JSON.stringify(s.arena) + " mode=" + s.mode);
await shot("12-main-boss");

// sóng xung kích phải xuất hiện
let sawWave = 0;
for (let i = 0; i < 30; i++){
  await page.waitForTimeout(250); await clearPicks();
  s = await state();
  if (s.waves && s.waves.length) { sawWave = Math.max(sawWave, s.waves.length); }
  if (!s.boss) break;
}
console.log("sóng xung kích thấy cùng lúc nhiều nhất: " + sawWave);
await shot("13-boss-shockwave");

for (let i = 0; i < 200 && (await state()).mode !== "win"; i++) await wait(400);
s = await state();
console.log("kết cục: mode=" + s.mode + " kills=" + s.kills + " lvl=" + s.lvl);
await shot("14-win");

console.log("console errors: " + (errors.length ? JSON.stringify(errors) : "none"));
await browser.close();
