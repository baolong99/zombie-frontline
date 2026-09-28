// Đo mức cản trở của vật cản: giữ một phím và so quãng đường thực đi với quãng đường lý
// thuyết khi không có gì chặn. Chạy bốn hướng để không ăn may một hành lang trống.
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 780 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e)));
await page.goto(PAGE, { waitUntil: "load" });
await page.waitForTimeout(500);

const tap = s => page.$eval(s, el => el.click());
const st = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
async function clearPicks(){
  for (let i = 0; i < 10; i++){
    if (!await page.$eval("#ov-pick", el => el.classList.contains("on"))) return;
    await page.$$eval("#pick-list button", els => els[0] && els[0].click());
    await page.waitForTimeout(120);
  }
}

await tap("#btn-start");
await page.$eval("#t-god", el => { el.checked = true; el.dispatchEvent(new Event("change")); });

// Mốc lý thuyết phải tính theo tốc độ THỰC: bot nhặt được node Thể Lực giữa chừng là
// tốc chạy nhảy lên 1,25 lần, so với 170 cố định thì ra kết quả trên 100%.
const SEC = 4;
for (const th of ["farm", "war", "city"]){
  await tap("#th-" + th);
  let travelled = 0, ideal = 0;
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]){
    await clearPicks();
    const s0 = await st();
    await page.keyboard.down(key);
    await page.waitForTimeout(SEC * 1000);
    await page.keyboard.up(key);
    const s1 = await st();
    travelled += Math.hypot(s1.player.world[0] - s0.player.world[0],
                            s1.player.world[1] - s0.player.world[1]);
    ideal += SEC * 170 * (s0.up.vigor ? 1.25 : 1);
  }
  console.log(th.padEnd(5) + " đi được " + Math.round(travelled / ideal * 100) +
              "% quãng đường (mục tiêu 80–95%)");
}
console.log("lỗi: " + (errs.length ? JSON.stringify(errs) : "không"));
await browser.close();
