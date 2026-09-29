// Kiểm tiến trình dài hạn: ví, sảnh, và thang khu vực.
// Chạy thật trong trình duyệt vì đây là thứ duy nhất có localStorage thật và DOM thật —
// DOM giả của smoke.js không dựng được nút khu vực nên không thay thế được bài này.
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = "file:///" + ROOT.split(String.fromCharCode(92)).join("/") + "/index.html";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

let fails = 0;
function ok(cond, msg){ console.log((cond ? "  ok   " : "  FAIL ") + msg); if (!cond) fails++; }

const areas = () => page.$$eval("#arealist .areabtn", els => els.map(e => ({
  txt: e.textContent.replace(/\s+/g, " ").trim(),
  locked: e.disabled, on: e.classList.contains("on")
})));
const st = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));

// --- hồ sơ trắng: chỉ khu vực 1 mở, ví rỗng
await page.goto(PAGE);
await page.waitForTimeout(400);
let a = await areas();
ok(a.length === 5, "sảnh có 5 khu vực (thấy " + a.length + ")");
ok(!a[0].locked && a[0].on, "khu vực 1 mở và đang chọn");
ok(a.slice(1).every(x => x.locked), "khu vực 2..5 còn khoá");
ok(await page.$eval("#w-gold", e => e.textContent) === "0", "ví vàng bắt đầu từ 0");

// --- bấm vào khu vực khoá không được đổi gì
await page.$$eval("#arealist .areabtn", els => els[2].click());
ok((await areas())[0].on, "bấm khu vực khoá không đổi lựa chọn");

// --- nạp sẵn hồ sơ đã qua khu vực 1: khu vực 2 phải mở và chọn được
await page.evaluate(() => localStorage.setItem("zf_profile", JSON.stringify(
  { v:1, gold:1200, gem:35, cleared:{ farm:true }, best:{ farm:900 }, runs:3 })));
await page.reload();
await page.waitForTimeout(400);
a = await areas();
ok(!a[1].locked, "qua khu vực 1 thì khu vực 2 mở");
ok(a[2].locked, "khu vực 3 vẫn khoá");
ok(await page.$eval("#w-gold", e => e.textContent) === "1200", "ví vàng đọc lại đúng");
ok(await page.$eval("#w-gem", e => e.textContent) === "35", "ví kim cương đọc lại đúng");

// --- chọn khu vực 2 rồi vào ván: máu quái phải nhân theo hệ số khu vực
await page.$$eval("#arealist .areabtn", els => els[1].click());
ok((await areas())[1].on, "chọn được khu vực 2");
await page.$eval("#btn-start", e => e.click());
await page.waitForTimeout(600);
let s = await st();
ok(s.meta.area === "road", "vào ván ở khu vực road (thấy " + s.meta.area + ")");
// Không chốt cứng con số: thang khu vực là thứ sẽ còn cân đi cân lại. Cái phải đúng là
// khu vực 2 khó hơn khu vực 1 và hệ số thật sự tới được vòng tính máu quái.
ok(s.meta.hp > 1 && s.meta.hp < 2.5, "hệ số máu khu vực 2 nằm trong khoảng hợp lý: " + s.meta.hp);
ok(s.meta.gold === 1200 && s.meta.gem === 35, "ví giữ nguyên trong ván");

// --- hồ sơ hỏng không được làm chết trang
await page.evaluate(() => localStorage.setItem("zf_profile", "{ rác"));
await page.reload();
await page.waitForTimeout(400);
ok((await areas()).length === 5, "hồ sơ hỏng vẫn dựng được sảnh");
ok(await page.$eval("#w-gold", e => e.textContent) === "0", "hồ sơ hỏng thì ví về 0");

// --- hồ sơ phiên bản cũ phải được nâng cấp chứ không bị vứt
await page.evaluate(() => localStorage.setItem("zf_profile", JSON.stringify(
  { v:0, gold:77, cleared:{ farm:true } })));
await page.reload();
await page.waitForTimeout(400);
ok(await page.$eval("#w-gold", e => e.textContent) === "77", "hồ sơ v0 được nâng cấp, giữ vàng");
ok(!(await areas())[1].locked, "hồ sơ v0 giữ được khu vực đã qua");

// --- cửa hàng: mua súng, nâng sao, mua và đeo phụ kiện
// Đủ tiền mua bất cứ thứ gì: bài này kiểm CƠ CHẾ cửa hàng, không kiểm bảng giá. Giá là
// thứ sẽ còn cân đi cân lại theo số đo, chốt cứng vào đây là cứ mỗi lần cân lại đỏ một loạt.
await page.evaluate(() => localStorage.setItem("zf_profile", JSON.stringify(
  { v:2, gold:100000, gem:100, cleared:{}, best:{}, runs:0, guns:{}, acc:{}, equip:[] })));
await page.reload();
await page.waitForTimeout(400);

const rows = (sel) => page.$$eval(sel + " .srow", els => els.map(e => ({
  name: e.querySelector(".s-name").textContent.trim(),
  note: e.querySelector(".s-note").textContent.trim(),
  acts: [...e.querySelectorAll(".s-btn")].map(b => ({ label:b.textContent.trim(), off:b.disabled }))
})));
// bấm nút có nhãn bắt đầu bằng `pre` ở dòng thứ `row`; trả về false nếu không có nút đó
const press = (sel, row, pre) => page.$$eval(sel + " .srow",
  (els, a) => {
    const b = [...els[a.row].querySelectorAll(".s-btn")].find(x => x.textContent.trim().startsWith(a.pre));
    if (!b || b.disabled) return false;
    b.click(); return true;
  }, { row, pre });
const gold = () => page.$eval("#w-gold", e => +e.textContent);
const gem  = () => page.$eval("#w-gem",  e => +e.textContent);

await page.$eval('.tab[data-tab="guns"]', e => e.click());
let g = await rows("#gunlist");
ok(g.length === 5, "tab Súng liệt kê 5 khẩu");
ok(g[0].acts.some(a => a.label === "Đang dùng"), "SMG là khẩu đang dùng");
ok(g[0].acts.some(a => a.label.indexOf("Nâng sao") === 0), "SMG có sẵn nên nâng sao được");
// nút mua phải khoá khi không đủ tiền — kiểm bằng một hồ sơ nghèo, không bằng giá cụ thể
await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("zf_profile"));
                            p.gold = 1; localStorage.setItem("zf_profile", JSON.stringify(p)); });
await page.reload(); await page.waitForTimeout(350);
await page.$eval('.tab[data-tab="guns"]', e => e.click());
ok((await rows("#gunlist")).slice(1).every(r => r.acts[0].off),
   "còn 1 vàng thì mọi nút mua đều khoá");
await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("zf_profile"));
                            p.gold = 100000; localStorage.setItem("zf_profile", JSON.stringify(p)); });
await page.reload(); await page.waitForTimeout(350);
await page.$eval('.tab[data-tab="guns"]', e => e.click());

// mua Rifle — giá đọc từ chính cái nút, không chép số
const priceOf = (list, row, pre) => page.$$eval(list + " .srow", (els, a) => {
  const b = [...els[a.row].querySelectorAll(".s-btn")].find(x => x.textContent.trim().startsWith(a.pre));
  return b ? +b.textContent.replace(/[^0-9]/g, "") : -1;
}, { row, pre });
const rifleCost = await priceOf("#gunlist", 1, "Mua");
const before = await gold();
ok(rifleCost > 0, "đọc được giá Rifle từ nút: " + rifleCost);
ok(await press("#gunlist", 1, "Mua"), "bấm được nút mua Rifle");
ok(await gold() === before - rifleCost,
   "mua Rifle trừ đúng " + rifleCost + " (còn " + (await gold()) + ")");
g = await rows("#gunlist");
ok(g[1].acts.some(a => a.label === "Chọn"), "mua xong Rifle thì chọn được làm khẩu xuất phát");

// nâng sao Rifle
const starCost = await priceOf("#gunlist", 1, "Nâng sao");
const beforeStar = await gold();
ok(await press("#gunlist", 1, "Nâng sao"), "bấm được nút nâng sao Rifle");
ok(await gold() === beforeStar - starCost,
   "sao đầu của Rifle tốn " + starCost + " (còn " + (await gold()) + ")");
ok((await rows("#gunlist"))[1].name.indexOf("★") > 0, "Rifle hiện một sao");

// --- phụ kiện: mua bằng kim cương, nâng sao bằng vàng, giới hạn 3 ô
await page.$eval('.tab[data-tab="acc"]', e => e.click());
let acl = await rows("#acclist");
ok(acl.length === 7, "tab Phụ kiện liệt kê 7 món");
for (let i = 0; i < 4; i++){
  const list = await rows("#acclist");
  const idx = list.findIndex(r => r.acts[0].label.indexOf("Mua") === 0);
  await page.$$eval("#acclist .srow", (els, k) => els[k].querySelector(".s-btn").click(), idx);
}
ok(await gem() === 100 - (25 + 25 + 30 + 20), "mua 4 phụ kiện trừ đúng kim cương (còn " + (await gem()) + ")");

// đeo 3 món rồi món thứ tư phải bị từ chối
for (let i = 0; i < 4; i++){
  const list = await rows("#acclist");
  const idx = list.findIndex(r => r.acts[0].label === "Đeo" && !r.acts[0].off);
  if (idx < 0) break;
  await page.$$eval("#acclist .srow", (els, k) => els[k].querySelector(".s-btn").click(), idx);
}
const equipped = await page.evaluate(() => JSON.parse(localStorage.getItem("zf_profile")).equip);
ok(equipped.length === 3, "chỉ đeo được 3 món (đang đeo " + equipped.length + ")");
ok((await rows("#acclist")).some(r => r.acts[0].label === "Đeo" && r.acts[0].off),
   "món thứ tư có nút Đeo nhưng bị khoá");

// --- khẩu xuất phát phải theo lựa chọn ở sảnh, không phải luôn luôn SMG
await page.$eval('.tab[data-tab="guns"]', e => e.click());
ok(await press("#gunlist", 1, "Chọn"), "chọn Rifle làm khẩu xuất phát");
ok((await rows("#gunlist"))[1].acts[0].label === "Đang dùng", "Rifle hiện là khẩu đang dùng");
await page.reload();
await page.waitForTimeout(400);
await page.$eval('.tab[data-tab="guns"]', e => e.click());
ok((await rows("#gunlist"))[1].acts[0].label === "Đang dùng", "lựa chọn khẩu sống qua lần tải lại");

// --- hệ số meta phải tới được trong ván
await page.$eval("#btn-start", e => e.click());
await page.waitForTimeout(500);
s = await st();
ok(s.weapon.id === "rifle", "vào ván cầm đúng khẩu đã chọn (thấy " + s.weapon.id + ")");
ok(s.weapon.range > 530,
   "chỉ số meta có tác dụng: tầm Rifle " + s.weapon.range + " (gốc 530)");

// --- khẩu chưa mua không được cầm, kể cả khi bấm thẳng phím số của nó
await page.keyboard.press("Digit5");            // Sniper, chưa mua
await page.waitForTimeout(80);
s = await st();
ok(s.weapon.id === "rifle", "phím 5 không cầm được Sniper chưa mua (đang cầm " + s.weapon.id + ")");
await page.keyboard.press("Digit1");            // SMG, đã mua
await page.waitForTimeout(80);
ok((await st()).weapon.id === "smg", "phím 1 cầm được SMG đã mua");
const ids = new Set();
for (let i = 0; i < 6; i++){ await page.keyboard.press("KeyQ"); await page.waitForTimeout(70);
                             ids.add((await st()).weapon.id); }
ok([...ids].every(x => x === "smg" || x === "rifle"),
   "Q chỉ xoay trong khẩu đã mua (thấy " + [...ids].join(",") + ")");

// --- tính cách từng khẩu: buff kèm debuff, và đổi súng không được thành mẹo hồi máu
await page.evaluate(() => localStorage.setItem("zf_profile", JSON.stringify(
  { v:2, gold:0, gem:0, cleared:{}, best:{}, runs:0, gun:"smg", equip:[], acc:{},
    guns:{ smg:{own:true,star:0}, shotgun:{own:true,star:0}, sniper:{own:true,star:0} } })));
await page.reload();
await page.waitForTimeout(400);
await page.$eval("#btn-start", e => e.click());
await page.waitForTimeout(400);
s = await st();
const smgHp = s.player.maxhp, smgRate = s.weapon.mag;
ok(smgHp === 100, "SMG: máu tối đa gốc 100 (thấy " + smgHp + ")");

await page.keyboard.press("Digit3");              // Shotgun: máu +25%
await page.waitForTimeout(120);
s = await st();
ok(s.player.maxhp === 125, "Shotgun: máu tối đa lên 125 (thấy " + s.player.maxhp + ")");
const hurtFrac = s.player.hp / s.player.maxhp;

await page.keyboard.press("Digit1");              // về SMG
await page.waitForTimeout(120);
s = await st();
ok(s.player.maxhp === 100, "đổi lại SMG thì máu tối đa về 100");
ok(Math.abs(s.player.hp / s.player.maxhp - hurtFrac) < 0.02,
   "đổi súng giữ nguyên TỈ LỆ máu, không phải mẹo hồi máu");

// --- nút thử +10.000 vàng phải vào VÍ, không phải vào điểm số của ván
await page.evaluate(() => localStorage.setItem("zf_profile", JSON.stringify(
  { v:2, gold:0, gem:0, cleared:{}, best:{}, runs:0, guns:{}, acc:{}, equip:[], gun:"smg" })));
await page.reload();
await page.waitForTimeout(400);
ok(await page.$eval("#w-gold", e => +e.textContent) === 0, "bắt đầu với ví rỗng");
await page.$eval("#dbg-gold", e => e.click());
await page.$eval("#dbg-gold", e => e.click());
ok(await page.$eval("#w-gold", e => +e.textContent) === 20000,
   "bấm hai lần được 20.000 và hiện ngay trên sảnh");
await page.reload();
await page.waitForTimeout(400);
ok(await page.$eval("#w-gold", e => +e.textContent) === 20000, "vàng nút thử sống qua tải lại");
// Nhãn phải mang số dư: trong ván thì thanh ví bị ẩn, không có nó thì bấm xong
// không thấy gì đổi và nút trông y như hỏng.
ok((await page.$eval("#dbg-gold", e => e.textContent)).indexOf("20.000") > 0,
   "nhãn nút hiện số dư ví: " + await page.$eval("#dbg-gold", e => e.textContent));

// --- tạm dừng giữa ván phải ra được sảnh để tiêu số vàng đó
await page.$eval("#btn-start", e => e.click());
await page.waitForTimeout(400);
await page.keyboard.press("KeyP");
await page.waitForTimeout(250);
ok(await page.$eval("#ov-pause", e => e.classList.contains("on")), "bấm P thì tạm dừng");
await page.$eval("#btn-lobby", e => e.click());
await page.waitForTimeout(400);
ok(await page.$eval("#ov-start", e => e.classList.contains("on")), "về sảnh được giữa ván");
await page.$eval('.tab[data-tab="guns"]', e => e.click());
const beforeBuy = await page.$eval("#w-gold", e => +e.textContent);
ok(await press("#gunlist", 2, "Mua"), "mua được súng bằng vàng của nút thử");
ok(await page.$eval("#w-gold", e => +e.textContent) < beforeBuy, "ví trừ tiền sau khi mua");

ok(errors.length === 0, "không có lỗi trang: " + (errors[0] || ""));
await browser.close();
console.log(fails ? "meta: " + fails + " lỗi" : "meta: tất cả đạt");
process.exit(fails ? 1 : 0);
