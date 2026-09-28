// Bài kiểm sống sót: KHÔNG bật bất tử. Con bot chạy vòng và chọn nâng cấp ngẫu nhiên, nên
// nó dở hơn người chơi thật nhiều — coi đây là mức sàn, không phải mức chuẩn.
// Ba lượt để bớt nhiễu, báo thời điểm chết và tình trạng lúc đó.
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// tham số 1: đường dẫn file khác để so sánh hai phiên bản
const TARGET = process.argv[2] || path.join(ROOT, "index.html");
const PAGE = "file:///" + TARGET.replace(/\\/g, "/");

const browser = await chromium.launch({ headless: true });
const DIRS = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
const runs = [];

for (let run = 0; run < 3; run++){
  const page = await browser.newPage({ viewport: { width: 1200, height: 780 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE, { waitUntil: "load" });
  await page.waitForTimeout(500);
  await page.$eval("#btn-start", el => el.click());
  await page.$eval("#s-time", el => { el.value = "5"; el.dispatchEvent(new Event("input")); });

  const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  async function clearPicks(){
    for (let i = 0; i < 10; i++){
      const on = await page.$eval("#ov-pick", el => el.classList.contains("on"));
      if (!on) return;
      await page.$$eval("#pick-list button", els => {
        const c = els[Math.floor(Math.random() * els.length)];
        if (c) c.click();
      });
      await page.waitForTimeout(120);
    }
  }

  let held = null, s = null;
  for (let step = 0; step < 90; step++){
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
  runs.push({ mode: s.mode, t: s.t, lvl: s.lvl, kills: s.kills,
              nodes: Object.keys(s.up).length, hp: s.player.hp + "/" + s.player.maxhp,
              err: errors.length });
  console.log("lượt " + (run + 1) + ": " + JSON.stringify(runs[run]));
  await page.close();
}

const died = runs.filter(r => r.mode === "dead");
console.log("---");
console.log("chết " + died.length + "/3" +
            (died.length ? ", trung bình ở giây " + Math.round(died.reduce((a, r) => a + r.t, 0) / died.length) : ""));
await browser.close();
