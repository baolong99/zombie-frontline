// Ma trận cân bằng: mỗi KHU VỰC × mỗi MỨC TRANG BỊ, con bot sống được bao lâu.
//
// Đây là bài duy nhất trả lời được "thang khu vực có đi được không". Con bot chọn nâng cấp
// ngẫu nhiên và chạy loạn nên nó dở hơn người thật nhiều — đọc kết quả như MỨC SÀN so sánh
// giữa các ô trong bảng, đừng đọc như độ khó thật của người chơi.
//
//   node ladder.mjs              # cả bảng
//   node ladder.mjs 2            # chỉ khu vực thứ 2 (1-5)
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = "file:///" + ROOT.split(String.fromCharCode(92)).join("/") + "/index.html";
const ONLY = process.argv[2] ? +process.argv[2] : 0;
const RUNS = +(process.env.LADDER_RUNS || 2);
const AREAS = ["farm", "road", "city", "camp", "nest"];

// Các mốc trang bị thật sự đi qua trong đời một người chơi, không phải mốc bịa cho đẹp:
// p0 là ván đầu tiên, p2 là sau khoảng mười ván, p4 là người đã cày hết.
//
// GIỮ NGUYÊN MỘT KHẨU SÚNG ở cả ba mốc. Lần chạy đầu tôi cho mỗi mốc một khẩu khác nhau và
// bảng ra vô nghĩa: mốc "tối đa" cầm Sniper chết ở giây 63 còn mốc "trắng" cầm SMG sống tới
// 75, chỉ vì Sniper bắn chậm và cần đứng yên, mà con bot thì chạy loạn. Chọn khẩu nào là
// SỞ THÍCH của người chơi, không phải một nấc tiến trình — trộn hai thứ vào một trục thì
// không đo được cái nào cả.
const KITS = {
  p0: { label:"trắng", gun:"smg",
        guns:{ smg:{own:true,star:0} }, acc:{}, equip:[] },
  p2: { label:"giữa",  gun:"smg",
        guns:{ smg:{own:true,star:3} },
        acc:{ scope:{own:true,star:2}, pouch:{own:true,star:2} }, equip:["scope","pouch"] },
  p4: { label:"tối đa", gun:"smg",
        guns:{ smg:{own:true,star:5} },
        acc:{ scope:{own:true,star:5}, pouch:{own:true,star:5}, gyro:{own:true,star:5} },
        equip:["scope","pouch","gyro"] }
};

const browser = await chromium.launch({ headless: true });
const DIRS = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];

async function one(areaIdx, kitKey){
  const kit = KITS[kitKey];
  const page = await browser.newPage({ viewport: { width: 1200, height: 780 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE, { waitUntil: "load" });
  // mở sẵn mọi khu vực để chọn thẳng, và nạp bộ trang bị của ô đang đo
  await page.evaluate(k => localStorage.setItem("zf_profile", JSON.stringify({
    v:2, gold:0, gem:0, runs:0, best:{},
    cleared:{ farm:true, road:true, city:true, camp:true },
    guns:k.guns, acc:k.acc, equip:k.equip, gun:k.gun
  })), kit);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(350);
  await page.$$eval(".areabtn", (els, i) => els[i].click(), areaIdx);
  await page.$eval("#btn-start", el => el.click());
  await page.$eval("#s-time", el => { el.value = "5"; el.dispatchEvent(new Event("input")); });

  const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  async function clearPicks(){
    for (let i = 0; i < 10; i++){
      if (!await page.$eval("#ov-pick", el => el.classList.contains("on"))) return;
      await page.$$eval("#pick-list button", els => {
        const c = els[Math.floor(Math.random() * els.length)];
        if (c) c.click();
      });
      await page.waitForTimeout(110);
    }
  }

  let held = null, s = null;
  for (let step = 0; step < 110; step++){
    if (step % 4 === 0){
      if (held) await page.keyboard.up(held);
      held = DIRS[Math.floor(Math.random() * 4)];
      await page.keyboard.down(held);
    }
    await page.waitForTimeout(500);
    await clearPicks();
    s = await state();
    if (s.mode === "dead" || s.mode === "win") break;
  }
  if (held) await page.keyboard.up(held);
  const out = { mode:s.mode, t:s.t, kills:s.kills, lvl:s.lvl,
                gun:s.weapon.id, err:errors.length };
  await page.close();
  return out;
}

const table = [];
for (let a = 0; a < AREAS.length; a++){
  if (ONLY && a !== ONLY - 1) continue;
  for (const k of Object.keys(KITS)){
    const rs = [];
    for (let r = 0; r < RUNS; r++) rs.push(await one(a, k));
    const dead = rs.filter(x => x.mode === "dead");
    const won = rs.filter(x => x.mode === "win").length;
    const avgT = Math.round(rs.reduce((x, y) => x + y.t, 0) / rs.length);
    const row = { area:AREAS[a], kit:KITS[k].label, gun:rs[0].gun,
                  thang:won + "/" + rs.length,
                  giay:avgT,
                  chet:dead.length ? Math.round(dead.reduce((x, y) => x + y.t, 0) / dead.length) : "-",
                  diet:Math.round(rs.reduce((x, y) => x + y.kills, 0) / rs.length),
                  loi:rs.reduce((x, y) => x + y.err, 0) };
    table.push(row);
    console.log(JSON.stringify(row));
  }
}
await browser.close();
console.log("\n=== BẢNG THANG KHU VỰC (" + RUNS + " lượt mỗi ô) ===");
console.log("khu vực   trang bị   súng      thắng   giây TB   chết ở   diệt TB");
table.forEach(r => console.log(
  r.area.padEnd(10) + r.kit.padEnd(11) + r.gun.padEnd(10) +
  String(r.thang).padEnd(8) + String(r.giay).padEnd(10) +
  String(r.chet).padEnd(9) + r.diet));
