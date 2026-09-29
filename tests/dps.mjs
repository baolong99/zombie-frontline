// DPS ĐƠN MỤC TIÊU của từng khẩu — tức sức đánh TRÙM.
//
// Trường bắn trong ladder.mjs chỉ đo được khả năng dọn bầy, mà đó không phải việc của mọi
// khẩu. Sniper đo ra thấp nhất ở trường bắn nhưng mỗi phát của nó lại nặng nhất; nếu chỉ
// nhìn một bảng thì sẽ kết luận sai và đi buff nhầm chỗ.
//
// Bài này KHÔNG chép lại công thức của wstat: nó mở game thật, cầm từng khẩu, rồi đọc số
// đã tính xong ra khỏi cửa sổ trạng thái. Nhờ vậy sửa wstat là bảng này tự đúng theo.
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = "file:///" + ROOT.split(String.fromCharCode(92)).join("/") + "/index.html";
const GUNS = ["smg", "rifle", "shotgun", "minigun", "sniper"];
const STILL = process.env.DPS_STILL !== "0";   // đứng yên: ăn thưởng của Sniper

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 780 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
await page.goto(PAGE, { waitUntil: "load" });

const rows = [];
for (const id of GUNS){
  await page.evaluate(g => localStorage.setItem("zf_profile", JSON.stringify({
    v:2, gold:0, gem:0, runs:0, best:{}, cleared:{}, equip:[], acc:{}, gun:g,
    guns:Object.fromEntries(["smg","rifle","shotgun","minigun","sniper"].map(k => [k, {own:true, star:0}]))
  })), id);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(300);
  await page.$eval("#btn-start", el => el.click());
  // đứng yên đủ lâu để thưởng đứng yên của Sniper bật lên
  await page.waitForTimeout(STILL ? 1200 : 200);
  const s = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const w = s.weapon;

  // Một chu kì băng đạn: mag phát, mỗi phát cách nhau `rate` giây, rồi nạp `reload` giây.
  const cycle = w.mag * w.rate + w.reload;
  // Thưởng đứng yên của Sniper áp lúc bắn, không nằm trong ws.dmg. Bỏ qua là hụt 1,8 lần.
  const perShot = w.dmg * (w.steadyOn && w.steady ? w.steady : 1);

  // Bao nhiêu viên ghém thật sự trúng một con TRÙM phụ thuộc khoảng cách và cỡ con trùm,
  // không phải lúc nào cũng một viên. Trùm bán kính 44, tức bề ngang 88px. Chùm ghém toả
  // `spread` độ nên ở khoảng cách d nó rộng 2·d·tan(spread/2). Đánh ở khoảng 60% tầm bắn.
  const BOSS_W = 88;
  const d = Math.min(w.range * 0.6, 260);
  const coneW = 2 * d * Math.tan((w.spread * Math.PI / 180) / 2) || 1;
  const hitPellets = Math.max(1, Math.min(w.pellets, Math.round(w.pellets * BOSS_W / coneW)));
  const boss = (w.mag * perShot * hitPellets) / cycle;
  // Dọn bầy: cả chùm ghém và cả các đường đạn đều trúng ai đó trong đám đông.
  const horde = (w.mag * perShot * w.pellets * w.lines) / cycle;
  rows.push({ id, dmg:Math.round(perShot), mag:w.mag, rate:w.rate, reload:w.reload,
              pellets:w.pellets, hit:hitPellets,
              boss:Math.round(boss), horde:Math.round(horde) });
}
await browser.close();

console.log("(đứng yên = " + STILL + "; số của khẩu sao 0, không phụ kiện, không nâng cấp)");
console.log("khẩu       dmg   băng  nhịp    nạp   ghém  trúng  DPS trùm   DPS bầy");
rows.forEach(r => console.log(
  r.id.padEnd(11) + String(r.dmg).padEnd(6) + String(r.mag).padEnd(6) +
  String(r.rate).padEnd(8) + String(r.reload).padEnd(6) + String(r.pellets).padEnd(6) +
  String(r.hit).padEnd(7) + String(r.boss).padEnd(11) + r.horde));
const worst = rows.reduce((a, b) => a.boss < b.boss ? a : b);
const best = rows.reduce((a, b) => a.boss > b.boss ? a : b);
console.log("\nDPS trùm: " + best.id + " cao nhất " + best.boss +
            ", " + worst.id + " thấp nhất " + worst.boss +
            " (chênh " + (best.boss / worst.boss).toFixed(2) + " lần)");
if (errors.length) { console.log("LỖI TRANG: " + errors[0]); process.exit(1); }
