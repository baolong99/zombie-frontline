// Đo hiện tượng chen lấn: quái chồng lên nhau và lún vào người chơi, và người chơi có
// còn bắn được không khi bị vây kín. Nhận đường dẫn file khác làm tham số để so hai bản.
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TARGET = process.argv[2] || path.join(ROOT, "index.html");
const PAGE = "file:///" + TARGET.replace(/\\/g, "/");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 780 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e)));
await page.goto(PAGE, { waitUntil: "load" });
await page.waitForTimeout(500);

const tap = s => page.$eval(s, el => el.click());
const st = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const slider = (id, v) => page.$eval(id, (el, val) => { el.value = val; el.dispatchEvent(new Event("input")); }, v);
async function clearPicks(){
  for (let i = 0; i < 10; i++){
    if (!await page.$eval("#ov-pick", el => el.classList.contains("on"))) return;
    await page.$$eval("#pick-list button", els => els[0] && els[0].click());
    await page.waitForTimeout(110);
  }
}

await tap("#btn-start");
await page.$eval("#t-god", el => { el.checked = true; el.dispatchEvent(new Event("change")); });
await slider("#s-dens", "2.5");
await slider("#s-time", "5");

// Đứng yên cho đám đông vây kín — đây chính là tình huống người chơi báo lỗi.
let peakStack = 0, peakOverlap = 0, firedFrames = 0, samples = 0, peakZ = 0;
for (let i = 0; i < 40; i++){
  await page.waitForTimeout(700);
  await clearPicks();
  const s = await st();
  const n = s.zombies.onScreen + s.zombies.offScreen;
  if (n < 60) continue;                       // chờ đủ đông rồi mới tính
  samples++;
  peakZ = Math.max(peakZ, n);
  peakStack = Math.max(peakStack, s.zombies.stack);
  peakOverlap = Math.max(peakOverlap, s.zombies.overlap);
  if (s.bullets > 0) firedFrames++;
  if (i % 10 === 0)
    console.log("  t=" + s.t + "s quái=" + n + " · lún vào người chơi=" + s.zombies.stack +
                " · cặp chồng nhau=" + s.zombies.overlap + " · đạn đang bay=" + s.bullets);
}
console.log("---");
console.log("đỉnh: " + peakZ + " quái · " + peakStack + " con lún vào người chơi · " +
            peakOverlap + " cặp chồng nhau");
console.log("có đạn bay: " + firedFrames + "/" + samples + " lần đo");
console.log("lỗi: " + (errs.length ? JSON.stringify(errs) : "không"));
await browser.close();
