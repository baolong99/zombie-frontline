// Kiểm cú pháp: biên dịch từng khối <script> trong index.html mà không chạy nó.
// new Function() ở đây chỉ để BIÊN DỊCH, không hề gọi — đầu vào là chính file nguồn của dự án.
const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(p, "utf8");
const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0, bad = 0;
while ((m = re.exec(html))) {
  i++;
  const code = m[1];
  const line = html.slice(0, m.index).split("\n").length;
  try {
    new Function(code);
    console.log("script #" + i + " (dòng " + line + "): OK, " + code.split("\n").length + " dòng");
  } catch (e) {
    bad++;
    console.log("script #" + i + " (dòng " + line + "): " + e.message);
  }
}
console.log(bad ? "FAILED" : "tất cả script đều parse được");

// ---- id trùng nhau
// Đây là lỗi câm nhất trong cả file: getElementById trả về phần tử ĐẦU TIÊN mang id đó,
// nên cái thứ hai vừa không nhận sự kiện vừa không được gán chữ, mà không có lỗi nào được
// ném ra. Đã xảy ra thật: nút "+10.000 vàng" trùng id với ô vàng trên màn hình chết, nên
// nút hiện ra trống trơn và bấm không ăn gì, trong khi mọi bài kiểm khác đều xanh.
const ids = {};
let dup = 0;
const idRe = /\sid="([^"]+)"/g;
let mm;
while ((mm = idRe.exec(html))){
  const id = mm[1];
  ids[id] = (ids[id] || 0) + 1;
  if (ids[id] === 2){
    dup++;
    console.log("ID TRÙNG: \"" + id + "\" xuất hiện nhiều lần");
  }
}
if (!dup) console.log("không có id trùng (" + Object.keys(ids).length + " id)");
process.exit(bad || dup ? 1 : 0);
