// Lượt chụp bổ sung: client của skill chụp canvas bằng toDataURL nên không thấy HUD,
// bảng Tune hay màn chọn nâng cấp (đều là DOM nằm trên canvas). Cái này chụp cả trang.
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", e => errors.push("pageerror: " + String(e)));

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, name + ".png") });
  console.log("shot " + name);
};
const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const tap = (sel) => page.$eval(sel, el => el.click());

// menu lên cấp làm đóng băng trận đấu, nên phải dọn nó trước mỗi lần chụp cảnh chơi
async function clearPicks(){
  for (let i = 0; i < 12; i++){
    const on = await page.$eval("#ov-pick", el => el.classList.contains("on"));
    if (!on) return i;
    await page.$$eval("#pick-list button", els => els[0] && els[0].click());
    await page.waitForTimeout(90);
  }
  return -1;
}
const run = async (key, ms) => {
  await page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < ms){ await page.waitForTimeout(400); await clearPicks(); }
  await page.keyboard.up(key);
};

await page.goto(PAGE, { waitUntil: "load" });
await page.waitForTimeout(700);
await shot("00-start");

await tap("#btn-start");
await run("ArrowRight", 2500);
await run("ArrowDown", 1500);
await clearPicks();
await shot("01-play");
const s1 = await state();
console.log("  t=" + s1.t + " kills=" + s1.kills + " lvl=" + s1.lvl + " xpNext=" + s1.xp[1] +
            " view=" + JSON.stringify(s1.view) + " zombies=" + JSON.stringify(s1.zombies.onScreen));

// mũi chỉ hướng: gọi tinh anh + trùm phụ rồi chạy thật xa cho chúng ra khỏi màn hình
await tap("#d-elite");
await tap("#d-boss");
await run("ArrowLeft", 5000);
await run("ArrowUp", 4000);
await clearPicks();
await shot("03-offscreen-arrows");
const s3 = await state();
console.log("  onScreen=" + s3.zombies.onScreen + " offScreen=" + s3.zombies.offScreen +
            " world=" + JSON.stringify(s3.player.world) + " crates=" + JSON.stringify(s3.crates));

// màn chọn nâng cấp
await tap("#d-lvlup");
await page.waitForTimeout(400);
await shot("04-pick");
const s4 = await state();
console.log("  pick=" + JSON.stringify(s4.pick) + " mode=" + s4.mode);

// đổi sang tiếng Anh ngay khi menu đang mở — phải vẽ lại đúng ba lựa chọn đó
await page.$eval('.langbtn[data-lang="en"]', el => el.click());
await page.waitForTimeout(300);
await shot("05-pick-en");
const s5 = await state();
console.log("  lang=" + s5.lang + " pick=" + JSON.stringify(s5.pick));

await clearPicks();
await run("ArrowRight", 2500);
await clearPicks();
await shot("06-play-en");

// bảng Tune chụp sau cùng vì nó tạm dừng trận đấu
await tap("#paneltoggle");
await page.waitForTimeout(400);
await shot("02-panel");
console.log("  xp note: " + await page.$eval("#n-xpc", el => el.textContent));

console.log("console errors: " + (errors.length ? JSON.stringify(errors, null, 1) : "none"));
await browser.close();
