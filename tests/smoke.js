// Chạy thử game trong DOM giả để bắt lỗi thời gian chạy mà việc kiểm cú pháp không thấy được.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const FILE = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(FILE, "utf8");
const m = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/.exec(html);
const code = m[1];

function makeClassList(){
  const set = new Set();
  return {
    add: c => set.add(c), remove: c => set.delete(c),
    contains: c => set.has(c),
    toggle: c => { if (set.has(c)) { set.delete(c); return false; } set.add(c); return true; }
  };
}
let elCount = 0;
function makeEl(tag){
  const el = {
    tagName: (tag || "div").toUpperCase(), _id: ++elCount,
    children: [], _lis: {}, style: {}, dataset: {}, _attrs: {},
    textContent: "", value: "", type: "", hidden: false, disabled: false, checked: false,
    clientWidth: 0, clientHeight: 0, offsetWidth: 0, offsetHeight: 0,
    classList: makeClassList(),
    appendChild(c){ this.children.push(c); return c; },
    removeChild(c){ this.children = this.children.filter(x => x !== c); },
    addEventListener(t, f){ (this._lis[t] = this._lis[t] || []).push(f); },
    removeEventListener(){},
    setAttribute(k, v){ this._attrs[k] = v; },
    getAttribute(k){ return k in this._attrs ? this._attrs[k] : null; },
    hasAttribute(k){ return k in this._attrs; },
    removeAttribute(k){ delete this._attrs[k]; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    closest(){ return null; },
    getBoundingClientRect(){ return { left:0, top:0, width:this.clientWidth, height:this.clientHeight }; },
    focus(){}, blur(){},
    fire(t, ev){ (this._lis[t] || []).forEach(f => f.call(this, ev || { target:this, preventDefault(){}, stopPropagation(){} })); },
    click(){ this.fire("click"); }
  };
  Object.defineProperty(el, "innerHTML", {
    get(){ return ""; }, set(){ this.children = []; }
  });
  return el;
}

const gradient = { addColorStop(){} };
const ctxStore = {};
const ctx2d = new Proxy(ctxStore, {
  get(t, k){
    if (k === "createRadialGradient" || k === "createLinearGradient" || k === "createPattern") return () => gradient;
    if (k === "measureText") return () => ({ width: 10 });
    if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
    if (k in t) return t[k];
    return () => {};
  },
  set(t, k, v){ t[k] = v; return true; }
});

const byId = {};
function $(id){
  if (!byId[id]) {
    byId[id] = makeEl(id === "game" ? "canvas" : "div");
    byId[id]._attrs.id = id;
    if (id === "game") byId[id].getContext = () => ctx2d;
  }
  return byId[id];
}
$("stage").clientWidth = 1200;
$("stage").clientHeight = 700;

const store = {};
const rafQueue = [];
const sandbox = {
  console,
  Math, JSON, Date, parseInt, parseFloat, isNaN, isFinite,
  Object, Array, String, Number, Boolean, Error, Set, Map,
  Uint8ClampedArray, Float32Array,
  document: {
    getElementById: $,
    createElement: makeEl,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    body: makeEl("body"),
    documentElement: makeEl("html")
  },
  navigator: { maxTouchPoints: 0, userAgent: "node" },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  // Ảnh không bao giờ tải xong trong DOM giả — cố ý. Bài kiểm này đo LOGIC, và không tải
  // được thì drawSprite luôn trả về false nên game chạy nhánh vẽ tay, đúng thứ cần đo.
  Image: function(){ return { onload: null, onerror: null, src: "", width: 0, height: 0 }; },
  performance: { now: () => 0 },
  requestAnimationFrame: cb => { rafQueue.push(cb); return rafQueue.length; },
  cancelAnimationFrame: () => {},
  setTimeout: () => 0, clearTimeout: () => {},
  AudioContext: function(){
    const node = { connect(){}, start(){}, stop(){}, disconnect(){},
      frequency:{ value:0, setValueAtTime(){} }, gain:{ value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} },
      type:"", buffer:null, playbackRate:{ value:1 } };
    return {
      currentTime: 0, sampleRate: 44100, destination: {}, state: "running",
      resume(){}, close(){},
      createOscillator: () => node, createGain: () => node,
      createBufferSource: () => node, createBiquadFilter: () => node,
      createBuffer: (c, l) => ({ getChannelData: () => new Float32Array(l), length: l })
    };
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const winLis = {};
sandbox.window.addEventListener = (t, f) => { (winLis[t] = winLis[t] || []).push(f); };
sandbox.webkitAudioContext = sandbox.AudioContext;

// chỉ sửa trong bản chạy thử, không đụng vào file game: mở một cửa sổ nhìn vào trong closure
const probed = code.replace(/\}\)\(\);\s*$/,
  "  window.__probe = function(){ return { orbs:G.orbs.length, items:G.items.length, z:G.zombies.length," +
  " b:G.bullets.length, parts:G.parts.length, px:Math.round(G.player.x), py:Math.round(G.player.y)," +
  " t:Math.round(G.t), kills:G.kills, uni:G.unique, state:G.state," +
  " pending:G.pending.length, pick:G.curPick && G.curPick.type," +
  " opts:G.curPick && G.curPick.opts, bossSpawned:G.bossSpawned," +
  " arena:!!G.arena, adv:G.adv, up:G.up }; };\n})();");
if (probed === code) { console.log("probe injection failed"); process.exit(1); }

vm.createContext(sandbox);
try { vm.runInContext(probed, sandbox, { filename: "game.js" }); }
catch (e) { console.log("BOOT FAILED: " + e.stack); process.exit(1); }
console.log("boot OK");

function key(type, code){
  (winLis[type] || []).forEach(f => f({ code, preventDefault(){}, repeat:false }));
}

// bấm Bắt đầu, bật bất tử để con bot sống hết 10 phút
$("btn-start").click();
$("t-god").checked = true; $("t-god").fire("change");

const frame = rafQueue[0];
const DIRS = [["ArrowUp"],["ArrowDown"],["ArrowLeft"],["ArrowRight"],
              ["ArrowUp","ArrowLeft"],["ArrowUp","ArrowRight"],
              ["ArrowDown","ArrowLeft"],["ArrowDown","ArrowRight"]];
let held = [];
function steer(i){
  held.forEach(c => key("keyup", c));
  held = DIRS[i % DIRS.length];
  held.forEach(c => key("keydown", c));
}

let picks = 0, errors = 0;
const DT = 50;            // frame() tự kẹp ở 50ms, chạy đúng nhịp tối đa
const TARGET_T = 650;     // giây TRONG GAME cần đạt tới
const MAX_ITER = 200000;  // chặn vòng lặp chạy hoang
// Đếm theo thời gian trong game chứ không theo số khung: menu nâng cấp có khoá chống bấm đúp
// tính bằng thời gian thật, nên lúc menu mở vòng lặp quay rất nhiều mà đồng hồ game đứng yên.
let ts = 0, seen = {}, i = 0, FRAMES = 0, lastT = null;
for (; i < MAX_ITER; i++){
  if (sandbox.__probe().t >= TARGET_T) break;
  FRAMES++;
  ts += DT;
  // 100 giây đầu chạy thẳng một hướng để ép chạm ngưỡng thu hồi quái, sau đó lang thang
  if (FRAMES === 1) steer(3);
  else if (FRAMES >= 2000 && FRAMES % 37 === 0) steer(Math.floor(FRAMES / 37));
  if (FRAMES % 20000 === 1) console.log("  " + JSON.stringify(sandbox.__probe()));
  // Phát hiện treo: đồng hồ trong game không nhúc nhích suốt 20000 vòng. Cửa sổ phải rộng
  // vì menu nâng cấp có khoá chống bấm đúp tính bằng thời gian THẬT — lúc menu mở, vòng lặp
  // quay hàng nghìn lần mà đồng hồ game đứng yên, và đó là bình thường.
  if (FRAMES % 20000 === 0){
    var now = sandbox.__probe();
    // thắng hoặc chết thì đồng hồ dừng là đúng, không phải treo
    if (now.state === "win" || now.state === "dead"){
      console.log("kết thúc: " + now.state + " ở t=" + now.t + "s");
      break;
    }
    if (lastT !== null && now.t === lastT){
      console.log("STALL tại t=" + now.t + "s -> " + JSON.stringify(now));
      console.log("  overlay pick on = " + $("ov-pick").classList.contains("on") +
                  ", số thẻ = " + $("pick-list").children.length);
      break;
    }
    lastT = now.t;
  }
  try { frame(ts); }
  catch (e) { errors++; if (errors === 1) console.log("RUNTIME ERROR frame " + i + ": " + e.stack); if (errors > 3) break; }
  const list = $("pick-list");
  if ($("ov-pick").classList.contains("on") && list.children.length){
    const kicker = $("pick-kicker").textContent;
    seen[kicker] = (seen[kicker] || 0) + 1;
    const card = list.children[Math.floor(list.children.length / 2)];
    try { card.click(); picks++; }
    catch (e) { errors++; console.log("PICK ERROR: " + e.stack); if (errors > 3) break; }
  }
}
console.log("frames=" + FRAMES + "  iter=" + i + "  picks=" + picks + "  errors=" + errors +
            "  t=" + sandbox.__probe().t + "s");
console.log("menus seen: " + JSON.stringify(seen));
console.log("boss name=" + JSON.stringify($("bossname").textContent) + " hidden=" + $("bosswrap").hidden);
var end = sandbox.__probe();
console.log("node đã mở (" + Object.keys(end.up).length + "): " + Object.keys(end.up).join(", "));
console.log("hud time=" + $("c-time").textContent + "  kills=" + $("c-kills").textContent +
            "  lvl=" + $("c-lvl").textContent + "  gold=" + $("c-gold").textContent);
console.log("dead overlay=" + $("ov-dead").classList.contains("on") +
            "  win overlay=" + $("ov-win").classList.contains("on"));
