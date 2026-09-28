// Bài kiểm tải: mật độ tối đa, tua nhanh tối đa, chạy liên tục. Đo FPS, theo dõi các mảng có
// phình ra không, và soi NaN trong toạ độ — ba thứ giết chết game kiểu này mà đọc code khó thấy.
import path from "node:path";
import { chromium } from "playwright";

import { fileURLToPath } from "node:url";

// mọi đường dẫn tính từ thư mục repo, không phụ thuộc chỗ gọi lệnh
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";
const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", e => errors.push("pageerror: " + String(e)));

const tap = (sel) => page.$eval(sel, el => el.click());
const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const slider = (id, v) => page.$eval(id, (el, val) => { el.value = val; el.dispatchEvent(new Event("input")); }, v);
async function clearPicks(){
  for (let i = 0; i < 16; i++){
    const on = await page.$eval("#ov-pick", el => el.classList.contains("on"));
    if (!on) return;
    await page.$$eval("#pick-list button", els => els[0] && els[0].click());
    await page.waitForTimeout(60);
  }
}

await page.goto(PAGE, { waitUntil: "load" });
await page.waitForTimeout(600);
await tap("#btn-start");
await page.$eval("#t-god", el => { el.checked = true; el.dispatchEvent(new Event("change")); });
await slider("#s-dens", "2.5");
await slider("#s-time", "5");

const DIRS = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
let held = null;
const rows = [];
let minFps = 999, nanSeen = null, maxArr = {};

for (let step = 0; step < 60; step++){
  if (step % 5 === 0){
    if (held) await page.keyboard.up(held);
    held = DIRS[(step / 5) % DIRS.length];
    await page.keyboard.down(held);
  }
  await page.waitForTimeout(1000);
  await clearPicks();
  const fps = parseInt(await page.$eval("#c-fps", el => el.textContent), 10);
  const s = await state();
  if (fps && fps < minFps) minFps = fps;
  for (const k of ["orbs", "bullets"]) maxArr[k] = Math.max(maxArr[k] || 0, s[k]);
  maxArr.zombies = Math.max(maxArr.zombies || 0, s.zombies.onScreen + s.zombies.offScreen);
  const bad = [s.player.world[0], s.player.world[1], s.lvl, s.kills].some(v => !Number.isFinite(v));
  if (bad && !nanSeen) nanSeen = JSON.stringify(s.player);
  if (step % 10 === 0)
    rows.push(`t=${s.t}s fps=${fps} zombies=${s.zombies.onScreen + s.zombies.offScreen} ` +
              `orbs=${s.orbs} bullets=${s.bullets} lvl=${s.lvl} kills=${s.kills} mode=${s.mode}`);
  if (s.mode === "win" || s.mode === "dead") { rows.push("kết thúc sớm: " + s.mode); break; }
}
if (held) await page.keyboard.up(held);

console.log(rows.join("\n"));
console.log("FPS thấp nhất: " + minFps);
console.log("đỉnh: " + JSON.stringify(maxArr));
console.log("NaN: " + (nanSeen || "không"));
console.log("console errors: " + (errors.length ? JSON.stringify(errors) : "none"));
await browser.close();
