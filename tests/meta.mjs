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
ok(s.meta.hp > 1.4 && s.meta.hp < 1.5, "hệ số máu khu vực 2 = " + s.meta.hp);
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

ok(errors.length === 0, "không có lỗi trang: " + (errors[0] || ""));
await browser.close();
console.log(fails ? "meta: " + fails + " lỗi" : "meta: tất cả đạt");
process.exit(fails ? 1 : 0);
