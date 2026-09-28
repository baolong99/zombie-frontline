// Chụp ba khu vực ở cùng một thời điểm trận đấu để so sánh bảng màu và vật trang trí.
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
async function clearPicks(){
  for (let i = 0; i < 12; i++){
    const on = await page.$eval("#ov-pick", el => el.classList.contains("on"));
    if (!on) return;
    await page.$$eval("#pick-list button", els => els[0] && els[0].click());
    await page.waitForTimeout(80);
  }
}

await page.goto(PAGE, { waitUntil: "load" });
await page.waitForTimeout(600);
await tap("#btn-start");

// chạy một quãng cho nền có cái để nhìn, rồi đứng yên để ba ảnh so được với nhau
await page.keyboard.down("ArrowRight");
for (let i = 0; i < 8; i++){ await page.waitForTimeout(400); await clearPicks(); }
await page.keyboard.up("ArrowRight");
await clearPicks();

for (const k of ["farm", "war", "city"]){
  await tap("#th-" + k);
  await page.waitForTimeout(350);
  await clearPicks();
  await page.screenshot({ path: path.join(OUT, "theme-" + k + ".png") });
  console.log("shot theme-" + k);
}
const st = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
console.log("t=" + st.t + " zombies=" + st.zombies.onScreen + " world=" + JSON.stringify(st.player.world));
console.log("console errors: " + (errors.length ? JSON.stringify(errors) : "none"));
await browser.close();
