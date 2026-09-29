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
// node ladder.mjs guns   -> giữ nguyên Nông trại, đổi KHẨU SÚNG. Dùng để kiểm xem bảng
// tính cách của từng khẩu có làm khẩu nào áp đảo không.
const ARG = process.argv[2] || "";
const GUN_MODE = ARG === "guns" || ARG === "dps";
// TRƯỜNG BẮN. Bật bất tử, bot đứng yên hoàn toàn, chạy tới đúng một mốc thời gian rồi đếm
// số quái diệt được.
//
// Cần chế độ này vì bài đo sống sót đã tới giới hạn của nó. Cùng một cấu hình Rifle, ghim
// cả hạt giống bot lẫn Math.random của trang, bốn lượt đo ra 532 · 338 · 735 · 182 quái —
// lệch bốn lần. Ghim số ngẫu nhiên không đủ, vì nguồn hỗn loạn thật nằm ở NHỊP KHUNG HÌNH:
// mỗi bước chờ 500ms thật ứng với một số khung không cố định, nên dt khác nhau, nên con
// quái đáng lẽ chết lại sống, và từ đó mọi thứ rẽ nhánh. Cái chết khuếch đại sai số đó lên
// tối đa. Bỏ cái chết đi và đếm ở một mốc thời gian cố định thì không còn điểm rẽ nhánh
// nào, mà so sánh súng vốn chỉ cần thông lượng chứ không cần biết ai sống lâu hơn ai.
const DPS_MODE = ARG === "dps";
const DPS_T = +(process.env.LADDER_T || 150);
const ONLY = GUN_MODE ? 0 : (+ARG || 0);
const ALL_GUNS = ["smg", "rifle", "shotgun", "minigun", "sniper"];
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

// SO SÁNH THEO CẶP. Nguồn nhiễu lớn nhất không phải khu vực mà là con bot chọn nâng cấp
// ngẫu nhiên: cùng một cấu hình nông trại chạy hai đợt ra 87 rồi 65 giây, tức ±25%. Ở mức
// nhiễu đó thì chênh lệch giữa hai khu vực đọc không nổi.
//
// Cách chữa là bỏ Math.random đi: lượt thứ n của MỌI ô dùng đúng một chuỗi số giả ngẫu
// nhiên, nên nó đi cùng một hướng và bấm cùng thứ tự thẻ. Khác biệt còn lại giữa các ô
// mới thật sự là khác biệt của khu vực và trang bị.
//
// Nguồn nhiễu thứ hai là Math.random của CHÍNH GAME — chỗ sinh quái, tỉ lệ rơi đồ, độ tản
// đạn. Minigun đo hai đợt với cùng hạt giống bot ra 286 rồi 184, tức vẫn ±35%, đủ để nuốt
// chửng mọi khác biệt dưới 40%. Chữa bằng addInitScript: thay luôn Math.random của trang
// bằng cùng một chuỗi giả ngẫu nhiên. Không phải sửa một dòng nào trong game.
function lcg(seed){
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

async function one(areaIdx, kitKey, seed){
  const kit = KITS[kitKey];
  const rand = lcg(seed);
  const page = await browser.newPage({ viewport: { width: 1200, height: 780 } });
  await page.addInitScript(sd => {
    let x = sd >>> 0;
    Math.random = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
  }, seed);
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
  if (DPS_MODE)
    await page.$eval("#t-god", el => { el.checked = true; el.dispatchEvent(new Event("change")); });

  const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  async function clearPicks(){
    for (let i = 0; i < 10; i++){
      if (!await page.$eval("#ov-pick", el => el.classList.contains("on"))) return;
      await page.$$eval("#pick-list button", (els, r) => {
        const c = els[Math.floor(r * els.length)];
        if (c) c.click();
      }, rand());
      await page.waitForTimeout(110);
    }
  }

  let held = null, s = null;
  for (let step = 0; step < (DPS_MODE ? 400 : 110); step++){
    // trường bắn: không bấm phím nào cả, đứng yên tuyệt đối
    if (!DPS_MODE && step % 4 === 0){
      if (held) await page.keyboard.up(held);
      held = DIRS[Math.floor(rand() * 4)];
      await page.keyboard.down(held);
    }
    await page.waitForTimeout(500);
    await clearPicks();
    s = await state();
    if (s.mode === "dead" || s.mode === "win") break;
    if (DPS_MODE && s.t >= DPS_T) break;
  }
  if (held) await page.keyboard.up(held);
  const out = { mode:s.mode, t:s.t, kills:s.kills, lvl:s.lvl,
                gun:s.weapon.id, err:errors.length };
  await page.close();
  return out;
}

// Ở chế độ so súng, mỗi "mốc trang bị" là một khẩu: cùng sao, cùng phụ kiện, cùng khu
// vực, chỉ khác khẩu. Đó là cách duy nhất đọc được bảng TRAIT có cân hay không.
if (GUN_MODE){
  for (const k of Object.keys(KITS)) delete KITS[k];
  ALL_GUNS.forEach(function(id){
    const guns = {};
    ALL_GUNS.forEach(function(g){ guns[g] = { own:true, star:3 }; });
    KITS[id] = { label:id, gun:id, guns:guns,
                 acc:{ scope:{own:true,star:2}, pouch:{own:true,star:2} },
                 equip:["scope", "pouch"] };
  });
}

const table = [];
for (let a = 0; a < AREAS.length; a++){
  if (GUN_MODE && a !== 0) continue;
  if (ONLY && a !== ONLY - 1) continue;
  for (const k of Object.keys(KITS)){
    const rs = [];
    // hạt giống chỉ phụ thuộc số thứ tự lượt, KHÔNG phụ thuộc khu vực hay trang bị
    for (let r = 0; r < RUNS; r++) rs.push(await one(a, k, 1000 + r * 7919));
    const dead = rs.filter(x => x.mode === "dead");
    const won = rs.filter(x => x.mode === "win").length;
    const avgT = Math.round(rs.reduce((x, y) => x + y.t, 0) / rs.length);
    const row = { area:AREAS[a], kit:KITS[k].label, gun:rs[0].gun,
                  thang:won + "/" + rs.length,
                  giay:avgT,
                  chet:dead.length ? Math.round(dead.reduce((x, y) => x + y.t, 0) / dead.length) : "-",
                  diet:Math.round(rs.reduce((x, y) => x + y.kills, 0) / rs.length),
                  loi:rs.reduce((x, y) => x + y.err, 0) };
    // Trường bắn bất tử mà diệt 0 con thì súng không bắn được — đó là lỗi chương trình,
    // không phải số liệu. Đã từng xảy ra thật: một ReferenceError trong fire() làm mọi
    // khẩu ra 0, và nếu không chặn ở đây thì nó trôi vào bảng như một kết quả cân bằng.
    if (DPS_MODE && row.diet === 0){
      console.log("LỖI: " + row.kit + " diệt 0 con ở trường bắn — súng không bắn được");
      process.exitCode = 1;
    }
    table.push(row);
    console.log(JSON.stringify(row));
  }
}
await browser.close();
console.log("\n=== BẢNG THANG KHU VỰC (" + RUNS + " lượt mỗi ô) ===");
if (DPS_MODE) console.log("(trường bắn: bất tử, đứng yên, dừng ở giây " + DPS_T +
                          " — 'diệt TB' là THÔNG LƯỢNG, 'chết ở' vô nghĩa)");
console.log("khu vực   trang bị   súng      thắng   giây TB   chết ở   diệt TB");
table.forEach(r => console.log(
  r.area.padEnd(10) + r.kit.padEnd(11) + r.gun.padEnd(10) +
  String(r.thang).padEnd(8) + String(r.giay).padEnd(10) +
  String(r.chet).padEnd(9) + r.diet));
